/* ============================================================
   config.js — ตั้งค่าระบบ (ไม่มีระบบ Login — เปิดเว็บใช้ได้ทันที)
   ============================================================ */

const CONFIG = {

  // URL ของ Google Apps Script Web App
  API_URL: 'https://script.google.com/macros/s/AKfycbyEH1_t67cGUdm_6Mq-4RzkACo7jYrrNonUrwhMAFoNIDGyGh9pDzmiFi5n1qUeVhED/exec',

  // ชื่อทีม แสดงบนหัวเว็บ
  APP_TITLE: '🏢 RMA ตารางงานทีม',

  // จำนวนวันก่อนถึงกำหนดที่จะเริ่มเตือนสีเหลือง
  DUE_WARN_DAYS: 3,

  // ขนาดไฟล์แนบสูงสุด (MB) — ข้อจำกัดของ Apps Script
  MAX_FILE_MB: 20,

  // อายุ cache (มิลลิวินาที) — localStorage เป็นแค่ cache ชั่วคราว ไม่ใช่ฐานข้อมูล
  CACHE_TTL: 5 * 60 * 1000,

  // Auto Save: หน่วงเวลาหลังพิมพ์เสร็จ (มิลลิวินาที)
  AUTOSAVE_DELAY: 2500,
};
