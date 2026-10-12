'use strict';

/* Step 1–2 — demo ma'lumotlar (mock data) */
const APP_DATA = {
  /* Telegram hisobidan "aniqlangan" telefon (demo) */
  detectedPhone: '+998 90 123-45-67',

  classes: ['8-sinf', '9-sinf', '10-sinf', '11-sinf', 'IELTS'],

  days: ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba'],

  groups: [
    { id: 'g1', name: 'IELTS Band 7.0', days: 'Dushanba, Chorshanba, Juma', time: '18:00', fee: 500000 },
    { id: 'g2', name: 'General English (8–10-sinf)', days: 'Seshanba, Payshanba', time: '17:00', fee: 350000 }
  ],

  students: [
    { id: 's1', fullName: 'Aziz Rahimov', phone: '+998 90 123-45-67', parentPhone: '+998 93 111-22-33', schoolClass: '9-sinf', groupId: 'g2' },
    { id: 's2', fullName: 'Nilufar Ergasheva', phone: '+998 97 222-33-44', parentPhone: '+998 94 555-66-77', schoolClass: '9-sinf', groupId: 'g2' },
    { id: 's3', fullName: 'Jasur Karimov', phone: '+998 91 300-40-50', parentPhone: '+998 91 300-41-51', schoolClass: '8-sinf', groupId: 'g2' },
    { id: 's4', fullName: 'Dilnoza Qodirova', phone: '+998 99 400-50-60', parentPhone: '+998 93 400-51-61', schoolClass: '10-sinf', groupId: 'g2' },
    { id: 's5', fullName: 'Malika Yusupova', phone: '+998 95 700-80-90', parentPhone: '+998 90 700-81-91', schoolClass: 'IELTS', groupId: 'g1' },
    { id: 's6', fullName: 'Bekzod Alimov', phone: '+998 98 611-22-33', parentPhone: '+998 97 611-23-33', schoolClass: '11-sinf', groupId: 'g1' }
  ],

  /* ---- Baholar jurnali (Step 2) ---- */
  gradeCategories: ['Darsdagi javob', "Lug'at / Diktant", 'Uyga vazifa', 'Nazorat ishi'],

  /* So'nggi 5 dars sanasi uchun boshlang'ich baholar (index = sana tartibi) */
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

  /* ---- Davomat (Step 2) ---- */
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

  /* ---- O'quvchi portali (faqat o'z ma'lumoti) ---- */
  payments: {
    s1: { status: 'paid', dueDate: '2026-11-01' },
    s2: { status: 'paid', dueDate: '2026-11-01' },
    s3: { status: 'overdue', dueDate: '2026-10-05' },
    s4: { status: 'paid', dueDate: '2026-11-01' },
    s5: { status: 'paid', dueDate: '2026-11-10' },
    s6: { status: 'overdue', dueDate: '2026-10-10' }
  },

  speaking: {
    s1: { day: 'Yakshanba', time: '11:00' },
    s2: { day: 'Yakshanba', time: '11:30' },
    s3: { day: 'Yakshanba', time: '12:00' },
    s4: { day: 'Yakshanba', time: '12:30' },
    s5: { day: 'Shanba', time: '15:00' },
    s6: { day: 'Shanba', time: '15:30' }
  }
};
