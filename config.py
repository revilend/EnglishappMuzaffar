"""English Tutor bot — konfiguratsiya."""

import os

# 1) @BotFather dan olingan bot tokeni.
#    (Ko'rsatilgan qiymat — faqat namuna. Uni almashtiring.)
BOT_TOKEN = "YOUR_TELEGRAM_BOT_TOKEN"

# 2) Telegram Mini App manzili
WEBAPP_URL = "https://revilend.github.io/EnglishappMuzaffar/"

# 3) Ustozning Telegram ID raqami (masalan, @userinfobot orqali bilib oling)
ADMIN_ID = 123456789  # Teacher's Telegram ID

# Xavfsizlik: repozitoriy ochiq va GitHub Pages orqali fayllar ommaga ko'rinadi,
# shuning uchun tokenni faylga yozish o'rniga muhit o'zgaruvchisi orqali berish
# tavsiya etiladi (env qiymat yuqoridagini qoplaydi):
#   export BOT_TOKEN="123456789:AAH..."
BOT_TOKEN = os.environ.get("BOT_TOKEN") or BOT_TOKEN
