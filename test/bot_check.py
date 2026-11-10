"""Bot check — interaktiv menyu (ustoz/o'quvchi), zaxira/tozalash, voice/video
yo'naltirish + 1-tap baho, /login, uyga vazifa, health server.

Test harness (testga joylashtirilgan — /tmp emas, qayta tiklanadigan joyda).
Run:  .venv/bin/python test/bot_check.py
"""


import asyncio
import glob
import json
import os
import re
import sys
from datetime import datetime, timedelta

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
# .venv ichidagi python versiyasiga bog'lanmaslik uchun site-packages glob bilan topiladi
for _sp in glob.glob(os.path.join(ROOT, ".venv", "lib", "python*", "site-packages")):
    sys.path.insert(0, _sp)

os.environ.setdefault("PORT", "10999")

import bot as B  # noqa: E402
import config  # noqa: E402
from bot import get_main_keyboard

def _dummy_state():
    class _DS:
        async def clear(self):
            return None
    return _DS()

failed = 0
passed = 0


def check(cond, msg):
    global failed, passed
    if cond:
        passed += 1
        print("ok   - " + msg)
    else:
        failed += 1
        print("FAIL - " + msg)


# ---------------- Fake Supabase ----------------
FAKE_ROWS = {}


def reset_rows():
    """Barcha jadvallarni boshlang'ich holatga qaytaradi."""
    FAKE_ROWS.clear()
    FAKE_ROWS.update({
        "groups": [
            {"id": 1, "name": "IELTS Band 7.0", "days": "Dushanba, Juma", "time": "18:00"}
        ],
        "students": [
            {"id": 1, "name": "Jasur Karimov", "school_class": "8-sinf", "group_id": 1,
             "login": "jasur", "password": "123", "speaking_debt": 4, "voice_allowed": True,
             "telegram_chat_id": 555},
            {"id": 2, "name": "Nilufar Ergasheva", "school_class": "9-sinf", "group_id": 1,
             "login": "nilufar", "password": "123", "speaking_debt": 0, "voice_allowed": False,
             "telegram_chat_id": 666},
            {"id": 3, "name": "Malika Yusupova", "school_class": "11-sinf", "group_id": 1,
             "login": "malika", "password": "123", "speaking_debt": 2, "voice_allowed": True,
             "telegram_chat_id": None},
        ],
        "attendance": [{"id": 1, "student_id": 1, "date": "2026-10-01", "status": "present"}],
        "grades": [
            {"id": 1, "student_id": 1, "date": "2026-10-01", "grade": 9,
             "category": "Darsdagi javob", "note": ""},
            {"id": 2, "student_id": 2, "date": "2026-10-01", "grade": 8,
             "category": "Lug'at", "note": ""},
            {"id": 3, "student_id": 1, "date": "2026-10-02", "grade": 10,
             "category": "Uyga vazifa", "note": ""},
        ],
        "messages": [{"id": 1, "student_id": 1, "sender": "teacher", "text": "Salom",
                      "created_at": "2026-10-01T10:00:00Z"}],
        "speaking_submissions": [],
        "audio_submissions": [],
        "homework": [],
        "bot_settings": [],
    })


reset_rows()


class R:
    def __init__(self, data):
        self.data = data
        self.error = None


class FakeQuery:
    def __init__(self, table, op="select", payload=None):
        self.table = table
        self.op = op
        self.payload = payload
        self.filters = []
        self._limit = None
        self._order = None
        self._desc = False
        self._returning = False

    # --- chainables ---
    def select(self, cols="*"):
        if self.op == "insert":
            self._returning = True
        return self

    def order(self, col, desc=False):
        self._order = col
        self._desc = bool(desc)
        return self

    def limit(self, n):
        self._limit = n
        return self

    def eq(self, col, val):
        self.filters.append(("eq", col, val))
        return self

    def neq(self, col, val):
        self.filters.append(("neq", col, val))
        return self

    def gte(self, col, val):
        self.filters.append(("gte", col, val))
        return self

    def in_(self, col, vals):
        self.filters.append(("in", col, list(vals)))
        return self

    def _match(self, r):
        for op, col, val in self.filters:
            if op == "eq" and r.get(col) != val:
                return False
            if op == "neq" and r.get(col) == val:
                return False
            if op == "in" and r.get(col) not in val:
                return False
            if op == "gte":
                v = r.get(col)
                if v is None or not (isinstance(v, (int, float)) and v >= val):
                    return False
        return True

    def execute(self):
        rows = FAKE_ROWS.setdefault(self.table, [])
        if self.op == "select":
            out = [dict(r) for r in rows if self._match(r)]
            if self._order:
                out.sort(key=lambda r: (r.get(self._order) is None, r.get(self._order)),
                         reverse=self._desc)
            if self._limit:
                out = out[: self._limit]
            return R(out)

        if self.op == "insert":
            payload = self.payload if isinstance(self.payload, list) else [self.payload]
            added = []
            for p in payload:
                p = dict(p)
                if p.get("id") is None:
                    p["id"] = max([r.get("id") or 0 for r in rows], default=0) + 1
                rows.append(p)
                added.append(dict(p))
            return R(added if self._returning else [])

        if self.op == "update":
            matched = [r for r in rows if self._match(r)]
            for r in matched:
                r.update(self.payload)
            return R([dict(r) for r in matched])

        if self.op == "upsert":
            payload = self.payload if isinstance(self.payload, list) else [self.payload]
            out = []
            for p in payload:
                p = dict(p)
                key = "key" if "key" in p else "id"
                found = None
                for r in rows:
                    if r.get(key) == p.get(key):
                        found = r
                        break
                if found is not None:
                    found.update(p)
                    out.append(dict(found))
                else:
                    rows.append(p)
                    out.append(dict(p))
            return R(out)

        if self.op == "delete":
            keep, removed = [], []
            for r in rows:
                (removed if self._match(r) else keep).append(r)
            FAKE_ROWS[self.table] = keep
            return R([dict(r) for r in removed])

        return R([])


class FakeTable:
    def __init__(self, name):
        self.name = name

    def select(self, cols="*"):
        return FakeQuery(self.name, "select")

    def insert(self, payload):
        return FakeQuery(self.name, "insert", payload)

    def update(self, payload):
        return FakeQuery(self.name, "update", payload)

    def upsert(self, payload):
        return FakeQuery(self.name, "upsert", payload)

    def delete(self):
        return FakeQuery(self.name, "delete")


class FakeSupa:
    def table(self, name):
        return FakeTable(name)


# ---------------- Fake Telegram ----------------
class U:
    def __init__(self, uid, first="Test"):
        self.id = uid
        self.first_name = first
        self.full_name = first


class Media:
    def __init__(self, file_id):
        self.file_id = file_id


class Doc:
    def __init__(self, file_id, name):
        self.file_id = file_id
        self.file_name = name


class Msg:
    def __init__(self, uid, text="", document=None, voice=None, video_note=None, video=None,
                 photo=None):
        self.from_user = U(uid)
        self.text = text
        self.document = document
        self.voice = voice
        self.video_note = video_note
        self.video = video
        self.photo = photo
        self.answers = []
        self.replies = []

    async def answer(self, text=None, reply_markup=None, parse_mode=None, **kw):
        self.answers.append({"text": text, "reply_markup": reply_markup, "parse_mode": parse_mode})

    async def reply(self, text=None, reply_markup=None, parse_mode=None, **kw):
        self.replies.append({"text": text, "reply_markup": reply_markup, "parse_mode": parse_mode})


class CallMsg:
    def __init__(self, caption=None):
        self.edits = []
        self.caption = caption

    async def edit_text(self, text, parse_mode=None, **kw):
        self.edits.append(text)

    async def edit_caption(self, caption=None, parse_mode=None, **kw):
        self.edits.append(caption)

    async def answer(self, text=None, reply_markup=None, parse_mode=None, **kw):
        self.edits.append(text)

    async def reply(self, text=None, reply_markup=None, parse_mode=None, **kw):
        self.edits.append(text)


class FakeState:
    """FSMContext o'rniga test uchun sodda holat saqlagich."""

    def __init__(self, data=None):
        self.state = None
        self.data = dict(data or {})

    async def set_state(self, st):
        self.state = st

    async def get_state(self):
        return self.state

    async def get_data(self):
        return dict(self.data)

    async def update_data(self, **kw):
        self.data.update(kw)

    async def clear(self):
        self.state = None
        self.data = {}


class Call:
    def __init__(self, uid, data, msg=None):
        self.from_user = U(uid)
        self.data = data
        self.message = msg or CallMsg()
        self.answers = []

    async def answer(self, text=None, show_alert=False, **kw):
        self.answers.append({"text": text, "show_alert": show_alert})


class FakeBot:
    def __init__(self):
        self.sent = []
        self.menu_buttons = []
        self._docs = {}

    async def set_chat_menu_button(self, **kw):
        self.menu_buttons.append(kw)

    async def send_message(self, chat_id, text, reply_markup=None, parse_mode=None, **kw):
        self.sent.append({"kind": "message", "chat_id": chat_id, "text": text,
                          "reply_markup": reply_markup,
                          "disable_notification": kw.get("disable_notification")})

    async def send_voice(self, chat_id, voice, caption=None, reply_markup=None,
                         parse_mode=None, **kw):
        self.sent.append({"kind": "voice", "chat_id": chat_id, "file_id": voice,
                          "caption": caption, "reply_markup": reply_markup})

    async def send_video_note(self, chat_id, video_note, **kw):
        self.sent.append({"kind": "video_note", "chat_id": chat_id, "file_id": video_note})

    async def send_photo(self, chat_id, photo, caption=None, reply_markup=None,
                         parse_mode=None, **kw):
        self.sent.append({"kind": "photo", "chat_id": chat_id, "file_id": photo,
                          "caption": caption, "reply_markup": reply_markup})

    async def send_video(self, chat_id, video, caption=None, reply_markup=None,
                         parse_mode=None, **kw):
        self.sent.append({"kind": "video", "chat_id": chat_id, "file_id": video,
                          "caption": caption, "reply_markup": reply_markup})

    async def send_document(self, chat_id, document, caption=None, parse_mode=None, **kw):
        self._docs["last"] = document
        self.sent.append({"kind": "document", "chat_id": chat_id, "document": document,
                          "caption": caption, "file_name": getattr(document, "filename", None)})

    async def get_file(self, file_id):
        return file_id

    async def download(self, file_id, destination=None, **kw):
        raw = self._docs.get(file_id)
        if raw is None:
            raise KeyError(f"unknown file_id {file_id}")
        destination.write(raw)

    def register_doc(self, file_id, raw_bytes):
        self._docs[file_id] = raw_bytes


def btn_texts(markup):
    if markup is None:
        return []
    out = []
    for row in getattr(markup, "inline_keyboard", []):
        for b in row:
            out.append((b.text, getattr(b, "callback_data", None)))
    return out


def rb_texts(markup):
    if markup is None:
        return []
    out = []
    for row in getattr(markup, "keyboard", []):
        for b in row:
            out.append(b.text)
    return out


def clear_fb(fb):
    fb.sent.clear()


# ============================================================
async def main():
    global failed
    reset_rows()

    class _DS:
        async def clear(self):
            return None
    # dummy_state created AFTER imports (fresh namespace per run)
    dummy_state = _DS()
    B.bot = FakeBot()
    B.supabase = FakeSupa()          # bot.py dagi module-global supabase shu yerga ulanadi
    fb = B.bot
    ADMIN = config.ADMIN_ID
    B.pending_logins.clear()
    B.pending_restore_file.clear()

    # =========================================================
    # 1) /start — ustoz va o'quvchi menyulari
    # =========================================================
    # 1a) Boshlang'ich /start — bo'sh foydalanuvchi
    st = Msg(111, "/start")
    st.state = "*"
    await B.cmd_start(st, dummy_state)
    check("Assalomu alaykum" in st.answers[0]["text"], "start: bo'sh foydalanuvchi salomi")
    check("🔑 Login orqali ulash" in st.answers[0]["text"], "start: bo'sh foydalanuvchi login tugmasi")
    stu_rb = rb_texts(st.answers[1]["reply_markup"])
    check(stu_rb is not None and "📱 Shaxsiy Kabinetim" in stu_rb,
          "start: bo'sh foydalanuvchi menyusi '📱 Shaxsiy Kabinetim'")
    check("🎙 Speaking topshirish" in stu_rb and "📊 Baholarim va Qarzim" in stu_rb,
          "start: bo'sh foydalanuvchi menyusi [🎙 Speaking topshirish] [📊 Baholarim va Qarzim]")
    check("🔑 Login orqali ulash" in stu_rb, "start: bo'sh foydalanuvchi menyusi [🔑 Login orqali ulash]")
    check(st.answers[1]["reply_markup"].is_persistent is True,
          "start: bo'sh foydalanuvchi menyusi doimiy (is_persistent=True)")
    check(st.answers[0]["parse_mode"] == "HTML", "start: javob HTML parse_mode bilan")
    _cds1 = [cd for _t, cd in btn_texts(st.answers[0]["reply_markup"])]
    check("start_login" in _cds1,
          "start: xush kelibsiz xabar patida [🔑 Login orqali kirish] (callback=start_login)")

    # 1b) /start — allaqachon bazaga bog'langan foydalanuvchi (Jasur, chat 555)
    st = Msg(555, "/start")
    st.state = "*"
    await B.cmd_start(st, dummy_state)
    check(st.answers[0]["text"].split(chr(10))[0] == "Assalomu alaykum, <b>Jasur Karimov</b>!",
          "start: mavjud foydalanuvchi salomi")
    check("Hisobingiz ulangan" in st.answers[0]["text"], "start: mavjud foydalanuvchi 'Hisobingiz ulangan'")
    stu_rb = rb_texts(st.answers[0]["reply_markup"])
    check(stu_rb is not None and "📱 Shaxsiy Kabinetim" in stu_rb,
          "start: mavjud foydalanuvchi menyusi '📱 Shaxsiy Kabinetim'")
    check([cd for _t, cd in btn_texts(st.answers[0]["reply_markup"])] == [],
          "start: ulangan foydalanuvchida login inline tugmasi YO'Q")
    check("🎙 Speaking topshirish" in stu_rb and "📊 Baholarim va Qarzim" in stu_rb,
          "start: mavjud foydalanuvchi menyusi [🎙 Speaking topshirish] [📊 Baholarim va Qarzim]")
    check("🔑 Login orqali ulash" in stu_rb, "start: mavjud foydalanuvchi menyusi [🔑 Login orqali ulash]")
    check(st.answers[0]["reply_markup"].is_persistent is True,
          "start: mavjud foydalanuvchi menyusi doimiy (is_persistent=True)")

    # 1c) Ustoz ham shu umumiy menyuni oladi (ustoz paneli /admin orqali)
    st = Msg(ADMIN, "/start")
    st.state = "*"
    await B.cmd_start(st, dummy_state)
    check("Assalomu alaykum" in st.answers[0]["text"], "start: ustozga ham salom boradi")
    ad_rb = rb_texts(st.answers[1]["reply_markup"])
    check(ad_rb is not None and "📱 Shaxsiy Kabinetim" in ad_rb,
          "start: ustoz uchun ham asosiy menyu '📱 Shaxsiy Kabinetim'")
    check("🔑 Login orqali ulash" in ad_rb,
          "start: ustoz uchun ham asosiy menyu [🔑 Login orqali ulash]")
    check(st.answers[1]["reply_markup"].is_persistent is True,
          "start: ustoz menyusi doimiy (is_persistent=True)")

    # =========================================================
    # 2) Ustoz: 👥 O'quvchilar ro'yxati
    # =========================================================
    m = Msg(ADMIN, B.ADMIN_MENU["students"])
    await B.btn_admin_students(m)
    t = m.answers[0]["text"]
    check("O'quvchilar ro'yxati" in t and "3 ta" in t, "ustoz: ro'yxat sarlavhasi + soni (3)")
    check("Jasur Karimov" in t and "8-sinf" in t, "ustoz: ro'yxatda ism + sinf")
    check("Speaking qarzi: 4 ta" in t, "ustoz: ro'yxatda speaking qarzi")
    check("IELTS Band 7.0" in t, "ustoz: ro'yxatda guruh nomi")

    m = Msg(555, B.ADMIN_MENU["students"])
    await B.btn_admin_students(m)
    check("faqat Muzaffar Amirov" in m.answers[0]["text"],
          "ustoz: ro'yxat noto'g'ri foydalanuvchiga rad etiladi")

    # =========================================================
    # 3) Ustoz: 📥 Backup (JSON fayl)
    # =========================================================
    fb.sent.clear()
    m = Msg(ADMIN, B.ADMIN_MENU["backup"])
    await B.btn_admin_backup(m)
    docs = [s for s in fb.sent if s["kind"] == "document"]
    check(len(docs) == 1, "backup: JSON fayl yuborildi")
    check(docs and docs[0]["chat_id"] == ADMIN, "backup: fayl ADMIN_ID ga yuborildi")
    fname = docs[0]["file_name"] if docs else ""
    check(bool(re.fullmatch(r"english_crm_backup_\d{4}-\d{2}-\d{2}\.json", fname or "")),
          f"backup: timestamped nom (english_crm_backup_YYYY-MM-DD.json) — {fname}")
    cap = docs[0]["caption"] if docs else ""
    check("O'quvchilar: 3 ta" in cap, "backup: kaptorda o'quvchilar soni (3)")
    check("Guruhlar: 1 ta" in cap, "backup: kaptorda guruhlar soni (1)")
    check("Baholar: 3 ta" in cap, "backup: kaptorda baholar soni (3)")
    payload = json.loads(docs[0]["document"].data.decode("utf-8")) if docs else {}
    check(isinstance(payload.get("students"), list) and len(payload["students"]) == 3,
          "backup: JSON ichida students jadvali (3 qator)")
    check(isinstance(payload.get("grades"), list) and len(payload["grades"]) == 3,
          "backup: JSON ichida grades jadvali (3 qator)")

    # =========================================================
    # 4) Ustoz: 🗑 Bazani tozalash (AVVAL zaxira, KEYIN tasdiq)
    # =========================================================
    fb.sent.clear()
    m = Msg(ADMIN, B.ADMIN_MENU["cleanup"])
    await B.btn_admin_cleanup(m)
    check(fb.sent and fb.sent[0]["kind"] == "document",
          "tozalash: AVVAL zaxira fayli yuborildi")
    check(fb.sent and fb.sent[0]["chat_id"] == ADMIN, "tozalash: zaxira ADMIN_ID ga yuborildi")
    ct = [t for t, _ in btn_texts(m.answers[0]["reply_markup"])]
    check(any("Xabarlarni tozalash" in x for x in ct) and
          any("Davomatni tozalash" in x for x in ct),
          "tozalash: [chat] va [davomat] tasdiq tugmalari")
    check(any("Barcha ma'lumotlarni tozalash" in x for x in ct) and
          any("Bekor qilish" in x for x in ct),
          "tozalash: [barcha] va [bekor] tugmalari")
    check("Eski ma'lumotlar fayl ko'rinishida yuklandi" in m.answers[0]["text"],
          "tozalash: tasdiq xabari")

    # bekor qilinadi
    call = Call(ADMIN, "cleanup:cancel", msg=CallMsg())
    await B.on_cleanup_answer(call)
    check(any("bekor qilindi" in e for e in call.message.edits), "tozalash: bekor qilindi")
    check(len(FAKE_ROWS["messages"]) == 1, "tozalash: bekor qilingach ma'lumot saqlanib qoldi")

    # xabarlar tozalanadi
    call = Call(ADMIN, "cleanup:messages", msg=CallMsg())
    await B.on_cleanup_answer(call)
    check(FAKE_ROWS["messages"] == [], "tozalash: messages jadvali tozalandi")
    check(any("Jadval tozalandi" in e for e in call.message.edits),
          "tozalash: success xabari")

    # davomat tozalanadi
    call = Call(ADMIN, "cleanup:attendance", msg=CallMsg())
    await B.on_cleanup_answer(call)
    check(FAKE_ROWS["attendance"] == [], "tozalash: attendance jadvali tozalandi")

    # ruxsatsiz foydalanuvchi
    call = Call(555, "cleanup:all", msg=CallMsg())
    await B.on_cleanup_answer(call)
    check(any("Ruxsat yo'q" in (a["text"] or "") for a in call.answers),
          "tozalash: noto'g'ri foydalanuvchi rad etiladi")

    # =========================================================
    # 5) QAYTA TIKLASH (restore) — tasdiq tugmalari + amalga oshirish
    # =========================================================
    backup_json = json.dumps({
        "app": "english-tutor", "version": 1,
        "groups": [{"id": 5, "name": "IELTS Band 7.0", "days": "Dushanba", "time": "18:00"}],
        "students": [{"id": 7, "name": "Jasur Karimov", "school_class": "8-sinf",
                      "group_id": "g5", "login": "jasur", "password": "123",
                      "speaking_debt": 7, "voice_allowed": True, "telegram_chat_id": 555}],
        "attendance": [], "grades": [{"id": 1, "student_id": 7, "date": "2026-10-01",
                                      "grade": 9, "category": "Speaking", "note": ""},
                                     {"id": 2, "student_id": 99, "date": "2026-10-01",
                                      "grade": 5, "category": "Speaking", "note": ""}],
        "messages": [], "speaking_submissions": [], "audio_submissions": [], "homework": [],
    }, ensure_ascii=False).encode("utf-8")

    fb.register_doc("FILE-1", backup_json)
    m = Msg(ADMIN, document=Doc("FILE-1", "english_crm_backup_2026-10-15.json"))
    await B.on_backup_file(m)
    rt = [t for t, _ in btn_texts(m.replies[0]["reply_markup"])]
    check("✅ Bazani qayta tiklash" in rt and "❌ Bekor qilish" in rt,
          "restore: [Bazani qayta tiklash] [Bekor qilish] tugmalari")
    check("Haqiqatan ham bazani ushbu fayldan qayta tiklamoqchimisiz" in m.replies[0]["text"],
          "restore: tasdiq xabari")

    # .json bo'lmagan fayl rad etiladi
    m = Msg(ADMIN, document=Doc("X", "photo.jpg"))
    await B.on_backup_file(m)
    check(".json formatidagi" in m.replies[0]["text"], "restore: .json emas fayl rad etiladi")

    call = Call(ADMIN, "restore_yes", msg=CallMsg())
    await B.on_restore_answer(call)
    check(any("Baza qayta tiklandi" in e for e in call.message.edits),
          "restore: success xabari")
    check(FAKE_ROWS["students"][0]["name"] == "Jasur Karimov" and
          FAKE_ROWS["students"][0]["speaking_debt"] == 7,
          "restore: o'quvchilar bazaga qayta yozildi (qarz=7)")
    check(FAKE_ROWS["grades"] and len(FAKE_ROWS["grades"]) == 1,
          "restore: yo'q o'quvchiga bog'langan qator tashlanadi")

    # =========================================================
    # 6) O'QUVCHI MENYUSI — 🔑 Login orqali ulash
    # =========================================================
    reset_rows()
    B.pending_logins.clear()

    m = Msg(999, B.STUDENT_MENU["login"])
    await B.btn_student_login(m)
    check("1-qadam" in m.answers[0]["text"] and "loginingizni" in m.answers[0]["text"],
          "menyu: login tugmasi -> 1-qadam (login so'raydi)")
    check(any(cd == "cancel_login" for _t, cd in btn_texts(m.answers[0]["reply_markup"])),
          "menyu: 1-qadam xabarida [❌ Bekor qilish] inline tugmasi")
    check(999 in B.pending_logins, "menyu: chat 999 kutish holatiga o'tdi")
    check(B.pending_logins.get(999, {}).get("step") == "waiting_login",
          "menyu: kutish holati step=waiting_login")

    m2 = Msg(999, "malika 123")
    await B.on_free_text(m2)
    mal = [s for s in FAKE_ROWS["students"] if s["login"] == "malika"][0]
    check(mal["telegram_chat_id"] == 999,
          "menyu: login/parol yuborildi -> telegram_chat_id saqlandi")
    check(999 not in B.pending_logins, "menyu: kutish holati tozalandi")
    check(any("Xush kelibsiz" in (a["text"] or "") for a in m2.answers),
          "menyu: ulanish muvaffaqiyati")

    m3 = Msg(777, "notlogin")
    await B.on_free_text(m3)
    check(any("O'quvchi menyusi" in (a["text"] or "") for a in m3.answers),
          "menyu: oddiy matn -> menyuni qayta ko'rsatadi")
    # asosiy menyu yangi foydalanuvchiga xam ishlaid
    m4 = Msg(999, "ikki matn")

    # /login buyrug'i
    lg = Msg(555, "/login")
    await B.cmd_login(lg)
    check("/login jasur 123" in lg.answers[0]["text"], "login: noto'g'ri format yordam")
    lg = Msg(555, "/login jasur wrong")
    await B.cmd_login(lg)
    check("noto'g'ri" in lg.answers[0]["text"], "login: yaroqsiz parol rad etiladi")

    # attempt_login: alohida aniq xabarlar va kafolatli xush kelibsiz
    # 1) Ustoz: /login m_amirov 123 -> tanishuv xabari
    t = Msg(555, "/login m_amirov 123")
    await B.attempt_login(t, "m_amirov", "123")
    check(any("Xush kelibsiz, Muzaffar Amirov!" in (a["text"] or "") for a in t.answers),
          "login: ustoz 'Xush kelibsiz, Muzaffar Amirov!' deb taniladi")
    # 2) Login bazada topilmasa -> 'topilmadi' xabari
    t = Msg(555, "/login yoqlogin 123")
    await B.attempt_login(t, "yoqlogin", "123")
    check(any("topilmadi" in (a["text"] or "") for a in t.answers),
          "login: login topilmasa 'Login topilmadi' xabari qaytadi")
    # 3) Parol noto'g'ri -> alohida 'parol noto'g'ri' xabari
    t = Msg(555, "/login jasur wrong")
    await B.attempt_login(t, "jasur", "wrong")
    check(any("parol noto'g'ri" in (a["text"] or "") for a in t.answers),
          "login: parol noto'g'ri -> alohida xabar qaytadi")

    # =========================================================
    # 6b) 2 QADAMLI LOGIN OQIMI (inline tugmalar: start/cancel)
    # =========================================================
    reset_rows()
    B.pending_logins.clear()
    clear_fb(fb)

    c = Call(888, "start_login")
    await B.cb_login_start(c)
    check(B.pending_logins.get(888, {}).get("step") == "waiting_login",
          "2qadam: start_login callback -> waiting_login")
    check(any("1-qadam" in (s["text"] or "") for s in fb.sent),
          "2qadam: '1-qadam: loginingizni kiriting' yuborildi")
    check(any(cd == "cancel_login" for _t, cd in btn_texts(fb.sent[-1]["reply_markup"])),
          "2qadam: 1-qadam xabarida [❌ Bekor qilish] tugmasi")

    m = Msg(888, "yoqlogin")
    await B.on_free_text(m)
    check(any("Bunday login topilmadi" in (a["text"] or "") for a in m.answers),
          "2qadam: login topilmadi -> ogohlantirish")
    check(B.pending_logins.get(888, {}).get("step") == "waiting_login",
          "2qadam: noto'g'ri logindan keyin waiting_login saqlanadi")

    m = Msg(888, "malika")
    await B.on_free_text(m)
    st8 = B.pending_logins.get(888, {})
    check(st8.get("step") == "waiting_password" and st8.get("login") == "malika",
          "2qadam: login qabul -> waiting_password + login saqlandi")
    check(any("Login qabul qilindi" in (a["text"] or "") and "malika" in (a["text"] or "")
              for a in m.answers),
          "2qadam: 'Login qabul qilindi! (malika)' xabari")
    _cds2 = [cd for _t, cd in btn_texts(m.answers[-1]["reply_markup"])]
    check("start_login" in _cds2 and "cancel_login" in _cds2,
          "2qadam: [🔄 Boshqa login kiritish] + [❌ Bekor qilish] tugmalari")

    m = Msg(888, "wrong")
    await B.on_free_text(m)
    check(any("Parol noto'g'ri" in (a["text"] or "") for a in m.answers),
          "2qadam: parol noto'g'ri -> xabar")
    check(B.pending_logins.get(888, {}).get("step") == "waiting_password",
          "2qadam: noto'g'ri paroldan keyin waiting_password saqlanadi")
    check(any(cd == "start_login" for _t, cd in btn_texts(m.answers[-1]["reply_markup"])),
          "2qadam: parol xatosida [🔄 Boshqa login kiritish] tugmasi")

    m = Msg(888, "123")
    await B.on_free_text(m)
    mal8 = [s for s in FAKE_ROWS["students"] if s["login"] == "malika"][0]
    check(mal8["telegram_chat_id"] == 888, "2qadam: telegram_chat_id yangilandi")
    check(888 not in B.pending_logins, "2qadam: kutish holati o'chirildi")
    check(any("Xush kelibsiz, Malika" in (a["text"] or "") for a in m.answers),
          "2qadam: 🎉 Xush kelibsiz, Malika!")
    check(any("muvaffaqiyatli ulandi" in (a["text"] or "") for a in m.answers),
          "2qadam: 'Hisobingiz muvaffaqiyatli ulandi'")
    check(any("🎙 Speaking topshirish" in rb_texts(a["reply_markup"]) for a in m.answers),
          "2qadam: asosiy menyu klaviaturasi chiqdi")

    B.pending_logins.clear()
    await B.cb_login_start(Call(777, "start_login"))
    await B.cb_login_cancel(Call(777, "cancel_login"))
    check(777 not in B.pending_logins, "2qadam: cancel_login -> kutish holati tozalandi")
    check(any("bekor qilindi" in (s["text"] or "") for s in fb.sent),
          "2qadam: 'Ulanish bekor qilindi' xabari")

    B.pending_logins.clear()
    m = Msg(888, "nilufar 123")
    await B.on_free_text(m)
    nil8 = [s for s in FAKE_ROWS["students"] if s["login"] == "nilufar"][0]
    check(nil8["telegram_chat_id"] == 888, "tezkor: 'nilufar 123' (pending'siz) -> darhol ulandi")
    check(any("Xush kelibsiz" in (a["text"] or "") for a in m.answers),
          "tezkor: tezkor kirishda xush kelibsiz xabari")

    # Keyingi bo'limlar uchun holatni tiklash (6-bo'limdagidek: malika→999, nilufar→666)
    [r for r in FAKE_ROWS["students"] if r["login"] == "malika"][0]["telegram_chat_id"] = 999
    [r for r in FAKE_ROWS["students"] if r["login"] == "nilufar"][0]["telegram_chat_id"] = 666
    B.pending_logins.clear()
    # 4) Inline kb/WebApp xatosida ham 'Xush kelibsiz' xabari YUBORILADI
    class KbFailMsg(Msg):
        async def answer(self, text=None, reply_markup=None, parse_mode=None, **kw):
            if reply_markup is not None and hasattr(reply_markup, "inline_keyboard"):
                raise RuntimeError("simulyatsiya: WebApp URL xatosi")
            await super().answer(text, reply_markup=reply_markup, parse_mode=parse_mode, **kw)
    t = KbFailMsg(666, "")
    await B.attempt_login(t, "nilufar", "123")
    check(any("Xush kelibsiz" in (a["text"] or "") for a in t.answers),
          "login: inline kb xatosida ham 'Xush kelibsiz' xabari ketadi (kafolatli)")
    mal2 = [s for s in FAKE_ROWS["students"] if s["login"] == "nilufar"][0]
    check(mal2["telegram_chat_id"] == 666, "login: kb xatosida ham hisob ulanib qoldi")

    # =========================================================
    # 7) 📊 Baholarim va Qarzim
    # =========================================================
    m = Msg(555, B.STUDENT_MENU["grades"])
    await B.btn_student_grades(m)
    t = m.answers[0]["text"]
    check("O'rtacha baho:" in t and "/10" in t, "baholar: o'rtacha 10 ballik")
    check("Speaking qarzi: 4 ta" in t, "baholar: joriy qarz (4)")
    check("So'nggi baholar" in t, "baholar: ro'yxat")

    m = Msg(444, B.STUDENT_MENU["grades"])
    await B.btn_student_grades(m)
    check("Login orqali ulash" in m.answers[0]["text"], "baholar: ulanmagan -> login taklifi")

    # =========================================================
    # 8) 🎙 Speaking topshirish
    # =========================================================
    m = Msg(666, B.STUDENT_MENU["speak"])
    await B.btn_student_speak(m)
    check(m.answers[0]["text"]
          == "⛔ Kechirasiz! Ustoz hozircha sizga ovozli topshirishga ruxsat bermagan. Darsda topshiring.",
          "speaking: voice_allowed=false -> aynan spec rad xabari")

    m = Msg(555, B.STUDENT_MENU["speak"])
    await B.btn_student_speak(m)
    t = m.answers[0]["text"]
    check("vozli xabar" in t and "dumaloq video" in t, "speaking: yo'riqnoma (voice/video)")
    check("Joriy speaking qarzi: 4 ta" in t, "speaking: joriy qarz ko'rsatildi")

    # =========================================================
    # 8b) GURUH TURI: maktab guruhi (school) — qarz/to'lov YASHIRIN
    # =========================================================
    FAKE_ROWS["groups"].append({"id": 2, "name": "9-A", "days": "Dushanba", "time": "09:00",
                                "group_type": "school"})
    FAKE_ROWS["students"].append({"id": 4, "name": "Maktab O'quvchisi", "school_class": "9-sinf",
                                  "group_id": 2, "login": "maktab", "password": "123",
                                  "speaking_debt": 3, "voice_allowed": True,
                                  "telegram_chat_id": 4444})
    FAKE_ROWS["grades"].append({"id": 40, "student_id": 4, "date": "2026-10-03", "grade": 9,
                                "category": "Darsdagi javob", "note": ""})
    check(B._is_school_group(2) is True, "guruh turi: group_type='school' aniqlandi")
    check(B._is_school_group(1) is False, "guruh turi: eski guruh (ustunsiz) = tutoring")

    labels_school = [b.text for row in get_main_keyboard(True).keyboard for b in row]
    check("📊 Baholarim" in labels_school and "📊 Baholarim va Qarzim" not in labels_school,
          "guruh turi: maktab o'quvchisi menyusida 'Qarzim' so'zi yo'q")
    labels_tutor = [b.text for row in get_main_keyboard(False).keyboard for b in row]
    check("📊 Baholarim va Qarzim" in labels_tutor,
          "guruh turi: repetitorlik menyusi o'zgarmagan")

    m = Msg(4444, B.STUDENT_MENU["grades_school"])
    await B.btn_student_grades(m)
    t = m.answers[0]["text"]
    check("O'rtacha baho:" in t and "9/10" in t,
          "guruh turi: maktab o'quvchisi baholarini ko'radi")
    check("qarz" not in t.lower() and "to'lov" not in t.lower() and "so'm" not in t.lower(),
          "guruh turi: maktab o'quvchisiga qarz/to'lov/pul so'zi CHIQMAYDI")

    m = Msg(4444, B.STUDENT_MENU["speak"])
    await B.btn_student_speak(m)
    t = m.answers[0]["text"]
    check("vozli xabar" in t and "qarz" not in t.lower(),
          "guruh turi: speaking yo'riqnomada ham 'qarz' yo'q")

    fb.sent.clear()
    v = Msg(4444, voice=Media("V-SCHOOL"))
    await B.handle_speaking_submission(v)
    check(bool(v.replies) and "qarz" not in (v.replies[0]["text"] or "").lower(),
          "guruh turi: topshirish tasdiqida 'qarz' so'zi yo'q")

    sub_school = FAKE_ROWS["speaking_submissions"][-1]
    call_school = Call(ADMIN, f"g:{sub_school['id']}:9", msg=CallMsg(caption="c"))
    await B.on_grade_tap(call_school)
    notes_school = [x["text"] for x in fb.sent
                    if x["kind"] == "message" and x["chat_id"] == 4444]
    check(bool(notes_school) and "qarz" not in notes_school[-1].lower()
          and "9/10" in notes_school[-1],
          "guruh turi: baho xabarida ham 'qarz' yo'q (faqat ball)")

    # maktab guruhiga oylik to'lov yozilmaydi (haqiqatan bepul)
    [x for x in FAKE_ROWS["groups"] if x["id"] == 1][0]["monthly_fee"] = 50000
    [x for x in FAKE_ROWS["students"] if x["id"] == 1][0]["fee_period"] = ""
    [x for x in FAKE_ROWS["students"] if x["id"] == 4][0]["fee_period"] = ""
    charged = await B.monthly_fee_tick()
    check(charged >= 1, "moliya: repetitorlik guruhiga oylik to'lov yozildi")
    tutor_st = [x for x in FAKE_ROWS["students"] if x["id"] == 1][0]
    check(int(tutor_st.get("payment_debt") or 0) == 50000,
          "moliya: repetitorlik o'quvchisiga oylik qarz qo'shildi")
    school_st = [x for x in FAKE_ROWS["students"] if x["id"] == 4][0]
    check(int(school_st.get("payment_debt") or 0) == 0,
          "moliya: maktab guruhi o'quvchisiga oylik qarz qo'shilmadi (bepul)")

    # keyingi bo'limlar uchun vaqtinchalik qatorlarni olib tashlaymiz
    [x for x in FAKE_ROWS["groups"] if x["id"] == 1][0]["monthly_fee"] = 0
    for _sid in (1, 2, 3):
        _st = [x for x in FAKE_ROWS["students"] if x["id"] == _sid][0]
        _st.pop("payment_debt", None)
        _st.pop("fee_period", None)
    FAKE_ROWS["students"] = [x for x in FAKE_ROWS["students"] if x["id"] != 4]
    FAKE_ROWS["groups"] = [x for x in FAKE_ROWS["groups"] if x["id"] != 2]
    FAKE_ROWS["grades"] = [x for x in FAKE_ROWS["grades"] if x.get("student_id") != 4]

    # =========================================================
    # 9) VOICE / VIDEO / KRUJOK + 1-TAP BAHO
    # =========================================================
    # ulanmagan -> login taklifi
    v = Msg(888, voice=Media("V0"))
    await B.handle_speaking_submission(v)
    check("/login" in v.answers[0]["text"], "voice: ulanmagan -> login taklifi")

    # ruxsat yo'q
    v = Msg(666, voice=Media("V1"))
    await B.handle_speaking_submission(v)
    check(v.answers[0]["text"]
          == "⛔ Kechirasiz! Ustoz hozircha sizga ovozli topshirishga ruxsat bermagan. Darsda topshiring.",
          "voice: ruxsat yo'q -> aynan spec rad xabari")

    # ruxsat bor -> ustozga forward + qarz +1
    fb.sent.clear()
    v = Msg(555, voice=Media("V3"))
    await B.handle_speaking_submission(v)
    sub_voice = FAKE_ROWS["speaking_submissions"][-1]
    check(sub_voice["media_type"] == "voice" and sub_voice["telegram_file_id"] == "V3",
          "voice: speaking_submissions ga yozildi")
    check(sub_voice["status"] == "kutilmoqda", "voice: status='kutilmoqda'")
    check(FAKE_ROWS["students"][0]["speaking_debt"] == 4,
          "voice: TOPSHIRISH speaking_debtni OSHIRMAYDI (4 -> 4)")

    fwd = [s for s in fb.sent if s["kind"] == "voice" and s["chat_id"] == ADMIN]
    check(len(fwd) == 1, "voice: ustozga forward qilindi")
    capv = fwd[0]["caption"] if fwd else ""
    check("YANGI SPEAKING TOPSHIRILDI" in capv, "voice: ustozga kaptor sarlavhasi")
    check("Jasur Karimov" in capv and "8-sinf" in capv, "voice: kaptorda ism + sinf")
    check("Speaking qarzi:</b> 4 ta" in capv, "voice: kaptorda joriy speaking qarzi (4)")

    gtexts = [t for t, _ in btn_texts(fwd[0]["reply_markup"])]
    check(all(str(n) in gtexts for n in (10, 9, 8, 7, 6, 5)),
          "voice: 1-tap baho tugmalari [10][9][8][7][6][5]")
    check("📝 Saytda ochish" in gtexts, "voice: [ 📝 Saytda ochish ] tugmasi")
    gdata = [c for _, c in btn_texts(fwd[0]["reply_markup"]) if c]
    grade_cbs = [c for c in gdata if c.startswith("g:")]
    check(len(grade_cbs) == 10 and all(re.fullmatch(r"g:\d+:\d+", c) for c in grade_cbs),
          "voice: baho callback g:<sub_id>:<score> (10 ta)")
    check(len(gdata) == 11 and sum(1 for c in gdata if c.startswith("reject:")) == 1,
          "voice: 10 ta baho + 1 ta bekor qilish tugmasi (jami 11 callback)")
    check("Qabul qilindi" in v.replies[0]["text"], "voice: o'quvchiga tasdiq")

    # krujok (video_note) -> alohida video_note + matn xabari tugmalar bilan
    fb.sent.clear()
    v = Msg(555, video_note=Media("VN1"))
    await B.handle_speaking_submission(v)
    check(any(s["kind"] == "video_note" and s["chat_id"] == ADMIN for s in fb.sent),
          "video_note: krujok ustozga yuborildi")
    vn_cap = [s for s in fb.sent if s["kind"] == "message" and s["chat_id"] == ADMIN]
    check(bool(vn_cap) and "📝 Saytda ochish" in
          [t for t, _ in btn_texts(vn_cap[0]["reply_markup"])],
          "video_note: kaptor matni baho tugmalari bilan keldi")
    check(FAKE_ROWS["students"][0]["speaking_debt"] == 4,
          "video_note: TOPSHIRISH qarzni OSHIRMAYDI (4 -> 4)")

    # video (MP4)
    fb.sent.clear()
    v = Msg(555, video=Media("MP4"))
    await B.handle_speaking_submission(v)
    sub_video = FAKE_ROWS["speaking_submissions"][-1]
    check(any(s["kind"] == "video" and s["chat_id"] == ADMIN for s in fb.sent),
          "video: MP4 ustozga yuborildi")
    check(FAKE_ROWS["students"][0]["speaking_debt"] == 4,
          "video: 3 ta topshirikdan keyin ham qarz 4 (qo'shilmaydi)")
    debt_before = FAKE_ROWS["students"][0]["speaking_debt"]  # topshiriklardan keyin ham o'zgarmagan

    # ---- 1-tap baho: [9] bosildi ----
    fb.sent.clear()
    kb = B.grade_keyboard(sub_video["id"])
    tap_data = kb.inline_keyboard[0][1].callback_data  # 9
    check(tap_data == f"g:{sub_video['id']}:9", "baho: callback aynan 'g:<sub>:9'")

    call = Call(ADMIN, tap_data, msg=CallMsg(caption="old caption"))
    await B.on_grade_tap(call)
    gr = [g for g in FAKE_ROWS["grades"]
          if g["student_id"] == 1 and g["grade"] == 9 and g["category"] == "Speaking"]
    check(len(gr) == 1 and gr[0]["note"] == "Speaking (Telegram)",
          "baho: grades jadvaliga yozildi (9, Speaking)")
    check(FAKE_ROWS["students"][0]["speaking_debt"] == debt_before - 1,
          f"baho: speaking_debt {debt_before} -> {debt_before - 1} (-1)")
    check(sub_video["status"] == "baholandi" and sub_video["score"] == 9,
          "baho: speaking_submissions baholandi belgilandi")
    notes = [s["text"] for s in fb.sent if s["kind"] == "message" and s["chat_id"] == 555]
    check(notes == ["🎉 Muzaffar Amirov sizga 9/10 ball qo'ydi! "
                    "Speaking qarzingiz 1 taga kamaydi."],
          "baho: o'quvchiga aynan spec xabar yuborildi")
    _edits_plain = [re.sub(r"<[^>]+>", "", e) for e in call.message.edits]
    check(any("✅ Baholandi! Speaking qarzi 1 taga kamaytirildi." in e
              for e in _edits_plain),
          "baho: ustozga aynan spec tasdiq (Baholandi! ... kamaytirildi)")
    check(any(a["text"] == "✅ 9 ball qo'yildi" for a in call.answers),
          "baho: ustozga tasdiq (answer)")

    # takror bosilganda qayta kamaymaydi
    fb.sent.clear()
    call2 = Call(ADMIN, tap_data, msg=CallMsg(caption="c"))
    await B.on_grade_tap(call2)
    check(FAKE_ROWS["students"][0]["speaking_debt"] == debt_before - 1,
          "baho: takror bosildi -> qarz o'zgarmadi")
    check(any("allaqachon baholangan" in (a["text"] or "") for a in call2.answers),
          "baho: takror bosish rad etiladi")
    check(not any(s["kind"] == "message" and s["chat_id"] == 555 for s in fb.sent),
          "baho: takrorbosishda o'quvchiga xabar ketmadi")

    # ruxsatsiz bosish
    call3 = Call(555, tap_data, msg=CallMsg())
    await B.on_grade_tap(call3)
    check(any("Ruxsat yo'q" in (a["text"] or "") for a in call3.answers),
          "baho: noto'g'ri foydalanuvchi rad etiladi")

    # =========================================================
    # 9b) BEKOR QILISH (reject) — qabul qilmaslik
    # =========================================================
    kb_rej = B.grade_keyboard(sub_voice["id"])
    rej_rows = kb_rej.inline_keyboard
    check(rej_rows[2][0].text == "❌ Bekor qilish (Qabul qilmaslik)" and
          rej_rows[2][0].callback_data == f"reject:{sub_voice['id']}",
          "reject: baho tugmalari pastiga [ ❌ Bekor qilish (Qabul qilmaslik) ] qo'shildi")
    check([c for _, c in btn_texts(kb_rej) if (c or "").startswith("reject:")]
          == [f"reject:{sub_voice['id']}"],
          "reject: callback aynan 'reject:<sub_id>'")

    debt_prej = FAKE_ROWS["students"][0]["speaking_debt"]
    grades_prej = len(FAKE_ROWS["grades"])
    fb.sent.clear()

    # ruxsatsiz foydalanuvchi bosadi
    rj = Call(555, f"reject:{sub_voice['id']}", msg=CallMsg())
    await B.on_reject_tap(rj)
    check(any("Ruxsat yo'q" in (a["text"] or "") for a in rj.answers),
          "reject: noto'g'ri foydalanuvchi rad etiladi")
    check(sub_voice["status"] != "rad_etildi", "reject: ruxsatsiz bosishda status o'zgarmadi")

    # ADMIN bosadi
    rj2 = Call(ADMIN, f"reject:{sub_voice['id']}", msg=CallMsg(caption="old caption"))
    await B.on_reject_tap(rj2)
    check(sub_voice["status"] == "rad_etildi", "reject: status='rad_etildi' bo'ldi")
    check(FAKE_ROWS["students"][0]["speaking_debt"] == debt_prej,
          f"reject: speaking_debt O'ZGARMADI ({debt_prej})")
    check(len(FAKE_ROWS["grades"]) == grades_prej,
          "reject: grades jadvaliga baho YOZILMADI")
    stu_msgs = [s for s in fb.sent if s["kind"] == "message" and s["chat_id"] == 555]
    check(len(stu_msgs) == 1 and stu_msgs[0]["text"] ==
          "<b>SPEAKING BEKOR QILINDI ❌</b>\n\nSpeaking javobingizda shubhali holat aniqlandi!",
          "reject: o'quvchiga AYNAN spec xabar yuborildi")
    rej_edits = [re.sub(r"<[^>]+>", "", e) for e in rj2.message.edits]
    exp_rej = ("❌ SPEAKING BEKOR QILINDI\n👤 Jasur Karimov\n💰 Qarz o'zgarmadi: "
               + str(debt_prej) + " ta")
    check(rej_edits == [exp_rej],
          "reject: ustoz xabari aynan spec matnga yangilandi")
    check(any("bekor qilindi" in (a["text"] or "") for a in rj2.answers),
          "reject: ustozga tasdiq (answer)")

    # takror bosilganda takrorlanmaydi
    fb.sent.clear()
    rj3 = Call(ADMIN, f"reject:{sub_voice['id']}", msg=CallMsg(caption="c"))
    await B.on_reject_tap(rj3)
    check(not any(s["kind"] == "message" and s["chat_id"] == 555 for s in fb.sent),
          "reject: takrorbosishda o'quvchiga xabar ketmadi")
    check(any("allaqachon bekor qilingan" in (a["text"] or "") for a in rj3.answers),
          "reject: takror bosish rad etiladi")
    check(FAKE_ROWS["students"][0]["speaking_debt"] == debt_prej,
          "reject: takror bosishda ham qarz o'zgarmadi")

    # =========================================================
    # 10) 🎙 Yangi speakinglar
    # =========================================================
    FAKE_ROWS["speaking_submissions"] = [
        {"id": 1, "student_id": 1, "media_type": "voice", "telegram_file_id": "A1",
         "status": "kutilmoqda", "created_at": "2026-10-15T10:00:00Z"},
        {"id": 2, "student_id": 2, "media_type": "video_note", "telegram_file_id": "A2",
         "status": "kutilmoqda", "created_at": "2026-10-15T11:00:00Z"},
    ]
    fb.sent.clear()
    m = Msg(ADMIN, B.ADMIN_MENU["speak"])
    await B.btn_admin_new_speakings(m)
    t = m.answers[0]["text"]
    check("Yangi speakinglar" in t and "2 ta kutilmoqda" in t,
          "yangi speakinglar: ro'yxat (2 ta kutilmoqda)")
    check("Jasur Karimov" in t, "yangi speakinglar: o'quvchi ismi")
    check(len([s for s in fb.sent if s["chat_id"] == ADMIN]) >= 1,
          "yangi speakinglar: topshiriklar ustozga qayta yuborildi")

    FAKE_ROWS["speaking_submissions"] = []
    m = Msg(ADMIN, B.ADMIN_MENU["speak"])
    await B.btn_admin_new_speakings(m)
    check("yangi speaking topshirik yo'q" in m.answers[0]["text"],
          "yangi speakinglar: bo'sh holat xabari")

    # =========================================================
    # 11) Uyga vazifa broadcast (hw_tick)
    # =========================================================
    B._last_hw_seen = 0
    FAKE_ROWS["homework"] = [
        {"id": 1, "group_id": 1, "title": "Present Perfect",
         "description": "1-20 gacha", "due_date": "2026-10-20",
         "created_at": "2026-10-15T00:00:00Z"},
    ]
    fb.sent.clear()
    sent = await B.hw_tick()
    linked = len([s for s in FAKE_ROWS["students"] if s.get("telegram_chat_id")])
    check(sent == linked and linked == 3,
          f"homework: ulangan {linked} o'quvchiga yuborildi (keldi={sent})")
    check(any("YANGI UYGA VAZIFA" in (s.get("text") or "") for s in fb.sent),
          "homework: xabar matni")
    again = await B.hw_tick()
    check(again == 0, "homework: takrorlanish spam qilmaydi")
    hw_msgs = [s for s in fb.sent if s["kind"] == "message"]
    check(hw_msgs and hw_msgs[0].get("disable_notification") is False,
          "homework: ovozli (sound) yetkazish — disable_notification=False")

    # =========================================================
    # 12) TEZKOR BILDIRISHNOMALAR (grade_tick / message_tick / voice)
    # =========================================================
    B._last_grade_seen = None
    B._last_msg_seen = None
    fb.sent.clear()

    # --- (a) yangi baho → o'quvchiga ---
    sent0 = await B.grade_tick()
    check(sent0 == 0, "notif: grade — birinchi start mavjud baholarni SPAM qilmaydi")

    FAKE_ROWS["grades"].append({"id": 90, "student_id": 1, "date": "2026-10-05",
                                "grade": 9, "category": "Speaking", "note": ""})
    fb.sent.clear()
    sent = await B.grade_tick()
    g_msgs = [s for s in fb.sent if s["kind"] == "message"]
    check(sent == 1 and len(g_msgs) == 1, "notif: grade — yangi baho → 1 ta tezkor xabar")
    check(g_msgs and g_msgs[0]["chat_id"] == 555,
          "notif: grade — o'quvchining telegram_chat_id'siga ketdi")
    check(g_msgs and "Sizga yangi baho qo'yildi (9/10)!" in g_msgs[0]["text"],
          "notif: grade — matn specda aniq")
    check(g_msgs and g_msgs[0].get("disable_notification") is False,
          "notif: grade — ovozli (sound) yetkazish")
    again = await B.grade_tick()
    check(again == 0, "notif: grade — takrorlanish spam qilmaydi")

    # telegram_chat_id yo'q o'quvchi → yuborilmaydi, xato yo'q
    _saved_chat = FAKE_ROWS["students"][2].get("telegram_chat_id")
    FAKE_ROWS["students"][2]["telegram_chat_id"] = None
    FAKE_ROWS["grades"].append({"id": 91, "student_id": 3, "date": "2026-10-05",
                                "grade": 7, "category": "Speaking", "note": ""})
    fb.sent.clear()
    sent = await B.grade_tick()
    FAKE_ROWS["students"][2]["telegram_chat_id"] = _saved_chat
    check(sent == 0 and not [s for s in fb.sent if s["kind"] == "message"],
          "notif: grade — telegram_chat_id yo'q bo'lsa jim o'tadi")

    # --- (b) chat xabari → qabul qiluvchiga ---
    sent0 = await B.message_tick()
    check(sent0 == 0, "notif: message — birinchi start mavjud xabarlarni SPAM qilmaydi")

    FAKE_ROWS["messages"].append({"id": 70, "student_id": 1, "sender": "teacher",
                                  "text": "Ertaga dars bor",
                                  "created_at": "2026-10-05T10:00:00Z"})
    fb.sent.clear()
    sent = await B.message_tick()
    to_student = [s for s in fb.sent if s["kind"] == "message" and s["chat_id"] == 555]
    check(sent == 1 and len(to_student) == 1, "notif: message — ustoz yozgan → o'quvchiga")
    check(to_student and "Muzaffar Amirovdan yangi xabar:" in to_student[0]["text"],
          "notif: message — o'quvchiga matn specda aniq")
    check(to_student and "(Javob qaytarish uchun to'g'ridan-to'g'ri botga yozishingiz mumkin)"
          in to_student[0]["text"],
          "notif: message — o'quvchiga javob yo'riqnomasi qo'shildi")
    check(to_student and "Ertaga dars bor" in to_student[0]["text"],
          "notif: message — xabar matni yetdi")
    check(to_student and to_student[0].get("disable_notification") is False,
          "notif: message — ovozli (sound) yetkazish")

    FAKE_ROWS["messages"].append({"id": 71, "student_id": 2, "sender": "student",
                                  "text": "Yaxshiman",
                                  "created_at": "2026-10-05T10:05:00Z"})
    fb.sent.clear()
    sent = await B.message_tick()
    to_teacher = [s for s in fb.sent if s["kind"] == "message" and s["chat_id"] == config.ADMIN_ID]
    check(sent == 1 and len(to_teacher) == 1, "notif: message — o'quvchi yozgan → ustozga")
    check(to_teacher and to_teacher[0]["text"] ==
          "💬 <b>O'quvchidan yangi xabar!</b>\n"
          "👤 <b>Nilufar Ergasheva</b> (9-sinf):\n\n"
          "<i>\"Yaxshiman\"</i>",
          "notif: message — ustozga matn specda aniq (ism + sinf)")
    check(to_teacher and btn_texts(to_teacher[0]["reply_markup"]) ==
          [("↩️ Javob yozish", "reply_student:2")],
          "notif: message — [ ↩️ Javob yozish ] -> reply_student:<id>")
    check(to_teacher and "Yaxshiman" in to_teacher[0]["text"],
          "notif: message — ustozga xabar matni yetdi")
    check(to_teacher and to_teacher[0].get("disable_notification") is False,
          "notif: message — ustozga ovozli (sound) yetkazish")
    again = await B.message_tick()
    check(again == 0, "notif: message — takrorlanish spam qilmaydi")

    # --- (b2) restart: kursor bot_settings'dan tiklanadi ---
    FAKE_ROWS["bot_settings"] = [{"key": "last_message_id", "value": "71"}]
    FAKE_ROWS["messages"].append({"id": 72, "student_id": 1, "sender": "teacher",
                                  "text": "Offline kelgan xabar",
                                  "created_at": "2026-10-05T10:10:00Z"})
    B._last_msg_seen = None
    fb.sent.clear()
    sent = await B.message_tick()
    check(sent == 1 and any("Offline kelgan xabar" in (x.get("text") or "") for x in fb.sent),
          "notif: message — restartdan keyin offline xabar yetkaziladi")
    _cur = [r for r in FAKE_ROWS["bot_settings"] if r.get("key") == "last_message_id"]
    check(bool(_cur) and _cur[0].get("value") == "72",
          "notif: message — kursor bot_settings'da saqlanadi")

    # --- (b3) bitta xatolik keyingi xabarlarni to'xtatmaydi ---
    FAKE_ROWS["messages"].append({"id": 73, "student_id": 1, "sender": "teacher",
                                  "text": "Bloklangan o'quvchi",
                                  "created_at": "2026-10-05T10:11:00Z"})
    FAKE_ROWS["messages"].append({"id": 74, "student_id": 2, "sender": "teacher",
                                  "text": "Keyingi xabar",
                                  "created_at": "2026-10-05T10:12:00Z"})
    _orig_send = fb.send_message

    async def _boom(chat_id, text, **kw):
        if int(chat_id) == 555:
            raise RuntimeError("bot blocked")
        await _orig_send(chat_id, text, **kw)

    fb.send_message = _boom
    fb.sent.clear()
    try:
        sent = await B.message_tick()
    finally:
        fb.send_message = _orig_send
    check(sent == 1 and any(x["chat_id"] == 666 and "Keyingi xabar" in x["text"]
                            for x in fb.sent),
          "notif: message — xatolik keyingi xabarni to'xtatmaydi")
    check(B._last_msg_seen == 74,
          "notif: message — xatolikdan keyin ham kursor oldinga suriladi")

    # --- (c) voice ruxsati — mavjud oqim ham ovozli ---
    B._voice_seen = {1: False, 2: True, 3: True}
    fb.sent.clear()
    sent = await B.voice_tick()
    v_msgs = [s for s in fb.sent if s["kind"] == "message" and s["chat_id"] == 555]
    check(sent == 1 and len(v_msgs) == 1, "notif: voice — false→true o'tishi xabar ketdi")
    check(v_msgs and "Ruxsat berildi" in v_msgs[0]["text"], "notif: voice — matn saqlangan")
    check(v_msgs and v_msgs[0].get("disable_notification") is False,
          "notif: voice — ovozli (sound) yetkazish")

    # =========================================================
    # 13) Health server (Render 24/7)
    # =========================================================
    import aiohttp
    await B.start_dummy_web_server()
    await asyncio.sleep(0.2)
    port = int(os.getenv("PORT", 10000))
    try:
        async with aiohttp.ClientSession() as sess:
            async with sess.get(f"http://127.0.0.1:{port}/") as resp:
                body = await resp.text()
                check(resp.status == 200 and "Bot is running 24/7" in body,
                      "health: / 200 + banner")
            async with sess.get(f"http://127.0.0.1:{port}/health") as resp:
                check(resp.status == 200, "health: /health 200")
    except Exception as e:
        check(False, f"health: serverga ulanib bo'lmadi — {e}")

    # =========================================================
    # 14) main() siyosati — event loop hech qachon bloklanmaydi
    # =========================================================
    # =========================================================
    # 10) O'QUVCHI MATNLI XABARI → USTOZGA + JAVOB QAYTARISH
    # =========================================================
    reset_rows()
    B.pending_logins.clear()
    B._last_msg_seen = None
    B._delivered_msg_ids.clear()
    fb.sent.clear()
    st1 = [x for x in FAKE_ROWS["students"] if x.get("telegram_chat_id") == 555][0]

    msg = Msg(555, "Assalomu alaykum, ertaga darsga kela olmayman. Uzrli sababim bor.")
    await B.on_free_text(msg)

    saved = [r for r in FAKE_ROWS["messages"] if r.get("sender") == "student"]
    check(len(saved) == 1 and saved[0]["student_id"] == st1["id"]
          and saved[0]["text"] == msg.text,
          "chat: o'quvchi matni messages ga sender='student' bo'lib yozildi")
    alerts = [x for x in fb.sent if x["kind"] == "message" and x["chat_id"] == ADMIN]
    check(len(alerts) == 1, "chat: ustozga darhol bitta xabar keldi")
    at = alerts[0]["text"] if alerts else ""
    check("O'quvchidan yangi xabar!" in at and st1["name"] in at
          and f"({st1['school_class']})" in at and msg.text in at,
          "chat: ustoz xabarida ism, sinf va matn bor")
    _cb = [c for _t, c in btn_texts(alerts[0]["reply_markup"]) if c]
    check(_cb == [f"reply_student:{st1['id']}"],
          "chat: [ ↩️ Javob yozish ] -> reply_student:<id>")
    check(any("Muzaffar Amirovga yuborildi" in (a["text"] or "") for a in msg.answers),
          "chat: o'quvchiga 'yuborildi' tasdiq")

    fb.sent.clear()
    check(await B.message_tick() == 0,
          "chat: messages_watcher yuborilgan xabarni takrorlamaydi")

    # ---- ustoz [↩️ Javob yozish] ----
    state = FakeState()
    call = Call(ADMIN, f"reply_student:{st1['id']}", msg=CallMsg())
    await B.cb_reply_student(call, state)
    check(state.state == B.ReplyStates.waiting_reply,
          "chat: ustoz uchun javob yozish holati yoqildi")
    check(state.data.get("student_id") == st1["id"],
          "chat: javob qilinadigan o'quvchi holatga saqlandi")
    check(any(st1["name"] in (e or "") for e in call.message.edits),
          "chat: ustozga 'javobingizni yozing' xabari (ism bilan)")

    fb.sent.clear()
    reply = Msg(ADMIN, "Ertaga darsdan keyin qo'ng'iroq qiling, kelishamiz.")
    await B.on_teacher_reply(reply, state)
    outs = [x for x in fb.sent if x["kind"] == "message" and x["chat_id"] == 555]
    check(len(outs) == 1 and outs[0]["text"]
          == "💬 <b>Muzaffar Amirovdan javob:</b>\n\n" + B.html.escape(reply.text),
          "chat: ustoz javobi o'quvchiga aynan spec formatda yuborildi")
    t_saved = [r for r in FAKE_ROWS["messages"] if r.get("sender") == "teacher"
               and r.get("text") == reply.text]
    check(len(t_saved) == 1 and t_saved[0]["student_id"] == st1["id"]
          and t_saved[0]["text"] == reply.text,
          "chat: javob messages ga sender='teacher' bo'lib saqlandi")
    check(state.state is None, "chat: javobdan keyin holat tozalandi")
    check(any("Javob o'quvchiga yuborildi" in (a["text"] or "") for a in reply.answers),
          "chat: ustozga yuborildi tasdiq")
    fb.sent.clear()
    check(await B.message_tick() == 0,
          "chat: ustoz javobi watcher orqali takrorlanmaydi")

    # ---- /cancel va ruxsat ----
    state2 = FakeState({"student_id": st1["id"]})
    cm = Msg(ADMIN, "/cancel")
    await B.cmd_cancel_reply(cm, state2)
    check(state2.state is None and any("bekor qilindi" in (a["text"] or "") for a in cm.answers),
          "chat: /cancel javob yozishni bekor qiladi")

    call_x = Call(555, f"reply_student:{st1['id']}", msg=CallMsg())
    await B.cb_reply_student(call_x, FakeState())
    check(any("Ruxsat yo'q" in (a["text"] or "") for a in call_x.answers),
          "chat: begona odam javob tugmasini bosa olmaydi")

    # =========================================================
    # 11) WRITING (YOZMA ISH RASMI) TOPSHIRISH + BAHO
    # =========================================================
    fb.sent.clear()
    w = Msg(555, photo=[Media("PH-SMALL"), Media("PH-BIG")])
    await B.handle_speaking_submission(w)
    sub_w = FAKE_ROWS["speaking_submissions"][-1]
    check(sub_w["media_type"] == "writing" and sub_w["telegram_file_id"] == "PH-BIG",
          "writing: rasm media_type='writing' + eng katta fayl id")
    check(sub_w["status"] == "kutilmoqda", "writing: status='kutilmoqda'")
    ph = [x for x in fb.sent if x["kind"] == "photo" and x["chat_id"] == ADMIN]
    check(len(ph) == 1, "writing: rasm ustozga yuborildi")
    cap = ph[0]["caption"] if ph else ""
    check("YANGI WRITING (YOZMA ISH) TOPSHIRILDI!" in cap
          and "Yozma ish (Rasm)" in cap and st1["name"] in cap and st1["school_class"] in cap,
          "writing: kaptor aynan spec bo'yicha (ism + sinf)")
    wbtns = [t for t, _ in btn_texts(ph[0]["reply_markup"])]
    check(all(str(n) in wbtns for n in range(1, 11))
          and "❌ Bekor qilish (Qabul qilmaslik)" in wbtns,
          "writing: [10]..[1] + bekor qilish tugmalari")
    check(any("Qabul qilindi" in (r["text"] or "") for r in w.replies),
          "writing: o'quvchiga qabul tasdiqi")

    debt_w = FAKE_ROWS["students"][0]["speaking_debt"]
    fb.sent.clear()
    call_w = Call(ADMIN, f"g:{sub_w['id']}:10", msg=CallMsg(caption="c"))
    await B.on_grade_tap(call_w)
    gr_w = [g for g in FAKE_ROWS["grades"]
            if g["student_id"] == st1["id"] and g["category"] == "Writing"]
    check(len(gr_w) == 1 and gr_w[0]["grade"] == 10
          and gr_w[0]["note"] == "Writing (Telegram)",
          "writing: grades ga category='Writing', note='Writing (Telegram)'")
    check(FAKE_ROWS["students"][0]["speaking_debt"] == debt_w,
          "writing: speaking qarzi o'zgarmaydi")
    wnotes = [x["text"] for x in fb.sent if x["kind"] == "message" and x["chat_id"] == 555]
    check(wnotes == ["🎉 <b>Writing (yozma ish) vazifangiz baholandi: 10/10 ball!</b>"],
          "writing: o'quvchiga aynan spec baho xabari")
    check(sub_w["status"] == "baholandi" and sub_w["score"] == 10,
          "writing: topshirik 'baholandi' belgilandi")

    # bekor qilish
    w2 = Msg(555, photo=[Media("PH-2")])
    await B.handle_speaking_submission(w2)
    sub_w2 = FAKE_ROWS["speaking_submissions"][-1]
    fb.sent.clear()
    call_rw = Call(ADMIN, f"reject:{sub_w2['id']}", msg=CallMsg(caption="c"))
    await B.on_reject_tap(call_rw)
    rej = [x["text"] for x in fb.sent if x["chat_id"] == 555]
    check(any("WRITING BEKOR QILINDI" in t for t in rej),
          "writing: bekor qilinsa o'quvchiga WRITING xabari")

    # =========================================================
    # KUNLIK HISOBOT + AVTOMATIK BACKUP (00:00 Toshkent)
    # =========================================================
    from datetime import datetime as _dt, timedelta as _td
    B.supabase = FakeSupa()
    reset_rows()
    today = (_dt.utcnow() + _td(hours=5)).strftime("%Y-%m-%d")
    FAKE_ROWS["attendance"] = [
        {"id": 1, "student_id": 1, "date": today, "status": "present"},
        {"id": 2, "student_id": 2, "date": today, "status": "absent"},
        {"id": 3, "student_id": 3, "date": today, "status": "excused"},
        {"id": 4, "student_id": 1, "date": "2026-01-01", "status": "present"},
    ]
    FAKE_ROWS["grades"] = [
        {"id": 1, "student_id": 1, "date": today, "grade": 9, "category": "", "note": ""},
        {"id": 2, "student_id": 2, "date": "2026-01-01", "grade": 8, "category": "", "note": ""},
    ]
    FAKE_ROWS["speaking_submissions"] = [
        {"id": 1, "student_id": 1, "status": "baholandi", "created_at": today + "T10:00:00Z"},
        {"id": 2, "student_id": 2, "status": "kutilmoqda", "created_at": today + "T11:00:00Z"},
        {"id": 3, "student_id": 3, "status": "kutilmoqda", "created_at": "2026-01-01T10:00:00Z"},
    ]
    FAKE_ROWS["students"][0]["payment_debt"] = 50000
    FAKE_ROWS["students"][1]["payment_debt"] = 0
    FAKE_ROWS["students"][2]["payment_debt"] = 120000

    stats = B.daily_stats()
    check(stats["students"] == 3 and stats["groups"] == 1,
          "hisobot: o'quvchi va guruh soni")
    check(stats["present"] == 1 and stats["absent"] == 2,
          "hisobot: bugungi davomat (1 keldi, 2 qoldirdi)")
    check(stats["grades"] == 1, "hisobot: bugungi baholar soni")
    check(stats["speaking_today"] == 2 and stats["speaking_pending"] == 2,
          "hisobot: speaking bugun topshirilgan/kutilayotgan")
    check(stats["debtors"] == 2, "hisobot: qarzdorlar soni")

    rtext = B.daily_report_text(stats)
    check("Kunlik hisobot" in rtext and "Qatnashgan" in rtext and "qarzdorligi bor" in rtext,
          "hisobot: xabar matni to'liq")

    sent, backups = [], []

    async def _fake_send_message(chat_id, text, **kw):
        sent.append((chat_id, text, kw))

    async def _fake_backup(chat_id):
        backups.append(chat_id)

    orig_send, orig_backup = B.bot.send_message, B.send_backup_document
    B.bot.send_message = _fake_send_message
    B.send_backup_document = _fake_backup
    B._last_report_day = None
    try:
        ok = await B.send_daily_report()
        check(ok and len(sent) == 1 and sent[0][0] == config.ADMIN_ID,
              "hisobot: ADMIN_ID ga yuborildi")
        check(backups == [config.ADMIN_ID], "hisobot: backup fayli ham yuborildi")
        check(await B.send_daily_report() is False and len(sent) == 1,
              "hisobot: kuniga bir marta (takror yuborilmaydi)")
        check(float(B.seconds_until_midnight()) > 0,
              "hisobot: keyingi 00:00 gacha vaqt hisoblanadi")
        B._last_report_day = None
        check(await B.send_daily_report(force=True) and len(sent) == 2,
              "hisobot: force bilan qayta yuboriladi")
    finally:
        B.bot.send_message = orig_send
        B.send_backup_document = orig_backup

    import inspect as _inspect
    _src = _inspect.getsource(B)
    check("asyncio.create_task(daily_report_watcher())" in _src,
          "hisobot: daily_report_watcher fon vazifasi sifatida ro'yxatga olingan")


    import inspect
    src = inspect.getsource(B)
    code_lines = [ln for ln in src.splitlines() if not ln.strip().startswith("#")]
    check(not any("time.sleep(" in ln for ln in code_lines),
          "main: bot.py'da time.sleep() yo'q (event loop bloklanmaydi)")
    check("await bot.delete_webhook(drop_pending_updates=True)" in src,
          "main: pollingdan oldin eski webhook tozalanadi")
    check("allowed_updates=dp.resolve_used_update_types()" in src,
          "main: start_polling allowed_updates bilan ishga tushadi")
    check("await homework_watcher()" not in src and "await voice_watcher()" not in src and
          "await grades_watcher()" not in src and "await messages_watcher()" not in src,
          "main: watcherlar to'g'ridan-to'g'ri await qilinmaydi")
    for wname in ("homework_watcher", "voice_watcher", "grades_watcher", "messages_watcher"):
        check(f"asyncio.create_task({wname}())" in src,
              f"main: {wname} asyncio.create_task orqali fon vazifasi")
    check("bot.get_me()" in src, "main: startdan oldin getMe bilan bot identifikatsiya qilinadi")
    check("DIAGNOSTIKA: POLLING FAOL" in src, "main: polling watchdog (60s heartbeat) mavjud")

    # =========================================================
    print(f"\n{'=' * 50}")
    if failed:
        print(f"RESULT: {failed} FAIL, {passed} ok")
        sys.exit(1)
    print(f"Barcha bot testlar o'tdi ✓ ({passed} ta ok)")
    sys.exit(0)


if __name__ == "__main__":
    asyncio.run(main())
