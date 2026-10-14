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
from aiogram.filters import Command, CommandStart
from aiogram.types import (
    InlineKeyboardMarkup, 
    InlineKeyboardButton, 
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


# /start command
@dp.message(CommandStart())
async def cmd_start(message: types.Message):
    user_id = message.from_user.id
    user_name = message.from_user.first_name

    # Teacher check
    if user_id == config.ADMIN_ID:
        try:
            await bot.set_chat_menu_button(
                chat_id=user_id,
                menu_button=MenuButtonWebApp(text="📱 Muzaffar Amirov Paneli", web_app=WebAppInfo(url=config.WEBAPP_URL))
            )
        except Exception as e:
            logging.warning(f"set_chat_menu_button (teacher): {e}")
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="🚀 Muzaffar Amirov Panelini ochish", web_app=WebAppInfo(url=config.WEBAPP_URL))],
            [InlineKeyboardButton(text="📥 Barcha ma'lumotlarni yuklab olish (Backup)", callback_data="backup_req")],
        ])
        await message.answer(f"Xush kelibsiz, Muzaffar Amirov!\nBarcha guruhlar, jurnallar va topshiriqlar boshqaruvi sizda.", reply_markup=keyboard)
        return

    # Student
    try:
        await bot.set_chat_menu_button(
            chat_id=user_id,
            menu_button=MenuButtonWebApp(text="📱 O'quvchi Kabineti", web_app=WebAppInfo(url=config.WEBAPP_URL))
        )
    except Exception as e:
        logging.warning(f"set_chat_menu_button (student): {e}")
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🚀 Shaxsiy Kabinetga kirish", web_app=WebAppInfo(url=config.WEBAPP_URL))]
    ])
    text = (
        f"Assalomu alaykum, <b>{user_name}</b>!\n\n"
        f"Ingliz tili darslari botiga xush kelibsiz.\n"
        f"🎙 <b>Speaking topshirish uchun:</b> shunchaki shu yerga ovozli xabar (voice) yoki dumaloq video xabar yuboring!"
    )
    await message.answer(text, reply_markup=keyboard, parse_mode="HTML")


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
            "Login va parolingizni ilovadan ko'rishingiz mumkin.",
            parse_mode="HTML",
        )
        return
    _, login, password = parts
    try:
        rows = supabase.table("students").select("id, name, login, password")\
            .eq("login", login).eq("password", password).limit(1).execute().data
    except Exception as e:
        logging.error(f"login query: {e}")
        await message.answer("⚠️ Bazaga ulanib bo'lmadi. Birozdan keyin qayta urinib ko'ring.")
        return
    if not rows:
        await message.answer("❌ Login yoki parol noto'g'ri. Qayta urinib ko'ring.")
        return
    st = rows[0]
    try:
        supabase.table("students").update({"telegram_chat_id": message.from_user.id}).eq("id", st["id"]).execute()
    except Exception as e:
        logging.error(f"login update: {e}")
        await message.answer("⚠️ Hisobni ulab bo'lmadi. Admin bilan bog'laning.")
        return
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🚀 Shaxsiy Kabinetga kirish", web_app=WebAppInfo(url=config.WEBAPP_URL))]
    ])
    await message.answer(
        f"✅ <b>Xush kelibsiz, {html.escape(str(st.get('name') or login))}!</b>\n"
        "Hisobingiz Telegramga ulandi. Endi speaking topshiriklaringiz shu yerga qabul qilinadi.",
        reply_markup=kb,
        parse_mode="HTML",
    )


# ============================================================
# Voice & Video Speaking Submissions (faqat ulangan o'quvchi,
# voice_allowed = true bo'lgandagina qabul qilinadi)
# ============================================================
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
            "Shunday yozing: <code>/login jasur 123</code>\n"
            "(Login va parolingizni o'quvchi kabinetasidan oling)",
            parse_mode="HTML",
        )
        return

    # 2) Muzaffar Amirov ruxsat berganmi? (students.voice_allowed)
    if student.get("voice_allowed") is False:
        await message.answer(
            "⛔ Kechirasiz! Muzaffar Amirov hozircha sizga ovozli topshirishga ruxsat bermagan. Darsda topshiring."
        )
        return

    # 3) Supabase'ga yozish + speaking qarzi +1
    debt = int(student.get("speaking_debt") or 0) + 1
    try:
        supabase.table("speaking_submissions").insert({
            "student_id": student["id"],
            "media_type": media_type,
            "telegram_file_id": file_id,
            "status": "kutilmoqda",
        }).execute()
        supabase.table("students").update({"speaking_debt": debt}).eq("id", student["id"]).execute()
    except Exception as e:
        logging.error(f"Supabase error (speaking): {e}")

    # 4) Ustozga yuborish (baholash tugmasi bilan)
    st_name = html.escape(str(student.get("name") or user.full_name))
    caption = (
        f"🎙 <b>YANGI SPEAKING TOPSHIRILDI!</b>\n\n"
        f"👤 <b>O'quvchi:</b> {st_name}\n"
        f"🆔 <b>Telegram ID:</b> <code>{user.id}</code>\n"
        f"📹 <b>Turi:</b> {media_type.upper()}\n"
        f"💰 <b>Speaking qarzi:</b> {debt} ta"
    )
    eval_btn = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="📝 Mini App'da Baholash", web_app=WebAppInfo(url=config.WEBAPP_URL))]
    ])

    try:
        if message.voice:
            await bot.send_voice(chat_id=config.ADMIN_ID, voice=file_id, caption=caption, reply_markup=eval_btn, parse_mode="HTML")
        elif message.video_note:
            await bot.send_video_note(chat_id=config.ADMIN_ID, video_note=file_id, reply_markup=eval_btn)
            await bot.send_message(chat_id=config.ADMIN_ID, text=caption, parse_mode="HTML")
        else:
            await bot.send_video(chat_id=config.ADMIN_ID, video=file_id, caption=caption, reply_markup=eval_btn, parse_mode="HTML")
    except Exception as e:
        logging.error(f"forward to teacher: {e}")

    await message.reply(
        "✅ <b>Qabul qilindi!</b>\nSpeaking vazifangiz Muzaffar Amirovga yuborildi. Muzaffar Amirov tekshirib baho qo'yishi bilan speaking qarzingiz kamayadi.",
        parse_mode="HTML",
    )


# ============================================================
# Uyga vazifalari: yangi homework → guruh o'quvchilariga xabar
# ============================================================
HW_TEXT = (
    "📚 YANGI UYGA VAZIFA!\n"
    "Guruh: {group_name}\n"
    "Mavzu: {title}\n"
    "Vazifa: {description}\n"
    "Topshirish muddati: {due_date}\n\n"
    "Ilovaga kirib to'liq ko'rishingiz mumkin!"
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
        group_name=group_name,
        title=row.get("title") or "—",
        description=row.get("description") or "—",
        due_date=due,
    )
    sent = 0
    for st in studs:
        chat_id = st.get("telegram_chat_id")
        if not chat_id:
            continue
        try:
            await bot.send_message(chat_id=int(chat_id), text=text, reply_markup=kb)
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


# Asosiy ishga tushirish
async def main():
    if bot is None or not config.BOT_TOKEN or config.BOT_TOKEN.startswith("YOUR_"):
        logging.error("BOT_TOKEN o'rnatilmagan.")
        return

    # Render portini ochish
    await start_dummy_web_server()

    # Uyga vazifalari kuzatuvchisi (yangi homework → guruhga xabar)
    asyncio.create_task(homework_watcher())

    logging.info("Bot starting with polling...")
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
