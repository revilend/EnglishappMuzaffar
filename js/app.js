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

const K = { users: 'et_users', session: 'et_session', groups: 'et_groups', students: 'et_students' };

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
  toastTimer: null
};

const AUTH_SCREENS = ['login', 'register', 'pin-create', 'pin-confirm', 'pin-login'];

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

/* ---- Hisob (Telegram account) ---- */
function currentAccountId() {
  return state.demoAccount || (tgUser ? String(tgUser.id) : 'demo-1');
}
function getSession() { return store.get(K.session, null); }
function currentUser() {
  const s = getSession();
  return s && users[s.phoneKey] ? users[s.phoneKey] : null;
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
  profile: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.6"/><path d="M4.5 20.5c0-3.7 3.3-6.2 7.5-6.2s7.5 2.5 7.5 6.2"/></svg>'
};

/* ==================== Header / Bottom nav ==================== */
function scrLabel(s) {
  return { home: 'Bosh sahifa', groups: 'Guruhlar', students: "O'quvchilar", profile: 'Profil' }[s] || '';
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
function renderNav() {
  if (AUTH_SCREENS.indexOf(state.screen) >= 0) return '';
  const items = [
    ['home', 'Bosh', ICON.home],
    ['groups', 'Guruhlar', ICON.groups],
    ['students', "O'quvchilar", ICON.students],
    ['profile', 'Profil', ICON.profile]
  ];
  return items.map(it => {
    const active = state.screen === it[0] ? ' active' : '';
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
          <small>Guruhlarni boshqaradi, o'quvchi qo'shadi</small>
        </button>
        <button type="button" class="role-card ${state.pendingRole === 'student' ? 'selected' : ''}" data-act="select-role" data-role="student">
          <span class="role-emoji">🎓</span>
          <strong>O'quvchi</strong>
          <small>Darslar va guruhlarni ko'radi</small>
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

/* ==================== Asosiy ekranlar ==================== */
function emptyState(text) {
  return `<div class="empty"><span class="emoji">📭</span>${esc(text)}</div>`;
}

function homeScreen() {
  const u = currentUser() || {};
  const groups = getGroups();
  const students = getStudents();
  const classSet = {};
  students.forEach(s => { classSet[s.schoolClass] = 1; });
  const name = u.name || (tgUser && tgUser.first_name) || "Do'st";
  const recent = students.slice(0, 3);

  return `
  <section class="card">
    <div class="greet-main">
      <div class="avatar avatar-lg">${esc(initials(name))}</div>
      <div class="col">
        <div class="greet-hi">Assalomu alaykum!</div>
        <div class="greet-name">${esc(name)}</div>
        <span class="role-badge ${u.role === 'teacher' ? 'is-teacher' : 'is-student'}">${u.role === 'teacher' ? 'Ustoz' : "O'quvchi"}</span>
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
    <button type="button" class="card quick" data-act="nav" data-screen="groups"><span class="quick-ico">👥</span><span>Guruhlar</span></button>
    <button type="button" class="card quick" data-act="nav" data-screen="students"><span class="quick-ico">🧒</span><span>O'quvchilar</span></button>
    ${u.role === 'teacher'
      ? `<button type="button" class="card quick" data-act="open-add-student"><span class="quick-ico">➕</span><span>O'quvchi qo'shish</span></button>
         <button type="button" class="card quick" data-act="open-add-group"><span class="quick-ico">📅</span><span>Guruh qo'shish</span></button>`
      : `<button type="button" class="card quick" data-act="nav" data-screen="profile"><span class="quick-ico">👤</span><span>Profil</span></button>`}
  </div>

  <div class="section-title">So'nggi o'quvchilar</div>
  ${recent.length ? recent.map(studentCard).join('') : emptyState("Hozircha o'quvchi yo'q")}
  <button type="button" class="btn btn-ghost btn-block" data-act="nav" data-screen="students">Barchasini ko'rish</button>
  `;
}

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
  </div>`;
}

function groupsScreen() {
  const groups = getGroups();
  const students = getStudents();
  const u = currentUser() || {};
  return `
  <div class="screen-head">
    <div>
      <h2 class="screen-title">Guruhlar</h2>
      <div class="muted small">${groups.length} ta guruh</div>
    </div>
    ${u.role === 'teacher' ? `<button type="button" class="btn btn-primary btn-sm" data-act="open-add-group">+ Guruh</button>` : ''}
  </div>
  ${groups.length ? groups.map(g => groupCard(g, students)).join('') : emptyState("Hozircha guruh yo'q")}
  `;
}

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
  const u = currentUser() || {};
  const chips = ['Barchasi'].concat(APP_DATA.classes);
  return `
  <div class="screen-head">
    <div>
      <h2 class="screen-title">O'quvchilar</h2>
      <div class="muted small" id="students-count"></div>
    </div>
    ${u.role === 'teacher' ? `<button type="button" class="btn btn-primary btn-sm" data-act="open-add-student">+ Qo'shish</button>` : ''}
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

function profileScreen() {
  const u = currentUser() || {};
  return `
  <div class="card profile-head">
    <div class="avatar avatar-xl">${esc(initials(u.name || 'U'))}</div>
    <div class="profile-name">${esc(u.name || '')}</div>
    <div class="muted">${esc(u.phone || '')}</div>
    <div style="margin-top:9px">
      <span class="role-badge ${u.role === 'teacher' ? 'is-teacher' : 'is-student'}">${u.role === 'teacher' ? 'Ustoz' : "O'quvchi"}</span>
    </div>
  </div>

  <div class="section-title">Xavfsizlik</div>
  <div class="card list-card">
    <div class="list-row"><span>PIN kod</span><span class="muted">••••</span></div>
    <div class="list-row"><span>Telegram hisobi</span><code>${esc(currentAccountId())}</code></div>
  </div>

  <div class="section-title">Demo rejim</div>
  <div class="card">
    <p class="muted small">Boshqa Telegram hisobida kirilganda tizim PIN so'raydi — shu tugma bilan simulyatsiya qilinadi.</p>
    <button type="button" class="btn btn-ghost btn-block" data-act="switch-account">Boshqa hisobda sinash</button>
  </div>

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
}

function openAddGroup() {
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
  go('login');
  toast('Hisobdan chiqdingiz');
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
  'profile': profileScreen
};

function render() {
  const scr = state.screen;
  document.body.classList.toggle('auth-mode', AUTH_SCREENS.indexOf(scr) >= 0);
  $('#app-header').innerHTML = renderHeader();
  $('#bottom-nav').innerHTML = renderNav();
  $('#screen').innerHTML = (SCREENS[scr] || loginScreen)();
  if (scr === 'students') refreshStudentList();
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
    'logout': logout
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
  }
});

document.addEventListener('keydown', function (e) {
  if (e.target && e.target.id === 'pin-input' && e.key === 'Enter') {
    const btn = $('[data-act="submit-pin"]');
    if (btn) btn.click();
  }
});

$('#modal-overlay').addEventListener('click', function (e) {
  if (e.target && e.target.id === 'modal-overlay') closeModal();
});

/* ==================== Ishga tushirish ==================== */
(function init() {
  const s = getSession();
  if (s && users[s.phoneKey] && users[s.phoneKey].ownerId === currentAccountId()) {
    state.screen = 'home';
  } else if (s) {
    store.del(K.session);
  }
  render();
})();
