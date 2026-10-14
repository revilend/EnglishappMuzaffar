import asyncio
import html
import io
import json
import logging
import os
import re
from datetime import datetime, timezone
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
    bot = Bot(token=config.BOT_TOKEN)  # aiogram invalid tokenni shu yerda rad etadi
except Exception as _e:  # placeholder/yaroqsiz token: import va start toza qoladi
    bot = None
    logging.error(f"BOT_TOKEN yaroqsiz: {_e}")
dp = Dispatcher()
supabase: Client = create_client(config.SUPABASE_URL, config.SUPABASE_KEY)

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
                menu_button=MenuButtonWebApp(text="📱 Ustoz Paneli", web_app=WebAppInfo(url=config.WEBAPP_URL))
            )
        except Exception as e:  # Mini App BotFather'da ulanmagan bo'lsa ham /start ishlayveradi
            logging.warning(f"set_chat_menu_button (teacher): {e}")
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="🚀 Ustoz Panelini ochish", web_app=WebAppInfo(url=config.WEBAPP_URL))]
        ])
        await message.answer(f"Xush kelibsiz, Ustoz!\nBarcha guruhlar, jurnallar va topshiriqlar boshqaruvi sizda.", reply_markup=keyboard)
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

# Voice & Video Speaking Submissions
@dp.message(F.voice | F.video_note | F.video)
async def handle_speaking_submission(message: types.Message):
    user = message.from_user
    media_type = "voice" if message.voice else ("video_note" if message.video_note else "video")
    file_id = message.voice.file_id if message.voice else (message.video_note.file_id if message.video_note else message.video.file_id)

    # Save to Supabase
    try:
        supabase.table("speaking_submissions").insert({
            "media_type": media_type,
            "telegram_file_id": file_id,
            "status": "kutilmoqda"
        }).execute()
    except Exception as e:
        logging.error(f"Supabase error: {e}")

    # Forward to Teacher
    caption = (
        f"🎙 <b>YANGI SPEAKING TOPSHIRILDI!</b>\n\n"
        f"👤 <b>Yuboruvchi:</b> {user.full_name} (@{user.username or 'yoʻq'})\n"
        f"🆔 <b>Telegram ID:</b> <code>{user.id}</code>\n"
        f"📹 <b>Turi:</b> {media_type.upper()}"
    )
    eval_btn = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="📝 Mini App'da Baholash", web_app=WebAppInfo(url=config.WEBAPP_URL))]
    ])

    if message.voice:
        await bot.send_voice(chat_id=config.ADMIN_ID, voice=file_id, caption=caption, reply_markup=eval_btn, parse_mode="HTML")
    elif message.video_note:
        await bot.send_video_note(chat_id=config.ADMIN_ID, video_note=file_id, reply_markup=eval_btn)
        await bot.send_message(chat_id=config.ADMIN_ID, text=caption, parse_mode="HTML")
    else:
        await bot.send_video(chat_id=config.ADMIN_ID, video=file_id, caption=caption, reply_markup=eval_btn, parse_mode="HTML")

    await message.reply(
        "✅ <b>Qabul qilindi!</b>\nSpeaking vazifangiz ustozga yuborildi. Ustoz tekshirib baho qo'yishi bilan sizga xabar beriladi.", 
        parse_mode="HTML"
    )

# Notification function for grades
async def notify_student_grade(student_chat_id: int, subject: str, grade: int, note: str = ""):
    text = (
        f"📝 <b>Speaking natijangiz chiqdi!</b>\n\n"
        f"Topshiriq: <b>{subject}</b>\n"
        f"Baho: <b>{grade} / 10 ball</b>\n"
        f"Ustoz izohi: <i>{note or 'Yaxshi!'}</i>\n\n"
        f"🎉 Speaking qarzingiz 1 taga kamaytirildi!"
    )
    try:
        await bot.send_message(chat_id=student_chat_id, text=text, parse_mode="HTML")
    except Exception as e:
        logging.error(f"Notify error: {e}")


# ============================================================
# Zaxira (backup / restore) — Supabase
# ============================================================
BACKUP_TABLES = ["groups", "students", "attendance", "grades", "messages", "speaking_submissions"]
RESTORE_PLAN = [
    ("groups", ["id", "name", "days", "time"]),
    ("students", ["id", "name", "school_class", "group_id", "login", "password", "speaking_debt"]),
    ("attendance", ["id", "student_id", "date", "status"]),
    ("grades", ["id", "student_id", "date", "grade", "category", "note"]),
    ("messages", ["id", "student_id", "sender", "text", "created_at"]),
    ("speaking_submissions", ["id", "media_type", "telegram_file_id", "status", "created_at"]),
]
pending_restore_file = {}


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
    for t in ["messages", "grades", "attendance", "speaking_submissions", "students", "groups"]:
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


@dp.message(Command("backup"))
async def cmd_backup(message: types.Message):
    """Zaxirani JSON fayl sifatida ADMIN_ID ga yuboradi (faqat ustoz)."""
    if message.from_user.id != config.ADMIN_ID:
        await message.answer("Kechirasiz, bu buyruq faqat ustoz uchun mavjud.")
        return
    data = fetch_all_backup()
    payload = {
        "app": "english-tutor",
        "version": 1,
        "exported_at": datetime.now(timezone.utc).isoformat(),
    }
    payload.update(data)
    raw = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
    summary = "\n".join(f"• {t}: {len(data.get(t) or [])} ta" for t in BACKUP_TABLES)
    await bot.send_document(
        chat_id=config.ADMIN_ID,
        document=BufferedInputFile(raw, filename="backup_english_app.json"),
        caption=(
            "💾 <b>Zaxira tayyor — backup_english_app.json</b>\n\n"
            f"{summary}\n\n"
            "Qayta tiklash uchun shu faylni menga qayta yuboring "
            "(/restore kaptisi bilan ham bo'ladi)."
        ),
        parse_mode="HTML",
    )


@dp.message(Command("restore"))
async def cmd_restore(message: types.Message):
    if message.from_user.id != config.ADMIN_ID:
        await message.answer("Kechirasiz, bu buyruq faqat ustoz uchun mavjud.")
        return
    await message.answer(
        "📤 <b>Qayta tiklash</b>\n\n"
        "backup_english_app.json faylini shu yerga yuboring "
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
        [InlineKeyboardButton(text="✅ Ha, tiklash", callback_data="restore_yes")],
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


# ============================================================
# Qo'shimcha xabar yuborish funksiyalari (davomat/eslatma/parol)
# ============================================================
def _e(value) -> str:
    return html.escape(str(value if value is not None else ""))


async def send_absence_alert(chat_id: int, student_name: str, date: str) -> bool:
    """Davomat: darsga kelmaganlik haqida xabar."""
    try:
        await bot.send_message(
            chat_id=chat_id,
            text=(
                "⚠️ <b>Davomat xabarnomasi:</b> Hurmatli ota-ona / o'quvchi, "
                f"<b>{_e(student_name)}</b> bugun (<b>{_e(date)}</b>) darsda qatnashmadi. "
                "Biron uzrli sabab bo'lsa ustozga xabar bering."
            ),
            parse_mode="HTML",
        )
        return True
    except Exception as e:
        logging.error(f"Absence alert error: {e}")
        return False


async def send_speaking_reminder(chat_id: int, student_name: str, time: str) -> bool:
    """Speaking: yakkama-yakka dars eslatmasi."""
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
    """Yangi baho qo'yilgani haqida xabar."""
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
    """Tizimga kirish ma'lumotlari."""
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


async def main():
    if bot is None or not config.BOT_TOKEN or config.BOT_TOKEN.startswith("YOUR_"):
        logging.error(
            "BOT_TOKEN o'rnatilmagan.\n"
            "  1) @BotFather dan token oling;\n"
            "  2) Render'da BOT_TOKEN environment variable qo'shing "
            "(yoki local: export BOT_TOKEN=...);\n"
            "  3) qayta ishga tushiring: python3 bot.py"
        )
        return
    logging.info("Bot starting with polling...")
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())
