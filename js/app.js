'use strict';

/* ==================== Telegram WebApp ==================== */
const tg = (window.Telegram && window.Telegram.WebApp) || null;
if (tg) {
  try { tg.ready(); tg.expand(); } catch (e) {}
  try { tg.setHeaderColor && tg.setHeaderColor('secondary_bg_color'); } catch (e) {}
  try { tg.setHeaderTitle && tg.setHeaderTitle('English Tutor'); } catch (e) {}
}
const tgUser = (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) || null;

/* ==================== Yordamchi funksiyalar ==================== */
const $ = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.prototype.slice.call((root || document).querySelectorAll(sel));

const store = {
  get(key, fallback) {
    try { const raw = localStorage.getItem(key); return raw === null ? fallback : JSON.parse(raw); }
    catch (e) { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { warnStorageFull(); return false; }
  },
  del(key) {
    try { localStorage.removeItem(key); } catch (e) {}
  }
};

/* localStorage to'lganda jimgina ma'lumot yo'qotmaslik uchun ogohlantirish */
let _storageWarned = false;
function warnStorageFull() {
  if (_storageWarned) return;
  _storageWarned = true;
  if (window.console) console.warn('[store] localStorage toldi - malumot saqlanmadi');
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = "Xotira to'ldi: ma'lumot saqlanmadi. Iltimos, zaxira oling va eski ma'lumotlarni tozalang.";
  el.className = 'toast show error';
  setTimeout(function () { el.className = 'toast'; }, 6000);
}

const K = {
  accounts: 'et_accounts',
  session: 'et_session',
  groups: 'et_groups',
  students: 'et_students',
  grades: 'et_grades',
  attendance: 'et_attendance',
  speaking: 'et_speaking',
  messages: 'et_messages',
  homework: 'et_homework',
  homeworkDone: 'et_hw_done',
  payments: 'et_payments',
  monthlyFees: 'et_monthly_fees',
  loginFails: 'et_login_fails',
  speakLog: 'et_speak_log',
  tgsubs: 'et_tg_subs',
  sessionId: 'et_session_id',
  cardSettings: 'et_card_settings',
  paymentReceipts: 'et_payment_receipts'
};

/* Toza start: demo guruh/o'quvchi seedlari YO'Q — barcha ma'lumot Supabase'dan keladi.
   Kalitlar bo'sh bo'lsa getterlar [] bilan ishlaydi (getGroups/getStudents/...). */

/* Kirish hisoblari (login → ma'lumot): faqat ustoz; o'quvchilar pullAll'dan quriladi */
let accounts = store.get(K.accounts, null);
if (!accounts || !Object.keys(accounts).length) {
  accounts = {};
  APP_DATA.accounts.forEach(a => {
    accounts[a.login] = { login: a.login, password: a.password, role: a.role, name: a.name, studentId: a.studentId || null };
  });
  store.set(K.accounts, accounts);
}
/* Eski demo ustoz hisobi (admin) butunlay olib tashlanadi — yagona ustoz logini: m_amirov */
if (accounts['admin'] && accounts['admin'].role === 'teacher') {
  delete accounts['admin'];
  store.set(K.accounts, accounts);
}
function persistAccounts() { store.set(K.accounts, accounts); }

/* ==================== XAVFSIZLIK: SHA-256 PAROL XESHLASH ==================== */
/* Brauzerning standart Web Crypto API'si bilan xeshlash (async) */
async function hashPassword(plainText) {
  const enc = new TextEncoder();
  const data = enc.encode(String(plainText == null ? '' : plainText).trim());
  if (window.crypto && window.crypto.subtle && window.crypto.subtle.digest) {
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  return sha256Hex(String(plainText == null ? '' : plainText).trim());
}
/* Sinxron SHA-256 — Web Crypto yo'q muhit va sinxron login tekshiruvi uchun */
function sha256Hex(input) {
  const K = [
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
  ];
  const H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const msg = unescape(encodeURIComponent(String(input == null ? '' : input)));
  const bytes = [];
  for (let i = 0; i < msg.length; i++) bytes.push(msg.charCodeAt(i) & 0xff);
  const bitLen = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  bytes.push(0, 0, 0, 0);
  bytes.push((bitLen >>> 24) & 255, (bitLen >>> 16) & 255, (bitLen >>> 8) & 255, bitLen & 255);
  const rr = (x, n) => (x >>> n) | (x << (32 - n));
  for (let off = 0; off < bytes.length; off += 64) {
    const w = new Array(64);
    for (let t = 0; t < 16; t++) {
      w[t] = (bytes[off + t * 4] << 24) | (bytes[off + t * 4 + 1] << 16) | (bytes[off + t * 4 + 2] << 8) | bytes[off + t * 4 + 3];
    }
    for (let t = 16; t < 64; t++) {
      const s0 = rr(w[t - 15], 7) ^ rr(w[t - 15], 18) ^ (w[t - 15] >>> 3);
      const s1 = rr(w[t - 2], 17) ^ rr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
    }
    let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
    for (let t = 0; t < 64; t++) {
      const S1 = rr(e, 6) ^ rr(e, 11) ^ rr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[t] + w[t]) | 0;
      const S0 = rr(a, 2) ^ rr(a, 13) ^ rr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;
      h = g; g = f; f = e; e = (d + temp1) | 0;
      d = c; c = b; b = a; a = (temp1 + temp2) | 0;
    }
    H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
    H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
  }
  return H.map(x => ((x >>> 0).toString(16).padStart(8, '0'))).join('');
}
function hashPasswordSync(plainText) { return sha256Hex(String(plainText == null ? '' : plainText).trim()); }
function isSha256Hex(v) { return /^[0-9a-f]{64}$/.test(String(v == null ? '' : v)); }
/* Eski ochiq parollar ham qabul qilinadi (orqaga moslik) — yangi parollar faqat xesh */
function passwordMatches(input, stored) {
  const s = String(stored == null ? '' : stored);
  if (!s) return false;
  if (isSha256Hex(s)) return sha256Hex(String(input == null ? '' : input).trim()) === s;
  return s === String(input == null ? '' : input);
}

const state = {
  screen: 'login',
  filterClass: 'Barchasi',
  filterGroup: null,
  search: '',
  toastTimer: null,
  editor: null,
  gradeGroup: '',
  gradeClass: 'Barchasi',
  gradeDate: '',
  weekOffset: 0,
  attGroup: '',
  attDate: '',
  attDraft: null,
  attDraftFor: '',
  speakDate: '',
  slotMode: 'create',
  slotId: '',
  chatSid: null,
  classHint: false,
  loginTimer: null,
  hwNewFiles: [],
  hwAttachments: [],
  payMonth: ''
};

const AUTH_SCREENS = ['login'];
/* Faqat ustoz ruxsat beradigan ekranlar */
const TEACHER_SCREENS = ['groups', 'students', 'debtors', 'payments', 'grades', 'attendance', 'speaking'];


function initials(name) {
  return String(name || '?').trim().split(/\s+/).slice(0, 2).map(w => w.charAt(0)).join('').toUpperCase();
}
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/* ---- Ma'lumot o'uvchilari ---- */
function getGroups() { return store.get(K.groups, []); }

/* ---- Ma'lumotlarni normallashtirish ---- */
function normalizeStudents(list){
  const arr = Array.isArray(list)? list:[];
  return arr.map(st=>{
    const out={...st};
    if(out.speakingDebt==null) out.speakingDebt=0;
    if(out.paymentDebt==null) out.paymentDebt=0;
    if(!Array.isArray(out.audioSubmissions)) out.audioSubmissions=[];
    return out;
  });
}
function getStudents() {
  const raw = store.get(K.students, []);
  const normed = normalizeStudents(raw);
  // sync back if changed
  const changed = JSON.stringify(raw)!==JSON.stringify(normed);
  if(changed) store.set(K.students,normed);
  return normed;
}

function getGrades() { return store.get(K.grades, {}); }
function getAttendance() { return store.get(K.attendance, {}) || {}; }
function getSpeaking() { return store.get(K.speaking, []) || []; }
function getHomework() { return store.get(K.homework, []) || []; }
function getPayments() { return store.get(K.payments, []) || []; }
function getMonthlyFees() { return store.get(K.monthlyFees, []) || []; }
function getTgSubs() { return store.get(K.tgsubs, []) || []; }
function studentById(id) { return getStudents().filter(s => s.id === id)[0] || null; }
function groupById(id) { return getGroups().filter(g => g.id === id)[0] || null; }

/* ---- Sana yordamchilari ---- */
function dateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}
function todayKey() { return dateKey(new Date()); }
function fmtDM(iso) { const p = String(iso).split('-'); return p[2] + '.' + p[1]; }
function fmtDMY(iso) { const p = String(iso).split('-'); return p[2] + '.' + p[1] + '.' + p[0]; }

function lessonDates(groupId, count) {
  const g = groupById(groupId);
  if (!g) return [];
  const names = String(g.days).split(',').map(x => x.trim().split(/\s+/)[0]).filter(Boolean); /* "Dushanba 09:15" → kun nomi */
  const jsDays = names
    .map(n => APP_DATA.days.indexOf(n))
    .filter(i => i >= 0)
    .map(i => (i + 1) % 7); /* APP_DATA.days[0] = Dushanba → getDay() === 1 */

  const out = [];
  const cur = new Date();
  cur.setHours(0, 0, 0, 0);
  let guard = 0;
  while (out.length < count && guard++ < 400) {
    if (jsDays.indexOf(cur.getDay()) >= 0) out.push(dateKey(cur));
    cur.setDate(cur.getDate() - 1);
  }
  return out.reverse();
}

/* Jurnal ustunlari = dars sanalari + baho olgan sanalar (speaking sync uchun) */
function journalDates(groupId, count) {
  const set = {};
  lessonDates(groupId, count).forEach(d => { set[d] = 1; });
  getStudents().filter(s => s.groupId === groupId).forEach(s => {
    Object.keys(getGrades()[s.id] || {}).forEach(d => { set[d] = 1; });
  });
  return Object.keys(set).sort().slice(-count);
}

/* ---- Hafta navigatsiyasi: Dushanba–Yakshanba oralig'idagi dars sanalari ---- */
const UZ_MONTHS_SHORT = ['Yan','Fev','Mar','Apr','May','Iyn','Iyl','Avg','Sen','Okt','Noy','Dek'];
function weekMonday(offset) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dow = today.getDay(); /* 0=Yak, 1=Dush... */
  const toMonday = dow === 0 ? -6 : 1 - dow;
  const mon = new Date(today);
  mon.setDate(today.getDate() + toMonday + (offset || 0) * 7);
  return mon;
}
function weekDates(groupId, offset) {
  const g = groupById(groupId);
  if (!g) return [];
  const names = String(g.days).split(',').map(x => x.trim().split(/\s+/)[0]).filter(Boolean);
  const jsDays = names
    .map(n => APP_DATA.days.indexOf(n))
    .filter(i => i >= 0)
    .map(i => (i + 1) % 7);
  const mon = weekMonday(offset);
  const out = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    if (jsDays.indexOf(d.getDay()) >= 0) out.push(dateKey(d));
  }
  return out;
}
function weekLabel(offset) {
  const mon = weekMonday(offset);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return mon.getDate() + '-' + UZ_MONTHS_SHORT[mon.getMonth()] + ' \u2014 ' +
         sun.getDate() + '-' + UZ_MONTHS_SHORT[sun.getMonth()] + ', ' + sun.getFullYear();
}

/* ---- Baholar hisobi ---- */
function gradeClassOf(v) {
  /* Neytral 10-ballik: rang ierarxiyasi yo'q — toza, minimalistik ko'rinish */
  return v == null ? 'g-empty' : 'g-num';
}
function scoresFor(sid, dates) {
  const rec = getGrades()[sid] || {};
  return dates.map(d => rec[d]).filter(Boolean).map(r => r.score);
}
function avgOf(nums) {
  if (!nums.length) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}
function totalOf(nums) { return nums.reduce((a, b) => a + b, 0); }
function fmtAvg(v) { return v == null ? '—' : v.toFixed(1); }

/* ==================== CLOUD SYNC (Supabase — real jadvallar) ==================== */
const TEACHER_LOGIN = 'm_amirov';
const TEACHER_PASSWORD = '123';
const TEACHER_NAME = 'Muzaffar Amirov';

const CloudSync = (function () {
  const url = window.SUPABASE_URL || 'https://mvjoeqyqaylfccqcnwwe.supabase.co';
  const key = window.SUPABASE_ANON_KEY || 'sb_publishable_PHMC_kfQfu5BLFgDOzHsjw_B0VO2xDI';
  let client = null;
  if (window.supabase && typeof window.supabase.createClient === 'function') {
    try { client = window.supabase.createClient(url, key); } catch (e) { client = null; }
  }

  const ready = function () { return !!client; };
  /* PGRST205/404 — jadval hali yaratilmagan: lokal rejimda davom etamiz */
  const missing = function (e) {
    return !!e && (e.code === 'PGRST205' || /could not find the table|does not exist/i.test(String(e.message || '')));
  };
  let hasMessages = true;
  let hasAudio = true;
  let subscribed = false;
  let notifSubscribed = false;
  /* Bildirishnoma yozadigan jadvallar */
  const NOTIFY_TABLES = ['grades', 'homework', 'students', 'messages', 'speaking_submissions'];
  const gradeTimers = {};

  function bg(p, tag) {
    Promise.resolve(p).catch(function (e) { console.warn('[cloud] ' + tag + ':', (e && e.message) || e); });
  }
  const dbOfSid = function (sid) { const s = studentById(sid); return s && s.dbId != null ? s.dbId : null; };
  const accOfSid = function (sid) {
    return Object.keys(accounts).map(function (k) { return accounts[k]; }).filter(function (a) { return a.studentId === sid; })[0] || null;
  };

  /* Yangi yozuvning bulutdagi id'sini kafolatlaymiz (poyga holatini yopadi) */
  async function ensureDbId(sid) {
    let st = studentById(sid);
    if (!st) return null;
    if (st.dbId == null) {
      await pushStudent(sid);
      st = studentById(sid);
    }
    return st && st.dbId != null ? st.dbId : null;
  }

  function payloadOf(s) {
    const g = groupById(s.groupId);
    const acc = accOfSid(s.id) || {};
    return {
      name: s.fullName,
      school_class: s.schoolClass,
      group_id: g && g.dbId != null ? g.dbId : null,
      login: acc.login || s.login || '',
      password: acc.password || s.password || '',
      speaking_debt: Number(s.speakingDebt) || 0,
      payment_debt: Number(s.paymentDebt) || 0,
      fee_period: s.feePeriod || null,
      last_payment_info: s.lastPaymentInfo || null,
      last_paid_month: s.lastPaidMonth || null,
      voice_allowed: s.voiceAllowed !== false
    };
  }

  /* --- Xabarlar (messages jadvali) --- */
  async function fetchMessages(sid) {
    if (!ready() || !hasMessages) return false;
    try {
      let query = client.from('messages').select('id, student_id, sender, text, created_at').order('created_at', { ascending: true });
      if (sid != null) {
        const dbId = dbOfSid(sid);
        if (dbId == null) return false;
        query = query.eq('student_id', dbId);
      }
      const res = await query;
      if (res.error) { if (missing(res.error)) hasMessages = false; return false; }
      /* Ilova paydo bo'lganda DB qatorlari keshga qayta qo'shilmasin —
         aks holda har bir realtime yangilanishda xabarlar dublikatlanadi. */
      const cache = store.get(K.messages, []).filter(function (m) {
        if (sid != null) {
          if (m.sid !== sid) return false;
          return !(m.id && String(m.id).charAt(0) === 'm');
        }
        /* Umumiy yuklashda bulutga yozilmagan lokal xabarlar saqlanadi */
        return !!(m.id && String(m.id).charAt(0) === 'l');
      });
      res.data.forEach(function (r) {
        cache.push({
          id: 'm' + r.id,
          sid: sid == null ? 's' + r.student_id : sid,
          sender: r.sender,
          text: r.text,
          createdAt: r.created_at
        });
      });
      store.set(K.messages, cache);
      return true;
    } catch (e) { return false; }
  }

  /* --- Uyga vazifalar (homework jadvali; yo'q bo'lsa lokal qoladi) --- */
  let hasHomework = true;
  async function pullHomework() {
    if (!ready() || !hasHomework) return;
    let q = client.from('homework').select('*').order('created_at', { ascending: false });
    const cu = currentUser();
    const own = cu && cu.role === 'student' ? studentById(cu.studentId) : null;
    if (own) {
      const g = groupById(own.groupId);
      if (!g || g.dbId == null) { store.set(K.homework, []); return; }
      q = q.eq('group_id', g.dbId);
    }
    const res = await q;
    if (res.error) {
      if (missing(res.error)) hasHomework = false;
      return;
    }
    const list = res.data.map(function (r) {
      return {
        id: 'h' + r.id,
        dbId: r.id,
        groupId: r.group_id != null ? 'g' + r.group_id : null,
        title: r.title || '',
        description: r.description || '',
        dueDate: r.due_date || '',
        mediaUrl: r.media_url || '',
        mediaType: r.media_type || '',
        attachments: parseAttachments(r.attachments),
        createdAt: r.created_at || ''
      };
    });
    /* bulutga hali yozilmagan lokal vazifalar saqlanadi */
    getHomework().forEach(function (h) { if (h.dbId == null) list.push(h); });
    store.set(K.homework, list);
  }

  async function pushHomework(hw) {
    if (!ready() || !hasHomework) return;
    try {
      let g = groupById(hw.groupId);
      if (g && g.dbId == null) await pushGroup(g);
      g = groupById(hw.groupId);
      const base = {
        group_id: g && g.dbId != null ? g.dbId : null,
        title: hw.title,
        description: hw.description || '',
        due_date: hw.dueDate || null,
        media_url: hw.mediaUrl || null,
        media_type: hw.mediaType || null
      };
      if (base.group_id == null) return;
      const payload = Object.assign({ attachments: hwAttachments(hw) }, base);
      const run = async (p) => (hw.dbId == null)
        ? client.from('homework').insert(p).select()
        : client.from('homework').update(p).eq('id', hw.dbId);
      let res = await run(payload);
      if (res.error && /attachments|schema cache|column/i.test(String(res.error.message || ''))) {
        res = await run(base); /* eski sxema: attachments ustuni yo'q */
      }
      if (res.error) throw res.error;
      if (hw.dbId == null) hw.dbId = res.data[0].id;
      const list = getHomework();
      const t = list.filter(function (x) { return x.id === hw.id; })[0];
      if (t) { t.dbId = hw.dbId; store.set(K.homework, list); }
    } catch (e) {
      if (e && (e.code === 'PGRST205' || /homework/.test(String(e.message || '')) && /schema cache|does not exist/.test(String(e.message || '')))) hasHomework = false;
      console.warn('[cloud] homework:', (e && e.message) || e);
    }
  }

  /* --- Telegram speaking topshiriklari (speaking_submissions) --- */
  let hasTg = true;
  async function pullSpeaking() {
    if (!ready() || !hasTg) return;
    let q = client.from('speaking_submissions').select('*').order('created_at', { ascending: true });
    const cu = currentUser();
    const own = cu && cu.role === 'student' ? studentById(cu.studentId) : null;
    if (own) {
      if (own.dbId == null) return;
      q = q.eq('student_id', own.dbId);
    }
    const res = await q;
    if (res.error) {
      if (missing(res.error)) hasTg = false;
      return;
    }
    const list = res.data.map(function (r) {
      return {
        id: 't' + r.id,
        dbId: r.id,
        sid: 's' + r.student_id,
        mediaType: r.media_type || 'voice',
        status: r.status || 'kutilmoqda',
        score: r.score == null ? null : Number(r.score),
        feedback: r.feedback || '',
        createdAt: r.created_at || ''
      };
    }).filter(function (x) { return x.sid !== 'snull'; });
    store.set(K.tgsubs, list);
  }

  async function pushSpeakingGrade(localId) {
    if (!ready() || !hasTg) return;
    const sub = store.get(K.tgsubs, []).filter(function (x) { return x.id === localId; })[0];
    if (!sub || sub.dbId == null) return;
    const payload = { status: sub.status, score: sub.score, feedback: sub.feedback || '' };
    try {
      let res = await client.from('speaking_submissions').update(payload).eq('id', sub.dbId);
      if (res.error && res.error.code === 'PGRST204') {
        /* feedback ustuni hali yo'q — faqat status/baho bilan yozamiz */
        delete payload.feedback;
        res = await client.from('speaking_submissions').update(payload).eq('id', sub.dbId);
      }
      if (res.error) throw res.error;
    } catch (e) {
      if (e && e.code === 'PGRST205') hasTg = false;
      console.warn('[cloud] speaking grade:', (e && e.message) || e);
    }
  }

  /* --- Ustoz paroli: Supabase bot_settings (key: 'teacher_password') --- */
  let hasSettings = true;
  async function pullTeacherPassword() {
    if (!ready() || !hasSettings) return null;
    try {
      const res = await client.from('bot_settings')
        .select('value').eq('key', 'teacher_password').limit(1);
      if (res.error) {
        if (missing(res.error)) hasSettings = false;
        return null;
      }
      return res.data && res.data.length ? (res.data[0].value || null) : null;
    } catch (e) { return null; }
  }

  async function pushTeacherPassword(pass) {
    if (!ready() || !hasSettings) return;
    try {
      let res = await client.from('bot_settings')
        .update({ value: pass }).eq('key', 'teacher_password').select('key');
      if (res.error) {
        if (missing(res.error)) { hasSettings = false; return; }
        throw res.error;
      }
      if (!res.data || !res.data.length) {
        /* qator hali yo'q — yangi qator sifatida qo'shamiz */
        res = await client.from('bot_settings')
          .insert({ key: 'teacher_password', value: pass }).select('key');
        if (res.error) {
          if (missing(res.error)) hasSettings = false;
          else throw res.error;
        }
      }
    } catch (e) {
      console.warn('[cloud] teacher password:', (e && e.message) || e);
    }
  }

  /* --- Bulutdan tortib olish ---
     Ustoz: barcha jadvallar. O'quvchi: FAQAT o'z ma'lumotlari —
     boshqa o'quvchilarning parollari/ma'lumotlari brauzerga tushmaydi. --- */
  async function pullAll(loginHint) {
    if (!ready()) return false;
    const hint = String(loginHint || '').trim().toLowerCase();
    if (hint && hint !== TEACHER_LOGIN) return pullStudent(hint);
    try {
      /* Toza start: bo'sh bazaga demo ma'lumot SEED QILINMAYDI — ustoz o'zi qo'shadi */
      const gRes = await client.from('groups').select('*');
      const sRes = await client.from('students').select('*');
      if (gRes.error || sRes.error) return false;
      const grRes = await client.from('grades').select('id, student_id, date, grade, category, note');
      const atRes = await client.from('attendance').select('student_id, date, status');
      if (grRes.error || atRes.error) return false;

      const prev = getStudents();
      const newIdByOld = {}, oldIdByDb = {}, audioByOld = {};
      prev.forEach(function (st) {
        if (st.dbId == null) return;
        newIdByOld[st.id] = 's' + st.dbId;
        oldIdByDb[st.dbId] = st.id;
        if (st.audioSubmissions && st.audioSubmissions.length) audioByOld[st.id] = st.audioSubmissions;
      });

      const groups = gRes.data.map(function (r) {
        return { id: 'g' + r.id, dbId: r.id, name: r.name, days: r.days, time: r.time, monthlyFee: Number(r.monthly_fee) || 0, groupType: r.group_type === 'school' ? 'school' : 'tutoring' };
      });
      const students = sRes.data.map(function (r) {
        return {
          id: 's' + r.id,
          dbId: r.id,
          fullName: r.name,
          schoolClass: r.school_class,
          groupId: r.group_id != null ? 'g' + r.group_id : null,
          login: r.login || '',
          password: r.password || '',
          speakingDebt: Number(r.speaking_debt) || 0,
          paymentDebt: Number(r.payment_debt) || 0,
          feePeriod: r.fee_period || '',
          telegramChatId: r.telegram_chat_id == null ? null : Number(r.telegram_chat_id),
          voiceAllowed: r.voice_allowed !== false,
          lastDevice: r.last_device || '',
          lastSeen: r.last_seen || null,
          lastPaymentInfo: r.last_payment_info || '',
          lastPaidMonth: r.last_paid_month || '',
          audioSubmissions: (audioByOld[oldIdByDb[r.id]] || []).slice()
        };
      });

      /* Hali bulutga yozilmagan lokal guruh/o'quvchilar yo'qolmaydi */
      getGroups().forEach(function (g) { if (g.dbId == null) groups.push(g); });
      prev.forEach(function (st) { if (st.dbId == null) students.push(st); });

      const grades = {};
      grRes.data.forEach(function (r) {
        const sid = 's' + r.student_id;
        grades[sid] = grades[sid] || {};
        grades[sid][r.date] = { score: r.grade, category: r.category || 'Darsdagi javob', note: r.note || '' };
      });
      const attendance = {};
      atRes.data.forEach(function (r) {
        attendance[r.date] = attendance[r.date] || {};
        attendance[r.date]['s' + r.student_id] = r.status;
      });

      /* Bulutda hali yo'q, lokalda mavjud baho/davomat sanalari saqlanadi */
      const localGrades = getGrades();
      Object.keys(localGrades).forEach(function (lsid) {
        Object.keys(localGrades[lsid] || {}).forEach(function (d) {
          grades[lsid] = grades[lsid] || {};
          if (!grades[lsid][d]) grades[lsid][d] = localGrades[lsid][d];
        });
      });
      const localAtt = getAttendance();
      Object.keys(localAtt).forEach(function (d) {
        attendance[d] = attendance[d] || {};
        Object.keys(localAtt[d] || {}).forEach(function (lsid) {
          if (!attendance[d][lsid]) attendance[d][lsid] = localAtt[d][lsid];
        });
      });

      store.set(K.groups, groups);
      store.set(K.students, students);
      store.set(K.grades, grades);
      store.set(K.attendance, attendance);
      await pullPayments();
      applyMonthlyFees();

      /* speaking slotlari: eski lokal id → yangi id */
      const slots = getSpeaking();
      let slotChanged = false;
      slots.forEach(function (x) {
        if (x.studentId && newIdByOld[x.studentId] && newIdByOld[x.studentId] !== x.studentId) {
          x.studentId = newIdByOld[x.studentId];
          slotChanged = true;
        }
      });
      if (slotChanged) store.set(K.speaking, slots);

      /* hisoblar: ustoz (m_amirov) + jadvaldagi login/parollar */
      const next = {};
      next[TEACHER_LOGIN] = { login: TEACHER_LOGIN, password: TEACHER_PASSWORD, role: 'teacher', name: TEACHER_NAME, studentId: null };
      students.forEach(function (st) {
        if (st.login) next[st.login] = { login: st.login, password: st.password || '', role: 'student', studentId: st.id, name: st.fullName };
      });
      accounts = next;
      persistAccounts();

      await fetchMessages(null);
      try { await pullSlots(null); } catch (e) { /* speaking_slots yo'q */ }
      try { await pullMonthlyFees(); } catch (e) { /* monthly_fees yo'q */ }
      try { await pullHomework(); } catch (e) { /* homework jadvali yo'q */ }
      try { await pullCardSettings(); } catch (e) { /* bot_settings yo'q */ }
      try { await pullSpeaking(); } catch (e) { /* speaking_submissions yo'q */ }
      /* Ustoz paroli — bot_settings ('teacher_password') dan o'qiladi */
      let teachPw = null;
      try { teachPw = await pullTeacherPassword(); } catch (e) { /* bot_settings yo'q */ }
      next[TEACHER_LOGIN].password = teachPw || TEACHER_PASSWORD;
      persistAccounts();
      return true;
    } catch (e) {
      console.warn('[cloud] pull:', (e && e.message) || e);
      return false;
    }
  }

  /* --- O'quvchi: faqat o'z qatori, baholari, davomati, xabarlari --- */
  async function pullStudent(login) {
    const sRes = await client.from('students').select('*').ilike('login', login).limit(1);
    if (sRes.error || !sRes.data || !sRes.data.length) return false;
    const row = sRes.data[0];
    const dbId = row.id;

    const groups = [];
    if (row.group_id != null) {
      const gRes = await client.from('groups').select('*').eq('id', row.group_id).limit(1);
      if (!gRes.error && gRes.data && gRes.data[0]) {
        const g = gRes.data[0];
        groups.push({ id: 'g' + g.id, dbId: g.id, name: g.name, days: g.days, time: g.time, monthlyFee: Number(g.monthly_fee) || 0, groupType: g.group_type === 'school' ? 'school' : 'tutoring' });
      }
    }

    const grRes = await client.from('grades').select('id, student_id, date, grade, category, note').eq('student_id', dbId);
    if (grRes.error) return false;
    const atRes = await client.from('attendance').select('student_id, date, status').eq('student_id', dbId);
    if (atRes.error) return false;

    const prevSt = getStudents().filter(function (x) { return x.dbId === dbId; })[0];
    const students = [{
      id: 's' + dbId,
      dbId: dbId,
      fullName: row.name,
      schoolClass: row.school_class,
      groupId: row.group_id != null ? 'g' + row.group_id : null,
      login: row.login || '',
      password: row.password || '',
      speakingDebt: Number(row.speaking_debt) || 0,
      paymentDebt: Number(row.payment_debt) || 0,
      feePeriod: row.fee_period || '',
      telegramChatId: row.telegram_chat_id == null ? null : Number(row.telegram_chat_id),
      voiceAllowed: row.voice_allowed !== false,
      lastDevice: row.last_device || '',
      lastSeen: row.last_seen || null,
      audioSubmissions: prevSt && prevSt.audioSubmissions ? prevSt.audioSubmissions.slice() : []
    }];

    const grades = {};
    grRes.data.forEach(function (r) {
      grades['s' + dbId] = grades['s' + dbId] || {};
      grades['s' + dbId][r.date] = { score: r.grade, category: r.category || 'Darsdagi javob', note: r.note || '' };
    });
    const attendance = {};
    atRes.data.forEach(function (r) {
      attendance[r.date] = attendance[r.date] || {};
      attendance[r.date]['s' + dbId] = r.status;
    });

    store.set(K.groups, groups);
    store.set(K.students, students);
    store.set(K.grades, grades);
    store.set(K.attendance, attendance);
    await pullPayments(dbId);

    /* xabarlar — faqat o'z suhbati */
    const mRes = await client.from('messages').select('id, student_id, sender, text, created_at')
      .eq('student_id', dbId).order('created_at', { ascending: true });
    if (!mRes.error) {
      store.set(K.messages, (mRes.data || []).map(function (r) {
        return { id: 'm' + r.id, sid: 's' + dbId, sender: r.sender, text: r.text, createdAt: r.created_at };
      }));
    }

    /* speaking topshiriklari — faqat o'ziniki */
    const tRes = await client.from('speaking_submissions').select('*')
      .eq('student_id', dbId).order('created_at', { ascending: true });
    if (!tRes.error) {
      store.set(K.tgsubs, (tRes.data || []).map(function (r) {
        return {
          id: 't' + r.id, dbId: r.id, sid: 's' + dbId,
          mediaType: r.media_type || 'voice', status: r.status || 'kutilmoqda',
          score: r.score == null ? null : Number(r.score),
          feedback: r.feedback || '', createdAt: r.created_at || ''
        };
      }));
    }

    /* uyga vazifalar — faqat o'z guruhi */
    if (row.group_id != null) {
      const hwRes = await client.from('homework').select('*')
        .eq('group_id', row.group_id).order('created_at', { ascending: false });
      if (!hwRes.error) {
        store.set(K.homework, (hwRes.data || []).map(function (r) {
          return {
            id: 'h' + r.id, dbId: r.id, groupId: 'g' + r.group_id,
            title: r.title || '', description: r.description || '',
            dueDate: r.due_date || '', mediaUrl: r.media_url || '', mediaType: r.media_type || '',
            createdAt: r.created_at || ''
          };
        }));
      }
    } else {
      store.set(K.homework, []);
    }

    try { await pullSlots(dbId); } catch (e) { /* speaking_slots yo'q */ }
    try { await pullMonthlyFees(row.group_id); } catch (e) { /* monthly_fees yo'q */ }
    try { await pullCardSettings(); } catch (e) { /* bot_settings yo'q */ }
    try { await pullStudentReceipts(dbId); } catch (e) { /* payment_receipts yo'q */ }

    /* hisoblar: faqat shu o'quvchi (ustoz paroli o'quvchi brauzeriga tushmaydi) */
    const key = String(row.login || '').toLowerCase();
    const next = {};
    if (key) next[key] = { login: key, password: row.password || '', role: 'student', studentId: 's' + dbId, name: row.name };
    accounts = next;
    persistAccounts();
    return true;
  }

  /* --- Yozish: guruh / o'quvchi / qarz / baho / davomat / audio / xabar --- */
  async function pushGroup(g) {
    if (!ready()) return;
    try {
      const base = { name: g.name, days: g.days, time: g.time, monthly_fee: Number(g.monthlyFee) || 0 };
      const withType = Object.assign({ group_type: groupTypeOf(g) }, base);
      const run = async (p) => (g.dbId == null)
        ? client.from('groups').insert(p).select()
        : client.from('groups').update(p).eq('id', g.dbId);
      let res = await run(withType);
      /* group_type ustuni hali qo'shilmagan bo'lsa — eski sxema bilan yozamiz */
      if (res.error && /group_type|schema cache|does not exist|column/i.test(String(res.error.message || ''))) {
        res = await run(base);
      }
      if (res.error) throw res.error;
      if (g.dbId == null) g.dbId = res.data[0].id;
      const list = getGroups();
      const t = list.filter(function (x) { return x.id === g.id; })[0];
      if (t) { t.dbId = g.dbId; store.set(K.groups, list); }
    } catch (e) { console.warn('[cloud] group:', (e && e.message) || e); }
  }

  async function pushStudent(sid) {
    if (!ready()) return;
    const st = studentById(sid);
    if (!st) return;
    try {
      /* Yangi guruh hali bulutda bo'lmasa — avval guruh yoziladi */
      const g = groupById(st.groupId);
      if (g && g.dbId == null) await pushGroup(g);
      const payload = payloadOf(st);
      if (st.dbId == null) {
        const res = await client.from('students').insert(payload).select();
        if (res.error) throw res.error;
        const list = getStudents();
        const t = list.filter(function (x) { return x.id === sid; })[0];
        if (t) { t.dbId = res.data[0].id; store.set(K.students, list); }
      } else {
        let res = await client.from('students').update(payload).eq('id', st.dbId);
        if (res.error && res.error.code === 'PGRST204' && 'voice_allowed' in payload) {
          /* voice_allowed ustuni hali yaratilmagan — undan tashqari yozamiz */
          delete payload.voice_allowed;
          res = await client.from('students').update(payload).eq('id', st.dbId);
        }
        if (res.error) throw res.error;
      }
    } catch (e) { console.warn('[cloud] student:', (e && e.message) || e); }
  }

  async function pushDebt(sid) {
    if (!ready()) return;
    const st = studentById(sid);
    if (!st) return;
    const dbId = await ensureDbId(sid);
    if (dbId == null) return;
    const res = await client.from('students').update({ speaking_debt: Number(st.speakingDebt) || 0 }).eq('id', dbId);
    if (res.error) throw res.error;
  }

  /* Qarzni bulutdagi ENG YANGI qiymatdan o'zgartiradi (eski lokal qiymat
     botning kamaytirishini bosib ketmasligi uchun) */
  async function adjustDebt(sid, delta) {
    if (!ready()) return;
    const dbId = await ensureDbId(sid);
    if (dbId == null) return;
    try {
      const cur = await client.from('students').select('speaking_debt').eq('id', dbId).limit(1);
      if (cur.error) throw cur.error;
      const now = Number((cur.data && cur.data[0] && cur.data[0].speaking_debt) || 0);
      const next = Math.max(0, now + (Number(delta) || 0));
      const res = await client.from('students').update({ speaking_debt: next }).eq('id', dbId);
      if (res.error) throw res.error;
      const list = getStudents();
      const st = list.filter(function (x) { return x.id === sid; })[0];
      if (st) { st.speakingDebt = next; store.set(K.students, list); }
    } catch (e) { console.warn('[cloud] debt:', (e && e.message) || e); }
  }

  async function doPushGrade(sid, date) {
    /* Yangi o'quvchining dbId'si hali yo'q bo'lsa — avval uni yozamiz */
    const dbId = await ensureDbId(sid);
    if (dbId == null) return;
    const rec = (getGrades()[sid] || {})[date];
    const del = await client.from('grades').delete().eq('student_id', dbId).eq('date', date);
    if (del.error) throw del.error;
    if (!rec) return;
    const ins = await client.from('grades').insert({
      student_id: dbId, date: date, grade: rec.score,
      category: rec.category || 'Darsdagi javob', note: rec.note || ''
    });
    if (ins.error) throw ins.error;
  }

  function pushGrade(sid, date) {
    if (!ready()) return;
    /* izoh yozilganda har harf uchun so'ralmasligi uchun debounce */
    const k = sid + '|' + date;
    clearTimeout(gradeTimers[k]);
    gradeTimers[k] = setTimeout(function () { bg(doPushGrade(sid, date), 'grade'); }, 500);
  }

  async function pushAttendance(date, sids) {
    if (!ready()) return;
    const ids = [], rows = [];
    /* takroriy sidlar dublikat qatorlar keltirmasligi uchun unique qilamiz */
    const unique = Array.from(new Set(sids || []));
    for (let i = 0; i < unique.length; i++) {
      const sid = unique[i];
      const dbId = await ensureDbId(sid);
      if (dbId == null) continue;
      ids.push(dbId);
      const status = (getAttendance()[date] || {})[sid];
      if (status) rows.push({ student_id: dbId, date: date, status: status });
    }
    if (!ids.length) return;
    const del = await client.from('attendance').delete().eq('date', date).in('student_id', ids);
    if (del.error) throw del.error;
    if (rows.length) {
      const ins = await client.from('attendance').insert(rows);
      if (ins.error) throw ins.error;
    }
  }

  async function sendMessage(sid, sender, text) {
    const msg = { id: 'l' + Date.now() + Math.random().toString(36).slice(2, 7), sid: sid, sender: sender, text: text, createdAt: new Date().toISOString() };
    const cache = store.get(K.messages, []);
    cache.push(msg);
    store.set(K.messages, cache);
    if (!ready() || !hasMessages) return msg;
    const dbId = await ensureDbId(sid);
    if (dbId == null) return msg;
    try {
      const res = await client.from('messages').insert({ student_id: dbId, sender: sender, text: text }).select();
      if (res.error) { if (missing(res.error)) hasMessages = false; return msg; }
      const c = store.get(K.messages, []);
      const i = c.findIndex(function (m) { return m.id === msg.id; });
      if (i >= 0) {
        c[i] = { id: 'm' + res.data[0].id, sid: sid, sender: sender, text: text, createdAt: res.data[0].created_at };
        store.set(K.messages, c);
      }
      updateChatView();
    } catch (e) { console.warn('[cloud] msg:', (e && e.message) || e); }
    return msg;
  }

  /* --- O'chirish: bog'liq qatorlar bilan birga --- */
  async function deleteStudent(dbId) {
    if (!ready() || dbId == null) return;
    /* bog'liq qatorlar avval (FK cascade bo'lmasa ham xavfsiz) */
    if (hasMessages) {
      const r = await client.from('messages').delete().eq('student_id', dbId);
      if (r.error) { if (missing(r.error)) hasMessages = false; else throw r.error; }
    }
    if (hasAudio) {
      const r = await client.from('audio_submissions').delete().eq('student_id', dbId);
      if (r.error) { if (missing(r.error)) hasAudio = false; else throw r.error; }
    }
    const g = await client.from('grades').delete().eq('student_id', dbId);
    if (g.error) throw g.error;
    const a = await client.from('attendance').delete().eq('student_id', dbId);
    if (a.error) throw a.error;
    const st = await client.from('students').delete().eq('id', dbId);
    if (st.error) throw st.error;
  }

  async function deleteGroup(dbId) {
    if (!ready() || dbId == null) return;
    /* avval o'quvchilarni guruhdan uzamiz (FK) */
    const up = await client.from('students').update({ group_id: null }).eq('group_id', dbId);
    if (up.error) throw up.error;
    const del = await client.from('groups').delete().eq('id', dbId);
    if (del.error) throw del.error;
  }

  /* --- Uyga vazifani o'chirish: avval Storage'dagi fayl, keyin jadval qatori ---
     media_url berilsa, fayl yo'li ajratib olinadi va ikkala bucket nomi bilan
     o'chirishga uriniladi — og'ir video/audio xotirada axlat bo'lib qolmaydi. */
  async function deleteHomework(dbId, mediaUrls) {
    if (!ready()) return;
    const urls = (Array.isArray(mediaUrls) ? mediaUrls : [mediaUrls])
      .map(function (u) { return String(u || ''); }).filter(Boolean);
    for (let u = 0; u < urls.length; u++) {
      const found = mediaPath(urls[u]);
      const rawPath = urls[u].split('?')[0];
      const filePath = found && found.path ? found.path : rawPath.split('/').pop();
      const buckets = found
        ? [found.bucket].concat(MEDIA_BUCKETS.filter(function (b) { return b !== found.bucket; }))
        : MEDIA_BUCKETS;
      if (!filePath) continue;
      for (let i = 0; i < buckets.length; i++) {
        try {
          const rm = await client.storage.from(buckets[i]).remove([filePath]);
          if (!rm.error) break;
        } catch (e) {
          console.warn('[cloud] hw media del (' + buckets[i] + '):', (e && e.message) || e);
        }
      }
    }
    if (!hasHomework || dbId == null) return;
    const res = await client.from('homework').delete().eq('id', dbId);
    if (res.error) throw res.error;
  }

  /* --- homework media (Supabase Storage): faqat sayt yuklaydi/o'chiradi ---
     Bucket nomi 'homework-media' yoki 'homework_media' bo'lishi mumkin:
     ikkalasi ham qo'llab-quvvatlanadi, birinchisidan boshlab urinib ko'riladi. */
  const MEDIA_BUCKETS = ['homework-media', 'homework_media'];
  const MEDIA_BUCKET = MEDIA_BUCKETS[0];
  function mediaPath(url) {
    const raw = String(url || '');
    for (let i = 0; i < MEDIA_BUCKETS.length; i++) {
      const bucket = MEDIA_BUCKETS[i];
      const marker = '/storage/v1/object/public/' + bucket + '/';
      const at = raw.indexOf(marker);
      if (at >= 0) {
        return { bucket: bucket, path: decodeURIComponent(raw.slice(at + marker.length).split('?')[0]) };
      }
    }
    return null;
  }
  async function uploadHomeworkMedia(file) {
    if (!ready()) throw new Error('Supabase sozlanmagan');
    const ext = String((file && file.name) || '').split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
    const path = 'hw/' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + '.' + ext;
    let lastErr = null;
    for (let i = 0; i < MEDIA_BUCKETS.length; i++) {
      const bucket = MEDIA_BUCKETS[i];
      try {
        const res = await client.storage.from(bucket).upload(path, file, {
          cacheControl: '3600', upsert: false, contentType: (file && file.type) || undefined
        });
        if (res.error) throw res.error;
        const pub = client.storage.from(bucket).getPublicUrl(path);
        return { url: pub.data.publicUrl, path: path, bucket: bucket };
      } catch (e) {
        lastErr = e;
        console.warn('[cloud] media upload (' + bucket + '):', (e && e.message) || e);
      }
    }
    throw lastErr || new Error('Storage bucket topilmadi');
  }
  async function removeHomeworkMedia(url) {
    const found = mediaPath(url);
    if (!found || !found.path) return;
    /* Avval URL'dagi bucket, keyin ikkinchi nom sinaladi */
    const order = [found.bucket].concat(MEDIA_BUCKETS.filter(function (b) { return b !== found.bucket; }));
    for (let i = 0; i < order.length; i++) {
      try {
        const res = await client.storage.from(order[i]).remove([found.path]);
        if (!res.error) return;
      } catch (e) { console.warn('[cloud] media del (' + order[i] + '):', (e && e.message) || e); }
    }
  }

  /* --- telegram_outbox: sayt yozadi, bot yuboradi (chek / eslatma) --- */
  async function queueMessages(rows) {
    if (!ready() || !rows || !rows.length) return [];
    let res = await client.from('telegram_outbox').insert(rows).select('id');
    if (res.error && /student_id|schema cache|column/i.test(String(res.error.message || ''))) {
      /* student_id ustuni hali ochilmagan bo'lsa — faqat chat_id, text, status bilan xatosiz yozadi */
      const cleanRows = rows.map(function (r) {
        return { chat_id: String(r.chat_id || ''), text: String(r.text || ''), status: r.status || 'pending' };
      });
      res = await client.from('telegram_outbox').insert(cleanRows).select('id');
    }
    if (res.error) throw res.error;
    return (res.data || []).map(function (r) { return r.id; });
  }
  async function messageStatus(ids) {
    if (!ready() || !ids || !ids.length) return [];
    const res = await client.from('telegram_outbox').select('id, status').in('id', ids);
    if (res.error) throw res.error;
    return res.data || [];
  }

  /* --- monthly_fees: guruh uchun oyiga alohida to'lov summasi --- */
  async function pullMonthlyFees(groupDbId) {
    if (!ready()) return;
    try {
      let q = client.from('monthly_fees').select('*');
      if (groupDbId != null) q = q.eq('group_id', groupDbId);
      const res = await q;
      if (res.error) return;
      const rows = (res.data || []).map(function (r) {
        return { id: 'mf' + r.id, dbId: r.id, gid: 'g' + r.group_id,
                 period: r.period || '', amount: Number(r.amount) || 0 };
      });
      if (groupDbId != null) {
        const keep = getMonthlyFees().filter(function (x) { return x.gid !== 'g' + groupDbId; });
        store.set(K.monthlyFees, keep.concat(rows));
      } else {
        store.set(K.monthlyFees, rows);
      }
    } catch (e) { /* monthly_fees jadvali hali yaratilmagan */ }
  }

  async function saveMonthlyFee(gid, period, amount) {
    const g = groupById(gid);
    const per = String(period || '').slice(0, 7);
    const sum = Math.max(0, Math.round(Number(amount) || 0));
    if (!g || !/^\d{4}-\d{2}$/.test(per) || !sum) return false;
    const list = getMonthlyFees().filter(function (x) { return !(x.gid === gid && x.period === per); });
    const row = { id: 'mf' + Date.now(), dbId: null, gid: gid, period: per, amount: sum };
    list.push(row);
    store.set(K.monthlyFees, list);
    if (!ready() || g.dbId == null) return true;
    try {
      const res = await client.from('monthly_fees')
        .upsert({ group_id: g.dbId, period: per, amount: sum }, { onConflict: 'group_id,period' })
        .select();
      if (res.error) throw res.error;
      if (res.data && res.data[0]) row.dbId = res.data[0].id;
      store.set(K.monthlyFees, getMonthlyFees());
    } catch (e) { console.warn('[cloud] monthly fee:', (e && e.message) || e); }
    return true;
  }

  async function deleteMonthlyFee(gid, period) {
    store.set(K.monthlyFees, getMonthlyFees().filter(function (x) { return !(x.gid === gid && x.period === period); }));
    const g = groupById(gid);
    if (!ready() || !g || g.dbId == null) return;
    try {
      const res = await client.from('monthly_fees').delete().eq('group_id', g.dbId).eq('period', period);
      if (res.error) throw res.error;
    } catch (e) { console.warn('[cloud] monthly fee del:', (e && e.message) || e); }
  }

  /* --- payments: to'lovlar tarixi --- */
  async function pullPayments(dbId) {
    if (!ready()) return;
    try {
      let q = client.from('payments').select('*').order('created_at', { ascending: true });
      if (dbId != null) q = q.eq('student_id', dbId);
      const res = await q;
      if (res.error) return;
      store.set(K.payments, (res.data || []).map(function (r) {
        return {
          id: 'p' + r.id, dbId: r.id, sid: 's' + r.student_id,
          amount: Number(r.amount) || 0, note: r.note || '',
          period: r.period || String(r.created_at || '').slice(0, 7),
          createdAt: r.created_at || ''
        };
      }));
    } catch (e) { /* payments jadvali hali yaratilmagan */ }
  }

  async function addPayment(sid, dbId, amount, note, period) {
    const per = period || new Date().toISOString().slice(0, 7);
    const local = {
      id: 'p' + Date.now(), dbId: null, sid: sid,
      amount: Number(amount) || 0, note: note || '', period: per,
      createdAt: new Date().toISOString()
    };
    const list = getPayments(); list.push(local); store.set(K.payments, list);
    if (!ready() || dbId == null) return local;
    try {
      let res = await client.from('payments')
        .insert({ student_id: dbId, amount: Number(amount) || 0, note: note || '', period: per }).select();
      if (res.error && /period|schema cache|column/i.test(String(res.error.message || ''))) {
        /* period ustuni hali qo'shilmagan — eski sxema bilan */
        res = await client.from('payments')
          .insert({ student_id: dbId, amount: Number(amount) || 0, note: note || '' }).select();
      }
      if (res.error) throw res.error;
      if (res.data && res.data[0]) {
        local.dbId = res.data[0].id;
        store.set(K.payments, getPayments());
      }
    } catch (e) { console.warn('[cloud] payment:', (e && e.message) || e); }
    return local;
  }

  /* --- Zaxira: jadvallarni olish / qayta tiklash --- */
  const BACKUP_TABLES = ['groups', 'students', 'attendance', 'grades', 'messages', 'speaking_submissions',
    'audio_submissions', 'homework', 'speaking_slots', 'payments'];

  async function fetchBackup() {
    if (!ready()) return null;
    const out = {};
    for (let i = 0; i < BACKUP_TABLES.length; i++) {
      const t = BACKUP_TABLES[i];
      try {
        const res = await client.from(t).select('*');
        if (res.error) {
          if (missing(res.error)) { out[t] = []; continue; }
          console.warn('[cloud] backup ' + t + ':', res.error.message);
          return null;
        }
        out[t] = res.data;
      } catch (e) {
        console.warn('[cloud] backup ' + t + ':', (e && e.message) || e);
        return null;
      }
    }
    return out;
  }

  async function restoreBackup(data) {
    if (!ready() || !data) return false;
    try {
      /* 1) avval bog'liq qatorlar, keyin asosiy jadvallar (FK uchun) */
      const delOrder = ['messages', 'grades', 'attendance', 'speaking_submissions', 'audio_submissions',
        'homework', 'speaking_slots', 'payments', 'students', 'groups'];
      for (let i = 0; i < delOrder.length; i++) {
        const res = await client.from(delOrder[i]).delete().gte('id', 0);
        if (res.error && !missing(res.error)) throw res.error;
      }
      /* 2) zaxiradan qayta yozish (ID saqlanadi) */
      const plan = [
        ['groups', ['id', 'name', 'days', 'time']],
        ['students', ['id', 'name', 'school_class', 'group_id', 'login', 'password', 'speaking_debt',
                      'voice_allowed', 'telegram_chat_id', 'last_device', 'last_seen']],
        ['speaking_slots', ['id', 'date', 'start_time', 'end_time', 'student_id', 'score', 'created_at']],
        ['homework', ['id', 'group_id', 'title', 'description', 'due_date', 'created_at']],
        ['attendance', ['id', 'student_id', 'date', 'status']],
        ['grades', ['id', 'student_id', 'date', 'grade', 'category', 'note']],
        ['messages', ['id', 'student_id', 'sender', 'text', 'created_at']],
        ['speaking_submissions', ['id', 'student_id', 'media_type', 'telegram_file_id', 'status', 'score', 'feedback', 'created_at']],
        ['audio_submissions', ['id', 'student_id', 'date', 'url', 'status', 'score', 'feedback', 'created_at']]
      ];
      const groupIds = {};
      (data.groups || []).forEach(g => { const n = toNumId(g && g.id); if (n != null) groupIds[n] = 1; });
      const studentIds = {};
      (data.students || []).forEach(x => { const n = toNumId(x && x.id); if (n != null) studentIds[n] = 1; });

      for (let i = 0; i < plan.length; i++) {
        const t = plan[i][0], cols = plan[i][1];
        const rows = [];
        (data[t] || []).forEach(r => {
          if (!r || typeof r !== 'object') return;
          const row = {};
          cols.forEach(c => { if (r[c] !== undefined) row[c] = r[c]; });
          if ('id' in row) { const n = toNumId(row.id); if (n == null) delete row.id; else row.id = n; }
          if ('group_id' in row && row.group_id != null) {
            const n = toNumId(row.group_id);
            row.group_id = n != null && groupIds[n] ? n : null;
          }
          if ('student_id' in row) {
            if (row.student_id == null && t === 'speaking_slots') {
              /* tayinlanmagan slot — bo'sh qoladi */
            } else {
              const n = toNumId(row.student_id);
              if (n == null || !studentIds[n]) return; /* yo'q o'quvchiga bog'langan qator — tashlanadi */
              row.student_id = n;
            }
          }
          rows.push(row);
        });
        if (!rows.length) continue;
        const res = await client.from(t).insert(rows);
        if (res.error) {
          if (missing(res.error)) continue;
          throw res.error;
        }
      }
      return true;
    } catch (e) {
      console.warn('[cloud] restore:', (e && e.message) || e);
      return false;
    }
  }

  /* --- Tozalash: bitta jadvaldagi barcha qatorlarni o'chirish --- */
  async function clearTable(tableKey) {
    if (!ready()) return true; /* lokal rejimda lokal tozalash yetarli */
    const tables = tableKey === 'speaking_submissions'
      ? ['speaking_submissions', 'audio_submissions']
      : [tableKey];
    try {
      for (let i = 0; i < tables.length; i++) {
        const res = await client.from(tables[i]).delete().gte('id', 0);
        if (res.error && !missing(res.error)) throw res.error;
      }
      return true;
    } catch (e) {
      console.warn('[cloud] clear ' + tableKey + ':', (e && e.message) || e);
      return false;
    }
  }

  /* Real-time: messages jadvaliga obuna (publication yo'l qo'ysa) */
  function subscribe() {
    if (!ready()) return;
    subscribeMessages();
    subscribeNotifications();
  }

  function subscribeMessages() {
    if (!hasMessages || subscribed) return;
    try {
      const ch = client.channel('messages-live');
      ch.on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, function () { refreshChat(); })
        .subscribe(function (status) {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') subscribed = false;
        });
      subscribed = true;
    } catch (e) { subscribed = false; }
  }

  /* Real-time: bildirishnomalar uchun barcha tegishli jadvallar */
  function subscribeNotifications() {
    if (notifSubscribed) return;
    try {
      const ch = client.channel('notify-live');
      NOTIFY_TABLES.forEach(function (t) {
        ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: t },
            function (p) { onCloudNotifChange(t, p && p.new, null); })
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: t },
            function (p) { onCloudNotifChange(t, p && p.new, p && p.old); });
      });
      ch.subscribe(function (status) {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') notifSubscribed = false;
      });
      notifSubscribed = true;
    } catch (e) { notifSubscribed = false; }
  }

  /* --- Xavfsizlik: oxirgi qurilma/vaqt + faol qurilmalar (user_sessions) --- */
  async function pushLastSeen(dbId, deviceName) {
    if (!ready() || dbId == null) return false;
    try {
      const res = await client.from('students')
        .update({ last_device: deviceName, last_seen: new Date().toISOString() })
        .eq('id', dbId);
      if (res.error) { if (missing(res.error)) return false; console.warn('[cloud] last_seen:', res.error.message); return false; }
      return true;
    } catch (e) { console.warn('[cloud] last_seen:', (e && e.message) || e); return false; }
  }

  function sessionRowOf(sess) {
    return {
      id: sess.id,
      user_type: sess.userType,
      user_id: sess.userId,
      device_name: sess.deviceName,
      last_active: sess.lastActive || new Date().toISOString()
    };
  }

  async function upsertSession(sess) {
    if (!ready()) return false;
    try {
      const res = await client.from('user_sessions').upsert(sessionRowOf(sess));
      if (res.error) { if (missing(res.error)) return false; console.warn('[cloud] session upsert:', res.error.message); return false; }
      return true;
    } catch (e) { console.warn('[cloud] session upsert:', (e && e.message) || e); return false; }
  }

  async function touchSession(id) {
    if (!ready()) return false;
    try {
      const res = await client.from('user_sessions')
        .update({ last_active: new Date().toISOString() }).eq('id', id);
      return !res.error;
    } catch (e) { return false; }
  }

  async function deleteSession(id) {
    if (!ready()) return false;
    try {
      const res = await client.from('user_sessions').delete().eq('id', id);
      return !res.error;
    } catch (e) { return false; }
  }

  async function listSessions(userType, userId) {
    if (!ready()) return null;
    try {
      const res = await client.from('user_sessions').select('*')
        .eq('user_type', userType).eq('user_id', userId)
        .order('last_active', { ascending: false });
      if (res.error) { if (missing(res.error)) return null; return null; }
      return res.data || [];
    } catch (e) { return null; }
  }

  /* Joriy qurilma seansda bormi? (lokal rejimda hech qachon chiqarmaydi) */
  async function sessionExists(id) {
    if (!ready()) return true;
    try {
      const res = await client.from('user_sessions').select('id').eq('id', id).limit(1);
      if (res.error) return true;
      return !!(res.data && res.data.length);
    } catch (e) { return true; }
  }

  /* --- Speaking slotlari (speaking_slots) --- */
  let hasSlots = true;
  async function pullSlots(studentDbId) {
    if (!ready() || !hasSlots) return;
    try {
      let q = client.from('speaking_slots').select('*');
      if (studentDbId != null) q = q.eq('student_id', studentDbId);
      const res = await q;
      if (res.error) { if (missing(res.error)) hasSlots = false; return; }
      const list = (res.data || []).map(function (r) {
        const st = getStudents().filter(function (x) { return x.dbId === r.student_id; })[0];
        return {
          id: 'sp' + r.id,
          dbId: r.id,
          date: r.date || '',
          start: String(r.start_time || '').slice(0, 5),
          end: String(r.end_time || '').slice(0, 5),
          studentId: st ? st.id : null,
          score: r.score == null ? null : Number(r.score)
        };
      });
      /* bulutga hali yozilmagan lokal slotlar saqlanadi */
      getSpeaking().forEach(function (x) { if (x.dbId == null) list.push(x); });
      store.set(K.speaking, list);
    } catch (e) { console.warn('[cloud] slots:', (e && e.message) || e); }
  }

  async function pushSlot(x) {
    if (!ready() || !hasSlots || !x) return;
    const st = x.studentId ? studentById(x.studentId) : null;
    const payload = {
      date: x.date,
      start_time: x.start,
      end_time: x.end,
      student_id: st && st.dbId != null ? st.dbId : null,
      score: x.score == null ? null : Number(x.score)
    };
    try {
      if (x.dbId == null) {
        const res = await client.from('speaking_slots').insert(payload).select();
        if (res.error) throw res.error;
        const list = getSpeaking();
        const t = list.filter(function (y) { return y.id === x.id; })[0];
        if (t && res.data && res.data[0]) { t.dbId = res.data[0].id; store.set(K.speaking, list); }
      } else {
        const res = await client.from('speaking_slots').update(payload).eq('id', x.dbId);
        if (res.error) throw res.error;
      }
    } catch (e) {
      if (e && e.code === 'PGRST205') hasSlots = false;
      console.warn('[cloud] slot:', (e && e.message) || e);
    }
  }

  async function deleteSlot(dbId) {
    if (!ready() || !hasSlots || dbId == null) return;
    try {
      const res = await client.from('speaking_slots').delete().eq('id', dbId);
      if (res.error) throw res.error;
    } catch (e) { console.warn('[cloud] slot del:', (e && e.message) || e); }
  }

  return {
    ready: ready,
    pullAll: pullAll,
    uploadHomeworkMedia: uploadHomeworkMedia,
    removeHomeworkMedia: removeHomeworkMedia,
    queueMessages: queueMessages,
    messageStatus: messageStatus,
    addPayment: addPayment,
    pullMonthlyFees: pullMonthlyFees,
    saveMonthlyFee: saveMonthlyFee,
    deleteMonthlyFee: deleteMonthlyFee,
    fetchMessages: fetchMessages,
    pushGroup: pushGroup,
    pushStudent: pushStudent,
    pushDebt: pushDebt,
    adjustDebt: adjustDebt,
    pushGrade: pushGrade,
    pushAttendance: pushAttendance,
    pullHomework: pullHomework,
    pushHomework: pushHomework,
    pullSpeaking: pullSpeaking,
    pushSpeakingGrade: pushSpeakingGrade,
    pullSlots: pullSlots,
    pushSlot: pushSlot,
    deleteSlot: deleteSlot,
    pushTeacherPassword: pushTeacherPassword,
    sendMessage: sendMessage,
    subscribe: subscribe,
    deleteStudent: deleteStudent,
    deleteGroup: deleteGroup,
    deleteHomework: deleteHomework,
    fetchBackup: fetchBackup,
    restoreBackup: restoreBackup,
    clearTable: clearTable,
    messagesAvailable: function () { return ready() && hasMessages; },
    pushLastSeen: pushLastSeen,
    upsertSession: upsertSession,
    touchSession: touchSession,
    deleteSession: deleteSession,
    listSessions: listSessions,
    sessionExists: sessionExists,
    pullCardSettings: pullCardSettings,
    saveCardSettings: saveCardSettings,
    uploadReceiptImage: uploadReceiptImage,
    submitPaymentReceipt: submitPaymentReceipt,
    pullStudentReceipts: pullStudentReceipts,
    addStudentPaymentRecord: addStudentPaymentRecord,
    url: url
  };
  async function addStudentPaymentRecord(studentDbId, groupDbId, monthKey, monthName, amount) {
    if (!ready() || studentDbId == null) return;
    try {
      await client.from('student_payments').insert({
        student_id: studentDbId,
        group_id: groupDbId,
        month_key: monthKey,
        month_name: monthName,
        amount_paid: Number(amount) || 0,
        is_paid: true,
        paid_at: new Date().toISOString(),
        note: monthName + " uchun to'lov"
      });
    } catch (e) {
      console.warn('[cloud] student_payments insert:', (e && e.message) || e);
    }
  }


  /* --- To'lov kartasi sozlamalari (bot_settings) --- */
  async function pullCardSettings() {
    if (!ready()) return store.get(K.cardSettings, { number: '', holder: '' });
    try {
      const res = await client.from('bot_settings').select('key, value').in('key', ['teacher_card_number', 'teacher_card_holder']);
      if (res.error) return store.get(K.cardSettings, { number: '', holder: '' });
      const cur = store.get(K.cardSettings, { number: '', holder: '' });
      (res.data || []).forEach(r => {
        if (r.key === 'teacher_card_number') cur.number = r.value || '';
        if (r.key === 'teacher_card_holder') cur.holder = r.value || '';
      });
      store.set(K.cardSettings, cur);
      return cur;
    } catch (e) {
      return store.get(K.cardSettings, { number: '', holder: '' });
    }
  }

  async function saveCardSettings(number, holder) {
    const cleanNum = String(number || '').trim();
    const cleanHolder = String(holder || '').trim().toUpperCase();
    const cur = { number: cleanNum, holder: cleanHolder };
    store.set(K.cardSettings, cur);
    if (!ready()) return true;
    try {
      await client.from('bot_settings').upsert([
        { key: 'teacher_card_number', value: cleanNum },
        { key: 'teacher_card_holder', value: cleanHolder }
      ], { onConflict: 'key' });
      return true;
    } catch (e) {
      console.warn('[cloud] saveCardSettings:', (e && e.message) || e);
      return false;
    }
  }

  /* --- To'lov chekini Supabase Storage'ga yuklash va bazaga yozish --- */
  async function uploadReceiptImage(file) {
    if (!ready()) throw new Error('Supabase sozlanmagan');
    const ext = String((file && file.name) || '').split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const path = 'receipts/' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + '.' + ext;
    let lastErr = null;
    for (let i = 0; i < MEDIA_BUCKETS.length; i++) {
      const bucket = MEDIA_BUCKETS[i];
      try {
        const res = await client.storage.from(bucket).upload(path, file, {
          cacheControl: '3600', upsert: false, contentType: (file && file.type) || 'image/jpeg'
        });
        if (res.error) throw res.error;
        const pub = client.storage.from(bucket).getPublicUrl(path);
        return { url: pub.data.publicUrl, path: path, bucket: bucket };
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error('Storage bucket topilmadi');
  }

  async function submitPaymentReceipt(studentDbId, monthKey, amount, receiptUrl) {
    if (!ready() || studentDbId == null) return null;
    try {
      const res = await client.from('payment_receipts').insert({
        student_id: studentDbId,
        month_key: monthKey,
        amount: Number(amount) || 0,
        receipt_url: receiptUrl,
        status: 'kutilmoqda'
      }).select();
      if (res.error) throw res.error;
      const row = res.data && res.data[0] ? res.data[0] : null;
      if (row) {
        const list = store.get(K.paymentReceipts, []);
        list.unshift(row);
        store.set(K.paymentReceipts, list);
      }
      return row;
    } catch (e) {
      console.warn('[cloud] submitPaymentReceipt:', (e && e.message) || e);
      throw e;
    }
  }

  async function pullStudentReceipts(studentDbId) {
    if (!ready() || studentDbId == null) return store.get(K.paymentReceipts, []);
    try {
      const res = await client.from('payment_receipts').select('*')
        .eq('student_id', studentDbId).order('created_at', { ascending: false });
      if (res.error) return store.get(K.paymentReceipts, []);
      store.set(K.paymentReceipts, res.data || []);
      return res.data || [];
    } catch (e) {
      return store.get(K.paymentReceipts, []);
    }
  }

})();

window.__cloud = CloudSync;

/* ==================== QURILMA VA FAOL QURILMALAR (xavfsizlik nazorati) ==================== */
/* Brauzer qurilmasini aniqlaydi: 'Android (Chrome)', 'iPhone (Safari)', 'Windows PC' ... */
function detectDevice() {
  const ua = (navigator && navigator.userAgent) || '';
  let os = 'Boshqa qurilma';
  if (/iPhone/.test(ua)) os = 'iPhone';
  else if (/iPad/.test(ua)) os = 'iPad';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/Windows/.test(ua)) os = 'Windows PC';
  else if (/Macintosh|Mac OS X/.test(ua)) os = 'Mac';
  else if (/Linux/.test(ua)) os = 'Linux';
  let br = 'Brauzer';
  if (/Edg\//.test(ua)) br = 'Edge';
  else if (/OPR\//.test(ua) || /Opera/.test(ua)) br = 'Opera';
  else if (/Firefox\//.test(ua)) br = 'Firefox';
  else if (/Chrome\//.test(ua)) br = 'Chrome';
  else if (/Safari\//.test(ua)) br = 'Safari';
  return { os: os, br: br, name: os + ' (' + br + ')', short: os + ' \u2022 ' + br };
}

/* Takrorlanmas session_id (UUID v4) — har bir qurilma uchun bir marta saqlanadi */
function uuidV4() {
  try {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
  } catch (e) {}
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
function getSessionId() {
  let id = store.get(K.sessionId, null);
  if (!id) { id = uuidV4(); store.set(K.sessionId, id); }
  return id;
}

/* Vaqt ko'rinishi: 'hozirgina' / '20 daqiqa oldin' / '3 soat oldin' / '2 kun oldin' */
function timeAgoText(iso) {
  const t = new Date(iso).getTime();
  if (!t || isNaN(t)) return '\u2014';
  const diff = Math.max(0, Date.now() - t);
  const m = Math.floor(diff / 60000);
  const en = getLang() === 'en';
  if (m < 1) return en ? 'Just now' : 'hozirgina';
  if (m < 60) return en ? (m + ' min ago') : (m + ' daqiqa oldin');
  const h = Math.floor(m / 60);
  if (h < 24) return en ? (h + ' hours ago') : (h + ' soat oldin');
  const d = Math.floor(h / 24);
  return en ? (d + ' days ago') : (d + ' kun oldin');
}

/* O'quvchi kartasi satri: 5 daqiqa ichida -> 'Onlayn (iPhone)',
   aks holda -> 'Android \u2022 20 daqiqa oldin' */
function presenceText(s) {
  if (!s || !s.lastSeen) return '';
  const ts = new Date(s.lastSeen).getTime();
  if (!ts || isNaN(ts)) return '';
  const os = s.lastDevice ? String(s.lastDevice).split(' (')[0] : t('qurilma');
  const mins = (Date.now() - ts) / 60000;
  if (mins < 5) return '\ud83d\udfe2 ' + t('Onlayn') + ' (' + os + ')';
  return '\ud83d\udcf1 ' + os + ' \u2022 ' + timeAgoText(s.lastSeen);
}
function presenceHTML(s) {
  const t = presenceText(s);
  if (!t) return '';
  const on = t.indexOf('\ud83d\udfe2') === 0;
  return '<div class="s-presence' + (on ? ' is-on' : '') + '">' + esc(t) + '</div>';
}

/* Lokal (localStorage) ga oxirgi qurilma/vaqt — kartalar offline ham ko'radi */
function updateLocalPresence(deviceName) {
  const u = currentUser();
  if (!u || !u.studentId) return;
  const list = getStudents();
  const st = list.filter(function (x) { return x.id === u.studentId; })[0];
  if (!st) return;
  st.lastDevice = deviceName || '';
  st.lastSeen = new Date().toISOString();
  store.set(K.students, list);
}

const Sessions = {
  list: [],
  enabled: function () { return CloudSync.ready(); },

  /* Login paytida: user_sessions ga seans + students.last_device/last_seen */
  onLogin: async function () {
    const u = currentUser();
    if (!u) return;
    const dev = detectDevice();
    updateLocalPresence(dev.name);
    if (!this.enabled()) return;
    const id = getSessionId();
    await CloudSync.upsertSession({
      id: id,
      userType: u.role === 'teacher' ? 'teacher' : 'student',
      userId: u.login,
      deviceName: dev.short,
      lastActive: new Date().toISOString()
    });
    if (u.studentId) {
      const st = studentById(u.studentId);
      if (st && st.dbId != null) await CloudSync.pushLastSeen(st.dbId, dev.name);
    }
    this.refresh();
  },

  /* Harakat -> oxirgi faoliyat (60s throttle bilan chaqiriladi) */
  touch: async function () {
    const u = currentUser();
    if (!u) return;
    const dev = detectDevice();
    updateLocalPresence(dev.name);
    if (!this.enabled()) return;
    CloudSync.touchSession(getSessionId());
    if (u.studentId) {
      const st = studentById(u.studentId);
      if (st && st.dbId != null) CloudSync.pushLastSeen(st.dbId, dev.name);
    }
  },

  /* Profil uchun seanslar ro'yxati */
  refresh: async function () {
    const u = currentUser();
    if (!u) { this.list = []; return this.list; }
    if (!this.enabled()) return this.list;
    const rows = await CloudSync.listSessions(u.role === 'teacher' ? 'teacher' : 'student', u.login);
    if (rows == null) return this.list;
    const changed = JSON.stringify(rows) !== JSON.stringify(this.list);
    this.list = rows;
    if (changed && state.screen === 'profile') render();
    return rows;
  },

  /* Har 30 soniyada: joriy qurilma seansda bormi? O'chirilgan bo'lsa — majburiy chiqish */
  check: async function () {
    const u = currentUser();
    if (!u || !this.enabled()) return true;
    const id = getSessionId();
    const exists = await CloudSync.sessionExists(id);
    if (exists === false) { forcedLogout(); return false; }
    CloudSync.touchSession(id);
    return true;
  },

  /* O'z seansimizni o'chirish (oddiy chiqish) */
  onLogout: function () {
    if (this.enabled()) CloudSync.deleteSession(getSessionId());
    this.list = [];
  },

  /* Boshqa qurilmani chiqarib yuborish */
  remove: async function (id) {
    if (!id) return;
    this.list = this.list.filter(function (s) { return s.id !== id; });
    if (this.enabled()) { await CloudSync.deleteSession(id); await this.refresh(); }
    else if (state.screen === 'profile') render();
    toast('Qurilma chiqarib yuborildi');
  },

  /* Barcha boshqa qurilmalardan chiqish */
  removeAllOthers: async function () {
    const cur = getSessionId();
    const others = this.list.filter(function (s) { return s.id !== cur; });
    this.list = this.list.filter(function (s) { return s.id === cur; });
    if (this.enabled()) {
      for (let i = 0; i < others.length; i++) await CloudSync.deleteSession(others[i].id);
      await this.refresh();
    } else if (state.screen === 'profile') render();
    toast(others.length ? 'Boshqa qurilmalar chiqarib yuborildi' : "Boshqa qurilmalar yo'q");
  }
};

/* Boshqa qurilmadan chiqarildik: localStorage tozalanib, login ekraniga qaytamiz */
function forcedLogout() {
  Sessions.list = [];
  analyticsCall('reset');
  /* Faqat shu ilovaning kalitlari tozalanadi */
  try {
    Object.keys(K).forEach(function (k) { localStorage.removeItem(K[k]); });
  } catch (e) {}
  state.attDraft = null;
  state.editor = null;
  state.forcedOut = true;
  state.screen = 'login';
  closeModal();
  render();
  toast('Siz ushbu qurilmadan chiqarildingiz!', 'error');
}

/* Profil: 📱 Faol qurilmalar bloki */
function sessionsSectionHTML() {
  const dev = detectDevice();
  const cur = getSessionId();
  const others = (Sessions.list || []).filter(function (s) { return s.id !== cur; });
  return `
  <div class="section-title">${ico('smartphone', 15)} ${t('Faol qurilmalar')}</div>
  <div class="card list-card" id="sessions-card">
    <div class="list-row session-row is-current">
      <span class="session-info">
        <span class="session-name"><span class="sess-dot"></span>${t('Bu qurilma')} (${esc(dev.short)})</span>
        <span class="muted small">${t('joriy sessiya')}</span>
      </span>
    </div>
    ${others.length ? others.map(function (s) {
      return `
    <div class="list-row session-row">
      <span class="session-info">
        <span class="session-name">${esc(s.device_name || t("Noma'lum qurilma"))}</span>
        <span class="muted small">${esc(timeAgoText(s.last_active))}</span>
      </span>
      <button type="button" class="btn btn-xs danger" data-act="session-logout" data-sess="${esc(s.id)}">${t('Chiqarib yuborish')}</button>
    </div>`;
    }).join('') : `
    <div class="list-row"><span class="muted small">${t('Boshqa qurilmalar ulanmagan')}</span></div>`}
  </div>
  ${others.length ? `<button type="button" class="btn btn-danger btn-block" data-act="session-logout-all">${ico('alert', 16)} ${t('Barcha boshqa qurilmalardan chiqish')}</button>` : ''}
  `;
}

window.__sessions = {
  detectDevice: detectDevice,
  getSessionId: getSessionId,
  timeAgoText: timeAgoText,
  presenceText: presenceText,
  sessions: Sessions,
  forcedLogout: forcedLogout
};


/* ---- Analitika (js/analytics.js) — xato bo'lsa ham ilova ishlayveradi ---- */
function analyticsCall(name, arg1, arg2) {
  try {
    const a = window.Analytics;
    if (!a || typeof a[name] !== 'function') return;
    a[name](arg1, arg2);
  } catch (e) { /* analitika hech qachon oqimni to'xtatmaydi */ }
}
function analyticsConsent() {
  try {
    const a = window.Analytics;
    return !!(a && a.consent && a.consent.granted());
  } catch (e) { return false; }
}

/* ---- Hisob va sessiya (login/parol) ---- */
function getSession() { return store.get(K.session, null); }
function currentUser() {
  const s = getSession();
  return s && accounts[s.login] ? accounts[s.login] : null;
}
function isTeacher() {
  const u = currentUser();
  return !!u && u.role === 'teacher';
}
function linkedStudent() {
  const u = currentUser();
  if (!u || !u.studentId) return null;
  return studentById(u.studentId);
}
function startSession(login) {
  store.set(K.session, { login: login, role: accounts[login].role });
  state.screen = 'home';
  render();
  /* Boshqa qurilmadan kirgan bo'lsak — bulutdan ma'lumotni tiklandi (doLogin) */
  CloudSync.subscribe();
  refreshChat();
  /* Bildirishnomalar ruxsati hali so'ralmagan bo'lsa — so'raymiz (salomdan keyin) */
  Notif.afterLogin();
  /* Xavfsizlik: sessiya + oxirgi qurilma/vaqt yoziladi (user_sessions / students) */
  state.forcedOut = false;
  Sessions.onLogin();
  /* Analitika: kirish (faqat rozilik berilgan bo'lsa) — hisob logini yuborilmaydi */
  const anon = linkedStudent();
  analyticsCall('onLogin', {
    account: login,
    role: accounts[login].role,
    hasGroup: !!(anon && anon.groupId),
    surface: tg ? 'telegram' : 'browser'
  });
}
function go(screen) {
  state.screen = screen;
  render();
  /* Faol qurilmalar ro'yxatini yangilash (Profil ekrani) */
  if (screen === 'profile') Sessions.refresh();
  /* Ekranni bulutdan yangilaymiz (bir martalik pull — 5 soniyalik loop'siz) */
  if (!CloudSync.ready()) return;
  if (screen === 'home') {
    const hw0 = JSON.stringify(getHomework());
    const tg0 = JSON.stringify(getTgSubs());
    const sp0 = JSON.stringify(getSpeaking());
    const stu = linkedStudent();
    const slotsDbId = isTeacher() ? null : (stu && stu.dbId != null ? stu.dbId : null);
    Promise.all([CloudSync.pullHomework(), CloudSync.pullSpeaking(), CloudSync.pullSlots(slotsDbId)]).then(function () {
      if (JSON.stringify(getHomework()) !== hw0 || JSON.stringify(getTgSubs()) !== tg0 ||
          JSON.stringify(getSpeaking()) !== sp0) render();
    }).catch(function () {});
  } else if (screen === 'speaking' && isTeacher()) {
    const tg0 = JSON.stringify(getTgSubs());
    const sp0 = JSON.stringify(getSpeaking());
    Promise.all([CloudSync.pullSpeaking(), CloudSync.pullSlots(null)]).then(function () {
      if (JSON.stringify(getTgSubs()) !== tg0 || JSON.stringify(getSpeaking()) !== sp0) render();
    }).catch(function () {});
  }
}

function suggestLogin(fullName) {
  const base = String(fullName || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10) || 'user';
  let candidate = base;
  let n = 1;
  while (accounts[candidate]) { candidate = base + (++n); }
  return candidate;
}

/* ---- Toast ---- */
function toast(msg, type) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = msg;
  el.className = 'toast show' + (type === 'error' ? ' error' : '');
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => { el.className = 'toast'; }, 2600);
}

/* Tugmali toast — masalan bildirishnoma ruxsati so'rovi */
function toastAction(msg, actionLabel, onAction) {
  const el = $('#toast');
  if (!el) return;
  clearTimeout(state.toastTimer);
  el.innerHTML = '';
  el.appendChild(document.createTextNode(msg + ' '));
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'toast-action';
  btn.textContent = actionLabel;
  btn.addEventListener('click', function () {
    clearTimeout(state.toastTimer);
    el.className = 'toast';
    el.innerHTML = '';
    onAction();
  });
  el.appendChild(btn);
  el.className = 'toast show toast--action';
  state.toastTimer = setTimeout(function () { el.className = 'toast'; }, 15000);
}

/* ==================== Brauzer bildirishnomalari (Web Push) ====================
   Bloklangan bo'lsa — jim o'tamiz: barcha ogohlantirishlar UI (toast) va
   Telegram botda qolaveradi. */
const Notif = (function () {
  const ICON_URL = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
    '<rect width="64" height="64" rx="14" fill="#2563eb"/>' +
    '<circle cx="32" cy="32" r="15" fill="#fff" opacity=".92"/></svg>'
  );
  const PROMPT_TEXT = 'Yangi baholar va xabarlarni o\'tkazib yubormaslik uchun bildirishnomalarni yoqing';
  const PROMPT_BUTTON = 'Ruxsat berish';
  const shown = Object.create(null); /* bitta hodisa bir marta ko'rsatiladi */

  function supported() {
    return typeof window !== 'undefined' && typeof window.Notification !== 'undefined';
  }
  function permission() { return supported() ? window.Notification.permission : 'denied'; }
  function granted() { return supported() && window.Notification.permission === 'granted'; }
  function blocked() { const p = permission(); return p === 'denied' || p === 'default'; }

  function show(title, body) {
    if (!granted()) return false;
    try {
      new window.Notification(title, { body: body, icon: ICON_URL });
      return true;
    } catch (e) {
      /* ba'zi brauzerlar (yoki HTTPS emas) Notification quruvchisini tashlaydi */
      console.warn('[notif]', (e && e.message) || e);
      return false;
    }
  }

  /* key — qatorning yagona id'si; ruxsat hali 'default' bo'lsa ko'rsatmaymiz,
     lekin kalitni ham yozmaymiz — ruxsat berilgach keyingi realtime yangilikda chiqadi. */
  function notifyOnce(key, title, body) {
    if (!key || shown[key]) return false;
    if (!granted()) return false;
    shown[key] = true;
    return show(title, body);
  }

  function request() {
    if (!supported()) return;
    if (granted()) { toast('Bildirishnomalar yoqildi'); return; }
    if (permission() === 'denied') { toast("Brauzerda bildirishnomalar bloklangan", 'error'); return; }
    const onDone = function (p) {
      if (p === 'granted') toast('Bildirishnomalar yoqildi');
      else toast("Bildirishnomalar o'chirib qoldi", 'error');
    };
    try {
      const r = window.Notification.requestPermission(onDone);
      if (r && typeof r.then === 'function') { r.then(onDone).catch(function () {}); }
    } catch (e) { console.warn('[notif] request:', (e && e.message) || e); }
  }

  function showPrompt() {
    if (permission() !== 'default') return false;
    toastAction(PROMPT_TEXT, PROMPT_BUTTON, request);
    return true;
  }

  /* Kirganda: ruxsat so'ralmagan bo'lsa — do'stona so'rov (salomdan keyin) */
  function afterLogin(delayMs) {
    if (permission() !== 'default') return false;
    setTimeout(showPrompt, typeof delayMs === 'number' ? delayMs : 2800);
    return true;
  }

  function resetSeen() {
    Object.keys(shown).forEach(function (k) { delete shown[k]; });
  }

  return {
    supported: supported,
    permission: permission,
    granted: granted,
    blocked: blocked,
    show: show,
    notifyOnce: notifyOnce,
    request: request,
    showPrompt: showPrompt,
    afterLogin: afterLogin,
    resetSeen: resetSeen,
    PROMPT_TEXT: PROMPT_TEXT,
    PROMPT_BUTTON: PROMPT_BUTTON
  };
})();
window.Notif = Notif;

/* Supabase realtime → brauzer bildirishnomasi.
   Har bir hodisada faqat qabul qiluvchi tomon ogohlantiriladi:
   ustoz yozgan xabar o'quvchiga, o'quvchi yozgan xabar ustozga va h.k. */
function onCloudNotifChange(table, row, old) {
  if (!row) return;

  if (table === 'grades') {
    const st = linkedStudent();
    if (!st || st.dbId == null || row.student_id !== st.dbId) return;
    Notif.notifyOnce('grade:' + row.id,
      TEACHER_NAME + ': Sizga yangi baho qo\'yildi (' + row.grade + '/10)!');
    return;
  }

  if (table === 'homework') {
    const st = linkedStudent();
    if (!st) return;
    const g = groupById(st.groupId);
    if (!g || g.dbId == null || row.group_id == null || row.group_id !== g.dbId) return;
    Notif.notifyOnce('hw:' + row.id, 'Yangi uyga vazifa: ' + String(row.title || ''));
    return;
  }

  if (table === 'students') {
    /* --- Jonli speaking qarz badge'i (masalan 2 → 1) — sahifani yangilashsiz --- */
    if (row.speaking_debt != null) {
      const dl = getStudents();
      const dt = dl.filter(function (x) { return x.dbId === row.id; })[0];
      const nd = Number(row.speaking_debt) || 0;
      if (dt && (Number(dt.speakingDebt) || 0) !== nd) {
        dt.speakingDebt = nd;
        store.set(K.students, dl);
        if (state.screen === 'speaking' || state.screen === 'students' ||
            (!isTeacher() && state.screen === 'home')) render();
      }
    }

    const st = linkedStudent();
    if (!st || st.dbId == null || row.id !== st.dbId) return;
    if (row.voice_allowed !== true) return;
    /* faqat false -> true: lokal keshda ham yangilaymiz */
    const was = old && typeof old.voice_allowed !== 'undefined'
      ? old.voice_allowed
      : st.voiceAllowed;
    if (was === true) return;
    const list = getStudents();
    const t = list.filter(function (x) { return x.id === st.id; })[0];
    if (t) { t.voiceAllowed = true; store.set(K.students, list); }
    Notif.notifyOnce('voice:' + row.id,
      TEACHER_NAME + ': Ovozli speaking topshirishga ruxsat berildi!');
    render();
    return;
  }

  if (table === 'messages') {
    const txt = String(row.text || '');
    if (row.sender === 'teacher') {
      const st = linkedStudent();
      if (!st || st.dbId == null || row.student_id !== st.dbId) return;
      Notif.notifyOnce('msg:' + row.id,
        TEACHER_NAME + 'dan yangi xabar: ' + txt);
    } else if (row.sender === 'student') {
      if (!isTeacher()) return;
      const s = getStudents().filter(function (x) { return x.dbId === row.student_id; })[0];
      if (!s) return;
      Notif.notifyOnce('msg:' + row.id, s.fullName + ': Yangi xabar keldi');
    }
    return;
  }

  if (table === 'speaking_submissions') {
    /* --- Jonli INBOX (zero refresh):
       INSERT → yangi topshirik karta darhol INBOX boshiga chiqadi;
       UPDATE (baholangan) → karta INBOXdan silliq chiqib ketadi. --- */
    const rec = {
      id: 't' + row.id,
      dbId: row.id,
      sid: 's' + row.student_id,
      mediaType: row.media_type || 'voice',
      status: row.status || 'kutilmoqda',
      score: row.score == null ? null : Number(row.score),
      feedback: row.feedback || '',
      createdAt: row.created_at || ''
    };
    if (rec.sid !== 'snull') {
      const subs = getTgSubs();
      const i = subs.map(function (x) { return x.dbId; }).indexOf(row.id);
      if (i < 0) subs.push(rec);  /* INSERT — render teskari yig'adi, ya'ni yuqorida */
      else subs[i] = rec;         /* UPDATE — lokal holat darhol yangilanadi */
      store.set(K.tgsubs, subs);
    }

    const done = rec.status === 'baholandi' || rec.status === 'graded' || rec.status === 'rad_etildi';
    const node = done ? document.querySelector('[data-tgcard="' + rec.id + '"]') : null;
    if (node && node.classList) {
      node.classList.add('is-leaving');
      setTimeout(function () { render(); }, 200); /* animatsiyadan keyin qayta chizish */
    } else if (isTeacher() && state.screen === 'speaking') {
      render(); /* yangi karta darhol ekranda — qayta yuklash yo'q */
    }

    if (!isTeacher()) return;
    const s = getStudents().filter(function (x) { return x.dbId === row.student_id; })[0];
    if (!s) return;
    Notif.notifyOnce('sub:' + row.id, s.fullName + ': Yangi speaking topshirildi!');
  }
}
window.onCloudNotifChange = onCloudNotifChange;

/* ==================== Ikonkalar ==================== */
const ICON = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.8 12 3l9 7.8"/><path d="M5.5 9.6V21h13V9.6"/><path d="M9.5 21v-6h5v6"/></svg>',
  students: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1.4"/><circle cx="4.5" cy="12" r="1.4"/><circle cx="4.5" cy="18" r="1.4"/></svg>',
  grades: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4v16h16"/><path d="M8 16v-4"/><path d="M12 16V8"/><path d="M16 16v-6"/></svg>',
  cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/><path d="M9 15l2 2 4-4"/></svg>',
  mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/></svg>',
  profile: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.6"/><path d="M4.5 20.5c0-3.7 3.3-6.2 7.5-6.2s7.5 2.5 7.5 6.2"/></svg>',
  groups: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M3.2 20c0-3.2 2.6-5.4 5.8-5.4s5.8 2.2 5.8 5.4"/><circle cx="17.3" cy="9.3" r="2.3"/><path d="M16.5 14.7c2.7.1 4.6 2.3 4.6 4.6"/></svg>',
  /* --- Yangi Lucide-uslubidagi vektor ikonkalar (emoji o'rniga) --- */
  gradCap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10 12 5 2 10l10 5 10-5Z"/><path d="M6 12.5V17c0 1.7 2.7 3 6 3s6-1.3 6-3v-4.5"/><path d="M22 10v6"/></svg>',
  userPlus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 21v-1.8a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V21"/><circle cx="8.5" cy="7" r="3.6"/><path d="M19 8v6"/><path d="M22 11h-6"/></svg>',
  bookOpen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/></svg>',
  clipboardCheck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 13.5 2 2 4-4"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5.2l3.2 1.8"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4.5A1.5 1.5 0 0 1 9.5 3h5A1.5 1.5 0 0 1 16 4.5V6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg>',
  key: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 8.6-8.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.7-7 10-7 10 7 10 7-3.7 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10.7 5.1A10.7 10.7 0 0 1 12 5c6.3 0 10 7 10 7a18.3 18.3 0 0 1-2.6 3.5"/><path d="M6.6 6.6A17.4 17.4 0 0 0 2 12s3.7 7 10 7a10.4 10.4 0 0 0 5.4-1.5"/><path d="M9.9 9.9a3 3 0 1 0 4.2 4.2"/><path d="m3 3 18 18"/></svg>',
  message: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.4 8.9 8.9 0 0 1-4-.9L3 21l1.9-5A8.4 8.4 0 0 1 12.5 3 8.4 8.4 0 0 1 21 11.5Z"/></svg>',
  video: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="14" height="12" rx="2"/><path d="m16 10.2 5.2-3.2v10L16 13.8Z"/></svg>',
  smartphone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M11 18.5h2"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m7 10.5 5 5 5-5"/><path d="M4 20h16"/></svg>',
  upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3"/><path d="m7 7 5-4 5 4"/><path d="M4 20h16"/></svg>',
  brush: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m9.5 11 8-8a2.8 2.8 0 0 1 4 4l-8 8"/><path d="M7.2 13.9c-1.6 0-3 1.4-3 3 0 1.3-2.4 1.6-1.9 2.1 1.1 1.1 2.5 2 4 2 2.2 0 4-1.8 4-4a3 3 0 0 0-3.1-3.1Z"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10.5" width="16" height="11" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/></svg>',
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
  flagUZ: '<svg viewBox="0 0 20 14"><rect width="20" height="14" fill="#fff"/><path d="M0 0h20v4.7H0z" fill="#0099B5"/><path d="M0 9.3h20V14H0z" fill="#1EB53A"/><path d="M0 4.7h20v.6H0zM0 8.7h20v.6H0z" fill="#CE1126"/><path d="M8.4 3.2a2.2 2.2 0 1 0 0 3.4 2.6 2.6 0 1 1 0-3.4z" fill="#fff"/></svg>',
  flagGB: '<svg viewBox="0 0 20 14"><rect width="20" height="14" fill="#012169"/><path d="M0 0l20 14M20 0L0 14" stroke="#fff" stroke-width="2.6"/><path d="M0 0l20 14M20 0L0 14" stroke="#C8102E" stroke-width="1.2"/><path d="M10 0v14M0 7h20" stroke="#fff" stroke-width="4.6"/><path d="M10 0v14M0 7h20" stroke="#C8102E" stroke-width="2.6"/></svg>',
  alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m21.2 18-8-14a1.9 1.9 0 0 0-3.3 0l-8 14A1.9 1.9 0 0 0 3.6 21h16.8a1.9 1.9 0 0 0 1.7-3Z"/><path d="M12 9.5v4"/><path d="M12 17.2h.01"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12.5 9.5 17.5 19.5 6.5"/></svg>',
  checkCircle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m8.4 12.3 2.5 2.5 4.7-5.2"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3.4 2.75 5.6 6.15.9-4.45 4.3 1.05 6.15L12 17.45l-5.5 2.9 1.05-6.15L3.1 9.9l6.15-.9Z"/></svg>',
  fileText: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5"/><path d="M9 13.5h6M9 17h4"/></svg>'
};

/* Matndagi mayda vektor ikonka: o'lchami aniq (SVG width/height) */
function ico(name, size) {
  const px = Number(size) || 16;
  const svg = ICON[name] || '';
  if (!svg) return '';
  return svg.replace('<svg', '<svg width="' + px + '" height="' + px + '"');
}

/* ==================== Header / Bottom nav ==================== */
/* ==================== I18N (UZ/EN) VA REJIM (Light/Dark) ==================== */
const I18N_EN = {
  "To'lov": "Payments",
  "To'lovlar": "Payments",
  'Bosh sahifa': 'Home', 'Bosh': 'Home', 'Guruhlar': 'Groups',
  "O'quvchilar": 'Students', "O'quvchi": 'Students',
  'Baholar jurnali': 'Gradebook', 'Baholar': 'Grades',
  'Davomat': 'Attendance', 'Tezkor davomat': 'Attendance',
  'Speaking slotlari': 'Speaking Slots', 'Speaking (1-on-1)': 'Speaking',
  'Profil': 'Profile', 'Kabinet': 'Dashboard',
  'Kirish': 'Sign In', 'Chiqish': 'Log Out', 'Hisobdan chiqish': 'Log Out',
  'Maxfiylik': 'Privacy', 'Anonim statistika': 'Anonymous analytics',
  'Anonim statistika yoqildi': 'Anonymous analytics turned on',
  "Anonim statistika o'chirildi": 'Anonymous analytics turned off',
  "Rozilik bersangiz, kirish va uyga vazifa harakatlari PostHog'ga loginsiz (anonim ID) yuboriladi. Rozilik bo'lmasa hech narsa yuborilmaydi.":
    'If you allow it, sign-in and homework actions are sent to PostHog without your login (anonymous ID). Nothing is sent without your consent.',
  'Uyga vazifalar': 'Homework', 'Qarz': 'Debt',
  'Guruh': 'Group', 'Sinf': 'Class', 'Sana': 'Date',
  'Oldingi hafta': 'Previous week', 'Bugun': 'Today', 'Keyingi hafta': 'Next week',
  "O'rtacha": 'Average', "O'rtacha bahosi": 'Average score',
  'Parol': 'Password',
  /* --- Dinamik kartalar matnlari (o'quvchi kartasi, uyga vazifa) --- */
  'Speaking qarzi': 'Speaking debt',
  'Ovozli ruxsat': 'Voice allowed',
  'Xabar yozish': 'Message',
  'Parolni yangilash': 'Reset Password',
  'Tahrirlash': 'Edit',
  "O'chirish": 'Delete',
  'Topshirish muddati': 'Due date',
  'Guruh taylanmagan': 'No group assigned',
  'Barchasi': 'All',
  /* --- Kirish sahifasi (hero): sarlavha, tavsif, 3 ta ma'lumot kartasi --- */
  "Teacher Muzaffar Amirov — Ingliz tili ta'lim platformasi":
    'Teacher Muzaffar Amirov — English Learning Platform',
  "Ushbu platforma Muzaffar Amirovning 5–11-sinf o'quvchilari uchun mo'ljallangan zamonaviy ta'lim va nazorat tizimidir. O'quvchilar darslarni o'zlashtirishi, vazifalar va speaking topshiriqlarini bajarishi, ota-onalar esa davomat va baholarni real vaqtda kuzatishi mumkin.":
    "A modern learning and monitoring platform designed for Teacher Muzaffar Amirov's Grade 5–11 students. Track daily lessons, complete speaking assignments, and monitor attendance and grades in real time.",
  "Yakkama-yakka Speaking va Audio/Video tahlil": '1-on-1 Speaking & Audio/Video Review',
  "O'quvchilar mavzular bo'yicha speaking topshiriqlarini darsda yoki Telegram bot orqali ovozli xabar va krujok video shaklida yuboradilar. Har bir javob 10 ballik tizimda baholanadi va speaking qarzlari avtomatik hisoblanadi.":
    'Students submit speaking tasks in class or via Telegram bot as voice and video notes. Every submission is graded on a 10-point scale with automatic speaking debt tracking.',
  "Kundalik 10 ballik elektron jurnal va Davomat": 'Daily 10-Point Gradebook & Attendance',
  "Har bir darsdagi faollik, davomat va baholar shaffof elektron jurnalga kiritiladi hamda haftalik va umumiy o'rtacha reyting avtomatik hisoblanadi.":
    'Class participation, attendance, and grades are recorded in a transparent electronic journal with automatic weekly and overall average calculations.',
  "Telegram Bot ekotizimi (@uzbekspeakingcheckbot)": 'Telegram Bot Ecosystem (@uzbekspeakingcheckbot)',
  "Yangi uyga vazifalar, speaking eslatmalari, olingan baholar va ustoz xabarlari bevosita o'quvchining Telegram profiliga tezkor yetkaziladi.":
    "Instant notifications for new homework, speaking schedules, grades, and teacher messages delivered directly to the student's Telegram.",
  /* --- Profil: faol qurilmalar --- */
  'Faol qurilmalar': 'Active Devices',
  'Bu qurilma': 'This device',
  'joriy sessiya': 'current session',
  'Chiqarib yuborish': 'Terminate',
  'Barcha boshqa qurilmalardan chiqish': 'Terminate All Other Sessions',
  'Boshqa qurilmalar ulanmagan': 'No other devices connected',
  "Noma'lum qurilma": 'Unknown device',
  'Onlayn': 'Online',
  'qurilma': 'device',
  /* --- Profil: xavfsizlik, zaxira, tozalash --- */
  'Xavfsizlik': 'Security',
  "Ko'rinish": 'Role',
  "Parolni o'zgartirish": 'Change Password',
  "Ma'lumotlar Bazasi Zaxirasi": 'Database Backup',
  "Guruhlar, o'quvchilar, davomat, baholar, xabarlar va speaking topshiriqlari JSON faylda saqlanadi.":
    'Groups, students, attendance, grades, messages, and speaking tasks are saved in a JSON file.',
  'Bazani yuklab olish (Backup)': 'Download Backup',
  'Bazani qayta tiklash (Restore)': 'Restore Backup',
  'Tozalash': 'Cleanup',
  "Tozalashdan oldin barcha jadvallar fayl ko'rinishida avtomatik yuklab olinadi.":
    'All tables are automatically downloaded as a file before cleanup.',
  'Xabarlar': 'Messages',
  'Topshiriqlar': 'Tasks',
  'Tanlangan jadvalni tozalash': 'Clear Selected Table'
};
function getLang() { return store.get('app_lang', 'uz'); }
function t(s) {
  if (getLang() !== 'en') return s;
  const v = I18N_EN[s];
  return v == null ? s : v;
}
/* Dinamik matn yordamchilari: "9-sinf" → "Grade 9", "N ta" → "N" */
function tClass(c) {
  const s = String(c == null ? '' : c);
  if (getLang() !== 'en') return s;
  const m = /^(\d+)\s*-?\s*sinf$/i.exec(s.trim());
  return m ? 'Grade ' + m[1] : t(s);
}
function tTa(n) { return getLang() === 'en' ? String(n) : n + ' ta'; }
function tStudCnt(n) {
  return getLang() === 'en' ? n + ' student' + (n === 1 ? '' : 's') : n + " ta o'quvchi";
}
function tGrpCnt(n) {
  return getLang() === 'en' ? n + ' student' + (n === 1 ? '' : 's') : n + " o'quvchi";
}
function toggleLang() {
  store.set('app_lang', getLang() === 'uz' ? 'en' : 'uz');
  render();
}
function getTheme() { return store.get('theme', 'light'); }
function applyTheme() {
  try { document.documentElement.setAttribute('data-theme', getTheme() === 'dark' ? 'dark' : 'light'); }
  catch (e) {}
}
function toggleTheme() {
  store.set('theme', getTheme() === 'dark' ? 'light' : 'dark');
  applyTheme();
  render();
}
/* Header nazorat tugmalari: ☀️/🌙 rejim + 🇺🇿 UZ | 🇬🇧 EN til */
function headerControlsHTML() {
  const dark = getTheme() === 'dark';
  const en = getLang() === 'en';
  return `<div class="header-controls">
    <button type="button" class="icon-btn mode-btn" data-act="toggle-theme" aria-label="${dark ? 'Kunduzgi rejim' : 'Tungi rejim'}" title="${dark ? 'Kunduzgi rejim' : 'Tungi rejim'}">${dark ? ico('sun', 18) : ico('moon', 18)}</button>
    <button type="button" class="lang-switch" data-act="toggle-lang" aria-label="Tilni almashtirish">
      <span class="lang-opt${!en ? ' active' : ''}">${ico('flagUZ', 14)} UZ</span><span class="lang-sep">|</span><span class="lang-opt${en ? ' active' : ''}">${ico('flagGB', 14)} EN</span>
    </button>
  </div>`;
}
function renderTopNavControls() {
  const el = document.getElementById('top-nav-right');
  if (!el) return;
  let box = document.getElementById('top-nav-controls');
  if (!box) {
    el.insertAdjacentHTML('afterbegin', '<span id="top-nav-controls"></span>');
    box = document.getElementById('top-nav-controls');
  }
  box.innerHTML = headerControlsHTML();
}

function scrLabel(s) {
  return {
    home: 'Bosh sahifa',
    groups: 'Guruhlar',
    students: "O'quvchilar",
    payments: "To'lovlar",
    grades: 'Baholar jurnali',
    attendance: 'Tezkor davomat',
    speaking: 'Speaking (1-on-1)',
    profile: 'Profil'
  }[s] || '';
}
function renderHeader() {
  const scr = state.screen;
  if (AUTH_SCREENS.indexOf(scr) >= 0) {
    return '<div class="header-inner"><span class="brand"><img class="brand-logo" src="logo.png" alt="" width="36" height="36" />English Tutor</span>' + headerControlsHTML() + '</div>';
  }
  const u = currentUser() || {};
  return `<div class="header-inner">
    <div class="brand-wrap">
      <span class="brand"><img class="brand-logo" src="logo.png" alt="" width="36" height="36" />English Tutor</span>
      <span class="brand-sub">${esc(t(scrLabel(scr)))}</span>
    </div>
    <span class="role-badge ${u.role === 'teacher' ? 'is-teacher' : 'is-student'}">${u.role === 'teacher' ? 'Muzaffar Amirov' : "O'quvchi"}</span>
    ${headerControlsHTML()}
  </div>`;
}
function navItems() {
  if (isTeacher()) {
    return [
      ['home', t('Bosh'), ICON.home],
      ['students', t("O'quvchi"), ICON.students],
      ['payments', t("To'lov"), ICON.star],
      ['grades', t('Baholar'), ICON.grades],
      ['attendance', t('Davomat'), ICON.cal],
      ['speaking', t('Speaking'), ICON.mic],
      ['profile', t('Profil'), ICON.profile]
    ];
  }
  /* O'quvchi: faqat o'z portali va profili */
  return [
    ['home', t('Kabinet'), ICON.home],
    ['profile', t('Profil'), ICON.profile]
  ];
}
function renderNav() {
  if (AUTH_SCREENS.indexOf(state.screen) >= 0) return '';
  return navItems().map(it => {
    const active = state.screen === it[0] ? ' active' : '';
    return `<button type="button" class="nav-item${active}" data-act="nav" data-screen="${it[0]}">${it[2]}<span>${it[1]}</span></button>`;
  }).join('');
}
function renderTopNavTabs() {
  const el = document.getElementById('top-nav-tabs');
  if (!el) return;
  if (AUTH_SCREENS.indexOf(state.screen) >= 0) { el.innerHTML = ''; return; }
  const labels = {
    home: 'Bosh sahifa',
    students: "O'quvchilar",
    grades: 'Baholar jurnali',
    attendance: 'Davomat',
    speaking: 'Speaking',
    profile: 'Profil',
    groups: 'Guruhlar'
  };
  el.innerHTML = navItems().map(it => {
    const active = state.screen === it[0] ? ' active' : '';
    return `<button type="button" class="top-nav-item${active}" data-act="nav" data-screen="${it[0]}">${esc(t(labels[it[0]] || it[1]))}</button>`;
  }).join('');
}

/* ==================== KIRISH EKRANI (login / parol) ==================== */
function loginScreen() {
  return `<div class="auth">
    <section class="hero">
      <img class="hero-emblem" src="logo.png" alt="Muzaffar Amirov gerbi" width="96" height="96" />
      <h1 class="hero-title">${t("Teacher Muzaffar Amirov — Ingliz tili ta'lim platformasi")}</h1>
      <p class="hero-sub">${t("Ushbu platforma Muzaffar Amirovning 5–11-sinf o'quvchilari uchun mo'ljallangan zamonaviy ta'lim va nazorat tizimidir. O'quvchilar darslarni o'zlashtirishi, vazifalar va speaking topshiriqlarini bajarishi, ota-onalar esa davomat va baholarni real vaqtda kuzatishi mumkin.")}</p>
      <div class="hero-grid hero-grid-info">
        <div class="hero-card">
          <span class="hero-ico tone-indigo">${ico('mic', 20)}</span>
          <div class="hero-card-body">
            <b>${t("Yakkama-yakka Speaking va Audio/Video tahlil")}</b>
            <span>${t("O'quvchilar mavzular bo'yicha speaking topshiriqlarini darsda yoki Telegram bot orqali ovozli xabar va krujok video shaklida yuboradilar. Har bir javob 10 ballik tizimda baholanadi va speaking qarzlari avtomatik hisoblanadi.")}</span>
          </div>
        </div>
        <div class="hero-card">
          <span class="hero-ico tone-blue">${ico('clipboardCheck', 20)}</span>
          <div class="hero-card-body">
            <b>${t("Kundalik 10 ballik elektron jurnal va Davomat")}</b>
            <span>${t("Har bir darsdagi faollik, davomat va baholar shaffof elektron jurnalga kiritiladi hamda haftalik va umumiy o'rtacha reyting avtomatik hisoblanadi.")}</span>
          </div>
        </div>
        <div class="hero-card">
          <span class="hero-ico tone-telegram" role="img" aria-label="@uzbekspeakingcheckbot">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M20.665 3.717l-17.73 6.837c-1.21.486-1.203 1.161-.222 1.462l4.552 1.42 10.532-6.645c.498-.303.953-.14.579.192l-8.533 7.701h-.002l.002.001-.314 4.692c.46 0 .663-.211.921-.46l2.211-2.15 4.599 3.397c.848.467 1.457.227 1.668-.785l3.019-14.228c.309-1.239-.473-1.8-1.282-1.434z" fill="white"/>
            </svg>
          </span>
          <div class="hero-card-body">
            <b>${t("Telegram Bot ekotizimi (@uzbekspeakingcheckbot)")}</b>
            <span>${t("Yangi uyga vazifalar, speaking eslatmalari, olingan baholar va ustoz xabarlari bevosita o'quvchining Telegram profiliga tezkor yetkaziladi.")}</span>
          </div>
        </div>
      </div>
    </section>

    <div class="card auth-card">
      <label class="field-label" for="login-input">Login</label>
      <input class="input" id="login-input" type="text" autocapitalize="none" autocorrect="off"
             autocomplete="username" placeholder="Login" />

      <label class="field-label" for="password-input">${t('Parol')}</label>
      <div class="pw-wrap">
        <input class="input" id="password-input" type="password"
               autocomplete="current-password" placeholder="••••" />
        <button type="button" class="pw-toggle" data-act="toggle-pw" data-target="password-input" aria-label="Parolni ko'rsatish">${ico('eye', 18)}</button>
      </div>
      <input type="text" name="bot_check_field" id="login-bot-hp" style="display:none !important; position:absolute; left:-9999px;" tabindex="-1" autocomplete="off" aria-hidden="true" />

      <div class="field-error${state.forcedOut ? ' show' : ''}" id="login-error">${state.forcedOut ? 'Siz ushbu qurilmadan chiqarildingiz!' : ''}</div>
      <button type="button" class="btn btn-primary btn-block" data-act="do-login">${t('Kirish')}</button>
    </div>
  </div>`;
}

/* ==================== Yordamchilar ==================== */
function emptyState(text, icoName) {
  return `<div class="empty"><span class="empty-ico">${ICON[icoName] || ICON.clipboardCheck}</span>${esc(text)}</div>`;
}
function blockedScreen(msg) {
  return `<div class="blocked"><span class="empty-ico">${ICON.lock}</span>${esc(msg)}</div>`;
}

/* ==================== BOSH SAHIFA: USTOZ ==================== */
/* ==================== UYGA VAZIFALAR ==================== */
function hwDoneMap() { return store.get(K.homeworkDone, {}) || {}; }
function isHwDone(hid) {
  const st = linkedStudent();
  if (!st) return false;
  const arr = hwDoneMap()[st.id] || [];
  return arr.some(id => String(id) === String(hid));
}

function parseAttachments(raw) {
  let v = raw;
  if (typeof v === 'string') {
    try { v = JSON.parse(v); } catch (e) { v = null; }
  }
  if (!Array.isArray(v)) return [];
  return v.filter(a => a && typeof a === 'object' && a.url).map(function (a) {
    return {
      url: String(a.url),
      type: String(a.type || 'file').toLowerCase(),
      name: String(a.name || ''),
      size: Number(a.size) || 0
    };
  });
}

/* Vazifadagi barcha biriktirmalar (eski mediaUrl ham qo'llab-quvvatlanadi) */
function hwAttachments(h) {
  const list = parseAttachments(h && h.attachments);
  if (list.length) return list;
  if (h && h.mediaUrl) {
    return [{ url: String(h.mediaUrl), type: hwMediaType(h) || 'file', name: '', size: 0 }];
  }
  return [];
}

function hwMediaType(h) {
  const t = String((h && h.mediaType) || '').toLowerCase();
  if (t === 'pdf' || t === 'file' || t === 'doc') return 'pdf';
  return (t === 'image' || t === 'video' || t === 'audio') ? t : '';
}

function attLabel(type) {
  if (type === 'video') return '🎬 Video';
  if (type === 'audio') return '🎧 Audio';
  if (type === 'image') return '🖼 Rasm';
  if (type === 'pdf' || type === 'doc' || type === 'file') return '📄 Hujjat';
  return '📎 Fayl';
}

function hwMediaHTML(h) {
  const list = hwAttachments(h);
  if (!list.length) return '';
  const videos = list.filter(a => a.type === 'video');
  const audios = list.filter(a => a.type === 'audio');
  const images = list.filter(a => a.type === 'image');
  const docs = list.filter(a => ['pdf', 'doc', 'file'].indexOf(a.type) >= 0 || !['video', 'audio', 'image'].includes(a.type));
  const videoHTML = videos.map(a => `<div class="hw-media-item">
      <video class="plyr-video" controls playsinline preload="metadata" src="${esc(a.url)}"></video>
      <div class="hw-media-bar"><span class="hw-media-tag">🎬 Video · Plyr (0.5x–2x, fullscreen, ±10s)</span></div>
    </div>`).join('');
  const audioHTML = audios.map(a => `<div class="hw-media-item">
      <audio class="plyr-audio" controls preload="metadata" src="${esc(a.url)}"></audio>
      <div class="hw-media-bar"><span class="hw-media-tag">🎧 Audio · listening uchun tezlikni o'zgartiring</span></div>
    </div>`).join('');
  const imgHTML = images.length ? `<div class="hw-gallery">${images.map(a =>
    `<a class="hw-gallery-item" href="${esc(a.url)}" target="_blank" rel="noopener"><img class="hw-media-img" src="${esc(a.url)}" alt="${esc(a.name || h.title || 'Rasm')}" loading="lazy" /></a>`
  ).join('')}</div>` : '';
  const docHTML = docs.length ? `<div class="hw-docs">${docs.map(a => {
    const isPdf = a.type === 'pdf' || /\.pdf($|\?)/i.test(a.url);
    return `<a class="hw-doc-link" href="${esc(a.url)}" target="_blank" rel="noopener" download>
      <span class="hw-doc-ico">${isPdf ? '📄' : '📎'}</span>
      <span class="hw-doc-name">${esc(a.name || (isPdf ? 'PDF fayl' : 'Fayl'))}</span>
      <span class="hw-doc-dl">⬇ Yuklab olish</span>
    </a>`;
  }).join('')}</div>` : '';
  return `<div class="hw-media">${videoHTML}${audioHTML}${imgHTML}${docHTML}</div>`;
}

function fmtSom(n) {
  const v = Math.max(0, Math.round(Number(n) || 0));
  return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}
function hwRowHTML(h) {
  const g = groupById(h.groupId);
  const chip = `<span class="chip-class">${g ? esc(g.name) : '—'}</span>`;
  const meta = h.description ? `<div class="muted small" style="margin-top:3px">${esc(h.description)}</div>` : '';
  const due = `<div class="muted small" style="margin-top:3px">${ico('calendar', 13)} ${t('Topshirish muddati')}: ${h.dueDate ? fmtDMY(h.dueDate) : '—'}</div>`;

  /* --- Ustoz: karta yuqori o'ng burchagida o'chirish tugmasi --- */
  if (isTeacher()) {
    return `<div class="hw-item">
      <div class="row between hw-head">
        <strong>${esc(h.title)}</strong>
        <span class="hw-head-right">${chip}
          <button type="button" class="hw-edit" data-act="hw-edit" data-hid="${esc(String(h.id))}" aria-label="Uyga vazifani tahrirlash">${ico('brush', 15)}</button>
          <button type="button" class="hw-del" data-act="del-hw" data-hid="${esc(String(h.id))}" aria-label="Uyga vazifani o'chirish">${ico('trash', 15)}</button>
        </span>
      </div>
      ${meta}
      ${due}
      ${hwMediaHTML(h)}
    </div>`;
  }

  /* --- O'quvchi: aylantirish checkbox (○ / ✓) + bajarildi nishoni --- */
  const done = isHwDone(h.id);
  const metaStruck = meta ? (done ? meta.replace('class="muted small"', 'class="muted small hw-struck"') : meta) : '';
  return `<div class="hw-item hw-task${done ? ' is-done' : ''}">
    <div class="hw-task-row">
      <button type="button" class="hw-check${done ? ' on' : ''}" data-act="toggle-hw"
              data-hid="${esc(String(h.id))}" aria-pressed="${done ? 'true' : 'false'}"
              aria-label="Bajarildi deb belgilash">${done ? ico('check', 15) : ''}</button>
      <div class="hw-task-body">
        <div class="row between"><strong class="${done ? 'hw-struck' : ''}">${esc(h.title)}</strong>${chip}</div>
        ${done ? `<span class="hw-done-badge">${ico('check', 12)} Bajarildi</span>` : ''}
        ${metaStruck}
        ${due}
        ${hwMediaHTML(h)}
      </div>
    </div>
  </div>`;
}

/* --- O'quvchi: vazifani bajarilgan/qayta faol holatga o'tkazish (localStorage'da saqlanadi) --- */
function toggleHwDone(hid) {
  const st = linkedStudent();
  if (!st) { toast("Ruxsat yo'q", 'error'); return; }
  const map = hwDoneMap();
  const key = String(hid);
  const arr = (map[st.id] || []).map(String);
  const i = arr.indexOf(key);
  if (i >= 0) arr.splice(i, 1); else arr.push(key);
  if (arr.length) map[st.id] = arr; else delete map[st.id];
  store.set(K.homeworkDone, map);
  const task = getHomework().filter(x => String(x.id) === key)[0] || null;
  analyticsCall('capture', 'homework_task_toggled',
    { completed: arr.indexOf(key) >= 0, has_due: !!(task && task.dueDate) });
  render();
}

/* --- Ustoz: uyga vazifani o'chirish (tasdiq modali) --- */
function openDeleteHw(hid) {
  if (!isTeacher()) { toast("Ruxsat yo'q", 'error'); return; }
  const norm = String(hid);
  const h = getHomework().filter(x => String(x.id) === norm)[0];
  if (!h) return;
  openModal(`
    <div class="modal-head">
      <h3>O'chirish</h3>
      <button type="button" class="icon-btn" data-act="close-modal" aria-label="Yopish">✕</button>
    </div>
    <div class="confirm-body">
      <div class="confirm-emoji tint-rose">${ICON.trash}</div>
      <p class="confirm-text">Haqiqatan ham ushbu uyga vazifani o'chirmoqchimisiz?</p>
      <p class="muted small" style="margin-top:7px"><strong>${esc(h.title)}</strong></p>
    </div>
    <div class="confirm-actions">
      <button type="button" class="btn btn-ghost" data-act="close-modal">Bekor qilish</button>
      <button type="button" class="btn btn-danger" data-act="do-del-hw" data-hid="${esc(norm)}">Ha, o'chirish</button>
    </div>
  `);
}

function doDeleteHw(hid) {
  if (!isTeacher()) { toast("Ruxsat yo'q", 'error'); return; }
  const norm = String(hid);
  const list = getHomework();
  const h = list.filter(x => String(x.id) === norm)[0];
  if (!h) return;

  store.set(K.homework, list.filter(x => String(x.id) !== norm));
  const hwUrls = hwAttachments(h).map(a => a.url);
  if (hwUrls.length || h.dbId != null) {
    CloudSync.deleteHomework(h.dbId, hwUrls)
      .catch(e => console.warn('[cloud] del hw:', (e && e.message) || e));
  }

  /* o'chirilgan vazifaning bajarilganlik izlarini ham tozalash */
  const map = hwDoneMap();
  let touched = false;
  Object.keys(map).forEach(sid => {
    const before = (map[sid] || []).map(String);
    const next = before.filter(id => id !== norm);
    if (next.length !== before.length) { map[sid] = next; touched = true; }
  });
  if (touched) store.set(K.homeworkDone, map);

  closeModal();
  render();
  toast("Uyga vazifa o'chirildi");
}

function homeworkListHTML(list) {
  return list.length ? list.map(hwRowHTML).join('') : emptyState("Hozircha uyga vazifa yo'q", 'clipboardCheck');
}

function openHwModal(hid, preGroup) {
  if (!isTeacher()) { toast("Ruxsat yo'q", 'error'); return; }
  const groups = getGroups();
  if (!groups.length) { toast("Avval guruh yarating", 'error'); return; }
  const cur = hid != null ? getHomework().filter(x => String(x.id) === String(hid))[0] : null;
  if (hid != null && !cur) return;
  state.hwEditId = cur ? String(cur.id) : null;
  state.hwNewFiles = [];
  state.hwAttachments = cur ? hwAttachments(cur) : [];
  revokeHwPreview();
  openModal(`
    <div class="modal-head">
      <h3>${cur ? 'Uyga vazifani tahrirlash' : "Uyga vazifa qo'shish"}</h3>
      <button type="button" class="icon-btn" data-act="close-modal" aria-label="Yopish">✕</button>
    </div>
    <label class="field-label" for="hw-group">Guruh</label>
    <select class="input" id="hw-group">
      ${groups.map(g => `<option value="${g.id}"${(cur ? cur.groupId === g.id : (preGroup && preGroup === g.id)) ? ' selected' : ''}>${esc(g.name)}</option>`).join('')}
    </select>
    <label class="field-label" for="hw-title">Mavzu</label>
    <input class="input" id="hw-title" type="text" placeholder="Masalan: Present Perfect" value="${cur ? esc(cur.title) : ''}" />
    <label class="field-label" for="hw-desc">Vazifa (tavsif)</label>
    <textarea class="input" id="hw-desc" rows="3" placeholder="Nima bajarishi kerak...">${cur ? esc(cur.description) : ''}</textarea>
    <label class="field-label" for="hw-due">Topshirish muddati</label>
    <input class="input" id="hw-due" type="date" value="${cur && cur.dueDate ? esc(cur.dueDate) : todayKey()}" />

    <div class="hw-upload">
      <label class="field-label" for="hw-media-input">📎 Fayllar biriktirish — bir nechta fayl tanlash mumkin (rasm, video, audio, pdf, doc):</label>
      <div class="hw-upload-row">
        <label class="hw-upload-btn" for="hw-media-input">
          <span class="hw-upload-ico" aria-hidden="true">📁</span>
          <span>Fayl tanlash</span>
        </label>
        <input type="file" id="hw-media-input" class="hw-file-input" multiple accept="image/*,video/*,audio/*,.mp3,.wav,.m4a,.aac,.ogg,.opus,.mp4,.mov,.webm,.pdf,.doc,.docx" />
        <button type="button" id="hw-media-clear" class="hw-upload-clear" data-act="hw-clear-file" aria-label="Tanlangan faylni bekor qilish" hidden>✕</button>
      </div>
      <p id="hw-media-status" class="hw-upload-status">Har bir fayl uchun maksimal hajm: 50MB · bir nechta fayl tanlash mumkin</p>
      <div id="hw-file-box">${hwMediaPreviewHTML(cur)}</div>
    </div>

    <div class="field-error" id="hw-error"></div>
    <div class="modal-actions">
      <button type="button" class="btn btn-ghost" data-act="close-modal">Bekor qilish</button>
      <button type="button" class="btn btn-primary" data-act="save-hw">Saqlash</button>
    </div>
  `);
  const fi = $('#hw-media-input');
  if (fi) fi.addEventListener('change', function () { onHwFilePick(fi); });
}

const HW_MAX_BYTES = 50 * 1024 * 1024; /* 50MB */
const HW_ALLOWED_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'mov', 'webm', 'avi', 'mkv', 'm4v', 'ogv', 'mp3', 'wav', 'm4a', 'aac', 'ogg', 'opus', 'oga', 'pdf', 'doc', 'docx'];
function hwFileExt(name) {
  const n = String(name || '').toLowerCase();
  return n.indexOf('.') >= 0 ? n.split('.').pop() : '';
}

/* Fayl turi: MIME bo'sh bo'lsa ham kengaytma bo'yicha aniqlanadi */
function detectMediaType(file) {
  const name = String((file && file.name) || '').toLowerCase();
  const mime = String((file && file.type) || '').toLowerCase();
  const ext = name.indexOf('.') >= 0 ? name.split('.').pop() : '';
  if (mime.indexOf('image/') === 0 || /^(png|jpe?g|gif|webp|bmp|svg|heic|heif)$/.test(ext)) return 'image';
  if (mime.indexOf('video/') === 0 || /^(mp4|mov|webm|avi|mkv|m4v|ogv)$/.test(ext)) return 'video';
  if (mime.indexOf('audio/') === 0 || /^(mp3|wav|m4a|aac|ogg|opus|oga|flac|weba)$/.test(ext)) return 'audio';
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (/word|officedocument|msword/.test(mime) || /^(doc|docx|rtf|odt)$/.test(ext)) return 'doc';
  return '';
}

function fmtFileSize(bytes) {
  const n = Number(bytes) || 0;
  if (n >= 1024 * 1024) return (n / (1024 * 1024)).toFixed(1) + ' MB';
  return Math.max(1, Math.round(n / 1024)) + ' KB';
}

function setHwStatus(text, kind) {
  const el = $('#hw-media-status');
  if (!el) return;
  el.textContent = text;
  el.classList.remove('err', 'busy');
  if (kind === 'err') el.classList.add('err');
  if (kind === 'busy') el.classList.add('busy');
}

function currentHw() {
  return state.hwEditId
    ? getHomework().filter(x => String(x.id) === String(state.hwEditId))[0] || null
    : null;
}

function revokeHwPreview() {
  (state.hwNewFiles || []).forEach(function (f) {
    if (f && f.preview && window.URL && URL.revokeObjectURL) {
      try { URL.revokeObjectURL(f.preview); } catch (e) { /* ignore */ }
    }
  });
  state.hwPreviewUrl = null;
}

/* Modal ichidagi biriktirmalar ro'yxati: mavjudlar + hali yuklanmaganlar */
function hwMediaPreviewHTML(cur) {
  const existing = Array.isArray(state.hwAttachments) ? state.hwAttachments : hwAttachments(cur);
  const fresh = state.hwNewFiles || [];
  if (!existing.length && !fresh.length) {
    return `<div class="hw-file-empty">Hozircha fayl biriktirilmagan</div>`;
  }
  const row = function (a, idx, isNew) {
    const type = isNew ? a.type : String(a.type || 'file');
    const name = isNew ? a.file.name : (a.name || (String(a.url).split('/').pop() || 'Fayl'));
    const size = isNew ? a.file.size : (Number(a.size) || 0);
    return `<div class="hw-file-row">
      ${isNew && a.preview ? `<img class="hw-file-thumb" src="${a.preview}" alt="" />` : `<span class="hw-file-type">${attLabel(type)}</span>`}
      <span class="hw-file-name">${esc(name)}</span>
      <span class="hw-file-size">${size ? fmtFileSize(size) : ''}</span>
      <button type="button" class="btn btn-xs danger" data-act="hw-remove-att"
              data-kind="${isNew ? 'new' : 'existing'}" data-idx="${idx}">✕ O'chirish</button>
    </div>`;
  };
  return `<div class="hw-file-preview">
    <div class="hw-file-preview-head">Biriktirilgan fayllar (${existing.length + fresh.length})</div>
    ${existing.map((a, i) => row(a, i, false)).join('')}
    ${fresh.map((a, i) => row(a, i, true)).join('')}
  </div>`;
}

function refreshHwPreview() {
  const box = $('#hw-file-box');
  if (box) box.innerHTML = hwMediaPreviewHTML(currentHw());
  const clearBtn = $('#hw-media-clear');
  if (clearBtn) clearBtn.hidden = !(state.hwNewFiles || []).length;
}

/* Bir nechta faylni tanlash: har biri tekshiriladi va navbatga qo'shiladi */
function onHwFilePick(inp) {
  const files = Array.from((inp && inp.files) || []);
  if (inp) inp.value = '';
  if (!files.length) { refreshHwPreview(); return; }
  let added = 0;
  const errors = [];
  const addedNames = [];
  const typeLabel = { video: 'Video', audio: 'Audio', image: 'Rasm', pdf: 'PDF', doc: 'Word' };
  files.forEach(function (f) {
    /* Xavfli va tasdiqlanmagan kengaytmalar darhol bloklanadi */
    if (HW_ALLOWED_EXTS.indexOf(hwFileExt(f.name)) < 0) {
      errors.push(f.name + ' — fayl turi taqiqlangan');
      return;
    }
    if (Number(f.size) > HW_MAX_BYTES) {
      errors.push('Fayl hajmi 50 MB dan oshmasligi kerak!');
      return;
    }
    const type = detectMediaType(f);
    if (!type) { errors.push(f.name + ' — turi qo\'llab-quvvatlanmaydi'); return; }
    const preview = (type === 'image' && window.URL && URL.createObjectURL) ? URL.createObjectURL(f) : '';
    state.hwNewFiles.push({ file: f, type: type, preview: preview });
    added += 1;
    addedNames.push(f.name + ' (' + (typeLabel[type] || 'Fayl') + ')');
  });
  refreshHwPreview();
  if (errors.length) {
    setHwStatus('❌ ' + errors.join('; '), 'err');
  } else {
    setHwStatus('✅ ' + added + ' ta fayl tanlandi: ' + addedNames.join(', '));
  }
}

/* Faqat hali yuklanmagan tanlovni bekor qiladi */
function clearHwFilePick() {
  revokeHwPreview();
  state.hwNewFiles = [];
  refreshHwPreview();
  setHwStatus("Har bir fayl uchun maksimal hajm: 50MB · bir nechta fayl tanlash mumkin");
}

/* Mavjud biriktirmani darhol o'chiradi (Storage + baza), yangisini navbatdan oladi */
function removeHwAttachment(kind, idx) {
  if (!isTeacher()) { toast("Ruxsat yo'q", 'error'); return; }
  const i = Number(idx);
  if (kind === 'new') {
    const f = state.hwNewFiles[i];
    if (f && f.preview && window.URL && URL.revokeObjectURL) {
      try { URL.revokeObjectURL(f.preview); } catch (e) { /* ignore */ }
    }
    state.hwNewFiles.splice(i, 1);
    refreshHwPreview();
    return;
  }
  const att = state.hwAttachments[i];
  if (!att) return;
  state.hwAttachments.splice(i, 1);
  const cur = currentHw();
  if (cur) {
    const updated = Object.assign({}, cur, {
      attachments: state.hwAttachments.slice(),
      mediaUrl: state.hwAttachments.length ? state.hwAttachments[0].url : '',
      mediaType: state.hwAttachments.length ? state.hwAttachments[0].type : ''
    });
    store.set(K.homework, getHomework().map(x => String(x.id) === String(cur.id) ? updated : x));
    CloudSync.pushHomework(updated);
  }
  CloudSync.removeHomeworkMedia(att.url);
  refreshHwPreview();
  toast("Fayl o'chirildi");
}

function saveHomework() {
  if (!isTeacher()) { toast("Ruxsat yo'q", 'error'); return; }
  const gid = $('#hw-group') ? $('#hw-group').value : '';
  const title = $('#hw-title') ? $('#hw-title').value.trim() : '';
  const desc = $('#hw-desc') ? $('#hw-desc').value.trim() : '';
  const due = $('#hw-due') ? $('#hw-due').value : '';
  const err = $('#hw-error');
  if (!title) {
    if (err) { err.textContent = "Mavzuni kiriting"; err.classList.add('show'); }
    return;
  }
  const btn = $('[data-act="save-hw"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Yuklanmoqda...'; }
  const pending = (state.hwNewFiles || []).map(x => x.file);

  const finish = function (uploaded) {
    const attachments = (state.hwAttachments || []).concat(uploaded);
    const primary = attachments[0] || null;
    const payload = {
      groupId: gid || null, title: title, description: desc, dueDate: due,
      attachments: attachments,
      mediaUrl: primary ? primary.url : '',
      mediaType: primary ? primary.type : ''
    };
    const editId = state.hwEditId;
    const existing = editId ? getHomework().filter(x => String(x.id) === String(editId))[0] : null;
    let hw;
    if (existing) {
      hw = Object.assign({}, existing, payload);
      store.set(K.homework, getHomework().map(x => String(x.id) === String(existing.id) ? hw : x));
    } else {
      hw = Object.assign({ id: 'h' + Date.now(), dbId: null, createdAt: new Date().toISOString() }, payload);
      const list = getHomework(); list.unshift(hw); store.set(K.homework, list);
    }
    CloudSync.pushHomework(hw);
    state.hwEditId = null;
    state.hwNewFiles = [];
    state.hwAttachments = [];
    closeModal();
    render();
    toast(existing ? 'Uyga vazifa yangilandi ✓' : "Uyga vazifa qo'shildi");
  };

  if (!pending.length) { finish([]); return; }

  setHwStatus("⏳ " + pending.length + " ta fayl yuklanmoqda... (uzun videoda biroz kutish mumkin)", 'busy');
  const uploaded = [];
  const chain = pending.reduce(function (p, file) {
    return p.then(function () {
      return CloudSync.uploadHomeworkMedia(file).then(function (res) {
        uploaded.push({
          url: res.url, type: detectMediaType(file),
          name: file.name, size: Number(file.size) || 0
        });
        setHwStatus("⏳ Yuklanmoqda... " + uploaded.length + "/" + pending.length, 'busy');
      });
    });
  }, Promise.resolve());

  chain.then(function () {
    setHwStatus("✅ " + uploaded.length + " ta fayl yuklandi");
    revokeHwPreview();
    state.hwNewFiles = [];
    finish(uploaded);
  }).catch(function (e) {
    if (btn) { btn.disabled = false; btn.textContent = 'Saqlash'; }
    if (err) { err.textContent = "Faylni yuklab bo'lmadi: " + ((e && e.message) || 'xatolik'); err.classList.add('show'); }
    setHwStatus("❌ Yuklashda xatolik: " + ((e && e.message) || 'xatolik'), 'err');
  });
}

/* ==================== AVTOMATIK OYLIK TO'LOV ==================== */
function currentPeriod() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}
/* Har oy boshida guruh oylik to'lovini o'quvchi qarziga bir marta qo'shadi */
function applyMonthlyFees() {
  if (!isTeacher()) return 0;
  const period = currentPeriod();
  let changed = 0;
  const list = getStudents().map(function (s) {
    const g = groupById(s.groupId);
    /* Maktab guruhi — bepul: oylik to'lov qarzga qo'shilmaydi */
    const fee = (g && !isSchoolGroup(g)) ? feeForGroup(g.id, period) : 0;
    if (!fee || s.feePeriod === period) return s;
    changed += 1;
    return Object.assign({}, s, {
      paymentDebt: Math.max(0, Number(s.paymentDebt) || 0) + fee,
      feePeriod: period
    });
  });
  if (!changed) return 0;
  store.set(K.students, list);
  list.forEach(function (s) { if (s.feePeriod === period) CloudSync.pushStudent(s.id); });
  return changed;
}

const MONTHS_UZ = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
  'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];

function monthLabel(period) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(period || ''));
  if (!m) return String(period || '');
  const idx = Number(m[2]) - 1;
  return (MONTHS_UZ[idx] || m[2]) + ' ' + m[1];
}

function paymentPeriod(p) {
  return String((p && p.period) || String((p && p.createdAt) || '').slice(0, 7) || '');
}

/* Guruh uchun oy summasi: monthly_fees jadvali, bo'lmasa legacy monthlyFee */
function feeForGroup(gid, period) {
  const row = getMonthlyFees().filter(function (x) { return x.gid === gid && x.period === period; })[0];
  if (row) return Math.max(0, Number(row.amount) || 0);
  const g = groupById(gid);
  return g ? Math.max(0, Number(g.monthlyFee) || 0) : 0;
}

function paidFor(sid, period) {
  return getPayments().filter(function (p) { return p.sid === sid && paymentPeriod(p) === period; })
    .reduce(function (a, p) { return a + (Number(p.amount) || 0); }, 0);
}

function studentPayments(sid) {
  return getPayments().filter(function (p) { return p.sid === sid; }).sort(function (a, b) {
    return String(paymentPeriod(b) + b.createdAt).localeCompare(String(paymentPeriod(a) + a.createdAt));
  });
}

function tutoringStudents() {
  return getStudents().filter(function (s) {
    const g = groupById(s.groupId);
    return !!g && groupTypeOf(g) === 'tutoring';
  });
}

/* O'quvchi kabineti: to'lovlar tarixi */
function payHistoryHTML(st) {
  const rows = getPayments().filter(function (p) { return p.sid === st.id; })
    .sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });
  if (!rows.length) return `<div class="empty"><span class="empty-ico">💵</span>Hozircha to'lov yo'q</div>`;
  return `<div class="pay-history att-scroll">${rows.map(function (p) {
    const d = String(p.createdAt || '').slice(0, 10);
    return `<div class="att-line">
      <span class="gr-date">${d ? fmtDM(d) : '—'}</span>
      <span class="col"><strong>${fmtSom(p.amount)} so'm</strong>${p.note ? `<span class="gr-note">${esc(p.note)}</span>` : ''}</span>
    </div>`;
  }).join('')}</div>`;
}

function teacherHome() {
  applyMonthlyFees();
  const groups = getGroups();
  const students = getStudents();
  const classSet = {};
  students.forEach(s => { classSet[s.schoolClass] = 1; });
  const u = currentUser() || {};
  const name = u.name || TEACHER_NAME;
  const recent = students.slice(0, 3);

  return `
  <section class="card hero-card">
    <div class="greet-main">
      <div class="avatar avatar-lg">${esc(initials(name))}</div>
      <div class="col">
        <div class="greet-hi">Xush kelibsiz,</div>
        <div class="greet-name">${esc(name)}</div>
        <span class="role-badge is-teacher">Muzaffar Amirov</span>
      </div>
    </div>
  </section>

  <div class="stat-grid">
    <button type="button" class="card stat" data-act="stat-groups"><span class="stat-ico">${ICON.groups}</span><span class="stat-num">${groups.length}</span><span class="stat-label">Guruhlar</span></button>
    <button type="button" class="card stat" data-act="stat-students"><span class="stat-ico">${ICON.students}</span><span class="stat-num">${students.length}</span><span class="stat-label">O'quvchilar</span></button>
    <button type="button" class="card stat" data-act="stat-classes"><span class="stat-ico">${ICON.cal}</span><span class="stat-num">${Object.keys(classSet).length}</span><span class="stat-label">Sinflar</span></button>
  </div>

  <div class="section-title">Tez amallar</div>
  <div class="quick-grid">
    <button type="button" class="card quick" data-act="nav" data-screen="grades"><span class="quick-ico tint-indigo">${ICON.grades}</span><span>Baholar jurnali</span></button>
    <button type="button" class="card quick" data-act="nav" data-screen="attendance"><span class="quick-ico tint-emerald">${ICON.cal}</span><span>Tezkor davomat</span></button>
    <button type="button" class="card quick" data-act="nav" data-screen="speaking"><span class="quick-ico tint-sky">${ICON.mic}</span><span>Speaking slotlari</span></button>
    <button type="button" class="card quick" data-act="nav" data-screen="students"><span class="quick-ico tint-amber">${ICON.gradCap}</span><span>O'quvchilar</span></button>
    <button type="button" class="card quick" data-act="nav" data-screen="groups"><span class="quick-ico tint-purple">${ICON.groups}</span><span>Guruhlar</span></button>
    <button type="button" class="card quick" data-act="open-add-student"><span class="quick-ico tint-slate">${ICON.userPlus}</span><span>O'quvchi qo'shish</span></button>
  </div>

  <div class="screen-head" style="margin-top:6px">
    <div>
      <h2 class="screen-title">${ico('bookOpen', 20)} ${t('Uyga vazifalar')}</h2>
      <div class="muted small">Vazifalar guruh sahifasida joylashadi</div>
    </div>
  </div>
  <button type="button" class="btn btn-primary btn-block" data-act="open-hw">${ico('bookOpen', 16)} Uyga vazifa berish</button>
  <div class="muted small" style="margin-top:6px">Berilgan vazifalar guruh sahifasida ko'rinadi.</div>

  <div class="section-title">So'nggi o'quvchilar</div>
  ${recent.length ? recent.map(studentCard).join('') : emptyState("Hozircha o'quvchi yo'q", 'students')}
  <button type="button" class="btn btn-ghost btn-block" data-act="nav" data-screen="students">Barchasini ko'rish</button>
  `;
}

/* ==================== BOSH SAHIFA: O'QUVCHI KABINETI ==================== */
function studentPortal() {
  const u = currentUser() || {};
  const st = linkedStudent();

  if (!st) {
    return `
    <section class="card profile-head">
      <div class="avatar avatar-xl">${esc(initials(u.name || "O'quvchi"))}</div>
      <div class="profile-name">${esc(u.name || "O'quvchi")}</div>
      <div class="muted">${esc(u.login || '')}</div>
      <div style="margin-top:9px"><span class="role-badge is-student">O'quvchi</span></div>
    </section>
    <div class="section-title">Mening ma'lumotlarim</div>
    <div class="card">${blockedScreen("Profilingiz guruhga biriktirilmagan. Muzaffar Amirov bilan bog'laning.")}</div>
    `;
  }

  const g = groupById(st.groupId);
  const school = isSchoolGroup(g);
  const hideMoney = !isTeacher() && school;
  const gradeRec = getGrades()[st.id] || {};
  const attRec = getAttendance();

  /* --- To'lov banneri (faqat repetitorlik guruhlarida, eng yuqorida) --- */
  const per = currentPeriod();
  const currentDebt = Math.max(0, Number(st.paymentDebt) || 0);
  const hasDebt = currentDebt > 0;
  const payRows = studentPayments(st.id);
  const receipts = store.get(K.paymentReceipts, []);
  const pendingReceipt = receipts.filter(function (r) {
    return (r.month_key === per || !r.month_key) && r.status === 'kutilmoqda';
  })[0];
  const rejectedReceipt = !pendingReceipt ? receipts.filter(function (r) {
    return (r.month_key === per || !r.month_key) && r.status === 'rad_etildi';
  })[0] : null;

  /* Faqatgina so'nggi to'lov qatori */
  let lastPayHTML = '<div class="pay-last-line muted small" style="margin-top:8px">Hozircha to\'lovlar mavjud emas</div>';
  if (st.lastPaymentInfo) {
    lastPayHTML = `<div class="pay-last-line" style="margin-top:8px;font-size:13px;color:var(--text,#1e293b)">
      🗓 <b>So'nggi to'lov:</b> ${esc(st.lastPaymentInfo)} qabul qilindi
    </div>`;
  } else if (payRows.length > 0) {
    const lp = payRows[0];
    const lpDate = lp.createdAt ? fmtDMY(lp.createdAt.slice(0, 10)) : fmtDMY(todayKey());
    const lpMonth = lp.note ? lp.note.replace(" uchun to'lov", "") : monthLabel(paymentPeriod(lp));
    lastPayHTML = `<div class="pay-last-line" style="margin-top:8px;font-size:13px;color:var(--text,#1e293b)">
      🗓 <b>So'nggi to'lov:</b> ${lpDate} da ${fmtSom(lp.amount)} so'm (${esc(lpMonth)} uchun qabul qilindi)
    </div>`;
  }

  const payBanner = hideMoney ? '' : `
  <section class="card pay-banner ${hasDebt ? 'due' : 'ok'}">
    <div class="pay-banner-main">
      ${hasDebt
        ? `🔴 <b>Diqqat:</b> Sizda <b>${fmtSom(currentDebt)} so'm</b> to'lov qarzdorligi mavjud!`
        : `🟢 <b>To'langan</b> <span class="muted">(Qarzdorlik mavjud emas)</span>`}
    </div>
    ${pendingReceipt ? `
    <div class="pay-pending-alert" style="margin:8px 0;padding:8px 12px;background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;color:#92400e;font-size:13px">
      ⏳ <b>To'lov cheki ko'rib chiqilmoqda!</b> Ustoz tasdiqlashi bilan qarzingiz o'chiriladi.
    </div>` : ''}
    ${rejectedReceipt ? `
    <div class="pay-rejected-alert" style="margin:8px 0;padding:8px 12px;background:#fee2e2;border:1px solid #ef4444;border-radius:8px;color:#991b1b;font-size:13px">
      ❌ <b>Chekingiz rad etildi:</b> ${esc(rejectedReceipt.note || "Noto'g'ri chek")}. Iltimos, qaytadan to'g'ri chekni yuklang:
    </div>` : ''}
    ${hasDebt && !pendingReceipt ? `
    <div style="margin:10px 0 6px 0">
      <button type="button" class="btn btn-primary btn-block" data-act="open-pay-receipt" data-amount="${currentDebt}" data-period="${esc(per)}">
        💳 Karta orqali to'lash
      </button>
    </div>` : ''}
    ${lastPayHTML}
  </section>`;

  /* --- Davomat --- */
  const ownAtt = [];
  Object.keys(attRec).sort().reverse().forEach(dk => {
    const v = attRec[dk][st.id];
    if (v) ownAtt.push({ date: dk, status: v });
  });
  const cnt = { present: 0, absent: 0, excused: 0 };
  ownAtt.forEach(a => { cnt[a.status] = (cnt[a.status] || 0) + 1; });
  const statusLabel = { present: 'Keldi', absent: 'Kelmadi', excused: 'Sababli' };
  const attLine = a => `
    <div class="att-line">
      <span class="gr-date">${fmtDM(a.date)}</span>
      <span class="att-tag on-${a.status}">${statusLabel[a.status]}</span>
    </div>`;
  const attRows = ownAtt.length ? ownAtt.map(attLine).join('') : `<div class="empty"><span class="empty-ico">${ICON.cal}</span>Davomat yozuvi yo'q</div>`;
  const attLastRows = ownAtt.length ? ownAtt.slice(0, 3).map(attLine).join('') : attRows;
  const attPct = ownAtt.length ? Math.round((cnt.present * 100) / ownAtt.length) : 0;
  const attMissed = (cnt.absent || 0) + (cnt.excused || 0);

  /* --- Speaking --- */
  const mineSlots = getSpeaking()
    .filter(x => x.studentId === st.id)
    .sort((a, b) => (b.date + b.start).localeCompare(a.date + a.start))
    .slice(0, 6);
  const slotRows = mineSlots.length ? mineSlots.map(x => `
    <div class="att-line">
      <span class="gr-date">${fmtDM(x.date)}</span>
      <span class="col">
        <strong>${esc(x.start)} – ${esc(x.end)}</strong>
        <span class="gr-note">1-on-1 speaking</span>
      </span>
      <span class="slot-badge ${x.score == null ? 'wait' : 'done'}">${x.score == null ? 'Kutilmoqda' : 'Baho: ' + x.score}</span>
    </div>`).join('') : `<div class="empty"><span class="empty-ico">${ICON.mic}</span>Hozircha slot biriktirilmagan</div>`;

  const myTg = getTgSubs().filter(x => x.sid === st.id).slice().reverse();
  const mySubs = myTg.map(t => `
    <div class="audio-item">
      <div class="audio-item__meta">
        ${t.mediaType === 'voice' ? ico('mic', 14) + ' Ovozli xabar' : ico('video', 14) + ' Video'} ·
        ${t.status === 'baholandi' || t.status === 'graded'
          ? `${ico('checkCircle', 14)} Baho: ${t.score}/10`
          : t.status === 'rad_etildi'
            ? `${ico('alert', 14)} Topshiriq bekor qilindi`
            : `${ico('clock', 14)} Muzaffar Amirov ko'rib chiqmoqda`}
      </div>
    </div>`).join('') || `<div class="empty"><span class="empty-ico">${ICON.mic}</span>Hozircha topshirilmagan</div>`;

  /* --- Uyga vazifalar --- */
  const myHw = getHomework().filter(h => h.groupId && h.groupId === st.groupId);

  /* --- Baholar --- */
  const gradeKeys = Object.keys(gradeRec).sort().reverse();
  const nums = gradeKeys.map(k => gradeRec[k].score);
  const avg = avgOf(nums);
  const gradeRows = gradeKeys.length ? gradeKeys.map(k => {
    const r = gradeRec[k];
    return `<div class="grade-row">
      <span class="gr-date">${fmtDM(k)}</span>
      <span class="gr-score ${gradeClassOf(r.score)}">${r.score}</span>
      <span class="gr-main">
        <div>${esc(r.category || 'Darsdagi javob')}</div>
        ${r.note ? `<div class="gr-note">${esc(r.note)}</div>` : ''}
      </span>
    </div>`;
  }).join('') : `<div class="empty"><span class="empty-ico">${ICON.grades}</span>Hozircha baho yo'q</div>`;

  return `
  <section class="card hero-card">
    <div class="portal-head">
      <div class="avatar avatar-lg">${esc(initials(st.fullName))}</div>
      <div class="col">
        <div class="greet-name">${esc(st.fullName)}</div>
        <div class="portal-meta">
          <span class="chip-class">${esc(st.schoolClass)}</span>
          <span class="pill">${g ? esc(g.name) : 'Guruh taylanmagan'}</span>
        </div>
      </div>
    </div>
  </section>
  ${payBanner}

  <div class="section-title">${ico('cal', 13)} Mening davomatim</div>
  <div class="card att-card">
    <div class="row between att-head">
      <div class="col">
        <div class="strong-label">📅 Davomat: ${attPct}% qatnashgan (${attMissed} ta qoldirilgan)</div>
        <div class="muted small">${cnt.present} keldi · ${cnt.absent} kelmadi · ${cnt.excused} sababli</div>
      </div>
      <button type="button" class="btn btn-xs ghost att-toggle" data-act="att-toggle" aria-expanded="${!!state.attOpen}">${state.attOpen ? '▴ Yopish' : '▾ Ochish'}</button>
    </div>
    ${state.attOpen ? `<div class="att-scroll">${attRows}</div>
    <button type="button" class="btn btn-xs ghost btn-block" data-act="att-toggle">▴ Yopish</button>`
    : `<div class="att-last">${attLastRows}</div>
    <button type="button" class="btn btn-xs ghost btn-block" data-act="att-toggle">▾ Barchasini ko'rish</button>`}
  </div>

  <div class="section-title">${hideMoney ? '🎙 Speaking topshirish' : '🎙 Speaking qarzdorligi va topshirish'}</div>
  <div class="card">
    ${hideMoney ? '' : (Number(st.speakingDebt) > 0
      ? `<div class="debt-badge" style="margin-bottom:8px">${ico('alert', 15)} Speaking qarzingiz: ${Number(st.speakingDebt)} ta</div>`
      : `<div class="att-pill" style="margin-bottom:8px">${ico('checkCircle', 15)} Speaking qarzingiz yo'q</div>`)}
    <button type="button" class="btn btn-primary btn-block speak-cta" data-act="speak-cta">${ico('mic', 20)} Speaking topshirish</button>
    ${slotRows}
  </div>

  <div class="card" style="margin-top:9px">
    <div class="strong-label" style="margin-bottom:5px">Telegram orqali topshirish</div>
    <div class="muted small">${ico('mic', 14)} Muzaffar Amirovga <b>Telegram botga</b> ovozli xabar (voice) yoki dumaloq video (krujok) yuboring — brauzerda yozish shart emas.</div>
    <div class="hw-item small" style="margin-top:8px">1) Telegramda botga kiring → 2) ${ico('mic', 13)} ovozli xabar yuboring → 3) Muzaffar Amirov baholaydi</div>
    <div id="my-submissions" class="audio-list">${mySubs}</div>
  </div>

  <div class="section-title">${ico('bookOpen', 13)} Uyga vazifalar</div>
  <div class="card">${homeworkListHTML(myHw)}</div>

  <div class="section-title">📊 Baholar va natijalar</div>
  <div class="card avg-card">
    <div class="col">
      <div class="strong-label">O'rtacha baho</div>
      <div class="muted small">${nums.length} ta baholangan dars</div>
    </div>
    <div class="avg-badge ${avg == null ? 'g-empty' : gradeClassOf(avg)}">
      <span class="avg-num">${fmtAvg(avg)}</span>
      <span class="avg-lab">/ 10</span>
    </div>
  </div>
  <div class="card">${gradeRows}</div>

  <div class="section-title">Muzaffar Amirov bilan Chat</div>
  <div class="card chat-card">
    ${chatHint()}
    <div class="chat-list" id="chat-list">${chatListHTML(st.id, 'student')}</div>
    <div class="chat-input-row">
      <input class="input" id="chat-input" placeholder="Muzaffar Amirovga xabar yozing..." autocomplete="off" />
      <button type="button" class="btn btn-primary" data-act="send-chat">Yuborish</button>
    </div>
  </div>

  <div class="section-title">Sozlamalar</div>
  <div class="card">
    <div class="list-row"><span>Login</span><span class="login-val">${esc(u.login || '')}</span></div>
    <div class="list-row"><span>${t('Parol')}</span><span class="muted">••••</span></div>
  </div>
  <button type="button" class="btn btn-ghost btn-block" data-act="open-change-pwd">${ico('key', 16)} ${t("Parolni o'zgartirish")}</button>
  `;
}

function homeScreen() { return isTeacher() ? teacherHome() : studentPortal(); }

/* ==================== GURUHLAR (faqat ustoz) ==================== */
/* Kunlar stringi: "Dushanba 09:15, Shanba 11:00" → kun+vaqt; eski "Dushanba" → vaqtsiz */
function parseGroupDays(g) {
  return String(g && g.days || '').split(',').map(function (x) {
    const t = x.trim().replace(/\s+/g, ' ');
    if (!t) return null;
    const p = t.split(' ');
    return { day: p[0], time: p.slice(1).join(' ') };
  }).filter(Boolean);
}
/* Hammasida vaqt bo'lsa → "Dushanba 09:15 • Shanba 11:00", aks holda null (eski format) */
function groupScheduleText(g) {
  const list = parseGroupDays(g);
  if (list.length && list.every(x => x.time)) {
    return list.map(x => x.day + ' ' + x.time).join(' • ');
  }
  return null;
}

/* Guruh turi: 'school' (maktab, bepul) yoki 'tutoring' (repetitorlik).
   FAQAT ustoz panelida ko'rsatiladi — o'quvchiga hech qachon chiqmaydi. */
function groupTypeOf(g) {
  /* Yangi guruhlar modalda 'school' bo'lib saqlanadi; eski (maydonsiz)
     guruhlar esa repetitorlik hisoblanadi — to'lovlari yashirilib qolmasin. */
  return (g && g.groupType === 'school') ? 'school' : 'tutoring';
}
function isSchoolGroup(g) {
  return groupTypeOf(g) === 'school';
}

function groupCard(g, students) {
  const cnt = students.filter(s => s.groupId === g.id).length;
  const sched = groupScheduleText(g);
  const fee = Math.max(0, Number(g.monthlyFee) || 0);
  const tutoring = groupTypeOf(g) === 'tutoring';
  return `<div class="card group-card" data-act="filter-group" data-gid="${g.id}" style="cursor:pointer" role="button" title="O'quvchilarni ko'rsatish">
    <div class="row between">
      <h3 class="card-h">${esc(g.name)}</h3>
      <span class="pill">${cnt} o'quvchi</span>
    </div>
    <div class="gc-type ${tutoring ? 'is-tutoring' : 'is-school'}">${tutoring ? '🎓 Repetitor guruhi' : '🏫 Maktab guruhi'}</div>
    <div class="meta-rows">
      ${sched
        ? `<div class="meta-row">${ico('calendar', 15)} <span>${esc(sched)}</span></div>`
        : `<div class="meta-row">${ico('calendar', 15)} <span>${esc(g.days)}</span></div>
           <div class="meta-row">${ico('clock', 15)} <span>${esc(g.time)}</span></div>`}
    </div>
    <div class="gc-fee">${tutoring
      ? `💵 Oylik to'lov: ${fee > 0 ? `<b>${fmtSom(fee)} so'm</b>` : `<span class="muted">belgilanmagan</span>`}`
      : `🎁 <b>Bepul</b> <span class="muted">(maktab guruhi)</span>`}</div>
    <div class="muted small" style="margin-top:7px">Bosib, guruh o'quvchilarini ko'rish</div>
    <div class="gc-actions">
      <button type="button" class="btn btn-ghost btn-sm" data-act="grade-group-go" data-group="${g.id}">${ico('grades', 15)} Baholar</button>
      <button type="button" class="btn btn-ghost btn-sm" data-act="open-attendance" data-group="${g.id}">${ico('cal', 15)} Davomat</button>
      <button type="button" class="btn btn-ghost btn-sm" data-act="edit-group" data-gid="${g.id}">${ico('brush', 15)} Tahrirlash</button>
      <button type="button" class="btn btn-danger btn-sm" data-act="del-group" data-gid="${g.id}">${ico('trash', 15)} O'chirish</button>
    </div>
  </div>`;
}

/* ==================== TO'LOVLAR BO'LIMI (faqat ustoz) ==================== */
function paymentsScreen() {
  if (!isTeacher()) return blockedScreen("Bu bo'lim faqat Muzaffar Amirov uchun");
  if (!/^\d{4}-\d{2}$/.test(state.payMonth || '')) state.payMonth = currentPeriod();
  const period = state.payMonth;
  const groups = getGroups().filter(g => groupTypeOf(g) === 'tutoring');
  const list = tutoringStudents();
  let expected = 0, collected = 0;
  const rows = list.map(function (s) {
    const g = groupById(s.groupId);
    const fee = feeForGroup(s.groupId, period);
    const paid = paidFor(s.id, period);
    const debt = Math.max(0, Number(s.paymentDebt) || 0);
    const isDue = debt > 0;
    expected += fee; collected += paid;
    return `<div class="card pay-row">
      <div class="row between pay-row-head">
        <div class="col">
          <span class="s-name">${esc(s.fullName)}</span>
          <div class="muted small">${g ? esc(g.name) : '—'}</div>
        </div>
        <span class="pay-status ${isDue ? 'due' : 'ok'}">${isDue ? `${fmtSom(debt)} so'm qarz` : "🟢 To'langan"}</span>
      </div>
      <div class="pay-row-meta">
        <span>Oylik: <b>${fee ? fmtSom(fee) + " so'm" : 'belgilanmagan'}</b></span>
        <span>Joriy qarz: <b style="color:${isDue ? '#ef4444' : '#10b981'}">${fmtSom(debt)} so'm</b></span>
      </div>
      <div class="pay-actions">
        <button type="button" class="btn btn-xs btn-primary" data-act="pay-student"
                data-sid="${s.id}" data-period="${esc(period)}">💵 To'lov kiritish</button>
        <button type="button" class="btn btn-xs ghost" data-act="debt-add" data-sid="${s.id}">➕ Qarz qo'shish</button>
        <button type="button" class="btn btn-xs ghost" data-act="remind-student" data-sid="${s.id}">🔔 Eslatma yuborish</button>
        <button type="button" class="btn btn-xs ghost" data-act="fee-schedule" data-gid="${s.groupId}">🗓 Oylik jadval</button>
      </div>
    </div>`;
  }).join('');
  return `
  <div class="screen-head">
    <div>
      <h2 class="screen-title">💳 To'lovlar</h2>
      <div class="muted small">${list.length} nafar repetitor o'quvchisi · ${monthLabel(period)}</div>
    </div>
  </div>
  <div class="card pay-summary">
    <label class="field-label" for="pay-month">Oy</label>
    <input class="input" id="pay-month" type="month" value="${esc(period)}" />
    <div class="pay-summary-grid">
      <div><span class="muted small">Kutilgan</span><b>${fmtSom(expected)} so'm</b></div>
      <div><span class="muted small">Yig'ilgan</span><b>${fmtSom(collected)} so'm</b></div>
      <div><span class="muted small">Qolgan</span><b>${fmtSom(Math.max(0, expected - collected))} so'm</b></div>
    </div>
  </div>
  <button type="button" class="btn btn-ghost btn-block" data-act="nav" data-screen="debtors">💳 Qarzdorlar ro'yxati</button>
  ${rows || emptyState("Repetitorlik o'quvchisi yo'q", 'students')}

  <div class="section-title">🗓 Guruhlar oylik to'lov jadvali</div>
  ${groups.length ? groups.map(function (g) {
    const fee = feeForGroup(g.id, period);
    return `<div class="card row between pay-row">
      <div class="col"><b>${esc(g.name)}</b><span class="muted small">${monthLabel(period)}: ${fee ? fmtSom(fee) + " so'm" : 'belgilanmagan'}</span></div>
      <button type="button" class="btn btn-xs ghost" data-act="fee-schedule" data-gid="${g.id}">Belgilash</button>
    </div>`;
  }).join('') : emptyState("Repetitorlik guruhi yo'q", 'groups')}
  `;
}

/* Guruh uchun oylar bo'yicha to'lov summasini belgilash */
function openFeeSchedule(gid) {
  if (!isTeacher()) { toast("Ruxsat yo'q", 'error'); return; }
  const g = groupById(gid);
  if (!g) return;
  if (isSchoolGroup(g)) { toast("Maktab guruhi bepul — jadval kerak emas", 'error'); return; }
  const rows = getMonthlyFees().filter(function (x) { return x.gid === gid; })
    .sort(function (a, b) { return String(b.period).localeCompare(String(a.period)); });
  openModal(`
    <div class="modal-head">
      <h3>${esc(g.name)} — oylik to'lovlar</h3>
      <button type="button" class="icon-btn" data-act="close-modal" aria-label="Yopish">✕</button>
    </div>
    <div class="muted small">Har bir oy uchun alohida summa belgilang. Kiritilmagan oyda guruhning eski oylik summasi ishlatiladi.</div>
    <div class="fee-list">
      ${rows.length ? rows.map(function (x) {
        return `<div class="fee-row">
          <span class="fee-period">${monthLabel(x.period)}</span>
          <b>${fmtSom(x.amount)} so'm</b>
          <button type="button" class="btn btn-xs danger" data-act="fee-del"
                  data-gid="${gid}" data-period="${esc(x.period)}">✕</button>
        </div>`;
      }).join('') : `<div class="muted small" style="margin:8px 0">Hozircha oylar belgilanmagan</div>`}
    </div>
    <label class="field-label" for="fee-period">Oy</label>
    <input class="input" id="fee-period" type="month" value="${esc(state.payMonth || currentPeriod())}" />
    <label class="field-label" for="fee-amount">Summa (so'mda)</label>
    <input class="input" id="fee-amount" type="number" min="0" step="1000" inputmode="numeric" placeholder="Masalan: 100000" />
    <div class="modal-actions">
      <button type="button" class="btn btn-ghost" data-act="close-modal">Yopish</button>
      <button type="button" class="btn btn-primary" data-act="fee-add" data-gid="${gid}">+ Qo'shish</button>
    </div>
  `);
}

function addMonthlyFee(gid) {
  if (!isTeacher()) { toast("Ruxsat yo'q", 'error'); return; }
  const period = $('#fee-period') ? $('#fee-period').value : '';
  const amount = $('#fee-amount') ? $('#fee-amount').value : '';
  if (!/^\d{4}-\d{2}$/.test(period)) { toast("Oyni tanlang", 'error'); return; }
  if (!(Number(amount) > 0)) { toast("Summani kiriting", 'error'); return; }
  CloudSync.saveMonthlyFee(gid, period, amount);
  toast("Oylik to'lov saqlandi ✓");
  openFeeSchedule(gid);
}

function removeMonthlyFee(gid, period) {
  if (!isTeacher()) { toast("Ruxsat yo'q", 'error'); return; }
  CloudSync.deleteMonthlyFee(gid, period);
  toast("Oylik to'lov o'chirildi");
  openFeeSchedule(gid);
}

/* ==================== QARZDORLAR (faqat ustoz) ==================== */
function lastPaymentOf(sid) {
  const rows = getPayments().filter(function (p) { return p.sid === sid; });
  if (!rows.length) return null;
  return rows.slice().sort(function (a, b) {
    return String(b.createdAt).localeCompare(String(a.createdAt));
  })[0];
}

function debtorCard(s) {
  const g = groupById(s.groupId);
  const debt = Math.max(0, Number(s.paymentDebt) || 0);
  const lp = lastPaymentOf(s.id);
  const lpDate = lp ? String(lp.createdAt || '').slice(0, 10) : '';
  return `<div class="card debtor-card">
    <div class="row between debtor-top">
      <div class="col">
        <span class="s-name">${esc(s.fullName)}</span>
        <div class="muted small">${g ? esc(g.name) : 'Guruh taylanmagan'}</div>
      </div>
      <span class="pay-status due">${fmtSom(debt)} so'm</span>
    </div>
    <div class="debtor-meta">
      ${lp && lpDate
        ? `${ico('calendar', 13)} Oxirgi to'lov: <b>${fmtDMY(lpDate)}</b> · ${fmtSom(lp.amount)} so'm`
        : `${ico('calendar', 13)} Oxirgi to'lov: <span class="muted">hali to'lov yo'q</span>`}
    </div>
    <div class="debtor-actions">
      <button type="button" class="btn btn-xs btn-primary" data-act="pay-student" data-sid="${s.id}">💵 To'lov kiritish</button>
      <button type="button" class="btn btn-xs ghost" data-act="open-chat" data-sid="${s.id}">${ico('message', 14)} Xabar</button>
    </div>
  </div>`;
}

function debtorsScreen() {
  if (!isTeacher()) return blockedScreen("Bu bo'lim faqat Muzaffar Amirov uchun");
  const debtors = debtorsList().slice().sort(function (a, b) {
    return (Number(b.paymentDebt) || 0) - (Number(a.paymentDebt) || 0);
  });
  const total = debtors.reduce(function (a, s) { return a + (Number(s.paymentDebt) || 0); }, 0);
  return `
  <div class="screen-head">
    <div>
      <h2 class="screen-title">💳 Qarzdorlar</h2>
      <div class="muted small">${debtors.length} nafar · umumiy qarz: ${fmtSom(total)} so'm</div>
    </div>
    <button type="button" class="btn btn-ghost btn-sm" data-act="nav" data-screen="students">← Orqaga</button>
  </div>

  ${debtors.length ? `
  <button type="button" class="btn btn-primary btn-block debtors-btn" data-act="remind-debtors">
    <span class="debtors-ico">📢</span> Barcha qarzdorlarga eslatma yuborish
  </button>
  <div class="debtor-list">${debtors.map(debtorCard).join('')}</div>`
  : emptyState("Qarzdor o'quvchi yo'q — hamma to'langan ✓", 'checkCircle')}
  `;
}

function groupsScreen() {
  if (!isTeacher()) return blockedScreen("Bu bo'lim faqat Muzaffar Amirov uchun");
  const groups = getGroups();
  const students = getStudents();
  return `
  <div class="screen-head">
    <div>
      <h2 class="screen-title">${t('Guruhlar')}</h2>
      <div class="muted small">${groups.length} ta guruh</div>
    </div>
    <button type="button" class="btn btn-primary btn-sm" data-act="open-add-group">+ Guruh</button>
  </div>
  ${groups.length ? groups.map(g => groupCard(g, students)).join('') : emptyState("Hozircha guruh yo'q", 'groups')}
  `;
}

/* ==================== O'QUVCHILAR (faqat ustoz) ==================== */
function studentCard(s) {
  const g = groupById(s.groupId);
  const debt = Math.max(0, Number(s.paymentDebt) || 0);
  /* Pul/to'lov faqat repetitorlik guruhlarida (maktab guruhi — bepul) */
  const showMoney = !!g && !isSchoolGroup(g);
  const acc = Object.keys(accounts).map(k => accounts[k]).filter(a => a.studentId === s.id)[0];
  return `<div class="card student-card">
    <div class="st-head">
      <div class="avatar st-avatar">${esc(initials(s.fullName))}</div>
      <div class="s-main">
        <span class="s-name">${esc(s.fullName)}</span>
        <div class="s-group">${g ? esc(g.name) : t("Guruh taylanmagan")}</div>
        ${presenceHTML(s)}
        <div class="s-contacts">
          <span class="s-contact"><span class="lbl">Login</span><span class="login-val">${acc ? esc(acc.login) : '—'}</span></span>
        </div>
      </div>
      <span class="chip-class">${esc(tClass(s.schoolClass))}</span>
    </div>
    <div class="st-inset">
      <div class="s-debt row between">
        <span class="lbl-strong">${t('Speaking qarzi')}</span>
        <div class="debt-controls">
          <button type="button" class="btn btn-xs ghost" data-act="debt-minus" data-sid="${s.id}" aria-label="Kamaytirish">−</button>
          <span class="debt-num">${tTa(Number(s.speakingDebt) || 0)}</span>
          <button type="button" class="btn btn-xs ghost" data-act="debt-plus" data-sid="${s.id}" aria-label="Ko'paytirish">+</button>
        </div>
      </div>
      <div class="row between st-voice">
        <span class="lbl-strong">${ico('mic', 15)} ${t('Ovozli ruxsat')}</span>
        <button type="button" class="switch${s.voiceAllowed !== false ? ' on' : ''}" data-act="voice-toggle" data-sid="${s.id}"
                role="switch" aria-checked="${s.voiceAllowed !== false}" aria-label="${t('Ovozli ruxsat')}"></button>
      </div>
      ${showMoney ? `<div class="pay-line">
        <span class="pay-status ${debt > 0 ? 'due' : 'ok'}">${debt > 0 ? `🔴 To'lov qarzi: ${fmtSom(debt)} so'm` : "🟢 To'langan"}</span>
      </div>
      <div class="pay-actions">
        <button type="button" class="btn btn-xs ghost" data-act="debt-add" data-sid="${s.id}">➕ Qarz qo'shish</button>
        <button type="button" class="btn btn-xs ghost pay-btn" data-act="pay-student" data-sid="${s.id}">💵 To'lov kiritish</button>
        <button type="button" class="btn btn-xs ghost" data-act="remind-student" data-sid="${s.id}">🔔 Eslatma yuborish</button>
      </div>` : ''}
    </div>
    <div class="st-actions">
      <button type="button" class="btn btn-xs ghost" data-act="open-chat" data-sid="${s.id}">${ico('message', 14)} ${t('Xabar yozish')}</button>
      <button type="button" class="btn btn-xs ghost" data-act="reset-pwd" data-sid="${s.id}">${ico('key', 14)} ${t('Parol')}</button>
      <button type="button" class="btn btn-xs ghost" data-act="edit-student" data-sid="${s.id}">${ico('brush', 14)} ${t('Tahrirlash')}</button>
      <button type="button" class="btn btn-xs danger" data-act="del-student" data-sid="${s.id}">${ico('trash', 14)} ${t("O'chirish")}</button>
    </div>
  </div>`;
}

function filteredStudents() {
  const q = state.search.trim().toLowerCase();
  return getStudents().filter(s => {
    const byClass = state.filterClass === 'Barchasi' || s.schoolClass === state.filterClass;
    const byGroup = !state.filterGroup || s.groupId === state.filterGroup;
    const byQuery = !q || String(s.fullName).toLowerCase().indexOf(q) >= 0;
    return byClass && byGroup && byQuery;
  });
}
function studentListHTML() {
  const list = filteredStudents();
  return list.length ? list.map(studentCard).join('') : emptyState("O'quvchi topilmadi", 'students');
}
function refreshStudentList() {
  const list = $('#students-list');
  if (list) list.innerHTML = studentListHTML();
  const cnt = $('#students-count');
  if (cnt) cnt.textContent = tStudCnt(filteredStudents().length);
}

function studentsScreen() {
  if (!isTeacher()) return blockedScreen("Bu bo'lim faqat Muzaffar Amirov uchun");
  const chips = ['Barchasi'].concat(APP_DATA.classes);
  const gf = state.filterGroup ? groupById(state.filterGroup) : null;
  return `
  <div class="screen-head">
    <div>
      <h2 class="screen-title">${t("O'quvchilar")}</h2>
      <div class="muted small" id="students-count"></div>
    </div>
    <button type="button" class="btn btn-primary btn-sm" data-act="open-add-student">+ Qo'shish</button>
  </div>

  ${gf ? `<div class="card row between" style="margin-bottom:9px">
    <span class="muted small">${ico('groups', 14)} <b>${esc(gf.name)}</b> guruhidagi o'quvchilar</span>
    <button type="button" class="chip-btn" data-act="filter-group-all">Barcha o'quvchilar</button>
  </div>
  <div class="section-title">📚 ${esc(gf.name)} — uyga vazifalar</div>
  <div class="card">${homeworkListHTML(getHomework().filter(h => h.groupId === gf.id))}</div>
  <button type="button" class="btn btn-primary btn-block" data-act="open-hw" data-gid="${gf.id}">+ Uyga vazifa berish</button>` : ''}

  <div class="search-wrap">
    <input class="input" id="s-search" type="search" placeholder="O'quvchi ismini kiriting..." value="${esc(state.search)}" />
  </div>

  <button type="button" class="btn btn-primary btn-block debtors-btn" data-act="remind-debtors">
    <span class="debtors-ico">📢</span> Barcha qarzdorlarga eslatma yuborish
  </button>
  <button type="button" class="btn btn-ghost btn-block" data-act="nav" data-screen="debtors">💳 Qarzdorlar ro'yxati</button>

  <div class="chips${state.classHint ? ' is-hl' : ''}">
    ${chips.map(c => `<button type="button" class="chip-btn ${state.filterClass === c ? 'active' : ''}" data-act="filter-class" data-class="${esc(c)}">${esc(tClass(c))}</button>`).join('')}
  </div>

  <div id="students-list">${studentListHTML()}</div>
  <button type="button" class="btn btn-ghost btn-block" data-act="nav" data-screen="groups">${ico('groups', 16)} Guruhlar</button>
  `;
}

/* ==================== TO'LOV VA QARZ ESLATMALARI ==================== */
/* Qarz qo'shish — Telegramga xabar YUBORILMAYDI (jimjit yangilanadi) */
function openAddDebtModal(sid) {
  if (!isTeacher()) { toast("Ruxsat yo'q", 'error'); return; }
  const st = studentById(sid);
  if (!st) return;
  const g = groupById(st.groupId);
  if (!g || isSchoolGroup(g)) { toast("Maktab guruhida qarz yo'q (bepul)", 'error'); return; }
  const debt = Math.max(0, Number(st.paymentDebt) || 0);
  openModal(`
    <div class="modal-head">
      <h3>Qarz qo'shish</h3>
      <button type="button" class="icon-btn" data-act="close-modal" aria-label="Yopish">✕</button>
    </div>
    <div class="editor-info">
      <div class="avatar">${esc(initials(st.fullName))}</div>
      <div class="col">
        <div class="s-name">${esc(st.fullName)}</div>
        <div class="muted small">${esc(g.name)}</div>
      </div>
    </div>
    <div class="card" style="margin:9px 0">
      <div class="row between"><span class="muted small">Joriy qarz</span>
        <span class="pay-status ${debt > 0 ? 'due' : 'ok'}">${debt > 0 ? fmtSom(debt) + " so'm" : "🟢 Qarz yo'q"}</span></div>
    </div>
    <label class="field-label" for="debt-sum">Qo'shiladigan summa (so'mda)</label>
    <input class="input" id="debt-sum" type="number" min="0" step="1000" inputmode="numeric" placeholder="Masalan: 50000" />
    <p class="pay-hint">🔕 Bu amalda o'quvchiga xabar yuborilmaydi. Eslatma faqat kartadagi <b>🔔 Eslatma yuborish</b> tugmasi bilan ketadi.</p>
    <div class="field-error" id="debt-error"></div>
    <div class="modal-actions">
      <button type="button" class="btn btn-ghost" data-act="close-modal">Bekor qilish</button>
      <button type="button" class="btn btn-primary" data-act="save-add-debt" data-sid="${esc(String(sid))}">➕ Qarzni qo'shish</button>
    </div>
  `);
}

function saveAddedDebt(sid) {
  if (!isTeacher()) { toast("Ruxsat yo'q", 'error'); return; }
  const st = studentById(sid);
  if (!st) return;
  const g = groupById(st.groupId);
  if (!g || isSchoolGroup(g)) { toast("Maktab guruhida qarz yo'q (bepul)", 'error'); return; }
  const inp = $('#debt-sum');
  const sum = Math.round(Number(inp ? inp.value : 0) || 0);
  const err = $('#debt-error');
  if (!sum || sum <= 0) {
    if (err) { err.textContent = "Summani kiriting"; err.classList.add('show'); }
    return;
  }
  const before = Math.max(0, Number(st.paymentDebt) || 0);
  const after = before + sum;
  store.set(K.students, getStudents().map(x => String(x.id) === String(sid)
    ? Object.assign({}, x, { paymentDebt: after }) : x));
  CloudSync.pushStudent(sid);
  /* ATAYLAB xabar yuborilmaydi — faqat tugma orqali eslatma ketadi */
  closeModal();
  render();
  toast(`Qarz qo'shildi ✓ Jami: ${fmtSom(after)} so'm`);
}

/* Qarz eslatmasi matni (bitta o'quvchi va ommaviy uchun bir xil) */
function debtReminderText(s) {
  return `⚠️ <b>To'lov eslatmasi!</b>\n\nHurmatli o'quvchi / ota-ona, <b>${esc(s.fullName)}</b>ning ingliz tili darslari uchun <b>${fmtSom(s.paymentDebt)} so'm</b> to'lov qarzdorligi mavjud.\n\nIltimos, to'lovni amalga oshirishingizni so'raymiz.\n\n<i>Hurmat bilan, Muzaffar Amirov</i>`;
}

function debtRowOf(s) {
  return {
    student_id: s.dbId != null ? s.dbId : null,
    chat_id: s.telegramChatId || null,
    text: debtReminderText(s)
  };
}

/* outbox'ga qo'yadi va holatini qisqa kuzatadi */
function queueDebtReminders(rows, okText) {
  if (!rows.length) { toast("O'quvchilarda Telegram ulanmagan", 'error'); return; }
  CloudSync.queueMessages(rows).then(function () {
    toast(okText);
  }).catch(function (e) {
    toast('Eslatma yuborilmadi: ' + ((e && e.message) || 'xatolik'), 'error');
  });
}

/* Bitta o'quvchiga eslatma — faqat ustoz tugmani bosganda */
function remindStudent(sid) {
  if (!isTeacher()) { toast("Ruxsat yo'q", 'error'); return; }
  const st = studentById(sid);
  if (!st) return;
  const g = groupById(st.groupId);
  if (!g || isSchoolGroup(g)) { toast("Maktab guruhida qarz yo'q (bepul)", 'error'); return; }
  if (!(Number(st.paymentDebt) || 0)) { toast("Bu o'quvchida qarz yo'q ✓"); return; }
  if (!st.telegramChatId) { toast("O'quvchida Telegram ulanmagan", 'error'); return; }
  queueDebtReminders([debtRowOf(st)], `✅ ${st.fullName}ga eslatma yuborildi!`);
}

function openPayModal(sid, period) {
  if (!isTeacher()) { toast("Ruxsat yo'q", 'error'); return; }
  const st = studentById(sid);
  if (!st) return;
  const g = groupById(st.groupId);
  if (g && isSchoolGroup(g)) { toast("Maktab guruhi bepul — to'lov yo'q", 'error'); return; }
  const per = /^\d{4}-\d{2}$/.test(period || '') ? period : currentPeriod();
  const debt = Math.max(0, Number(st.paymentDebt) || 0);
  const fee = feeForGroup(st.groupId, per);
  const defaultMonthName = monthLabel(per);

  openModal(`
    <div class="modal-head">
      <h3>To'lov kiritish</h3>
      <button type="button" class="icon-btn" data-act="close-modal" aria-label="Yopish">✕</button>
    </div>
    <div class="editor-info">
      <div class="avatar">${esc(initials(st.fullName))}</div>
      <div class="col">
        <div class="s-name">${esc(st.fullName)}</div>
        <div class="muted small">${g ? esc(g.name) : 'Guruh taylanmagan'}${fee ? ' • Oylik: ' + fmtSom(fee) + " so'm" : ''}</div>
      </div>
    </div>
    <div class="card" style="margin:9px 0">
      <div class="row between"><span class="muted small">Joriy qarz</span>
        <span class="pay-balance">${debt > 0 ? fmtSom(debt) + " so'm" : "🟢 Qarz yo'q"}</span></div>
    </div>
    <label class="field-label" for="pay-sum">To'lov summasi (so'mda)</label>
    <input class="input" id="pay-sum" type="number" min="0" step="1000" inputmode="numeric" value="${debt > 0 ? debt : (fee || '')}" />
    
    <label class="field-label" for="pay-month-name" style="margin-top:8px">Qaysi oy uchun to'lov</label>
    <input class="input" id="pay-month-name" type="text" placeholder="Masalan: Noyabr 2026 yoki Oktyabr 2026" value="${esc(defaultMonthName)}" />
    
    <p class="pay-hint">Kiritilgan summa qarzdan ayiriladi va o'quvchi kabinetida so'nggi to'lov sifatida ko'rinadi.</p>
    <div class="field-error" id="pay-error"></div>
    <div class="modal-actions">
      <button type="button" class="btn btn-ghost" data-act="close-modal">Bekor qilish</button>
      <button type="button" class="btn btn-primary" data-act="save-pay" data-sid="${esc(String(sid))}" data-period="${esc(per)}">💵 To'lovni saqlash</button>
    </div>
  `);
}

function savePayment(sid) {
  if (!isTeacher()) { toast("Ruxsat yo'q", 'error'); return; }
  const st = studentById(sid);
  if (!st) return;
  const sumInp = $('#pay-sum');
  const sum = Math.round(Number(sumInp ? sumInp.value : 0) || 0);
  const err = $('#pay-error');
  if (!sum || sum <= 0) {
    if (err) { err.textContent = "To'lov summasini kiriting"; err.classList.add('show'); }
    return;
  }
  const per = (function () {
    const el = $('[data-act="save-pay"]');
    const v = el ? el.getAttribute('data-period') : '';
    return /^\d{4}-\d{2}$/.test(v || '') ? v : currentPeriod();
  })();

  const monthNameInp = $('#pay-month-name');
  const monthName = (monthNameInp && monthNameInp.value.trim()) || monthLabel(per);
  const before = Math.max(0, Number(st.paymentDebt) || 0);
  const after = Math.max(0, before - sum);
  const todayStr = fmtDMY(todayKey());
  const lastPayInfo = todayStr + " da " + fmtSom(sum) + " so'm (" + monthName + " uchun)";

  const list = getStudents().map(x => String(x.id) === String(sid)
    ? Object.assign({}, x, { paymentDebt: after, lastPaymentInfo: lastPayInfo, lastPaidMonth: monthName }) : x);
  store.set(K.students, list);
  CloudSync.pushStudent(sid);
  CloudSync.addPayment(sid, st.dbId, sum, monthName + " uchun to'lov", per);

  /* student_payments jadvaliga saqlash */
  if (CloudSync.ready() && st.dbId != null) {
    const g = groupById(st.groupId);
    window.__cloud && window.__cloud.addStudentPaymentRecord && window.__cloud.addStudentPaymentRecord(
      st.dbId, g ? g.dbId : null, per, monthName, sum
    );
  }

  /* telegram_outbox ga xabar qo'yish */
  if (st.telegramChatId) {
    CloudSync.queueMessages([{
      student_id: st.dbId != null ? st.dbId : null,
      chat_id: String(st.telegramChatId),
      text: `💵 <b>To'lov qabul qilindi!</b>\n\n<b>${esc(st.fullName)}</b>, ${esc(monthName)} uchun <b>${fmtSom(sum)} so'm</b> to'lov qabul qilindi.\n${after > 0 ? `Qolgan qarz: <b>${fmtSom(after)} so'm</b>` : "Qarzingiz yo'q — rahmat! 🟢"}\n\n<i>Hurmat bilan, Muzaffar Amirov</i>`,
      status: 'pending'
    }]).catch(function (e) { console.warn('[outbox]', (e && e.message) || e); });
  }

  closeModal();
  render();
  toast(`To'lov kiritildi ✓${after > 0 ? ' Qarz: ' + fmtSom(after) + " so'm" : ''}`);
}

function debtorsList() {
  return getStudents().filter(s => (Number(s.paymentDebt) || 0) > 0 &&
    !isSchoolGroup(groupById(s.groupId)));
}

function openRemindDebtors() {
  if (!isTeacher()) { toast("Ruxsat yo'q", 'error'); return; }
  const debtors = debtorsList();
  if (!debtors.length) { toast("Qarzdor o'quvchi yo'q ✓"); return; }
  const total = debtors.reduce((a, s) => a + (Number(s.paymentDebt) || 0), 0);
  const noTg = debtors.filter(s => !s.telegramChatId).length;
  openModal(`
    <div class="modal-head">
      <h3>Eslatma yuborish</h3>
      <button type="button" class="icon-btn" data-act="close-modal" aria-label="Yopish">✕</button>
    </div>
    <div class="confirm-body">
      <div class="confirm-emoji tint-amber">📢</div>
      <p class="confirm-text">${debtors.length} nafar qarzdor o'quvchiga Telegram orqali shaxsiy eslatma yuborilsinmi?</p>
      <p class="muted small" style="margin-top:7px">Umumiy qarzdorlik: <b>${fmtSom(total)} so'm</b></p>
      ${noTg ? `<p class="muted small" style="margin-top:7px">⚠️ ${noTg} nafar o'quvchida Telegram ulanmagan — ularga yuborilmaydi.</p>` : ''}
    </div>
    <div class="confirm-actions">
      <button type="button" class="btn btn-ghost" data-act="close-modal">Bekor qilish</button>
      <button type="button" class="btn btn-primary" data-act="do-remind-debtors">Ha, yuborish</button>
    </div>
  `);
}

function sendDebtorsReminder() {
  if (!isTeacher()) { toast("Ruxsat yo'q", 'error'); return; }
  const debtors = debtorsList();
  if (!debtors.length) { closeModal(); toast("Qarzdor o'quvchi yo'q ✓"); return; }
  const rows = debtors.filter(s => s.telegramChatId).map(debtRowOf);
  closeModal();
  queueDebtReminders(rows, `✅ ${rows.length} nafar qarzdorga eslatma yuborildi!`);
}

/* ==================== PROFIL ==================== */
function profileScreen() {
  const u = currentUser() || {};
  const st = !isTeacher() ? linkedStudent() : null;
  return `
  <div class="card profile-head">
    <div class="avatar avatar-xl avatar-gerb"><img src="logo.png" alt="Gerb" /></div>
    <div class="profile-name">${esc(st ? st.fullName : (u.name || ''))}</div>
    <div class="muted">${esc(u.login || '')}</div>
    <div style="margin-top:9px">
      <span class="role-badge ${isTeacher() ? 'is-teacher' : 'is-student'}">${isTeacher() ? 'Muzaffar Amirov' : "O'quvchi"}</span>
      ${st ? `<span class="pill" style="margin-left:6px">${esc(tClass(st.schoolClass))}</span>` : ''}
    </div>
  </div>

  <div class="section-title">${t('Xavfsizlik')}</div>
  <div class="card list-card">
    <div class="list-row"><span>Login</span><span class="login-val">${esc(u.login || '')}</span></div>
    <div class="list-row"><span>${t('Parol')}</span><span class="muted">••••</span></div>
    <div class="list-row"><span>${t("Ko'rinish")}</span><span class="muted">${isTeacher() ? 'Muzaffar Amirov' : t("O'quvchi")}</span></div>
  </div>
  <button type="button" class="btn btn-ghost btn-block" data-act="open-change-pwd">${ico('key', 16)} ${t("Parolni o'zgartirish")}</button>

  ${isTeacher() ? `
  <div class="section-title">${t("Ma'lumotlar Bazasi Zaxirasi")}</div>
  <div class="card backup-card">
    <div class="muted small">${t("Guruhlar, o'quvchilar, davomat, baholar, xabarlar va speaking topshiriqlari JSON faylda saqlanadi.")}</div>
    <button type="button" class="btn btn-primary btn-block" data-act="backup-dl">${ico('download', 16)} ${t('Bazani yuklab olish (Backup)')}</button>
    <button type="button" class="btn btn-ghost btn-block" data-act="backup-pick">${ico('upload', 16)} ${t('Bazani qayta tiklash (Restore)')}</button>
    <input type="file" id="backup-file" accept="application/json,.json" hidden />

    <div class="section-title" style="margin-top:14px">${t('Tozalash')}</div>
    <div class="muted small">${t("Tozalashdan oldin barcha jadvallar fayl ko'rinishida avtomatik yuklab olinadi.")}</div>
    <div class="chips">
      ${CLEANUP_TABLES.map(ct => `<button type="button" class="chip-btn${(state.cleanupTable || 'grades') === ct[0] ? ' active' : ''}" data-act="cleanup-pick" data-table="${ct[0]}">${t(ct[1])}</button>`).join('')}
    </div>
    <button type="button" class="btn btn-danger btn-block" data-act="cleanup-go">${ico('brush', 16)} ${t('Tanlangan jadvalni tozalash')}</button>
  </div>` : ''}

  
  ${isTeacher() ? `
  <div class="section-title">💳 To\'lov kartasi sozlamalari</div>
  <div class="card card-settings-block">
    <div class="muted small" style="margin-bottom:8px">O\'quvchilar repetitorlik to\'lovini o\'tkazishi uchun karta raqamingiz va ism-familiyangizni kiriting:</div>
    <label class="field-label" for="teacher-card-num">Karta raqami (16 ta raqam)</label>
    <input class="input" id="teacher-card-num" inputmode="numeric" maxlength="24" placeholder="8600 0000 0000 0000" value="${esc((store.get(K.cardSettings) || {}).number || '')}" />
    <label class="field-label" for="teacher-card-holder" style="margin-top:6px">Karta egasining ism-familiyasi</label>
    <input class="input" id="teacher-card-holder" autocapitalize="characters" placeholder="MUZAFFAR AMIROV" value="${esc((store.get(K.cardSettings) || {}).holder || '')}" />
    <button type="button" class="btn btn-primary btn-block" data-act="save-card-settings" style="margin-top:10px">💾 Kartani saqlash</button>
  </div>` : ''}

  ${sessionsSectionHTML()}

  <div class="section-title">${t('Maxfiylik')}</div>
  <div class="card list-card">
    <div class="list-row"><span class="muted small">${t("Bu ilova tashqi tahlil xizmatlariga ma'lumot yubormaydi.")}</span></div>
  </div>

  <button type="button" class="btn btn-danger btn-block" data-act="logout">${t('Hisobdan chiqish')}</button>
  `;
}

/* ==================== MODALLAR ==================== */
function openModal(html) {
  $('#modal-sheet').innerHTML = html;
  $('#modal-overlay').hidden = false;
}
function closeModal() {
  revokeHwPreview();
  $('#modal-overlay').hidden = true;
  $('#modal-sheet').innerHTML = '';
  state.editor = null;
  state.slotMode = 'create';
  state.slotId = '';
  state.chatSid = null;
}

function openAddGroup() {
  if (!isTeacher()) { toast("Ruxsat yo'q", 'error'); return; }
  const short = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];
  openModal(`
    <div class="modal-head">
      <h3>Guruh qo'shish</h3>
      <button type="button" class="icon-btn" data-act="close-modal" aria-label="Yopish">✕</button>
    </div>

    <label class="field-label" for="f-gname">Guruh nomi</label>
    <input class="input" id="f-gname" placeholder="Masalan: IELTS Band 7.0" />

    <div class="field-label">Dars kunlari</div>
    <div class="day-grid" id="f-days">
      ${APP_DATA.days.map((d, i) => `
        <label class="day-opt">
          <input type="checkbox" value="${d}" />
          <span class="day-box" title="${d}">${short[i]}</span>
        </label>`).join('')}
    </div>

    <div id="f-times" class="day-times" aria-live="polite"></div>
    <p class="muted small" style="margin-top:8px">Kunni tanlang — har bir kun uchun alohida vaqtni belgilang (masalan Dushanba 09:15, Shanba 11:00).</p>

    <div class="field-label">Guruh turi</div>
    <div class="gtype-grid" id="f-gtype">
      <label class="gtype-opt">
        <input type="radio" name="f-gtype" value="school" checked />
        <span>🏫 Maktab guruhi (bepul)</span>
      </label>
      <label class="gtype-opt">
        <input type="radio" name="f-gtype" value="tutoring" />
        <span>🎓 Repetitorlik guruhi</span>
      </label>
    </div>
    <p class="muted small" style="margin-top:6px">Guruh turi faqat sizga ko'rinadi — o'quvchilarga hech qachon ko'rsatilmaydi.</p>

    <div id="f-gfee-wrap">
      <label class="field-label" for="f-gfee">Oylik to'lov summasi (so'mda)</label>
      <input class="input" id="f-gfee" type="number" min="0" step="1000" inputmode="numeric" placeholder="Masalan: 300000" />
    </div>

    <button type="button" class="btn btn-primary btn-block" data-act="save-group">Saqlash</button>
  `);
  syncGroupFeeField();
}

/* Tanlangan kunlar uchun dinamik vaqt tanlagichlari (yagona vaqt inputi YO'Q) */
function renderDayTimes() {
  const wrap = $('#f-days') ? $('#f-times') : null;
  if (!wrap) return;
  const prev = {};
  $$('.dt-time', wrap).forEach(inp => {
    const d = inp.getAttribute('data-day');
    if (d) prev[d] = inp.value;
  });
  const days = $$('input:checked', $('#f-days')).map(i => i.value);
  if (!days.length) { wrap.innerHTML = ''; return; }
  wrap.innerHTML = `
    <div class="field-label">Dars vaqtlari (har kun uchun)</div>
    ${days.map(d => `
      <div class="day-time-row">
        <span class="dt-day">${esc(d)}</span>
        <input class="input dt-time" type="time" data-day="${esc(d)}" value="${esc(prev[d] || '')}" aria-label="${esc(d)} dars vaqti" />
      </div>`).join('')}`;
}

/* Guruh turi 'school' bo'lsa — oylik to'lov maydoni butunlay yashiriladi (bepul) */
function syncGroupFeeField() {
  const wrap = $('#f-gfee-wrap');
  if (!wrap) return;
  const typeBtn = $$('input[name="f-gtype"]').filter(i => i.checked)[0];
  const isSchool = !typeBtn || typeBtn.value === 'school';
  wrap.hidden = isSchool;
  const feeInput = $('#f-gfee');
  if (isSchool && feeInput) feeInput.value = '';
}

function openAddStudent() {
  if (!isTeacher()) { toast("Ruxsat yo'q", 'error'); return; }
  const groups = getGroups();
  openModal(`
    <div class="modal-head">
      <h3>O'quvchi qo'shish</h3>
      <button type="button" class="icon-btn" data-act="close-modal" aria-label="Yopish">✕</button>
    </div>

    <label class="field-label" for="f-sname">Ism familiya</label>
    <input class="input" id="f-sname" placeholder="Masalan: Aziz Rahimov" />

    <label class="field-label" for="f-sclass">Maktab sinfi</label>
    <select class="input" id="f-sclass">
      <option value="">Sinfni tanlang</option>
      ${APP_DATA.classes.map(c => `<option value="${c}">${c}</option>`).join('')}
    </select>

    <label class="field-label" for="f-sgroup">Guruh</label>
    <select class="input" id="f-sgroup">
      <option value="">Guruhni tanlang</option>
      ${groups.map(g => `<option value="${g.id}">${esc(g.name)}</option>`).join('')}
    </select>

    <div class="field-label">Kirish ma'lumotlari</div>
    <label class="field-label" for="f-slogin">Login</label>
    <input class="input" id="f-slogin" autocapitalize="none" autocorrect="off" placeholder="Masalan: jasur09" />

    <label class="field-label" for="f-spass">Dastlabki parol</label>
    <div class="pw-wrap">
      <input class="input" id="f-spass" type="password" inputmode="numeric" placeholder="Masalan: 1234" />
      <button type="button" class="pw-toggle" data-act="toggle-pw" data-target="f-spass" aria-label="Parolni ko'rsatish">${ico('eye', 18)}</button>
    </div>

    <input type="text" name="bot_check_field" id="hp-student" style="display:none !important; position:absolute; left:-9999px;" tabindex="-1" autocomplete="off" aria-hidden="true" />
    <button type="button" class="btn btn-primary btn-block" data-act="save-student">Saqlash</button>
  `);
}

function saveGroup() {
  const name = ($('#f-gname').value || '').trim();
  const days = $$('input:checked', $('#f-days')).map(i => i.value);
  const times = {};
  $$('#f-times .dt-time').forEach(inp => {
    const d = inp.getAttribute('data-day');
    if (d) times[d] = (inp.value || '').trim();
  });

  if (!name) { toast("Guruh nomini kiriting", 'error'); $('#f-gname').focus(); return; }
  if (!days.length) { toast("Dars kunlarini tanlang", 'error'); return; }

  /* Kun + vaqt bir xatorda saqlanadi: "Dushanba 09:15, Shanba 11:00" */
  const encoded = days.map(d => (times[d] ? d + ' ' + times[d] : d)).join(', ');
  const firstTime = days.map(d => times[d] || '').filter(Boolean)[0] || '';

  const typeBtn = $$('input[name="f-gtype"]').filter(i => i.checked)[0];
  const groupType = typeBtn && typeBtn.value === 'tutoring' ? 'tutoring' : 'school';
  /* Maktab guruhi — bepul: to'lov maydoni yashirin va summa 0 */
  const fee = groupType === 'school' ? 0
    : Math.max(0, Math.round(Number(($('#f-gfee') ? $('#f-gfee').value : 0)) || 0));
  const groups = getGroups();
  groups.push({ id: 'g' + Date.now(), name, days: encoded, time: firstTime, monthlyFee: fee, groupType: groupType });
  store.set(K.groups, groups);
  CloudSync.pushGroup(groups[groups.length - 1]);
  closeModal();
  render();
  toast("Guruh qo'shildi ✓");
}

/* --- Guruhni tahrirlash: har bir kun uchun alohida vaqt (qo'shish modali bilan bir xil UI) --- */
function openEditGroup(gid) {
  if (!isTeacher()) { toast("Ruxsat yo'q", 'error'); return; }
  const g = groupById(gid);
  if (!g) return;
  const short = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];
  const checked = {};
  const preset = {};
  parseGroupDays(g).forEach(x => {
    checked[x.day] = true;
    if (x.time) preset[x.day] = x.time;
  });
  /* Eski format (kunlar + bitta time) — barcha tanlangan kunlar o'sha vaqt bilan to'ldiriladi */
  if (!Object.keys(preset).length && g.time) {
    Object.keys(checked).forEach(d => { preset[d] = g.time; });
  }
  openModal(`
    <div class="modal-head">
      <h3>Guruhni tahrirlash</h3>
      <button type="button" class="icon-btn" data-act="close-modal" aria-label="Yopish">✕</button>
    </div>

    <label class="field-label" for="f-gname">Guruh nomi</label>
    <input class="input" id="f-gname" value="${esc(g.name)}" />

    <div class="field-label">Dars kunlari</div>
    <div class="day-grid" id="f-days">
      ${APP_DATA.days.map((d, i) => `
        <label class="day-opt">
          <input type="checkbox" value="${d}" ${checked[d] ? 'checked' : ''} />
          <span class="day-box" title="${d}">${short[i]}</span>
        </label>`).join('')}
    </div>

    <div id="f-times" class="day-times" aria-live="polite"></div>
    <p class="muted small" style="margin-top:8px">Har bir tanlangan kun uchun alohida dars vaqtini belgilang.</p>

    <div class="field-label">Guruh turi</div>
    <div class="gtype-grid" id="f-gtype">
      <label class="gtype-opt">
        <input type="radio" name="f-gtype" value="school" ${groupTypeOf(g) === 'school' ? 'checked' : ''} />
        <span>🏫 Maktab guruhi (bepul)</span>
      </label>
      <label class="gtype-opt">
        <input type="radio" name="f-gtype" value="tutoring" ${groupTypeOf(g) === 'tutoring' ? 'checked' : ''} />
        <span>🎓 Repetitorlik guruhi</span>
      </label>
    </div>
    <p class="muted small" style="margin-top:6px">Guruh turi faqat sizga ko'rinadi — o'quvchilarga hech qachon ko'rsatilmaydi.</p>

    <div id="f-gfee-wrap">
      <label class="field-label" for="f-gfee">Oylik to'lov summasi (so'mda)</label>
      <input class="input" id="f-gfee" type="number" min="0" step="1000" inputmode="numeric" value="${g && g.monthlyFee ? String(g.monthlyFee) : ''}" placeholder="Masalan: 300000" />
    </div>

    <div class="modal-actions">
      <button type="button" class="btn btn-ghost" data-act="close-modal">Bekor qilish</button>
      <button type="button" class="btn btn-primary" data-act="save-edit-group" data-gid="${esc(String(gid))}">Saqlash</button>
    </div>
  `);
  renderDayTimes();
  $$('#f-times .dt-time').forEach(inp => {
    const d = inp.getAttribute('data-day');
    if (d && preset[d]) inp.value = preset[d];
  });
  syncGroupFeeField();
}

function saveEditGroup(gid) {
  if (!isTeacher()) { toast("Ruxsat yo'q", 'error'); return; }
  const name = (($('#f-gname') && $('#f-gname').value) || '').trim();
  const days = $$('input:checked', $('#f-days')).map(i => i.value);
  const times = {};
  $$('#f-times .dt-time').forEach(inp => {
    const d = inp.getAttribute('data-day');
    if (d) times[d] = (inp.value || '').trim();
  });

  if (!name) { toast("Guruh nomini kiriting", 'error'); if ($('#f-gname')) $('#f-gname').focus(); return; }
  if (!days.length) { toast("Dars kunlarini tanlang", 'error'); return; }

  /* "Dushanba 09:15, Shanba 11:00" — yangi format; legacy time = birinchi tanlangan vaqt */
  const encoded = days.map(d => (times[d] ? d + ' ' + times[d] : d)).join(', ');
  const firstTime = days.map(d => times[d] || '').filter(Boolean)[0] || '';

  const typeBtn = $$('input[name="f-gtype"]').filter(i => i.checked)[0];
  const groupType = typeBtn && typeBtn.value === 'tutoring' ? 'tutoring' : 'school';
  const fee = groupType === 'school' ? 0
    : Math.max(0, Math.round(Number(($('#f-gfee') ? $('#f-gfee').value : 0)) || 0));
  const list = getGroups().map(x => String(x.id) === String(gid)
    ? Object.assign({}, x, { name: name, days: encoded, time: firstTime, monthlyFee: fee, groupType: groupType })
    : x);
  store.set(K.groups, list);
  const updated = list.filter(x => String(x.id) === String(gid))[0];
  CloudSync.pushGroup(updated);
  closeModal();
  render();
  toast("Guruh yangilandi ✓");
}

function saveStudent() {
  /* Bot honeypot: maydon to'ldirilgan bo'lsa — jimjimrad rad etiladi */
  if ($('#hp-student') && $('#hp-student').value) return;
  const name = ($('#f-sname').value || '').trim();
  const cls = $('#f-sclass').value;
  const gid = $('#f-sgroup').value;
  const login = ($('#f-slogin').value || '').trim().toLowerCase();
  const pass = ($('#f-spass').value || '').trim();

  if (name.length < 3) { toast("Ism familiyani kiriting", 'error'); $('#f-sname').focus(); return; }
  if (!cls) { toast("Maktab sinfini tanlang", 'error'); return; }
  if (!gid) { toast("Guruhni tanlang", 'error'); return; }
  if (!/^[a-z0-9_.]{3,20}$/.test(login)) { toast("Login 3–20 ta: harf, raqam, _ yoki .", 'error'); $('#f-slogin').focus(); return; }
  if (accounts[login]) { toast("Bu login allaqachon band", 'error'); $('#f-slogin').focus(); return; }
  if (pass.length < 3) { toast("Dastlabki parol kamida 3 ta belgi bo'lsin", 'error'); $('#f-spass').focus(); return; }

  const id = 's' + Date.now();
  const students = getStudents();
  students.push({ id, fullName: name, schoolClass: cls, groupId: gid, speakingDebt: 0, paymentDebt: 0, feePeriod: '', audioSubmissions: [] });
  store.set(K.students, students);

  accounts[login] = { login, password: hashPasswordSync(pass), role: 'student', studentId: id, name };
  persistAccounts();
  CloudSync.pushStudent(id);

  closeModal();
  render();
  toast("O'quvchi qo'shildi ✓ Login: " + login);
}

/* ---- Ustoz: o'quvchi parolini yangilash ---- */
function openResetPwd(sid) {
  if (!isTeacher()) { toast("Ruxsat yo'q", 'error'); return; }
  const st = studentById(sid);
  if (!st) return;
  const acc = Object.keys(accounts).map(k => accounts[k]).filter(a => a.studentId === sid)[0];
  openModal(`
    <div class="modal-head">
      <h3>Parolni yangilash</h3>
      <button type="button" class="icon-btn" data-act="close-modal" aria-label="Yopish">✕</button>
    </div>
    <div class="editor-info">
      <div class="avatar">${esc(initials(st.fullName))}</div>
      <div class="col">
        <div class="s-name">${esc(st.fullName)}</div>
        <div class="muted small">${esc(st.schoolClass)} • Login: <span class="login-val">${acc ? esc(acc.login) : '—'}</span></div>
      </div>
    </div>
    ${acc ? '' : `<label class="field-label" for="rp-login">Login</label>
      <input class="input" id="rp-login" autocapitalize="none" value="${esc(suggestLogin(st.fullName))}" />`}
    <label class="field-label" for="rp-pass">Yangi parol</label>
    <div class="pw-wrap">
      <input class="input" id="rp-pass" type="password" inputmode="numeric" placeholder="Masalan: 1234" />
      <button type="button" class="pw-toggle" data-act="toggle-pw" data-target="rp-pass" aria-label="Parolni ko'rsatish">${ico('eye', 18)}</button>
    </div>
    <button type="button" class="btn btn-primary btn-block" data-act="save-reset" data-sid="${sid}">Saqlash</button>
  `);
}

function saveResetPwd(sid) {
  const st = studentById(sid);
  if (!st) return;
  const pass = ($('#rp-pass') ? $('#rp-pass').value : '').trim();
  if (pass.length < 3) { toast("Parol kamida 3 ta belgi bo'lsin", 'error'); return; }

  let acc = Object.keys(accounts).map(k => accounts[k]).filter(a => a.studentId === sid)[0];
  if (acc) {
    acc.password = hashPasswordSync(pass);
  } else {
    const loginEl = $('#rp-login');
    const login = loginEl ? loginEl.value.trim().toLowerCase() : suggestLogin(st.fullName);
    if (!/^[a-z0-9_.]{3,20}$/.test(login)) { toast("Login noto'g'ri", 'error'); return; }
    if (accounts[login]) { toast("Bu login band", 'error'); return; }
    accounts[login] = { login, password: hashPasswordSync(pass), role: 'student', studentId: sid, name: st.fullName };
  }
  persistAccounts();
  CloudSync.pushStudent(sid);
  closeModal();
  render();
  toast("Parol yangilandi ✓");
}

/* ==================== O'QUVCHINI TAHRIRLASH (guruhni almashtirish) ==================== */
function openEditStudent(sid) {
  if (!isTeacher()) { toast("Ruxsat yo'q", 'error'); return; }
  const st = getStudents().filter(x => x.id === sid)[0];
  if (!st) return;
  const groups = getGroups();
  openModal(`
    <div class="modal-head">
      <h3>O'quvchini tahrirlash</h3>
      <button type="button" class="icon-btn" data-act="close-modal" aria-label="Yopish">✕</button>
    </div>

    <label class="field-label" for="es-name">Ism familiya</label>
    <input class="input" id="es-name" value="${esc(st.fullName)}" />

    <label class="field-label" for="es-class">Maktab sinfi</label>
    <select class="input" id="es-class">
      ${APP_DATA.classes.map(c => `<option value="${esc(c)}" ${c === st.schoolClass ? 'selected' : ''}>${esc(c)}</option>`).join('')}
    </select>

    <label class="field-label" for="es-group">Guruh</label>
    <select class="input" id="es-group">
      <option value="">Guruh tanlanmagan</option>
      ${groups.map(g => `<option value="${esc(g.id)}" ${g.id === st.groupId ? 'selected' : ''}>${esc(g.name)}</option>`).join('')}
    </select>
    <p class="muted small" style="margin-top:8px">Guruh o'zgartirilsa, mavjud baholar va davomat tarixi saqlanib qoladi.</p>

    <label class="field-label" for="es-debt">To'lov qarzi (so'mda)</label>
    <input class="input" id="es-debt" type="number" min="0" step="1000" inputmode="numeric" value="${Math.max(0, Number(st.paymentDebt) || 0)}" />

    <div class="field-error" id="es-error"></div>
    <div class="modal-actions">
      <button type="button" class="btn btn-ghost" data-act="close-modal">Bekor qilish</button>
      <button type="button" class="btn btn-primary" data-act="save-edit-student" data-sid="${esc(String(sid))}">Saqlash</button>
    </div>
  `);
}

function saveEditStudent(sid) {
  if (!isTeacher()) { toast("Ruxsat yo'q", 'error'); return; }
  const cur = getStudents().filter(x => x.id === sid)[0];
  if (!cur) return;
  const name = (($('#es-name') && $('#es-name').value) || '').trim();
  const cls = $('#es-class') ? $('#es-class').value : cur.schoolClass;
  const gid = $('#es-group') ? $('#es-group').value : '';
  const debt = Math.max(0, Math.round(Number(($('#es-debt') ? $('#es-debt').value : 0)) || 0));
  const err = $('#es-error');
  if (!name) {
    if (err) { err.textContent = "Ism familiyani kiriting"; err.classList.add('show'); }
    return;
  }
  /* Faqat name/schoolClass/group_id yangilanadi — baholar va davomat
     student_id bo'yicha qoladi (Supabase'da alohida jadvallar) */
  const list = getStudents().map(x => String(x.id) === String(sid)
    ? Object.assign({}, x, { fullName: name, schoolClass: cls, groupId: gid || null, paymentDebt: debt })
    : x);
  store.set(K.students, list);
  CloudSync.pushStudent(sid);
  closeModal();
  render();
  toast("O'quvchi yangilandi ✓");
}

/* ---- O'quvchi: parolni o'zgartirish ---- */
function openChangePwd() {
  const u = currentUser();
  if (!u) return;
  openModal(`
    <div class="modal-head">
      <h3>Parolni o'zgartirish</h3>
      <button type="button" class="icon-btn" data-act="close-modal" aria-label="Yopish">✕</button>
    </div>
    <div class="editor-info">
      <div class="avatar">${esc(initials(u.name || u.login))}</div>
      <div class="col">
        <div class="s-name">${esc(u.name || u.login)}</div>
        <div class="muted small">Login: <span class="login-val">${esc(u.login)}</span></div>
      </div>
    </div>

    <label class="field-label" for="cp-old">Joriy parol</label>
    <div class="pw-wrap">
      <input class="input" id="cp-old" type="password" autocomplete="current-password" placeholder="••••" />
      <button type="button" class="pw-toggle" data-act="toggle-pw" data-target="cp-old" aria-label="Parolni ko'rsatish">${ico('eye', 18)}</button>
    </div>

    <label class="field-label" for="cp-new">Yangi parol</label>
    <div class="pw-wrap">
      <input class="input" id="cp-new" type="password" autocomplete="new-password" placeholder="••••" />
      <button type="button" class="pw-toggle" data-act="toggle-pw" data-target="cp-new" aria-label="Parolni ko'rsatish">${ico('eye', 18)}</button>
    </div>

    <label class="field-label" for="cp-new2">Yangi parolni tasdiqlang</label>
    <div class="pw-wrap">
      <input class="input" id="cp-new2" type="password" autocomplete="new-password" placeholder="••••" />
      <button type="button" class="pw-toggle" data-act="toggle-pw" data-target="cp-new2" aria-label="Parolni ko'rsatish">${ico('eye', 18)}</button>
    </div>

    <button type="button" class="btn btn-primary btn-block" data-act="save-change-pwd">Saqlash</button>
  `);
}

function saveChangePwd() {
  const u = currentUser();
  if (!u) return;
  const oldP = ($('#cp-old') ? $('#cp-old').value : '');
  const n1 = ($('#cp-new') ? $('#cp-new').value : '');
  const n2 = ($('#cp-new2') ? $('#cp-new2').value : '');
  if (!passwordMatches(oldP, u.password)) { toast("Joriy parol noto'g'ri", 'error'); return; }
  if (n1.length < 3) { toast("Yangi parol kamida 3 ta belgi bo'lsin", 'error'); return; }
  if (n1 !== n2) { toast("Parollar mos kelmadi", 'error'); return; }
  u.password = u.role === 'student' ? hashPasswordSync(n1) : n1;
  persistAccounts();
  if (u.role === 'student' && u.studentId) CloudSync.pushStudent(u.studentId);
  if (u.role === 'teacher') CloudSync.pushTeacherPassword(n1); /* bot_settings */
  closeModal();
  render();
  toast("Parol o'zgartirildi ✓");
}

/* ==================== O'CHIRISH (tasdiq bilan, faqat ustoz) ==================== */
function openDeleteStudent(sid) {
  if (!isTeacher()) { toast("Ruxsat yo'q", 'error'); return; }
  const st = studentById(sid);
  if (!st) return;
  openModal(`
    <div class="modal-head">
      <h3>O'chirish</h3>
      <button type="button" class="icon-btn" data-act="close-modal" aria-label="Yopish">✕</button>
    </div>
    <div class="confirm-body">
      <div class="confirm-emoji tint-rose">${ICON.trash}</div>
      <p class="confirm-text">Haqiqatan ham <strong>${esc(st.fullName)}ni</strong> o'chirmoqchimisiz? Uning barcha baholari va davomat tarixi ham o'chiriladi.</p>
    </div>
    <div class="confirm-actions">
      <button type="button" class="btn btn-ghost" data-act="close-modal">Bekor qilish</button>
      <button type="button" class="btn btn-danger" data-act="do-del-student" data-sid="${sid}">Ha, o'chirish</button>
    </div>
  `);
}

function doDeleteStudent(sid) {
  if (!isTeacher()) { toast("Ruxsat yo'q", 'error'); return; }
  const st = studentById(sid);
  if (!st) return;

  /* kirish hisobi (login) + cloud id (lokal o'chirishdan OLDIN!) */
  const acc = Object.keys(accounts).map(k => accounts[k]).filter(a => a.studentId === sid)[0];
  const dbId = st.dbId;

  /* lokal ma'lumotlarni tozalash */
  store.set(K.students, getStudents().filter(x => x.id !== sid));
  const grades = getGrades();
  delete grades[sid];
  store.set(K.grades, grades);
  const att = getAttendance();
  Object.keys(att).forEach(dk => {
    if (!att[dk]) return;
    delete att[dk][sid];
    if (!Object.keys(att[dk]).length) delete att[dk];
  });
  store.set(K.attendance, att);
  store.set(K.speaking, getSpeaking().map(x => x.studentId === sid
    ? Object.assign({}, x, { studentId: null, score: null }) : x));
  store.set(K.messages, store.get(K.messages, []).filter(m => m.sid !== sid));
  if (acc) { delete accounts[acc.login]; persistAccounts(); }

  /* bulutdan: messages, audio, grades, attendance → students */
  CloudSync.deleteStudent(dbId).catch(e => console.warn('[cloud] del student:', (e && e.message) || e));

  closeModal();
  render();
  toast("O'quvchi muvaffaqiyatli o'chirildi ✓");
}

function openDeleteGroup(gid) {
  if (!isTeacher()) { toast("Ruxsat yo'q", 'error'); return; }
  const g = groupById(gid);
  if (!g) return;
  openModal(`
    <div class="modal-head">
      <h3>O'chirish</h3>
      <button type="button" class="icon-btn" data-act="close-modal" aria-label="Yopish">✕</button>
    </div>
    <div class="confirm-body">
      <div class="confirm-emoji tint-rose">${ICON.trash}</div>
      <p class="confirm-text">Haqiqatan ham <strong>${esc(g.name)}</strong> guruhini o'chirmoqchimisiz?</p>
    </div>
    <div class="confirm-actions">
      <button type="button" class="btn btn-ghost" data-act="close-modal">Bekor qilish</button>
      <button type="button" class="btn btn-danger" data-act="do-del-group" data-gid="${gid}">Ha, o'chirish</button>
    </div>
  `);
}

function doDeleteGroup(gid) {
  if (!isTeacher()) { toast("Ruxsat yo'q", 'error'); return; }
  const g = groupById(gid);
  if (!g) return;
  const dbId = g.dbId;

  store.set(K.groups, getGroups().filter(x => x.id !== gid));
  store.set(K.students, getStudents().map(st =>
    st.groupId === gid ? Object.assign({}, st, { groupId: null }) : st));

  CloudSync.deleteGroup(dbId).catch(e => console.warn('[cloud] del group:', (e && e.message) || e));

  if (state.gradeGroup === gid) state.gradeGroup = '';
  if (state.attGroup === gid) state.attGroup = '';
  state.attDraft = null;
  state.attDraftFor = '';

  closeModal();
  render();
  toast("Guruh muvaffaqiyatli o'chirildi ✓");
}

/* ==================== ZAXIRA: BAZANI YUKLASH / QAYTA TIKLASH ==================== */
function toNumId(v) {
  const n = Number(String(v == null ? '' : v).replace(/^[gs]/, ''));
  return isFinite(n) ? n : null;
}
function backupFilename() { return 'english_crm_backup_' + todayKey() + '.json'; }

/* Lokal (cloudsiz) rejimda zaxira ma'lumotini cloud-sxemada yig'amiz */
function localBackupData() {
  const accBySid = {};
  Object.keys(accounts).forEach(k => {
    const a = accounts[k];
    if (a.studentId) accBySid[a.studentId] = a;
  });
  const groups = getGroups().map(g => ({
    id: toNumId(g.id), name: g.name, days: g.days, time: g.time
  })).filter(g => g.id != null);

  const students = getStudents().map(st => {
    const acc = accBySid[st.id] || {};
    return {
      id: toNumId(st.id),
      name: st.fullName,
      school_class: st.schoolClass,
      group_id: st.groupId == null ? null : toNumId(st.groupId),
      login: acc.login || st.login || '',
      password: acc.password || st.password || '',
      speaking_debt: Number(st.speakingDebt) || 0
    };
  }).filter(x => x.id != null);

  const grades = [];
  const all = getGrades();
  Object.keys(all).forEach(sid => {
    const rec = all[sid] || {};
    Object.keys(rec).forEach(dk => {
      const r = rec[dk];
      const student_id = toNumId(sid);
      if (student_id == null) return;
      grades.push({ student_id, date: dk, grade: r.score, category: r.category || 'Darsdagi javob', note: r.note || '' });
    });
  });

  const attendance = [];
  const att = getAttendance();
  Object.keys(att).forEach(dk => {
    Object.keys(att[dk] || {}).forEach(sid => {
      const student_id = toNumId(sid);
      if (student_id == null) return;
      attendance.push({ student_id, date: dk, status: att[dk][sid] });
    });
  });

  const messages = store.get(K.messages, [])
    .filter(m => toNumId(m.sid) != null)
    .map(m => ({ student_id: toNumId(m.sid), sender: m.sender, text: m.text, created_at: m.createdAt }));

  const audio_submissions = [];
  getStudents().forEach(st => {
    const student_id = toNumId(st.id);
    if (student_id == null) return;
    (st.audioSubmissions || []).forEach(a => {
      if (!a || !a.url) return;
      audio_submissions.push({
        student_id, date: a.date, url: a.url,
        status: a.status || 'pending',
        score: a.score == null ? null : a.score,
        feedback: a.feedback || ''
      });
    });
  });

  return { groups, students, attendance, grades, messages, speaking_submissions: [], audio_submissions };
}

async function downloadBackup() {
  if (!isTeacher()) { toast("Ruxsat yo'q", 'error'); return false; }
  toast('Zaxira tayyorlanmoqda...');
  let data = null;
  if (CloudSync.ready()) data = await CloudSync.fetchBackup();
  if (!data) data = localBackupData();

  const payload = { app: 'english-tutor', version: 1, exported_at: new Date().toISOString() };
  Object.keys(data).forEach(k => { payload[k] = data[k]; });

  try {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = backupFilename();
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
    }
    toast('Zaxira yuklab olindi ✓');
    return true;
  } catch (e) {
    console.warn('[backup] download:', e);
    toast("Zaxirani yuklab bo'lmadi", 'error');
    return false;
  }
}

/* ==================== JADVALLARNI TOZALASH (avval zaxira bilan) ==================== */
const CLEANUP_TABLES = [
  ['grades', 'Baholar'],
  ['attendance', 'Davomat'],
  ['messages', 'Xabarlar'],
  ['speaking_submissions', 'Topshiriqlar']
];

async function startCleanup() {
  if (!isTeacher()) { toast("Ruxsat yo'q", 'error'); return; }
  const key = state.cleanupTable || 'grades';
  const label = (CLEANUP_TABLES.filter(t => t[0] === key)[0] || ['', key])[1];
  /* 1) Avval BARCHA jadvallar to'liq zaxira fayl sifatida yuklab olinadi */
  const ok = await downloadBackup();
  if (!ok) return; /* yuklab bo'lmadi — tozalashni boshlamaymiz */
  /* 2) Tasdiq modali */
  openModal(`
    <div class="modal-head">
      <h3>Jadvalni tozalash</h3>
      <button type="button" class="icon-btn" data-act="close-modal" aria-label="Yopish">✕</button>
    </div>
    <div class="confirm-body">
      <div class="confirm-emoji tint-amber">${ICON.brush}</div>
      <p class="confirm-text">Eski ma'lumotlar fayl ko'rinishida yuklandi. Bazani tozalashni tasdiqlaysizmi?</p>
      <p class="muted small" style="margin-top:9px">${ico('fileText', 14)} ${esc(label)} jadvalidagi yozuvlar o'chiriladi</p>
    </div>
    <div class="confirm-actions">
      <button type="button" class="btn btn-ghost" data-act="close-modal">Bekor qilish</button>
      <button type="button" class="btn btn-danger" data-act="do-cleanup">Ha, tozalash</button>
    </div>
  `);
}

async function doCleanup() {
  if (!isTeacher()) { toast("Ruxsat yo'q", 'error'); return; }
  closeModal();
  const key = state.cleanupTable || 'grades';
  toast('Baza tozalanmoqda...');
  const ok = await CloudSync.clearTable(key);
  if (!ok) { toast("Bulutda tozalab bo'lmadi", 'error'); return; }
  if (key === 'grades') store.set(K.grades, {});
  else if (key === 'attendance') store.set(K.attendance, {});
  else if (key === 'messages') store.set(K.messages, []);
  else if (key === 'speaking_submissions') store.set(K.tgsubs, []);
  render();
  toast('Jadval tozalandi ✓');
}

/* Cloudsiz rejimda: backup (cloud sxema) → lokal ilova modeli */
function restoreLocal(data) {
  const groups = (data.groups || []).map(g => {
    const n = toNumId(g.id);
    if (n == null) return null;
    return { id: 'g' + n, dbId: n, name: g.name || '', days: g.days || '', time: g.time || '', monthlyFee: Number(g.monthly_fee) || 0, groupType: g.group_type === 'school' ? 'school' : 'tutoring' };
  }).filter(Boolean);

  /* ovozli topshiriklar (audio_submissions) — o'quvchiga bog'lab tiklaymiz */
  const audioBySid = {};
  (data.audio_submissions || []).forEach((a, i) => {
    const sid = toNumId(a && a.student_id);
    if (sid == null || !a || !a.url) return;
    const rid = (a.id != null && a.id !== '') ? toNumId(a.id) : null;
    audioBySid['s' + sid] = audioBySid['s' + sid] || [];
    audioBySid['s' + sid].push({
      id: rid != null ? 'a' + rid : 'a' + Date.now() + i,
      rid: rid,
      date: a.date || '',
      url: a.url,
      status: a.status || 'pending',
      score: a.score == null ? null : Number(a.score),
      feedback: a.feedback || ''
    });
  });

  const students = (data.students || []).map(st => {
    const n = toNumId(st.id);
    if (n == null) return null;
    return {
      id: 's' + n,
      dbId: n,
      fullName: st.name || '',
      schoolClass: st.school_class || '',
      groupId: st.group_id == null ? null : 'g' + toNumId(st.group_id),
      login: st.login || '',
      password: st.password || '',
      speakingDebt: Number(st.speaking_debt) || 0,
      paymentDebt: Number(st.payment_debt) || 0,
      feePeriod: st.fee_period || '',
      voiceAllowed: st.voice_allowed !== false,
      telegramChatId: st.telegram_chat_id == null ? null : Number(st.telegram_chat_id),
      lastDevice: st.last_device || '',
      lastSeen: st.last_seen || null,
      audioSubmissions: (audioBySid['s' + n] || [])
    };
  }).filter(Boolean);

  const grades = {};
  (data.grades || []).forEach(r => {
    const sid = toNumId(r.student_id);
    if (sid == null || !r.date) return;
    grades['s' + sid] = grades['s' + sid] || {};
    grades['s' + sid][r.date] = {
      score: Number(r.grade),
      category: r.category || 'Darsdagi javob',
      note: r.note || ''
    };
  });

  const attendance = {};
  (data.attendance || []).forEach(r => {
    const sid = toNumId(r.student_id);
    if (sid == null || !r.date || !r.status) return;
    attendance[r.date] = attendance[r.date] || {};
    attendance[r.date]['s' + sid] = r.status;
  });

  const messages = (data.messages || []).map((m, i) => ({
    id: 'm' + (m.id != null ? m.id : i + 1),
    sid: 's' + toNumId(m.student_id),
    sender: m.sender,
    text: m.text,
    createdAt: m.created_at || new Date().toISOString()
  })).filter(m => m.sid && m.sid !== 'snull');

  store.set(K.groups, groups);
  store.set(K.students, students);
  store.set(K.grades, grades);
  store.set(K.attendance, attendance);
  store.set(K.messages, messages);

  /* hisoblar: ustoz (m_amirov) + zaxiradagi login/parollar */
  const next = {};
  next[TEACHER_LOGIN] = { login: TEACHER_LOGIN, password: TEACHER_PASSWORD, role: 'teacher', name: TEACHER_NAME, studentId: null };
  students.forEach(st => {
    if (st.login) next[st.login] = { login: st.login, password: st.password || '', role: 'student', studentId: st.id, name: st.fullName };
  });
  accounts = next;
  persistAccounts();

  /* uyga vazifalar (homework) */
  const hw = (data.homework || []).map(h => {
    const n = toNumId(h && h.id);
    if (n == null) return null;
    const gid = toNumId(h.group_id);
    return {
      id: 'h' + n, dbId: n, groupId: gid != null ? 'g' + gid : null,
      title: h.title || '', description: h.description || '',
      dueDate: h.due_date || '', mediaUrl: h.media_url || '', mediaType: h.media_type || '',
      createdAt: h.created_at || ''
    };
  }).filter(Boolean);
  store.set(K.homework, hw);

  /* to'lovlar tarixi */
  store.set(K.payments, (data.payments || []).map((pm, i) => {
    const sid = toNumId(pm && pm.student_id);
    if (sid == null) return null;
    return {
      id: 'p' + (pm.id != null ? pm.id : i + 1),
      dbId: pm.id != null ? toNumId(pm.id) : null,
      sid: 's' + sid,
      amount: Number(pm.amount) || 0,
      note: pm.note || '',
      createdAt: pm.created_at || ''
    };
  }).filter(Boolean));

  /* Telegram speaking topshiriklari */
  const subs = (data.speaking_submissions || []).map(t => {
    const n = toNumId(t && t.id);
    const sid = toNumId(t && t.student_id);
    if (n == null || sid == null) return null;
    return {
      id: 't' + n, dbId: n, sid: 's' + sid,
      mediaType: t.media_type || 'voice', status: t.status || 'kutilmoqda',
      score: t.score == null ? null : Number(t.score),
      feedback: t.feedback || '', createdAt: t.created_at || ''
    };
  }).filter(Boolean);
  store.set(K.tgsubs, subs);

  /* speaking slotlari — eski zaxiralarda bo'lmasa lokal slotlar saqlanadi */
  const ids = {};
  students.forEach(st => { ids[st.id] = 1; });
  if (Array.isArray(data.speaking_slots)) {
    const slots = data.speaking_slots.map(sx => {
      const n = toNumId(sx && sx.id);
      if (n == null) return null;
      const sid = toNumId(sx.student_id);
      return {
        id: 'sp' + n, dbId: n, date: sx.date || '',
        start: String(sx.start_time || '').slice(0, 5),
        end: String(sx.end_time || '').slice(0, 5),
        studentId: sid != null ? 's' + sid : null,
        score: sx.score == null ? null : Number(sx.score)
      };
    }).filter(Boolean);
    store.set(K.speaking, slots);
  } else {
    store.set(K.speaking, getSpeaking().map(x =>
      x.studentId && !ids[x.studentId] ? Object.assign({}, x, { studentId: null, score: null }) : x));
  }

  /* sesiya hisobdan chiqqan bo'lsa tozalaymiz */
  const sess = getSession();
  if (sess && !accounts[sess.login]) store.del(K.session);
}

/* --- Faylni o'qish → tasdiq modali --- */
let pendingRestore = null;

function readBackupFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function () {
    let data = null;
    try { data = JSON.parse(String(reader.result)); } catch (e) { data = null; }
    if (!data || !Array.isArray(data.groups) || !Array.isArray(data.students)) {
      toast("Fayl noto'g'ri: bu mos kelmaydigan zaxira fayli", 'error');
      return;
    }
    pendingRestore = data;
    openRestoreConfirm(
      file.name || backupFilename(),
      (data.students || []).length,
      (data.groups || []).length
    );
  };
  reader.onerror = function () { toast("Faylni o'qib bo'lmadi", 'error'); };
  reader.readAsText(file);
}

function openRestoreConfirm(fileName, nStudents, nGroups) {
  if (!isTeacher()) { toast("Ruxsat yo'q", 'error'); pendingRestore = null; return; }
  openModal(`
    <div class="modal-head">
      <h3>Bazani qayta tiklash</h3>
      <button type="button" class="icon-btn" data-act="close-modal" aria-label="Yopish">✕</button>
    </div>
    <div class="confirm-body">
      <div class="confirm-emoji tint-indigo">${ICON.upload}</div>
      <p class="confirm-text">Haqiqatan ham bazani ushbu fayldan qayta tiklamoqchimisiz? Hozirgi ma'lumotlar yangilanadi.</p>
      <p class="muted small" style="margin-top:9px">${ico('fileText', 14)} ${esc(fileName)} • ${nGroups} guruh, ${nStudents} o'quvchi</p>
    </div>
    <div class="confirm-actions">
      <button type="button" class="btn btn-ghost" data-act="close-modal">Bekor qilish</button>
      <button type="button" class="btn btn-danger" data-act="do-restore">Ha, tiklash</button>
    </div>
  `);
}

async function doRestoreBackup() {
  if (!isTeacher()) { toast("Ruxsat yo'q", 'error'); pendingRestore = null; return; }
  const data = pendingRestore;
  pendingRestore = null;
  if (!data) { toast('Zaxira fayli topilmadi', 'error'); return; }
  closeModal();
  toast('Baza qayta tiklanmoqda...');

  if (CloudSync.ready()) {
    const ok = await CloudSync.restoreBackup(data);
    if (!ok) { toast('Bazani qayta tiklashda xatolik', 'error'); return; }
    await CloudSync.pullAll();
    render();
    toast('Baza qayta tiklandi ✓');
  } else {
    restoreLocal(data);
    render();
    toast('Baza qayta tiklandi ✓ (lokal rejim)');
  }
}

/* ==================== 10 BALLIK BAHOLAR JURNALI (faqat ustoz) ==================== */
function ensureGradeState() {
  const groups = getGroups();
  if (!groups.some(g => g.id === state.gradeGroup)) {
    state.gradeGroup = groups.length ? groups[0].id : '';
  }
  const dates = journalDates(state.gradeGroup, 6);
  if (dates.indexOf(state.gradeDate) < 0) {
    state.gradeDate = dates.length ? dates[dates.length - 1] : '';
  }
}
function gradeCellHTML(sid, dkey) {
  const rec = (getGrades()[sid] || {})[dkey];
  const focus = state.gradeDate === dkey ? ' on' : '';
  if (!rec) {
    return `<td class="bj-cell"><button type="button" class="bj-grade g-empty" data-act="edit-grade" data-sid="${sid}" data-date="${dkey}" title="Baho qo'yish">–</button></td>`;
  }
  return `<td class="bj-cell"><button type="button" class="bj-grade ${gradeClassOf(rec.score)}${focus}" data-act="edit-grade" data-sid="${sid}" data-date="${dkey}"
    title="${esc(rec.category || '')}${rec.note ? ' — ' + esc(rec.note) : ''}">${rec.score}</button></td>`;
}

function gradesScreen() {
  if (!isTeacher()) return blockedScreen("Bu bo'lim faqat Muzaffar Amirov uchun");
  ensureGradeState();
  const groups = getGroups();
  if (!groups.length) {
    return `<div class="screen-head"><h2 class="screen-title">${t('Baholar')}</h2></div>` + emptyState("Avval guruh yarating", 'grades');
  }

  const dates = state.weekOffset !== 0
    ? weekDates(state.gradeGroup, state.weekOffset)
    : journalDates(state.gradeGroup, 6);
  const all = getStudents().filter(s => s.groupId === state.gradeGroup);
  const rows = all.filter(s => state.gradeClass === 'Barchasi' || s.schoolClass === state.gradeClass);
  const classChips = ['Barchasi'].concat(APP_DATA.classes);

  const head = `<tr>
    <th class="bj-name col-student">${t("O'quvchi")}</th>
    ${dates.map(d => `<th class="bj-date ${state.gradeDate === d ? 'is-focus' : ''}"><button type="button" class="bj-date-btn" data-act="grade-date" data-date="${d}">${fmtDM(d)}</button></th>`).join('')}
    <th class="bj-sum">${t("O'rtacha")}</th>
  </tr>`;

  const body = rows.map(s => {
    const nums = scoresFor(s.id, dates);
    const avg = avgOf(nums);
    return `<tr>
      <td class="bj-name col-student">
        <div class="bj-name-cell">
          <span class="s-name">${esc(s.fullName)}</span>
          <span class="chip-class">${esc(tClass(s.schoolClass))}</span>
        </div>
      </td>
      ${dates.map(d => gradeCellHTML(s.id, d)).join('')}
      <td class="bj-sum">
        <span class="sum-avg ${avg == null ? 'g-empty' : gradeClassOf(avg)}">${fmtAvg(avg)}</span>
        <span class="sum-total">Jami: ${totalOf(nums)}</span>
      </td>
    </tr>`;
  }).join('');

  /* Jadval oxirida umumiy o'rtacha (Average score) */
  const allNums = [];
  rows.forEach(s => scoresFor(s.id, dates).forEach(v => allNums.push(v)));
  const classAvg = avgOf(allNums);
  const foot = rows.length ? `<tfoot><tr class="bj-foot">
    <td class="bj-name col-student bj-foot-label">${t("O'rtacha bahosi")}</td>
    ${dates.map(() => '<td class="bj-cell"></td>').join('')}
    <td class="bj-sum bj-foot-label"><span class="sum-avg ${classAvg == null ? 'g-empty' : 'g-num'}">${fmtAvg(classAvg)}</span></td>
  </tr></tfoot>` : '';

  return `
  <div class="screen-head">
    <div>
      <h2 class="screen-title">${t('Baholar')}</h2>
      <div class="muted small">10 ballik tizim • ${rows.length} ta o'quvchi</div>
    </div>
  </div>

  <div class="selector-row">
    <span class="selector-label">${t('Guruh')}</span>
    <div class="chips">
      ${groups.map(g => `<button type="button" class="chip-btn ${state.gradeGroup === g.id ? 'active' : ''}" data-act="grade-group" data-group="${g.id}">${esc(g.name)}</button>`).join('')}
    </div>
  </div>

  <div class="selector-row">
    <span class="selector-label">${t('Sinf')}</span>
    <div class="chips">
      ${classChips.map(c => `<button type="button" class="chip-btn ${state.gradeClass === c ? 'active' : ''}" data-act="grade-class" data-class="${esc(c)}">${esc(tClass(c))}</button>`).join('')}
    </div>
  </div>

  <div class="week-nav-bar">
    <button type="button" id="btn-prev-week" class="week-btn prev" data-act="grade-week" data-dir="-1">&#8249; ${t('Oldingi hafta')}</button>
    <div class="week-label" id="current-week-label">${weekLabel(state.weekOffset || 0)}</div>
    <div style="display:flex;align-items:center;gap:6px;">
      <button type="button" id="btn-today-week" class="week-btn today" data-act="grade-week" data-dir="0">${t('Bugun')}</button>
      <button type="button" id="btn-next-week" class="week-btn next" data-act="grade-week" data-dir="1">${t('Keyingi hafta')} &#8250;</button>
    </div>
  </div>

  <div class="grid-scroll">
    <table class="bj">
      <thead>${head}</thead>
      <tbody>${body || `<tr><td class="bj-name col-student">${esc("Bu sinfda o'quvchi yo'q")}</td></tr>`}</tbody>
      ${foot}
    </table>
  </div>

  <div class="legend">
    <span>8–10 A'lo</span>
    <span>6–7 Yaxshi</span>
    <span>1–5 Qoniqarsiz</span>
  </div>
  <p class="muted small" style="margin-top:10px">Baho qo'yish uchun katakchaga bosing.</p>
  `;
}

/* ---- Baho editori (1-tap) ---- */
function renderGradeEditor() {
  const e = state.editor;
  if (!e) return;
  const st = studentById(e.sid);
  if (!st) return;
  const cats = APP_DATA.gradeCategories;

  $('#modal-sheet').innerHTML = `
    <div class="modal-head">
      <h3>Baho qo'yish</h3>
      <button type="button" class="icon-btn" data-act="close-grade" aria-label="Yopish">✕</button>
    </div>

    <div class="editor-info">
      <div class="avatar">${esc(initials(st.fullName))}</div>
      <div class="col">
        <div class="s-name">${esc(st.fullName)}</div>
        <div class="muted small">${fmtDMY(e.date)} • ${esc(st.schoolClass)}</div>
      </div>
      ${e.score != null ? `<span class="gr-score ${gradeClassOf(e.score)}">${e.score}</span>` : ''}
    </div>

    <div class="field-label">Baho (1–10)</div>
    <div class="score-grid">
      ${[1,2,3,4,5,6,7,8,9,10].map(n => `
        <button type="button" class="score-btn ${e.score === n ? 'sel ' + gradeClassOf(n) : ''}" data-act="grade-set" data-score="${n}">${n}</button>`).join('')}
    </div>

    <div class="field-label">Vazifa turi</div>
    <div class="cat-wrap">
      ${cats.map(c => `<button type="button" class="chip-btn ${e.category === c ? 'active' : ''}" data-act="grade-cat" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}
    </div>

    <label class="field-label" for="grade-note">Izoh (ixtiyoriy)</label>
    <input class="input" id="grade-note" maxlength="60" placeholder="Masalan: A'lo faollik" value="${esc(e.note || '')}" />

    <div class="row g8" style="margin-top:14px">
      <button type="button" class="btn btn-ghost" style="flex:1" data-act="grade-clear">O'chirish</button>
      <button type="button" class="btn btn-primary" style="flex:2" data-act="close-grade">Tayyor</button>
    </div>
  `;
  $('#modal-overlay').hidden = false;
}

function openGradeEditor(sid, dkey) {
  if (!isTeacher()) { toast("Bahani faqat Muzaffar Amirov qo'yadi", 'error'); return; }
  const rec = (getGrades()[sid] || {})[dkey];
  state.gradeDate = dkey;
  state.editor = {
    sid: sid,
    date: dkey,
    score: rec ? rec.score : null,
    category: rec && rec.category ? rec.category : APP_DATA.gradeCategories[0],
    note: rec && rec.note ? rec.note : ''
  };
  renderGradeEditor();
}

function persistEditor(silent) {
  const e = state.editor;
  if (!e || e.score == null) return;
  const all = getGrades();
  all[e.sid] = all[e.sid] || {};
  all[e.sid][e.date] = { score: e.score, category: e.category, note: e.note || '' };
  store.set(K.grades, all);
  CloudSync.pushGrade(e.sid, e.date);
  if (!silent) toast('Baho saqlandi ✓');
}

/* ==================== TEZKOR DAVOMAT (faqat ustoz) ==================== */
function ensureAttState() {
  const groups = getGroups();
  if (!groups.some(g => g.id === state.attGroup)) {
    state.attGroup = groups.length ? groups[0].id : '';
  }
  if (!state.attDate) state.attDate = todayKey();
  if (state.attDraftFor !== state.attDate) {
    state.attDraft = Object.assign({}, (getAttendance()[state.attDate] || {}));
    state.attDraftFor = state.attDate;
  }
}

function attendanceScreen() {
  if (!isTeacher()) return blockedScreen("Bu bo'lim faqat Muzaffar Amirov uchun");
  ensureAttState();
  const groups = getGroups();
  if (!groups.length) {
    return `<div class="screen-head"><h2 class="screen-title">${t('Davomat')}</h2></div>` + emptyState("Avval guruh yarating", 'cal');
  }

  const students = getStudents().filter(s => s.groupId === state.attGroup);
  const draft = state.attDraft || {};
  const cnt = { present: 0, absent: 0, excused: 0 };
  students.forEach(s => { if (draft[s.id]) cnt[draft[s.id]]++; });
  const marked = cnt.present + cnt.absent + cnt.excused;

  const rows = students.map(s => `
    <div class="att-row">
      <div class="att-top">
        <div class="row g8" style="min-width:0">
          <div class="avatar" style="width:34px;height:34px;font-size:13px">${esc(initials(s.fullName))}</div>
          <div class="col" style="min-width:0">
            <div class="s-name">${esc(s.fullName)}</div>
            <div class="muted small">${esc(s.schoolClass)}</div>
          </div>
        </div>
      </div>
      <div class="att-btns">
        ${APP_DATA.attendanceStatuses.map(st => `
          <button type="button" class="att-btn ${draft[s.id] === st.id ? 'on-' + st.id : ''}"
            data-act="att-set" data-sid="${s.id}" data-status="${st.id}">
            <span class="ic">${st.icon}</span>${st.label}
          </button>`).join('')}
      </div>
    </div>`).join('');

  return `
  <div class="screen-head">
    <div>
      <h2 class="screen-title">${t('Tezkor davomat')}</h2>
      <div class="muted small">${marked}/${students.length} belgilandi</div>
    </div>
    <button type="button" class="btn btn-ghost btn-sm" data-act="nav" data-screen="speaking">${ico('mic', 15)} Speaking</button>
  </div>

  <div class="selector-row">
    <span class="selector-label">${t('Guruh')}</span>
    <div class="chips">
      ${groups.map(g => `<button type="button" class="chip-btn ${state.attGroup === g.id ? 'active' : ''}" data-act="att-group" data-group="${g.id}">${esc(g.name)}</button>`).join('')}
    </div>
  </div>

  <div class="selector-row">
    <span class="selector-label">${t('Sana')}</span>
    <input class="input" id="att-date" type="date" value="${esc(state.attDate)}" max="${todayKey()}" />
  </div>

  <div class="att-summary">
    <span class="att-pill">✓ Keldi: ${cnt.present}</span>
    <span class="att-pill">✕ Kelmadi: ${cnt.absent}</span>
    <span class="att-pill">? Sababli: ${cnt.excused}</span>
  </div>

  <div class="card" style="padding-top:4px;padding-bottom:4px">
    ${students.length ? rows : emptyState("Bu guruhda o'quvchi yo'q", 'students')}
  </div>

  <button type="button" class="btn btn-primary btn-block" data-act="att-save">Davomatni saqlash</button>
  `;
}

/* ==================== SPEAKING (1-on-1) SLOTLARI ==================== */
function ensureSpeakState() { if (!state.speakDate) state.speakDate = todayKey(); }

function speakRowHTML(x) {
  const st = x.studentId ? studentById(x.studentId) : null;
  const scored = x.score != null;
  return `<div class="speak-row" data-slot="${esc(x.id)}">
    <div class="speak-top">
      <span class="slot-time">${esc(x.start)} – ${esc(x.end)}</span>
      <span class="slot-who">
        ${st ? `<span class="who-name">${esc(st.fullName)}</span>` : '<span class="who-free">Bosh (tayinlanmagan)</span>'}
      </span>
      <span class="slot-badge ${scored ? 'done' : 'wait'}">${scored ? 'Baho: ' + x.score : (st ? 'Baholanmagan' : 'Bo\'sh')}</span>
    </div>
    <div class="speak-actions">
      ${st ? '' : `<button type="button" class="btn btn-xs ghost" data-act="slot-assign" data-id="${esc(x.id)}">${ico('profile', 14)} Tayinlash</button>`}
      <button type="button" class="btn btn-xs ${scored ? 'ghost' : 'primary'}" data-act="slot-score" data-id="${esc(x.id)}">${scored ? "Bahoni o'zgartirish" : ico('star', 14) + ' Baholash'}</button>
      <button type="button" class="btn btn-xs danger" data-act="slot-del" data-id="${esc(x.id)}">O'chirish</button>
    </div>
  </div>`;
}

function speakingScreen() {
  if (!isTeacher()) return blockedScreen("Bu bo'lim faqat Muzaffar Amirov uchun");
  ensureSpeakState();
  const students = getStudents();
  const list = getSpeaking()
    .filter(x => x.date === state.speakDate)
    .sort((a, b) => a.start.localeCompare(b.start));

  return `
  <div class="screen-head">
    <div>
      <h2 class="screen-title">${t('Speaking')}</h2>
      <div class="muted small">1-on-1 slotlar • ${list.length} ta slot</div>
    </div>
    <button type="button" class="btn btn-primary btn-sm" data-act="open-slot">+ Slot</button>
  </div>

  <div class="selector-row">
    <span class="selector-label">${t('Sana')}</span>
    <input class="input" id="sp-date" type="date" value="${esc(state.speakDate)}" />
  </div>

  <div class="card" style="padding-top:4px;padding-bottom:4px">
    ${list.length ? list.map(speakRowHTML).join('') : emptyState("Bu sanada slot yo'q — 'Slot' tugmasini bosing")}
  </div>

  <div class="section-title">Speaking qarzi (o'quvchilar)</div>
  <div class="card">
    ${students.map(st => `
      <div class="row between" style="padding:8px 0;border-bottom:1px solid var(--card-border)">
        <span class="s-name">${esc(st.fullName)} <span class="chip-class">${esc(st.schoolClass)}</span></span>
        <div class="debt-controls">
          <button type="button" class="btn btn-xs ghost" data-act="debt-minus" data-sid="${st.id}">−</button>
          <span class="debt-num">${Number(st.speakingDebt) || 0} ta</span>
          <button type="button" class="btn btn-xs ghost" data-act="debt-plus" data-sid="${st.id}">+</button>
        </div>
      </div>`).join('')}
  </div>

  ${speakingLogHTML()}

  <div class="section-title">Telegram topshiriqlari (Inbox)</div>
  <div class="card">
    ${renderTgInbox()}
  </div>

  <p class="muted small" style="margin-top:10px">Slotga o'quvchi tayinlanadi. Ovozli/video topshiriklar botga tushadi (foydalanuvchi ruxsati bilan) — "Baholash" orqali 1–10 ball qo'yiladi, ball baholar jurnaliga tushadi va Speaking qarzi 1 ga kamayadi.</p>
  `;
}

/* ---- Speaking sessiyalar jurnali (bir xil sana uchun ko'p sessiya — hammasi saqlanadi) ---- */
function logSpeakingSession(sid, date, score, source) {
  const log = store.get(K.speakLog, []) || [];
  log.unshift({ sid: sid, date: date, score: Number(score) || 0, source: source || '', at: new Date().toISOString() });
  store.set(K.speakLog, log.slice(0, 200));
}
function speakingLogHTML() {
  const log = (store.get(K.speakLog, []) || []).slice(0, 15);
  if (!log.length) return '';
  const byId = {};
  getStudents().forEach(s => { byId[s.id] = s; });
  return `
  <div class="section-title">Speaking sessiyalar jurnali</div>
  <div class="card">
    ${log.map(e => `
      <div class="row between" style="padding:7px 0;border-bottom:1px solid var(--line)">
        <span class="muted small">${e.date ? fmtDM(e.date) : '—'} • ${e.sid && byId[e.sid] ? esc(byId[e.sid].fullName) : '—'}</span>
        <span class="chip-class">${Number(e.score) || 0}/10</span>
      </div>`).join('')}
  </div>`;
}

/* ---- Telegram topshiriklari (ustoz uchun inbox) ---- */
function renderTgInbox() {
  /* Baholangan yoki bekor qilingan topshirik kartalari INBOXdan chiqadi (silliq ravishda) */
  const subs = getTgSubs().filter(function (t) {
    return t.status !== 'baholandi' && t.status !== 'graded' && t.status !== 'rad_etildi';
  }).slice().reverse(); /* yangisi yuqorida */
  if (!subs.length) return emptyState("Hozircha Telegram orqali topshirik yo'q");
  const byId = {};
  getStudents().forEach(s => { byId[s.id] = s; });
  return subs.map(t => {
    const st = byId[t.sid];
    const day = t.createdAt ? String(t.createdAt).slice(0, 10) : '';
    return `
    <div class="audio-item" data-tgcard="${esc(t.id)}">
      <div class="audio-item__meta">
        <strong>${st ? esc(st.fullName) : '—'}</strong> ${st ? `<span class="chip-class">${esc(st.schoolClass)}</span>` : ''} ·
        ${t.mediaType === 'voice' ? ico('mic', 14) + ' Ovozli xabar' : ico('video', 14) + ' Video'}${day ? ' · ' + fmtDMY(day) : ''} ·
        ${ico('clock', 14)} Kutilmoqda
      </div>
      <div class="grade-row">
        ${[1,2,3,4,5,6,7,8,9,10].map(n => `
          <button type="button" class="btn btn-xs ${t.score === n ? 'btn-primary' : 'ghost'}" data-act="tg-grade" data-tid="${t.id}" data-score="${n}">${n}</button>`).join('')}
        <input class="input" style="flex:1;min-width:140px" placeholder="Izoh (ixtiyoriy)" value="${esc(t.feedback || '')}" data-act="tg-feedback" data-tid="${t.id}" />
        <button type="button" class="btn btn-xs danger" data-act="tg-reject" data-tid="${t.id}">❌ Bekor qilish</button>
      </div>
    </div>`;
  }).join('');
}

/* ---- Slot yaratish / tayinlash ---- */
function openSlotModal(mode, id) {
  if (!isTeacher()) { toast("Ruxsat yo'q", 'error'); return; }
  ensureSpeakState();
  state.slotMode = mode;
  state.slotId = id || '';
  const students = getStudents();
  const cur = id ? getSpeaking().filter(x => x.id === id)[0] : null;
  const assignOnly = mode === 'assign';

  openModal(`
    <div class="modal-head">
      <h3>${assignOnly ? 'O\'quvchi tayinlash' : 'Slot qo\'shish'}</h3>
      <button type="button" class="icon-btn" data-act="close-modal" aria-label="Yopish">✕</button>
    </div>

    ${cur ? `<div class="editor-info">
      <div class="slot-time">${esc(cur.start)} – ${esc(cur.end)}</div>
      <div class="muted small">${fmtDMY(cur.date)}</div>
    </div>` : `
    <label class="field-label" for="sp-modal-date">Sana</label>
    <input class="input" id="sp-modal-date" type="date" value="${esc(state.speakDate)}" />

    <div class="row g8">
      <div class="col">
        <label class="field-label" for="sp-start">Boshlanish</label>
        <input class="input" id="sp-start" type="time" value="14:00" />
      </div>
      <div class="col">
        <label class="field-label" for="sp-end">Tugash</label>
        <input class="input" id="sp-end" type="time" value="14:20" />
      </div>
    </div>`}

    <label class="field-label" for="sp-student">O'quvchi</label>
    <select class="input" id="sp-student">
      <option value="">— Tanlanmagan —</option>
      ${students.map(s => {
        const g = groupById(s.groupId);
        return `<option value="${s.id}" ${cur && cur.studentId === s.id ? 'selected' : ''}>${esc(s.fullName)}${g ? ' — ' + esc(g.name) : ''}</option>`;
      }).join('')}
    </select>

    <button type="button" class="btn btn-primary btn-block" data-act="save-slot">${assignOnly ? 'Tayinlash' : 'Saqlash'}</button>
  `);
}

function saveSlot() {
  const list = getSpeaking();
  const sid = $('#sp-student') ? $('#sp-student').value : '';

  if (state.slotMode === 'assign') {
    const cur = list.filter(x => x.id === state.slotId)[0];
    if (!cur) return;
    cur.studentId = sid || null;
    cur.score = null;
    store.set(K.speaking, list);
    CloudSync.pushSlot(cur);
    closeModal();
    render();
    toast(sid ? 'O\'quvchi tayinlandi ✓' : 'Tayinlov o\'chirildi');
    return;
  }

  const date = $('#sp-modal-date').value;
  const start = $('#sp-start').value;
  const end = $('#sp-end').value;
  if (!date) { toast("Sanani tanlang", 'error'); return; }
  if (!start || !end) { toast("Vaqt oralig'ini kiriting", 'error'); return; }
  if (end <= start) { toast("Tugash vaqti boshlanishdan keyin bo'lishi kerak", 'error'); return; }
  if (list.some(x => x.date === date && x.start === start)) { toast("Bu sanada shu vaqtda slot bor", 'error'); return; }

  const slot = { id: 'sp' + Date.now(), date: date, start: start, end: end, studentId: sid || null, score: null };
  list.push(slot);
  store.set(K.speaking, list);
  CloudSync.pushSlot(slot);
  state.speakDate = date;
  closeModal();
  render();
  toast("Slot qo'shildi ✓");
}

/* ---- Slotni baholash → jurnalga sync ---- */
function openScoreSlot(id) {
  if (!isTeacher()) { toast("Ruxsat yo'q", 'error'); return; }
  const x = getSpeaking().filter(s => s.id === id)[0];
  if (!x || !x.studentId) { toast("Avval o'quvchi tayinlang", 'error'); return; }
  const st = studentById(x.studentId);
  if (!st) return;

  openModal(`
    <div class="modal-head">
      <h3>Speaking bahosi</h3>
      <button type="button" class="icon-btn" data-act="close-modal" aria-label="Yopish">✕</button>
    </div>

    <div class="editor-info">
      <div class="avatar">${esc(initials(st.fullName))}</div>
      <div class="col">
        <div class="s-name">${esc(st.fullName)}</div>
        <div class="muted small">${esc(st.schoolClass)} • ${fmtDMY(x.date)} • ${esc(x.start)} – ${esc(x.end)}</div>
      </div>
    </div>

    <div class="field-label">Speaking baho (1–10)</div>
    <div class="score-grid">
      ${[1,2,3,4,5,6,7,8,9,10].map(n => `
        <button type="button" class="score-btn ${x.score === n ? 'sel ' + gradeClassOf(n) : ''}" data-act="save-score" data-id="${esc(x.id)}" data-score="${n}">${n}</button>`).join('')}
    </div>
    <p class="muted small" style="margin-top:12px">Ball tanlansa, o'quvchining baholar jurnaliga darhol yoziladi.</p>
  `);
}

function saveSlotScore(id, score) {
  const list = getSpeaking();
  const x = list.filter(s => s.id === id)[0];
  if (!x || !x.studentId) return;

  x.score = score;
  store.set(K.speaking, list);
  CloudSync.pushSlot(x);

  /* Jurnalga sync */
  const all = getGrades();
  all[x.studentId] = all[x.studentId] || {};
  all[x.studentId][x.date] = {
    score: score,
    category: APP_DATA.speakingCategory,
    note: 'Speaking 1-on-1'
  };
  store.set(K.grades, all);
  CloudSync.pushGrade(x.studentId, x.date);

  closeModal();
  render();
  toast("Speaking bahosi saqlandi ✓ (jurnalga yozildi)");
}

/* ==================== KIRISH MANTIQI ==================== */
const LOGIN_MAX_FAILS = 5;
const LOGIN_LOCK_MS = 10 * 60 * 1000; /* 10 daqiqa qulf */

function loginLockRec() {
  const r = store.get(K.loginFails, null);
  if (!r) return null;
  if (r.until && Date.now() >= r.until) { store.del(K.loginFails); return null; }
  return r;
}
function loginLockText(r) {
  const left = Math.max(0, (r && r.until ? r.until : 0) - Date.now());
  const mm = String(Math.floor(left / 60000)).padStart(2, '0');
  const ss = String(Math.floor((left % 60000) / 1000)).padStart(2, '0');
  return "Xavfsizlik: 5 marta xato kiritildi. Iltimos, " + mm + ':' + ss + " daqiqa kuting.";
}
function registerLoginFail() {
  const r = store.get(K.loginFails, null) || { count: 0, until: 0 };
  r.count = (r.count || 0) + 1;
  if (r.count >= LOGIN_MAX_FAILS) r.until = Date.now() + LOGIN_LOCK_MS;
  store.set(K.loginFails, r);
  return r;
}
/* Login ekranidagi jonli hisoblagich: qulf tugunicha 'Kirish' o'chiriladi */
function syncLoginLock() {
  if (state.loginTimer) { clearInterval(state.loginTimer); state.loginTimer = null; }
  if (state.screen !== 'login') return;
  const tick = () => {
    const r = loginLockRec();
    const btnEl = $('[data-act="do-login"]');
    const errEl = $('#login-error');
    if (!r || !r.until) {
      if (btnEl) btnEl.disabled = false;
      if (errEl && String(errEl.textContent).indexOf('Xavfsizlik:') === 0) {
        errEl.textContent = '';
        errEl.classList.remove('show');
      }
      if (state.loginTimer) { clearInterval(state.loginTimer); state.loginTimer = null; }
      return;
    }
    if (btnEl) btnEl.disabled = true;
    if (errEl) { errEl.textContent = loginLockText(r); errEl.classList.add('show'); }
  };
  tick();
  if (loginLockRec() && loginLockRec().until) state.loginTimer = setInterval(tick, 1000);
}

/* Telegram WebApp initData tekshiruvi (identity spoofing ga qarshi).
   To'liq HMAC tekshiruvi bot tokeni (faqat serverda) talab qiladi — brauzerda
   token saqlab bo'lmaydi. Shu yerda xavfsiz cross-reference qilinadi:
   initData 'user' id → initDataUnsafe.user.id mosligi, 'hash' mavjudligi va
   auth_date yangiligi (24 soat) tekshiriladi; nomuvofiqlik → kirish rad etiladi. */
function telegramInitDataOK() {
  try {
    const tg = window.Telegram && window.Telegram.WebApp;
    if (!tg || !tg.initData) return true; /* Telegram'siz (brauzerda) kirish */
    const params = new URLSearchParams(tg.initData);
    if (!params.get('hash')) return false;
    const userStr = params.get('user');
    if (!userStr) return true;
    const user = JSON.parse(userStr);
    const du = tg.initDataUnsafe && tg.initDataUnsafe.user;
    if (!du || String(du.id) !== String(user.id)) return false; /* soxtalanish belgisi */
    const authDate = Number(params.get('auth_date') || 0);
    if (authDate && (Date.now() / 1000 - authDate) > 86400) return false; /* 24+ soat eskirgan */
    return true;
  } catch (e) { return false; }
}

function doLogin() {
  /* Bot honeypot: bu maydon to'ldirilgan bo'lsa — jimjimrad rad etiladi */
  const hp = $('#login-bot-hp');
  if (hp && hp.value) return;

  const loginEl = $('#login-input');
  const passEl = $('#password-input');
  const err = $('#login-error');
  const login = (loginEl.value || '').trim().toLowerCase();
  const pass = passEl.value || '';

  const fail = msg => {
    if (err) { err.textContent = msg; err.classList.add('show'); }
  };

  /* Anti-brute-force: 5 ta ketma-ket xato → 10 daqiqa qulf */
  const locked = loginLockRec();
  if (locked && locked.until) { fail(loginLockText(locked)); syncLoginLock(); return; }

  /* Telegram kimlik soxtalanishini keskin rad etish */
  if (!telegramInitDataOK()) { fail("Telegram kirishi tekshiruvi majburiy — kirish rad etildi"); return; }

  if (!login || !pass) { fail("Login va parolni kiriting"); return; }
  if (err) { err.textContent = ''; err.classList.remove('show'); }

  const validate = () => {
    const acc = accounts[login];
    if (!acc || !passwordMatches(pass, acc.password)) {
      const r = registerLoginFail();
      if (r && r.until) {
        fail(loginLockText(r));
        syncLoginLock();
      } else {
        fail("Login yoki parol noto'g'ri");
      }
      passEl.value = '';
      passEl.focus();
      return;
    }
    store.del(K.loginFails);
    /* Eski ochiq parol mos keldi — darhol SHA-256 xeshga yangilaymiz */
    if (acc.role === 'student' && acc.studentId && !isSha256Hex(acc.password) && CloudSync.ready()) {
      accounts[login].password = hashPasswordSync(pass);
      persistAccounts();
      CloudSync.pushStudent(acc.studentId);
    }
    startSession(login);
    toast('Xush kelibsiz!');
  };

  /* Boshqa qurilmadan kirish: avval bulutdan hisoblarni tekshiramiz */
  if (CloudSync.ready()) {
    if (loginEl.disabled) return;
    loginEl.disabled = true;
    const done = () => { loginEl.disabled = false; validate(); };
    CloudSync.pullAll(login).then(done, done);
  } else {
    validate();
  }
}

function logout() {
  /* Faol qurilmalar: o'z seansimiz user_sessions dan o'chiriladi */
  Sessions.onLogout();
  analyticsCall('reset');
  store.del(K.session);
  state.attDraft = null;
  state.attDraftFor = '';
  state.editor = null;
  state.filterGroup = null;
  state.filterClass = 'Barchasi';
  state.search = '';
  closeModal();
  state.screen = 'login';
  render();
  toast('Hisobdan chiqdingiz');
}

/* ==================== Render ==================== */
const SCREENS = {
  'login': loginScreen,
  'home': homeScreen,
  'groups': groupsScreen,
  'students': studentsScreen,
  'debtors': debtorsScreen,
  'payments': paymentsScreen,
  'grades': gradesScreen,
  'attendance': attendanceScreen,
  'speaking': speakingScreen,
  'profile': profileScreen
};

/* Xavfsizlik chegarasi: noto'g'ri rol o'ziga tegishli ekranlara kira olmaydi */
function canAccess(scr) {
  if (scr === 'login') return true;
  if (scr === 'home' || scr === 'profile') return true;
  if (TEACHER_SCREENS.indexOf(scr) >= 0) return isTeacher();
  return false;
}

function render() {
  let scr = state.screen;
  if (!currentUser()) scr = 'login';
  else if (!canAccess(scr)) scr = 'home';
  state.screen = scr;

  document.body.classList.toggle('auth-mode', AUTH_SCREENS.indexOf(scr) >= 0);
  $('#app-header').innerHTML = renderHeader();
  $('#bottom-nav').innerHTML = renderNav();
  renderTopNavTabs();
  renderTopNavControls();
  $('#screen').innerHTML = (SCREENS[scr] || loginScreen)();
  if (scr === 'students') refreshStudentList();
  if (scr === 'grades') ensureGradeState();
  if (scr === 'attendance') ensureAttState();
  if (scr === 'speaking') ensureSpeakState();
  if (scr === 'home' && !isTeacher()) refreshChat();
  syncLoginLock();
}

/* ==================== CHAT (Ustoz ↔ O'quvchi) ==================== */
function fmtHM(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}
function messagesFor(sid) {
  const rows = store.get(K.messages, []).filter(m => m.sid === sid);
  /* Takroriy xabarlarni yagona id bo'yicha kesib tashlaymiz */
  const uniqueMessages = Array.from(new Map(rows.map(m => [m.id, m])).values());
  return uniqueMessages.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}
function chatListHTML(sid, viewer) {
  const msgs = messagesFor(sid);
  if (!msgs.length) return `<div class="empty"><span class="empty-ico">${ICON.message}</span>Hozircha xabar yo'q</div>`;
  return msgs.map(m => `<div class="chat-msg ${m.sender === viewer ? 'mine' : 'theirs'}" data-message-id="${esc(String(m.id))}">
      <div class="chat-text">${esc(m.text)}</div>
      <div class="chat-time">${fmtHM(m.createdAt)}</div>
    </div>`).join('');
}
function chatHint() {
  if (CloudSync.messagesAvailable()) return '';
  return `<div class="chat-hint">${ico('alert', 14)} Supabase'da <code>messages</code> jadvali topilmadi — xabarlar shu qurilmada saqlanadi (<code>supabase.sql</code> ni ishga tushiring).</div>`;
}
function activeChat() {
  if (state.chatSid) return { sid: state.chatSid, viewer: 'teacher' };
  const st = linkedStudent();
  return st ? { sid: st.id, viewer: 'student' } : null;
}
function updateChatView() {
  const list = $('#chat-list');
  const c = activeChat();
  if (!list || !c) return;
  list.innerHTML = '';
  list.innerHTML = chatListHTML(c.sid, c.viewer);
  list.scrollTop = list.scrollHeight;
}
function refreshChat() {
  const c = activeChat();
  if (!c) return Promise.resolve(false);
  return CloudSync.fetchMessages(c.sid).then(function () { updateChatView(); return true; });
}
function openChat(sid) {
  if (!isTeacher()) { toast("Ruxsat yo'q", 'error'); return; }
  const st = studentById(sid);
  if (!st) return;
  state.chatSid = sid;
  openModal(`
    <div class="modal-head">
      <h3>${ico('message', 20)} Xabar yozish</h3>
      <button type="button" class="icon-btn" data-act="close-modal" aria-label="Yopish">✕</button>
    </div>
    <div class="editor-info">
      <div class="avatar">${esc(initials(st.fullName))}</div>
      <div class="col">
        <div class="s-name">${esc(st.fullName)}</div>
        <div class="muted small">${esc(st.schoolClass)} • ${groupById(st.groupId) ? esc(groupById(st.groupId).name) : "Guruh taylanmagan"}</div>
      </div>
    </div>
    ${chatHint()}
    <div class="chat-list" id="chat-list">${chatListHTML(sid, 'teacher')}</div>
    <div class="chat-input-row">
      <input class="input" id="chat-input" placeholder="Xabar yozing..." autocomplete="off" />
      <button type="button" class="btn btn-primary" data-act="send-chat">Yuborish</button>
    </div>`);
  updateChatView();
  refreshChat();
  setTimeout(function () { const el = $('#chat-input'); if (el) el.focus(); }, 60);
}
function sendChat() {
  const c = activeChat();
  const input = $('#chat-input');
  if (!c || !input) return;
  const text = (input.value || '').trim();
  if (!text) { toast('Xabar matnini kiriting', 'error'); return; }
  const sendBtn = document.querySelector('[data-act="send-chat"]');
  if (sendBtn) sendBtn.disabled = true; /* Supabase insert tugaguncha o'chiriladi */
  input.value = '';
  /* Lokal xabar keshga darhol tushadi (sendMessage ichida) — shuning uchun
     natroniy ham render qilamiz, insert tugagach esa qayta render + tugma ochiladi. */
  const sending = CloudSync.sendMessage(c.sid, c.viewer, text);
  updateChatView();
  Promise.resolve(sending)
    .catch(function (e) { console.warn('[cloud] send:', (e && e.message) || e); })
    .then(function () {
      updateChatView();
      if (sendBtn) sendBtn.disabled = false;
    });
}

/* ==================== Hodisalar ==================== */
/* ==================== SPEAKING QARZI ==================== */
function changeDebt(sid, delta) {
  if (!isTeacher()) { toast("Ruxsat yo'q", 'error'); return; }
  const list = getStudents();
  const st = list.filter(x => x.id === sid)[0];
  if (!st) return;
  st.speakingDebt = Math.max(0, (Number(st.speakingDebt) || 0) + delta);
  store.set(K.students, list);
  CloudSync.adjustDebt(sid, delta);
  render();
  toast("Speaking qarzi: " + st.speakingDebt + " ta");
}

/* ==================== TELEGRAM TOPSHIRIKLARINI BAHOLASH (Ustoz) ==================== */
function gradeTgSub(tid, score) {
  if (!isTeacher()) { toast("Ruxsat yo'q", 'error'); return; }
  const subs = getTgSubs();
  const sub = subs.filter(x => x.id === tid)[0];
  if (!sub) return;
  const wasGraded = sub.status === 'baholandi' || sub.status === 'graded';
  sub.status = 'baholandi';
  sub.score = score;
  const fbInput = document.querySelector('[data-act="tg-feedback"][data-tid="' + tid + '"]');
  if (fbInput) sub.feedback = fbInput.value.trim();
  store.set(K.tgsubs, subs);

  const st = getStudents().filter(x => x.id === sub.sid)[0];
  const dateKey = sub.createdAt ? String(sub.createdAt).slice(0, 10) : todayKey();

  /* Baholangan har bir topshirik = qarzdan −1 (faqat birinchi marta) */
  if (st && !wasGraded) {
    const list = getStudents();
    const t = list.filter(x => x.id === sub.sid)[0];
    if (t) {
      t.speakingDebt = Math.max(0, (Number(t.speakingDebt) || 0) - 1);
      store.set(K.students, list);
      CloudSync.adjustDebt(t.id, -1);
    }
  }

  /* O'quvchi baholar jurnaliga yozish — bir xil sana uchun OLDINGI sessiyalar yo'qolmaydi */
  if (st) {
    const grades = getGrades();
    if (!grades[st.id]) grades[st.id] = {};
    logSpeakingSession(st.id, dateKey, score, 'telegram');
    const prev = grades[st.id][dateKey];
    if (prev) {
      /* Shu kunda sessiya allaqachon bor: avvalgi yozuv ustiga yozilmaydi,
         yangi sessiya qo'shimcha sifatida note ga qo'shiladi */
      prev.note = (prev.note ? prev.note + ' • ' : '') + 'Sessiya ' + prev.score + '/10 → ' + score + '/10' + (sub.feedback ? ' — ' + sub.feedback : '');
      prev.score = score;
    } else {
      grades[st.id][dateKey] = { score: score, category: 'Speaking', note: sub.feedback || 'Speaking (Telegram)' };
    }
    store.set(K.grades, grades);
    CloudSync.pushGrade(st.id, dateKey);
  }

  CloudSync.pushSpeakingGrade(tid);
  /* Baholangan karta INBOXdan silliq chiqib ketadi */
  const card = document.querySelector('[data-tgcard="' + tid + '"]');
  if (card && card.classList) {
    card.classList.add('is-leaving');
    setTimeout(function () { render(); }, 200);
  } else {
    render();
  }
  toast("Baho saqlandi ✓ (qarz kamaydi)");
}

/* ==================== TELEGRAM TOPSHIRIQLARINI BEKOR QILISH (Ustoz) ==================== */
/* Faqat status 'rad_etildi' bo'ladi: qarz KAMAYMAYDI va baholar jurnaliga yozilmaydi */
function rejectTgSub(tid) {
  if (!isTeacher()) { toast("Ruxsat yo'q", 'error'); return; }
  const subs = getTgSubs();
  const sub = subs.filter(x => x.id === tid)[0];
  if (!sub || sub.status === 'rad_etildi') return;
  sub.status = 'rad_etildi';
  sub.score = null;
  store.set(K.tgsubs, subs);
  CloudSync.pushSpeakingGrade(tid);  /* Supabase'ga status='rad_etildi' — qarz/jurnal tegilmaydi */

  /* Karta INBOXdan silliq chiqib ketadi */
  const card = document.querySelector('[data-tgcard="' + tid + '"]');
  if (card && card.classList) {
    card.classList.add('is-leaving');
    setTimeout(function () { render(); }, 200);
  } else {
    render();
  }
  toast("Topshirik bekor qilindi ✓ (qarz o'zgarmadi)");
}


/* ==================== TO'LOV CHEKI VA KARTA FUNKSIYALARI ==================== */
function openPayReceiptModal(amount, period) {
  const card = store.get(K.cardSettings, { number: '8600 0000 0000 0000', holder: 'MUZAFFAR AMIROV' });
  const rawNum = String(card.number || '8600 0000 0000 0000').replace(/\s+/g, '');
  const fmtCard = rawNum.replace(/(\d{4})/g, '$1 ').trim();
  const cardHolder = card.holder || 'MUZAFFAR AMIROV';
  const sum = Number(amount) || 0;
  const per = period || currentPeriod();

  openModal(`
    <div class="modal-head">
      <h3>💳 Karta orqali to'lov</h3>
      <button type="button" class="icon-btn" data-act="close-modal" aria-label="Yopish">✕</button>
    </div>

    <div class="bank-card-box" style="background:linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%);color:#fff;border-radius:14px;padding:16px;margin:8px 0 12px 0;box-shadow:0 6px 18px rgba(37,99,235,0.25)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <span style="font-size:12px;letter-spacing:1px;font-weight:700;opacity:0.9">UZCARD / HUMO</span>
        <span style="font-size:18px">💳</span>
      </div>
      <div style="font-family:monospace;font-size:18px;letter-spacing:2px;font-weight:700;margin-bottom:12px">${esc(fmtCard)}</div>
      <div style="display:flex;justify-content:space-between;align-items:flex-end">
        <div>
          <div style="font-size:10px;opacity:0.75;text-transform:uppercase">Karta egasi</div>
          <div style="font-size:13px;font-weight:600;letter-spacing:0.5px">${esc(cardHolder)}</div>
        </div>
        <button type="button" class="btn btn-xs" data-act="copy-card" data-card="${esc(rawNum)}" style="background:#fff;color:#1e3a8a;font-weight:600;border:none;border-radius:6px;padding:4px 10px">📋 Nusxalash</button>
      </div>
    </div>

    <div class="card" style="margin-bottom:10px;padding:10px">
      <div class="row between"><span class="muted small">Oy:</span><b>${esc(monthLabel(per))}</b></div>
      <div class="row between" style="margin-top:4px"><span class="muted small">To'lanadigan summa:</span><b style="color:var(--primary,#2563eb);font-size:16px">${fmtSom(sum)} so'm</b></div>
    </div>

    <div class="receipt-upload" style="margin-bottom:12px">
      <label class="field-label" for="receipt-file">📎 To'lov chekini yuklash (Rasm):</label>
      <input type="file" id="receipt-file" accept="image/*" class="input" style="padding:6px" />
      <div id="receipt-preview-wrap" style="display:none;margin-top:8px;text-align:center">
        <img id="receipt-preview-img" src="" alt="Chek rasmi" style="max-height:160px;max-width:100%;border-radius:8px;border:1px solid #e2e8f0" />
      </div>
      <div class="field-error" id="receipt-error"></div>
    </div>

    <div class="modal-actions">
      <button type="button" class="btn btn-ghost" data-act="close-modal">Bekor qilish</button>
      <button type="button" class="btn btn-primary" data-act="do-submit-receipt" data-amount="${sum}" data-period="${esc(per)}">📤 Chekni yuborish</button>
    </div>
  `);

  const fi = $('#receipt-file');
  if (fi) {
    fi.addEventListener('change', function () {
      const file = fi.files && fi.files[0];
      const wrap = $('#receipt-preview-wrap');
      const img = $('#receipt-preview-img');
      if (file && wrap && img && window.URL) {
        img.src = URL.createObjectURL(file);
        wrap.style.display = 'block';
      }
    });
  }
}

async function doSubmitPaymentReceipt() {
  const fi = $('#receipt-file');
  const file = fi && fi.files && fi.files[0];
  const err = $('#receipt-error');
  if (!file) {
    if (err) { err.textContent = "Iltimos, to'lov cheki rasmini tanlang"; err.classList.add('show'); }
    return;
  }
  const btn = $('[data-act="do-submit-receipt"]');
  const amount = Number(btn ? btn.getAttribute('data-amount') : 0) || 0;
  const period = btn ? btn.getAttribute('data-period') : currentPeriod();
  const st = linkedStudent();
  if (!st || st.dbId == null) {
    toast("O'quvchi ma'lumoti topilmadi", 'error');
    return;
  }

  if (btn) { btn.disabled = true; btn.textContent = 'Yuklanmoqda...'; }
  try {
    const uploadRes = await CloudSync.uploadReceiptImage(file);
    await CloudSync.submitPaymentReceipt(st.dbId, period, amount, uploadRes.url);
    closeModal();
    render();
    toast("⏳ Chekingiz qabul qilindi! Ustoz tasdiqlashi bilan qarzingiz o'chiriladi.");
  } catch (e) {
    if (btn) { btn.disabled = false; btn.textContent = '📤 Chekni yuborish'; }
    if (err) { err.textContent = "Yuklashda xatolik: " + ((e && e.message) || 'xatolik'); err.classList.add('show'); }
  }
}


document.addEventListener('click', function (e) {
  const btn = e.target && e.target.closest ? e.target.closest('[data-act]') : null;
  if (!btn) return;
  const act = btn.getAttribute('data-act');

  const actions = {
    /* --- Kirish --- */
    'do-login': doLogin,
    'logout': logout,
    'nav': function () { go(btn.getAttribute('data-screen')); },

    /* --- Dashboard stat kartalari (bosiladigan) --- */
    'stat-groups': function () {
      if (!isTeacher()) { toast("Ruxsat yo'q", 'error'); return; }
      go('groups');
    },
    'stat-students': function () {
      if (!isTeacher()) { toast("Ruxsat yo'q", 'error'); return; }
      state.filterGroup = null;
      state.filterClass = 'Barchasi';
      state.search = '';
      go('students');
    },
    'stat-classes': function () {
      if (!isTeacher()) { toast("Ruxsat yo'q", 'error'); return; }
      state.filterGroup = null;
      state.filterClass = 'Barchasi';
      state.search = '';
      state.classHint = true;
      go('students');
      clearTimeout(state.classHintTimer);
      state.classHintTimer = setTimeout(function () {
        state.classHint = false;
        render();
      }, 1800);
    },
    'filter-class': function () {
      state.filterClass = btn.getAttribute('data-class');
      render();
    },

    /* --- Guruh kartasini bosish → faqat shu guruh o'quvchilari --- */
    'filter-group': function () {
      if (!isTeacher()) { toast("Ruxsat yo'q", 'error'); return; }
      state.filterGroup = btn.getAttribute('data-gid');
      state.filterClass = 'Barchasi';
      state.search = '';
      go('students');
    },
    'filter-group-all': function () {
      state.filterGroup = null;
      state.filterClass = 'Barchasi';
      state.search = '';
      render();
    },

    /* --- Guruhlar / o'quvchilar --- */
    'open-add-group': openAddGroup,
    'edit-group': function () { openEditGroup(btn.getAttribute('data-gid')); },
    'save-edit-group': function () { saveEditGroup(btn.getAttribute('data-gid')); },
    'open-add-student': openAddStudent,
    'close-modal': closeModal,
    'save-group': saveGroup,
    'save-student': saveStudent,
    'reset-pwd': function () { openResetPwd(btn.getAttribute('data-sid')); },
    'edit-student': function () { openEditStudent(btn.getAttribute('data-sid')); },
    'save-edit-student': function () { saveEditStudent(btn.getAttribute('data-sid')); },
    'save-reset': function () { saveResetPwd(btn.getAttribute('data-sid')); },

    /* --- Zaxira (backup/restore) --- */
    'backup-dl': function () { downloadBackup(); },
    'backup-pick': function () {
      const el = $('#backup-file');
      if (el) el.click();
      else toast('Zaxira maydoni topilmadi', 'error');
    },
    'do-restore': function () { doRestoreBackup(); },

    /* --- Parol ko'zgusi --- */
    'toggle-pw': function () {
      const inp = document.getElementById(btn.getAttribute('data-target'));
      if (!inp) return;
      const show = inp.type === 'password';
      inp.type = show ? 'text' : 'password';
      btn.innerHTML = show ? ICON.eyeOff : ICON.eye;
      btn.setAttribute('aria-label', show ? "Parolni yashirish" : "Parolni ko'rsatish");
    },

    /* --- Portal: Speaking topshirish (CTA — Telegram ga yo'naltiradi) --- */
    'speak-cta': function () {
      const stu = linkedStudent();
      analyticsCall('capture', 'speaking_intent_opened',
        { has_debt: !!(stu && Number(stu.speakingDebt) > 0) });
      openModal(`
        <div class="modal-head">
          <h3>${ico('mic', 20)} Speaking topshirish</h3>
          <button type="button" class="icon-btn" data-act="close-modal" aria-label="Yopish">✕</button>
        </div>
        <div class="confirm-body">
          <div class="confirm-emoji tint-sky">${ICON.smartphone}</div>
          <p class="confirm-text">Ovozli topshirish uchun <b>Telegram botga</b> kiring va u yerga ${ico('mic', 14)} ovozli xabar (voice) yoki ${ico('video', 14)} krujok (video note) yuboring.</p>
          <p class="muted small" style="margin-top:9px">Muzaffar Amirov baholagach, natijani shu kabinetda ko'rasiz.</p>
        </div>
        <div class="confirm-actions">
          <button type="button" class="btn btn-primary" data-act="close-modal">Tushunarli</button>
        </div>
      `);
    },

    /* --- O'chirish (tasdiq bilan) --- */
    'del-student': function () { openDeleteStudent(btn.getAttribute('data-sid')); },
    'do-del-student': function () { doDeleteStudent(btn.getAttribute('data-sid')); },
    'del-group': function () { openDeleteGroup(btn.getAttribute('data-gid')); },
    'do-del-group': function () { doDeleteGroup(btn.getAttribute('data-gid')); },
    'open-change-pwd': openChangePwd,
    'save-change-pwd': saveChangePwd,

    /* --- Baholar jurnali --- */
    'grade-group': function () {
      state.gradeGroup = btn.getAttribute('data-group');
      state.gradeDate = '';
      render();
    },
    'grade-group-go': function () {
      state.gradeGroup = btn.getAttribute('data-group');
      state.gradeDate = '';
      go('grades');
    },
    'grade-date': function () {
      state.gradeDate = btn.getAttribute('data-date');
      render();
    },
    'grade-class': function () {
      state.gradeClass = btn.getAttribute('data-class');
      render();
    },
    'grade-week': function () {
      const dir = Number(btn.getAttribute('data-dir'));
      if (dir === 0) {
        state.weekOffset = 0;
      } else {
        state.weekOffset = (state.weekOffset || 0) + dir;
      }
      state.gradeDate = '';
      render();
    },
    'edit-grade': function () {
      openGradeEditor(btn.getAttribute('data-sid'), btn.getAttribute('data-date'));
    },
    'grade-set': function () {
      if (!state.editor) return;
      state.editor.score = Number(btn.getAttribute('data-score'));
      persistEditor(false);
      renderGradeEditor();
    },
    'grade-cat': function () {
      if (!state.editor) return;
      state.editor.category = btn.getAttribute('data-cat');
      if (state.editor.score != null) persistEditor(true);
      renderGradeEditor();
    },
    'grade-clear': function () {
      if (!state.editor) return;
      const all = getGrades();
      if (all[state.editor.sid]) {
        delete all[state.editor.sid][state.editor.date];
        store.set(K.grades, all);
        CloudSync.pushGrade(state.editor.sid, state.editor.date);
      }
      state.editor.score = null;
      renderGradeEditor();
      toast("Baho o'chirildi");
    },
    'close-grade': function () {
      closeModal();
      render();
    },

    /* --- Chat --- */
    'open-chat': function () { openChat(btn.getAttribute('data-sid')); },
    'send-chat': sendChat,

    /* --- Speaking qarzi --- */
    'debt-plus': function () { changeDebt(btn.getAttribute('data-sid'), +1); },
    'debt-minus': function () { changeDebt(btn.getAttribute('data-sid'), -1); },

    /* --- Telegram topshiriklarini baholash --- */
    'tg-grade': function () {
      gradeTgSub(btn.getAttribute('data-tid'), Number(btn.getAttribute('data-score')));
    },
    'tg-reject': function () {
      rejectTgSub(btn.getAttribute('data-tid'));
    },

    /* --- Ovozli topshirishga ruxsat (voice_allowed) --- */
    'voice-toggle': function () {
      if (!isTeacher()) { toast("Ruxsat yo'q", 'error'); return; }
      const list = getStudents();
      const st = list.filter(x => x.id === btn.getAttribute('data-sid'))[0];
      if (!st) return;
      st.voiceAllowed = !(st.voiceAllowed !== false);
      store.set(K.students, list);
      CloudSync.pushStudent(st.id);
      render();
      toast(st.voiceAllowed ? "Ovozli topshirishga ruxsat berildi" : "Ovozli topshirish cheklandi");
    },

    /* --- Uyga vazifalar --- */
    'open-hw': function () { openHwModal(null, btn.getAttribute('data-gid')); },
    'save-hw': function () { saveHomework(); },
    'hw-edit': function () { openHwModal(btn.getAttribute('data-hid')); },
    'hw-remove-media': function () { removeHwAttachment('existing', 0); },
    'hw-remove-att': function () {
      removeHwAttachment(btn.getAttribute('data-kind'), btn.getAttribute('data-idx'));
    },
    'hw-clear-file': clearHwFilePick,
    'pay-student': function () { openPayModal(btn.getAttribute('data-sid'), btn.getAttribute('data-period')); },
    'fee-schedule': function () { openFeeSchedule(btn.getAttribute('data-gid')); },
    'fee-add': function () { addMonthlyFee(btn.getAttribute('data-gid')); },
    'fee-del': function () { removeMonthlyFee(btn.getAttribute('data-gid'), btn.getAttribute('data-period')); },
    'debt-add': function () { openAddDebtModal(btn.getAttribute('data-sid')); },
    'save-add-debt': function () { saveAddedDebt(btn.getAttribute('data-sid')); },
    'remind-student': function () { remindStudent(btn.getAttribute('data-sid')); },
    'save-pay': function () { savePayment(btn.getAttribute('data-sid')); },
    'save-card-settings': function () {
      if (!isTeacher()) { toast("Ruxsat yo'q", 'error'); return; }
      const num = ($('#teacher-card-num') ? $('#teacher-card-num').value : '').trim();
      const holder = ($('#teacher-card-holder') ? $('#teacher-card-holder').value : '').trim();
      CloudSync.saveCardSettings(num, holder);
      toast("Karta sozlamalari saqlandi ✓");
    },
    'open-pay-receipt': function () {
      openPayReceiptModal(btn.getAttribute('data-amount'), btn.getAttribute('data-period'));
    },
    'copy-card': function () {
      const card = btn.getAttribute('data-card') || '';
      if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(card).then(function () {
          toast("Karta raqami nusxalandi! ✓");
        }).catch(function () {
          toast("Karta: " + card);
        });
      } else {
        toast("Karta: " + card);
      }
    },
    'do-submit-receipt': doSubmitPaymentReceipt,
    'att-toggle': function () { state.attOpen = !state.attOpen; render(); },
    'remind-debtors': openRemindDebtors,
    'do-remind-debtors': sendDebtorsReminder,
    'del-hw': function () { openDeleteHw(btn.getAttribute('data-hid')); },
    'do-del-hw': function () { doDeleteHw(btn.getAttribute('data-hid')); },
    'toggle-hw': function () { toggleHwDone(btn.getAttribute('data-hid')); },

    /* --- Tozalash (avval zaxira) --- */
    'cleanup-pick': function () {
      if (!isTeacher()) { toast("Ruxsat yo'q", 'error'); return; }
      state.cleanupTable = btn.getAttribute('data-table');
      render();
    },
    'cleanup-go': function () { startCleanup(); },
    'do-cleanup': function () { doCleanup(); },

    /* --- Davomat --- */
    'open-attendance': function () {
      state.attGroup = btn.getAttribute('data-group') || state.attGroup;
      state.attDate = todayKey();
      state.attDraftFor = '';
      go('attendance');
    },
    'att-group': function () {
      state.attGroup = btn.getAttribute('data-group');
      render();
    },
    'att-set': function () {
      if (!state.attDraft) state.attDraft = {};
      const sid = btn.getAttribute('data-sid');
      const status = btn.getAttribute('data-status');
      if (state.attDraft[sid] === status) delete state.attDraft[sid];
      else state.attDraft[sid] = status;
      render();
    },
    'att-save': function () {
      if (!isTeacher()) { toast("Ruxsat yo'q", 'error'); return; }
      const all = getAttendance();
      const beforeIds = Object.keys(all[state.attDate] || {});
      all[state.attDate] = Object.assign({}, state.attDraft || {});
      store.set(K.attendance, all);
      CloudSync.pushAttendance(state.attDate, beforeIds.concat(Object.keys(state.attDraft || {})));
      state.attDraftFor = state.attDate;
      const n = Object.keys(all[state.attDate]).length;
      toast(n ? "Davomat saqlandi ✓ (" + n + " ta)" : "Davomat saqlandi (bo'sh)");
    },

    /* --- Speaking --- */
    'open-slot': function () { openSlotModal('create', ''); },
    'slot-assign': function () { openSlotModal('assign', btn.getAttribute('data-id')); },
    'slot-score': function () { openScoreSlot(btn.getAttribute('data-id')); },
    'slot-del': function () {
      if (!isTeacher()) { toast("Ruxsat yo'q", 'error'); return; }
      const id = btn.getAttribute('data-id');
      const cur = getSpeaking().filter(x => x.id === id)[0];
      store.set(K.speaking, getSpeaking().filter(x => x.id !== id));
      if (cur && cur.dbId != null) CloudSync.deleteSlot(cur.dbId);
      render();
      toast("Slot o'chirildi");
    },
    'toggle-theme': toggleTheme,
    'toggle-lang': toggleLang,
    'session-logout': function () { Sessions.remove(btn.getAttribute('data-sess')); },
    'session-logout-all': function () { Sessions.removeAllOthers(); },
    'save-slot': saveSlot,
    'save-score': function () {
      saveSlotScore(btn.getAttribute('data-id'), Number(btn.getAttribute('data-score')));
    }
  };

  if (actions[act]) {
    e.preventDefault();
    actions[act]();
  }
});

document.addEventListener('input', function (e) {
  const t = e.target;
  if (!t) return;
  if (t.id === 's-search') {
    state.search = t.value;
    refreshStudentList();
  } else if (t.id === 'grade-note') {
    if (state.editor) {
      state.editor.note = t.value;
      if (state.editor.score != null) persistEditor(true);
    }
  }
});

document.addEventListener('change', function (e) {
  const t = e.target;
  if (!t) return;
  if (t.id === 'att-date' && t.value) { state.attDate = t.value; render(); }
  if (t.id === 'pay-month' && t.value) { state.payMonth = t.value; render(); }
  if (t.id === 'sp-date' && t.value) { state.speakDate = t.value; render(); }
  /* Guruh modali: yangi kun belgilandi → o'sha kun uchun vaqt picker chiqadi */
  if (t.closest && t.closest('#f-days')) { renderDayTimes(); }
  /* Guruh turi o'zgardi → maktab guruhida oylik to'lov maydoni yashiriladi */
  if (t.name === 'f-gtype') { syncGroupFeeField(); }
  if (t.id === 'backup-file' && t.files && t.files[0]) {
    readBackupFile(t.files[0]);
    t.value = '';
  }
});

document.addEventListener('keydown', function (e) {
  if (e.key === 'Enter' && (e.target.id === 'login-input' || e.target.id === 'password-input')) {
    const btn = $('[data-act="do-login"]');
    if (btn) btn.click();
  }
  if (e.key === 'Enter' && e.target.id === 'chat-input') {
    e.preventDefault();
    sendChat();
  }
});

$('#modal-overlay').addEventListener('click', function (e) {
  if (e.target && e.target.id === 'modal-overlay') { closeModal(); render(); }
});

/* ==================== Ishga tushirish ==================== */
(function init() {
  /* Eski (Step 1–2) kalitlarni tozalash */
  store.del('et_users');
  const s = getSession();
  if (!s || !accounts[s.login]) store.del(K.session);
  state.screen = currentUser() ? 'home' : 'login';
  applyTheme();
  render();
  /* Faol qurilmalar nazorati: sahifa ochilganda + har 30 soniyada tekshiriladi */
  Sessions.check();
  if (!window.__etSessionGuard) {
    window.__etSessionGuard = setInterval(function () {
      if (currentUser()) Sessions.check();
    }, 30000);
  }
  /* Harakat -> oxirgi faoliyat (kamida 60 soniyada bir marta yangilanadi) */
  let lastPresenceTouch = 0;
  const activityPresence = function () {
    if (!currentUser()) return;
    const now = Date.now();
    if (now - lastPresenceTouch < 60000) return;
    lastPresenceTouch = now;
    Sessions.touch();
  };
  document.addEventListener('click', activityPresence, true);
  document.addEventListener('keydown', activityPresence, true);
  /* Avval bulutdan ma'lumotni tiklaymiz (multi-device sync), keyin qayta chizamiz */
  if (CloudSync.ready()) {
    const cu0 = currentUser();
    CloudSync.pullAll(cu0 && cu0.role === 'student' ? cu0.login : null).then(function (ok) {
      if (ok && currentUser()) render();
      CloudSync.subscribe();
      refreshChat();
    });
  }
})();


/* Week navigation is now rendered directly in gradesScreen() template. */

/* ==================== PLYR: video/audio pleyer (fullscreen, tezlik, ±10s) ==================== */
function initPlyr() {
  if (!window.Plyr) return;
  $$('.hw-media video, .hw-media audio').forEach(function (el) {
    if (el.getAttribute('data-plyr-ready')) return;
    if (el.closest && el.closest('.plyr')) return;
    el.setAttribute('data-plyr-ready', '1');
    const isAudio = el.tagName === 'AUDIO';
    try {
      new window.Plyr(el, {
        controls: isAudio
          ? ['restart', 'rewind', 'play', 'fast-forward', 'progress', 'current-time', 'duration', 'mute', 'volume', 'settings']
          : ['play-large', 'restart', 'rewind', 'play', 'fast-forward', 'progress', 'current-time', 'duration', 'mute', 'volume', 'settings', 'pip', 'fullscreen'],
        settings: ['speed'],
        speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 2] },
        seekTime: 10,
        keyboard: { focused: true, global: false },
        tooltips: { controls: true, seek: true }
      });
    } catch (e) { console.warn('[plyr]', (e && e.message) || e); }
  });
}
function watchHwMedia() {
  initPlyr();
  if (!window.MutationObserver || !document.body) return;
  let timer = null;
  new window.MutationObserver(function () {
    if (timer) clearTimeout(timer);
    timer = setTimeout(initPlyr, 80);
  }).observe(document.body, { childList: true, subtree: true });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watchHwMedia);
else watchHwMedia();

/* Rasmni to'liq ekranda ko'rish */
document.addEventListener('click', function (ev) {
  const img = ev.target && ev.target.closest ? ev.target.closest('.hw-media-img') : null;
  if (!img) return;
  const url = img.getAttribute('src');
  if (!url) return;
  const box = document.createElement('div');
  box.className = 'hw-media-zoom';
  const big = document.createElement('img');
  big.src = url;
  big.alt = img.getAttribute('alt') || '';
  box.appendChild(big);
  box.addEventListener('click', function () { box.remove(); });
  document.body.appendChild(box);
});
