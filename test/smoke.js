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

console.log(failed ? '\n' + failed + ' ta test YIQILDI' : '\nBarcha testlar o\'tdi ✓');
process.exit(failed ? 1 : 0);
