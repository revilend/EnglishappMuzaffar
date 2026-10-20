import asyncio
import html
import io
import json
import logging
import os
import re
from datetime import datetime, timezone
from aiohttp import web
from aiogram import Bot, Dispatcher, types, F
from aiogram.fsm.context import FSMContext
from aiogram.filters import Command, CommandStart
from aiogram.filters.state import StateFilter
from aiogram.types import (
    InlineKeyboardMarkup, 
    InlineKeyboardButton, 
    KeyboardButton,
    ReplyKeyboardMarkup,
    WebAppInfo, 
    MenuButtonWebApp,
    BufferedInputFile
)
from supabase import create_client, Client
import config

logging.basicConfig(level=logging.INFO)

try:
    bot = Bot(token=config.BOT_TOKEN)
except Exception as _e:
    bot = None
    logging.error(f"BOT_TOKEN yaroqsiz: {_e}")

dp = Dispatcher()
supabase: Client = create_client(config.SUPABASE_URL, config.SUPABASE_KEY)


# ============================================================
# Render uchun kichik Web Server (Port scan xatosini oldini oladi)
# ============================================================
async def handle_ping(request):
    return web.Response(text="Bot is running 24/7 on Render!")

async def start_dummy_web_server():
    app = web.Application()
    app.router.add_get("/", handle_ping)
    app.router.add_get("/health", handle_ping)
    runner = web.AppRunner(app)
    await runner.setup()
    port = int(os.getenv("PORT", 10000))
    site = web.TCPSite(runner, "0.0.0.0", port)
    await site.start()
    logging.info(f"Dummy health-check web server started on port {port}")


# ============================================================
# INTERAKTIV MENYULAR (ReplyKeyboardMarkup — doimiy klaviatura)
# ============================================================
ADMIN_MENU = {
    "speak": "🎙 Yangi Speakinglar",
    "students": "👥 O'quvchilar va Qarzlar",
    "backup": "📥 Bazani yuklab olish (Backup)",
    "cleanup": "🗑 Bazani tozalash",
}
STUDENT_MENU = {
    "speak": "🎙 Speaking topshirish",
    "grades": "📊 Baholarim va Qarzim",
    "login": "🔑 Login orqali ulash",
}


def admin_reply_keyboard() -> ReplyKeyboardMarkup:
    """Ustoz (Muzaffar Amirov) uchun doimiy menyu tugmalari."""
    return ReplyKeyboardMarkup(
        resize_keyboard=True,
        is_persistent=True,
        keyboard=[
            [KeyboardButton(text="📱 Muzaffar Amirov Paneli",
                            web_app=WebAppInfo(url=config.WEBAPP_URL))],
            [KeyboardButton(text=ADMIN_MENU["speak"]), KeyboardButton(text=ADMIN_MENU["students"])],
            [KeyboardButton(text=ADMIN_MENU["backup"]), KeyboardButton(text=ADMIN_MENU["cleanup"])],
        ],
    )


def get_main_keyboard() -> ReplyKeyboardMarkup:
    """Asosiy menyu — barcha foydalanuvchilar uchun."""
    return ReplyKeyboardMarkup(
        resize_keyboard=True,
        is_persistent=True,
        keyboard=[
            [KeyboardButton(text="📱 Shaxsiy Kabinetim",
                            web_app=WebAppInfo(url=config.WEBAPP_URL))],
            [KeyboardButton(text=STUDENT_MENU["speak"]), KeyboardButton(text=STUDENT_MENU["grades"])],
            [KeyboardButton(text=STUDENT_MENU["login"])],
        ],
    )


async def _deny_non_admin(message: types.Message) -> bool:
    if message.from_user.id == config.ADMIN_ID:
        return False
    await message.answer("Kechirasiz, bu bo'lim faqat Muzaffar Amirov uchun mavjud.")
    return True


# ---------------- Ustoz: 📥 Backup (tugma) ----------------
@dp.message(F.text == ADMIN_MENU["backup"])
async def btn_admin_backup(message: types.Message):
    if await _deny_non_admin(message):
        return
    await send_backup_document(config.ADMIN_ID)


# ---------------- Ustoz: 👥 O'quvchilar ro'yxati ----------------
@dp.message(F.text == ADMIN_MENU["students"])
async def btn_admin_students(message: types.Message):
    if await _deny_non_admin(message):
        return
    try:
        studs = supabase.table("students").select("id, name, school_class, speaking_debt, group_id").order("name").execute().data or []
        groups = {g["id"]: g.get("name") for g in (supabase.table("groups").select("id, name").execute().data or [])}
    except Exception as e:
        logging.error(f"students list: {e}")
        await message.answer("⚠️ Bazadan o'quvchilarni olib bo'lmadi. Birozdan keyin qayta urinib ko'ring.")
        return
    if not studs:
        await message.answer("👥 O'quvchilar ro'yxati bo'sh.")
        return
    lines = [f"👥 <b>O'quvchilar ro'yxati</b> — {len(studs)} ta\n"]
    for i, s in enumerate(studs, 1):
        gname = groups.get(s.get("group_id")) or "—"
        debt = int(s.get("speaking_debt") or 0)
        lines.append(
            f"{i}. <b>{html.escape(str(s.get('name') or '?'))}</b>\n"
            f"   🏫 {html.escape(str(s.get('school_class') or '—'))} | 👥 {html.escape(str(gname))} | "
            f"💰 Speaking qarzi: {debt} ta"
        )
    text = "\n".join(lines)
    # Telegram cheklovi uchun 4000 belgidan bo'lib yuboramiz
    chunk = ""
    for line in text.split("\n"):
        if len(chunk) + len(line) + 1 > 3800:
            await message.answer(chunk, parse_mode="HTML")
            chunk = line
        else:
            chunk = (chunk + "\n" + line) if chunk else line
    if chunk:
        await message.answer(chunk, parse_mode="HTML")


# ---------------- Ustoz: 🗑 Bazani tozalash (AVVAL zaxira!) ----------------
CLEANUP_TARGETS = {
    "messages": ["messages"],
    "attendance": ["attendance"],
    "all": ["messages", "grades", "attendance", "speaking_submissions", "audio_submissions",
            "homework", "students", "groups"],
}


@dp.message(F.text == ADMIN_MENU["cleanup"])
async def btn_admin_cleanup(message: types.Message):
    if await _deny_non_admin(message):
        return
    # 1) AVVAL to'liq zaxira fayli yuboriladi
    await send_backup_document(config.ADMIN_ID)
    # 2) Keyin tasdiq tugmalari
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🧹 Xabarlarni tozalash (chat)", callback_data="cleanup:messages"),
         InlineKeyboardButton(text="🧹 Davomatni tozalash (attendance)", callback_data="cleanup:attendance")],
        [InlineKeyboardButton(text="🧹 Barcha ma'lumotlarni tozalash", callback_data="cleanup:all")],
        [InlineKeyboardButton(text="❌ Bekor qilish", callback_data="cleanup:cancel")],
    ])
    await message.answer(
        "📤 Zaxira fayli yuborildi.\n"
        "Eski ma'lumotlar fayl ko'rinishida yuklandi. Bazani tozalashni tasdiqlaysizmi?",
        reply_markup=kb,
    )


@dp.callback_query(F.data.startswith("cleanup:"))
async def on_cleanup_answer(call: types.CallbackQuery):
    if call.from_user.id != config.ADMIN_ID:
        await call.answer("Ruxsat yo'q", show_alert=True)
        return
    action = call.data.split(":", 1)[1]
    if action == "cancel" or action not in CLEANUP_TARGETS:
        await call.answer("Bekor qilindi")
        try:
            await call.message.edit_text("❌ Tozalash bekor qilindi.")
        except Exception:
            pass
        return
    await call.answer("Tozalansin...")
    try:
        await call.message.edit_text("⏳ Jadval tozalanmoqda...")
    except Exception:
        pass
    counts = {}
    for t in CLEANUP_TARGETS[action]:
        try:
            res = supabase.table(t).delete().gte("id", 0).execute()
            counts[t] = len(res.data or [])
        except Exception as e:
            logging.error(f"cleanup {t}: {e}")
            counts[t] = -1
    bad = [k for k, v in counts.items() if v < 0]
    lines = "\n".join(f"• {k}: {v if v >= 0 else 'xatolik'} ta" for k, v in counts.items())
    text = f"✅ <b>Jadval tozalandi!</b>\n\n{lines}"
    if bad:
        text += f"\n\n⚠️ Tekshiriladigan jadvallar: {', '.join(bad)}"
    try:
        await call.message.edit_text(text, parse_mode="HTML")
    except Exception:
        pass


# ---------------- Ustoz: 🎙 Yangi Speakinglar ----------------
@dp.message(F.text == ADMIN_MENU["speak"])
async def btn_admin_new_speakings(message: types.Message):
    if await _deny_non_admin(message):
        return
    try:
        subs = supabase.table("speaking_submissions").select(
            "id, student_id, media_type, telegram_file_id, status, created_at"
        ).eq("status", "kutilmoqda").order("id", desc=True).limit(15).execute().data or []
        stud_ids = {s.get("student_id") for s in subs}
        studs = {}
        if stud_ids:
            for st in (supabase.table("students").select("id, name, school_class, speaking_debt, voice_allowed").in_("id", list(stud_ids)).execute().data or []):
                studs[st["id"]] = st
    except Exception as e:
        logging.error(f"new speakings: {e}")
        await message.answer("⚠️ Speaking topshiriklarini olib bo'lmadi.")
        return
    if not subs:
        await message.answer("🎙 Hozircha yangi speaking topshirik yo'q.")
        return
    header = f"🎙 <b>Yangi speakinglar</b> — {len(subs)} ta kutilmoqda\n"
    rows = []
    for i, sub in enumerate(subs, 1):
        st = studs.get(sub.get("student_id")) or {}
        name = html.escape(str(st.get('name') or '?'))
        cls = html.escape(str(st.get('school_class') or '—'))
        rows.append(f"{i}. <b>{name}</b> ({cls}) — {sub.get('media_type', '?')} | {sub.get('created_at', '')[:16]}")
    await message.answer(header + "\n" + "\n".join(rows), parse_mode="HTML")

    # Oxirgi 3 ta topshirikni media ko'rinishida qayta yuboradi (1-tap baho bilan)
    for sub in subs[:3]:
        st = studs.get(sub.get("student_id")) or {}
        if not sub.get("telegram_file_id"):
            continue
        await _send_media_to_teacher(
            file_id=sub["telegram_file_id"],
            media_type=sub.get("media_type") or "voice",
            student=st,
            sub_id=sub.get("id"),
        )


# /start command
@dp.message(CommandStart(), StateFilter("*"))
async def cmd_start(message: types.Message, state: FSMContext):
    await state.clear()
    user_id = message.from_user.id
    user_name = html.escape(message.from_user.full_name or "O'quvchi")

    # Yangi/oldingi foydalanuvchini bazadan topish (single() ishlatilmaydi)
    student = None
    try:
        res = supabase.table("students").select("*")
        res = res.eq("telegram_chat_id", user_id).execute()
        if res.data and len(res.data) > 0:
            student = res.data[0]
    except Exception as e:
        logging.error(f"Student lookup: {e}")

    if student:
        st_name = html.escape(student.get("name", user_name))
        text = (
            f"Assalomu alaykum, <b>{st_name}</b>!\n\n"
            f"Hisobingiz ulangan. Quyidagi menyudan foydalanishingiz mumkin:"
        )
    else:
        text = (
            f"Assalomu alaykum, <b>{user_name}</b>!\n\n"
            f"Teacher Muzaffar Amirovning ingliz tili platformasiga xush kelibsiz!\n\n"
            f"Botdan to'liq foydalanish uchun hisobingizni ulang:\n"
            f"Pastdagi <b>🔑 Login orqali ulash</b> tugmasini bosing yoki:\n"
            f"<code>/login login parol</code> shaklida yuboring "
            f"(Masalan: <code>/login jasur 123</code>)."
        )

    await message.answer(text, reply_markup=get_main_keyboard(), parse_mode="HTML")


# /admin command — To'liq ustoz boshqaruv paneli
@dp.message(Command("admin"))
async def cmd_admin(message: types.Message):
    if message.from_user.id != config.ADMIN_ID:
        await message.answer("⛔ Kechirasiz! Ushbu buyruq faqat Muzaffar Amirov uchun.")
        return
    try:
        await bot.set_chat_menu_button(
            chat_id=message.from_user.id,
            menu_button=MenuButtonWebApp(text="📱 Muzaffar Amirov Paneli",
                                         web_app=WebAppInfo(url=config.WEBAPP_URL))
        )
    except Exception as e:
        logging.warning(f"set_chat_menu_button (/admin): {e}")
    inline = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🚀 Muzaffar Amirov Panelini ochish",
                              web_app=WebAppInfo(url=config.WEBAPP_URL))],
    ])
    await message.answer(
        "🎛 <b>Muzaffar Amirov — boshqaruv paneli</b>\n\n"
        "Quyidagi tugmalar orqali boshqaruvni amalga oshiring:",
        reply_markup=inline, parse_mode="HTML")
    await message.answer("📋 <b>Ustoz menyusi</b> — kerakli bo'limni tanlang:",
                         reply_markup=admin_reply_keyboard(), parse_mode="HTML")


# ============================================================
# O'quvchini Telegram hisobiga ulash (/login) + yordamchilar
# ============================================================
def student_by_chat(chat_id: int):
    """Telegram chat_id bilan ulangan o'quvchini topadi."""
    try:
        rows = supabase.table("students").select("*").eq("telegram_chat_id", chat_id).limit(1).execute().data
        return rows[0] if rows else None
    except Exception as e:
        logging.warning(f"student_by_chat: {e}")
        return None


@dp.message(Command("login"))
async def cmd_login(message: types.Message):
    """O'quvchi: /login <login> <parol> — bot va hisobni ulaydi."""
    parts = (message.text or "").split()
    if len(parts) != 3:
        await message.answer(
            "🔑 <b>O'quvchi kabineti ulanishi</b>\n\n"
            "Iltimos, shu ko'rinishda yozing:\n"
            "<code>/login jasur 123</code>\n\n"
            "yoki menyudan <b>🔑 Login orqali ulash</b> tugmasini bosing.",
            parse_mode="HTML",
        )
        return
    await attempt_login(message, parts[1], parts[2])


async def attempt_login(message: types.Message, login: str, password: str):
    """Login/parolni tekshirib, students.telegram_chat_id ni ulaydi."""
    try:
        # Ustoz tekshiruvi
        if login.lower() == "m_amirov" and password == "123":
            await message.answer("👑 <b>Xush kelibsiz, Muzaffar Amirov!</b>\n\nUstoz hisobingiz ulandi.", reply_markup=admin_reply_keyboard(), parse_mode="HTML")
            return
        # O'quvchini bazadan qidirish
        try:
            res = supabase.table("students").select("*").eq("login", login).execute()
            rows = res.data or []
        except Exception as db_e:
            logging.error(f"login query: {db_e}")
            await message.answer("⚠️ Bazaga ulanib bo'lmadi. Birozdan so'ng qayta urinib ko'ring.")
            return
        if not rows:
            await message.answer(f"❌ <b>'{html.escape(login)}'</b> nomli login topilmadi! Iltimos, to'g'ri login kiriting.", parse_mode="HTML")
            return
        st = rows[0]
        st_pwd = str(st.get("password") if st.get("password") is not None else "").strip()
        if st_pwd != str(password).strip():
            await message.answer("❌ Kiritilgan parol noto'g'ri. Qayta urinib ko'ring.", parse_mode="HTML")
            return
        # Chat ID ulash
        try:
            supabase.table("students").update({"telegram_chat_id": message.from_user.id}).eq("id", st["id"]).execute()
        except Exception as e:
            logging.error(f"login update: {e}")
        pending_logins.discard(message.from_user.id)
        st_name = html.escape(str(st.get("name") or login))
        welcome_msg = (
            f"✅ <b>Xush kelibsiz, {st_name}!</b>\n\n"
            "Hisobingiz Telegramga muvaffaqiyatli ulandi. Endi speaking topshirishingiz va baholaringizni ko'rishingiz mumkin."
        )
        # Xabarni kafolatlangan holda yuborish
        try:
            kb = InlineKeyboardMarkup(inline_keyboard=[
                [InlineKeyboardButton(text="🚀 Shaxsiy Kabinetga kirish", web_app=WebAppInfo(url=config.WEBAPP_URL))]
            ])
            await message.answer(welcome_msg, reply_markup=kb, parse_mode="HTML")
        except Exception as kb_err:
            logging.error(f"Inline kb error: {kb_err}")
            await message.answer(welcome_msg, parse_mode="HTML")
        try:
            await message.answer("📋 O'quvchi menyusi:", reply_markup=get_main_keyboard(), parse_mode="HTML")
        except Exception:
            pass
    except Exception as e:
        logging.error(f"attempt_login fatal: {e}")
        await message.answer(f"⚠️ Xatolik yuz berdi: {e}")


# ============================================================
# O'QUVCHI MENYUSI (ReplyKeyboard tugmalari)
# ============================================================
pending_logins = set()  # chat_id lar "login parol" kutmoqda


async def _linked_or_prompt(message: types.Message):
    """Ulangan o'quvchini qaytaradi; ulanmagan bo'lsa yo'riqnoma yuborib None."""
    st = student_by_chat(message.from_user.id)
    if st:
        return st
    await message.answer(
        "🔐 <b>Avval hisobingizni ulang!</b>\n\n"
        "Menyudan <b>🔑 Login orqali ulash</b> tugmasini bosing va login/parolni yuboring "
        "(yoki <code>/login jasur 123</code>).",
        parse_mode="HTML",
    )
    return None


@dp.message(F.text == STUDENT_MENU["login"])
async def btn_student_login(message: types.Message):
    if message.from_user.id == config.ADMIN_ID:
        await message.answer("Bu o'quvchi menyusi — siz allaqachon ustoz sifatida kirdingiz.")
        return
    st = student_by_chat(message.from_user.id)
    if st:
        await message.answer(f"✅ Siz ulangan: <b>{html.escape(str(st.get('name') or ''))}</b>", parse_mode="HTML")
        return
    pending_logins.add(message.from_user.id)
    await message.answer(
        "🔑 <b>Login orqali ulash</b>\n\n"
        "Loginni va parolni <b>bitta xabarda</b> yozing — masalan:\n"
        "<code>jasur 123</code>\n\n"
        "Login va parolingizni ilovadan ko'rishingiz mumkin.",
        parse_mode="HTML",
    )


@dp.message(F.text == STUDENT_MENU["grades"])
async def btn_student_grades(message: types.Message):
    if message.from_user.id == config.ADMIN_ID:
        await message.answer("Bu o'quvchi menyusi — baholaringiz saytda Muzaffar Amirov panelida.")
        return
    st = await _linked_or_prompt(message)
    if not st:
        return
    try:
        rows = supabase.table("grades").select("date, grade, category")\
            .eq("student_id", st["id"]).order("date", desc=True).limit(50).execute().data or []
    except Exception as e:
        logging.error(f"my grades: {e}")
        await message.answer("⚠️ Baholarni olib bo'lmadi. Birozdan keyin qayta urinib ko'ring.")
        return
    debt = int(st.get("speaking_debt") or 0)
    name = html.escape(str(st.get("name") or "?"))
    if not rows:
        await message.answer(
            f"📊 <b>{name}</b> — natijalar\n\n"
            "🧮 Hozircha baho yo'q.\n"
            f"💰 Speaking qarzi: {debt} ta",
            parse_mode="HTML",
        )
        return
    scores = [int(r.get("grade") or 0) for r in rows if r.get("grade") is not None]
    avg = round(sum(scores) / len(scores), 1) if scores else 0
    lines = [
        f"📊 <b>{name}</b> — natijalar\n",
        f"🧮 <b>O'rtacha baho: {avg}/10</b> ({len(scores)} ta baho)",
        f"💰 <b>Speaking qarzi: {debt} ta</b>\n",
        "So'nggi baholar:",
    ]
    for r in rows[:7]:
        d = str(r.get("date") or "")[5:]
        cat = html.escape(str(r.get("category") or ""))
        lines.append(f"• {d.replace('-', '.')} — {r.get('grade')}/10 ({cat})")
    await message.answer("\n".join(lines), parse_mode="HTML")


@dp.message(F.text == STUDENT_MENU["speak"])
async def btn_student_speak(message: types.Message):
    if message.from_user.id == config.ADMIN_ID:
        await message.answer("🎙 Ovozli topshiriklar o'quvchilardan keladi — ular menyudan foydalanadi.")
        return
    st = await _linked_or_prompt(message)
    if not st:
        return
    if st.get("voice_allowed") is False:
        await message.answer(
            "⛔ Kechirasiz! Ustoz hozircha sizga ovozli topshirishga ruxsat bermagan. Darsda topshiring."
        )
        return
    debt = int(st.get("speaking_debt") or 0)
    await message.answer(
        "🎙 <b>Speaking topshirish</b>\n\n"
        "Shu yerga <b>vozli xabar</b> (ovozli xabar) yoki <b>dumaloq video</b> (krujok) yuboring — "
        "men ustozga yo'llayman va baho qaytganda xabar olasiz.\n\n"
        f"💰 Joriy speaking qarzi: {debt} ta",
        parse_mode="HTML",
    )


# ============================================================
# Voice & Video Speaking Submissions (faqat ulangan o'quvchi,
# voice_allowed = true bo'lgandagina qabul qilinadi)
# ============================================================
def grade_keyboard(sub_id) -> InlineKeyboardMarkup:
    """Ustoz uchun 1-tap baho: [10][9][8][7][6] / [5][4][3][2][1] + [📝 Saytda ochish]."""
    rows = [
        [InlineKeyboardButton(text=str(n), callback_data=f"g:{sub_id}:{n}")
         for n in (10, 9, 8, 7, 6)],
        [InlineKeyboardButton(text=str(n), callback_data=f"g:{sub_id}:{n}")
         for n in (5, 4, 3, 2, 1)],
    ]
    return InlineKeyboardMarkup(inline_keyboard=rows + [
        [InlineKeyboardButton(text="📝 Saytda ochish", web_app=WebAppInfo(url=config.WEBAPP_URL))],
    ])


def speaking_caption(student: dict, media_type: str) -> str:
    """Ustozga yuboriladigan kaptor: ism, sinf va joriy speaking qarzi."""
    name = html.escape(str(student.get("name") or "?"))
    cls = html.escape(str(student.get("school_class") or "—"))
    debt = int(student.get("speaking_debt") or 0)
    return (
        "🎙 <b>YANGI SPEAKING TOPSHIRILDI!</b>\n\n"
        f"👤 <b>O'quvchi:</b> {name}\n"
        f"🏫 <b>Sinf:</b> {cls}\n"
        f"💰 <b>Speaking qarzi:</b> {debt} ta\n"
        f"📹 <b>Turi:</b> {media_type.upper()}\n\n"
        "Pastdagi tugmalar bilan 1-tap baho qo'ying yoki 📝 Saytda oching."
    )


async def _send_media_to_teacher(file_id: str, media_type: str, student: dict, sub_id=None):
    """Mediafaylni ustozga yuboradi (baho tugmalari bilan)."""
    caption = speaking_caption(student, media_type)
    kb = grade_keyboard(sub_id) if sub_id is not None else InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="📝 Saytda ochish", web_app=WebAppInfo(url=config.WEBAPP_URL))],
    ])
    if media_type == "video_note":
        # Krujokka inline tugma ilova bo'lmaydi — matn xabari bilan yuboramiz
        await bot.send_video_note(chat_id=config.ADMIN_ID, video_note=file_id)
        await bot.send_message(chat_id=config.ADMIN_ID, text=caption, reply_markup=kb, parse_mode="HTML")
    elif media_type == "video":
        await bot.send_video(chat_id=config.ADMIN_ID, video=file_id, caption=caption,
                             reply_markup=kb, parse_mode="HTML")
    else:
        await bot.send_voice(chat_id=config.ADMIN_ID, voice=file_id, caption=caption,
                             reply_markup=kb, parse_mode="HTML")


@dp.message(F.voice | F.video_note | F.video)
async def handle_speaking_submission(message: types.Message):
    user = message.from_user
    media_type = "voice" if message.voice else ("video_note" if message.video_note else "video")
    file_id = message.voice.file_id if message.voice else (message.video_note.file_id if message.video_note else message.video.file_id)

    # 1) O'quvchi ulanganmi?
    student = student_by_chat(user.id)
    if not student:
        await message.answer(
            "🔐 <b>Avval hisobingizni ulang!</b>\n\n"
            "Menyudan <b>🔑 Login orqali ulash</b> tugmasini bosing yoki shunday yozing: <code>/login jasur 123</code>\n"
            "(Login va parolingizni o'quvchi kabinetasidan oling)",
            parse_mode="HTML",
        )
        return

    # 2) Muzaffar Amirov ruxsat berganmi? (students.voice_allowed)
    if student.get("voice_allowed") is False:
        await message.answer(
            "⛔ Kechirasiz! Ustoz hozircha sizga ovozli topshirishga ruxsat bermagan. Darsda topshiring."
        )
        return

    # 3) Supabase'ga yozish — TOPSHIRISH SPEAKING QARZINI HECH QACHON OSHIRMAYDI!
    #    (mantiq: qarzni faqat BAHOLASH kamaytiradi — botda yoki saytda)
    sub_id = None
    try:
        res = supabase.table("speaking_submissions").insert({
            "student_id": student["id"],
            "media_type": media_type,
            "telegram_file_id": file_id,
            "status": "kutilmoqda",
        }).select("id").execute()
        if res.data:
            sub_id = res.data[0].get("id")
    except Exception as e:
        logging.error(f"Supabase error (speaking_submissions): {e}")

    # 4) Ustozga yuborish (ism, sinf, qarz + 1-tap baho tugmalari bilan)
    try:
        await _send_media_to_teacher(file_id, media_type, student, sub_id)
    except Exception as e:
        logging.error(f"forward to teacher: {e}")

    await message.reply(
        "✅ <b>Qabul qilindi!</b>\nSpeaking vazifangiz Muzaffar Amirovga yuborildi. Muzaffar Amirov tekshirib baho qo'yishi bilan speaking qarzingiz kamayadi.",
        parse_mode="HTML",
    )


# ---------------- Ustoz: 1-tap baho (Telegramda) ----------------
@dp.callback_query(F.data.startswith("g:"))
async def on_grade_tap(call: types.CallbackQuery):
    """Ustoz [9] bosadi → baho jurnalga, qarz −1, o'quvchiga xabar."""
    if call.from_user.id != config.ADMIN_ID:
        await call.answer("Ruxsat yo'q", show_alert=True)
        return
    try:
        _p = call.data.split(":")
        sub_id, score = int(_p[1]), int(_p[2])
        if not (1 <= score <= 10):
            raise ValueError("score 1..10")
    except Exception:
        await call.answer("Noto'g'ri baho", show_alert=True)
        return

    try:
        subs = supabase.table("speaking_submissions").select(
            "id, student_id, status, media_type, created_at"
        ).eq("id", sub_id).limit(1).execute().data
    except Exception as e:
        logging.error(f"grade load sub: {e}")
        await call.answer("Bazaga ulanib bo'lmadi", show_alert=True)
        return
    if not subs:
        await call.answer("Topshirik topilmadi", show_alert=True)
        return
    sub = subs[0]
    if sub.get("status") == "baholandi":
        await call.answer(f"Bu topshirik allaqachon baholangan ({sub.get('score')}/10)", show_alert=True)
        return

    # O'quvchi HAR BIR tapda to'g'ridan-to'g'ri Supabase'dan o'qiladi
    # (in-memory lug'at/kesh ishlatilmaydi) — telegram_chat_id ham shu yangi qatordan.
    try:
        studs = supabase.table("students").select("id, name, school_class, speaking_debt, telegram_chat_id").\
            eq("id", sub["student_id"]).limit(1).execute().data
    except Exception as e:
        logging.error(f"grade load student: {e}")
        await call.answer("O'quvchi topilmadi", show_alert=True)
        return
    if not studs:
        await call.answer("O'quvchi topilmadi", show_alert=True)
        return
    st = studs[0]

    gdate = (str(sub.get("created_at") or "")[:10]) or datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # 1) Bahoni jurnalga yozish (sinfmodel: bitta kunda bitta baho)
    try:
        supabase.table("grades").delete().eq("student_id", st["id"]).eq("date", gdate).execute()
        supabase.table("grades").insert({
            "student_id": st["id"], "date": gdate, "grade": score,
            "category": "Speaking", "note": "Speaking (Telegram)",
        }).execute()
    except Exception as e:
        logging.error(f"grade insert: {e}")

    # 2) Speaking qarzini −1 (faqat birinchi marta)
    debt_before = int(st.get("speaking_debt") or 0)
    debt_after = max(0, debt_before - 1)
    try:
        supabase.table("students").update({"speaking_debt": debt_after}).eq("id", st["id"]).execute()
    except Exception as e:
        logging.error(f"debt update: {e}")

    # 3) Topshirikni baholandi deb belgilash
    try:
        supabase.table("speaking_submissions").update(
            {"status": "baholandi", "score": score}
        ).eq("id", sub_id).execute()
    except Exception as e:
        logging.error(f"sub update: {e}")

    # 4) O'quvchiga xabar (telegram_chat_id — Supabase qatordan)
    chat_id = st.get("telegram_chat_id")
    notified = False
    if chat_id:
        try:
            if debt_after < debt_before:
                note = (f"🎉 Muzaffar Amirov sizga {score}/10 ball qo'ydi! "
                        "Speaking qarzingiz 1 taga kamaydi.")
            else:
                note = (f"🎉 Muzaffar Amirov sizga {score}/10 ball qo'ydi! "
                        "Speaking qarzingiz yo'q.")
            await bot.send_message(chat_id=int(chat_id), text=note)
            notified = True
        except Exception as e:
            logging.error(f"notify student {chat_id}: {e}")

    # 5) Ustozga tasdiq (xabar yangilanadi)
    name = html.escape(str(st.get("name") or "?"))
    if debt_after < debt_before:
        done_text = ("✅ <b>Baholandi!</b> Speaking qarzi 1 taga kamaytirildi.\n"
                     f"{name} — {score}/10\n💰 Qarz: {debt_before} → {debt_after} ta")
    else:
        done_text = ("✅ <b>Baholandi!</b>\n"
                     f"{name} — {score}/10\n💰 Qarz: {debt_after} ta (qarz yo'q — kamaymadi)")
    if not notified:
        done_text += "\n⚠️ O'quvchi Telegramga ulanmagan — xabar yuborilmadi."
    try:
        if call.message.caption is not None:
            await call.message.edit_caption(caption=done_text, parse_mode="HTML")
        else:
            await call.message.edit_text(done_text, parse_mode="HTML")
    except Exception:
        pass
    await call.answer(f"✅ {score} ball qo'yildi")


# ============================================================
# Uyga vazifalari: yangi homework → guruh o'quvchilariga xabar
# ============================================================
HW_TEXT = (
    "📚 <b>YANGI UYGA VAZIFA!</b>\n"
    "Guruh: {group_name}\n"
    "Mavzu: {title}\n"
    "Vazifa: {description}\n"
    "Muddati: {due_date}"
)

_last_hw_seen = None  # bot boshlanganda mavjud vazifalar "ko'rilgan" bo'ladi


async def broadcast_homework(row: dict) -> int:
    """Bitta vazifani guruh o'quvchilariga yuboradi (ulanganlarga)."""
    hw_id = row.get("id")
    try:
        groups = supabase.table("groups").select("id, name").eq("id", row.get("group_id")).limit(1).execute().data
        group_name = groups[0]["name"] if groups else "—"
        studs = supabase.table("students").select("id, name, telegram_chat_id")\
            .eq("group_id", row.get("group_id")).execute().data
    except Exception as e:
        logging.warning(f"homework lookup {hw_id}: {e}")
        return 0

    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="📱 Ilovani ochish", web_app=WebAppInfo(url=config.WEBAPP_URL))]
    ])
    due = row.get("due_date") or "—"
    text = HW_TEXT.format(
        group_name=html.escape(str(group_name)),
        title=html.escape(str(row.get("title") or "—")),
        description=html.escape(str(row.get("description") or "—")),
        due_date=html.escape(str(due)),
    )
    sent = 0
    for st in studs:
        chat_id = st.get("telegram_chat_id")
        if not chat_id:
            continue
        try:
            await bot.send_message(chat_id=int(chat_id), text=text, reply_markup=kb, parse_mode="HTML",
                               disable_notification=False)  # ovozli (sound)
            sent += 1
        except Exception as e:
            logging.warning(f"homework notify {st.get('id')} -> {chat_id}: {e}")
    return sent


async def hw_tick():
    """Bitta kuzatuv qadamini bajaradi (test qilinadigan mantiq)."""
    global _last_hw_seen
    rows = supabase.table("homework").select("id, group_id, title, description, due_date").order("id").execute().data or []
    if _last_hw_seen is None:
        # birinchi start: mavjud vazifalarni SPAM qilmaymiz
        _last_hw_seen = rows[-1]["id"] if rows else 0
        logging.info(f"homework watcher: {len(rows)} ta mavjud vazifa ko'rib chiqildi")
        return 0
    sent_total = 0
    for row in rows:
        if row["id"] > _last_hw_seen:
            sent_total += await broadcast_homework(row)
            logging.info(f"homework #{row['id']} -> yangi vazifa yuborildi")
            _last_hw_seen = row["id"]
    return sent_total


async def homework_watcher():
    """homework jadvalini kuzatadi: yangi qator → guruhga xabar (faqat yangilar)."""
    await asyncio.sleep(3)
    while True:
        try:
            await hw_tick()
        except Exception as e:
            msg = str(e)
            if "PGRST205" in msg or "homework" in msg:
                logging.warning("homework jadvali topilmadi — supabase.sql ni ishga tushiring (60s dan keyin qayta)")
                await asyncio.sleep(60)
            else:
                logging.warning(f"homework watcher: {e}")
        await asyncio.sleep(5)


# ============================================================
# Ovozli topshirish ruxsati — ustoz web ilovada yoqsa, o'quvchiga xabar
# ============================================================
VOICE_ALERT_TEXT = (
    "🎙 <b>Ruxsat berildi!</b>\n\n"
    "<b>Muzaffar Amirov</b> sizga ovozli yoki dumaloq video (krujok) orqali "
    "Speaking topshirishga ruxsat berdi.\n"
    "Marhamat, javobingizni shu yerga yuborishingiz mumkin!"
)

_voice_seen: dict = {}  # student_id -> oxirgi voice_allowed holati


async def voice_tick() -> int:
    """voice_allowed false -> true o'tishlarini topib, o'quvchiga xabar yuboradi."""
    global _voice_seen
    try:
        rows = supabase.table("students").select(
            "id, name, voice_allowed, telegram_chat_id"
        ).execute().data or []
    except Exception as e:
        logging.warning(f"voice watcher: {e}")
        return 0

    current = {r["id"]: bool(r.get("voice_allowed")) for r in rows}
    first_run = not _voice_seen
    sent = 0
    for r in rows:
        sid = r["id"]
        allowed = current[sid]
        was = _voice_seen.get(sid)
        # faqat yangi qo'shilgan yoki false -> true o'tishida xabar ketadi
        if not first_run and was is not None and was is False and allowed is True:
            chat_id = r.get("telegram_chat_id")
            if chat_id:
                try:
                    await bot.send_message(chat_id=int(chat_id), text=VOICE_ALERT_TEXT,
                                            parse_mode="HTML", disable_notification=False)  # ovozli (sound)
                    sent += 1
                except Exception as e:
                    logging.warning(f"voice alert {sid} -> {chat_id}: {e}")
    _voice_seen = current
    return sent


async def voice_watcher():
    """students.voice_allowed o'zgarishlarini kuzatadi (ustoz ilovada toggle qilganda)."""
    await asyncio.sleep(3)
    while True:
        try:
            await voice_tick()
        except Exception as e:
            logging.warning(f"voice watcher: {e}")
        await asyncio.sleep(5)


# ============================================================
# Tezkor Telegram bildirishnomalar: yangi baho va chat xabari
# Web ilovadagi brauzer bildirishnomalari bilan bir vaqtda ishlaydi.
# disable_notification=False → ovozli (sound) yetkazish
# ============================================================
def grade_alert_text(grade) -> str:
    return f"📚 <b>Muzaffar Amirov: Sizga yangi baho qo'yildi ({grade}/10)!</b>"


def msg_alert_from_teacher(text: str) -> str:
    return "💬 <b>Muzaffar Amirovdan yangi xabar:</b>\n\n" + html.escape(text)


def msg_alert_from_student(name: str, text: str) -> str:
    return f"💬 <b>{html.escape(name)}: Yangi xabar keldi</b>\n\n" + html.escape(text)


async def send_alert(chat_id, text: str) -> bool:
    """Ovozli (sound) tezkor xabar yuboradi; muvaffaqiyatsiz bo'lsa False."""
    if bot is None or not chat_id:
        return False
    try:
        await bot.send_message(chat_id=int(chat_id), text=text, parse_mode="HTML",
                               disable_notification=False)
        return True
    except Exception as e:
        logging.warning(f"alert -> {chat_id}: {e}")
        return False


_last_grade_seen = None
_last_msg_seen = None


async def grade_tick() -> int:
    """Yangi bahoni topib, o'quvchiga tezkor xabar yuboradi (test qilinadigan mantiq)."""
    global _last_grade_seen
    rows = supabase.table("grades").select("id, student_id, grade, date").order("id").execute().data or []
    if _last_grade_seen is None:
        # birinchi start: mavjud baholarni SPAM qilmaymiz
        _last_grade_seen = rows[-1]["id"] if rows else 0
        logging.info(f"grades watcher: {len(rows)} ta mavjud baho ko'rib chiqildi")
        return 0
    sent = 0
    for row in rows:
        if row["id"] <= _last_grade_seen:
            continue
        _last_grade_seen = row["id"]  # qayta yuborilmaydi
        try:
            studs = supabase.table("students").select("id, telegram_chat_id").\
                eq("id", row["student_id"]).limit(1).execute().data
        except Exception as e:
            logging.warning(f"grades watcher student: {e}")
            continue
        if not studs:
            continue
        if await send_alert(studs[0].get("telegram_chat_id"), grade_alert_text(row.get("grade"))):
            sent += 1
    return sent


async def grades_watcher():
    """grades jadvalini kuzatadi: yangi baho → o'quvchiga tezkor xabar."""
    await asyncio.sleep(3)
    while True:
        try:
            await grade_tick()
        except Exception as e:
            logging.warning(f"grades watcher: {e}")
        await asyncio.sleep(5)


async def message_tick() -> int:
    """Yangi chat xabarini qabul qiluvchiga tezkor xabar qiladi (test qilinadigan mantiq)."""
    global _last_msg_seen
    rows = supabase.table("messages").select("id, student_id, sender, text").order("id").execute().data or []
    if _last_msg_seen is None:
        # birinchi start: mavjud xabarlarni SPAM qilmaymiz
        _last_msg_seen = rows[-1]["id"] if rows else 0
        logging.info(f"messages watcher: {len(rows)} ta mavjud xabar ko'rib chiqildi")
        return 0
    sent = 0
    for row in rows:
        if row["id"] <= _last_msg_seen:
            continue
        _last_msg_seen = row["id"]  # qayta yuborilmaydi
        sender = row.get("sender")
        text = str(row.get("text") or "")
        if sender == "teacher":
            # Ustoz yozgan → o'quvchiga
            try:
                studs = supabase.table("students").select("id, telegram_chat_id").\
                    eq("id", row["student_id"]).limit(1).execute().data
            except Exception as e:
                logging.warning(f"messages watcher student: {e}")
                continue
            if studs and await send_alert(studs[0].get("telegram_chat_id"),
                                          msg_alert_from_teacher(text)):
                sent += 1
        elif sender == "student":
            # O'quvchi yozgan → ustozga
            try:
                studs = supabase.table("students").select("id, name").\
                    eq("id", row["student_id"]).limit(1).execute().data
            except Exception as e:
                logging.warning(f"messages watcher name: {e}")
                continue
            name = (studs[0].get("name") if studs else None) or "O'quvchi"
            if await send_alert(config.ADMIN_ID, msg_alert_from_student(name, text)):
                sent += 1
    return sent


async def messages_watcher():
    """messages jadvalini kuzatadi: yangi xabar → qabul qiluvchiga tezkor xabar."""
    await asyncio.sleep(3)
    while True:
        try:
            await message_tick()
        except Exception as e:
            logging.warning(f"messages watcher: {e}")
        await asyncio.sleep(5)


# ============================================================
# Zaxira (backup / restore) — Supabase
# ============================================================
BACKUP_TABLES = ["groups", "students", "attendance", "grades", "messages", "speaking_submissions", "audio_submissions", "homework"]
RESTORE_PLAN = [
    ("groups", ["id", "name", "days", "time"]),
    ("students", ["id", "name", "school_class", "group_id", "login", "password", "speaking_debt"]),
    ("attendance", ["id", "student_id", "date", "status"]),
    ("grades", ["id", "student_id", "date", "grade", "category", "note"]),
    ("messages", ["id", "student_id", "sender", "text", "created_at"]),
    ("speaking_submissions", ["id", "media_type", "telegram_file_id", "status", "created_at"]),
    ("audio_submissions", ["id", "student_id", "date", "url", "status", "score", "feedback", "created_at"]),
    ("homework", ["id", "group_id", "title", "description", "due_date", "created_at"]),
]
pending_restore_file = {}

BACKUP_LABELS = {
    "groups": "Guruhlar",
    "students": "O'quvchilar",
    "attendance": "Davomat",
    "grades": "Baholar",
    "messages": "Xabarlar",
    "speaking_submissions": "Speaking topshiriklari",
    "audio_submissions": "Ovozli topshiriklar",
    "homework": "Uyga vazifalar",
}


def backup_filename() -> str:
    """english_crm_backup_YYYY-MM-DD.json"""
    return f"english_crm_backup_{datetime.now(timezone.utc).strftime('%Y-%m-%d')}.json"


def _to_int(v):
    """g1/s3 kabi lokal idlarni ham raqamga aylantiradi."""
    if v is None or isinstance(v, bool):
        return None
    try:
        return int(re.sub(r"^[gs]", "", str(v)))
    except (TypeError, ValueError):
        return None


def fetch_all_backup() -> dict:
    """Barcha jadvallarni olib, JSON uchun lug'at qaytaradi (o'qish only)."""
    out = {}
    for t in BACKUP_TABLES:
        try:
            out[t] = supabase.table(t).select("*").execute().data or []
        except Exception as e:
            logging.warning(f"Backup {t}: {e}")
            out[t] = []
    return out


def prepare_restore(data: dict) -> dict:
    """Zaxira qatorlarini tayyorlaydi (pure funksiya — DB'siz test qilinadi):
    id raqamga aylantiriladi, FK mosligi tekshiriladi, yaroqsiz qatorlar tashlanadi."""
    group_ids = {_to_int(g.get("id")) for g in (data.get("groups") or []) if isinstance(g, dict)} - {None}
    student_ids = {_to_int(x.get("id")) for x in (data.get("students") or []) if isinstance(x, dict)} - {None}

    prepared = {}
    for table, cols in RESTORE_PLAN:
        rows = []
        for r in (data.get(table) or []):
            if not isinstance(r, dict):
                continue
            row = {c: r[c] for c in cols if c in r}
            if "id" in row:
                n = _to_int(row["id"])
                if n is None:
                    del row["id"]
                else:
                    row["id"] = n
            if "group_id" in row and row["group_id"] is not None:
                n = _to_int(row["group_id"])
                row["group_id"] = n if n in group_ids else None
            if "student_id" in row:
                n = _to_int(row["student_id"])
                if n not in student_ids:
                    continue  # yo'q o'quvchiga bog'langan qator — tashlanadi
                row["student_id"] = n
            rows.append(row)
        prepared[table] = rows
    return prepared


def restore_backup(data: dict) -> dict:
    """Zaxirani Supabase'ga qayta tiklaydi: avval O'CHIRISH (bog'liq jadvallardan),
    keyin ID saqlanib qayta YOZISH. Har jadval uchun son qaytaradi."""
    for t in ["messages", "grades", "attendance", "speaking_submissions", "audio_submissions", "homework", "students", "groups"]:
        try:
            supabase.table(t).delete().gte("id", 0).execute()
        except Exception as e:
            logging.warning(f"Restore delete {t}: {e}")

    prepared = prepare_restore(data)
    counts = {}
    for table, _cols in RESTORE_PLAN:
        rows = prepared.get(table) or []
        if not rows:
            counts[table] = 0
            continue
        try:
            supabase.table(table).insert(rows).execute()
            counts[table] = len(rows)
        except Exception as e:
            logging.error(f"Restore insert {table}: {e}")
            counts[table] = -1
    return counts


async def send_backup_document(chat_id: int):
    """Barcha jadvallarni timestamped JSON fayl sifatida yuboradi (faqat ustoz)."""
    data = fetch_all_backup()
    payload = {
        "app": "english-tutor",
        "version": 1,
        "exported_at": datetime.now(timezone.utc).isoformat(),
    }
    payload.update(data)
    raw = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
    fname = backup_filename()
    counts = {t: len(data.get(t) or []) for t in BACKUP_TABLES}
    summary = "\n".join(
        f"• {BACKUP_LABELS.get(t, t)}: {counts.get(t, 0)} ta" for t in BACKUP_TABLES
    )
    caption = (
        f"💾 <b>Zaxira tayyor — {fname}</b>\n\n"
        f"👦 O'quvchilar: {counts.get('students', 0)} ta\n"
        f"👥 Guruhlar: {counts.get('groups', 0)} ta\n"
        f"⭐ Baholar: {counts.get('grades', 0)} ta\n\n"
        f"{summary}\n\n"
        "Qayta tiklash uchun shu faylni menga qayta yuboring "
        "(yoki /restore yozing) — tasdiq tugmasini ko'rsataman."
    )
    await bot.send_document(
        chat_id=chat_id,
        document=BufferedInputFile(raw, filename=fname),
        caption=caption,
        parse_mode="HTML",
    )


@dp.message(Command("backup"))
async def cmd_backup(message: types.Message):
    """Zaxirani JSON fayl sifatida ADMIN_ID ga yuboradi (faqat ustoz)."""
    if message.from_user.id != config.ADMIN_ID:
        await message.answer("Kechirasiz, bu buyruq faqat Muzaffar Amirov uchun mavjud.")
        return
    await send_backup_document(config.ADMIN_ID)


@dp.callback_query(F.data == "backup_req")
async def on_backup_button(call: types.CallbackQuery):
    """ /start dagi '📥 Barcha ma'lumotlarni yuklab olish (Backup)' tugmasi. """
    if call.from_user.id != config.ADMIN_ID:
        await call.answer("Ruxsat yo'q", show_alert=True)
        return
    await call.answer("Zaxira tayyorlanmoqda...")
    try:
        await send_backup_document(config.ADMIN_ID)
    except Exception as e:
        logging.error(f"Backup button error: {e}")
        try:
            await call.message.reply(f"❌ Zaxira tayyorlashda xatolik: {e}")
        except Exception:
            pass


@dp.message(Command("restore"))
async def cmd_restore(message: types.Message):
    if message.from_user.id != config.ADMIN_ID:
        await message.answer("Kechirasiz, bu buyruq faqat Muzaffar Amirov uchun mavjud.")
        return
    await message.answer(
        "📤 <b>Qayta tiklash</b>\n\n"
        f"<code>{backup_filename()}</code> faylini shu yerga yuboring "
        "(xohlasangiz kaptonga /restore yozing) — men tasdiq tugmasini ko'rsataman.",
        parse_mode="HTML",
    )


@dp.message(F.document, F.from_user.id == config.ADMIN_ID)
async def on_backup_file(message: types.Message):
    """ADMIN_ID json fayl yuborsa — tasdiq tugmasini so'raydi."""
    doc = message.document
    name = (doc.file_name or "") if doc else ""
    if not name.lower().endswith(".json"):
        await message.reply("Iltimos, .json formatidagi zaxira faylini yuboring.")
        return
    pending_restore_file["file_id"] = doc.file_id
    pending_restore_file["name"] = name
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="✅ Bazani qayta tiklash", callback_data="restore_yes")],
        [InlineKeyboardButton(text="❌ Bekor qilish", callback_data="restore_no")],
    ])
    await message.reply(
        "Haqiqatan ham bazani ushbu fayldan qayta tiklamoqchimisiz? "
        "Hozirgi ma'lumotlar yangilanadi.\n\n"
        f"📄 <b>{html.escape(name)}</b>",
        reply_markup=kb,
        parse_mode="HTML",
    )


@dp.callback_query(F.data.in_(["restore_yes", "restore_no"]))
async def on_restore_answer(call: types.CallbackQuery):
    if call.from_user.id != config.ADMIN_ID:
        await call.answer("Ruxsat yo'q", show_alert=True)
        return

    if call.data == "restore_no" or not pending_restore_file.get("file_id"):
        pending_restore_file.clear()
        try:
            await call.message.edit_text("❌ Qayta tiklash bekor qilindi.")
        except Exception:
            pass
        await call.answer("Bekor qilindi")
        return

    await call.answer()
    try:
        await call.message.edit_text("⏳ Baza qayta tiklanmoqda...")
        tg_file = await bot.get_file(pending_restore_file["file_id"])
        buf = io.BytesIO()
        await bot.download(tg_file, destination=buf)
        data = json.loads(buf.getvalue().decode("utf-8"))
        if not isinstance(data, dict) or not isinstance(data.get("groups"), list) or not isinstance(data.get("students"), list):
            await call.message.edit_text("❌ Fayl noto'g'ri: bu mos kelmaydigan zaxira fayli.")
            pending_restore_file.clear()
            return
        counts = restore_backup(data)
        bad = [k for k, v in counts.items() if v < 0]
        lines = "\n".join(f"• {k}: {'xatolik' if v < 0 else str(v) + ' ta'}" for k, v in counts.items())
        text = f"✅ <b>Baza qayta tiklandi!</b>\n\n{lines}"
        if bad:
            text += f"\n\n⚠️ Tekshiriladigan jadvallar: {', '.join(bad)}"
        await call.message.edit_text(text, parse_mode="HTML")
    except Exception as e:
        logging.error(f"Restore error: {e}")
        try:
            await call.message.edit_text(f"❌ Qayta tiklashda xatolik: {e}")
        except Exception:
            pass
    pending_restore_file.clear()


def _e(value) -> str:
    return html.escape(str(value if value is not None else ""))


async def send_absence_alert(chat_id: int, student_name: str, date: str) -> bool:
    try:
        await bot.send_message(
            chat_id=chat_id,
            text=(
                "⚠️ <b>Davomat xabarnomasi:</b> Hurmatli ota-ona / o'quvchi, "
            f"<b>{_e(student_name)}</b> bugun (<b>{_e(date)}</b>) darsda qatnashmadi. "
            "Biron uzrli sabab bo'lsa Muzaffar Amirovga xabar bering."
            ),
            parse_mode="HTML",
        )
        return True
    except Exception as e:
        logging.error(f"Absence alert error: {e}")
        return False


async def send_speaking_reminder(chat_id: int, student_name: str, time: str) -> bool:
    try:
        await bot.send_message(
            chat_id=chat_id,
            text=(
                "🎙 <b>Speaking eslatmasi:</b> Salom <b>{name}</b>! "
                "Bugun soat <b>{time}</b> da yakkama-yakka Speaking darsingiz bor. "
                "O'z vaqtingizda tayyor bo'ling!"
            ).format(name=_e(student_name), time=_e(time)),
            parse_mode="HTML",
        )
        return True
    except Exception as e:
        logging.error(f"Speaking reminder error: {e}")
        return False


async def send_grade_alert(chat_id: int, subject: str, grade) -> bool:
    try:
        await bot.send_message(
            chat_id=chat_id,
            text=(
                "📝 <b>Yangi baho:</b> Sizga <b>{subject}</b> uchun "
                "<b>{grade}</b>/10 ball qo'yildi! Batafsil ilovada ko'ring."
            ).format(subject=_e(subject), grade=_e(grade)),
            parse_mode="HTML",
        )
        return True
    except Exception as e:
        logging.error(f"Grade alert error: {e}")
        return False


async def send_credentials(chat_id: int, student_name: str, login: str, password: str) -> bool:
    try:
        await bot.send_message(
            chat_id=chat_id,
            text=(
                "🔑 <b>Tizimga kirish ma'lumotlari:</b> Salom <b>{name}</b>! "
                "Tizimga kirish loginingiz: <code>{login}</code>, parolingiz: <code>{password}</code>. "
                "Ilovaga kirib parolni o'zgartirishingiz mumkin."
            ).format(name=_e(student_name), login=_e(login), password=_e(password)),
            parse_mode="HTML",
        )
        return True
    except Exception as e:
        logging.error(f"Credentials error: {e}")
        return False


# ============================================================
# Erkin matn: "🔑 Login orqali ulash" ni bosganlar uchun
# login/parol qabuli (ro'yxatdagi barcha handlerlardan KEYIN)
# ============================================================
@dp.message(F.text)
async def on_free_text(message: types.Message):
    text = (message.text or "").strip()
    if not text or text.startswith("/"):
        return
    if message.from_user.id in pending_logins:
        parts = text.split()
        if len(parts) != 2:
            await message.answer(
                "Ikkita so'z kiriting: <code>login parol</code> — masalan: <code>jasur 123</code>",
                parse_mode="HTML",
            )
            return
        await attempt_login(message, parts[0], parts[1])
        return
    # Yordam: ro'yxatdan o'tmagan matn → menyuni qayta ko'rsatamiz
    if message.from_user.id == config.ADMIN_ID:
        await message.answer("📋 Ustoz menyusi:", reply_markup=admin_reply_keyboard())
    else:
        await message.answer("📋 O'quvchi menyusi:", reply_markup=get_main_keyboard())


# Asosiy ishga tushirish
_bg_tasks: set = set()  # fon vazifalari GC'dan himoya uchun shu yerda saqlanadi


async def main():
    if bot is None or not config.BOT_TOKEN or config.BOT_TOKEN.startswith("YOUR_"):
        logging.error("BOT_TOKEN o'rnatilmagan.")
        return

    # Render portini ochish
    await start_dummy_web_server()

    # Eski webhook tozalanadi — aks holda polling 409 Conflict bilan ishga tushmaydi
    await bot.delete_webhook(drop_pending_updates=True)

    # Supabase'ni kuzatuvchi FON vazifalari — hech qachon to'g'ridan-to'g'ri
    # await qilinmaydi (event loop qotib qolmasin), ichida faqat
    # await asyncio.sleep() ishlatiladi — time.sleep() TAQIQLANADI.
    _bg_tasks.add(asyncio.create_task(homework_watcher()))   # uyga vazifalari
    _bg_tasks.add(asyncio.create_task(voice_watcher()))      # voice_allowed ruxsati
    _bg_tasks.add(asyncio.create_task(grades_watcher()))     # yangi baho
    _bg_tasks.add(asyncio.create_task(messages_watcher()))   # yangi chat xabari

    # Diagnostika: qaysi bot jonli — logda username ko'rinadi
    try:
        me = await bot.get_me()
        logging.info(f"DIAGNOSTIKA: bot ishga tushdi -> @{me.username} (id={me.id})")
    except Exception as e:
        logging.error(f"DIAGNOSTIKA: getMe muvaffaqiyatsiz — TOKEN noto'g'ri yoki tarmoqda muammo: {e}")

    # Diagnostika: polling jonli ekanini 60s da bir marta loglaydi
    async def _polling_watchdog():
        while True:
            await asyncio.sleep(60)
            logging.info("DIAGNOSTIKA: POLLING FAOL (60s heartbeat)")

    _bg_tasks.add(asyncio.create_task(_polling_watchdog()))

    logging.info("Bot starting with polling...")
    try:
        await dp.start_polling(bot, allowed_updates=dp.resolve_used_update_types())
    except Exception:
        logging.exception("DIAGNOSTIKA: POLLING TO'XTADI — xatoni ko'ring!")
        raise


if __name__ == "__main__":
    asyncio.run(main())
