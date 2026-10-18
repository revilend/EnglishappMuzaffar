'use strict';
/* Step 3 — interaktiv smoke-test: haqiqiy DOM'da butun oqimni boshqaramiz. */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
  .replace(/<script src="https:\/\/telegram\.org[^"]*"><\/script>/, '');

let failed = 0;
function check(cond, msg) {
  if (cond) console.log('ok   - ' + msg);
  else { failed++; console.error('FAIL - ' + msg); }
}

const dataJs = fs.readFileSync(path.join(root, 'js', 'data.js'), 'utf8');
const appJs = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');

/* ============ TEST FIXTURE (faqat test uchun — ilovada demo seed YO'Q) ============ */
const F_DAYS = ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba'];
const F_GROUPS = [
  { id: 'g1', name: 'IELTS Band 7.0', days: 'Dushanba, Chorshanba, Juma', time: '18:00' },
  { id: 'g2', name: 'General English (8–10-sinf)', days: 'Seshanba, Payshanba', time: '17:00' }
];
const F_STUDENTS = [
  { id: 's1', fullName: 'Aziz Rahimov', schoolClass: '9-sinf', groupId: 'g2', speakingDebt: 0, audioSubmissions: [] },
  { id: 's2', fullName: 'Nilufar Ergasheva', schoolClass: '9-sinf', groupId: 'g2', speakingDebt: 0, audioSubmissions: [] },
  { id: 's3', fullName: 'Jasur Karimov', schoolClass: '8-sinf', groupId: 'g2', speakingDebt: 0, audioSubmissions: [] },
  { id: 's4', fullName: 'Dilnoza Qodirova', schoolClass: '10-sinf', groupId: 'g2', speakingDebt: 0, audioSubmissions: [] },
  { id: 's5', fullName: 'Malika Yusupova', schoolClass: '11-sinf', groupId: 'g1', speakingDebt: 0, audioSubmissions: [] },
  { id: 's6', fullName: 'Bekzod Alimov', schoolClass: '11-sinf', groupId: 'g1', speakingDebt: 0, audioSubmissions: [] }
];
const F_ACCOUNTS = [
  { login: 'm_amirov', password: '123', role: 'teacher', name: 'Muzaffar Amirov' },
  { login: 'aziz', password: '123', role: 'student', studentId: 's1', name: 'Aziz Rahimov' },
  { login: 'nilufar', password: '123', role: 'student', studentId: 's2', name: 'Nilufar Ergasheva' },
  { login: 'jasur', password: '123', role: 'student', studentId: 's3', name: 'Jasur Karimov' },
  { login: 'dilnoza', password: '123', role: 'student', studentId: 's4', name: 'Dilnoza Qodirova' },
  { login: 'malika', password: '123', role: 'student', studentId: 's5', name: 'Malika Yusupova' },
  { login: 'bekozd', password: '123', role: 'student', studentId: 's6', name: 'Bekzod Alimov' }
];
const F_GRADE_SEEDS = {
  s1: [10, 9, 8, 10, 9], s2: [9, 8, 9, 7, 8], s3: [6, 7, 5, 8, 7],
  s4: [8, 9, 10, 9, 10], s5: [9, 10, 9, 10, 8], s6: [7, 6, 8, 7, 9]
};
const F_ATT_SEEDS = {
  s1: ['present', 'present', 'present', 'present', 'present'],
  s2: ['present', 'present', 'excused', 'present', 'present'],
  s3: ['present', 'absent', 'present', 'present', 'absent'],
  s4: ['present', 'present', 'present', 'present', 'present'],
  s5: ['present', 'excused', 'present', 'present', 'present'],
  s6: ['absent', 'present', 'present', 'absent', 'present']
};
const fpad2 = n => String(n).padStart(2, '0');
const dkey = d => d.getFullYear() + '-' + fpad2(d.getMonth() + 1) + '-' + fpad2(d.getDate());

function fixtureLessonDates(group, count) {
  const names = String(group.days).split(',').map(x => x.trim());
  const jsDays = names.map(n => F_DAYS.indexOf(n)).filter(i => i >= 0).map(i => (i + 1) % 7);
  const out = [];
  const cur = new Date();
  cur.setHours(0, 0, 0, 0);
  let guard = 0;
  while (out.length < count && guard++ < 400) {
    if (jsDays.indexOf(cur.getDay()) >= 0) out.push(dkey(cur));
    cur.setDate(cur.getDate() - 1);
  }
  return out.reverse();
}

function seedFixture(w) {
  const grades = {}, att = {};
  F_STUDENTS.forEach(st => {
    const g = F_GROUPS.filter(x => x.id === st.groupId)[0];
    const dates = fixtureLessonDates(g, 5);
    const scores = F_GRADE_SEEDS[st.id] || [];
    const attSeed = F_ATT_SEEDS[st.id] || [];
    const cats = ['Darsdagi javob', "Lug'at", 'Uyga vazifa'];
    dates.forEach((dk, i) => {
      if (i < scores.length) {
        grades[st.id] = grades[st.id] || {};
        grades[st.id][dk] = { score: scores[i], category: cats[i % cats.length], note: '' };
      }
      if (i < attSeed.length) {
        att[dk] = att[dk] || {};
        att[dk][st.id] = attSeed[i];
      }
    });
  });
  const today = dkey(new Date());
  const speaking = [
    { id: 'spseed1', date: today, start: '14:00', end: '14:20', studentId: 's5', score: null },
    { id: 'spseed2', date: today, start: '14:20', end: '14:40', studentId: 's6', score: null },
    { id: 'spseed3', date: today, start: '14:40', end: '15:00', studentId: null, score: null }
  ];
  const accounts = {};
  F_ACCOUNTS.forEach(a => { accounts[a.login] = Object.assign({}, a, { studentId: a.studentId || null }); });
  w.localStorage.setItem('et_groups', JSON.stringify(F_GROUPS));
  w.localStorage.setItem('et_students', JSON.stringify(F_STUDENTS));
  w.localStorage.setItem('et_accounts', JSON.stringify(accounts));
  w.localStorage.setItem('et_grades', JSON.stringify(grades));
  w.localStorage.setItem('et_attendance', JSON.stringify(att));
  w.localStorage.setItem('et_speaking', JSON.stringify(speaking));
}

/* ============ 0. TOZA START — demo seed YO'qligi (yangi, bo'sh qurilma) ============ */
{
  const fdom = new JSDOM(html, { url: 'http://localhost:3000/', runScripts: 'outside-only', pretendToBeVisual: true });
  const fwin = fdom.window;
  const fdoc = fwin.document;
  const fq = s => fdoc.querySelector(s);
  const fqa = s => Array.from(fdoc.querySelectorAll(s));
  const ftext = () => fq('#screen').textContent;
  fwin.eval(dataJs + '\nwindow.APP_DATA = APP_DATA;');
  fwin.eval(appJs);
  const fclick = el => el.dispatchEvent(new fwin.MouseEvent('click', { bubbles: true, cancelable: true }));
  const fset = (s, v) => { const el = fq(s); el.value = v; el.dispatchEvent(new fwin.Event('input', { bubbles: true })); };
  const fnav = scr => {
    const b = fdoc.createElement('button');
    b.setAttribute('data-act', 'nav');
    b.setAttribute('data-screen', scr);
    fdoc.body.appendChild(b);
    fclick(b);
    b.remove();
  };

  check(!fq('.hint-card') && !ftext().includes('Demo') && !fq('.login-demo'),
    'toza start: login ekranida demo kart/chiplar YO\'Q');
  fset('#login-input', 'm_amirov');
  fset('#password-input', '123');
  fclick(fq('[data-act="do-login"]'));
  check(ftext().includes('Xush kelibsiz') && ftext().includes('Muzaffar Amirov'),
    'toza start: "Xush kelibsiz, Muzaffar Amirov!" salomi');
  fnav('groups');
  check(fqa('.group-card').length === 0 && ftext().includes("Hozircha guruh yo'q"),
    "toza start: demo guruhlar avtomatik SEED qilinmaydi (0 ta)");
  fnav('students');
  check(fqa('.student-card').length === 0 && !ftext().includes('Aziz Rahimov'),
    "toza start: demo o'quvchilar avtomatik SEED qilinmaydi (0 ta)");
}

/* ============ Asosiy qurilma (test fixture bilan) ============ */
const dom = new JSDOM(html, { url: 'http://localhost:3000/', runScripts: 'outside-only', pretendToBeVisual: true });
const win = dom.window;
const doc = win.document;

win.eval(dataJs + '\nwindow.APP_DATA = APP_DATA;');
seedFixture(win);
win.eval(appJs);

const q = sel => doc.querySelector(sel);
const qa = sel => Array.from(doc.querySelectorAll(sel));
const text = () => q('#screen').textContent;
const click = el => { const node = typeof el === 'string' ? q(el) : el; if (!node) throw new Error('click: topilmadi -> ' + el); node.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true })); };
const clickAct = act => click(q('[data-act="' + act + '"]'));
const setVal = (sel, val) => { const el = q(sel); if (!el) throw new Error('setVal: ' + sel + ' topilmadi'); el.value = val; el.dispatchEvent(new win.Event('input', { bubbles: true })); };
const changeVal = (sel, val) => { const el = q(sel); if (!el) throw new Error('changeVal: ' + sel + ' topilmadi'); el.value = val; el.dispatchEvent(new win.Event('change', { bubbles: true })); };
const forceNav = screen => {
  const b = doc.createElement('button');
  b.setAttribute('data-act', 'nav');
  b.setAttribute('data-screen', screen);
  doc.body.appendChild(b);
  click(b);
  b.remove();
};
const navLabels = () => qa('.nav-item span').map(s => s.textContent);
const studentCards = () => qa('#students-list .student-card').length;
const groupCards = () => qa('#screen .group-card').length;
function logout() { click('[data-act="nav"][data-screen="profile"]'); clickAct('logout'); }
function loginAs(l, p) {
  setVal('#login-input', l);
  setVal('#password-input', p);
  clickAct('do-login');
}

const now = new Date();
const pad2 = n => String(n).padStart(2, '0');
const TODAY = now.getFullYear() + '-' + pad2(now.getMonth() + 1) + '-' + pad2(now.getDate());

/* ================= 1. KIRISH EKRANI ================= */
check(text().includes('English Tutor'), 'login: sarlavha "English Tutor"');
check(!!q('#login-input'), 'login: Login inputi mavjud');
check(!!q('#password-input'), 'login: Parol inputi mavjud');
check(text().includes('Kirish'), 'login: "Kirish" tugmasi');
check(q('#app-header').textContent.includes('English Tutor'), 'header: ilova nomi');
check(qa('.nav-item').length === 0, 'login rejimida bottom nav yo\'q');
check(!q('.hint-card') && !text().includes('Demo kirish') && !text().includes('Demo') && !q('.login-demo'), "login: demo credentials kartasi/chiplari olib tashlandi");
check(q('#login-input').placeholder === 'Login' && q('#login-input').placeholder.indexOf('admin') < 0,
  "login: placeholder'da demo logini yo'q");
check(!text().includes('Ustoz Paneli') && !text().includes('Ustoz:'), "login: 'Ustoz Paneli'/demo yozuvlari yo'q");
check(!text().includes('Ustoz: admin') && !text().includes("O'quvchi: jasur"), "login: login/parollar endi ko'rinmaydi");
const pwBtnLogin = q('[data-act="toggle-pw"][data-target="password-input"]');
check(!!pwBtnLogin && !!pwBtnLogin.querySelector('svg'), "login: parol ko'zgusi tugmasi SVG ikonka");
if (pwBtnLogin) {
  click(pwBtnLogin);
  check(q('#password-input').type === 'text', "login: ko'zgusi bosildi — parol ko'rindi");
  click(pwBtnLogin);
  check(q('#password-input').type === 'password', "login: qayta bosildi — parol yashirildi");
}

/* bo'sh forma */
clickAct('do-login');
check(q('#login-error').classList.contains('show'), 'login: bo\'sh forma rad etildi');

/* noto\'g\'ri parol */
loginAs('m_amirov', '999');
check(q('#login-error').textContent.includes("noto'g'ri"), 'login: noto\'g\'ri parol xabar bermoqda');
check(q('#password-input').value === '', 'login: noto\'g\'ri parol tozalanadi');

/* ================= 2. USTOZ (admin/123) ================= */
loginAs('m_amirov', '123');
check(text().includes('Xush kelibsiz') && text().includes('Muzaffar Amirov'), 'ustoz: dashboard salomi "Xush kelibsiz, Muzaffar Amirov!"');
check(q('#app-header').textContent.includes('Muzaffar Amirov'), 'ustoz: headerda "Muzaffar Amirov" brendi');
check(navLabels().length === 6, 'ustoz: 6 ta nav tabi (' + navLabels().join(', ') + ')');

/* --- Vektor ikonka tizimi: barcha emoji o'rniga SVG badge'lar --- */
check(qa('.quick-grid .quick-ico').length === 6, 'icon: TEZ AMALLAR gridida 6 ta ikonka badge');
check(qa('.quick-grid .quick-ico svg').length === 6, "icon: har bir badge ichida SVG (emoji o'rniga)");
check(['tint-indigo', 'tint-emerald', 'tint-sky', 'tint-amber', 'tint-purple', 'tint-slate']
  .every(t => qa('.quick-ico.' + t).length === 1),
  'icon: indigo/emerald/sky/amber/purple/slate tints har biri bittadan');
check(!!q('.screen-title svg') && !!q('.stat-ico svg'), 'icon: bo"lim sarlavhasi va status kartalari SVG ikonka');
check(!/[\u{1F300}-\u{1FAFF}]/u.test(q('#screen').textContent),
  "icon: dashboardda cartoon emoji qolmagan (faqat vektor ikonka)");

/* Moliyaviy ma'lumotlar UMUMAN yo'q */
check(!text().includes("so'm"), 'moliya: dashboardda narx yo\'q');
check(!text().includes("To'lov") && !text().includes('Narx'), 'moliya: to\'lov/narx kartasi yo\'q');

/* ================= 3. GURUHLAR ================= */
click('[data-act="nav"][data-screen="groups"]');
check(text().includes('Guruhlar'), 'guruhlar: ekran');
check(groupCards() === 2, 'guruhlar: 2 ta guruh');
check(text().includes('IELTS Band 7.0') && text().includes('18:00'), 'guruhlar: nom + dars vaqti');
check(!text().includes("so'm"), 'moliya: guruh kartasida narx yo\'q');

/* --- Guruh kartasini bosish → faqat shu guruh o'quvchilari --- */
click(qa('.group-card').filter(c => c.textContent.includes('IELTS Band 7.0'))[0]);
check(text().includes("O'quvchilar"), "guruh→o'quvchi: guruh kartasi bosilganda o'quvchilar ekrani ochildi");
check(studentCards() === 2, "guruh→o'quvchi: faqat IELTS guruhidagi 2 ta o'quvchi ko'rinadi");
check(!!q('[data-act="filter-group-all"]') && text().includes('Barcha o\'quvchilar'),
  "guruh→o'quvchi: 'Barcha o'quvchilar' reset tugmasi bor");
check(text().includes('IELTS Band 7.0 guruhidagi'), "guruh→o'quvchi: aktiv guruh nomi ko'rinadi");
clickAct('filter-group-all');
check(studentCards() === 6 && !q('[data-act="filter-group-all"]'),
  "guruh→o'quvchi: 'Barcha o'quvchilar' bosildi → filtr tozalandi (6 ta)");

/* ================= 4. O'QUVCHILAR ================= */
click('[data-act="nav"][data-screen="students"]');
check(text().includes("O'quvchilar"), 'o\'quvchilar: ekran');
check(studentCards() === 6, 'o\'quvchilar: 6 ta mock o\'quvchi');
check(text().includes('Jasur Karimov'), 'o\'quvchilar: ism ko\'rinadi');
check(text().includes('Login') && text().includes('jasur'), 'o\'quvchilar: login ko\'rinadi');
check(!text().includes('Ota-ona'), 'moliya/kontakt: ota-ona bloki yo\'q');
check(qa('[data-act="reset-pwd"]').length === 6, 'o\'quvchilar: har kartada "Parolni yangilash"');

/* sinf filtri */
click('[data-act="filter-class"][data-class="11-sinf"]');
check(studentCards() === 2, 'filtr: 11-sinf = 2 ta');
click('[data-act="filter-class"][data-class="Barchasi"]');
check(studentCards() === 6, 'filtr: Barchasi = 6 ta');

/* --- Jonli qidiruv (harf yozilishi bilan, Enter'siz) --- */  /* Redizayn: qidiruv ikonkasi placeholder'dan olib, CSS orqali input ichiga ko'chirildi */
  check(q('#s-search').placeholder === "O'quvchi ismini kiriting..." &&
    q('#s-search').placeholder.indexOf('🔍') < 0,
    "qidiruv: placeholder toza (ikonka endi emoji emas)");
  check(!!q('.search-wrap #s-search') && !!q('.chips .chip-btn'),
    "qidiruv: pill shakl + ichilgan qidiruv ikonkasi (.search-wrap) + chip'lar");
setVal('#s-search', 'Jas');
check(studentCards() === 1 && text().includes('Jasur Karimov'), "qidiruv: 1 ta harf yozildi → darhol filtr (Enter'siz)");
setVal('#s-search', 'ma');
check(text().includes('Malika Yusupova') && studentCards() >= 1, "qidiruv: davomiy qidiruv ishlaydi");
setVal('#s-search', '');
check(studentCards() === 6, "qidiruv: tozalandi → barcha o'quvchilar qaytdi");

/* ================= 5. YANGI O'QUVCHI + LOGIN/PAROL ================= */
clickAct('open-add-student');
check(q('#modal-overlay').hidden === false, 'modal: o\'quvchi qo\'shish ochildi');
clickAct('save-student');
check(q('#modal-overlay').hidden === false, 'validation: bo\'sh forma saqlanmaydi');

setVal('#f-sname', 'Gulnoza Ismoilova');
q('#f-sclass').value = '11-sinf';
q('#f-sgroup').value = 'g1';
setVal('#f-slogin', 'gulnoza');
setVal('#f-spass', '1234');
clickAct('save-student');
check(q('#modal-overlay').hidden === true, 'modal: saqlanib yopildi');
check(studentCards() === 7, 'o\'quvchilar: yangi o\'quvchi qo\'shildi (7 ta)');
check(text().includes('gulnoza'), 'o\'quvchilar: yangi login ko\'rinadi');

/* takrorlanuvchi login */
clickAct('open-add-student');
setVal('#f-sname', 'Test User');
q('#f-sclass').value = '9-sinf';
q('#f-sgroup').value = 'g2';
setVal('#f-slogin', 'jasur');
setVal('#f-spass', '1111');
clickAct('save-student');
check(q('#modal-overlay').hidden === false, 'validation: band login rad etildi');
click('[data-act="close-modal"]');

/* ================= 6. BAHOLAR JURNALI ================= */
click('[data-act="nav"][data-screen="grades"]');
check(text().includes('Baholar'), 'jurnal: ekran');
check(!!q('table.bj'), 'jurnal: jadval mavjud');
check(qa('.selector-row')[0].querySelectorAll('.chip-btn').length === 2, 'jurnal: guruh tanlagich (2 guruh)');
check(qa('thead .bj-date').length >= 5, 'jurnal: kamida 5 ta dars sanasi ustuni');
check(qa('thead .bj-sum').length === 1, 'jurnal: oxirida "O\'rtacha" ustuni');
check(text().includes('Jami:'), 'jurnal: jami ball hisoblanadi');
check(text().includes('8–10') && text().includes('6–7') && text().includes('1–5'), 'jurnal: rang legendasi');
check(qa('tbody tr').length === 3, 'jurnal: IELTS guruhida 3 ta qator (yangi o\'quvchi bilan)');

/* sana ustunini tanlash */
click(qa('[data-act="grade-date"]')[0]);
check(qa('.bj-date')[0].classList.contains('is-focus'), 'jurnal: sana ustuni belgilanadi');

/* 1-tap baho kiritish */
let target = qa('.bj-grade.g-empty')[0] || q('.bj-grade');
const tSid = target.getAttribute('data-sid');
const tDate = target.getAttribute('data-date');
const before = target.textContent.trim();
const want = before === '10' ? '1' : '10';
click(target);
check(q('#modal-overlay').hidden === false, 'editor: modal ochildi');
check(qa('.score-btn').length === 10, 'editor: 10 ta ball tugmasi');
check(qa('.cat-wrap .chip-btn').length === 3, 'editor: 3 ta vazifa turi (Darsdagi javob, Lug\'at, Uyga vazifa)');
check(!!q('#grade-note'), 'editor: izoh maydoni');
click(qa('.score-btn').filter(b => b.getAttribute('data-score') === want)[0]);
check(q('.editor-info .gr-score').textContent.trim() === want, 'editor: ball tanlandi');
click(qa('.cat-wrap .chip-btn')[2]);
click(q('[data-act="close-grade"]'));
const newCell = q('[data-act="edit-grade"][data-sid="' + tSid + '"][data-date="' + tDate + '"]');
check(newCell && newCell.textContent.trim() === want, 'jurnal: baho saqlandi (' + want + ')');
check(newCell && newCell.classList.contains('g-num'), "jurnal: neytral g-num klassi (rangli badge yo'q)");
check(newCell && !newCell.classList.contains('g-a') && !newCell.classList.contains('g-b') && !newCell.classList.contains('g-c'), "jurnal: eski rangli klasslar (g-a/g-b/g-c) qolmagan");

/* sinf filtri jurnalda */
const rowsBefore = qa('tbody tr').length;
click(qa('.selector-row')[1].querySelectorAll('.chip-btn')[5]);
check(qa('tbody tr').length <= rowsBefore, 'jurnal: sinf filtri ishlaydi');
click(qa('.selector-row')[1].querySelectorAll('.chip-btn')[0]);
check(qa('tbody tr').length === rowsBefore, 'jurnal: "Barchasi" qaytardi');

/* ================= 7. TEZKOR DAVOMAT ================= */
click('[data-act="nav"][data-screen="attendance"]');
check(text().includes('davomat') || text().includes('Davomat'), 'davomat: ekran');
check(q('#att-date').value === TODAY, 'davomat: sana bugungi sana');
check(qa('.att-row').length === 3, 'davomat: IELTS guruhida 3 ta o\'quvchi');
check(qa('.att-row')[0].querySelectorAll('.att-btn').length === 3, 'davomat: 3 ta holat tugmasi');
check(text().includes('Keldi') && text().includes('Kelmadi') && text().includes('Sababli'), 'davomat: tugma matunlari o\'zbekcha');

const active0 = qa('.att-row')[0].querySelector('.att-btn[class*="on-"]');
if (active0) click(active0);
check(!qa('.att-row')[0].querySelector('.att-btn[class*="on-"]'), 'davomat: holatni o\'chirish mumkin');
click(qa('.att-row')[0].querySelector('[data-status="absent"]'));
check(qa('.att-row')[0].querySelector('[data-status="absent"]').classList.contains('on-absent'), 'davomat: "Kelmadi" tanlandi');
const active1 = qa('.att-row')[1].querySelector('.att-btn[class*="on-"]');
if (active1) click(active1);
click(qa('.att-row')[1].querySelector('[data-status="present"]'));
check(qa('.att-row')[1].querySelector('[data-status="present"]').classList.contains('on-present'), 'davomat: "Keldi" tanlandi');
click('[data-act="att-save"]');
check(q('#toast').textContent.includes('Davomat saqlandi'), 'davomat: "Davomatni saqlash" tasdiq toast');

click('[data-act="nav"][data-screen="grades"]');
click('[data-act="nav"][data-screen="attendance"]');
check(qa('.att-row')[0].querySelector('[data-status="absent"]').classList.contains('on-absent'), 'davomat: saqlangan holat tiklandi');

/* ================= 8. SPEAKING SCHEDULER ================= */
click('[data-act="nav"][data-screen="speaking"]');
check(text().includes('Speaking'), 'speaking: ekran');
check(qa('.speak-row').length === 3, 'speaking: 3 ta seed slot');
check(text().includes('14:00 – 14:20'), 'speaking: slot vaqti');
check(text().includes('Bosh (tayinlanmagan)'), 'speaking: tayinlanmagan slot');

/* yangi slot yaratish */
clickAct('open-slot');
check(q('#modal-overlay').hidden === false, 'speaking: slot modali ochildi');
setVal('#sp-start', '16:00');
setVal('#sp-end', '15:00');
clickAct('save-slot');
check(q('#modal-overlay').hidden === false, 'speaking: noto\'g\'ri vaqt rad etildi');
setVal('#sp-end', '16:20');
q('#sp-student').value = 's2'; /* Nilufar */
clickAct('save-slot');
check(q('#modal-overlay').hidden === true, 'speaking: slot saqlandi');
check(text().includes('16:00 – 16:20'), 'speaking: yangi slot ro\'yxatda');
check(text().includes('Nilufar Ergasheva'), 'speaking: slotga o\'quvchi tayinlandi');

/* baholash → jurnalga sync */
const newRow = qa('.speak-row').filter(r => r.textContent.includes('16:00'))[0];
click(newRow.querySelector('[data-act="slot-score"]'));
check(q('#modal-overlay').hidden === false, 'speaking: baholash modali');
check(qa('.score-btn').length === 10, 'speaking: 10 ta ball tugmasi');
click(qa('.score-btn').filter(b => b.getAttribute('data-score') === '9')[0]);
check(q('#modal-overlay').hidden === true, 'speaking: baho saqlanib yopildi');
check(q('#toast').textContent.includes('jurnalga yozildi'), 'speaking: jurnalga sync toast');

/* jurnalda tekshirish (Nilufar g2 da) */
click('[data-act="nav"][data-screen="grades"]');
click('[data-act="grade-group"][data-group="g2"]');
const cells = qa('[data-act="edit-grade"][data-sid="s2"]');
const scoredCell = cells.filter(c => c.textContent.trim() === '9')[0];
check(!!scoredCell, 'speaking→jurnal: ball baholar jurnaliga tushdi');
check(qa('tbody tr').length === 4, 'jurnal: g2 da 4 ta o\'quvchi');

/* ================= 9. USTOZ: PAROL YANGILASH ================= */
click('[data-act="nav"][data-screen="students"]');
const nilCard = qa('.student-card').filter(c => c.textContent.includes('Nilufar Ergasheva'))[0];
click(nilCard.querySelector('[data-act="reset-pwd"]'));
check(q('#modal-overlay').hidden === false, 'reset: modal ochildi');
setVal('#rp-pass', '7777');
clickAct('save-reset');
check(q('#modal-overlay').hidden === true, 'reset: parol saqlandi');
check(q('#toast').textContent.includes('Parol yangilandi'), 'reset: tasdiq toast');

/* ================= 10. O'QUVCHI KABINETI (jasur/123) ================= */
logout();
check(text().includes('Login') && !!q('#login-input'), 'logout: login ekraniga qaytdi');
loginAs('jasur', '1234');
check(q('#login-error').classList.contains('show'), 'student: noto\'g\'ri parol rad etildi');
loginAs('jasur', '123');
check(text().includes('Jasur Karimov'), 'student: kabinet ochildi');
check(text().includes('8-sinf') && text().includes('General English'), 'student: sinf + guruh ko\'rsatildi');
check(q('#app-header').textContent.includes("O'quvchi"), 'student: headerda "O\'quvchi"');
check(navLabels().length === 2 && navLabels().join(',') === 'Kabinet,Profil', 'student: nav faqat Kabinet + Profil');

check(text().includes('Mening baholarim'), 'student: "Mening baholarim"');
check(qa('.grade-row').length > 0, 'student: baholar ro\'yxati bor');
check(!!q('.avg-badge') && /\d\.\d/.test(q('.avg-badge').textContent), 'student: "O\'rtacha baho" badge');
check(text().includes('Mening davomatim'), 'student: "Mening davomatim"');
check(text().includes('Speaking vaqtim'), 'student: "Speaking vaqtim"');
check(!text().includes("To'lov"), 'moliya: o\'quvchi kabinetida to\'lov kartasi yo\'q');
check(!text().includes("so'm"), 'moliya: o\'quvchi kabinetida narx yo\'q');

/* Boshqalarning ma'lumotlari KO'RINMASLIGI kerak */
check(!text().includes('Nilufar Ergasheva'), 'maxfiy: boshqa o\'quvchi ismi yo\'q');
check(!text().includes('Malika Yusupova'), 'maxfiy: boshqa o\'quvchi ismi yo\'q (2)');
check(!text().includes('Aziz Rahimov'), 'maxfiy: boshqa o\'quvchi ismi yo\'q (3)');
check(!text().includes('+998 97 222-33-44'), 'maxfiy: boshqa telefon yo\'q');
check(!text().includes('+998 95 700-80-90'), 'maxfiy: boshqa telefon yo\'q (2)');
check(!text().includes('Guruhlar') || !qa('.nav-item').some(n => n.getAttribute('data-screen') === 'groups'), 'maxfiy: guruhlar boshqaruvi yo\'q');

/* To'g'ridan-to'g'ri navigatsiya urinishi bloklandi */
forceNav('students');
check(qa('.student-card').length === 0, 'guard: o\'quvchi "O\'quvchilar"ga kira olmaydi');
forceNav('groups');
check(qa('.group-card').length === 0, 'guard: o\'quvchi "Guruhlar"ga kira olmaydi');
forceNav('grades');
check(qa('table.bj').length === 0, 'guard: o\'quvchi jurnalga kira olmaydi');
forceNav('attendance');
check(qa('.att-btn').length === 0, 'guard: o\'quvchi davomatga kira olmaydi');
forceNav('speaking');
check(qa('.speak-row').length === 0, 'guard: o\'quvchi speaking boshqaruvida yo\'q');
check(text().includes('Jasur Karimov'), 'guard: o\'quvchi o\'z kabinetida qoladi');

/* ================= 11. O'QUVCHI: PAROLNI O'ZGARTIRISH ================= */
click('[data-act="nav"][data-screen="profile"]');
check(text().includes('Parolni o\'zgartirish'), 'student: profilda parol o\'zgartirish tugmasi');
check(!!q('.list-row .login-val') && !q('.list-row code'), "login: profilda login oddiy matn — kod/badge yo'q");
clickAct('open-change-pwd');
check(q('#modal-overlay').hidden === false, 'change: modal ochildi');
check(!!q('#modal-sheet .login-val') && !q('#modal-sheet code'), "change: modalda login oddiy matn — monospace kod yo'q");
check(qa('.pw-toggle').length === 3, "change: 3 ta parol ko'zgusi tugmasi (eski/yangi/tasdiq)");
setVal('#cp-old', '999');
setVal('#cp-new', '4321');
setVal('#cp-new2', '4321');
clickAct('save-change-pwd');
check(q('#modal-overlay').hidden === false, 'change: noto\'g\'ri joriy parol rad etildi');
setVal('#cp-old', '123');
clickAct('save-change-pwd');
check(q('#modal-overlay').hidden === true, 'change: parol o\'zgartirildi');
check(q('#toast').textContent.includes("Parol o'zgartirildi"), 'change: tasdiq toast');

logout();
loginAs('jasur', '123');
check(q('#login-error').classList.contains('show'), 'change: eski parol bilan kirib bo\'lmaydi');
loginAs('jasur', '4321');
check(text().includes('Jasur Karimov'), 'change: yangi parol bilan kirdi');

/* ================= 12. USTOZ QAYTA KIRIB, YANGILANGAN PAROLNI TEKSHIRADI ================= */
logout();
loginAs('m_amirov', '123');
click('[data-act="nav"][data-screen="students"]');
check(text().includes('Nilufar Ergasheva'), 'ustoz: qayta kirdi');
check(!!q('.s-contact .login-val') && !q('.s-contact code'), "login: o'quvchi kartasida login oddiy matn — kod badge yo'q");
logout();

loginAs('nilufar', '7777');
check(text().includes('Nilufar Ergasheva'), 'reset: ustoz yangilagan parol bilan kirdi');
check(text().includes('9-sinf'), 'reset: Nilufar portali ko\'rinadi');
check(!text().includes('Jasur Karimov'), 'reset: boshqa o\'quvchi ko\'rinmaydi');

/* ================= 12b. USTOZ PAROLI — o'zgartirish + qat'iy qayta kirish ================= */
check(typeof win.__cloud.pushTeacherPassword === 'function',
  'ustoz paroli: CloudSync.pushTeacherPassword (bot_settings) eksport qilingan');
logout();
loginAs('m_amirov', '123');
click('[data-act="nav"][data-screen="profile"]');
clickAct('open-change-pwd');
setVal('#cp-old', '123');
setVal('#cp-new', '9111');
setVal('#cp-new2', '9111');
clickAct('save-change-pwd');
check(q('#modal-overlay').hidden === true && q('#toast').textContent.includes("Parol o'zgartirildi"),
  'ustoz paroli: o' + "'" + 'zgartirildi (bot_settings ga yoziladi)');
logout();
loginAs('m_amirov', '123');
check(q('#login-error').textContent.includes("noto'g'ri"),
  "ustoz paroli: eski '123' bilan KIRIB BO'LMAYDI");
loginAs('m_amirov', '9111');
check(text().includes('Xush kelibsiz') && text().includes('Muzaffar Amirov'),
  'ustoz paroli: yangi parol bilan kirdi');
/* keyingi bosqichlar uchun parolni 123 ga qaytaramiz */
click('[data-act="nav"][data-screen="profile"]');
clickAct('open-change-pwd');
setVal('#cp-old', '9111');
setVal('#cp-new', '123');
setVal('#cp-new2', '123');
clickAct('save-change-pwd');
logout();
loginAs('m_amirov', '123');
check(text().includes('Xush kelibsiz') && text().includes('Muzaffar Amirov'),
  'ustoz paroli: 123 ga qaytarildi — kirish ishlaydi');
logout();
loginAs('nilufar', '7777');
check(text().includes('Nilufar Ergasheva'), 'ustoz paroli: holat tiklandi (nilufar kirgan)');

/* ================= 13. STEP 4: YANGI FEATURE'LAR ================= */

/* --- 1. Telefon raqamlari butunlay yo'q --- */
logout();
loginAs('m_amirov', '123');
click('[data-act="nav"][data-screen="students"]');
check(!text().includes('+998'), 'telefon: o\'quvchi kartalarida telefon yo\'q');
check(!text().includes('Telefon'), 'telefon: "Telefon" yozuvi yo\'q');
clickAct('open-add-student');
check(!q('#f-sphone'), 'telefon: qo\'shish formasida telefon maydoni yo\'q');
check(!!q('#f-sname') && !!q('#f-sclass') && !!q('#f-slogin') && !!q('#f-spass'), 'forma: Ism + Sinf + Login + Parol mavjud');
check(!q('[data-phone]'), 'forma: data-phone atributi yo\'q');
check(q('#f-spass').type === 'password', "qo'shish: parol maydoni yashirin (type=password)");
check(!!q('[data-act="toggle-pw"][data-target="f-spass"]'), "qo'shish: parol ko'zgusi tugmasi");
click('[data-act="close-modal"]');

/* --- 2. Sinflar faqat 5–11 --- */
clickAct('open-add-student');
const clsOpts = Array.from(q('#f-sclass').options).map(o => o.value).filter(v => v);
check(JSON.stringify(clsOpts) === JSON.stringify(['5-sinf','6-sinf','7-sinf','8-sinf','9-sinf','10-sinf','11-sinf']),
  'sinf: forma variantlari faqat 5–11-sinf');
check(!clsOpts.includes('IELTS'), "sinf: IELTS varianti yo'q");
click('[data-act="close-modal"]');
const filterChips = qa('[data-act="filter-class"]').map(b => b.getAttribute('data-class'));
check(filterChips.includes('5-sinf') && filterChips.includes('11-sinf'), 'sinf: filtr chiplari 5–11 bor');
check(!filterChips.includes('IELTS') && !filterChips.includes('4-sinf'), "sinf: filtrda IELTS/4-sinf yo'q");

/* --- 3. Speaking qarzi (ustoz +/-) --- */
const nStud = JSON.parse(win.localStorage.getItem('et_students')).length;
check(qa('[data-act="debt-plus"]').length === nStud, 'qarz: ' + nStud + ' ta [+] tugma');
check(qa('[data-act="debt-minus"]').length === nStud, 'qarz: ' + nStud + ' ta [-] tugma');
check(text().includes('Speaking qarzi'), 'qarz: "Speaking qarzi" yozuvi ro\'yxatda');
click(qa('[data-act="debt-plus"]').filter(b => b.getAttribute('data-sid') === 's3')[0]);
check(qa('.debt-num').filter(d => d.textContent.trim() === '1 ta').length >= 1, 'qarz: [+] bosildi → 1 ta');
click(qa('[data-act="debt-minus"]').filter(b => b.getAttribute('data-sid') === 's3')[0]);
check(qa('.debt-num').filter(d => d.textContent.trim() === '0 ta').length >= 1, 'qarz: [-] bosildi → 0 ta');

/* Speaking ekranida ham qarz nazorati */
click('[data-act="nav"][data-screen="speaking"]');
check(text().includes('Speaking qarzi (o\'quvchilar)'), 'speaking: qarz ro\'yxati ekranda');
check(qa('[data-act="debt-plus"]').length === nStud, 'speaking: ' + nStud + ' ta [+] tugma');
check(text().includes('Telegram topshiriqlari'), 'speaking: Telegram inbox bo\'limi bor');
check(text().includes("Hozircha Telegram orqali topshirik yo'q"), 'speaking: inbox holati ko\'rinadi');

/* --- 4. Telegram topshirik → baholash → qarz -1 --- */
const studentsRaw = JSON.parse(win.localStorage.getItem('et_students'));
const jasurSt = studentsRaw.filter(x => x.id === 's3')[0];
jasurSt.speakingDebt = 2;
win.localStorage.setItem('et_students', JSON.stringify(studentsRaw));
win.localStorage.setItem('et_tg_subs', JSON.stringify([
  { id: 't1', dbId: 101, sid: 's3', mediaType: 'voice', status: 'kutilmoqda', score: null, feedback: '', createdAt: TODAY + 'T10:00:00.000Z' }
]));
forceNav('speaking');
check(qa('.audio-item').length >= 1, 'inbox: Telegram topshirik paydo bo\'ldi');
check(text().includes('Jasur Karimov'), 'inbox: o\'quvchi ismi ko\'rinadi');
check(text().includes('Ovozli xabar') && !!q('.audio-item__meta svg'),
  'inbox: media turi (voice) SVG ikonka bilan ko\'rinadi');
check(qa('[data-act="tg-grade"]').length === 10, 'inbox: 10 ta ball tugmasi');
check(q('[data-act="tg-feedback"]'), 'inbox: izoh maydoni mavjud');
check(!q('[data-act="rec-start"]') && !q('#recorder'), 'recorder: brauzer yozgich olib tashlangan');

setVal('[data-act="tg-feedback"]', "A'lo talaffuz");
click(qa('[data-act="tg-grade"]').filter(b => b.getAttribute('data-score') === '9')[0]);
check(q('#toast').textContent.includes('qarz kamaydi'), 'tg: baho saqlandi + qarz kamaydi');

/* qarz kamaydi: 2 → 1 */
const afterGrade = JSON.parse(win.localStorage.getItem('et_students')).filter(x => x.id === 's3')[0];
check(afterGrade.speakingDebt === 1, 'tg: baholash qarzni 1 ga kamaytirdi (2 → 1)');
const tgAfter = JSON.parse(win.localStorage.getItem('et_tg_subs')).filter(x => x.id === 't1')[0];
check(tgAfter.status === 'baholandi' && tgAfter.score === 9, 'tg: topshirik baholandi (9)');
check(tgAfter.feedback === "A'lo talaffuz", 'tg: izoh saqlandi');

/* jurnalda Speaking satri */
click('[data-act="nav"][data-screen="grades"]');
click('[data-act="grade-group"][data-group="g2"]');
const jasurCells = qa('[data-act="edit-grade"][data-sid="s3"]');
check(jasurCells.some(c => c.textContent.trim() === '9'), 'tg→jurnal: ball jurnalga tushdi');

/* --- 4b. O'quvchi portali: badge + yozish paneli --- */
logout();
loginAs('jasur', '4321');
check(text().includes('Speaking qarzingiz') || text().includes("Speaking qarzingiz yo'q"), 'student: Speaking qarzi badge');
check(!!q('[data-act="speak-cta"]') && q('[data-act="speak-cta"]').textContent.includes('Speaking topshirish'),
  "student: '🎙 Speaking topshirish' dolzarb tugmasi (badge tagida)");
check(text().includes('Telegram orqali'), "student: 'Telegram orqali topshirish' yo'riqnomasi");
check(!q('#recorder') && !q('[data-act="rec-start"]') && !q('[data-act="rec-send"]'),
  "student: brauzer recorder butunlay olib tashlangan");
check(text().includes('Uyga vazifalar'), "student: 'Uyga vazifalar' bo'limi portalda");
check(text().includes('Baho: 9/10') && !!q('.audio-item__meta svg'),
  'student: baholangan Telegram topshirigi SVG check bilan ko\'rinadi');
clickAct('speak-cta');
check(q('#modal-overlay').hidden === false && q('#modal-sheet').textContent.includes('Telegram'),
  "student: CTA → Telegram yo'riqnomasi modali");
click('[data-act="close-modal"]');

/* ================= 14. CHAT (Ustoz ↔ O'quvchi) ================= */
check(text().includes('Muzaffar Amirov bilan Chat'), "chat: o'quvchi portali bo'limi bor");
check(!!q('#chat-list') && !!q('#chat-input'), "chat: portalda xabarlashuv (ro'yxat + input)");
setVal('#chat-input', 'Tayyor ustoz');
clickAct('send-chat');
check(q('#chat-list').textContent.includes('Tayyor ustoz'), "chat: o'quvchi xabar yubordi");
check(!!q('#chat-list .chat-msg.mine'), "chat: o'quvchi xabari o'zi tomonida (mine)");

logout();
loginAs('m_amirov', '123');
click('[data-act="nav"][data-screen="students"]');
check(qa('[data-act="open-chat"]').length === studentCards(), "chat: har o'quvchi kartasida 'Xabar yozish' tugmasi");
click(qa('[data-act="open-chat"]').filter(b => b.getAttribute('data-sid') === 's3')[0]);
check(q('#modal-overlay').hidden === false, "chat: ustoz xabar modali ochildi");
check(!!q('#chat-list') && !!q('#chat-input'), "chat: modaldagi ro'yxat + input mavjud");
check(q('#chat-list').textContent.includes('Tayyor ustoz'), "chat: ustoz o'quvchi xabarini kordi");
setVal('#chat-input', 'Assalom Jasur');
clickAct('send-chat');
check(q('#chat-list').textContent.includes('Assalom Jasur'), "chat: ustoz xabar yozdi");
click('[data-act="close-modal"]');
check(q('#modal-overlay').hidden === true, 'chat: modal yopildi');

/* o'quvchi ustoz xabarini ko'radi */
logout();
loginAs('jasur', '4321');
check(q('#chat-list') && q('#chat-list').textContent.includes('Assalom Jasur'), "chat: o'quvchi ustoz xabarini kordi");

/* ================= 15. NEYTRAL GRADEBOOK (CSS) ================= */
const cssText = fs.readFileSync(path.join(root, 'css', 'styles.css'), 'utf8');
const appText = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
check(cssText.includes('.g-num'), 'neytral: .g-num klassi mavjud');
check(!/\.g-a\s*\{/.test(cssText) && !/\.g-b\s*\{/.test(cssText) && !/\.g-c\s*\{/.test(cssText),
  "neytral: eski rangli baho klasslari o'chirilgan");
check(!/\.score-btn\.sel\.g-(a|b|c)/.test(cssText), "neytral: rangli ball tugmalari yo'q");
check(!appText.includes('background:#1f9d5b') && !appText.includes('background:#2f8fef') && !appText.includes('background:#e5484d'),
  "neytral: legendadagi rangli nuqtalar olib tashlangan");

/* ================= 16. CLOUD SYNC (Supabase API) ================= */
check(typeof win.__cloud === 'object' && typeof win.__cloud.pullAll === 'function' && typeof win.__cloud.pushGrade === 'function',
  'cloud: CloudSync moduli ulangan (pullAll/pushGrade)');
check(typeof win.__cloud.sendMessage === 'function' && typeof win.__cloud.pushAttendance === 'function' && typeof win.__cloud.pushDebt === 'function',
  'cloud: messages/attendance/debt API mavjud');
check(String(win.__cloud.url).indexOf('mvjoeqyqaylfccqcnwwe.supabase.co') >= 0, 'cloud: haqiqiy Supabase URL ulangan');
check(win.__cloud.ready() === false, "cloud: jsdom da klient yo'q — lokal rejim (graceful) ishlaydi");
check(win.__cloud.messagesAvailable() === false, "cloud: klient yo'qken messages lokal rejimda");

/* ================= 17. O'QUVCHINI O'CHIRISH (tasdiq bilan) ================= */
logout();
loginAs('m_amirov', '123');
click('[data-act="nav"][data-screen="students"]');
const nStudBeforeDel = studentCards();
check(qa('[data-act="del-student"]').length === nStudBeforeDel, "o'chirish: har o'quvchi kartasida '🗑 O'chirish' tugmasi");
let delCard = qa('.student-card').filter(c => c.textContent.includes('Gulnoza Ismoilova'))[0];
check(!!delCard, "o'chirish: Gulnoza kartasi topildi");
const delSid = delCard.querySelector('[data-act="del-student"]').getAttribute('data-sid');

/* tasdiq modali — bekor qilish */
click(delCard.querySelector('[data-act="del-student"]'));
check(q('#modal-overlay').hidden === false, "o'chirish: tasdiq modali ochildi");
check(q('#modal-sheet').textContent.includes("Haqiqatan ham") && q('#modal-sheet').textContent.includes("Gulnoza Ismoilovani o'chirmoqchimisiz"),
  "o'chirish: ism bilan tasdiq savoli");
check(q('#modal-sheet').textContent.includes('baholari va davomat tarixi ham o\'chiriladi'),
  "o'chirish: ogohlantirish matni to'liq");
check(!!q('.confirm-actions [data-act="close-modal"]') && q('.confirm-actions [data-act="close-modal"]').textContent.includes('Bekor qilish'),
  "o'chirish: 'Bekor qilish' tugmasi");
check(!!q('[data-act="do-del-student"]') && q('[data-act="do-del-student"]').textContent.includes("Ha, o'chirish"),
  "o'chirish: 'Ha, o'chirish' tugmasi");
click('.confirm-actions [data-act="close-modal"]');
check(q('#modal-overlay').hidden === true, 'o\'chirish: bekor qilindi');
check(studentCards() === nStudBeforeDel, "o'chirish: bekor qilingach o'quvchi saqlanib qoldi");

/* tasdiq → o'chirish */
click(qa('.student-card').filter(c => c.textContent.includes('Gulnoza Ismoilova'))[0].querySelector('[data-act="del-student"]'));
click('[data-act="do-del-student"]');
check(q('#modal-overlay').hidden === true, 'o\'chirish: modal yopildi');
check(studentCards() === nStudBeforeDel - 1, "o'chirish: o'quvchi ro'yxatdan yo'qoldi");
check(q('#toast').textContent.includes("O'quvchi muvaffaqiyatli o'chirildi"), "o'chirish: success toast");
const studentsAfterDel = JSON.parse(win.localStorage.getItem('et_students'));
check(!studentsAfterDel.some(x => x.id === delSid), "o'chirish: lokal studentsdan o'chirildi");
check(!JSON.parse(win.localStorage.getItem('et_grades'))[delSid], "o'chirish: baholari o'chirildi");
check(!JSON.parse(win.localStorage.getItem('et_accounts'))['gulnoza'], "o'chirish: login hisobi o'chirildi");
const attAfterDel = JSON.parse(win.localStorage.getItem('et_attendance'));
check(Object.keys(attAfterDel).every(dk => !attAfterDel[dk] || !attAfterDel[dk][delSid]), "o'chirish: davomati o'chirildi");
check(!qa('.student-card').some(c => c.textContent.includes('Gulnoza')), "o'chirish: karta ham yo'qoldi");

/* ================= 18. GURUHNI O'CHIRISH (tasdiq bilan) ================= */
click('[data-act="nav"][data-screen="groups"]');
const nGrpBeforeDel = groupCards();
check(qa('[data-act="del-group"]').length === nGrpBeforeDel, "guruh: har kartada '🗑 O'chirish' tugmasi");
const grpCard = qa('.group-card').filter(c => c.textContent.includes('IELTS Band 7.0'))[0];
const grpId = grpCard.querySelector('[data-act="del-group"]').getAttribute('data-gid');

click(grpCard.querySelector('[data-act="del-group"]'));
check(q('#modal-overlay').hidden === false, "guruh: tasdiq modali ochildi");
check(q('#modal-sheet').textContent.includes('IELTS Band 7.0 guruhini o\'chirmoqchimisiz?'),
  "guruh: nom bilan tasdiq savoli");
check(!!q('.confirm-actions [data-act="close-modal"]') && !!q('[data-act="do-del-group"]'), "guruh: Bekor/Ha tugmalari");
click('.confirm-actions [data-act="close-modal"]');
check(groupCards() === nGrpBeforeDel, "guruh: bekor qilingach saqlanib qoldi");

click(qa('.group-card').filter(c => c.textContent.includes('IELTS Band 7.0'))[0].querySelector('[data-act="del-group"]'));
click('[data-act="do-del-group"]');
check(groupCards() === nGrpBeforeDel - 1, "guruh: ro'yxatdan yo'qoldi");
check(q('#toast').textContent.includes('Guruh muvaffaqiyatli o\'chirildi'), "guruh: success toast");
check(!JSON.parse(win.localStorage.getItem('et_groups')).some(g => g.id === grpId), "guruh: lokal groupsdan o'chirildi");
const studentsAfterGrpDel = JSON.parse(win.localStorage.getItem('et_students'));
check(studentsAfterGrpDel.filter(x => x.groupId === null).length === 2, "guruh: o'quvchilari guruhsiz qoldi (group_id = null)");
check(!JSON.parse(win.localStorage.getItem('et_grades'))['x'], "guruh: boshqa ma'lumotlar o'zgarmadi");

/* ================= 19. ZAXIRA — BACKUP & RESTORE (async) ================= */
const until = async (fn, ms) => {
  const t0 = Date.now();
  for (;;) {
    let v = false;
    try { v = await fn(); } catch (e) { v = false; }
    if (v) return true;
    if (Date.now() - t0 > ms) return false;
    await new Promise(r => setTimeout(r, 60));
  }
};

(async () => {
  /* Ustoz profili → zaxira kartasi */
  click('[data-act="nav"][data-screen="profile"]');
  check(q('#screen').textContent.includes("Ma'lumotlar Bazasi Zaxirasi"), 'zaxira: karta profilda');
  check(!!q('[data-act="backup-dl"]') && q('[data-act="backup-dl"]').textContent.includes('Bazani yuklab olish'),
    'zaxira: "📥 Bazani yuklab olish (Backup)" tugmasi');
  check(!!q('[data-act="backup-pick"]') && !!q('#backup-file'), 'zaxira: "📤 Bazani qayta tiklash" + fayl input');

  /* Download (jsdom uchun stub) */
  if (typeof win.URL.createObjectURL !== 'function') {
    win.URL.createObjectURL = () => 'blob:mock';
    win.URL.revokeObjectURL = () => {};
  }
  click('[data-act="backup-dl"]');
  check(await until(() => q('#toast').textContent.includes('Zaxira yuklab olindi'), 4000), 'zaxira: JSON yuklab olindi (toast)');

  /* Faylni tanlash → tasdiq modali → BEKOR */
  const bak = {
    app: 'english-tutor', version: 1,
    groups: [{ id: 55, name: 'RESTORED GROUP', days: 'Dushanba', time: '09:00' }],
    students: [{ id: 77, name: 'Restored Student', school_class: '9-sinf', group_id: 55,
                 login: 'restore1', password: '9876', speaking_debt: 3 }],
    attendance: [{ student_id: 77, date: '2026-10-01', status: 'present' }],
    grades: [{ student_id: 77, date: '2026-10-01', grade: 9, category: "Lug'at", note: '' }],
    messages: [{ student_id: 77, sender: 'teacher', text: 'Tiklangan xabar', created_at: '2026-10-01T10:00:00.000Z' }],
    speaking_submissions: [],
    audio_submissions: [{ id: 9, student_id: 77, date: '2026-10-02', url: 'data:audio/ogg;base64,AAA',
                           status: 'graded', score: 8, feedback: 'Yaxshi' }]
  };
  const pickFile = () => {
    const f = new win.File([JSON.stringify(bak)], 'english_crm_backup_2026-10-13.json', { type: 'application/json' });
    const inp = q('#backup-file');
    Object.defineProperty(inp, 'files', { value: [f], configurable: true });
    inp.dispatchEvent(new win.Event('change', { bubbles: true }));
  };
  pickFile();
  check(await until(() => q('#modal-overlay').hidden === false &&
    q('#modal-sheet').textContent.includes('Haqiqatan ham bazani ushbu fayldan qayta tiklamoqchimisiz'), 4000),
    'zaxira: tasdiq modali (spec matni)');
  check(q('#modal-sheet').textContent.includes('english_crm_backup_2026-10-13.json'), 'zaxira: fayl nomi ko\'rinadi');
  check(!!q('.confirm-actions [data-act="close-modal"]') && q('.confirm-actions [data-act="close-modal"]').textContent.includes('Bekor qilish'),
    "zaxira: 'Bekor qilish' tugmasi");
  check(!!q('[data-act="do-restore"]') && q('[data-act="do-restore"]').textContent.includes('Ha, tiklash'),
    "zaxira: 'Ha, tiklash' tugmasi");

  click('.confirm-actions [data-act="close-modal"]');
  check(q('#modal-overlay').hidden === true, 'zaxira: bekor qilindi');
  const grpBefore = JSON.parse(win.localStorage.getItem('et_groups') || '[]');
  check(!grpBefore.some(g => g.name === 'RESTORED GROUP'), 'zaxira: bekor qilingach ma\'lumot o\'zgarmadi');

  /* Qayta tanlash → TASDIQLASH → lokal tiklash */
  pickFile();
  check(await until(() => q('#modal-overlay').hidden === false, 4000), 'zaxira: modal qayta ochildi');
  click('[data-act="do-restore"]');
  check(await until(() => {
    const g = JSON.parse(win.localStorage.getItem('et_groups') || '[]');
    return g.length === 1 && g[0].name === 'RESTORED GROUP';
  }, 4000), 'zaxira: guruh qayta tiklandi (RESTORED GROUP)');
  check(q('#toast').textContent.includes('Baza qayta tiklandi'), 'zaxira: success toast');

  const stAfter = JSON.parse(win.localStorage.getItem('et_students') || '[]');
  check(stAfter.length === 1 && stAfter[0].fullName === 'Restored Student', 'zaxira: o\'quvchi qayta tiklandi');
  check(stAfter[0].id === 's77' && stAfter[0].groupId === 'g55', 'zaxira: idlar mos (s77 → g55)');
  check(stAfter[0].speakingDebt === 3, 'zaxira: speaking qarz saqlandi (3)');
  const grAfter = JSON.parse(win.localStorage.getItem('et_grades') || '{}');
  check(grAfter['s77'] && grAfter['s77']['2026-10-01'] && grAfter['s77']['2026-10-01'].score === 9, 'zaxira: baholar tiklandi');
  const attAfter2 = JSON.parse(win.localStorage.getItem('et_attendance') || '{}');
  check(attAfter2['2026-10-01'] && attAfter2['2026-10-01']['s77'] === 'present', 'zaxira: davomat tiklandi');
  const msgAfter = JSON.parse(win.localStorage.getItem('et_messages') || '[]');
  check(msgAfter.some(m => m.text === 'Tiklangan xabar' && m.sid === 's77'), 'zaxira: xabarlar tiklandi');
  check(stAfter[0].audioSubmissions && stAfter[0].audioSubmissions.length === 1 &&
    stAfter[0].audioSubmissions[0].score === 8 && stAfter[0].audioSubmissions[0].rid === 9 &&
    stAfter[0].audioSubmissions[0].status === 'graded',
    'zaxira: ovozli topshiriklar tiklandi (audio_submissions)');
  const accAfter = JSON.parse(win.localStorage.getItem('et_accounts') || '{}');
  check(!!accAfter['restore1'] && accAfter['restore1'].password === '9876' && !!accAfter['m_amirov'],
    'zaxira: hisoblar qayta qurildi (m_amirov + restore1)');

  /* UI jonli yangilandi */
  forceNav('groups');
  check(text().includes('RESTORED GROUP'), 'zaxira: guruhlar ekrani yangilandi');
  forceNav('students');
  check(text().includes('Restored Student'), "zaxira: o'quvchilar ekrani yangilandi");

  /* Tiklangan hisob bilan kirish */
  click('[data-act="nav"][data-screen="profile"]');
  clickAct('logout');
  loginAs('restore1', '1111');
  check(q('#login-error').classList.contains('show'), "zaxira: noto'g'ri parol rad etildi");
  loginAs('restore1', '9876');
  check(text().includes('Restored Student'), "zaxira: restore1/9876 bilan kirish ishlaydi");

  /* ================= 20. UYGA VAZIFA (ustoz → o'quvchi portali) ================= */
  logout();
  loginAs('m_amirov', '123');
  click('[data-act="nav"][data-screen="home"]');
  check(!!q('[data-act="open-hw"]'), "uyga vazifa: '+ Uyga vazifa' tugmasi (Bosh)");
  check(text().includes('Uyga vazifalar'), "uyga vazifa: bo'lim sarlavhasi");
  clickAct('open-hw');
  check(q('#modal-overlay').hidden === false, "uyga vazifa: modali ochildi");
  check(!!q('#hw-group') && !!q('#hw-title') && !!q('#hw-desc') && !!q('#hw-due'),
    "uyga vazifa: guruh/mavzu/tavsif/muddat formasi");
  clickAct('save-hw');
  check(q('#hw-error').classList.contains('show'), "uyga vazifa: bo'sh mavzu rad etildi");
  setVal('#hw-title', 'Present Perfect shakli');
  q('#hw-group').value = 'g55';
  setVal('#hw-desc', '10 ta gap tuzing');
  q('#hw-due').value = '2026-10-20';
  clickAct('save-hw');
  check(q('#modal-overlay').hidden === true, "uyga vazifa: modal yopildi");
  check(text().includes('Present Perfect shakli'), "uyga vazifa: ro'yxatda ko'rinadi");
  check(text().includes('20.10.2026') || text().includes('2026-10-20'), "uyga vazifa: muddat ko'rinadi");
  const hwLocal = JSON.parse(win.localStorage.getItem('et_homework') || '[]');
  check(hwLocal.length === 1 && hwLocal[0].title === 'Present Perfect shakli' &&
    hwLocal[0].groupId === 'g55' && hwLocal[0].dueDate === '2026-10-20',
    "uyga vazifa: lokalda saqlandi (g55, muddat)");

  logout();
  loginAs('restore1', '9876');
  check(text().includes('Present Perfect shakli'), "uyga vazifa: o'quvchi portalida ko'rinadi");
  check(text().includes('10 ta gap tuzing'), "uyga vazifa: tavsif portalda ko'rinadi");
  check(text().includes('Uyga vazifalar') && !!q('.section-title svg'),
    "uyga vazifa: portal bo'limi SVG BookOpen ikonka bilan mavjud");

  /* ================= 21. VOICE RUXSAT KALITI (kartada) ================= */
  logout();
  loginAs('m_amirov', '123');
  click('[data-act="nav"][data-screen="students"]');
  const swEl = q('[data-act="voice-toggle"]');
  check(!!swEl, "voice: o'quvchi kartasida ruxsat kaliti bor");
  check(!!swEl && swEl.classList.contains('on'), "voice: standart holat ON (ruxsat berilgan)");
  click(swEl);
  const swEl2 = q('[data-act="voice-toggle"]');
  check(!!swEl2 && !swEl2.classList.contains('on'), "voice: bosildi → OFF (cheklandi)");
  const stV = JSON.parse(win.localStorage.getItem('et_students')).filter(x => x.id === 's77')[0];
  check(!!stV && stV.voiceAllowed === false, "voice: voiceAllowed=false lokalda saqlandi");
  check(q('#toast').textContent.includes('cheklandi'), "voice: toast xabari");

  /* ================= 22. 5 SONIYALIK POLLING OLIB TASHLANGAN ================= */
  let fiveSec = 0;
  const origST = win.setTimeout;
  win.setTimeout = function () { if (arguments[1] === 5000) fiveSec++; return origST.apply(win, arguments); };
  click(qa('[data-act="open-chat"]')[0]);
  check(q('#modal-overlay').hidden === false, "chat: modal ochildi (polling tekshiruvi)");
  await new Promise(r => setTimeout(r, 120));
  win.setTimeout = origST;
  check(fiveSec === 0, "sync: 5 soniyalik chat polling yo'q (loop'siz)");
  click('[data-act="close-modal"]');

  /* ================= 23. TOZALASH (AVVAL ZAXIRA → TASDIQ → TOZALASH) ================= */
  click('[data-act="nav"][data-screen="profile"]');
  check(!!q('[data-act="cleanup-go"]'), "tozalash: tugma profilda");
  check(qa('[data-act="cleanup-pick"]').length === 4, "tozalash: 4 ta jadval tanlovi");
  check(!!q('[data-act="cleanup-pick"][data-table="grades"]') &&
    q('[data-act="cleanup-pick"][data-table="grades"]').classList.contains('active'),
    "tozalash: 'Baholar' standart tanlangan");
  check(JSON.parse(win.localStorage.getItem('et_grades') || '{}')['s77'] !== undefined,
    "tozalash: baholar mavjud (oldin)");
  q('#toast').textContent = '';
  clickAct('cleanup-go');
  check(await until(() => q('#toast').textContent.includes('Zaxira yuklab olindi'), 4000),
    "tozalash: AVVAL to'liq zaxira fayl yuklab olindi");
  check(await until(() => q('#modal-overlay').hidden === false, 4000), "tozalash: tasdiq modali ochildi");
  check(q('#modal-sheet').textContent.includes("Eski ma'lumotlar fayl ko'rinishida yuklandi. Bazani tozalashni tasdiqlaysizmi?"),
    "tozalash: tasdiq modali spec matni");
  check(!!q('.confirm-actions [data-act="close-modal"]') &&
    q('.confirm-actions [data-act="close-modal"]').textContent.includes('Bekor qilish'),
    "tozalash: 'Bekor qilish' tugmasi");
  check(!!q('[data-act="do-cleanup"]') && q('[data-act="do-cleanup"]').textContent.includes('Ha, tozalash'),
    "tozalash: 'Ha, tozalash' tugmasi");
  click('.confirm-actions [data-act="close-modal"]');
  check(JSON.parse(win.localStorage.getItem('et_grades') || '{}')['s77'] !== undefined,
    "tozalash: bekor qilingach ma'lumot saqlanib qoldi");
  q('#toast').textContent = '';
  clickAct('cleanup-go');
  check(await until(() => q('#modal-overlay').hidden === false, 4000), "tozalash: modal qayta ochildi");
  clickAct('do-cleanup');
  check(await until(() => q('#toast').textContent.includes('Jadval tozalandi'), 4000), "tozalash: success toast");
  check(Object.keys(JSON.parse(win.localStorage.getItem('et_grades') || '{}')).length === 0,
    "tozalash: baholar jadvali tozalandi");

  /* ================= 24. BRAUZER BILDIRISHNOMALARI ================= */
  {
    /* jsdom'da Notification yo'q — sun'iy kuzatuvchi o'rnatamiz */
    const shownNotifs = [];
    let permRequests = 0;
    function FakeNotification(title, opts) {
      this.title = title;
      this.body = (opts && opts.body) || '';
      this.icon = (opts && opts.icon) || '';
      shownNotifs.push(this);
    }
    FakeNotification.permission = 'default';
    FakeNotification.requestPermission = function (cb) {
      permRequests++;
      FakeNotification.permission = 'granted';
      if (cb) cb('granted');
      return Promise.resolve('granted');
    };
    win.Notification = FakeNotification;
    win.Notif.resetSeen();

    check(typeof win.Notif.notifyOnce === 'function' && typeof win.Notif.showPrompt === 'function',
      'notif: Notif moduli mavjud');
    check(win.Notif.PROMPT_TEXT === "Yangi baholar va xabarlarni o'tkazib yubormaslik uchun bildirishnomalarni yoqing",
      "notif: so'rov matni specda aniq (emoji yo'q)");
    check(win.Notif.PROMPT_BUTTON === 'Ruxsat berish', 'notif: [Ruxsat berish] tugma nomi');
    check(win.Notif.permission() === 'default', "notif: ruxsat hali default — so'rov kerak");

    /* --- Ruxsat so'rovi --- */
    q('#toast').textContent = '';
    check(win.Notif.showPrompt() === true, "notif: default holatda do'stona so'rov chiqdi");
    check(q('#toast').textContent.includes(win.Notif.PROMPT_TEXT), "notif: toast so'rov matnini ko'rsatdi");
    const permBtn = q('#toast .toast-action');
    check(!!permBtn && permBtn.textContent === 'Ruxsat berish', 'notif: toastda [Ruxsat berish] tugmasi bor');
    if (permBtn) click(permBtn);
    check(permRequests === 1, 'notif: tugma bosildi → Notification.requestPermission() chaqirildi');
    check(win.Notif.permission() === 'granted', 'notif: ruxsat berildi');
    check(q('#toast').textContent.includes('yoqildi'), 'notif: ruxsat olgach tasdiq toast');

    /* --- Bloklangan holat: xatosiz jim (fallback) --- */
    FakeNotification.permission = 'denied';
    win.Notif.resetSeen();
    shownNotifs.length = 0;
    check(win.Notif.showPrompt() === false, "notif: ruxsat bloklanganda so'rov ko'rsatilmaydi");
    check(win.Notif.notifyOnce('blocked1', 'sarlavha', 'matn') === false && shownNotifs.length === 0,
      'notif: bloklanganda native bildirishnoma chiqmaydi (fallback)');

    /* --- Ruxsat berilganda native bildirishnoma --- */
    FakeNotification.permission = 'granted';
    win.Notif.resetSeen();
    shownNotifs.length = 0;
    check(win.Notif.notifyOnce('g901', "Muzaffar Amirov: Sizga yangi baho qo'yildi (9/10)!", 'b9') === true &&
      shownNotifs.length === 1, 'notif: ruxsat bilan native bildirishnoma chiqdi');
    check(shownNotifs[0].title === "Muzaffar Amirov: Sizga yangi baho qo'yildi (9/10)!" &&
      String(shownNotifs[0].icon).indexOf('data:image/svg') === 0,
      'notif: baho sarlavhasi specda aniq + icon biriktirilgan');
    check(win.Notif.notifyOnce('g901', 'takroriy', 'b9') === false && shownNotifs.length === 1,
      'notif: bir xil qator id faqat bir marta (dedup)');

    /* ================= 25. BILDIRISHNOMA HODISALARI (realtime) ================= */
    /* Realtime qatorlari Supabase id ishlatadi — testda dbId beramiz */
    const gRows = JSON.parse(win.localStorage.getItem('et_groups') || '[]');
    gRows.forEach((g, i) => { g.dbId = i + 1; });
    win.localStorage.setItem('et_groups', JSON.stringify(gRows));
    const sRows = JSON.parse(win.localStorage.getItem('et_students') || '[]');
    sRows.forEach((s, i) => { s.dbId = i + 1; });
    win.localStorage.setItem('et_students', JSON.stringify(sRows));

    /* Bu bosqichda qolgan ulangan o'quvchini topamiz (zaxiradan tiklangan hisob) */
    const accsNow = JSON.parse(win.localStorage.getItem('et_accounts') || '{}');
    let stuLogin = null, stuPass = null, stuLocalId = null;
    Object.keys(accsNow).forEach(k => {
      const a = accsNow[k];
      if (stuLogin || a.role !== 'student' || !a.studentId) return;
      if (!sRows.some(x => x.id === a.studentId)) return;
      stuLogin = k; stuPass = a.password; stuLocalId = a.studentId;
    });
    const stu = stuLogin ? sRows.filter(x => x.id === stuLocalId)[0] : null;
    const grp = stu && stu.groupId ? gRows.filter(x => x.id === stu.groupId)[0] : null;
    const S5_DB = stu ? stu.dbId : null;      /* joriy o'quvchining DB id'si */
    const G1_DB = grp ? grp.dbId : null;      /* joriy o'quvchining guruhi */
    const stuName = (stu && stu.fullName) || "O'quvchi";
    check(!!stuLogin && S5_DB != null && G1_DB != null,
      "notif: ulangan o'quvchi + guruhi topildi (realtime testi uchun)");

    logout();
    loginAs(stuLogin, stuPass);
    win.Notif.resetSeen();
    shownNotifs.length = 0;

    /* (0) boshqa o'quvchiga tegishli baho → o'quvchiga xabar KETMAYDI */
    win.onCloudNotifChange('grades', { id: 8001, student_id: 9999, grade: 5 }, null);
    check(shownNotifs.length === 0, 'notif: boshqa o' + "'" + 'quvchi bahosi lokal xabar bermaydi');

    /* (1) ustoz baho qo'ydi */
    win.onCloudNotifChange('grades', { id: 8002, student_id: S5_DB, grade: 9 }, null);
    check(shownNotifs.length === 1 &&
      shownNotifs[0].title === "Muzaffar Amirov: Sizga yangi baho qo'yildi (9/10)!",
      "notif: o'quvchi — yangi baho sarlavhasi specda aniq");

    /* (2) ustoz voice ruxsati berdi */
    win.onCloudNotifChange('students', { id: S5_DB, voice_allowed: true }, { voice_allowed: false });
    check(shownNotifs.length === 2 &&
      shownNotifs[1].title === 'Muzaffar Amirov: Ovozli speaking topshirishga ruxsat berildi!',
      "notif: o'quvchi — voice ruxsati sarlavhasi specda aniq");
    const stNow = JSON.parse(win.localStorage.getItem('et_students')).filter(x => x.id === stuLocalId)[0];
    check(stNow.voiceAllowed === true, 'notif: voice_allowed lokal keshda ham yangilandi');

    /* (2b) allaqachon true bo'lgan → takroriy xabar yo'q */
    win.onCloudNotifChange('students', { id: S5_DB, voice_allowed: true }, { voice_allowed: true });
    check(shownNotifs.length === 2, 'notif: voice true→true takroriy xabar bermaydi');

    /* (3) ustoz chat yozdi */
    win.onCloudNotifChange('messages', { id: 8003, student_id: S5_DB, sender: 'teacher', text: 'Ertaga dars bor' }, null);
    check(shownNotifs.length === 3 &&
      shownNotifs[2].title === 'Muzaffar Amirovdan yangi xabar: Ertaga dars bor',
      'notif: o‘quvchi — Muzaffar Amirovdan yangi xabar (specda aniq)');

    /* (4) guruhi uchun yangi uyga vazifa */
    win.onCloudNotifChange('homework', { id: 8004, group_id: G1_DB, title: 'Present Perfect' }, null);
    check(shownNotifs.length === 4 && shownNotifs[3].title === 'Yangi uyga vazifa: Present Perfect',
      'notif: o‘quvchi — yangi uyga vazifa sarlavhasi specda aniq');

    /* (4b) boshqa guruh uchun vazifa → xabar ketmaydi */
    win.onCloudNotifChange('homework', { id: 8005, group_id: 777, title: 'Boshqa guruh' }, null);
    check(shownNotifs.length === 4, 'notif: boshqa guruh vazifasi lokal xabar bermaydi');

    /* (5) o‘quvchi yozgan xabar → USTOZGA (o‘quvchi turib xabar olmaydi) */
    win.onCloudNotifChange('messages', { id: 8006, student_id: S5_DB, sender: 'student', text: 'Tayyor' }, null);
    check(shownNotifs.length === 4, "notif: o'quvchi yozgan xabar o'quvchiga qaytarilmaydi");

    /* --- Ustoz tomoni --- */
    logout();
    loginAs('m_amirov', '123');
    win.Notif.resetSeen();
    shownNotifs.length = 0;

    win.onCloudNotifChange('messages', { id: 8007, student_id: S5_DB, sender: 'student', text: 'Yaxshiman' }, null);
    check(shownNotifs.length === 1 && shownNotifs[0].title === stuName + ': Yangi xabar keldi',
      "notif: ustoz — o'quvchi xabari sarlavhasi specda aniq");

    win.onCloudNotifChange('speaking_submissions', { id: 8008, student_id: S5_DB }, null);
    check(shownNotifs.length === 2 && shownNotifs[1].title === stuName + ': Yangi speaking topshirildi!',
      "notif: ustoz — yangi speaking sarlavhasi specda aniq");

    win.onCloudNotifChange('grades', { id: 8009, student_id: S5_DB, grade: 10 }, null);
    check(shownNotifs.length === 2, "notif: ustozga o'quvchi bahosi xabari ketmaydi (faqat o'quvchiga)");

    /* ================= 26. JONLI INBOX & QARZ BADGE (zero refresh) ================= */
    /* (a) INSERT → yangi topshirik INCHKda darhol paydo bo'ladi */
    click('[data-act="nav"][data-screen="speaking"]');
    const inboxBefore = qa('.audio-item').length;
    win.onCloudNotifChange('speaking_submissions',
      { id: 8101, student_id: S5_DB, media_type: 'voice', status: 'kutilmoqda',
        score: null, created_at: '2026-10-15T12:00:00.000Z' }, null);
    check(qa('.audio-item').length === inboxBefore + 1,
      'realtime: INSERT → yangi karta INBOXda darhol (qayta yuklashsiz)');
    check(!!q('[data-tgcard="t8101"]'), 'realtime: karta data-tgcard bilan chiqdi');
    check(JSON.parse(win.localStorage.getItem('et_tg_subs') || '[]')
        .some(x => x.dbId === 8101),
      'realtime: INSERT → lokal inbox keshga yozildi (optimistic)');

    /* (b) UPDATE (botda baholandi) → holat yangilanadi + karta silliq chiqadi */
    win.onCloudNotifChange('speaking_submissions',
      { id: 8101, student_id: S5_DB, media_type: 'voice', status: 'baholandi',
        score: 9, created_at: '2026-10-15T12:00:00.000Z' }, { status: 'kutilmoqda' });
    const t8101 = JSON.parse(win.localStorage.getItem('et_tg_subs') || '[]')
      .filter(x => x.dbId === 8101)[0];
    check(!!t8101 && t8101.status === 'baholandi' && t8101.score === 9,
      'realtime: UPDATE(baholandi) → lokal holat darhol yangilandi');
    check(!!q('[data-tgcard="t8101"]') &&
      q('[data-tgcard="t8101"]').classList.contains('is-leaving'),
      'realtime: baholangan karta INBOXdan silliq chiqmoqda (is-leaving)');

    /* (c) students UPDATE → qarz badge 2 → 1 sahifaniyangilashmasdan */
    win.onCloudNotifChange('students',
      { id: S5_DB, speaking_debt: 1, voice_allowed: true }, {});
    const debtStu = JSON.parse(win.localStorage.getItem('et_students'))
      .filter(x => x.dbId === S5_DB)[0];
    check(!!debtStu && debtStu.speakingDebt === 1,
      'realtime: speaking_debt lokal keshda jonli yangilandi → 1');
    check(qa('.debt-num').filter(d => d.textContent.trim() === '1 ta').length >= 1,
      "realtime: qarz badge ekranda '1 ta' bo'ldi (refreshsiz)");

    /* Kirganda ruxsat 'default' bo'lsa — so'rov rejalashtiriladi */
    FakeNotification.permission = 'default';
    check(win.Notif.afterLogin(5) === true, "notif: kirishda default → so'rov rejalashtirildi");
    FakeNotification.permission = 'granted';
    check(win.Notif.afterLogin(5) === false, 'notif: ruxsat allaqachon berilgan — qayta so‘ramaydi');
    FakeNotification.permission = 'denied';
    check(win.Notif.afterLogin(5) === false, 'notif: ruxsat bloklangan — so‘ramaydi');
  }

  console.log(failed ? '\n' + failed + ' ta test YIQILDI' : '\nBarcha testlar o\'tdi ✓');
  process.exit(failed ? 1 : 0);
})();
