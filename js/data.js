'use strict';

/* Step 3 — demo ma'lumotlar (mock data). Moliyaviy ma'lumotlar YO'Q. */
const APP_DATA = {
  classes: ['8-sinf', '9-sinf', '10-sinf', '11-sinf', 'IELTS'],

  days: ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba'],

  /* Guruhlar: faqat o'quv-jarayon ma'lumotlari (narx/to'lov YO'Q) */
  groups: [
    { id: 'g1', name: 'IELTS Band 7.0', days: 'Dushanba, Chorshanba, Juma', time: '18:00' },
    { id: 'g2', name: 'General English (8–10-sinf)', days: 'Seshanba, Payshanba', time: '17:00' }
  ],

  /* O'quvchilar: ism, sinf, telefon, guruh (ota-ona telefonlari YO'Q) */
  students: [
    { id: 's1', fullName: 'Aziz Rahimov', phone: '+998 90 123-45-67', schoolClass: '9-sinf', groupId: 'g2' },
    { id: 's2', fullName: 'Nilufar Ergasheva', phone: '+998 97 222-33-44', schoolClass: '9-sinf', groupId: 'g2' },
    { id: 's3', fullName: 'Jasur Karimov', phone: '+998 91 300-40-50', schoolClass: '8-sinf', groupId: 'g2' },
    { id: 's4', fullName: 'Dilnoza Qodirova', phone: '+998 99 400-50-60', schoolClass: '10-sinf', groupId: 'g2' },
    { id: 's5', fullName: 'Malika Yusupova', phone: '+998 95 700-80-90', schoolClass: 'IELTS', groupId: 'g1' },
    { id: 's6', fullName: 'Bekzod Alimov', phone: '+998 98 611-22-33', schoolClass: '11-sinf', groupId: 'g1' }
  ],

  /* Kirish tizimi (login + parol) */
  accounts: [
    { login: 'admin', password: '123', role: 'teacher', name: 'Ustoz' },
    { login: 'aziz', password: '123', role: 'student', studentId: 's1', name: 'Aziz Rahimov' },
    { login: 'nilufar', password: '123', role: 'student', studentId: 's2', name: 'Nilufar Ergasheva' },
    { login: 'jasur', password: '123', role: 'student', studentId: 's3', name: 'Jasur Karimov' },
    { login: 'dilnoza', password: '123', role: 'student', studentId: 's4', name: 'Dilnoza Qodirova' },
    { login: 'malika', password: '123', role: 'student', studentId: 's5', name: 'Malika Yusupova' },
    { login: 'bekozd', password: '123', role: 'student', studentId: 's6', name: 'Bekzod Alimov' }
  ],

  /* ---- 10 ballik baholar jurnali ---- */
  gradeCategories: ['Darsdagi javob', "Lug'at", 'Uyga vazifa'],
  speakingCategory: 'Speaking',

  gradeSeeds: {
    s1: [10, 9, 8, 10, 9],
    s2: [9, 8, 9, 7, 8],
    s3: [6, 7, 5, 8, 7],
    s4: [8, 9, 10, 9, 10],
    s5: [9, 10, 9, 10, 8],
    s6: [7, 6, 8, 7, 9]
  },

  gradeNoteSeeds: {
    s1: { 0: "A'lo faollik" },
    s3: { 2: 'Uyga vazifa bajarilmagan' },
    s4: { 4: "Writing juda yaxshi" },
    s6: { 1: "Lug'at qiyin" }
  },

  /* ---- Tezkor davomat ---- */
  attendanceStatuses: [
    { id: 'present', label: 'Keldi', icon: '✓' },
    { id: 'absent', label: 'Kelmadi', icon: '✕' },
    { id: 'excused', label: 'Sababli', icon: '?' }
  ],

  attendanceSeeds: {
    s1: ['present', 'present', 'present', 'present', 'present'],
    s2: ['present', 'present', 'excused', 'present', 'present'],
    s3: ['present', 'absent', 'present', 'present', 'absent'],
    s4: ['present', 'present', 'present', 'present', 'present'],
    s5: ['present', 'excused', 'present', 'present', 'present'],
    s6: ['absent', 'present', 'present', 'absent', 'present']
  },

  /* ---- Speaking (1-on-1) slotlari — sana ishga tushganda qo'yiladi ---- */
  speakingSeed: [
    { start: '14:00', end: '14:20', studentId: 's5' },
    { start: '14:20', end: '14:40', studentId: 's6' },
    { start: '14:40', end: '15:00', studentId: null }
  ]
};
