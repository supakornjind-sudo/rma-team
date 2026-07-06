/* ============================================================
   utils.js — ฟังก์ชันช่วยเหลือทั่วไป (วันที่ / สัปดาห์ / สถานะ / toast / export)
   ============================================================ */

const TH_MONTHS = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
                   'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];

const uid = () => 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* ---------- วันที่ ---------- */

function parseDate(str) {
  if (!str) return '';
  str = String(str).trim();
  let m = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${pad2(m[2])}-${pad2(m[3])}`;
  m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) {
    let y = +m[3];
    if (y < 100) y += (y > 60 ? 1900 + 43 : 2000);
    if (y > 2400) y -= 543;
    return `${y}-${pad2(m[2])}-${pad2(m[1])}`;
  }
  const thAbbr = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  for (let i = 0; i < 12; i++) {
    if (str.includes(thAbbr[i]) || str.includes(TH_MONTHS[i])) {
      const d = str.match(/\d{1,2}/);
      if (d) return `${new Date().getFullYear()}-${pad2(i + 1)}-${pad2(d[0])}`;
    }
  }
  return '';
}
const pad2 = n => String(n).padStart(2, '0');

const fmtDate = d => {
  if (!d) return '';
  const p = String(d).slice(0, 10).split('-');
  return p.length === 3 ? `${+p[2]}/${+p[1]}/${p[0]}` : d;
};

function weekKey(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d)) return '';
  d.setDate(d.getDate() - (d.getDay() + 6) % 7);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function weekLabel(mondayStr) {
  const s = new Date(mondayStr + 'T00:00:00');
  const e = new Date(s); e.setDate(e.getDate() + 6);
  const sM = TH_MONTHS[s.getMonth()], eM = TH_MONTHS[e.getMonth()];
  return sM === eM
    ? `สัปดาห์ที่ ${s.getDate()} – ${e.getDate()} ${eM} ${e.getFullYear()}`
    : `สัปดาห์ที่ ${s.getDate()} ${sM} – ${e.getDate()} ${eM} ${e.getFullYear()}`;
}
const monthKey = d => String(d || '').slice(0, 7);
const monthLabel = k => { const p = k.split('-'); return `เดือน${TH_MONTHS[+p[1] - 1]} ${p[0]}`; };

/* ---------- แจ้งเตือนใกล้กำหนด: 'overdue' / 'soon' / '' ---------- */
function dueState(dueStr, isDone) {
  if (isDone) return '';
  const iso = parseDate(dueStr);
  if (!iso) return '';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((new Date(iso + 'T00:00:00') - today) / 86400000);
  if (diff < 0) return 'overdue';
  if (diff <= CONFIG.DUE_WARN_DAYS) return 'soon';
  return '';
}
function dueBadge(dueStr, isDone) {
  const s = dueState(dueStr, isDone);
  if (s === 'overdue') return '<span class="tag due-red">⏰ เลยกำหนด</span>';
  if (s === 'soon')    return '<span class="tag due-yellow">⚠️ ใกล้ถึงกำหนด</span>';
  return '';
}

/* ---------- หมวดสถานะ (ใช้ทำ Dashboard Overview) ---------- */
function statusCategory(s) {
  s = s || '';
  if (/เสร็จ|เรียบร้อย/.test(s)) return 'done';       // เสร็จแล้ว
  if (/ต้องแก้|แก้ไข/.test(s)) return 'fix';           // ต้องแก้ไข
  if (/รอตรวจ|รออนุมัติ/.test(s)) return 'review';     // รอตรวจ
  if (/กำลัง|ขั้นตอน|ส่ง.*แล้ว/.test(s)) return 'doing'; // กำลังทำ
  return 'pending';                                     // รอดำเนินการ / ยังไม่เริ่ม
}
const CAT_LABEL = { pending: 'รอดำเนินการ', doing: 'กำลังทำ', review: 'รอตรวจ', fix: 'ต้องแก้ไข', done: 'เสร็จแล้ว' };

function stcls(s) {
  const c = statusCategory(s);
  return c === 'done' ? 'st-done' : c === 'doing' ? 'st-doing' : c === 'review' ? 'st-wait' : c === 'fix' ? 'st-fix' : 'st-no';
}
const kcls = k => k === 'ผ่าน' ? 'kpi-pass' : k === 'ไม่ผ่าน' ? 'kpi-fail' : 'kpi-wait';

function brandMatch(bstr, chip) {
  if (!chip) return true;
  const s = (bstr || '').toLowerCase();
  return s.includes(chip.toLowerCase()) || /all|ทุก|3 แบรนด์|3 brand/.test(s);
}

/* ---------- จัดกลุ่ม ---------- */
function groupBy(items, keyFn, labelFn, sortFn) {
  const map = {};
  items.forEach(it => { const k = keyFn(it); if (!k) return; (map[k] = map[k] || []).push(it); });
  return Object.keys(map).sort().reverse().map(k => ({ key: k, label: labelFn(k), items: sortFn ? map[k].sort(sortFn) : map[k] }));
}

/* ---------- Toast / Loading ---------- */
function toast(msg, type = 'info', ms = 2600) {
  let el = document.getElementById('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; document.body.appendChild(el); }
  el.textContent = msg;
  el.className = 'show t-' + type;
  clearTimeout(el._t);
  el._t = setTimeout(() => el.className = '', ms);
}
const showLoading = msg => { const o = document.getElementById('loadingOverlay');
  if (o) { o.querySelector('span').textContent = msg || 'กำลังโหลด...'; o.style.display = 'flex'; } };
const hideLoading = () => { const o = document.getElementById('loadingOverlay'); if (o) o.style.display = 'none'; };

/* ---------- อื่นๆ ---------- */
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

function fmtBytes(n) {
  n = +n || 0;
  if (n > 1048576) return (n / 1048576).toFixed(1) + ' MB';
  if (n > 1024) return Math.round(n / 1024) + ' KB';
  return n + ' B';
}
function fileIcon(mimeOrName) {
  const s = String(mimeOrName || '').toLowerCase();
  if (/psd/.test(s)) return '🎨';
  if (/illustrator|\.ai$/.test(s)) return '🖌️';
  if (/pdf/.test(s)) return '📕';
  if (/sheet|excel|xls|csv/.test(s)) return '📊';
  if (/word|doc/.test(s)) return '📘';
  if (/zip|rar|7z|compress/.test(s)) return '🗜️';
  if (/mp4|mov|video/.test(s)) return '🎬';
  if (/image|png|jpg|jpeg/.test(s)) return '🖼️';
  return '📎';
}

// ย่อรูปเป็น dataURL ก่อนอัปโหลด
function compressImage(file, cb, max = 1000, q = 0.8) {
  const r = new FileReader();
  r.onload = e => {
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      if (w > max || h > max) { const k = Math.min(max / w, max / h); w = Math.round(w * k); h = Math.round(h * k); }
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      cv.getContext('2d').drawImage(img, 0, 0, w, h);
      cb(cv.toDataURL('image/jpeg', q));
    };
    img.src = e.target.result;
  };
  r.readAsDataURL(file);
}

/* ---------- Export ---------- */
function downloadFile(name, content, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob(['﻿' + content], { type: mime });   // BOM ให้ Excel อ่านภาษาไทยได้
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
function toCSV(rows, headers) {
  const escCsv = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [headers.map(escCsv).join(','), ...rows.map(r => headers.map(h => escCsv(r[h])).join(','))].join('\n');
}
/** Excel (.xls แบบ HTML): แสดงรูป Thumbnail ในตารางได้ */
function toExcelHTML(rows, headers, imgCols) {
  const cell = (r, h) => imgCols.includes(h) && r[h]
    ? `<td>${String(r[h]).split('|').map(u => u.trim()).filter(Boolean)
        .map(u => `<img src="${esc(u)}" width="90">`).join(' ')}</td>`
    : `<td>${esc(r[h])}</td>`;
  return `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"></head><body>
    <table border="1"><tr>${headers.map(h => `<th style="background:#1e3a5f;color:#fff;">${esc(h)}</th>`).join('')}</tr>
    ${rows.map(r => `<tr>${headers.map(h => cell(r, h)).join('')}</tr>`).join('')}</table></body></html>`;
}
