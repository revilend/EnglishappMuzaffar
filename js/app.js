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
  messages: 'et_messages'
};

function seedIfEmpty(key, data) { if (store.get(key, null) === null) store.set(key, data); }
seedIfEmpty(K.groups, APP_DATA.groups);
seedIfEmpty(K.students, APP_DATA.students);
seedIfEmpty(K.attendance, null);

/* Kirish hisoblari (login → ma'lumot) */
let accounts = store.get(K.accounts, null);
if (!accounts || !Object.keys(accounts).length) {
  accounts = {};
  APP_DATA.accounts.forEach(a => {
    accounts[a.login] = { login: a.login, password: a.password, role: a.role, name: a.name, studentId: a.studentId || null };
  });
  store.set(K.accounts, accounts);
}
function persistAccounts() { store.set(K.accounts, accounts); }

const state = {
  screen: 'login',
  filterClass: 'Barchasi',
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
const TEACHER_LOGIN = 'admin';
const TEACHER_PASSWORD = '123';

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
  let seeded = false;
  let subscribed = false;
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
      speaking_debt: Number(s.speakingDebt) || 0
    };
  }

  /* --- Birinchi kirish: lokal demo ma'lumotni jadvallarga ko'chirish --- */
  async function seedDemo() {
    const localGroups = getGroups();
    const gDb = [];
    for (let i = 0; i < localGroups.length; i++) {
      const g = localGroups[i];
      const res = await client.from('groups').insert({ name: g.name, days: g.days, time: g.time }).select();
      if (res.error) throw res.error;
      g.dbId = res.data[0].id;
      gDb.push(res.data[0].id);
    }
    store.set(K.groups, localGroups);

    const localStudents = getStudents();
    for (let i = 0; i < localStudents.length; i++) {
      const st = localStudents[i];
      const gi = localGroups.findIndex(function (g) { return g.id === st.groupId; });
      const payload = payloadOf(st);
      if (gi >= 0) payload.group_id = gDb[gi];
      const res = await client.from('students').insert(payload).select();
      if (res.error) throw res.error;
      st.dbId = res.data[0].id;
    }
    store.set(K.students, localStudents);

    /* Baholar va davomat seedlari */
    const grades = getGrades();
    const att = getAttendance();
    const gRows = [], aRows = [];
    localStudents.forEach(function (st) {
      if (st.dbId == null) return;
      const recs = grades[st.id] || {};
      Object.keys(recs).forEach(function (dk) {
        const r = recs[dk];
        gRows.push({ student_id: st.dbId, date: dk, grade: r.score, category: r.category || 'Darsdagi javob', note: r.note || '' });
      });
      Object.keys(att).forEach(function (dk) {
        if (att[dk] && att[dk][st.id]) aRows.push({ student_id: st.dbId, date: dk, status: att[dk][st.id] });
      });
    });
    if (gRows.length) { const res = await client.from('grades').insert(gRows); if (res.error) throw res.error; }
    if (aRows.length) { const res = await client.from('attendance').insert(aRows); if (res.error) throw res.error; }
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
      const cache = store.get(K.messages, []).filter(function (m) { return sid == null || m.sid === sid; });
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

  /* --- Ovozli topshiriklar (audio_submissions jadvali, bo'lmasa lokal) --- */
  async function pullAudio() {
    if (!ready() || !hasAudio) return;
    const res = await client.from('audio_submissions').select('*').order('created_at', { ascending: true });
    if (res.error) { if (missing(res.error)) hasAudio = false; return; }
    const list = getStudents();
    let changed = false;
    res.data.forEach(function (r) {
      const st = list.filter(function (x) { return x.dbId === r.student_id; })[0];
      if (!st) return;
      st.audioSubmissions = st.audioSubmissions || [];
      if (st.audioSubmissions.some(function (a) { return a.rid === r.id; })) return;
      st.audioSubmissions.push({ id: 'a' + r.id, rid: r.id, date: r.date, url: r.url, status: r.status, score: r.score, feedback: r.feedback || '' });
      changed = true;
    });
    if (changed) store.set(K.students, list);
  }

  /* --- Barcha jadvallarni tortib, lokal modelni qayta qurish --- */
  async function pullAll() {
    if (!ready()) return false;
    try {
      let gRes = await client.from('groups').select('*');
      let sRes = await client.from('students').select('*');
      if (gRes.error || sRes.error) return false;
      if (!gRes.data.length && !sRes.data.length) {
        if (!seeded) { await seedDemo(); seeded = true; }
        gRes = await client.from('groups').select('*');
        sRes = await client.from('students').select('*');
        if (gRes.error || sRes.error) return false;
      }
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

      /* hisoblar: ustoz (admin/123) + jadvaldagi login/parollar */
      const next = {};
      next[TEACHER_LOGIN] = { login: TEACHER_LOGIN, password: TEACHER_PASSWORD, role: 'teacher', name: 'Ustoz', studentId: null };
      students.forEach(function (st) {
        if (st.login) next[st.login] = { login: st.login, password: st.password || '', role: 'student', studentId: st.id, name: st.fullName };
      });
      accounts = next;
      persistAccounts();

      await fetchMessages(null);
      try { await pullAudio(); } catch (e) { /* audio jadvali yo'q — lokal qoladi */ }
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
        const res = await client.from('students').update(payload).eq('id', st.dbId);
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

  async function pushAudio(sid, sub) {
    if (!ready() || !hasAudio) return;
    const dbId = dbOfSid(sid);
    if (dbId == null) return;
    if (!sub.url || String(sub.url).length > 900000) return; /* juda katta — lokalda qoladi */
    const res = await client.from('audio_submissions').insert({
      student_id: dbId, date: sub.date, url: sub.url,
      status: sub.status || 'pending',
      score: sub.score == null ? null : sub.score,
      feedback: sub.feedback || ''
    }).select();
    if (res.error) { if (missing(res.error)) hasAudio = false; throw res.error; }
    sub.rid = res.data[0].id;
  }

  async function pushAudioGrade(sid, sub) {
    if (!ready() || !hasAudio) return;
    if (sub.rid == null) return pushAudio(sid, sub);
    const res = await client.from('audio_submissions').update({
      status: sub.status, score: sub.score, feedback: sub.feedback || ''
    }).eq('id', sub.rid);
    if (res.error) { if (missing(res.error)) hasAudio = false; throw res.error; }
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

  /* Real-time: messages jadvaliga obuna (publication yo'l qo'ysa) */
  function subscribe() {
    if (!ready() || !hasMessages || subscribed) return;
    try {
      const ch = client.channel('messages-live');
      ch.on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, function () { refreshChat(); })
        .subscribe(function (status) {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') subscribed = false;
        });
      subscribed = true;
    } catch (e) { subscribed = false; }
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
    pushAudio: pushAudio,
    pushAudioGrade: pushAudioGrade,
    sendMessage: sendMessage,
    subscribe: subscribe,
    deleteStudent: deleteStudent,
    deleteGroup: deleteGroup,
    messagesAvailable: function () { return ready() && hasMessages; },
    audioAvailable: function () { return ready() && hasAudio; },
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
  updateChatPoll();
}
function go(screen) { state.screen = screen; render(); }

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

/* ==================== Ikonkalar ==================== */
const ICON = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.8 12 3l9 7.8"/><path d="M5.5 9.6V21h13V9.6"/><path d="M9.5 21v-6h5v6"/></svg>',
  students: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1.4"/><circle cx="4.5" cy="12" r="1.4"/><circle cx="4.5" cy="18" r="1.4"/></svg>',
  grades: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4v16h16"/><path d="M8 16v-4"/><path d="M12 16V8"/><path d="M16 16v-6"/></svg>',
  cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/><path d="M9 15l2 2 4-4"/></svg>',
  mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/></svg>',
  profile: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.6"/><path d="M4.5 20.5c0-3.7 3.3-6.2 7.5-6.2s7.5 2.5 7.5 6.2"/></svg>',
  groups: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M3.2 20c0-3.2 2.6-5.4 5.8-5.4s5.8 2.2 5.8 5.4"/><circle cx="17.3" cy="9.3" r="2.3"/><path d="M16.5 14.7c2.7.1 4.6 2.3 4.6 4.6"/></svg>'
};

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
    <span class="role-badge ${u.role === 'teacher' ? 'is-teacher' : 'is-student'}">${u.role === 'teacher' ? 'Ustoz' : "O'quvchi"}</span>
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
    ['home', 'Portim', ICON.home],
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
    <div class="auth-logo">🎓</div>
    <h1 class="auth-title">English Tutor</h1>
    <p class="auth-sub">Ingliz tili darslari — ustoz paneli va o'quvchi kabineti</p>

    <div class="card auth-card">
      <label class="field-label" for="login-input">Login</label>
      <input class="input" id="login-input" type="text" autocapitalize="none" autocorrect="off"
             autocomplete="username" placeholder="Masalan: admin" />

      <label class="field-label" for="password-input">Parol</label>
      <input class="input" id="password-input" type="password"
             autocomplete="current-password" placeholder="••••" />

      <div class="field-error" id="login-error"></div>
      <button type="button" class="btn btn-primary btn-block" data-act="do-login">Kirish</button>
    </div>

    <div class="hint-card">
      <strong>Demo kirish ma'lumotlari</strong>
      <div class="login-demo">
        <span class="pill">Ustoz: <code>admin</code> / <code>123</code></span>
        <span class="pill">O'quvchi: <code>jasur</code> / <code>123</code></span>
      </div>
    </div>
  </div>`;
}

/* ==================== Yordamchilar ==================== */
function emptyState(text) {
  return `<div class="empty"><span class="emoji">📭</span>${esc(text)}</div>`;
}
function blockedScreen(msg) {
  return `<div class="blocked"><span class="emoji">🔒</span>${esc(msg)}</div>`;
}

/* ==================== BOSH SAHIFA: USTOZ ==================== */
function teacherHome() {
  const groups = getGroups();
  const students = getStudents();
  const classSet = {};
  students.forEach(s => { classSet[s.schoolClass] = 1; });
  const u = currentUser() || {};
  const name = u.name || 'Ustoz';
  const recent = students.slice(0, 3);

  return `
  <section class="card">
    <div class="greet-main">
      <div class="avatar avatar-lg">${esc(initials(name))}</div>
      <div class="col">
        <div class="greet-hi">Assalomu alaykum!</div>
        <div class="greet-name">${esc(name)}</div>
        <span class="role-badge is-teacher">Ustoz</span>
      </div>
    </div>
  </section>

  <div class="stat-grid">
    <div class="card stat"><span class="stat-num">${groups.length}</span><span class="stat-label">Guruhlar</span></div>
    <div class="card stat"><span class="stat-num">${students.length}</span><span class="stat-label">O'quvchilar</span></div>
    <div class="card stat"><span class="stat-num">${Object.keys(classSet).length}</span><span class="stat-label">Sinflar</span></div>
  </div>

  <div class="section-title">Tez amallar</div>
  <div class="quick-grid">
    <button type="button" class="card quick" data-act="nav" data-screen="grades"><span class="quick-ico">📊</span><span>Baholar jurnali</span></button>
    <button type="button" class="card quick" data-act="nav" data-screen="attendance"><span class="quick-ico">🗓️</span><span>Tezkor davomat</span></button>
    <button type="button" class="card quick" data-act="nav" data-screen="speaking"><span class="quick-ico">🗣️</span><span>Speaking slotlari</span></button>
    <button type="button" class="card quick" data-act="nav" data-screen="students"><span class="quick-ico">🧒</span><span>O'quvchilar</span></button>
    <button type="button" class="card quick" data-act="nav" data-screen="groups"><span class="quick-ico">👥</span><span>Guruhlar</span></button>
    <button type="button" class="card quick" data-act="open-add-student"><span class="quick-ico">➕</span><span>O'quvchi qo'shish</span></button>
  </div>

  <div class="section-title">So'nggi o'quvchilar</div>
  ${recent.length ? recent.map(studentCard).join('') : emptyState("Hozircha o'quvchi yo'q")}
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
    <div class="card">${blockedScreen("Profilingiz guruhga biriktirilmagan. Ustoz bilan bog'laning.")}</div>
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
  }).join('') : `<div class="empty"><span class="emoji">📊</span>Hozircha baho yo'q</div>`;

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
    </div>`).join('') : `<div class="empty"><span class="emoji">🗓️</span>Davomat yozuvi yo'q</div>`;

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
    </div>`).join('') : `<div class="empty"><span class="emoji">🗣️</span>Hozircha slot biriktirilmagan</div>`;

  /* --- Mening topshiriklarim --- */
  const mySubs = (st.audioSubmissions || []).slice().reverse().map(a => `
    <div class="audio-item">
      <div class="audio-item__meta">${fmtDMY(a.date)} · ${a.status === 'pending' ? "⏳ Ustoz ko'rib chiqmoqda" : (a.status === 'graded' ? `✅ Baho: ${a.score}/10` : '')}</div>
      <audio class="audio-player" controls src="${esc(a.url)}"></audio>
      ${a.feedback ? `<div class="gr-note">Izoh: ${esc(a.feedback)}</div>` : ''}
    </div>`).join('') || `<div class="empty"><span class="emoji">🎙</span>Hozircha topshirilmagan</div>`;

  return `
  <section class="card">
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
      ? `<div class="debt-badge" style="margin-bottom:8px">⚠️ Speaking qarzingiz: ${Number(st.speakingDebt)} ta</div>`
      : `<div class="att-pill" style="margin-bottom:8px">✅ Speaking qarzingiz yo'q</div>`}
    ${slotRows}
  </div>

  <div class="section-title">Speaking topshirish (Ovoz yozish)</div>
  <div class="card">
    <div class="muted small">Ustozga speaking vazifangizni ovozli topshiring.</div>
    <div class="recorder" id="recorder">
      <button type="button" class="btn btn-primary btn-sm" data-act="rec-start">🎙 Ovoz yozish</button>
      <button type="button" class="btn btn-ghost btn-sm" data-act="rec-stop" id="rec-stop" hidden>⏹ To'xtatish</button>
      <button type="button" class="btn btn-ghost btn-sm" data-act="rec-play" id="rec-play" hidden>▶ Tinglash</button>
      <button type="button" class="btn btn-primary btn-sm" data-act="rec-send" id="rec-send" disabled>📤 Yuborish</button>
      <span class="recorder__status" id="rec-status"></span>
    </div>
    <audio id="rec-audio" class="audio-player" controls hidden></audio>
    <div id="my-submissions" class="audio-list">${mySubs}</div>
  </div>

  <div class="section-title">Ustoz bilan Chat</div>
  <div class="card chat-card">
    ${chatHint()}
    <div class="chat-list" id="chat-list">${chatListHTML(st.id, 'student')}</div>
    <div class="chat-input-row">
      <input class="input" id="chat-input" placeholder="Ustozga xabar yozing..." autocomplete="off" />
      <button type="button" class="btn btn-primary" data-act="send-chat">Yuborish</button>
    </div>
  </div>

  <div class="section-title">Sozlamalar</div>
  <div class="card">
    <div class="list-row"><span>Login</span><code>${esc(u.login || '')}</code></div>
    <div class="list-row"><span>Parol</span><span class="muted">••••</span></div>
  </div>
  <button type="button" class="btn btn-ghost btn-block" data-act="open-change-pwd">🔑 Parolni o'zgartirish</button>
  `;
}

function homeScreen() { return isTeacher() ? teacherHome() : studentPortal(); }

/* ==================== GURUHLAR (faqat ustoz) ==================== */
function groupCard(g, students) {
  const cnt = students.filter(s => s.groupId === g.id).length;
  return `<div class="card group-card">
    <div class="row between">
      <h3 class="card-h">${esc(g.name)}</h3>
      <span class="pill">${cnt} o'quvchi</span>
    </div>
    <div class="meta-rows">
      <div class="meta-row">📅 <span>${esc(g.days)}</span></div>
      <div class="meta-row">🕒 <span>${esc(g.time)}</span></div>
    </div>
    <div class="row g8" style="margin-top:11px">
      <button type="button" class="btn btn-ghost btn-sm" data-act="grade-group-go" data-group="${g.id}">📊 Baholar</button>
      <button type="button" class="btn btn-ghost btn-sm" data-act="open-attendance" data-group="${g.id}">🗓️ Davomat</button>
      <button type="button" class="btn btn-danger btn-sm" data-act="del-group" data-gid="${g.id}">🗑 O'chirish</button>
    </div>
  </div>`;
}

function groupsScreen() {
  if (!isTeacher()) return blockedScreen("Bu bo'lim faqat ustoz uchun");
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
  ${groups.length ? groups.map(g => groupCard(g, students)).join('') : emptyState("Hozircha guruh yo'q")}
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
          <span class="s-contact"><span class="lbl">Login</span><code>${acc ? esc(acc.login) : '—'}</code></span>
        </div>
        <div class="s-debt row between" style="margin-top:10px">
          <span class="lbl-strong">Speaking qarzi</span>
          <div class="debt-controls">
            <button type="button" class="btn btn-xs ghost" data-act="debt-minus" data-sid="${s.id}" aria-label="Kamaytirish">−</button>
            <span class="debt-num">${Number(s.speakingDebt) || 0} ta</span>
            <button type="button" class="btn btn-xs ghost" data-act="debt-plus" data-sid="${s.id}" aria-label="Ko'paytirish">+</button>
          </div>
        </div>
        <div class="row g8" style="margin-top:10px">
          <button type="button" class="btn btn-xs ghost" data-act="open-chat" data-sid="${s.id}">💬 Xabar yozish</button>
          <button type="button" class="btn btn-xs ghost" data-act="reset-pwd" data-sid="${s.id}">🔑 Parolni yangilash</button>
          <button type="button" class="btn btn-xs danger" data-act="del-student" data-sid="${s.id}">🗑 O'chirish</button>
        </div>
      </div>
    </div>
  </div>`;
}

function filteredStudents() {
  const q = state.search.trim().toLowerCase();
  return getStudents().filter(s => {
    const byClass = state.filterClass === 'Barchasi' || s.schoolClass === state.filterClass;
    const byQuery = !q || String(s.fullName).toLowerCase().indexOf(q) >= 0;
    return byClass && byQuery;
  });
}
function studentListHTML() {
  const list = filteredStudents();
  return list.length ? list.map(studentCard).join('') : emptyState("O'quvchi topilmadi");
}
function refreshStudentList() {
  const list = $('#students-list');
  if (list) list.innerHTML = studentListHTML();
  const cnt = $('#students-count');
  if (cnt) cnt.textContent = filteredStudents().length + " ta o'quvchi";
}

function studentsScreen() {
  if (!isTeacher()) return blockedScreen("Bu bo'lim faqat ustoz uchun");
  const chips = ['Barchasi'].concat(APP_DATA.classes);
  return `
  <div class="screen-head">
    <div>
      <h2 class="screen-title">O'quvchilar</h2>
      <div class="muted small" id="students-count"></div>
    </div>
    <button type="button" class="btn btn-primary btn-sm" data-act="open-add-student">+ Qo'shish</button>
  </div>

  <div class="search-wrap">
    <input class="input" id="s-search" type="search" placeholder="Ism bo'yicha qidirish" value="${esc(state.search)}" />
  </div>

  <div class="chips">
    ${chips.map(c => `<button type="button" class="chip-btn ${state.filterClass === c ? 'active' : ''}" data-act="filter-class" data-class="${esc(c)}">${esc(c)}</button>`).join('')}
  </div>

  <div id="students-list">${studentListHTML()}</div>
  <button type="button" class="btn btn-ghost btn-block" data-act="nav" data-screen="groups">👥 Guruhlar</button>
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
      <span class="role-badge ${isTeacher() ? 'is-teacher' : 'is-student'}">${isTeacher() ? 'Ustoz' : "O'quvchi"}</span>
      ${st ? `<span class="pill" style="margin-left:6px">${esc(st.schoolClass)}</span>` : ''}
    </div>
  </div>

  <div class="section-title">Xavfsizlik</div>
  <div class="card list-card">
    <div class="list-row"><span>Login</span><code>${esc(u.login || '')}</code></div>
    <div class="list-row"><span>Parol</span><span class="muted">••••</span></div>
    <div class="list-row"><span>Ko'rinish</span><span class="muted">${isTeacher() ? 'Ustoz' : "O'quvchi"}</span></div>
  </div>
  <button type="button" class="btn btn-ghost btn-block" data-act="open-change-pwd">🔑 Parolni o'zgartirish</button>

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
  updateChatPoll();
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
    <input class="input" id="f-spass" type="text" inputmode="numeric" placeholder="Masalan: 1234" />

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
        <div class="muted small">${esc(st.schoolClass)} • login: <code>${acc ? esc(acc.login) : '—'}</code></div>
      </div>
    </div>
    ${acc ? '' : `<label class="field-label" for="rp-login">Login</label>
      <input class="input" id="rp-login" autocapitalize="none" value="${esc(suggestLogin(st.fullName))}" />`}
    <label class="field-label" for="rp-pass">Yangi parol</label>
    <input class="input" id="rp-pass" inputmode="numeric" placeholder="Masalan: 1234" />
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
        <div class="muted small">Login: <code>${esc(u.login)}</code></div>
      </div>
    </div>

    <label class="field-label" for="cp-old">Joriy parol</label>
    <input class="input" id="cp-old" type="password" autocomplete="current-password" placeholder="••••" />

    <label class="field-label" for="cp-new">Yangi parol</label>
    <input class="input" id="cp-new" type="password" autocomplete="new-password" placeholder="••••" />

    <label class="field-label" for="cp-new2">Yangi parolni tasdiqlang</label>
    <input class="input" id="cp-new2" type="password" autocomplete="new-password" placeholder="••••" />

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
      <div class="confirm-emoji">🗑</div>
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
      <div class="confirm-emoji">🗑</div>
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
  if (!isTeacher()) return blockedScreen("Bu bo'lim faqat ustoz uchun");
  ensureGradeState();
  const groups = getGroups();
  if (!groups.length) {
    return `<div class="screen-head"><h2 class="screen-title">Baholar</h2></div>` + emptyState("Avval guruh yarating");
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
  if (!isTeacher()) { toast("Bahrani faqat ustoz qo'yadi", 'error'); return; }
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
  if (!isTeacher()) return blockedScreen("Bu bo'lim faqat ustoz uchun");
  ensureAttState();
  const groups = getGroups();
  if (!groups.length) {
    return `<div class="screen-head"><h2 class="screen-title">Davomat</h2></div>` + emptyState("Avval guruh yarating");
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
    <button type="button" class="btn btn-ghost btn-sm" data-act="nav" data-screen="speaking">🗣️ Speaking</button>
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
    ${students.length ? rows : emptyState("Bu guruhda o'quvchi yo'q")}
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
      ${st ? '' : `<button type="button" class="btn btn-xs ghost" data-act="slot-assign" data-id="${esc(x.id)}">👤 Tayinlash</button>`}
      <button type="button" class="btn btn-xs ${scored ? 'ghost' : 'primary'}" data-act="slot-score" data-id="${esc(x.id)}">${scored ? "Bahoni o'zgartirish" : '⭐ Baholash'}</button>
      <button type="button" class="btn btn-xs danger" data-act="slot-del" data-id="${esc(x.id)}">O'chirish</button>
    </div>
  </div>`;
}

function speakingScreen() {
  if (!isTeacher()) return blockedScreen("Bu bo'lim faqat ustoz uchun");
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

  <div class="section-title">Ovozli topshiriklar (Inbox)</div>
  <div class="card">
    ${renderAudioInbox()}
  </div>

  <p class="muted small" style="margin-top:10px">Slotga o'quvchi tayinlanadi. Dars keyin "Baholash" orqali 1–10 ball qo'yiladi va bu ball o'quvchining baholar jurnaliga darhol tushadi. Ovozli topshirik baholansa, Speaking qarzi 1 ga kamayadi.</p>
  `;
}

/* ---- Ovozli topshiriklar (ustoz uchun inbox) ---- */
function allAudioSubs() {
  const out = [];
  getStudents().forEach(st => {
    (st.audioSubmissions || []).forEach((a, i) => {
      out.push({ ...a, studentId: st.id, studentName: st.fullName, schoolClass: st.schoolClass, index: i });
    });
  });
  return out.sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

function renderAudioInbox() {
  const subs = allAudioSubs();
  if (!subs.length) return emptyState("Hozircha ovozli topshirik yo'q");
  return subs.map(a => `
    <div class="audio-item">
      <div class="audio-item__meta">
        <strong>${esc(a.studentName)}</strong> <span class="chip-class">${esc(a.schoolClass)}</span> · ${fmtDMY(a.date)} ·
        ${a.status === 'graded' ? `<span class="gr-score ${gradeClassOf(a.score)}">${a.score}</span>` : '⏳ Kutilmoqda'}
      </div>
      <audio class="audio-player" controls src="${esc(a.url)}"></audio>
      ${a.feedback ? `<div class="gr-note">Izoh: ${esc(a.feedback)}</div>` : ''}
      <div class="grade-row">
        ${[1,2,3,4,5,6,7,8,9,10].map(n => `
          <button type="button" class="btn btn-xs ${a.score === n ? 'btn-primary' : 'ghost'}" data-act="audio-grade" data-sid="${a.studentId}" data-idx="${a.index}" data-score="${n}">${n}</button>`).join('')}
        <input class="input" style="flex:1;min-width:140px" placeholder="Izoh (ixtiyoriy)" value="${esc(a.feedback || '')}" data-act="audio-feedback" data-sid="${a.studentId}" data-idx="${a.index}" />
      </div>
    </div>`).join('');
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
    toast('Xush kelibsiz! 👋');
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
  closeModal();
  state.screen = 'login';
  render();
  toast('Hisobdan chiqdingiz');
}

/* ==================== Seed (birinchi ishga tushirish) ==================== */
function seedJournal() {
  if (store.get(K.grades, null) !== null) return;
  const grades = {};
  const att = {};
  getStudents().forEach(s => {
    const dates = lessonDates(s.groupId, 5);
    const scores = APP_DATA.gradeSeeds[s.id] || [];
    const attSeed = APP_DATA.attendanceSeeds[s.id] || [];
    const notes = APP_DATA.gradeNoteSeeds[s.id] || {};
    dates.forEach((dk, i) => {
      if (i < scores.length) {
        grades[s.id] = grades[s.id] || {};
        grades[s.id][dk] = {
          score: scores[i],
          category: APP_DATA.gradeCategories[i % APP_DATA.gradeCategories.length],
          note: notes[i] || ''
        };
      }
      if (i < attSeed.length) {
        att[dk] = att[dk] || {};
        att[dk][s.id] = attSeed[i];
      }
    });
  });
  store.set(K.grades, grades);
  store.set(K.attendance, att);
}

function seedSpeaking() {
  if (store.get(K.speaking, null) !== null) return;
  const today = todayKey();
  store.set(K.speaking, APP_DATA.speakingSeed.map((s, i) => ({
    id: 'spseed' + (i + 1),
    date: today,
    start: s.start,
    end: s.end,
    studentId: s.studentId,
    score: null
  })));
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
  updateChatPoll();
}

/* ==================== CHAT (Ustoz ↔ O'quvchi) ==================== */
function fmtHM(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}
function messagesFor(sid) {
  return store.get(K.messages, [])
    .filter(m => m.sid === sid)
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}
function chatListHTML(sid, viewer) {
  const msgs = messagesFor(sid);
  if (!msgs.length) return `<div class="empty"><span class="emoji">💬</span>Hozircha xabar yo'q</div>`;
  return msgs.map(m => `<div class="chat-msg ${m.sender === viewer ? 'mine' : 'theirs'}">
      <div class="chat-text">${esc(m.text)}</div>
      <div class="chat-time">${fmtHM(m.createdAt)}</div>
    </div>`).join('');
}
function chatHint() {
  if (CloudSync.messagesAvailable()) return '';
  return `<div class="chat-hint">⚠️ Supabase'da <code>messages</code> jadvali topilmadi — xabarlar shu qurilmada saqlanadi (<code>supabase.sql</code> ni ishga tushiring).</div>`;
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
      <h3>💬 Xabar yozish</h3>
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
  input.value = '';
  CloudSync.sendMessage(c.sid, c.viewer, text);
  updateChatView();
}

/* Chat ochiq bo'lganda 5 sekundda bir marta yangilaymiz (real-time fallback) */
let chatPollTimer = null;
function chatPollActive() {
  if ($('#modal-overlay').hidden === false && !!$('#chat-list')) return true;
  return state.screen === 'home' && !isTeacher() && !!$('#chat-list');
}
function updateChatPoll() {
  if (chatPollActive()) {
    if (!chatPollTimer) {
      chatPollTimer = setTimeout(function () {
        chatPollTimer = null;
        if (!chatPollActive()) return;
        refreshChat();
        updateChatPoll();
      }, 5000);
    }
  } else if (chatPollTimer) {
    clearTimeout(chatPollTimer);
    chatPollTimer = null;
  }
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

/* ==================== OVOZ YOZISH (O'quvchi) ==================== */
let mediaRecorder = null;
let recChunks = [];
let recBlobUrl = '';
let recTimer = null;
let recSeconds = 0;

function recStatus(msg) {
  const el = $('#rec-status');
  if (el) el.textContent = msg;
}
function setRecBtn(id, show, disabled) {
  const el = document.getElementById(id);
  if (!el) return;
  el.hidden = !show;
  if (disabled != null) el.disabled = disabled;
}

async function startRecording() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    toast("Bu qurilmada mikrofon qo'llab-quvvatlanmaydi", 'error');
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recChunks = [];
    if (recBlobUrl) { URL.revokeObjectURL(recBlobUrl); recBlobUrl = ''; }
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = e => { if (e.data && e.data.size) recChunks.push(e.data); };
    mediaRecorder.onstop = () => {
      stream.getTracks().forEach(t => t.stop());
      const blob = new Blob(recChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
      recBlobUrl = URL.createObjectURL(blob);
      const audio = $('#rec-audio');
      if (audio) { audio.src = recBlobUrl; audio.hidden = false; }
      setRecBtn('rec-play', true, false);
      setRecBtn('rec-send', true, false);
      recStatus('Yozuv tayyor (' + recSeconds + ' s)');
    };
    mediaRecorder.start();
    recSeconds = 0;
    setRecBtn('rec-stop', true, false);
    setRecBtn('rec-play', false);
    setRecBtn('rec-send', false, true);
    recTimer = setInterval(() => {
      recSeconds++;
      recStatus('Yozilmoqda... ' + recSeconds + ' s');
    }, 1000);
    recStatus('Yozilmoqda...');
  } catch (err) {
    toast("Mikrofonga ruxsat berilmadi", 'error');
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
  clearInterval(recTimer);
  setRecBtn('rec-stop', false);
}

function playRecording() {
  const audio = $('#rec-audio');
  if (audio && recBlobUrl) { audio.play(); }
}

async function sendRecording() {
  if (!recBlobUrl) { toast("Avval ovoz yozing", 'error'); return; }
  const st = linkedStudent();
  if (!st) return;
  const blob = await (await fetch(recBlobUrl)).blob();
  const reader = new FileReader();
  reader.onload = function () {
    const dataUrl = reader.result;
    const list = getStudents();
    const target = list.filter(x => x.id === st.id)[0];
    target.audioSubmissions = target.audioSubmissions || [];
    target.audioSubmissions.push({
      id: 'a' + Date.now(),
      date: todayKey(),
      url: dataUrl,
      status: 'pending',
      score: null,
      feedback: ''
    });
    /* Har bir topshirik = +1 speaking qarzi (ustoz baholaydi) */
    target.speakingDebt = (Number(target.speakingDebt) || 0) + 1;
    store.set(K.students, list);
    CloudSync.pushDebt(st.id);
    CloudSync.pushAudio(st.id, target.audioSubmissions[target.audioSubmissions.length - 1]);
    render();
    toast("Ovoz yuborildi ✓ Ustozga yuborildi");
    recBlobUrl = '';
  };
  reader.readAsDataURL(blob);
}

/* ==================== AUDIO BAHOLASH (Ustoz) ==================== */
function gradeAudio(sid, idx, score) {
  if (!isTeacher()) { toast("Ruxsat yo'q", 'error'); return; }
  const list = getStudents();
  const st = list.filter(x => x.id === sid)[0];
  if (!st || !st.audioSubmissions || !st.audioSubmissions[idx]) return;
  const sub = st.audioSubmissions[idx];
  const wasGraded = sub.status === 'graded';
  sub.status = 'graded';
  sub.score = score;
  const fbInput = document.querySelector('[data-act="audio-feedback"][data-sid="' + sid + '"][data-idx="' + idx + '"]');
  if (fbInput) sub.feedback = fbInput.value.trim();

  /* Baholangan har bir audio = qarzdan −1 (faqat birinchi marta) */
  if (!wasGraded) st.speakingDebt = Math.max(0, (Number(st.speakingDebt) || 0) - 1);

  /* O'quvchi baholar jurnaliga yozish */
  const grades = getGrades();
  if (!grades[sid]) grades[sid] = {};
  grades[sid][sub.date] = { score: score, category: 'Speaking', note: sub.feedback || 'Speaking (audio)' };
  store.set(K.grades, grades);

  store.set(K.students, list);
  CloudSync.pushDebt(sid);
  CloudSync.pushGrade(sid, sub.date);
  CloudSync.pushAudioGrade(sid, sub);
  render();
  toast("Baho saqlandi ✓ (jurnalga yozildi, qarz kamaydi)");
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

    /* --- Guruhlar / o'quvchilar --- */
    'open-add-group': openAddGroup,
    'open-add-student': openAddStudent,
    'close-modal': closeModal,
    'save-group': saveGroup,
    'save-student': saveStudent,
    'reset-pwd': function () { openResetPwd(btn.getAttribute('data-sid')); },
    'save-reset': function () { saveResetPwd(btn.getAttribute('data-sid')); },

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

    /* --- Ovoz yozish --- */
    'rec-start': startRecording,
    'rec-stop': stopRecording,
    'rec-play': playRecording,
    'rec-send': sendRecording,

    /* --- Audio baholash --- */
    'audio-grade': function () {
      gradeAudio(btn.getAttribute('data-sid'), Number(btn.getAttribute('data-idx')), Number(btn.getAttribute('data-score')));
    },

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
  seedJournal();
  seedSpeaking();
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
