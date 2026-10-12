'use strict';
/* Step 1 — interaktiv smoke-test: haqiqiy DOM'da butun oqimni boshqaramiz. */
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
const click = el => { const node = typeof el === 'string' ? q(el) : el; if (!node) throw new Error('click: element topilmadi -> ' + el); node.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true })); };
const clickAct = act => click(q('[data-act="' + act + '"]'));
const setVal = (sel, val) => { const el = q(sel); if (!el) throw new Error('setVal: ' + sel + ' topilmadi'); el.value = val; el.dispatchEvent(new win.Event('input', { bubbles: true })); };
const studentCards = () => qa('#students-list .student-card').length;
const groupCards = () => qa('#screen .group-card').length;

/* ---------- 1. Login ekrani ---------- */
check(text().includes('English Tutor'), 'login: sarlavha "English Tutor"');
check(!!q('#phone-input'), 'login: telefon inputi mavjud');
check(q('#phone-input').value === '+998 90 123-45-67', 'login: raqam +998 formatida oldindan to\'ldirilgan');
check(q('#app-header').textContent.includes('English Tutor'), 'header: ilova nomi');
check(qa('.nav-item').length === 0, 'auth rejimida bottom nav yo\'q');

/* noto\'g\'ri raqam */
setVal('#phone-input', '123');
clickAct('do-login');
check(text().includes('Davom etish') && q('#phone-error').classList.contains('show'), 'login: noto\'g\'ri raqam xabar bermoqda');

/* ---------- 2. Ro\'yxatdan o\'tish (birinchi kirish) ---------- */
setVal('#phone-input', '998901234567');
clickAct('do-login');
check(text().includes("Ro'yxatdan o'tish"), 'register: ro\'yxatdan o\'tish ekrani ochildi');
check(qa('.role-card').length === 2, 'register: 2 ta rol (Ustoz / O\'quvchi)');
check(text().includes('Ustoz') && text().includes("O'quvchi"), 'register: rollar o\'zbekcha ko\'rsatilgan');

clickAct('to-pin-create');
check(q('#role-error').classList.contains('show'), 'register: rol tanlanmasa xabar');

click('[data-role="teacher"]');
check(q('[data-role="teacher"]').classList.contains('selected'), 'register: "Ustoz" roli tanlandi');
clickAct('to-pin-create');
check(text().includes('PIN kod yarating'), 'pin-create: PIN yaratish ekrani');

/* ---------- 3. PIN yaratish / tasdiqlash ---------- */
setVal('#pin-input', '1234');
clickAct('submit-pin');
check(text().includes("PIN'ni tasdiqlang"), 'pin-confirm: tasdiqlash ekrani');

setVal('#pin-input', '1235');
clickAct('submit-pin');
check(text().includes("PIN'ni tasdiqlang") && q('#pin-error').textContent.includes('mos kelmadi'), 'pin-confirm: mos kelmaydigan PIN xabar bermoqda');

setVal('#pin-input', '1234');
clickAct('submit-pin');
check(text().includes('Assalomu alaykum'), 'home: bosh sahifa ochildi');
check(q('#app-header').textContent.includes('Ustoz'), 'home: roli "Ustoz" ko\'rinadi');
check(text().includes('IELTS Band 7.0') === false, 'home: guruh nomi bosh sahifada emas (statistika)');

/* ---------- 4. Guruhlar ---------- */
click('[data-act="nav"][data-screen="groups"]');
check(text().includes('Guruhlar'), 'groups: Guruhlar ekrani');
check(groupCards() === 2, 'groups: 2 ta mock guruh');
check(text().includes('IELTS Band 7.0'), 'groups: IELTS guruh nomi');
check(text().includes("500 000 so'm"), 'groups: oylik to\'lov UZS formatida');
check(text().includes('Dushanba, Chorshanba, Juma'), 'groups: dars kunlari');
check(text().includes('18:00'), 'groups: dars vaqti');
check(text().includes('4 o\'quvchi') && text().includes('2 o\'quvchi'), 'groups: guruhlarga biriktirilgan o\'quvchilar soni');

/* ---------- 5. O\'quvchilar + filtr ---------- */
click('[data-act="nav"][data-screen="students"]');
check(text().includes("O'quvchilar"), 'students: O\'quvchilar ekrani');
check(studentCards() === 6, 'students: 6 ta mock o\'quvchi');
check(q('#students-count').textContent.includes('6'), 'students: hisoblagich "6 ta"');

click('[data-act="filter-class"][data-class="IELTS"]');
check(studentCards() === 1, 'filter: IELTS filtrida 1 ta o\'quvchi');
click('[data-act="filter-class"][data-class="11-sinf"]');
check(studentCards() === 1, 'filter: 11-sinf filtrida 1 ta o\'quvchi');
click('[data-act="filter-class"][data-class="Barchasi"]');
check(studentCards() === 6, 'filter: "Barchasi" 6 ta o\'quvchi');

setVal('#s-search', 'malika');
check(studentCards() === 1, 'search: "malika" bo\'yicha 1 ta natija');
setVal('#s-search', '');
check(studentCards() === 6, 'search: qidiruv tozalandi');

check(text().includes('Ota-ona') && text().includes('+998 93 111-22-33'), 'student card: ota-ona telefoni ko\'rinadi');
check(qa('#students-list .chip-class').length === 6, 'student card: sinf chipsi mavjud');

/* ---------- 6. O\'quvchi qo\'shish ---------- */
clickAct('open-add-student');
check(q('#modal-overlay').hidden === false, 'modal: o\'quvchi qo\'shish ochildi');
clickAct('save-student');
check(q('#modal-overlay').hidden === false, 'validation: bo\'sh forma saqlanmaydi');

setVal('#f-sname', "Gulnoza Ismoilova");
setVal('#f-sphone', '971112233');
setVal('#f-sparent', '931112233');
q('#f-sclass').value = 'IELTS';
q('#f-sgroup').value = 'g1';
clickAct('save-student');
check(q('#modal-overlay').hidden === true, 'modal: saqlangandan keyin yopildi');
check(studentCards() === 7, 'students: yangi o\'quvchi qo\'shildi (7 ta)');
check(text().includes('Gulnoza Ismoilova'), 'students: yangi ism ro\'yxatda');
check(text().includes('7 ta o\'quvchi'), 'students: hisoblagich yangilandi (7 ta)');

click('[data-act="filter-class"][data-class="IELTS"]');
check(studentCards() === 2, 'filter: qo\'shilgandan keyin IELTS = 2');
click('[data-act="filter-class"][data-class="Barchasi"]');

/* ---------- 7. Guruh qo\'shish ---------- */
click('[data-act="nav"][data-screen="groups"]');
clickAct('open-add-group');
check(q('#modal-overlay').hidden === false, 'modal: guruh qo\'shish ochildi');
setVal('#f-gname', 'Club English');
qa('#f-days input')[0].checked = true;
qa('#f-days input')[4].checked = true;
q('#f-gtime').value = '19:30';
setVal('#f-gfee', '450000');
clickAct('save-group');
check(q('#modal-overlay').hidden === true, 'modal: guruh saqlanib yopildi');
check(groupCards() === 3, 'groups: yangi guruh qo\'shildi (3 ta)');
check(text().includes("450 000 so'm"), 'groups: yangi to\'lov formatlandi');
check(text().includes('Dushanba, Juma'), 'groups: tanlangan kunlar saqlandi');

/* ---------- 8. Chiqish va qayta kirish (avtomatik) ---------- */
click('[data-act="nav"][data-screen="profile"]');
check(text().includes('Hisobdan chiqish'), 'profile: chiqish tugmasi');
check(text().includes('Xavfsizlik') && text().includes('••••'), 'profile: PIN himoyalangan ko\'rinadi');
clickAct('logout');
check(text().includes('Telefon raqam'), 'logout: login ekraniga qaytdi');

setVal('#phone-input', '+998 90 123-45-67');
clickAct('do-login');
check(text().includes('Assalomu alaykum'), 'login: o\'z hisobida PIN\'siz avtomatik kirdi');

/* ---------- 9. Boshqa Telegram hisobi → PIN talab qilinadi ---------- */
click('[data-act="nav"][data-screen="profile"]');
clickAct('switch-account');
check(text().includes('Telefon raqam'), 'switch: login ekrani');
setVal('#phone-input', '+998 90 123-45-67');
clickAct('do-login');
check(text().includes('PIN kodni kiriting'), 'boshqa hisob: PIN ekraniga yuborildi');

setVal('#pin-input', '9999');
clickAct('submit-pin');
check(text().includes('PIN kodni kiriting') && q('#pin-error').textContent.includes("noto'g'ri"), 'boshqa hisob: noto\'g\'ri PIN rad etildi');

setVal('#pin-input', '1234');
clickAct('submit-pin');
check(text().includes('Assalomu alaykum'), 'boshqa hisob: to\'g\'ri PIN bilan kirdi');

/* ============================================================
   STEP 2 — Baholar jurnali, Davomat va rollarni ajratish
   ============================================================ */
const now = new Date();
const pad2 = n => String(n).padStart(2, '0');
const TODAY = now.getFullYear() + '-' + pad2(now.getMonth() + 1) + '-' + pad2(now.getDate());
const forceNav = screen => {
  const b = doc.createElement('button');
  b.setAttribute('data-act', 'nav');
  b.setAttribute('data-screen', screen);
  doc.body.appendChild(b);
  click(b);
  b.remove();
};

/* ---------- 10. Baholar jurnali (ustoz) ---------- */
click('[data-act="nav"][data-screen="grades"]');
check(text().includes('Baholar'), 'baholar: ekran ochildi');
check(!!q('table.bj'), 'baholar: jadval mavjud');
check(qa('.selector-row')[0] && qa('.selector-row')[0].querySelectorAll('.chip-btn').length === 3, 'baholar: 3 ta guruh tanlagich (yangi guruh ham)');
check(qa('.selector-row')[1] && qa('.selector-row')[1].querySelectorAll('.chip-btn').length === 6, 'baholar: sinf tanlagich (Barchasi + 5 sinf)');
check(qa('thead .bj-date').length === 5, 'baholar: 5 ta dars sanasi ustuni');
check(qa('thead .bj-sum').length === 1, 'baholar: oxirida yakuniy ustun');
check(text().includes('Jami:'), 'baholar: "Jami ball" hisoblanadi');
check(text().includes('8–10') && text().includes('6–7') && text().includes('1–5'), 'baholar: rang legendasi (A\'lo/Yaxshi/Qoniqarsiz)');
check(qa('tbody tr').length === 3, 'baholar: IELTS guruhida 3 ta o\'quvchi qatori');
check(qa('tbody .chip-class').length === 3, 'baholar: har qatorda sinf badge');

/* sana ustunini tanlash */
const dateBtns = qa('[data-act="grade-date"]');
click(dateBtns[0]);
check(qa('.bj-date')[0].classList.contains('is-focus'), 'baholar: sana tanlanadi va ustun belgilanadi');

/* ochiq katakchaga baho qo'yish (1-tap) */
let targetCell = qa('.bj-grade.g-empty')[0] || q('.bj-grade');
const tSid = targetCell.getAttribute('data-sid');
const tDate = targetCell.getAttribute('data-date');
const before = targetCell.textContent.trim();
const want = before === '10' ? '1' : '10';
click(targetCell);
check(q('#modal-overlay').hidden === false, 'editor: modal ochildi');
check(qa('.score-btn').length === 10, 'editor: 10 ta ball tugmasi (1–10)');
check(qa('.cat-wrap .chip-btn').length === 4, 'editor: 4 ta vazifa turi');
check(!!q('#grade-note'), 'editor: izoh maydoni mavjud');

click(qa('.score-btn').filter(b => b.getAttribute('data-score') === want)[0]);
check(q('#modal-overlay').hidden === false, 'editor: 1-tap kiritish — modal yopilmadi');
check(q('.editor-info .gr-score').textContent.trim() === want, 'editor: tanlangan ball ko\'rinadi');

const noteIn = q('#grade-note');
noteIn.value = "A'lo faollik";
noteIn.dispatchEvent(new win.Event('input', { bubbles: true }));
click(qa('.cat-wrap .chip-btn')[3]);
click(q('[data-act="close-grade"]'));

const newCell = q('[data-act="edit-grade"][data-sid="' + tSid + '"][data-date="' + tDate + '"]');
check(newCell && newCell.textContent.trim() === want, 'baholar: baho saqlandi (' + want + ')');
const expectCls = Number(want) >= 8 ? 'g-a' : (Number(want) >= 6 ? 'g-b' : 'g-c');
check(newCell && newCell.classList.contains(expectCls), 'baholar: rang kodlash to\'g\'ri (' + expectCls + ')');
check(/Jami: \d+/.test(text()), 'baholar: jami ball hisoblandi');

/* sinf filtri */
const rowsBefore = qa('tbody tr').length;
click(qa('.selector-row')[1].querySelectorAll('.chip-btn')[5]);
const rowsAfter = qa('tbody tr').length;
check(rowsAfter <= rowsBefore && rowsAfter >= 1, 'baholar: sinf filtri qatorlarni qisqartirdi (' + rowsBefore + ' → ' + rowsAfter + ')');
click(qa('.selector-row')[1].querySelectorAll('.chip-btn')[0]);
check(qa('tbody tr').length === rowsBefore, 'baholar: "Barchasi" qaytardi');

/* ---------- 11. Tezkor davomat (ustoz) ---------- */
click('[data-act="open-attendance"]');
check(text().includes('Davomat'), 'davomat: ekran ochildi');
check(q('#att-date').value === TODAY, 'davomat: sana bugungi sana');
check(qa('.att-row').length === 3, 'davomat: IELTS guruhida 3 ta o\'quvchi');
check(qa('.att-row')[0].querySelectorAll('.att-btn').length === 3, 'davomat: 3 ta holat tugmasi (Keldi/Kelmadi/Sababli)');
check(text().includes('Keldi') && text().includes('Kelmadi') && text().includes('Sababli'), 'davomat: tugma matunlari o\'zbekcha');

/* birinchi qatordagi holatni tozalab, aniq holat qo'yamiz */
const active0 = qa('.att-row')[0].querySelector('.att-btn[class*="on-"]');
if (active0) click(active0);
check(!qa('.att-row')[0].querySelector('.att-btn[class*="on-"]'), 'davomat: holatni o\'chirish mumkin');
click(qa('.att-row')[0].querySelector('[data-status="absent"]'));
check(qa('.att-row')[0].querySelector('[data-status="absent"]').classList.contains('on-absent'), 'davomat: "Kelmadi" tanlandi');
/* 2-qator: avval mavjud holatni tozalaymiz (tugma bosilsa toggle bo'ladi) */
const active1 = qa('.att-row')[1].querySelector('.att-btn[class*="on-"]');
if (active1) click(active1);
check(!qa('.att-row')[1].querySelector('.att-btn[class*="on-"]'), 'davomat: 2-qator holati tozalandi');
click(qa('.att-row')[1].querySelector('[data-status="present"]'));
check(qa('.att-row')[1].querySelector('[data-status="present"]').classList.contains('on-present'), 'davomat: "Keldi" tanlandi');
check(text().includes('belgilandi'), 'davomat: hisoblagich ko\'rinadi');

click('[data-act="att-save"]');
check(q('#toast').textContent.includes('Davomat saqlandi'), 'davomat: "Davomatni saqlash" tasdiq toast berdi');

/* saqlangan holat qayta ochilganda saqlanib qoladi */
click('[data-act="nav"][data-screen="grades"]');
click('[data-act="open-attendance"]');
check(qa('.att-row')[0].querySelector('[data-status="absent"]').classList.contains('on-absent'), 'davomat: saqlangan holat tiklandi');

/* ---------- 12. ROL AJRATISH: o\'quvchi portali ---------- */
click('[data-act="nav"][data-screen="profile"]');
clickAct('logout');
check(text().includes('Telefon raqam'), 'student: logout ishladi');

setVal('#phone-input', '+998 91 300-40-50');
clickAct('do-login');
check(text().includes("Ro'yxatdan o'tish"), 'student: ro\'yxatdan o\'tish ekrani');
click('[data-role="student"]');
clickAct('to-pin-create');
setVal('#pin-input', '5678');
clickAct('submit-pin');
setVal('#pin-input', '5678');
clickAct('submit-pin');

check(text().includes('Jasur Karimov'), 'student: portal o\'z ismini ko\'rsatdi');
check(text().includes('8-sinf'), 'student: o\'z maktab sinfi ko\'rsatildi');
check(text().includes('General English'), 'student: o\'z guruhi ko\'rsatildi');
check(q('#app-header').textContent.includes("O'quvchi"), 'student: headerda "O\'quvchi" roli');
check(qa('.nav-item').length === 2, 'student: nav faqat 2 ta (Portim, Profil)');
check(!Array.from(doc.querySelectorAll('.nav-item')).some(n => n.getAttribute('data-screen') === 'students'), 'student: "O\'quvchilar" tabi YO\'Q');
check(!Array.from(doc.querySelectorAll('.nav-item')).some(n => n.getAttribute('data-screen') === 'groups'), 'student: "Guruhlar" tabi YO\'Q');
check(!Array.from(doc.querySelectorAll('.nav-item')).some(n => n.getAttribute('data-screen') === 'grades'), 'student: "Baholar" tabi YO\'Q');

/* Shaxsiy ma'lumotlar */
check(text().includes('Mening baholarim'), 'student: "Mening baholarim" bo\'limi');
check(qa('.grade-row').length > 0, 'student: baholar ro\'yxati bor');
check(!!q('.avg-badge') && /\d\.\d/.test(q('.avg-badge').textContent), 'student: "O\'rtacha baho" badge (8.8 uslubida)');
check(text().includes('Mening davomatim'), 'student: "Mening davomatim" bo\'limi');
check(text().includes("To'lov holati"), 'student: "To\'lov holati" bo\'limi');
check(text().includes("To'langan") || text().includes("To'lov muddati o'tdi"), 'student: to\'lov holati ko\'rsatildi');
check(text().includes('Speaking vaqtim'), 'student: "Speaking vaqtim" bo\'limi');

/* Boshqalarning maxfiy ma'lumotlari KO'RINMASLIGI kerak */
check(!text().includes('Nilufar Ergasheva'), 'maxfiy: boshqa o\'quvchi ismi yo\'q');
check(!text().includes('Aziz Rahimov'), 'maxfiy: boshqa o\'quvchi ismi yo\'q (2)');
check(!text().includes('Malika Yusupova'), 'maxfiy: boshqa o\'quvchi ismi yo\'q (3)');
check(!text().includes('+998 93 111-22-33'), 'maxfiy: boshqa ota-ona telefoni yo\'q');
check(!text().includes('+998 94 555-66-77'), 'maxfiy: boshqa ota-ona telefoni yo\'q (2)');
check(!text().includes('Ota-ona'), 'maxfiy: ota-ona kontaktlari umuman yo\'q');
check(!text().includes("500 000 so'm"), 'maxfiy: guruh to\'lovlari ko\'rinmaydi');

/* To'g'ridan-to'g'ri navigatsiya urinishi bloklandi */
forceNav('students');
check(!text().includes('Ota-ona') && qa('.student-card').length === 0, 'guard: o\'quvchi "O\'quvchilar" ekraniga kira olmaydi');
forceNav('groups');
check(qa('.group-card').length === 0 && !text().includes("500 000 so'm"), 'guard: o\'quvchi "Guruhlar" ekraniga kira olmaydi');
forceNav('grades');
check(qa('table.bj').length === 0, 'guard: o\'quvchi baholar jurnaliga kira olmaydi');
forceNav('attendance');
check(qa('.att-btn').length === 0 && !text().includes('Davomatni saqlash'), 'guard: o\'quvchi davomat boshqaruviga kira olmaydi');
check(text().includes('Jasur Karimov'), 'guard: o\'quvchi o\'z portalida qoladi');

/* Profil: o\'quvchida ustoz demo kartasi yo\'q */
forceNav('profile');
check(!text().includes('Boshqa hisobda sinash'), 'student: profilda ustoz demo kartasi yo\'q');
check(text().includes('Jasur Karimov'), 'student: profilda o\'z ismi');

console.log(failed ? '\n' + failed + ' ta test YIQILDI' : '\nBarcha testlar o\'tdi ✓');
process.exit(failed ? 1 : 0);
