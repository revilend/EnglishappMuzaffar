'use strict';

/* Statik konfiguratsiya — DEMO ma'lumotlar olib tashlandi.
   Guruh/o'quvchi/baholar faqat haqiqiy Supabase bazasidan keladi (toza start). */
const APP_DATA = {
  classes: ['5-sinf', '6-sinf', '7-sinf', '8-sinf', '9-sinf', '10-sinf', '11-sinf'],

  days: ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba'],

  /* Kirish tizimi: faqat ustoz hisobi (o'quvchilar Supabase students jadvalidan keladi) */
  accounts: [
    { login: 'm_amirov', password: '123', role: 'teacher', name: 'Muzaffar Amirov' }
  ],

  /* ---- 10 ballik baholar jurnali ---- */
  gradeCategories: ['Darsdagi javob', "Lug'at", 'Uyga vazifa'],
  speakingCategory: 'Speaking',

  /* ---- Tezkor davomat ---- */
  attendanceStatuses: [
    { id: 'present', label: 'Keldi', icon: '✓' },
    { id: 'absent', label: 'Kelmadi', icon: '✕' },
    { id: 'excused', label: 'Sababli', icon: '?' }
  ]
};
