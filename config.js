/* ============================================================
   config.js — ตั้งค่าระบบ (แก้ไฟล์นี้ไฟล์เดียวตอนติดตั้ง)
   ============================================================ */

const CONFIG = {

  // URL ของ Google Apps Script Web App (ใส่ให้แล้ว)
  API_URL: 'https://script.google.com/macros/s/AKfycbyEH1_t67cGUdm_6Mq-4RzkACo7jYrrNonUrwhMAFoNIDGyGh9pDzmiFi5n1qUeVhED/exec',

  // โหมดทดสอบ: true = เข้าใช้ได้เลยโดยไม่ต้อง Login (ทุกคนเป็น Admin)
  // ใช้คู่กับ ALLOW_INSECURE = true ในไฟล์ Config.gs ฝั่ง Apps Script
  // เมื่อทำระบบ Login เสร็จ (README ขั้นตอนที่ 5) ให้เปลี่ยนเป็น false
  // และเปลี่ยน ALLOW_INSECURE ใน Config.gs เป็น false ด้วย
  TEST_MODE: true,

  // Google OAuth Client ID (ได้จาก Google Cloud Console — ใช้ทำระบบ Login)
  GOOGLE_CLIENT_ID: 'PASTE_YOUR_GOOGLE_CLIENT_ID_HERE',

  // ชื่อทีม แสดงบนหัวเว็บ
  APP_TITLE: '🏢 RMA ตารางงานทีม',

  // จำนวนวันก่อนถึงกำหนดที่จะเริ่มเตือนสีเหลือง
  DUE_WARN_DAYS: 3,

  // อายุ cache (มิลลิวินาที) — localStorage เป็นแค่ cache ไม่ใช่ฐานข้อมูล
  CACHE_TTL: 5 * 60 * 1000,
};
