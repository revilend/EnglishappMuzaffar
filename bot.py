import asyncio
import html
import logging
import os
from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import CommandStart
from aiogram.types import (
    InlineKeyboardMarkup, 
    InlineKeyboardButton, 
    WebAppInfo, 
    MenuButtonWebApp
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
