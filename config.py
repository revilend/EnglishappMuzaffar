import os

# Render environment variables with fallback
BOT_TOKEN = os.getenv("BOT_TOKEN", "YOUR_TELEGRAM_BOT_TOKEN")
ADMIN_ID = int(os.getenv("ADMIN_ID", "123456789"))  # Teacher Telegram ID

WEBAPP_URL = os.getenv("WEBAPP_URL", "https://revilend.github.io/EnglishappMuzaffar/")
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://mvjoeqyqaylfccqcnwwe.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "sb_publishable_PHMC_kfQfu5BLFgDOzHsjw_B0VO2xDI")
