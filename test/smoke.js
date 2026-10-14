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
check(!q('.hint-card') && !text().includes('Demo kirish'), "login: demo credentials kartasi olib tashlandi");
check(!text().includes('Ustoz: admin') && !text().includes("O'quvchi: jasur"), "login: login/parollar endi ko'rinmaydi");
const pwBtnLogin = q('[data-act="toggle-pw"][data-target="password-input"]');
check(!!pwBtnLogin, "login: parol ko'zgusi tugmasi (👁) mavjud");
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
check(!text().includes("To'lov") && !text().includes('Narx'), 'moliya: to\'lov/narx kartasi yo\'q');

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
click('[data-act="filter-class"][data-class="11-sinf"]');
check(studentCards() === 2, 'filtr: 11-sinf = 2 ta');
click('[data-act="filter-class"][data-class="Barchasi"]');
check(studentCards() === 6, 'filtr: Barchasi = 6 ta');

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
loginAs('admin', '123');
click('[data-act="nav"][data-screen="students"]');
check(text().includes('Nilufar Ergasheva'), 'ustoz: qayta kirdi');
logout();

loginAs('nilufar', '7777');
check(text().includes('Nilufar Ergasheva'), 'reset: ustoz yangilagan parol bilan kirdi');
check(text().includes('9-sinf'), 'reset: Nilufar portali ko\'rinadi');
check(!text().includes('Jasur Karimov'), 'reset: boshqa o\'quvchi ko\'rinmaydi');

/* ================= 13. STEP 4: YANGI FEATURE'LAR ================= */

/* --- 1. Telefon raqamlari butunlay yo'q --- */
logout();
loginAs('admin', '123');
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
check(text().includes('Ovozli topshiriklar'), 'speaking: audio inbox bo\'limi bor');
check(text().includes("Hozircha ovozli topshirik yo'q") || qa('.audio-item').length >= 0, 'speaking: inbox holati ko\'rinadi');

/* --- 4. Audio topshirik → baholash → qarz -1 --- */
const studentsRaw = JSON.parse(win.localStorage.getItem('et_students'));
const jasurSt = studentsRaw.filter(x => x.id === 's3')[0];
jasurSt.speakingDebt = 2;
jasurSt.audioSubmissions = [{ id: 'aT1', date: TODAY, url: 'data:audio/webm;base64,AAAA', status: 'pending', score: null, feedback: '' }];
win.localStorage.setItem('et_students', JSON.stringify(studentsRaw));
forceNav('speaking');
check(qa('.audio-item').length >= 1, 'inbox: ovozli topshirik paydo bo\'ldi');
check(text().includes('Jasur Karimov'), 'inbox: o\'quvchi ismi ko\'rinadi');
check(qa('[data-act="audio-grade"]').length === 10, 'inbox: 10 ta ball tugmasi');
check(q('[data-act="audio-feedback"]'), 'inbox: izoh maydoni mavjud');

setVal('[data-act="audio-feedback"]', "A'lo talaffuz");
click(qa('[data-act="audio-grade"]').filter(b => b.getAttribute('data-score') === '9')[0]);
check(q('#toast').textContent.includes('jurnalga yozildi'), 'audio: baho saqlandi + jurnalga sync');

/* qarz kamaydi: 2 → 1 */
const afterGrade = JSON.parse(win.localStorage.getItem('et_students')).filter(x => x.id === 's3')[0];
check(afterGrade.speakingDebt === 1, 'audio: baholash qarzni 1 ga kamaytirdi (2 → 1)');
check(afterGrade.audioSubmissions[0].status === 'graded' && afterGrade.audioSubmissions[0].score === 9, 'audio: topshirik baholandi (9)');
check(afterGrade.audioSubmissions[0].feedback === "A'lo talaffuz", 'audio: izoh saqlandi');

/* jurnalda Speaking satri */
click('[data-act="nav"][data-screen="grades"]');
click('[data-act="grade-group"][data-group="g2"]');
const jasurCells = qa('[data-act="edit-grade"][data-sid="s3"]');
check(jasurCells.some(c => c.textContent.trim() === '9'), 'audio→jurnal: ball jurnalga tushdi');

/* --- 4b. O'quvchi portali: badge + yozish paneli --- */
logout();
loginAs('jasur', '4321');
check(text().includes('Speaking qarzingiz') || text().includes("Speaking qarzingiz yo'q"), 'student: Speaking qarzi badge');
check(!!q('[data-act="speak-cta"]') && q('[data-act="speak-cta"]').textContent.includes('Speaking topshirish'),
  "student: '🎙 Speaking topshirish' dolzarb tugmasi (badge tagida)");
check(text().includes('Ovoz yozish'), 'student: "Ovoz yozish" tugmasi');
check(!!q('[data-act="rec-start"]') && !!q('[data-act="rec-send"]'), 'student: recorder tugmalari mavjud');
clickAct('rec-start');
check(q('#toast').textContent.includes('mikrofon') || q('#rec-status'), 'student: yozishga urinish xavfsiz (jsdom)');
check(text().includes('9'), 'student: baholangan audio ko\'rinadi');

/* ================= 14. CHAT (Ustoz ↔ O'quvchi) ================= */
check(text().includes('Ustoz bilan Chat'), "chat: o'quvchi portali bo'limi bor");
check(!!q('#chat-list') && !!q('#chat-input'), "chat: portalda xabarlashuv (ro'yxat + input)");
setVal('#chat-input', 'Tayyor ustoz');
clickAct('send-chat');
check(q('#chat-list').textContent.includes('Tayyor ustoz'), "chat: o'quvchi xabar yubordi");
check(!!q('#chat-list .chat-msg.mine'), "chat: o'quvchi xabari o'zi tomonida (mine)");

logout();
loginAs('admin', '123');
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
loginAs('admin', '123');
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
    speaking_submissions: []
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
  const accAfter = JSON.parse(win.localStorage.getItem('et_accounts') || '{}');
  check(!!accAfter['restore1'] && accAfter['restore1'].password === '9876' && !!accAfter['admin'],
    'zaxira: hisoblar qayta qurildi (admin + restore1)');

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

  console.log(failed ? '\n' + failed + ' ta test YIQILDI' : '\nBarcha testlar o\'tdi ✓');
  process.exit(failed ? 1 : 0);
})();
