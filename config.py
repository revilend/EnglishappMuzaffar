import os

# Render environment variables with fallback
BOT_TOKEN = os.getenv("BOT_TOKEN", "YOUR_TELEGRAM_BOT_TOKEN")
def _parse_admin_ids():
    """ADMIN_ID va ADMIN_IDS dan barcha admin Telegram ID larini yig'adi.

    Ikkala o'zgaruvchida ham vergul bilan ajratilgan bir nechta ID bo'lishi mumkin:
        ADMIN_IDS="123456,789012"
    Natija: takrorlanmaydigan list[int] (tartib saqlanadi).
    """
    raw = ",".join([
        str(os.getenv("ADMIN_ID", "") or ""),
        str(os.getenv("ADMIN_IDS", "") or ""),
    ])
    ids = []
    for part in raw.replace(";", ",").replace(" ", ",").split(","):
        part = part.strip()
        if not part:
            continue
        try:
            value = int(part)
        except ValueError:
            continue
        if value and value not in ids:
            ids.append(value)
    if not ids:
        ids = [123456789]  # standart o'rin egasi — haqiqiy ID Render'da beriladi
    return ids


ADMIN_IDS = _parse_admin_ids()   # Teacher Telegram IDs (bir nechta bo'lishi mumkin)
ADMIN_ID = ADMIN_IDS[0]          # asosiy (birinchi) admin — orqaga moslik uchun

WEBAPP_URL = os.getenv("WEBAPP_URL", "https://teachermuzaffar.uz/")
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://mvjoeqyqaylfccqcnwwe.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "sb_publishable_PHMC_kfQfu5BLFgDOzHsjw_B0VO2xDI")

PAYMENTS_CHANNEL_ID = os.getenv("PAYMENTS_CHANNEL_ID", "")

# Gmail bildirishnomalari (App Password — Google hisob sozlamalaridan olinadi)
GMAIL_USER = os.getenv("GMAIL_USER", "")
GMAIL_APP_PASSWORD = os.getenv("GMAIL_APP_PASSWORD", "")
# Ustozga ketadigan xatlar manzili (standart: GMAIL_USER)
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", GMAIL_USER)
