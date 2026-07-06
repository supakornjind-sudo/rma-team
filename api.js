/* ============================================================
   api.js — ตัวกลางคุยกับ Google Apps Script (ฐานข้อมูล = Google Sheets)
   ทุกคำสั่งอ่าน/เขียนวิ่งผ่านไฟล์นี้ทั้งหมด
   localStorage ใช้เป็น cache ชั่วคราวเท่านั้น
   ============================================================ */

const API = {

  _token: null,          // Google ID token ของผู้ใช้ที่ล็อกอิน

  setToken(t) { this._token = t; },

  /* ---------- ตัวยิงคำขอหลัก ----------
     ใช้ POST + Content-Type text/plain เพื่อเลี่ยง CORS preflight
     (เป็นวิธีมาตรฐานสำหรับ Apps Script Web App) */
  async call(action, data = {}, opts = {}) {
    if (!CONFIG.API_URL || CONFIG.API_URL.includes('PASTE_')) {
      throw new Error('ยังไม่ได้ตั้งค่า API_URL ใน config.js');
    }
    if (!opts.silent) showLoading(opts.msg || 'กำลังเชื่อมต่อ Google Sheets...');
    try {
      const res = await fetch(CONFIG.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, token: this._token, data }),
        redirect: 'follow',
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'เกิดข้อผิดพลาดจากเซิร์ฟเวอร์');
      return json.data;
    } catch (err) {
      if (String(err).includes('AUTH')) {
        toast('เซสชันหมดอายุ กรุณาล็อกอินใหม่', 'error');
        location.reload();
      }
      throw err;
    } finally {
      if (!opts.silent) hideLoading();
    }
  },

  /* ---------- โหลดข้อมูลทั้งหมดครั้งเดียว ---------- */
  async bootstrap(force = false) {
    // ใช้ cache ระหว่างรอของจริง (แสดงผลไวขึ้น) — ไม่ใช่ฐานข้อมูลหลัก
    if (!force) {
      try {
        const c = JSON.parse(localStorage.getItem('rmaCache') || 'null');
        if (c && Date.now() - c.at < CONFIG.CACHE_TTL) setTimeout(() => window.onDataLoaded?.(c.data, true), 0);
      } catch (e) {}
    }
    const data = await this.call('bootstrap', {}, { msg: 'กำลังโหลดข้อมูลจาก Google Sheets...' });
    try { localStorage.setItem('rmaCache', JSON.stringify({ at: Date.now(), data })); } catch (e) {}
    return data;
  },

  /* ---------- CRUD ทั่วไป (entity = ชื่อชีต) ---------- */
  create(entity, row)      { return this.call('create', { entity, row },     { msg: 'กำลังบันทึก...' }); },
  update(entity, id, row)  { return this.call('update', { entity, id, row }, { msg: 'กำลังบันทึก...' }); },
  remove(entity, id)       { return this.call('delete', { entity, id },      { msg: 'กำลังลบ...' }); },

  /* ---------- อัปโหลดรูปขึ้น Google Drive ----------
     ส่ง base64 -> Apps Script สร้างไฟล์ใน Drive -> คืนลิงก์รูป */
  async uploadImage(refType, refId, dataUrl) {
    const [meta, b64] = dataUrl.split(',');
    const mime = meta.match(/data:(.*?);/)[1];
    return this.call('uploadImage', { refType, refId, mime, base64: b64 }, { msg: 'กำลังอัปโหลดรูปขึ้น Google Drive...' });
  },

  /* ---------- จัดการผู้ใช้ (Admin) ---------- */
  setUserRole(email, role, active) { return this.call('setUserRole', { email, role, active }, { msg: 'กำลังบันทึกสิทธิ์...' }); },
};
