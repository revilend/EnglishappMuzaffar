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
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  },
  del(key) {
    try { localStorage.removeItem(key); } catch (e) {}
  }
};

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
  tgsubs: 'et_tg_subs'
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
  attGroup: '',
  attDate: '',
  attDraft: null,
  attDraftFor: '',
  speakDate: '',
  slotMode: 'create',
  slotId: '',
  chatSid: null
};

const AUTH_SCREENS = ['login'];
/* Faqat ustoz ruxsat beradigan ekranlar */
const TEACHER_SCREENS = ['groups', 'students', 'grades', 'attendance', 'speaking'];


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
  const names = String(g.days).split(',').map(x => x.trim());
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
        if (sid != null && m.sid !== sid) return false;
        if (sid == null) return false;
        return !(m.id && String(m.id).charAt(0) === 'm');
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
    const res = await client.from('homework').select('*').order('created_at', { ascending: false });
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
        createdAt: r.created_at || ''
      };
    });
    store.set(K.homework, list);
  }

  async function pushHomework(hw) {
    if (!ready() || !hasHomework) return;
    try {
      const g = groupById(hw.groupId);
      const payload = {
        group_id: g && g.dbId != null ? g.dbId : null,
        title: hw.title,
        description: hw.description || '',
        due_date: hw.dueDate || null
      };
      if (payload.group_id == null) return;
      if (hw.dbId == null) {
        const res = await client.from('homework').insert(payload).select();
        if (res.error) throw res.error;
        hw.dbId = res.data[0].id;
      } else {
        const res = await client.from('homework').update(payload).eq('id', hw.dbId);
        if (res.error) throw res.error;
      }
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
    const res = await client.from('speaking_submissions').select('*').order('created_at', { ascending: true });
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

  /* --- Barcha jadvallarni tortib, lokal modelni qayta qurish --- */
  async function pullAll() {
    if (!ready()) return false;
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
        return { id: 'g' + r.id, dbId: r.id, name: r.name, days: r.days, time: r.time };
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
          voiceAllowed: r.voice_allowed !== false,
          audioSubmissions: (audioByOld[oldIdByDb[r.id]] || []).slice()
        };
      });

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

      store.set(K.groups, groups);
      store.set(K.students, students);
      store.set(K.grades, grades);
      store.set(K.attendance, attendance);

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
      try { await pullHomework(); } catch (e) { /* homework jadvali yo'q — SQL hali ishga tushmagan */ }
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

  /* --- Yozish: guruh / o'quvchi / qarz / baho / davomat / audio / xabar --- */
  async function pushGroup(g) {
    if (!ready()) return;
    try {
      if (g.dbId == null) {
        const res = await client.from('groups').insert({ name: g.name, days: g.days, time: g.time }).select();
        if (res.error) throw res.error;
        g.dbId = res.data[0].id;
      } else {
        const res = await client.from('groups').update({ name: g.name, days: g.days, time: g.time }).eq('id', g.dbId);
        if (res.error) throw res.error;
      }
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
    const dbId = dbOfSid(sid);
    const st = studentById(sid);
    if (dbId == null || !st) return;
    const res = await client.from('students').update({ speaking_debt: Number(st.speakingDebt) || 0 }).eq('id', dbId);
    if (res.error) throw res.error;
  }

  async function doPushGrade(sid, date) {
    const dbId = dbOfSid(sid);
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
    Array.from(new Set(sids || [])).forEach(function (sid) {
      const st = studentById(sid);
      if (!st || st.dbId == null) return;
      ids.push(st.dbId);
      const status = (getAttendance()[date] || {})[sid];
      if (status) rows.push({ student_id: st.dbId, date: date, status: status });
    });
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
    const dbId = dbOfSid(sid);
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

  /* --- Zaxira: jadvallarni olish / qayta tiklash --- */
  const BACKUP_TABLES = ['groups', 'students', 'attendance', 'grades', 'messages', 'speaking_submissions', 'audio_submissions'];

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

  /* ID satri (g1/s3 kabi lokal idlarni ham raqamga aylantiramiz) */
  function toNumId(v) {
    const n = Number(String(v == null ? '' : v).replace(/^[gs]/, ''));
    return isFinite(n) ? n : null;
  }

  async function restoreBackup(data) {
    if (!ready() || !data) return false;
    try {
      /* 1) avval bog'liq qatorlar, keyin asosiy jadvallar (FK uchun) */
      const delOrder = ['messages', 'grades', 'attendance', 'speaking_submissions', 'audio_submissions', 'students', 'groups'];
      for (let i = 0; i < delOrder.length; i++) {
        const res = await client.from(delOrder[i]).delete().gte('id', 0);
        if (res.error && !missing(res.error)) throw res.error;
      }
      /* 2) zaxiradan qayta yozish (ID saqlanadi) */
      const plan = [
        ['groups', ['id', 'name', 'days', 'time']],
        ['students', ['id', 'name', 'school_class', 'group_id', 'login', 'password', 'speaking_debt']],
        ['attendance', ['id', 'student_id', 'date', 'status']],
        ['grades', ['id', 'student_id', 'date', 'grade', 'category', 'note']],
        ['messages', ['id', 'student_id', 'sender', 'text', 'created_at']],
        ['speaking_submissions', ['id', 'media_type', 'telegram_file_id', 'status', 'created_at']],
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
            const n = toNumId(row.student_id);
            if (n == null || !studentIds[n]) return; /* yo'q o'quvchiga bog'langan qator — tashlanadi */
            row.student_id = n;
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

  return {
    ready: ready,
    pullAll: pullAll,
    fetchMessages: fetchMessages,
    pushGroup: pushGroup,
    pushStudent: pushStudent,
    pushDebt: pushDebt,
    pushGrade: pushGrade,
    pushAttendance: pushAttendance,
    pullHomework: pullHomework,
    pushHomework: pushHomework,
    pullSpeaking: pullSpeaking,
    pushSpeakingGrade: pushSpeakingGrade,
    pushTeacherPassword: pushTeacherPassword,
    sendMessage: sendMessage,
    subscribe: subscribe,
    deleteStudent: deleteStudent,
    deleteGroup: deleteGroup,
    fetchBackup: fetchBackup,
    restoreBackup: restoreBackup,
    clearTable: clearTable,
    messagesAvailable: function () { return ready() && hasMessages; },
    url: url
  };
})();

window.__cloud = CloudSync;

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
}
function go(screen) {
  state.screen = screen;
  render();
  /* Ekranni bulutdan yangilaymiz (bir martalik pull — 5 soniyalik loop'siz) */
  if (!CloudSync.ready()) return;
  if (screen === 'home') {
    const hw0 = JSON.stringify(getHomework());
    const tg0 = JSON.stringify(getTgSubs());
    Promise.all([CloudSync.pullHomework(), CloudSync.pullSpeaking()]).then(function () {
      if (JSON.stringify(getHomework()) !== hw0 || JSON.stringify(getTgSubs()) !== tg0) render();
    }).catch(function () {});
  } else if (screen === 'speaking' && isTeacher()) {
    const tg0 = JSON.stringify(getTgSubs());
    CloudSync.pullSpeaking().then(function () {
      if (JSON.stringify(getTgSubs()) !== tg0) render();
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

    const done = rec.status === 'baholandi' || rec.status === 'graded';
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
  alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m21.2 18-8-14a1.9 1.9 0 0 0-3.3 0l-8 14A1.9 1.9 0 0 0 3.6 21h16.8a1.9 1.9 0 0 0 1.7-3Z"/><path d="M12 9.5v4"/><path d="M12 17.2h.01"/></svg>',
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
function scrLabel(s) {
  return {
    home: 'Bosh sahifa',
    groups: 'Guruhlar',
    students: "O'quvchilar",
    grades: 'Baholar jurnali',
    attendance: 'Tezkor davomat',
    speaking: 'Speaking (1-on-1)',
    profile: 'Profil'
  }[s] || '';
}
function renderHeader() {
  const scr = state.screen;
  if (AUTH_SCREENS.indexOf(scr) >= 0) {
    return '<div class="header-inner"><span class="brand">English Tutor</span></div>';
  }
  const u = currentUser() || {};
  return `<div class="header-inner">
    <div class="brand-wrap">
      <span class="brand">English Tutor</span>
      <span class="brand-sub">${esc(scrLabel(scr))}</span>
    </div>
    <span class="role-badge ${u.role === 'teacher' ? 'is-teacher' : 'is-student'}">${u.role === 'teacher' ? 'Muzaffar Amirov' : "O'quvchi"}</span>
  </div>`;
}
function navItems() {
  if (isTeacher()) {
    return [
      ['home', 'Bosh', ICON.home],
      ['students', "O'quvchi", ICON.students],
      ['grades', 'Baholar', ICON.grades],
      ['attendance', 'Davomat', ICON.cal],
      ['speaking', 'Speaking', ICON.mic],
      ['profile', 'Profil', ICON.profile]
    ];
  }
  /* O'quvchi: faqat o'z portali va profili */
  return [
    ['home', 'Kabinet', ICON.home],
    ['profile', 'Profil', ICON.profile]
  ];
}
function renderNav() {
  if (AUTH_SCREENS.indexOf(state.screen) >= 0) return '';
  return navItems().map(it => {
    const active = state.screen === it[0] ? ' active' : '';
    return `<button type="button" class="nav-item${active}" data-act="nav" data-screen="${it[0]}">${it[2]}<span>${it[1]}</span></button>`;
  }).join('');
}

/* ==================== KIRISH EKRANI (login / parol) ==================== */
function loginScreen() {
  return `<div class="auth">
    <div class="auth-logo">${ICON.gradCap}</div>
    <h1 class="auth-title">English Tutor</h1>
    <p class="auth-sub">Ingliz tili darslari — Muzaffar Amirov paneli va o'quvchi kabineti</p>

    <div class="card auth-card">
      <label class="field-label" for="login-input">Login</label>
      <input class="input" id="login-input" type="text" autocapitalize="none" autocorrect="off"
             autocomplete="username" placeholder="Login" />

      <label class="field-label" for="password-input">Parol</label>
      <div class="pw-wrap">
        <input class="input" id="password-input" type="password"
               autocomplete="current-password" placeholder="••••" />
        <button type="button" class="pw-toggle" data-act="toggle-pw" data-target="password-input" aria-label="Parolni ko'rsatish">${ico('eye', 18)}</button>
      </div>

      <div class="field-error" id="login-error"></div>
      <button type="button" class="btn btn-primary btn-block" data-act="do-login">Kirish</button>
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
function hwRowHTML(h) {
  const g = groupById(h.groupId);
  return `<div class="hw-item">
    <div class="row between"><strong>${esc(h.title)}</strong><span class="chip-class">${g ? esc(g.name) : '—'}</span></div>
    ${h.description ? `<div class="muted small" style="margin-top:3px">${esc(h.description)}</div>` : ''}
    <div class="muted small" style="margin-top:3px">${ico('calendar', 13)} Topshirish muddati: ${h.dueDate ? fmtDMY(h.dueDate) : '—'}</div>
  </div>`;
}

function homeworkListHTML(list) {
  return list.length ? list.map(hwRowHTML).join('') : emptyState("Hozircha uyga vazifa yo'q", 'clipboardCheck');
}

function openHwModal() {
  if (!isTeacher()) { toast("Ruxsat yo'q", 'error'); return; }
  const groups = getGroups();
  if (!groups.length) { toast("Avval guruh yarating", 'error'); return; }
  openModal(`
    <div class="modal-head">
      <h3>Uyga vazifa qo'shish</h3>
      <button type="button" class="icon-btn" data-act="close-modal" aria-label="Yopish">✕</button>
    </div>
    <label class="field-label" for="hw-group">Guruh</label>
    <select class="input" id="hw-group">
      ${groups.map(g => `<option value="${g.id}">${esc(g.name)}</option>`).join('')}
    </select>
    <label class="field-label" for="hw-title">Mavzu</label>
    <input class="input" id="hw-title" type="text" placeholder="Masalan: Present Perfect" />
    <label class="field-label" for="hw-desc">Vazifa (tavsif)</label>
    <textarea class="input" id="hw-desc" rows="3" placeholder="Nima bajarishi kerak..."></textarea>
    <label class="field-label" for="hw-due">Topshirish muddati</label>
    <input class="input" id="hw-due" type="date" value="${todayKey()}" />
    <div class="field-error" id="hw-error"></div>
    <div class="modal-actions">
      <button type="button" class="btn btn-ghost" data-act="close-modal">Bekor qilish</button>
      <button type="button" class="btn btn-primary" data-act="save-hw">Saqlash</button>
    </div>
  `);
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
  const hw = {
    id: 'h' + Date.now(),
    dbId: null,
    groupId: gid || null,
    title: title,
    description: desc,
    dueDate: due,
    createdAt: new Date().toISOString()
  };
  const list = getHomework();
  list.unshift(hw);
  store.set(K.homework, list);
  CloudSync.pushHomework(hw);
  closeModal();
  render();
  toast('Uyga vazifa qo\'shildi');
}

function teacherHome() {
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
    <div class="card stat"><span class="stat-ico">${ICON.groups}</span><span class="stat-num">${groups.length}</span><span class="stat-label">Guruhlar</span></div>
    <div class="card stat"><span class="stat-ico">${ICON.students}</span><span class="stat-num">${students.length}</span><span class="stat-label">O'quvchilar</span></div>
    <div class="card stat"><span class="stat-ico">${ICON.cal}</span><span class="stat-num">${Object.keys(classSet).length}</span><span class="stat-label">Sinflar</span></div>
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
      <h2 class="screen-title">${ico('bookOpen', 20)} Uyga vazifalar</h2>
      <div class="muted small">${getHomework().length} ta vazifa • bot guruhga xabar qiladi</div>
    </div>
    <button type="button" class="btn btn-primary btn-sm" data-act="open-hw">+ Uyga vazifa</button>
  </div>
  <div class="card">${homeworkListHTML(getHomework())}</div>

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
  const gradeRec = getGrades()[st.id] || {};
  const attRec = getAttendance();

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

  /* --- Davomat --- */
  const ownAtt = [];
  Object.keys(attRec).sort().reverse().forEach(dk => {
    const v = attRec[dk][st.id];
    if (v) ownAtt.push({ date: dk, status: v });
  });
  const cnt = { present: 0, absent: 0, excused: 0 };
  ownAtt.forEach(a => { cnt[a.status] = (cnt[a.status] || 0) + 1; });
  const statusLabel = { present: 'Keldi', absent: 'Kelmadi', excused: 'Sababli' };
  const attRows = ownAtt.length ? ownAtt.map(a => `
    <div class="att-line">
      <span class="gr-date">${fmtDM(a.date)}</span>
      <span class="att-tag on-${a.status}">${statusLabel[a.status]}</span>
    </div>`).join('') : `<div class="empty"><span class="empty-ico">${ICON.cal}</span>Davomat yozuvi yo'q</div>`;

  /* --- Speaking vaqti --- */
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

  /* --- Mening topshiriklarim (Telegram orqali) --- */
  const myTg = getTgSubs().filter(x => x.sid === st.id).slice().reverse();
  const mySubs = myTg.map(t => `
    <div class="audio-item">
      <div class="audio-item__meta">
        ${t.mediaType === 'voice' ? ico('mic', 14) + ' Ovozli xabar' : ico('video', 14) + ' Video'} ·
        ${t.status === 'baholandi' || t.status === 'graded'
          ? `${ico('checkCircle', 14)} Baho: ${t.score}/10`
          : `${ico('clock', 14)} Muzaffar Amirov ko'rib chiqmoqda`}
      </div>
    </div>`).join('') || `<div class="empty"><span class="empty-ico">${ICON.mic}</span>Hozircha topshirilmagan</div>`;

  /* --- Uyga vazifalar (faqat o'z guruhi) --- */
  const myHw = getHomework().filter(h => h.groupId && h.groupId === st.groupId);

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

  <div class="section-title">${ico('bookOpen', 13)} Uyga vazifalar</div>
  <div class="card">${homeworkListHTML(myHw)}</div>

  <div class="section-title">Mening baholarim</div>
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

  <div class="section-title">Mening davomatim</div>
  <div class="card">
    <div class="att-summary">
      <span class="att-pill">✓ Keldi: ${cnt.present}</span>
      <span class="att-pill">✕ Kelmadi: ${cnt.absent}</span>
      <span class="att-pill">? Sababli: ${cnt.excused}</span>
    </div>
    ${attRows}
  </div>

  <div class="section-title">Speaking vaqtim</div>
  <div class="card">
    ${Number(st.speakingDebt) > 0
      ? `<div class="debt-badge" style="margin-bottom:8px">${ico('alert', 15)} Speaking qarzingiz: ${Number(st.speakingDebt)} ta</div>`
      : `<div class="att-pill" style="margin-bottom:8px">${ico('checkCircle', 15)} Speaking qarzingiz yo'q</div>`}
    <button type="button" class="btn btn-primary btn-block speak-cta" data-act="speak-cta">${ico('mic', 20)} Speaking topshirish</button>
    ${slotRows}
  </div>

  <div class="section-title">Speaking topshirish (Telegram orqali)</div>
  <div class="card">
    <div class="muted small">${ico('mic', 14)} Muzaffar Amirovga <b>Telegram botga</b> ovozli xabar (voice) yoki dumaloq video (krujok) yuboring — brauzerda yozish shart emas.</div>
    <div class="hw-item small" style="margin-top:8px">1) Telegramda botga kiring → 2) ${ico('mic', 13)} ovozli xabar yuboring → 3) Muzaffar Amirov baholaydi</div>
    <div id="my-submissions" class="audio-list">${mySubs}</div>
  </div>

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
    <div class="list-row"><span>Parol</span><span class="muted">••••</span></div>
  </div>
  <button type="button" class="btn btn-ghost btn-block" data-act="open-change-pwd">${ico('key', 16)} Parolni o'zgartirish</button>
  `;
}

function homeScreen() { return isTeacher() ? teacherHome() : studentPortal(); }

/* ==================== GURUHLAR (faqat ustoz) ==================== */
function groupCard(g, students) {
  const cnt = students.filter(s => s.groupId === g.id).length;
  return `<div class="card group-card" data-act="filter-group" data-gid="${g.id}" style="cursor:pointer" role="button" title="O'quvchilarni ko'rsatish">
    <div class="row between">
      <h3 class="card-h">${esc(g.name)}</h3>
      <span class="pill">${cnt} o'quvchi</span>
    </div>
    <div class="meta-rows">
      <div class="meta-row">${ico('calendar', 15)} <span>${esc(g.days)}</span></div>
      <div class="meta-row">${ico('clock', 15)} <span>${esc(g.time)}</span></div>
    </div>
    <div class="muted small" style="margin-top:7px">Bosib, guruh o'quvchilarini ko'rish</div>
    <div class="row g8" style="margin-top:11px">
      <button type="button" class="btn btn-ghost btn-sm" data-act="grade-group-go" data-group="${g.id}">${ico('grades', 15)} Baholar</button>
      <button type="button" class="btn btn-ghost btn-sm" data-act="open-attendance" data-group="${g.id}">${ico('cal', 15)} Davomat</button>
      <button type="button" class="btn btn-danger btn-sm" data-act="del-group" data-gid="${g.id}">${ico('trash', 15)} O'chirish</button>
    </div>
  </div>`;
}

function groupsScreen() {
  if (!isTeacher()) return blockedScreen("Bu bo'lim faqat Muzaffar Amirov uchun");
  const groups = getGroups();
  const students = getStudents();
  return `
  <div class="screen-head">
    <div>
      <h2 class="screen-title">Guruhlar</h2>
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
  const acc = Object.keys(accounts).map(k => accounts[k]).filter(a => a.studentId === s.id)[0];
  return `<div class="card student-card">
    <div class="row top">
      <div class="avatar">${esc(initials(s.fullName))}</div>
      <div class="s-main">
        <div class="row between">
          <span class="s-name">${esc(s.fullName)}</span>
          <span class="chip-class">${esc(s.schoolClass)}</span>
        </div>
        <div class="s-group">${g ? esc(g.name) : "Guruh taylanmagan"}</div>
        <div class="s-contacts">
          <span class="s-contact"><span class="lbl">Login</span><span class="login-val">${acc ? esc(acc.login) : '—'}</span></span>
        </div>
        <div class="s-debt row between" style="margin-top:10px">
          <span class="lbl-strong">Speaking qarzi</span>
          <div class="debt-controls">
            <button type="button" class="btn btn-xs ghost" data-act="debt-minus" data-sid="${s.id}" aria-label="Kamaytirish">−</button>
            <span class="debt-num">${Number(s.speakingDebt) || 0} ta</span>
            <button type="button" class="btn btn-xs ghost" data-act="debt-plus" data-sid="${s.id}" aria-label="Ko'paytirish">+</button>
          </div>
        </div>
        <div class="row between" style="margin-top:9px">
          <span class="lbl-strong">${ico('mic', 15)} Ovozli topshirishga ruxsat</span>
          <button type="button" class="switch${s.voiceAllowed !== false ? ' on' : ''}" data-act="voice-toggle" data-sid="${s.id}"
                  role="switch" aria-checked="${s.voiceAllowed !== false}" aria-label="Ovozli topshirishga ruxsat"></button>
        </div>
        <div class="row g8" style="margin-top:10px">
          <button type="button" class="btn btn-xs ghost" data-act="open-chat" data-sid="${s.id}">${ico('message', 14)} Xabar yozish</button>
          <button type="button" class="btn btn-xs ghost" data-act="reset-pwd" data-sid="${s.id}">${ico('key', 14)} Parolni yangilash</button>
          <button type="button" class="btn btn-xs danger" data-act="del-student" data-sid="${s.id}">${ico('trash', 14)} O'chirish</button>
        </div>
      </div>
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
  if (cnt) cnt.textContent = filteredStudents().length + " ta o'quvchi";
}

function studentsScreen() {
  if (!isTeacher()) return blockedScreen("Bu bo'lim faqat Muzaffar Amirov uchun");
  const chips = ['Barchasi'].concat(APP_DATA.classes);
  const gf = state.filterGroup ? groupById(state.filterGroup) : null;
  return `
  <div class="screen-head">
    <div>
      <h2 class="screen-title">O'quvchilar</h2>
      <div class="muted small" id="students-count"></div>
    </div>
    <button type="button" class="btn btn-primary btn-sm" data-act="open-add-student">+ Qo'shish</button>
  </div>

  ${gf ? `<div class="card row between" style="margin-bottom:9px">
    <span class="muted small">${ico('groups', 14)} <b>${esc(gf.name)}</b> guruhidagi o'quvchilar</span>
    <button type="button" class="chip-btn" data-act="filter-group-all">Barcha o'quvchilar</button>
  </div>` : ''}

  <div class="search-wrap">
    <input class="input" id="s-search" type="search" placeholder="O'quvchi ismini kiriting..." value="${esc(state.search)}" />
  </div>

  <div class="chips">
    ${chips.map(c => `<button type="button" class="chip-btn ${state.filterClass === c ? 'active' : ''}" data-act="filter-class" data-class="${esc(c)}">${esc(c)}</button>`).join('')}
  </div>

  <div id="students-list">${studentListHTML()}</div>
  <button type="button" class="btn btn-ghost btn-block" data-act="nav" data-screen="groups">${ico('groups', 16)} Guruhlar</button>
  `;
}

/* ==================== PROFIL ==================== */
function profileScreen() {
  const u = currentUser() || {};
  const st = !isTeacher() ? linkedStudent() : null;
  return `
  <div class="card profile-head">
    <div class="avatar avatar-xl">${esc(initials(st ? st.fullName : (u.name || 'U')))}</div>
    <div class="profile-name">${esc(st ? st.fullName : (u.name || ''))}</div>
    <div class="muted">${esc(u.login || '')}</div>
    <div style="margin-top:9px">
      <span class="role-badge ${isTeacher() ? 'is-teacher' : 'is-student'}">${isTeacher() ? 'Muzaffar Amirov' : "O'quvchi"}</span>
      ${st ? `<span class="pill" style="margin-left:6px">${esc(st.schoolClass)}</span>` : ''}
    </div>
  </div>

  <div class="section-title">Xavfsizlik</div>
  <div class="card list-card">
    <div class="list-row"><span>Login</span><span class="login-val">${esc(u.login || '')}</span></div>
    <div class="list-row"><span>Parol</span><span class="muted">••••</span></div>
    <div class="list-row"><span>Ko'rinish</span><span class="muted">${isTeacher() ? 'Muzaffar Amirov' : "O'quvchi"}</span></div>
  </div>
  <button type="button" class="btn btn-ghost btn-block" data-act="open-change-pwd">${ico('key', 16)} Parolni o'zgartirish</button>

  ${isTeacher() ? `
  <div class="section-title">Ma'lumotlar Bazasi Zaxirasi</div>
  <div class="card backup-card">
    <div class="muted small">Guruhlar, o'quvchilar, davomat, baholar, xabarlar va speaking topshiriqlari JSON faylda saqlanadi.</div>
    <button type="button" class="btn btn-primary btn-block" data-act="backup-dl">${ico('download', 16)} Bazani yuklab olish (Backup)</button>
    <button type="button" class="btn btn-ghost btn-block" data-act="backup-pick">${ico('upload', 16)} Bazani qayta tiklash (Restore)</button>
    <input type="file" id="backup-file" accept="application/json,.json" hidden />

    <div class="section-title" style="margin-top:14px">Tozalash</div>
    <div class="muted small">Tozalashdan oldin barcha jadvallar fayl ko'rinishida avtomatik yuklab olinadi.</div>
    <div class="chips">
      ${CLEANUP_TABLES.map(t => `<button type="button" class="chip-btn${(state.cleanupTable || 'grades') === t[0] ? ' active' : ''}" data-act="cleanup-pick" data-table="${t[0]}">${t[1]}</button>`).join('')}
    </div>
    <button type="button" class="btn btn-danger btn-block" data-act="cleanup-go">${ico('brush', 16)} Tanlangan jadvalni tozalash</button>
  </div>` : ''}

  <button type="button" class="btn btn-danger btn-block" data-act="logout">Hisobdan chiqish</button>
  `;
}

/* ==================== MODALLAR ==================== */
function openModal(html) {
  $('#modal-sheet').innerHTML = html;
  $('#modal-overlay').hidden = false;
}
function closeModal() {
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

    <label class="field-label" for="f-gtime">Dars vaqti</label>
    <input class="input" id="f-gtime" type="time" value="18:00" />

    <button type="button" class="btn btn-primary btn-block" data-act="save-group">Saqlash</button>
  `);
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

    <button type="button" class="btn btn-primary btn-block" data-act="save-student">Saqlash</button>
  `);
}

function saveGroup() {
  const name = ($('#f-gname').value || '').trim();
  const days = $$('input:checked', $('#f-days')).map(i => i.value);
  const time = $('#f-gtime').value;

  if (!name) { toast("Guruh nomini kiriting", 'error'); $('#f-gname').focus(); return; }
  if (!days.length) { toast("Dars kunlarini tanlang", 'error'); return; }
  if (!time) { toast("Dars vaqtini kiriting", 'error'); return; }

  const groups = getGroups();
  groups.push({ id: 'g' + Date.now(), name, days: days.join(', '), time });
  store.set(K.groups, groups);
  CloudSync.pushGroup(groups[groups.length - 1]);
  closeModal();
  render();
  toast("Guruh qo'shildi ✓");
}

function saveStudent() {
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
  students.push({ id, fullName: name, schoolClass: cls, groupId: gid, speakingDebt: 0, audioSubmissions: [] });
  store.set(K.students, students);

  accounts[login] = { login, password: pass, role: 'student', studentId: id, name };
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
    acc.password = pass;
  } else {
    const loginEl = $('#rp-login');
    const login = loginEl ? loginEl.value.trim().toLowerCase() : suggestLogin(st.fullName);
    if (!/^[a-z0-9_.]{3,20}$/.test(login)) { toast("Login noto'g'ri", 'error'); return; }
    if (accounts[login]) { toast("Bu login band", 'error'); return; }
    accounts[login] = { login, password: pass, role: 'student', studentId: sid, name: st.fullName };
  }
  persistAccounts();
  CloudSync.pushStudent(sid);
  closeModal();
  render();
  toast("Parol yangilandi ✓");
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
  if (oldP !== u.password) { toast("Joriy parol noto'g'ri", 'error'); return; }
  if (n1.length < 3) { toast("Yangi parol kamida 3 ta belgi bo'lsin", 'error'); return; }
  if (n1 !== n2) { toast("Parollar mos kelmadi", 'error'); return; }
  u.password = n1;
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
    return { id: 'g' + n, dbId: n, name: g.name || '', days: g.days || '', time: g.time || '' };
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

  /* speaking slotlari: mavjud bo'lmagan o'quvchini uzamiz */
  const ids = {};
  students.forEach(st => { ids[st.id] = 1; });
  store.set(K.speaking, getSpeaking().map(x =>
    x.studentId && !ids[x.studentId] ? Object.assign({}, x, { studentId: null, score: null }) : x));

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
    return `<div class="screen-head"><h2 class="screen-title">Baholar</h2></div>` + emptyState("Avval guruh yarating", 'grades');
  }

  const dates = journalDates(state.gradeGroup, 6);
  const all = getStudents().filter(s => s.groupId === state.gradeGroup);
  const rows = all.filter(s => state.gradeClass === 'Barchasi' || s.schoolClass === state.gradeClass);
  const classChips = ['Barchasi'].concat(APP_DATA.classes);

  const head = `<tr>
    <th class="bj-name">O'quvchi</th>
    ${dates.map(d => `<th class="bj-date ${state.gradeDate === d ? 'is-focus' : ''}"><button type="button" class="bj-date-btn" data-act="grade-date" data-date="${d}">${fmtDM(d)}</button></th>`).join('')}
    <th class="bj-sum">O'rtacha</th>
  </tr>`;

  const body = rows.map(s => {
    const nums = scoresFor(s.id, dates);
    const avg = avgOf(nums);
    return `<tr>
      <td class="bj-name">
        <div class="bj-name-cell">
          <span class="s-name">${esc(s.fullName)}</span>
          <span class="chip-class">${esc(s.schoolClass)}</span>
        </div>
      </td>
      ${dates.map(d => gradeCellHTML(s.id, d)).join('')}
      <td class="bj-sum">
        <span class="sum-avg ${avg == null ? 'g-empty' : gradeClassOf(avg)}">${fmtAvg(avg)}</span>
        <span class="sum-total">Jami: ${totalOf(nums)}</span>
      </td>
    </tr>`;
  }).join('');

  return `
  <div class="screen-head">
    <div>
      <h2 class="screen-title">Baholar</h2>
      <div class="muted small">10 ballik tizim • ${rows.length} ta o'quvchi</div>
    </div>
  </div>

  <div class="selector-row">
    <span class="selector-label">Guruh</span>
    <div class="chips">
      ${groups.map(g => `<button type="button" class="chip-btn ${state.gradeGroup === g.id ? 'active' : ''}" data-act="grade-group" data-group="${g.id}">${esc(g.name)}</button>`).join('')}
    </div>
  </div>

  <div class="selector-row">
    <span class="selector-label">Sinf</span>
    <div class="chips">
      ${classChips.map(c => `<button type="button" class="chip-btn ${state.gradeClass === c ? 'active' : ''}" data-act="grade-class" data-class="${esc(c)}">${esc(c)}</button>`).join('')}
    </div>
  </div>

  <div class="grid-scroll">
    <table class="bj">
      <thead>${head}</thead>
      <tbody>${body || `<tr><td class="bj-name">${esc("Bu sinfda o'quvchi yo'q")}</td></tr>`}</tbody>
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
    return `<div class="screen-head"><h2 class="screen-title">Davomat</h2></div>` + emptyState("Avval guruh yarating", 'cal');
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
      <h2 class="screen-title">Tezkor davomat</h2>
      <div class="muted small">${marked}/${students.length} belgilandi</div>
    </div>
    <button type="button" class="btn btn-ghost btn-sm" data-act="nav" data-screen="speaking">${ico('mic', 15)} Speaking</button>
  </div>

  <div class="selector-row">
    <span class="selector-label">Guruh</span>
    <div class="chips">
      ${groups.map(g => `<button type="button" class="chip-btn ${state.attGroup === g.id ? 'active' : ''}" data-act="att-group" data-group="${g.id}">${esc(g.name)}</button>`).join('')}
    </div>
  </div>

  <div class="selector-row">
    <span class="selector-label">Sana</span>
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
      <h2 class="screen-title">Speaking</h2>
      <div class="muted small">1-on-1 slotlar • ${list.length} ta slot</div>
    </div>
    <button type="button" class="btn btn-primary btn-sm" data-act="open-slot">+ Slot</button>
  </div>

  <div class="selector-row">
    <span class="selector-label">Sana</span>
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

  <div class="section-title">Telegram topshiriqlari (Inbox)</div>
  <div class="card">
    ${renderTgInbox()}
  </div>

  <p class="muted small" style="margin-top:10px">Slotga o'quvchi tayinlanadi. Ovozli/video topshiriklar botga tushadi (foydalanuvchi ruxsati bilan) — "Baholash" orqali 1–10 ball qo'yiladi, ball baholar jurnaliga tushadi va Speaking qarzi 1 ga kamayadi.</p>
  `;
}

/* ---- Telegram topshiriklari (ustoz uchun inbox) ---- */
function renderTgInbox() {
  /* Baholangan topshirik kartalari INBOXdan chiqadi (silliq ravishda) */
  const subs = getTgSubs().filter(function (t) {
    return t.status !== 'baholandi' && t.status !== 'graded';
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

  list.push({ id: 'sp' + Date.now(), date, start, end, studentId: sid || null, score: null });
  store.set(K.speaking, list);
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
function doLogin() {
  const loginEl = $('#login-input');
  const passEl = $('#password-input');
  const err = $('#login-error');
  const login = (loginEl.value || '').trim().toLowerCase();
  const pass = passEl.value || '';

  const fail = msg => {
    if (err) { err.textContent = msg; err.classList.add('show'); }
  };

  if (!login || !pass) { fail("Login va parolni kiriting"); return; }
  if (err) { err.textContent = ''; err.classList.remove('show'); }

  const validate = () => {
    const acc = accounts[login];
    if (!acc || acc.password !== pass) {
      fail("Login yoki parol noto'g'ri");
      passEl.value = '';
      passEl.focus();
      return;
    }
    startSession(login);
    toast('Xush kelibsiz!');
  };

  /* Boshqa qurilmadan kirish: avval bulutdan hisoblarni tekshiramiz */
  if (CloudSync.ready()) {
    if (loginEl.disabled) return;
    loginEl.disabled = true;
    const done = () => { loginEl.disabled = false; validate(); };
    CloudSync.pullAll().then(done, done);
  } else {
    validate();
  }
}

function logout() {
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
  $('#screen').innerHTML = (SCREENS[scr] || loginScreen)();
  if (scr === 'students') refreshStudentList();
  if (scr === 'grades') ensureGradeState();
  if (scr === 'attendance') ensureAttState();
  if (scr === 'speaking') ensureSpeakState();
  if (scr === 'home' && !isTeacher()) refreshChat();
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
  CloudSync.pushDebt(sid);
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
      CloudSync.pushDebt(t.id);
    }
  }

  /* O'quvchi baholar jurnaliga yozish */
  if (st) {
    const grades = getGrades();
    if (!grades[st.id]) grades[st.id] = {};
    grades[st.id][dateKey] = { score: score, category: 'Speaking', note: sub.feedback || 'Speaking (Telegram)' };
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

document.addEventListener('click', function (e) {
  const btn = e.target && e.target.closest ? e.target.closest('[data-act]') : null;
  if (!btn) return;
  const act = btn.getAttribute('data-act');

  const actions = {
    /* --- Kirish --- */
    'do-login': doLogin,
    'logout': logout,
    'nav': function () { go(btn.getAttribute('data-screen')); },
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
    'open-add-student': openAddStudent,
    'close-modal': closeModal,
    'save-group': saveGroup,
    'save-student': saveStudent,
    'reset-pwd': function () { openResetPwd(btn.getAttribute('data-sid')); },
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
    'open-hw': openHwModal,
    'save-hw': saveHomework,

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
      store.set(K.speaking, getSpeaking().filter(x => x.id !== id));
      render();
      toast("Slot o'chirildi");
    },
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
  if (t.id === 'sp-date' && t.value) { state.speakDate = t.value; render(); }
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
  render();
  /* Avval bulutdan ma'lumotni tiklaymiz (multi-device sync), keyin qayta chizamiz */
  if (CloudSync.ready()) {
    CloudSync.pullAll().then(function (ok) {
      if (ok && currentUser()) render();
      CloudSync.subscribe();
      refreshChat();
    });
  }
})();
