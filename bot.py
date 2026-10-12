"""
English Tutor — Telegram bot (aiogram 3.x).

Vazifalari:
  * /start — doimiy pastki chap menyu tugmasini (Menu Button) WebApp ga
    sozlash va xush kelib bildirishnoma yuborish;
  * 4 ta xabar yuborish funksiyasi: davomat, speaking eslatmasi, baho
    va kirish ma'lumotlari.
"""

from __future__ import annotations

import asyncio
import html
import logging
import sys
from typing import Optional

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.filters import CommandStart
from aiogram.types import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    MenuButtonWebApp,
    Message,
    WebAppInfo,
)

import config

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger("english-tutor")

dp = Dispatcher()
_bot: Optional[Bot] = None

MENU_BUTTON_TEXT = "📱 Ilovani ochish"
ENTER_BUTTON_TEXT = "🚀 Ilovaga kirish"


# ============================================================
# Yordamchilar
# ============================================================
def get_bot() -> Bot:
    """Bot instansiyasini yaratadi (kichik daqiqada takrorlanmaydi)."""
    global _bot
    if _bot is None:
        _bot = Bot(
            token=config.BOT_TOKEN,
            default=DefaultBotProperties(parse_mode=ParseMode.HTML),
        )
    return _bot


def webapp_keyboard() -> InlineKeyboardMarkup:
    """WebApp ga ochuvchi inline tugma."""
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text=ENTER_BUTTON_TEXT, web_app=WebAppInfo(url=config.WEBAPP_URL))]
    ])


async def _send(chat_id: int, text: str) -> bool:
    """Xabarni yuborish — xatolik logga yoziladi, bot to'xtamaydi."""
    try:
        await get_bot().send_message(chat_id=chat_id, text=text)
        return True
    except Exception as exc:  # noqa: BLE001 — bot ishlashda davom etishi kerak
        logger.error("Xabar yuborilmadi (chat_id=%s): %s", chat_id, exc)
        return False


def _e(value) -> str:
    """HTML uchun xavfsiz matn (ism, fan nomi va h.k.)."""
    return html.escape(str(value))


# ============================================================
# 1) /start — menu button + xush kelish
# ============================================================
@dp.message(CommandStart())
async def cmd_start(message: Message) -> None:
    bot = get_bot()

    # Pastki chapdagi doimiy menyu tugmasini WebApp ga sozlash
    try:
        await bot.set_chat_menu_button(
            menu_button=MenuButtonWebApp(
                text=MENU_BUTTON_TEXT,
                web_app=WebAppInfo(url=config.WEBAPP_URL),
            )
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Menu button o'rnatilmadi (Main Mini App sozlanmagan bo'lishi mumkin): %s", exc)

    await message.answer(
        "Assalomu alaykum! 👋\n\n"
        "Men <b>English Tutor</b> botiman. Bu yerda dars jadvali, baholar, "
        "davomat va Speaking eslatmalari haqida xabarlar olasiz.\n\n"
        "Ilovani ochish uchun quyidagi tugmani bosing:",
        reply_markup=webapp_keyboard(),
    )
    logger.info("/start — %s (chat_id=%s)", message.from_user.id if message.from_user else "?", message.chat.id)


# ============================================================
# 2) Xabar yuborish funksiyalari
# ============================================================
async def send_absence_alert(chat_id: int, student_name: str, date: str) -> bool:
    """Davomat: darsga kelmaganlik haqida xabar."""
    return await _send(
        chat_id,
        "⚠️ <b>Davomat xabarnomasi:</b> Hurmatli ota-ona / o'quvchi, "
        f"<b>{_e(student_name)}</b> bugun (<b>{_e(date)}</b>) darsda qatnashmadi. "
        "Biron uzrli sabab bo'lsa ustozga xabar bering.",
    )


async def send_speaking_reminder(chat_id: int, student_name: str, time: str) -> bool:
    """Speaking: yakkama-yakka dars eslatmasi."""
    return await _send(
        chat_id,
        "🎙 <b>Speaking eslatmasi:</b> Salom <b>{name}</b>! "
        "Bugun soat <b>{time}</b> da yakkama-yakka Speaking darsingiz bor. "
        "O'z vaqtingizda tayyor bo'ling!".format(name=_e(student_name), time=_e(time)),
    )


async def send_grade_alert(chat_id: int, subject: str, grade) -> bool:
    """Yangi baho qo'yilgani haqida xabar."""
    return await _send(
        chat_id,
        "📝 <b>Yangi baho:</b> Sizga <b>{subject}</b> uchun "
        "<b>{grade}</b>/10 ball qo'yildi! Batafsil ilovada ko'ring.".format(
            subject=_e(subject), grade=_e(grade)
        ),
    )


async def send_credentials(chat_id: int, student_name: str, login: str, password: str) -> bool:
    """Tizimga kirish ma'lumotlari."""
    return await _send(
        chat_id,
        "🔑 <b>Tizimga kirish ma'lumotlari:</b> Salom <b>{name}</b>! "
        "Tizimga kirish loginingiz: <code>{login}</code>, parolingiz: <code>{password}</code>. "
        "Ilovaga kirib parolni o'zgartirishingiz mumkin.".format(
            name=_e(student_name), login=_e(login), password=_e(password)
        ),
    )


# ============================================================
# 3) Ishga tushirish
# ============================================================
async def main() -> None:
    if not config.BOT_TOKEN or config.BOT_TOKEN.startswith("YOUR_"):
        logger.error(
            "BOT_TOKEN o'rnatilmagan.\n"
            "  1) @BotFather dan token oling;\n"
            "  2) config.py dagi BOT_TOKEN ni almashtiring "
            "yoki `export BOT_TOKEN=...` bering;\n"
            "  3) qayta ishga tushiring: python3 bot.py"
        )
        return

    bot = get_bot()
    me = await bot.get_me()
    logger.info("Bot ishga tushdi: @%s (id=%s)", me.username, me.id)

    await bot.delete_webhook(drop_pending_updates=True)
    await dp.start_polling(bot)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Bot to'xtatildi.")
