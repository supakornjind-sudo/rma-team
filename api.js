/* ============================================================
   api.js — ตัวกลางคุยกับ Google Apps Script (ฐานข้อมูล = Google Sheets)
   ทุกคำสั่งอ่าน/เขียนวิ่งผ่านไฟล์นี้ทั้งหมด — ไม่มี Login
   localStorage ใช้เป็น cache ชั่วคราวเท่านั้น
   ============================================================ */

const API = {

  // ชื่อผู้ใช้ (เลือกจาก dropdown "ฉันคือ" บนหัวเว็บ) — ใช้ลง ActivityLog
  userName: 'ไม่ระบุชื่อ',

  /* ---------- ตัวยิงคำขอหลัก ----------
     POST + Content-Type text/plain เพื่อเลี่ยง CORS preflight (มาตรฐาน Apps Script) */
  async call(action, data = {}, opts = {}) {
    if (!CONFIG.API_URL || CONFIG.API_URL.includes('PASTE_')) {
      throw new Error('ยังไม่ได้ตั้งค่า API_URL ใน config.js');
    }
    if (!opts.silent) showLoading(opts.msg || 'กำลังเชื่อมต่อ Google Sheets...');
    try {
      const res = await fetch(CONFIG.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, user: this.userName, data }),
        redirect: 'follow',
      });
      const jsonRes = await res.json();
      if (!jsonRes.ok) throw new Error(jsonRes.error || 'เกิดข้อผิดพลาดจากเซิร์ฟเวอร์');
      return jsonRes.data;
    } finally {
      if (!opts.silent) hideLoading();
    }
  },

  /* ---------- โหลดข้อมูลทั้งหมดครั้งเดียว ---------- */
  async bootstrap(useCache) {
    if (useCache) {
      try {
        const c = JSON.parse(localStorage.getItem('rmaCache') || 'null');
        if (c && Date.now() - c.at < CONFIG.CACHE_TTL) setTimeout(() => window.onDataLoaded?.(c.data, true), 0);
      } catch (e) {}
    }
    const data = await this.call('bootstrap', {}, { msg: 'กำลังโหลดข้อมูลจาก Google Sheets...' });
    try { localStorage.setItem('rmaCache', JSON.stringify({ at: Date.now(), data })); } catch (e) {}
    return data;
  },

  /* ---------- CRUD ทั่วไป (entity = ชื่อชุดข้อมูล) ---------- */
  create(entity, row, opts)     { return this.call('create', { entity, row }, opts || { msg: 'กำลังบันทึก...' }); },
  update(entity, id, row, opts) { return this.call('update', { entity, id, row }, opts || { msg: 'กำลังบันทึก...' }); },
  remove(entity, id)            { return this.call('delete', { entity, id }, { msg: 'กำลังย้ายไปถังขยะ...' }); },

  /* ---------- ลบหัวข้อ/โปรเจกต์แบบยกชุด ---------- */
  deleteProject(projectId) { return this.call('deleteProject', { projectId }, { msg: 'กำลังลบโปรเจกต์...' }); },
  deleteGroup(groupId)     { return this.call('deleteGroup', { groupId }, { msg: 'กำลังลบหมวด...' }); },

  /* ---------- ลิงก์หลายช่องทาง ---------- */
  saveLinks(taskId, links, opts) { return this.call('saveLinks', { taskId, links }, opts || { msg: 'กำลังบันทึกลิงก์...' }); },

  /* ---------- รูปภาพ / ไฟล์แนบ (Google Drive) ---------- */
  async uploadImage(refType, refId, dataUrl) {
    const [meta, b64] = dataUrl.split(',');
    const mime = meta.match(/data:(.*?);/)[1];
    return this.call('uploadImage', { refType, refId, mime, base64: b64 }, { msg: 'กำลังอัปโหลดรูปขึ้น Google Drive...' });
  },
  async uploadFile(refType, refId, file) {
    if (file.size > CONFIG.MAX_FILE_MB * 1024 * 1024)
      throw new Error(`ไฟล์ใหญ่เกิน ${CONFIG.MAX_FILE_MB} MB (ข้อจำกัดของระบบ) — แนะนำอัปโหลดขึ้น Drive เองแล้วแปะลิงก์ในหมายเหตุ`);
    const b64 = await new Promise((ok, no) => {
      const r = new FileReader();
      r.onload = e => ok(e.target.result.split(',')[1]);
      r.onerror = no;
      r.readAsDataURL(file);
    });
    return this.call('uploadFile', { refType, refId, name: file.name, mime: file.type, base64: b64 },
      { msg: `กำลังอัปโหลด ${file.name} ...` });
  },

  /* ---------- Recycle Bin / Version History ---------- */
  restoreTrash(trashId)     { return this.call('restoreTrash', { trashId }, { msg: 'กำลังกู้คืน...' }); },
  purgeTrash(trashId)       { return this.call('purgeTrash', { trashId }, { msg: 'กำลังลบถาวร...' }); },
  getVersions(taskId)       { return this.call('getVersions', { taskId }, { msg: 'กำลังโหลดประวัติ...' }); },
  restoreVersion(versionId) { return this.call('restoreVersion', { versionId }, { msg: 'กำลังย้อนเวอร์ชัน...' }); },
};
