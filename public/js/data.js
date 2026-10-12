'use strict';

/* Step 1 — demo ma'lumotlar (mock data) */
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
  ]
};
