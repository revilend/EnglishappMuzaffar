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

const dom = new JSDOM(html, { url: 'http://localhost:3000/', runScripts: 'outside-only', pretendToBeVisual: true });
const win = dom.window;
const doc = win.document;

win.eval(fs.readFileSync(path.join(root, 'js', 'data.js'), 'utf8') + '\nwindow.APP_DATA = APP_DATA;');
win.eval(fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8'));

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

/* bo'sh forma */
clickAct('do-login');
check(q('#login-error').classList.contains('show'), 'login: bo\'sh forma rad etildi');

/* noto\'g\'ri parol */
loginAs('admin', '999');
check(q('#login-error').textContent.includes("noto'g'ri"), 'login: noto\'g\'ri parol xabar bermoqda');
check(q('#password-input').value === '', 'login: noto\'g\'ri parol tozalanadi');

/* ================= 2. USTOZ (admin/123) ================= */
loginAs('admin', '123');
check(text().includes('Assalomu alaykum'), 'ustoz: dashboard ochildi');
check(q('#app-header').textContent.includes('Ustoz'), 'ustoz: headerda "Ustoz" roli');
check(navLabels().length === 6, 'ustoz: 6 ta nav tabi (' + navLabels().join(', ') + ')');

/* Moliyaviy ma'lumotlar UMUMAN yo'q */
check(!text().includes("so'm"), 'moliya: dashboardda narx yo\'q');
check(!text().includes("To'lov") && !text().includes('Qarz'), 'moliya: to\'lov/qarz kartasi yo\'q');

/* ================= 3. GURUHLAR ================= */
click('[data-act="nav"][data-screen="groups"]');
check(text().includes('Guruhlar'), 'guruhlar: ekran');
check(groupCards() === 2, 'guruhlar: 2 ta guruh');
check(text().includes('IELTS Band 7.0') && text().includes('18:00'), 'guruhlar: nom + dars vaqti');
check(!text().includes("so'm"), 'moliya: guruh kartasida narx yo\'q');

/* ================= 4. O'QUVCHILAR ================= */
click('[data-act="nav"][data-screen="students"]');
check(text().includes("O'quvchilar"), 'o\'quvchilar: ekran');
check(studentCards() === 6, 'o\'quvchilar: 6 ta mock o\'quvchi');
check(text().includes('Jasur Karimov'), 'o\'quvchilar: ism ko\'rinadi');
check(text().includes('Login') && text().includes('jasur'), 'o\'quvchilar: login ko\'rinadi');
check(!text().includes('Ota-ona'), 'moliya/kontakt: ota-ona bloki yo\'q');
check(qa('[data-act="reset-pwd"]').length === 6, 'o\'quvchilar: har kartada "Parolni yangilash"');

/* sinf filtri */
click('[data-act="filter-class"][data-class="IELTS"]');
check(studentCards() === 1, 'filtr: IELTS = 1 ta');
click('[data-act="filter-class"][data-class="Barchasi"]');
check(studentCards() === 6, 'filtr: Barchasi = 6 ta');

/* ================= 5. YANGI O'QUVCHI + LOGIN/PAROL ================= */
clickAct('open-add-student');
check(q('#modal-overlay').hidden === false, 'modal: o\'quvchi qo\'shish ochildi');
clickAct('save-student');
check(q('#modal-overlay').hidden === false, 'validation: bo\'sh forma saqlanmaydi');

setVal('#f-sname', 'Gulnoza Ismoilova');
q('#f-sclass').value = 'IELTS';
setVal('#f-sphone', '971112233');
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
setVal('#f-sphone', '971112234');
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
const wantCls = Number(want) >= 8 ? 'g-a' : (Number(want) >= 6 ? 'g-b' : 'g-c');
check(newCell && newCell.classList.contains(wantCls), 'jurnal: rang kodlash to\'g\'ri (' + wantCls + ')');

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
check(navLabels().length === 2 && navLabels().join(',') === 'Portim,Profil', 'student: nav faqat Portim + Profil');

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
clickAct('open-change-pwd');
check(q('#modal-overlay').hidden === false, 'change: modal ochildi');
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
loginAs('admin', '123');
click('[data-act="nav"][data-screen="students"]');
check(text().includes('Nilufar Ergasheva'), 'ustoz: qayta kirdi');
logout();

loginAs('nilufar', '7777');
check(text().includes('Nilufar Ergasheva'), 'reset: ustoz yangilagan parol bilan kirdi');
check(text().includes('9-sinf'), 'reset: Nilufar portali ko\'rinadi');
check(!text().includes('Jasur Karimov'), 'reset: boshqa o\'quvchi ko\'rinmaydi');

console.log(failed ? '\n' + failed + ' ta test YIQILDI' : '\nBarcha testlar o\'tdi ✓');
process.exit(failed ? 1 : 0);
