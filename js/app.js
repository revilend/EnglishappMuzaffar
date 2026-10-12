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
  del(key) { try { localStorage.removeItem(key); } catch (e) {} }
};

const K = {
  users: 'et_users',
  session: 'et_session',
  groups: 'et_groups',
  students: 'et_students',
  grades: 'et_grades',
  attendance: 'et_attendance'
};

function seedIfEmpty(key, data) { if (store.get(key, null) === null) store.set(key, data); }
seedIfEmpty(K.groups, APP_DATA.groups);
seedIfEmpty(K.students, APP_DATA.students);

let users = store.get(K.users, {});
function persistUsers() { store.set(K.users, users); }

const state = {
  screen: 'login',
  pendingPhone: '',
  pendingRole: null,
  pendingPin: '',
  filterClass: 'Barchasi',
  search: '',
  demoAccount: null,
  toastTimer: null,
  /* Step 2 — Baholar jurnali */
  gradeGroup: '',
  gradeClass: 'Barchasi',
  gradeDate: '',
  editor: null,
  /* Step 2 — Davomat */
  attGroup: '',
  attDate: '',
  attDraft: null,
  attDraftFor: ''
};

const AUTH_SCREENS = ['login', 'register', 'pin-create', 'pin-confirm', 'pin-login'];
/* Faqat "Ustoz" ruxsat beradigan ekranlar — xavfsizlik chegarasi */
const TEACHER_SCREENS = ['groups', 'students', 'grades', 'attendance'];

/* ---- Telefon formati: +998 XX XXX-XX-XX ---- */
function normPhone(v) {
  let d = String(v || '').replace(/\D/g, '');
  if (d.indexOf('998') === 0) return d;
  if (d.length === 9) return '998' + d;
  return d;
}
function isValidPhone(d) { return /^998\d{9}$/.test(d); }
function formatPhone(v) {
  let d = String(v || '').replace(/\D/g, '');
  if (d.indexOf('998') === 0) d = d.slice(3);
  d = d.slice(0, 9);
  let out = '+998';
  if (d.length) out += ' ' + d.slice(0, 2);
  if (d.length > 2) out += ' ' + d.slice(2, 5);
  if (d.length > 5) out += '-' + d.slice(5, 7);
  if (d.length > 7) out += '-' + d.slice(7, 9);
  return out;
}
function money(n) { return String(Number(n) || 0).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + " so'm"; }
function initials(name) {
  return String(name || '?').trim().split(/\s+/).slice(0, 2).map(w => w.charAt(0)).join('').toUpperCase();
}
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}
function getGroups() { return store.get(K.groups, []); }
function getStudents() { return store.get(K.students, []); }
function getGrades() { return store.get(K.grades, {}); }
function getAttendance() { return store.get(K.attendance, {}); }

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

/* Guruh dars kunlari bo'yicha so'nggi `count` ta dars sanasi (eski → yangi) */
function lessonDates(groupId, count) {
  const g = getGroups().filter(x => x.id === groupId)[0];
  if (!g) return [];
  const names = String(g.days).split(',').map(s => s.trim());
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

/* ---- Baholar hisobi ---- */
function gradeClassOf(v) {
  if (v >= 8) return 'g-a';
  if (v >= 6) return 'g-b';
  return 'g-c';
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

/* ---- Hisob (Telegram account) ---- */
function currentAccountId() {
  return state.demoAccount || (tgUser ? String(tgUser.id) : 'demo-1');
}
function getSession() { return store.get(K.session, null); }
function currentUser() {
  const s = getSession();
  return s && users[s.phoneKey] ? users[s.phoneKey] : null;
}
function isTeacher() {
  const u = currentUser();
  return !!u && u.role === 'teacher';
}
/* O'quvchi hisobini faqat o'z student yozuvidan topadi (telefon bo'yicha) */
function linkedStudent() {
  const u = currentUser();
  if (!u) return null;
  const key = normPhone(u.phone);
  return getStudents().filter(s => normPhone(s.phone) === key)[0] || null;
}
function startSession(key) {
  store.set(K.session, { phoneKey: key, role: users[key].role });
  state.screen = 'home';
  render();
}
function go(screen) { state.screen = screen; render(); }

/* ---- Toast / PIN ---- */
function toast(msg, type) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = msg;
  el.className = 'toast show' + (type === 'error' ? ' error' : '');
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => { el.className = 'toast'; }, 2600);
}
function pinValue() { const el = $('#pin-input'); return el ? el.value.replace(/\D/g, '') : ''; }
function clearPin() { const el = $('#pin-input'); if (el) el.value = ''; updateDots(); }
function updateDots() {
  const el = $('#pin-input');
  const v = el ? el.value : '';
  $$('#pin-dots i').forEach((d, i) => d.classList.toggle('on', i < v.length));
}
function pinError(msg) {
  const box = $('#pin-error');
  if (box) box.textContent = msg || '';
  const wrap = $('.pin-wrap');
  if (wrap && msg) {
    wrap.classList.remove('shake');
    void wrap.offsetWidth;
    wrap.classList.add('shake');
  }
}

/* ==================== Ikonkalar ==================== */
const ICON = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.8 12 3l9 7.8"/><path d="M5.5 9.6V21h13V9.6"/><path d="M9.5 21v-6h5v6"/></svg>',
  groups: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M3.2 20c0-3.2 2.6-5.4 5.8-5.4s5.8 2.2 5.8 5.4"/><circle cx="17.3" cy="9.3" r="2.3"/><path d="M16.5 14.7c2.7.1 4.6 2.3 4.6 4.6"/></svg>',
  students: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1.4"/><circle cx="4.5" cy="12" r="1.4"/><circle cx="4.5" cy="18" r="1.4"/></svg>',
  grades: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4v16h16"/><path d="M8 16v-4"/><path d="M12 16V8"/><path d="M16 16v-6"/></svg>',
  profile: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.6"/><path d="M4.5 20.5c0-3.7 3.3-6.2 7.5-6.2s7.5 2.5 7.5 6.2"/></svg>'
};

/* ==================== Header / Bottom nav ==================== */
function scrLabel(s) {
  return {
    home: 'Bosh sahifa',
    groups: 'Guruhlar',
    students: "O'quvchilar",
    grades: 'Baholar jurnali',
    attendance: 'Tezkor davomat',
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
      ['groups', 'Guruhlar', ICON.groups],
      ['students', "O'quvchilar", ICON.students],
      ['grades', 'Baholar', ICON.grades],
      ['profile', 'Profil', ICON.profile]
    ];
  }
  /* O'quvchi: faqat o'z portali va profili — boshqaruv ekranlari YO'Q */
  return [
    ['home', 'Portim', ICON.home],
    ['profile', 'Profil', ICON.profile]
  ];
}
function renderNav() {
  if (AUTH_SCREENS.indexOf(state.screen) >= 0) return '';
  return navItems().map(it => {
    const active = (state.screen === it[0] ||
      (it[0] === 'grades' && state.screen === 'attendance')) ? ' active' : '';
    return `<button type="button" class="nav-item${active}" data-act="nav" data-screen="${it[0]}">${it[2]}<span>${it[1]}</span></button>`;
  }).join('');
}

/* ==================== Auth ekranlari ==================== */
function loginScreen() {
  return `<div class="auth">
    <div class="auth-logo">🎓</div>
    <h1 class="auth-title">English Tutor</h1>
    <p class="auth-sub">Ingliz tili darslari — ustoz va o'quvchilar uchun</p>

    <div class="card auth-card">
      <label class="field-label" for="phone-input">Telefon raqam</label>
      <input class="input" id="phone-input" type="tel" inputmode="tel" autocomplete="tel"
             value="${formatPhone(APP_DATA.detectedPhone)}" />
      <div class="field-hint">✓ Telegram hisobingizdan raqam aniqlandi</div>
      <div class="field-error" id="phone-error"></div>
      <button type="button" class="btn btn-primary btn-block" data-act="do-login">Davom etish</button>
    </div>

    <div class="hint-card">
      <strong>Demo rejim</strong>
      <p>Joriy hisob: <code>${esc(currentAccountId())}</code></p>
      <p>Ro'yxatdan o'tgach, boshqa hisobda kirilsa PIN so'raladi.</p>
      <button type="button" class="btn btn-ghost btn-block" data-act="switch-account">Boshqa Telegram hisobni sinash</button>
    </div>
  </div>`;
}

function registerScreen() {
  return `<div class="auth">
    <div class="card auth-card">
      <h2 class="card-title">Ro'yxatdan o'tish</h2>
      <div class="phone-readonly">${formatPhone(state.pendingPhone)}</div>

      <div class="field-label">Siz kimsiz?</div>
      <div class="role-grid">
        <button type="button" class="role-card ${state.pendingRole === 'teacher' ? 'selected' : ''}" data-act="select-role" data-role="teacher">
          <span class="role-emoji">👨‍🏫</span>
          <strong>Ustoz</strong>
          <small>Guruhlarni boshqaradi, baho qo'yadi</small>
        </button>
        <button type="button" class="role-card ${state.pendingRole === 'student' ? 'selected' : ''}" data-act="select-role" data-role="student">
          <span class="role-emoji">🎓</span>
          <strong>O'quvchi</strong>
          <small>Faqat o'z bahosi va davomatini ko'radi</small>
        </button>
      </div>
      <div class="field-error" id="role-error"></div>

      <button type="button" class="btn btn-primary btn-block" data-act="to-pin-create">Davom etish</button>
      <button type="button" class="link-btn" data-act="restart-auth">← Boshqa raqam bilan kirish</button>
    </div>
  </div>`;
}

function pinBox() {
  return `<div class="pin-wrap">
    <div class="pin-dots" id="pin-dots"><i></i><i></i><i></i><i></i></div>
    <input class="pin-input" id="pin-input" type="tel" inputmode="numeric" maxlength="4"
           autocomplete="one-time-code" aria-label="PIN kod" />
  </div>`;
}
function backToPhone() {
  return `<button type="button" class="link-btn" data-act="restart-auth">← Boshqa raqam bilan kirish</button>`;
}

function pinCreateScreen() {
  return `<div class="auth">
    <div class="card auth-card center">
      <div class="pin-icon">🔒</div>
      <h2 class="card-title">PIN kod yarating</h2>
      <p class="muted small">Hisobingizni himoya qilish uchun 4 raqamli PIN kiriting</p>
      ${pinBox()}
      <div class="pin-error" id="pin-error"></div>
      <button type="button" class="btn btn-primary btn-block" data-act="submit-pin" data-mode="create">Davom etish</button>
      ${backToPhone()}
    </div>
  </div>`;
}

function pinConfirmScreen() {
  return `<div class="auth">
    <div class="card auth-card center">
      <div class="pin-icon">✅</div>
      <h2 class="card-title">PIN'ni tasdiqlang</h2>
      <p class="muted small">Yaratgan PIN kodni qaytadan kiriting</p>
      ${pinBox()}
      <div class="pin-error" id="pin-error"></div>
      <button type="button" class="btn btn-primary btn-block" data-act="submit-pin" data-mode="confirm">Tasdiqlash</button>
      ${backToPhone()}
    </div>
  </div>`;
}

function pinLoginScreen() {
  return `<div class="auth">
    <div class="card auth-card center">
      <div class="pin-icon">🔐</div>
      <h2 class="card-title">PIN kodni kiriting</h2>
      <p class="muted small">Bu raqam boshqa hisobda ro'yxatdan o'tgan</p>
      <div class="phone-readonly">${formatPhone(state.pendingPhone)}</div>
      ${pinBox()}
      <div class="pin-error" id="pin-error"></div>
      <button type="button" class="btn btn-primary btn-block" data-act="submit-pin" data-mode="verify">Kirish</button>
      <button type="button" class="link-btn" data-act="restart-auth">← Boshqa raqam bilan kirish</button>
      <p class="muted small" style="margin-top:10px">PIN'ni unutdingizmi? Ustozga murojaat qiling.</p>
    </div>
  </div>`;
}

/* ==================== Ekran yordamchilari ==================== */
function emptyState(text) {
  return `<div class="empty"><span class="emoji">📭</span>${esc(text)}</div>`;
}
function blockedScreen(msg) {
  return `<div class="blocked"><span class="emoji">🔒</span>${esc(msg)}</div>`;
}
function roleName(u) { return u && u.role === 'teacher' ? 'Ustoz' : "O'quvchi"; }

/* ==================== Bosh sahifa: USTOZ ==================== */
function teacherHome() {
  const groups = getGroups();
  const students = getStudents();
  const classSet = {};
  students.forEach(s => { classSet[s.schoolClass] = 1; });
  const u = currentUser() || {};
  const name = u.name || (tgUser && tgUser.first_name) || "Do'st";
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
    <button type="button" class="card quick" data-act="nav" data-screen="groups"><span class="quick-ico">👥</span><span>Guruhlar</span></button>
    <button type="button" class="card quick" data-act="nav" data-screen="students"><span class="quick-ico">🧒</span><span>O'quvchilar</span></button>
    <button type="button" class="card quick" data-act="open-add-student"><span class="quick-ico">➕</span><span>O'quvchi qo'shish</span></button>
    <button type="button" class="card quick" data-act="open-add-group"><span class="quick-ico">📅</span><span>Guruh qo'shish</span></button>
  </div>

  <div class="section-title">So'nggi o'quvchilar</div>
  ${recent.length ? recent.map(studentCard).join('') : emptyState("Hozircha o'quvchi yo'q")}
  <button type="button" class="btn btn-ghost btn-block" data-act="nav" data-screen="students">Barchasini ko'rish</button>
  `;
}

/* ==================== Bosh sahifa: O'QUVCHI PORTALI ==================== */
function studentPortal() {
  const u = currentUser() || {};
  const st = linkedStudent();

  if (!st) {
    return `
    <section class="card profile-head">
      <div class="avatar avatar-xl">${esc(initials(u.name || "O'quvchi"))}</div>
      <div class="profile-name">${esc(u.name || "O'quvchi")}</div>
      <div class="muted">${esc(u.phone || '')}</div>
      <div style="margin-top:9px"><span class="role-badge is-student">O'quvchi</span></div>
    </section>
    <div class="section-title">Mening ma'lumotlarim</div>
    <div class="card">${blockedScreen('Profilingiz hali guruhga biriktirilmagan. Ustoz bilan bog\'laning.')}</div>
    <div class="section-title">To'lov holati</div>
    <div class="card">${blockedScreen("To'lov ma'lumoti topilmadi")}</div>
    `;
  }

  const g = getGroups().filter(x => x.id === st.groupId)[0];
  const gradeRec = getGrades()[st.id] || {};
  const attRec = getAttendance();
  const pay = APP_DATA.payments[st.id] || null;
  const slot = APP_DATA.speaking[st.id] || null;

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
      <div class="pay-status">O'rtacha baho</div>
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

  <div class="section-title">To'lov holati</div>
  <div class="card pay-card">
    <div class="pay-ico ${pay && pay.status === 'overdue' ? 'on-overdue' : 'on-paid'}">${pay && pay.status === 'overdue' ? '⚠️' : '✅'}</div>
    <div class="col">
      <div class="pay-status ${pay && pay.status === 'overdue' ? 'on-overdue' : 'on-paid'}">${pay && pay.status === 'overdue' ? "To'lov muddati o'tdi" : "To'langan"}</div>
      <div class="muted small">${pay ? "Muddat: " + fmtDMY(pay.dueDate) + " • " + money(g ? g.fee : 0) : "To'lov ma'lumoti yo'q"}</div>
    </div>
  </div>

  <div class="section-title">Speaking vaqtim</div>
  <div class="card slot-card">
    <div class="slot-day">🗣️</div>
    <div class="col">
      <div class="pay-status">${slot ? esc(slot.day) + ', ' + esc(slot.time) : 'Biriktirilmagan'}</div>
      <div class="muted small">1-on-1 speaking (30 daqiqa)</div>
    </div>
  </div>
  `;
}

function homeScreen() { return isTeacher() ? teacherHome() : studentPortal(); }

/* ==================== Guruhlar (faqat ustoz) ==================== */
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
    <div class="fee">${money(g.fee)} <span class="fee-sub">/ oy</span></div>
    <div class="row g8" style="margin-top:11px">
      <button type="button" class="btn btn-ghost btn-sm" data-act="nav" data-screen="grades">📊 Baholar</button>
      <button type="button" class="btn btn-ghost btn-sm" data-act="open-attendance" data-group="${g.id}">🗓️ Davomat</button>
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

/* ==================== O'quvchilar (faqat ustoz) ==================== */
function studentCard(s) {
  const g = getGroups().filter(x => x.id === s.groupId)[0];
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
          <a class="s-contact" href="tel:${esc(String(s.phone).replace(/[^\d+]/g, ''))}"><span class="lbl">O'zi</span>${esc(s.phone)}</a>
          <a class="s-contact" href="tel:${esc(String(s.parentPhone).replace(/[^\d+]/g, ''))}"><span class="lbl">Ota-ona</span>${esc(s.parentPhone)}</a>
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
  `;
}

/* ==================== Profil ==================== */
function profileScreen() {
  const u = currentUser() || {};
  const st = !isTeacher() ? linkedStudent() : null;
  return `
  <div class="card profile-head">
    <div class="avatar avatar-xl">${esc(initials(st ? st.fullName : (u.name || 'U')))}</div>
    <div class="profile-name">${esc(st ? st.fullName : (u.name || ''))}</div>
    <div class="muted">${esc(u.phone || '')}</div>
    <div style="margin-top:9px">
      <span class="role-badge ${isTeacher() ? 'is-teacher' : 'is-student'}">${roleName(u)}</span>
      ${st ? `<span class="pill" style="margin-left:6px">${esc(st.schoolClass)}</span>` : ''}
    </div>
  </div>

  <div class="section-title">Xavfsizlik</div>
  <div class="card list-card">
    <div class="list-row"><span>PIN kod</span><span class="muted">••••</span></div>
    <div class="list-row"><span>Telegram hisobi</span><code>${esc(currentAccountId())}</code></div>
    <div class="list-row"><span>Ko'rinish</span><span class="muted">${roleName(u)}</span></div>
  </div>

  ${isTeacher() ? `
  <div class="section-title">Demo rejim</div>
  <div class="card">
    <p class="muted small">Boshqa Telegram hisobida kirilganda tizim PIN so'raydi — shu tugma bilan simulyatsiya qilinadi.</p>
    <button type="button" class="btn btn-ghost btn-block" data-act="switch-account">Boshqa hisobda sinash</button>
  </div>` : ''}

  <button type="button" class="btn btn-danger btn-block" data-act="logout">Hisobdan chiqish</button>
  `;
}

/* ==================== Modallar ==================== */
function openModal(html) {
  $('#modal-sheet').innerHTML = html;
  $('#modal-overlay').hidden = false;
}
function closeModal() {
  $('#modal-overlay').hidden = true;
  $('#modal-sheet').innerHTML = '';
  state.editor = null;
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

    <label class="field-label" for="f-gfee">Oylik to'lov (so'm)</label>
    <input class="input" id="f-gfee" inputmode="numeric" placeholder="500 000" />

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

    <label class="field-label" for="f-sphone">Telefon raqami</label>
    <input class="input" id="f-sphone" data-phone type="tel" inputmode="tel" placeholder="+998 XX XXX-XX-XX" />

    <label class="field-label" for="f-sparent">Ota-ona telefon raqami</label>
    <input class="input" id="f-sparent" data-phone type="tel" inputmode="tel" placeholder="+998 XX XXX-XX-XX" />

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

    <button type="button" class="btn btn-primary btn-block" data-act="save-student">Saqlash</button>
  `);
}

function saveGroup() {
  const name = ($('#f-gname').value || '').trim();
  const days = $$('input:checked', $('#f-days')).map(i => i.value);
  const time = $('#f-gtime').value;
  const fee = Number(($('#f-gfee').value || '').replace(/\D/g, ''));

  if (!name) { toast("Guruh nomini kiriting", 'error'); $('#f-gname').focus(); return; }
  if (!days.length) { toast("Dars kunlarini tanlang", 'error'); return; }
  if (!time) { toast("Dars vaqtini kiriting", 'error'); return; }
  if (!fee) { toast("Oylik to'lovni kiriting (so'm)", 'error'); $('#f-gfee').focus(); return; }

  const groups = getGroups();
  groups.push({ id: 'g' + Date.now(), name, days: days.join(', '), time, fee });
  store.set(K.groups, groups);
  closeModal();
  render();
  toast("Guruh qo'shildi ✓");
}

function saveStudent() {
  const name = ($('#f-sname').value || '').trim();
  const phone = normPhone($('#f-sphone').value);
  const parent = normPhone($('#f-sparent').value);
  const cls = $('#f-sclass').value;
  const gid = $('#f-sgroup').value;

  if (name.length < 3) { toast("Ism familiyani kiriting", 'error'); $('#f-sname').focus(); return; }
  if (!isValidPhone(phone)) { toast("Telefon raqamni tekshiring: +998 XX XXX-XX-XX", 'error'); $('#f-sphone').focus(); return; }
  if (!isValidPhone(parent)) { toast("Ota-ona raqamini tekshiring: +998 XX XXX-XX-XX", 'error'); $('#f-sparent').focus(); return; }
  if (!cls) { toast("Maktab sinfini tanlang", 'error'); return; }
  if (!gid) { toast("Guruhni tanlang", 'error'); return; }

  const students = getStudents();
  students.push({
    id: 's' + Date.now(),
    fullName: name,
    phone: formatPhone(phone),
    parentPhone: formatPhone(parent),
    schoolClass: cls,
    groupId: gid
  });
  store.set(K.students, students);
  closeModal();
  render();
  toast("O'quvchi qo'shildi ✓");
}

/* ==================== BAHOLAR JURNALI (faqat ustoz) ==================== */
function ensureGradeState() {
  const groups = getGroups();
  if (!groups.some(g => g.id === state.gradeGroup)) {
    state.gradeGroup = groups.length ? groups[0].id : '';
  }
  const dates = lessonDates(state.gradeGroup, 5);
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
  if (!groups.length) return `<div class="screen-head"><h2 class="screen-title">Baholar</h2></div>` + emptyState("Avval guruh yarating");

  const dates = lessonDates(state.gradeGroup, 5);
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
    <button type="button" class="btn btn-primary btn-sm" data-act="open-attendance" data-group="${state.gradeGroup}">🗓️ Davomat</button>
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
      <tbody>${body || `<tr><td class="bj-name" colspan="${dates.length + 1}">${esc("Bu sinfda o'quvchi yo'q")}</td></tr>`}</tbody>
    </table>
  </div>

  <div class="legend">
    <span><i style="background:#1f9d5b"></i> 8–10 A'lo</span>
    <span><i style="background:#2f8fef"></i> 6–7 Yaxshi</span>
    <span><i style="background:#e5484d"></i> 1–5 Qoniqarsiz</span>
  </div>
  <p class="muted small" style="margin-top:10px">Baho qo'yish uchun katakchaga bosing.</p>
  `;
}

/* ---- Baho editori ---- */
function renderGradeEditor() {
  const e = state.editor;
  if (!e) return;
  const st = getStudents().filter(s => s.id === e.sid)[0];
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
  if (!groups.length) return `<div class="screen-head"><h2 class="screen-title">Davomat</h2></div>` + emptyState("Avval guruh yarating");

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
      <h2 class="screen-title">Davomat</h2>
      <div class="muted small">${marked}/${students.length} belgilandi</div>
    </div>
    <button type="button" class="btn btn-ghost btn-sm" data-act="nav" data-screen="grades">📊 Baholar</button>
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

/* ==================== Auth mantiqi ==================== */
function doLogin() {
  const input = $('#phone-input');
  const err = $('#phone-error');
  const key = normPhone(input.value);

  if (!isValidPhone(key)) {
    if (err) { err.textContent = "Raqamni to'g'ri kiriting: +998 XX XXX-XX-XX"; err.classList.add('show'); }
    input.focus();
    return;
  }
  if (err) { err.textContent = ''; err.classList.remove('show'); }

  const u = users[key];
  if (!u) {
    state.pendingPhone = key;
    state.pendingRole = null;
    go('register');
    return;
  }
  if (u.ownerId === currentAccountId()) {
    startSession(key);
    toast('Xush kelibsiz! 👋');
    return;
  }
  state.pendingPhone = key;
  go('pin-login');
}

function toPinCreate() {
  if (!state.pendingRole) {
    const el = $('#role-error');
    if (el) { el.textContent = 'Rolni tanlang'; el.classList.add('show'); }
    return;
  }
  state.pendingPin = '';
  go('pin-create');
}

function submitPin(mode) {
  const val = pinValue();
  if (!/^\d{4}$/.test(val)) { pinError("4 ta raqamli PIN kiriting"); return; }

  if (mode === 'create') {
    state.pendingPin = val;
    clearPin();
    go('pin-confirm');
    return;
  }

  if (mode === 'confirm') {
    if (val !== state.pendingPin) {
      pinError('PIN mos kelmadi, qaytadan kiriting');
      clearPin();
      return;
    }
    const key = state.pendingPhone;
    users[key] = {
      phoneKey: key,
      phone: formatPhone(key),
      role: state.pendingRole || 'student',
      pin: state.pendingPin,
      ownerId: currentAccountId(),
      name: (tgUser && tgUser.first_name) || (state.pendingRole === 'teacher' ? 'Ustoz' : "O'quvchi"),
      createdAt: Date.now()
    };
    persistUsers();
    state.pendingPin = '';
    startSession(key);
    toast("Hisob yaratildi ✓");
    return;
  }

  if (mode === 'verify') {
    const u = users[state.pendingPhone];
    if (!u || val !== u.pin) {
      pinError("PIN kod noto'g'ri");
      clearPin();
      return;
    }
    startSession(state.pendingPhone);
    toast('Xush kelibsiz! 👋');
  }
}

function switchAccount() {
  const cur = currentAccountId();
  if (cur === 'demo-1') state.demoAccount = 'demo-2';
  else if (cur === 'demo-2') state.demoAccount = 'demo-1';
  else state.demoAccount = 'alt-' + cur;

  store.del(K.session);
  state.pendingPhone = '';
  state.pendingRole = null;
  state.screen = 'login';
  render();
  toast('Hisob almashtirildi: ' + currentAccountId());
}

function logout() {
  store.del(K.session);
  state.demoAccount = null;
  state.pendingPhone = '';
  state.pendingRole = null;
  state.pendingPin = '';
  state.attDraft = null;
  state.attDraftFor = '';
  state.editor = null;
  closeModal();
  go('login');
  toast('Hisobdan chiqdingiz');
}

/* ==================== Jurnal seed (birinchi ishga tushirish) ==================== */
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

/* ==================== Render ==================== */
const SCREENS = {
  'login': loginScreen,
  'register': registerScreen,
  'pin-create': pinCreateScreen,
  'pin-confirm': pinConfirmScreen,
  'pin-login': pinLoginScreen,
  'home': homeScreen,
  'groups': groupsScreen,
  'students': studentsScreen,
  'grades': gradesScreen,
  'attendance': attendanceScreen,
  'profile': profileScreen
};

/* Xavfsizlik chegarasi: noto'g'ri rol o'ziga tegishli bo'lmagan ekranga kira olmaydi */
function canAccess(scr) {
  if (AUTH_SCREENS.indexOf(scr) >= 0) return true;
  if (scr === 'home' || scr === 'profile') return true;
  if (TEACHER_SCREENS.indexOf(scr) >= 0) return isTeacher();
  return false;
}

function render() {
  let scr = state.screen;
  if (!canAccess(scr)) {
    state.screen = 'home';
    scr = 'home';
  }
  document.body.classList.toggle('auth-mode', AUTH_SCREENS.indexOf(scr) >= 0);
  $('#app-header').innerHTML = renderHeader();
  $('#bottom-nav').innerHTML = renderNav();
  $('#screen').innerHTML = (SCREENS[scr] || loginScreen)();
  if (scr === 'students') refreshStudentList();
  if (scr === 'grades') ensureGradeState();
  if (scr === 'attendance') ensureAttState();
}

/* ==================== Hodisalar ==================== */
document.addEventListener('click', function (e) {
  const btn = e.target && e.target.closest ? e.target.closest('[data-act]') : null;
  if (!btn) return;
  const act = btn.getAttribute('data-act');

  const actions = {
    'do-login': doLogin,
    'switch-account': switchAccount,
    'select-role': function () {
      state.pendingRole = btn.getAttribute('data-role');
      render();
    },
    'to-pin-create': toPinCreate,
    'submit-pin': function () { submitPin(btn.getAttribute('data-mode')); },
    'restart-auth': function () {
      state.pendingPhone = '';
      state.pendingRole = null;
      state.pendingPin = '';
      go('login');
    },
    'nav': function () { go(btn.getAttribute('data-screen')); },
    'filter-class': function () {
      state.filterClass = btn.getAttribute('data-class');
      render();
    },
    'open-add-group': openAddGroup,
    'open-add-student': openAddStudent,
    'close-modal': closeModal,
    'save-group': saveGroup,
    'save-student': saveStudent,
    'logout': logout,

    /* --- Baholar jurnali --- */
    'grade-group': function () {
      state.gradeGroup = btn.getAttribute('data-group');
      state.gradeDate = '';
      render();
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
      }
      state.editor.score = null;
      renderGradeEditor();
      toast('Baho o\'chirildi');
    },
    'close-grade': function () {
      closeModal();
      render();
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
      all[state.attDate] = Object.assign({}, state.attDraft || {});
      store.set(K.attendance, all);
      state.attDraftFor = state.attDate;
      const n = Object.keys(all[state.attDate]).length;
      toast(n ? "Davomat saqlandi ✓ (" + n + " ta)" : "Davomat saqlandi (bo'sh)");
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
  if (t.id === 'phone-input' || (t.hasAttribute && t.hasAttribute('data-phone'))) {
    t.value = formatPhone(t.value);
  } else if (t.id === 'pin-input') {
    t.value = t.value.replace(/\D/g, '').slice(0, 4);
    updateDots();
  } else if (t.id === 's-search') {
    state.search = t.value;
    refreshStudentList();
  } else if (t.id === 'f-gfee') {
    t.value = t.value.replace(/\D/g, '').slice(0, 12);
  } else if (t.id === 'grade-note') {
    if (state.editor) {
      state.editor.note = t.value;
      if (state.editor.score != null) persistEditor(true);
    }
  }
});

document.addEventListener('change', function (e) {
  const t = e.target;
  if (t && t.id === 'att-date' && t.value) {
    state.attDate = t.value;
    render();
  }
});

document.addEventListener('keydown', function (e) {
  if (e.target && e.target.id === 'pin-input' && e.key === 'Enter') {
    const btn = $('[data-act="submit-pin"]');
    if (btn) btn.click();
  }
});

$('#modal-overlay').addEventListener('click', function (e) {
  if (e.target && e.target.id === 'modal-overlay') { closeModal(); render(); }
});

/* ==================== Ishga tushirish ==================== */
(function init() {
  seedJournal();
  const s = getSession();
  if (s && users[s.phoneKey] && users[s.phoneKey].ownerId === currentAccountId()) {
    state.screen = 'home';
  } else if (s) {
    store.del(K.session);
  }
  render();
})();
