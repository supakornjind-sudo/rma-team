/* ============================================================
   script.js — ตัวหลักของหน้าเว็บ (UI ทั้งหมด)
   ไม่มีระบบ Login — ทุกคนสิทธิ์เท่ากัน
   ข้อมูลทุกอย่างมาจาก Google Sheets ผ่าน api.js เท่านั้น
   ============================================================ */

/* ================= STATE ================= */
const S = {
  settings: [], members: [], tasks: [], prodTasks: [], links: [], images: [], attachments: [],
  brands: [], dropdowns: [], projects: [], projGroups: [], projItems: [], trash: [],
};
const COLORS = ['#e63e6d','#3f7fd9','#4caf7d','#e67e22','#9b59b6','#16a2b8','#c0392b','#5e7d2a','#d4a017','#7f8c8d'];
const HAIRS  = ['#3b2a1d','#111','#5a3b22','#222','#6d4c2f','#3b2a1d','#111','#5a3b22','#6d4c2f','#222'];

const getMember   = id => S.members.find(m => m.id === id);
const memberColor = m => COLORS[S.members.indexOf(m) % COLORS.length];
const memberName  = id => (getMember(id) || {}).name || '-';
const linksOf     = taskId => S.links.filter(l => l.taskId === taskId);
const imagesOf    = (refType, refId) => S.images.filter(i => i.refType === refType && i.refId === refId);
const filesOf     = (refType, refId) => S.attachments.filter(a => a.refType === refType && a.refId === refId);
const contentOf   = mid => S.tasks.filter(t => t.memberId === mid);
const prodOf      = mid => S.prodTasks.filter(t => t.memberId === mid);

/* ข้อ 7: แผนเดือนที่ "เสร็จสิ้น" + มีวันที่โพสต์จริง จะแสดงในตารางสัปดาห์ด้วย Task ID เดิม (ไม่สร้างซ้ำ) */
const isPlanDone  = t => t.section === 'plan' && t.planStatus === 'เสร็จสิ้น';
const effDate     = t => t.section === 'past' ? t.date : (isPlanDone(t) && t.postDate ? t.postDate : '');
const pastVisible = t => !!effDate(t);
const effMonth    = t => t.section === 'past' ? monthKey(t.date) : t.month;

/* Dropdown: อ่านจากชีต DropdownSettings */
function ddValues(cat) { return S.dropdowns.filter(d => d.category === cat).map(d => d.value); }
function fillDD(selId, cat, current) {
  const el = document.getElementById(selId);
  const vals = ddValues(cat);
  el.innerHTML = vals.map(v => `<option>${esc(v)}</option>`).join('');
  if (current && !vals.includes(current)) el.add(new Option(current, current));
  if (current) el.value = current;
}
function fillBrandDD(selId, current) {
  const el = document.getElementById(selId);
  el.innerHTML = S.brands.map(b => `<option>${esc(b.name)}</option>`).join('');
  if (current && !S.brands.some(b => b.name === current)) el.add(new Option(current, current));
  if (current) el.value = current;
}

/* ================= "ฉันคือ" (ใช้ลง Activity Log — ไม่ใช่ Login) ================= */
function renderWho() {
  const el = document.getElementById('whoSelect');
  const cur = localStorage.getItem('rmaWho') || '';
  el.innerHTML = '<option value="">ไม่ระบุชื่อ</option>' +
    S.members.map(m => `<option ${cur === m.name ? 'selected' : ''}>${esc(m.name)}</option>`).join('');
  API.userName = cur || 'ไม่ระบุชื่อ';
}
function setWho(name) {
  localStorage.setItem('rmaWho', name);
  API.userName = name || 'ไม่ระบุชื่อ';
  toast('บันทึกรายการต่อจากนี้ในชื่อ: ' + (name || 'ไม่ระบุชื่อ'), 'success');
}

/* ================= โหลด / ซิงค์ข้อมูล ================= */
window.onDataLoaded = data => { applyData(data); renderAll(); };

async function refresh(first) {
  try {
    const data = await API.bootstrap(!!first);
    applyData(data);
    renderAll();
  } catch (err) {
    toast('เชื่อมต่อ Google Sheets ไม่สำเร็จ: ' + err.message, 'error', 5000);
  }
}
function applyData(d) {
  Object.keys(S).forEach(k => { if (d[k]) S[k] = d[k]; });
  const title = (S.settings.find(x => x.key === 'appTitle') || {}).value;
  if (title) document.getElementById('appTitle').textContent = title;
}
window.addEventListener('load', () => {
  document.getElementById('appTitle').textContent = CONFIG.APP_TITLE;
  refresh(true);
});

/* ================= NAV ================= */
let currentPerson = null;
function showView(v) {
  document.querySelectorAll('.view').forEach(x => x.classList.remove('active'));
  document.getElementById('view-' + v).classList.add('active');
  document.querySelectorAll('.nav-btn[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === v));
  if (v === 'dashboard') renderDashboard();
  if (v === 'review') renderReview();
  if (v === 'projects') renderProjects();
  if (v === 'trash') renderTrash();
  if (v === 'office') document.getElementById('personJump').value = '';
}
function openPerson(id) {
  currentPerson = id; renderPerson();
  document.querySelectorAll('.view').forEach(x => x.classList.remove('active'));
  document.getElementById('view-person').classList.add('active');
  document.getElementById('personJump').value = id;
}
function renderAll() {
  buildOffice();
  renderWho();
  const pj = document.getElementById('personJump'); const cur = pj.value;
  pj.innerHTML = '<option value="">📋 ตารางงานรายคน...</option>' +
    S.members.map(m => `<option value="${m.id}">📋 ${esc(m.name)}</option>`).join('');
  pj.value = cur;
  const act = document.querySelector('.view.active');
  if (act) {
    if (act.id === 'view-dashboard') renderDashboard();
    if (act.id === 'view-review') renderReview();
    if (act.id === 'view-projects') renderProjects();
    if (act.id === 'view-person') renderPerson();
    if (act.id === 'view-trash') renderTrash();
  }
}

/* ================= RMA PIXEL OFFICE (ดีไซน์ใหม่ — เฉพาะหน้านี้ ระบบเดิมไม่ถูกแตะ) ================= */

/* ---------- Pixel sprite engine (วาดด้วย box-shadow ไม่ใช้ไฟล์รูป) ---------- */
function pxDiv(map, colors, px) {
  const shadows = [];
  map.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = colors[row[x]];
      if (c) shadows.push(`${x * px}px ${y * px}px 0 0 ${c}`);
    }
  });
  return `<div class="px" style="width:${px}px;height:${px}px;background:transparent;box-shadow:${shadows.join(',')};"></div>`;
}

/* ---------- แผนที่ตัวละคร (12 คอลัมน์ — ชุดดำ RMA สไตล์ Reference) ---------- */
const HEAD_STYLES = [
  ['...BBBBBB...', '..BBBBBBBB..', '..BWWBBBBB..'],   // หมวกแก๊ป RMA
  ['....RRRR....', '...RRRRRR...', '..RRRRRRRR..'],   // ผมธรรมชาติ
  ['....RRRR....', '..GRRRRRRG..', '..GRRRRRRG..'],   // หูฟัง
  ['....OOOO....', '...OOOOOO...', '...RRRRRR...'],   // หมวกบีนนี่สีทีม
  ['...DDDDDD...', '..DDDDDDDD..', '.DDDDDDDDDD.'],   // หมวกบักเก็ต
];
const CHAR_BODY = [
  '...SSSSSS...',
  '...SESSES...',
  '...SSSSSS...',
  '....SSSS....',
  '..JJJJJJJJ..',
  '.JJJOOJJJJJ.',
  '.SJJJJJJJJS.',
  '..JJJJJJJJ..',
  '..PPPPPPPP..',
];
const LEGS_A = ['..PP...PP...', '..PP...PP...', '..BB...BB...'];
const LEGS_B = ['...PP.PP....', '..PP...PP...', '.BB.....BB..'];
const HAIR_COLORS = ['#3b2a1d', '#181818', '#5a3b22', '#26170e', '#6d4c2f', '#101010', '#4a3018', '#2e1d10', '#5a3b22', '#181818'];

function charSprite(i, accent) {
  const head = HEAD_STYLES[i % HEAD_STYLES.length];
  const longHair = i % 3 === 1;   // บางคนผมยาวสไตล์ Content Girl
  const body = CHAR_BODY.map((row, r) => (longHair && (r === 4 || r === 5)) ? '.R' + row.slice(2, 10) + 'R.' : row);
  const colors = {
    B: '#14161c', W: '#f2f5fa', R: HAIR_COLORS[i % HAIR_COLORS.length], G: '#4a5468', D: '#3c342a',
    S: '#f2c79a', E: '#232323', J: '#1b1e26', O: accent, P: '#262a34',
  };
  colors['B2'] = colors.B;
  const f1 = pxDiv([...head, ...body, ...LEGS_A], colors, 3);
  const f2 = pxDiv([...head, ...body, ...LEGS_B], colors, 3);
  return `<div class="pxf f1">${f1}</div><div class="pxf f2">${f2}</div>`;
}

/* ---------- แผนที่รถโชว์รูม (สไตล์ Reference: V23 / กระบะ / SUV / ครอสโอเวอร์ / ออฟโรด) ---------- */
const CAR_BOXY = [
  '.....CCCCCCCCCC.........',
  '.....CWWCWWCWWC.........',
  '.....CWWCWWCWWC.........',
  '..CCCCCCCCCCCCCCCCCCC...',
  '.CCCCCCCCCCCCCCCCCCCCL..',
  '.CCCCCCCCCCCCCCCCCCCCL..',
  '..DTTD.........DTTD.....',
  '...TT...........TT......',
];
const CAR_PICKUP = [
  '......CCCCCC............',
  '.....CCWWWWC............',
  '....CCWWWWWC............',
  '..CCCCCCCCCCCCCCCCCCCC..',
  '.CCCCCCCCCCCCCCCCCCCCC..',
  '.LCCCCCCCCCCCCCCCCCCCC..',
  '..DTTD.........DTTD.....',
  '...TT...........TT......',
];
const CAR_SUV = [
  '.......CCCCCCCCC........',
  '......CWWWCWWWCC........',
  '.....CCWWWCWWWCCC.......',
  '..CCCCCCCCCCCCCCCCCC....',
  '.CCCCCCCCCCCCCCCCCCCL...',
  '.CCCCCCCCCCCCCCCCCCCL...',
  '..DTTD........DTTD......',
  '...TT..........TT.......',
];
const SHOWROOM_CARS = [
  { map: CAR_BOXY,   color: '#e0641f' },   // Chery V23 ส้ม
  { map: CAR_PICKUP, color: '#cbb289' },   // กระบะ ทราย
  { map: CAR_SUV,    color: '#c9ced6' },   // SUV เงิน
  { map: CAR_SUV,    color: '#5fa9a2' },   // ครอสโอเวอร์ เขียวมิ้นท์
  { map: CAR_BOXY,   color: '#5c6b3c' },   // ออฟโรด เขียวขี้ม้า
];
function renderShowroomCars() {
  const row = document.getElementById('pxCars');
  if (!row) return;
  row.innerHTML = SHOWROOM_CARS.map(c => {
    const colors = { C: c.color, W: '#9fd0ee', T: '#11141a', D: '#2a2f3a', L: '#ffe9a8' };
    return `<div class="px-bay"><div class="px-car" style="width:72px;height:26px;">${pxDiv(c.map, colors, 3)}</div></div>`;
  }).join('');
}

/* ---------- บอร์ด TODAY'S MISSION (ตัวเลขจริงจากข้อมูลระบบ — อ่านอย่างเดียว) ---------- */
function renderMissionBoard() {
  const set = (id, n) => { const el = document.getElementById(id); if (el) el.textContent = n; };
  const today = new Date();
  const todayISO = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;
  const plan = S.tasks.filter(t => t.section === 'plan');
  const over = plan.filter(t => dueState(t.due, isPlanDone(t)) === 'overdue').length;
  set('mbToday', plan.filter(t => parseDate(t.due) === todayISO && !isPlanDone(t)).length);
  set('mbReview', plan.filter(t => statusCategory(t.planStatus) === 'review').length);
  set('mbOver', over);
  set('mbPost', S.tasks.filter(t => pastVisible(t) && effDate(t) === todayISO).length);
  const alertEl = document.getElementById('mbOverAlert');
  if (alertEl) alertEl.style.display = over > 0 ? '' : 'none';
}

const chars = {};
function buildOffice() {
  const scene = document.getElementById('officeScene');
  scene.querySelectorAll('.char').forEach(e => e.remove());
  renderShowroomCars();
  renderMissionBoard();
  S.members.forEach((m, i) => {
    const cnt = m.role === 'prod' ? prodOf(m.id).length : contentOf(m.id).length;
    const el = document.createElement('div');
    el.className = 'char walking';
    el.innerHTML = `
      <div class="bubble">📋 มีงาน <b>${cnt}</b> ชิ้น</div>
      <div class="nametag">${esc(m.name)}</div>
      <div class="body-wrap">${charSprite(i, memberColor(m))}</div>`;
    const wait = m.role === 'prod'
      ? prodOf(m.id).filter(t => !/เรียบร้อย|เสร็จ/.test(t.status || '')).length
      : contentOf(m.id).filter(t =>
          (t.section === 'past' && t.kpi === 'ไม่ผ่าน') ||
          (t.section === 'plan' && dueState(t.due, isPlanDone(t)) === 'overdue')).length;
    if (wait > 0) { const b = document.createElement('div'); b.className = 'badge'; b.textContent = wait; el.appendChild(b); }
    el.onclick = () => openPerson(m.id);
    scene.appendChild(el);
    const startX = 5 + Math.random() * 85;
    el.style.left = startX + '%'; el.style.top = (60 + Math.random() * 24) + '%';
    chars[m.id] = { el, x: startX };
    wander(m.id);
  });
}
function wander(id) {
  const c = chars[id]; if (!c || !document.body.contains(c.el)) return;
  const target = 3 + Math.random() * 88, dist = Math.abs(target - c.x), dur = dist * 90 + 400;
  c.el.classList.toggle('flip', target < c.x);
  c.el.classList.add('walking');
  c.el.style.transitionDuration = dur + 'ms';
  c.el.style.left = target + '%'; c.x = target;
  setTimeout(() => {
    if (!document.body.contains(c.el)) return;
    c.el.classList.remove('walking');
    if (Math.random() < 0.5) { c.el.classList.add('talk'); setTimeout(() => c.el.classList.remove('talk'), 1800); }
    setTimeout(() => wander(id), 1200 + Math.random() * 2500);
  }, dur);
}

/* ================= ส่วนประกอบตาราง ================= */
function imgCell(refType, refId) {
  const imgs = imagesOf(refType, refId);
  let h = imgs.slice(0, 2).map(im =>
    `<img class="mini-thumb" src="${esc(im.thumb || im.url)}" loading="lazy" onclick="openLightbox('${esc(im.url)}')">`).join('');
  if (imgs.length > 2) h += `<span class="more-imgs">+${imgs.length - 2}</span>`;
  return h || '<span style="color:#c3cfdc;">—</span>';
}
function linkCell(taskId) {
  const ls = linksOf(taskId);
  if (!ls.length) return '<span style="color:#c3cfdc;">—</span>';
  return ls.map(l =>
    `<div><span class="channel-tag">${esc(l.channel)}</span>
      <a class="link-a" href="${esc(l.url)}" target="_blank">🔗</a>
      <small style="color:#7a8aa0;">${l.likes ? '👍' + esc(l.likes) : ''}${l.shares ? ' ↗' + esc(l.shares) : ''}</small></div>`).join('');
}
function topicCell(t, kind, textField) {
  const txt = t[textField] || '';
  const note = t.note || '';
  const nFiles = filesOf(kind === 'c' ? 'task' : kind === 'p' ? 'prod' : 'proj', t.id).length;
  return `<td class="topic-cell"><span class="topic-link" onclick="viewTask('${kind}','${t.id}')">${esc(txt)}</span>
    ${nFiles ? `<span class="more-imgs">📎${nFiles}</span>` : ''}
    ${note ? `<span class="note-sub">📝 ${esc(note)}</span>` : ''}</td>`;
}
function actBtns(kind, id) {
  return `<td style="white-space:nowrap;"><button class="dup-btn" title="Duplicate" onclick="dupTask('${kind}','${id}')">📄</button><button class="edit-btn" title="แก้ไข" onclick="edit('${kind}','${id}')">✏️</button><button class="del-btn" title="ลบ (ไปถังขยะ)" onclick="delAny('${kind}','${id}')">🗑️</button></td>`;
}
function collapsible(label, count, extra, bodyHtml) {
  return `<div class="group-card">
    <div class="group-head" onclick="this.parentElement.classList.toggle('closed')">
      <h4>📅 ${label}</h4><span class="gh-count">${count} งาน${extra || ''}</span><span class="arrow">▼</span></div>
    <div class="group-body">${bodyHtml}</div></div>`;
}

function pastTable(rows, withPerson) {
  const head = `<tr>${withPerson ? '<th>คนทำ</th>' : ''}<th>วันที่โพส</th><th>ประเภท</th><th>ชื่องาน</th><th>ฝ่าย</th><th>แบรนด์</th><th>เพจ</th><th>KPI</th><th>ลิงก์ทุกช่องทาง</th><th>รูป</th><th></th></tr>`;
  return `<table>${head}${rows.map(t => {
    const m = getMember(t.memberId), mc = m ? memberColor(m) : '#8395ab';
    const fromPlan = t.section === 'plan' ? ' <span class="more-imgs" title="มาจากแผนเดือน (Task ID เดียวกัน)">🗓️</span>' : '';
    return `<tr>${withPerson ? `<td><span class="tag" style="background:${mc}22;color:${mc}">${m ? esc(m.name) : '-'}</span></td>` : ''}
      <td>${fmtDate(effDate(t))}${fromPlan}</td><td><span class="tag type-tag">${esc(t.type)}</span></td>${topicCell(t, 'c', 'topic')}
      <td>${esc(t.dept)}</td><td>${esc(t.brand)}</td><td>${esc(t.pages)}</td>
      <td><span class="tag ${kcls(t.kpi || 'รอผล')}">${esc(t.kpi || 'รอผล')}</span></td>
      <td style="text-align:left;min-width:130px;">${linkCell(t.id)}</td>
      <td style="min-width:76px;">${imgCell('task', t.id)}</td>${actBtns('c', t.id)}</tr>`;
  }).join('')}</table>`;
}
function planTable(rows) {
  const head = `<tr><th>ลำดับ</th><th>สถานะขั้นตอน</th><th>ประเภท</th><th>ชื่องาน</th><th>แบรนด์</th><th>เพจ</th><th>ฝ่าย</th><th>กำหนดออนแอร์</th><th>โพสต์จริง</th><th>รูป</th><th></th></tr>`;
  rows = rows.slice().sort((a, b) => (+a.planOrder || 0) - (+b.planOrder || 0));
  return `<table>${head}${rows.map(t => `<tr>
    <td>${esc(t.planOrder)}</td>
    <td><span class="tag ${stcls(t.planStatus)}">${esc(t.planStatus)}</span></td>
    <td><span class="tag type-tag">${esc(t.type)}</span></td>${topicCell(t, 'c', 'topic')}
    <td>${esc(t.brand)}</td><td>${esc(t.pages)}</td><td>${esc(t.dept)}</td>
    <td>${esc(t.due)} ${dueBadge(t.due, isPlanDone(t))}</td>
    <td>${t.postDate ? fmtDate(t.postDate) + ' ✅' : ''}</td>
    <td style="min-width:76px;">${imgCell('task', t.id)}</td>${actBtns('c', t.id)}</tr>`).join('')}</table>`;
}
function prodTable(rows) {
  const head = `<tr><th>วันที่รับงาน</th><th>ความด่วน</th><th>จากสาขา</th><th>รายการงาน / ปัญหา</th><th>ผู้ส่งงานต่อ</th><th>ส่งแบบ/ซ่อม</th><th>เสร็จ/รับของ</th><th>สถานะ</th><th>รูป</th><th></th></tr>`;
  rows = rows.slice().sort((a, b) => (b.recv || '').localeCompare(a.recv || ''));
  return `<table>${head}${rows.map(t => `<tr>
    <td>${fmtDate(t.recv)}</td><td><span class="tag ${/ด่วน/.test(t.urg) ? 'urgent' : 'normal'}">${esc(t.urg)}</span></td>
    <td>${esc(t.branch)}</td>${topicCell(t, 'p', 'detail')}<td>${esc(t.fwd)}</td><td>${esc(t.send)}</td><td>${esc(t.done)}</td>
    <td><span class="tag ${stcls(t.status)}">${esc(t.status)}</span></td>
    <td style="min-width:76px;">${imgCell('prod', t.id)}</td>${actBtns('p', t.id)}</tr>`).join('')}</table>`;
}
function projTable(items) {
  const head = `<tr><th>สถานะงาน</th><th>ขั้นตอน / รายละเอียด</th><th>จำนวน</th><th>พื้นที่/สาขา</th><th>Brand</th><th>ขนาด</th><th>ผู้รับผิดชอบ</th><th>กำหนด</th><th>รูป</th><th></th></tr>`;
  return `<table>${head}${items.map(t => `<tr>
    <td><span class="tag ${stcls(t.status)}">${esc(t.status)}</span></td>${topicCell(t, 'j', 'detail')}
    <td>${esc(t.qty)}</td><td>${esc(t.area)}</td><td>${esc(t.brand)}</td><td>${esc(t.size)}</td><td>${esc(t.owner)}</td>
    <td>${esc(t.due)} ${dueBadge(t.due, /เสร็จ|เรียบร้อย/.test(t.status || ''))}</td>
    <td style="min-width:76px;">${imgCell('proj', t.id)}</td>${actBtns('j', t.id)}</tr>`).join('')}</table>`;
}

/* ================= PERSON VIEW ================= */
const filters = { person: { brand: '' }, review: { brand: '', mode: 'week', cat: '' }, proj: { sel: '' }, dash: { tab: 'overview' } };

function brandChips(cid, fkey, onPick) {
  const cur = filters[fkey].brand;
  document.getElementById(cid).innerHTML =
    `<button class="chip ${cur === '' ? 'on' : ''}" onclick="${onPick}('')">ทั้งหมด</button>` +
    S.brands.map(b => `<button class="chip ${cur === b.name ? 'on' : ''}" onclick="${onPick}('${esc(b.name)}')">${esc(b.name)}</button>`).join('') +
    `<button class="chip add-chip" onclick="addBrandQuick()">+ เพิ่มแบรนด์</button>`;
}
window.pickPersonBrand = b => { filters.person.brand = b; renderPerson(); };
window.pickReviewBrand = b => { filters.review.brand = b; renderReview(); };

function renderPerson() {
  const m = getMember(currentPerson); if (!m) return showView('office');
  document.getElementById('pAvatar').style.background = memberColor(m);
  document.getElementById('pAvatar').textContent = m.name[0];
  document.getElementById('pName').textContent =
    (m.role === 'prod' ? 'ตารางติดตามงานผลิตและซ่อมบำรุง ของ: ' : 'ตารางสรุปผลงานและแผนงาน ของ: ') + m.name;
  document.getElementById('pSub').textContent = m.dept ? 'รับผิดชอบ: ' + m.dept : '';
  const stat = (n, l) => `<div class="stat"><div class="num">${n}</div><div class="lbl">${l}</div></div>`;
  const secEl = document.getElementById('personSections');

  if (m.role === 'prod') {
    document.getElementById('personChipsCard').style.display = 'none';
    const rows = prodOf(m.id);
    document.getElementById('pStats').innerHTML =
      stat(rows.length, 'งานทั้งหมด') +
      stat(rows.filter(t => /เรียบร้อย|เสร็จ/.test(t.status || '')).length, 'เสร็จแล้ว ✅') +
      stat(rows.filter(t => /รอ/.test(t.status || '')).length, 'รอดำเนินการ ⏳') +
      stat(rows.filter(t => /ด่วน/.test(t.urg || '')).length, 'งานด่วน 🔥');
    secEl.innerHTML = `<div class="sec-block">
      <div class="sec-head sec-prod"><h3>🛠️ ตารางติดตามงานผลิตและซ่อมบำรุง</h3>
        <span class="sec-sub">Production & Tracking Sheet</span>
        <button class="btn small" onclick="edit('p',null,'${m.id}')">➕ เพิ่มงาน</button></div>
      <div class="card" style="overflow-x:auto;">${rows.length ? prodTable(rows) : '<div style="text-align:center;color:#7a8aa0;">ยังไม่มีงาน</div>'}</div></div>`;
    return;
  }

  document.getElementById('personChipsCard').style.display = '';
  brandChips('personChips', 'person', 'pickPersonBrand');
  const all = contentOf(m.id).filter(t => brandMatch(t.brand, filters.person.brand));
  const past = all.filter(pastVisible);                       // รวมงานแผนที่เสร็จสิ้น (Task ID เดิม)
  const plan = all.filter(t => t.section === 'plan');
  document.getElementById('pStats').innerHTML =
    stat(past.length, 'ผลงานที่ลงแล้ว') +
    stat(past.filter(t => t.kpi === 'ผ่าน').length, 'ผ่าน KPI ✅') +
    stat(past.filter(t => t.kpi === 'ไม่ผ่าน').length, 'ไม่ผ่าน ❌') +
    stat(plan.length, 'แผนงานเดือน 🗓️') +
    stat(plan.filter(t => dueState(t.due, isPlanDone(t)) === 'overdue').length, 'เลยกำหนด ⏰');

  const weekGroups = groupBy(past, t => weekKey(effDate(t)), weekLabel,
    (a, b) => effDate(b).localeCompare(effDate(a)));
  const monthGroups = groupBy(plan, t => t.month || '', monthLabel);
  secEl.innerHTML = `
    <div class="sec-block">
      <div class="sec-head sec-past"><h3>📈 1. ผลงานที่ลงไปแล้ว</h3>
        <span class="sec-sub">Past Week Content & KPI Tracker · แยกตารางรายสัปดาห์อัตโนมัติ</span>
        <button class="btn small" onclick="edit('c',null,'${m.id}','past')">➕ เพิ่มผลงาน</button></div>
      ${weekGroups.length ? weekGroups.map(g => collapsible(g.label, g.items.length,
        ' · ผ่าน KPI ' + g.items.filter(t => t.kpi === 'ผ่าน').length, pastTable(g.items, false))).join('')
        : '<div class="card" style="text-align:center;color:#7a8aa0;">ยังไม่มีผลงาน</div>'}
    </div>
    <div class="sec-block">
      <div class="sec-head sec-plan"><h3>🗓️ 2. แผนงานคอนเทนต์/แคมเปญประจำเดือน</h3>
        <span class="sec-sub">Monthly Content Plan · "เสร็จสิ้น" + วันโพสต์จริง = โชว์ในตารางสัปดาห์อัตโนมัติ (งานเดียวกัน ไม่สร้างซ้ำ)</span>
        <button class="btn small" onclick="edit('c',null,'${m.id}','plan')">➕ เพิ่มแผน</button></div>
      ${monthGroups.length ? monthGroups.map(g => collapsible(g.label, g.items.length,
        ' · เสร็จสิ้น ' + g.items.filter(t => t.planStatus === 'เสร็จสิ้น').length, planTable(g.items))).join('')
        : '<div class="card" style="text-align:center;color:#7a8aa0;">ยังไม่มีแผนงาน</div>'}
    </div>`;
}

/* ================= REVIEW + ค้นหาขั้นสูง + Drill Down ================= */
function drill(f) {
  filters.review.brand = f.brand || '';
  filters.review.cat = f.cat || '';
  showView('review');
  const set = (id, v) => { const el = document.getElementById(id); el.value = v || ''; };
  set('fPerson', f.person); set('fMonth', f.month); set('fStatus', f.status);
  set('fChannel', f.channel); set('fType', f.type); set('fSection', f.section);
  document.getElementById('fSearch').value = f.q || '';
  renderReview();
}
window.drill = drill;

function renderReview() {
  brandChips('reviewChips', 'review', 'pickReviewBrand');
  const mt = document.getElementById('reviewMode');
  mt.className = 'mode-tog';
  mt.innerHTML = `<button class="${filters.review.mode === 'week' ? 'on' : ''}" onclick="filters.review.mode='week';renderReview()">รายสัปดาห์</button>
                  <button class="${filters.review.mode === 'month' ? 'on' : ''}" onclick="filters.review.mode='month';renderReview()">รายเดือน</button>`;

  fillFilterSelect('fPerson', S.members.filter(m => m.role !== 'prod').map(m => [m.id, m.name]), 'ผู้รับผิดชอบ: ทุกคน');
  fillFilterSelect('fMonth', [...new Set(S.tasks.map(effMonth).filter(Boolean))].sort().reverse().map(k => [k, monthLabel(k)]), 'เดือน: ทั้งหมด');
  fillFilterSelect('fStatus', [...new Set([...S.tasks.map(t => t.kpi), ...S.tasks.map(t => t.planStatus)].filter(Boolean))].map(v => [v, v]), 'สถานะ: ทั้งหมด');
  fillFilterSelect('fChannel', ddValues('channel').map(v => [v, v]), 'ช่องทาง: ทั้งหมด');
  fillFilterSelect('fType', ddValues('contentType').map(v => [v, v]), 'ประเภทงาน: ทั้งหมด');

  const q = (document.getElementById('fSearch').value || '').toLowerCase();
  const fp = fVal('fPerson'), fm = fVal('fMonth'), fs = fVal('fStatus'),
        fc = fVal('fChannel'), ft = fVal('fType'), fsec = fVal('fSection');

  let rows = S.tasks.filter(t =>
    brandMatch(t.brand, filters.review.brand) &&
    (!fp || t.memberId === fp) &&
    (!fm || effMonth(t) === fm) &&
    (!fs || t.kpi === fs || t.planStatus === fs) &&
    (!filters.review.cat || statusCategory(t.section === 'plan' ? t.planStatus : 'เสร็จสิ้น') === filters.review.cat) &&
    (!ft || t.type === ft) &&
    (!fc || linksOf(t.id).some(l => l.channel === fc)) &&
    (!fsec || t.section === fsec) &&
    (!q || (t.topic + ' ' + (t.note || '') + ' ' + (t.dept || '')).toLowerCase().includes(q))
  );
  const past = rows.filter(pastVisible);
  const plan = rows.filter(t => t.section === 'plan');

  const stat = (n, l) => `<div class="stat"><div class="num">${n}</div><div class="lbl">${l}</div></div>`;
  document.getElementById('reviewStats').innerHTML =
    stat(rows.length, 'งานที่พบ' + (filters.review.brand ? ' (' + filters.review.brand + ')' : '') + (filters.review.cat ? ' · ' + CAT_LABEL[filters.review.cat] : '')) +
    stat(past.filter(t => t.kpi === 'ผ่าน').length, 'ผ่าน KPI ✅') +
    stat(past.filter(t => t.kpi === 'ไม่ผ่าน').length, 'ไม่ผ่าน ❌') +
    stat(plan.filter(t => t.planStatus !== 'เสร็จสิ้น').length, 'แผนที่ค้างอยู่ 🗓️');

  let html = '';
  if (!fsec || fsec === 'past') {
    const groups = filters.review.mode === 'month'
      ? groupBy(past, t => monthKey(effDate(t)), monthLabel)
      : groupBy(past, t => weekKey(effDate(t)), weekLabel);
    html += groups.map(g => collapsible(g.label, g.items.length,
      ' · ผ่าน KPI ' + g.items.filter(t => t.kpi === 'ผ่าน').length,
      pastTable(g.items.sort((a, b) => effDate(b).localeCompare(effDate(a))), true))).join('');
  }
  if (fsec === 'plan') {
    const groups = groupBy(plan, t => t.month || '', monthLabel);
    html += groups.map(g => collapsible(g.label + ' (แผนงาน)', g.items.length, '', planTable(g.items))).join('');
  }
  document.getElementById('reviewGroups').innerHTML = html || '<div class="card" style="text-align:center;color:#7a8aa0;">ไม่พบงานตามเงื่อนไข</div>';
}
const fVal = id => document.getElementById(id).value;
function fillFilterSelect(id, pairs, first) {
  const el = document.getElementById(id); const cur = el.value;
  el.innerHTML = `<option value="">${first}</option>` + pairs.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('');
  el.value = cur;
}
document.addEventListener('DOMContentLoaded', () => {
  ['fSearch','fPerson','fMonth','fStatus','fChannel','fType','fSection'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener(id === 'fSearch' ? 'input' : 'change',
      debounce(() => { filters.review.cat = ''; renderReview(); }, 250));
  });
});

/* ================= DASHBOARD (6 หมวด + Drill Down) ================= */
const DASH_TABS = [
  ['overview', '📌 ภาพรวม'], ['content', '📣 KPI Content'], ['perf', '📈 KPI Performance'],
  ['brand', '🏷️ แบรนด์'], ['member', '👥 สมาชิก'], ['monthly', '📅 รายเดือน'],
];
function renderDashboard() {
  document.getElementById('dashTabs').innerHTML = DASH_TABS.map(([k, l]) =>
    `<button class="chip ${filters.dash.tab === k ? 'on' : ''}" onclick="filters.dash.tab='${k}';renderDashboard()">${l}</button>`).join('');
  const el = document.getElementById('dashBody');
  const tab = filters.dash.tab;
  if (tab === 'overview') el.innerHTML = dashOverview();
  if (tab === 'content')  el.innerHTML = dashContent();
  if (tab === 'perf')     el.innerHTML = dashPerf();
  if (tab === 'brand')    el.innerHTML = dashBrand();
  if (tab === 'member')   el.innerHTML = dashMember();
  if (tab === 'monthly')  el.innerHTML = dashMonthly();
}
const statCard = (n, l, drillJs, color) =>
  `<div class="stat clickable" onclick="${drillJs || ''}"><div class="num" style="color:${color || '#1e3a5f'}">${n}</div><div class="lbl">${l}</div></div>`;

function taskCat(t) { return t.section === 'plan' ? statusCategory(t.planStatus) : 'done'; }

function dashOverview() {
  const all = S.tasks;
  const cats = { pending: 0, doing: 0, review: 0, fix: 0, done: 0 };
  all.forEach(t => cats[taskCat(t)]++);
  const overdue = all.filter(t => t.section === 'plan' && dueState(t.due, isPlanDone(t)) === 'overdue');
  const pct = all.length ? Math.round(cats.done / all.length * 100) : 0;
  return `<div class="stats">
    ${statCard(all.length, 'งานทั้งหมด', `drill({})`)}
    ${statCard(cats.pending, 'รอดำเนินการ ⏳', `drill({cat:'pending',section:'plan'})`, '#8395ab')}
    ${statCard(cats.doing, 'กำลังทำ 🔨', `drill({cat:'doing',section:'plan'})`, '#2c5d9e')}
    ${statCard(cats.review, 'รอตรวจ 🔎', `drill({cat:'review',section:'plan'})`, '#a07b12')}
    ${statCard(cats.fix, 'ต้องแก้ไข 🛠️', `drill({cat:'fix',section:'plan'})`, '#c0392b')}
    ${statCard(cats.done, 'เสร็จแล้ว ✅', `drill({cat:'done'})`, '#1c7c47')}
    ${statCard(overdue.length, 'เกินกำหนด ⏰', `drill({cat:'pending',section:'plan'})`, '#c0392b')}
  </div>
  <div class="dash-grid">
    <div class="card" style="text-align:center;"><strong style="color:#1e3a5f;">เปอร์เซ็นต์งานสำเร็จ</strong>
      <div class="pct-ring" style="margin:14px 0;">${pct}%</div>
      <div class="bar-track" style="height:14px;"><div class="bar-fill" style="width:${pct}%"></div></div></div>
    <div class="card"><strong style="color:#1e3a5f;">⏰ งานใกล้ถึงกำหนด / เลยกำหนด</strong><div style="margin-top:10px;">${dueList()}</div></div>
  </div>`;
}
function dueList() {
  const plan = S.tasks.filter(t => t.section === 'plan');
  const overdue = plan.filter(t => dueState(t.due, isPlanDone(t)) === 'overdue');
  const soon = plan.filter(t => dueState(t.due, isPlanDone(t)) === 'soon');
  if (!overdue.length && !soon.length) return '<div style="color:#7a8aa0;font-size:13px;">ไม่มีงานใกล้ถึงกำหนด 🎉</div>';
  return [...overdue.map(t => ({ t, cls: 'due-red', txt: 'เลยกำหนด' })), ...soon.map(t => ({ t, cls: 'due-yellow', txt: 'ใกล้กำหนด' }))]
    .map(({ t, cls, txt }) => `<div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;font-size:12.5px;">
      <span class="tag ${cls}">${txt}</span>
      <span class="topic-link" style="flex:1;" onclick="viewTask('c','${t.id}')">${esc(t.topic)}</span>
      <span style="color:#7a8aa0;">${esc(memberName(t.memberId))} · ${esc(t.due)}</span></div>`).join('');
}
function dashContent() {
  const posts = S.tasks.filter(pastVisible);
  const byBrand = countBy(posts, t => t.brand);
  const byType = countBy(posts, t => t.type);
  const byChannel = {};
  posts.forEach(t => linksOf(t.id).forEach(l => { byChannel[l.channel] = (byChannel[l.channel] || 0) + 1; }));
  return `<div class="stats">${statCard(posts.length, 'จำนวนโพสต์ทั้งหมด', `drill({section:'past'})`)}</div>
    <div class="dash-grid">
      <div class="card"><strong style="color:#1e3a5f;">โพสต์แต่ละแบรนด์</strong>${bars(byBrand, k => `drill({brand:'${k}',section:'past'})`)}</div>
      <div class="card"><strong style="color:#1e3a5f;">โพสต์แต่ละช่องทาง</strong>${bars(Object.entries(byChannel).sort((a,b)=>b[1]-a[1]), k => `drill({channel:'${k}',section:'past'})`)}</div>
      <div class="card"><strong style="color:#1e3a5f;">โพสต์แต่ละประเภทงาน</strong>${bars(byType, k => `drill({type:'${k}',section:'past'})`)}</div>
    </div>`;
}
function dashPerf() {
  const rows = S.links
    .map(l => ({ l, t: S.tasks.find(t => t.id === l.taskId) }))
    .filter(x => x.t)
    .sort((a, b) => (a.l.channel || '').localeCompare(b.l.channel || ''));
  if (!rows.length) return '<div class="card" style="text-align:center;color:#7a8aa0;">ยังไม่มีลิงก์ในระบบ</div>';
  return `<div class="card" style="overflow-x:auto;"><strong style="color:#1e3a5f;">Like / Share แยกตามลิงก์และช่องทาง (ไม่รวมยอด)</strong>
    <table class="dash-table" style="margin-top:10px;"><tr><th>ช่องทาง</th><th>ชื่องาน</th><th>แบรนด์</th><th>ผู้รับผิดชอบ</th><th>Like</th><th>Share</th><th>ลิงก์</th></tr>
    ${rows.map(({ l, t }) => `<tr>
      <td><span class="channel-tag">${esc(l.channel)}</span></td>
      <td class="topic-cell"><span class="topic-link" onclick="viewTask('c','${t.id}')">${esc(t.topic)}</span></td>
      <td>${esc(t.brand)}</td><td>${esc(memberName(t.memberId))}</td>
      <td>${esc(l.likes)}</td><td>${esc(l.shares)}</td>
      <td><a class="link-a" href="${esc(l.url)}" target="_blank">🔗</a></td></tr>`).join('')}</table></div>`;
}
function dashBrand() {
  return `<div class="card" style="overflow-x:auto;"><strong style="color:#1e3a5f;">สรุปตามแบรนด์ (กดแถวเพื่อดูรายการงาน)</strong>
    <table class="dash-table" style="margin-top:10px;"><tr><th>แบรนด์</th><th>งานทั้งหมด</th><th>เสร็จแล้ว</th><th>งานค้าง</th><th>เกินกำหนด</th></tr>
    ${S.brands.map(b => {
      const ts = S.tasks.filter(t => brandMatch(t.brand, b.name));
      const done = ts.filter(t => taskCat(t) === 'done').length;
      const od = ts.filter(t => t.section === 'plan' && dueState(t.due, isPlanDone(t)) === 'overdue').length;
      return `<tr style="cursor:pointer;" onclick="drill({brand:'${esc(b.name)}'})">
        <td><strong>${esc(b.name)}</strong></td><td>${ts.length}</td>
        <td style="color:#1c7c47;">${done}</td><td style="color:#a07b12;">${ts.length - done}</td>
        <td style="color:#c0392b;">${od}</td></tr>`;
    }).join('')}</table></div>`;
}
function dashMember() {
  return `<div class="card" style="overflow-x:auto;"><strong style="color:#1e3a5f;">สรุปตามสมาชิก (กดแถวเพื่อดูรายการงาน)</strong>
    <table class="dash-table" style="margin-top:10px;"><tr><th>สมาชิก</th><th>งานทั้งหมด</th><th>เสร็จแล้ว</th><th>งานค้าง</th><th>เกินกำหนด</th></tr>
    ${S.members.filter(m => m.role !== 'prod').map(m => {
      const ts = contentOf(m.id);
      const done = ts.filter(t => taskCat(t) === 'done').length;
      const od = ts.filter(t => t.section === 'plan' && dueState(t.due, isPlanDone(t)) === 'overdue').length;
      return `<tr style="cursor:pointer;" onclick="drill({person:'${m.id}'})">
        <td><strong>${esc(m.name)}</strong></td><td>${ts.length}</td>
        <td style="color:#1c7c47;">${done}</td><td style="color:#a07b12;">${ts.length - done}</td>
        <td style="color:#c0392b;">${od}</td></tr>`;
    }).join('')}</table></div>`;
}
function dashMonthly() {
  const byMonth = {};
  S.tasks.forEach(t => { const k = effMonth(t); if (!k) return;
    byMonth[k] = byMonth[k] || { total: 0, done: 0, od: 0 };
    byMonth[k].total++;
    if (taskCat(t) === 'done') byMonth[k].done++;
    if (t.section === 'plan' && dueState(t.due, isPlanDone(t)) === 'overdue') byMonth[k].od++;
  });
  const keys = Object.keys(byMonth).sort().reverse();
  const barData = keys.map(k => [monthLabel(k), byMonth[k].total, k]);
  return `<div class="dash-grid">
    <div class="card"><strong style="color:#1e3a5f;">กราฟจำนวนงานรายเดือน (กดเพื่อดูรายการ)</strong>
      ${barData.length ? barData.map(([label, n, k]) => barRow(label, n, Math.max(...barData.map(x => x[1])), `drill({month:'${k}'})`)).join('') : '<div style="color:#7a8aa0;font-size:13px;margin-top:8px;">ยังไม่มีข้อมูล</div>'}</div>
    <div class="card" style="overflow-x:auto;"><strong style="color:#1e3a5f;">สรุปรายเดือน</strong>
      <table class="dash-table" style="margin-top:10px;"><tr><th>เดือน</th><th>งานทั้งหมด</th><th>เสร็จ</th><th>ค้าง</th><th>เกินกำหนด</th></tr>
      ${keys.map(k => `<tr style="cursor:pointer;" onclick="drill({month:'${k}'})">
        <td>${monthLabel(k)}</td><td>${byMonth[k].total}</td>
        <td style="color:#1c7c47;">${byMonth[k].done}</td>
        <td style="color:#a07b12;">${byMonth[k].total - byMonth[k].done}</td>
        <td style="color:#c0392b;">${byMonth[k].od}</td></tr>`).join('')}</table></div>
  </div>`;
}
function countBy(arr, keyFn) {
  const m = {};
  arr.forEach(x => { const k = keyFn(x) || 'ไม่ระบุ'; m[k] = (m[k] || 0) + 1; });
  return Object.entries(m).sort((a, b) => b[1] - a[1]);
}
function bars(entries, drillFn) {
  if (!entries.length) return '<div style="color:#7a8aa0;font-size:13px;margin-top:8px;">ยังไม่มีข้อมูล</div>';
  const max = Math.max(...entries.map(e => e[1]));
  return '<div style="margin-top:10px;">' + entries.slice(0, 12).map(([k, n]) =>
    barRow(k, n, max, drillFn ? drillFn(k.replace(/'/g, "\\'")) : '')).join('') + '</div>';
}
function barRow(label, n, max, onclick) {
  return `<div class="bar-row" onclick="${onclick}"><div class="bar-label" title="${esc(label)}">${esc(label)}</div>
    <div class="bar-track"><div class="bar-fill" style="width:${Math.round(n / max * 100)}%">${n}</div></div></div>`;
}

/* ================= TASK DETAIL (Drill Down รายงาน) ================= */
function viewTask(kind, id) {
  const t = findAny(kind, id); if (!t) return;
  const refType = kind === 'c' ? 'task' : kind === 'p' ? 'prod' : 'proj';
  const imgs = imagesOf(refType, id);
  const files = filesOf(refType, id);
  const ls = kind === 'c' ? linksOf(id) : [];
  const row = (l, v) => v ? `<div class="v-row"><div class="v-label">${l}</div><div class="v-val">${v}</div></div>` : '';
  let projectInfo = '';
  if (kind === 'j') {
    const g = S.projGroups.find(x => x.id === t.groupId);
    const pj = g ? S.projects.find(x => x.id === g.projectId) : null;
    projectInfo = (pj ? pj.name + ' › ' : '') + (g ? g.name : '');
  }
  document.getElementById('vBody').innerHTML = `
    <h3 style="margin-bottom:4px;">${esc(t.topic || t.detail || '')}</h3>
    <div class="task-id-line">Task ID: ${esc(t.id)}</div>
    ${row('โปรเจกต์', esc(projectInfo))}
    ${row('Section', kind === 'c' ? (t.section === 'past' ? 'ผลงานที่ลงแล้ว' : 'แผนงานเดือน' + (isPlanDone(t) ? ' (เสร็จสิ้น — โชว์ในตารางสัปดาห์ด้วย)' : '')) : kind === 'p' ? 'งานผลิต/ซ่อมบำรุง' : 'เช็คลิสต์โปรเจกต์')}
    ${row('แบรนด์', esc(t.brand))}
    ${row('ผู้รับผิดชอบ', esc(kind === 'j' ? t.owner : memberName(t.memberId)))}
    ${row('วันที่โพสต์', esc(fmtDate(effDate(t) || t.recv || '')))}
    ${row('กำหนด', esc(t.due || '') + ' ' + dueBadge(t.due, taskCat(t) === 'done'))}
    ${row('สถานะ', `<span class="tag ${stcls(t.planStatus || t.status || t.kpi)}">${esc(t.planStatus || t.status || ('KPI ' + (t.kpi || 'รอผล')))}</span>`)}
    ${row('ลิงก์ทั้งหมด', ls.length ? ls.map(l => `<div><span class="channel-tag">${esc(l.channel)}</span> <a class="link-a" href="${esc(l.url)}" target="_blank">${esc(l.url).slice(0, 48)}...</a> <small>👍${esc(l.likes || '-')} ↗${esc(l.shares || '-')}</small></div>`).join('') : '')}
    ${row('รูปทั้งหมด', imgs.length ? `<div class="thumbs">${imgs.map(im => `<div class="thumb"><img src="${esc(im.thumb || im.url)}" onclick="openLightbox('${esc(im.url)}')"></div>`).join('')}</div>` : '')}
    ${row('ไฟล์แนบ', files.length ? files.map(f => fileItemHtml(f, false)).join('') : '')}
    ${row('หมายเหตุ', esc(t.note || ''))}
    ${row('สร้างโดย', esc(t.createdBy || '') + (t.createdAt ? ' · ' + esc(t.createdAt) : ''))}
    ${row('แก้ล่าสุดโดย', esc(t.updatedBy || '') + (t.updatedAt ? ' · ' + esc(t.updatedAt) : ''))}`;
  document.getElementById('vEditBtn').onclick = () => { closeM('vModal'); edit(kind, id); };
  document.getElementById('vDupBtn').onclick = () => { closeM('vModal'); dupTask(kind, id); };
  openM('vModal');
}
window.viewTask = viewTask;

/* ================= PROJECTS ================= */
function renderProjects() {
  if (!filters.proj.sel && S.projects.length) filters.proj.sel = S.projects[0].id;
  document.getElementById('projChips').innerHTML = S.projects.map(p =>
    `<button class="chip ${filters.proj.sel === p.id ? 'on' : ''}" onclick="filters.proj.sel='${p.id}';renderProjects()">${esc(p.name)}</button>`).join('') +
    `<button class="chip add-chip" onclick="addProject()">+ เพิ่มโปรเจกต์</button>`;
  const pj = S.projects.find(p => p.id === filters.proj.sel);
  if (!pj) { document.getElementById('projGroups').innerHTML = '<div class="card" style="text-align:center;color:#7a8aa0;">ยังไม่มีโปรเจกต์</div>'; return; }
  const groups = S.projGroups.filter(g => g.projectId === pj.id);
  document.getElementById('projGroups').innerHTML =
    `<div class="card" style="color:#5a6b80;font-size:13px;">${esc(pj.sub || '')}</div>` +
    (groups.length ? groups.map(g => {
      const items = S.projItems.filter(x => x.groupId === g.id);
      const done = items.filter(t => /เสร็จ|เรียบร้อย/.test(t.status || '')).length;
      return `<div class="group-card">
        <div class="group-head" onclick="this.parentElement.classList.toggle('closed')">
          <h4>📌 ${esc(g.name)}</h4><span class="gh-count">${items.length} รายการ · เสร็จ ${done}</span>
          <button class="btn small" style="margin-left:8px;" onclick="event.stopPropagation();edit('j',null,'${g.id}')">➕ เพิ่ม</button>
          <button class="btn small red" onclick="event.stopPropagation();deleteGroup('${g.id}','${esc(g.name)}',${items.length})">🗑️ ลบหมวด</button>
          <span class="arrow">▼</span></div>
        <div class="group-body">${items.length ? projTable(items) : '<div style="text-align:center;color:#7a8aa0;padding:10px;">ยังไม่มีรายการ</div>'}</div></div>`;
    }).join('') : '<div class="card" style="text-align:center;color:#7a8aa0;">ยังไม่มีหมวดในโปรเจกต์นี้ — กด ➕ เพิ่มหมวด</div>');
}
async function addProject() {
  const name = prompt('ชื่อโปรเจกต์ใหม่:'); if (!name || !name.trim()) return;
  try { const res = await API.create('projects', { name: name.trim(), sub: '' }); filters.proj.sel = res.id; toast('เพิ่มโปรเจกต์แล้ว ✓', 'success'); await refresh(); }
  catch (e) { toast(e.message, 'error'); }
}
async function addProjGroup() {
  const pj = S.projects.find(p => p.id === filters.proj.sel); if (!pj) return;
  const name = prompt(`ชื่อหมวด/Phase ใหม่ใน "${pj.name}":`); if (!name || !name.trim()) return;
  try { await API.create('projGroups', { projectId: pj.id, name: name.trim() }); toast('เพิ่มหมวดแล้ว ✓', 'success'); await refresh(); }
  catch (e) { toast(e.message, 'error'); }
}
async function deleteProject() {
  const pj = S.projects.find(p => p.id === filters.proj.sel); if (!pj) return;
  const n = S.projGroups.filter(g => g.projectId === pj.id).length;
  if (!confirm(`ลบโปรเจกต์ "${pj.name}" พร้อมหมวดทั้งหมด ${n} หมวดและงานข้างในทั้งหมด?\n(ทุกอย่างจะย้ายไปถังขยะ กู้คืนได้)`)) return;
  try { await API.deleteProject(pj.id); filters.proj.sel = ''; toast('ลบโปรเจกต์แล้ว (อยู่ในถังขยะ) ✓', 'success'); await refresh(); }
  catch (e) { toast(e.message, 'error'); }
}
async function deleteGroup(gid, gname, count) {
  if (!confirm(`ลบหมวด "${gname}" พร้อมงานทั้งหมด ${count} รายการ?\n(ทุกอย่างจะย้ายไปถังขยะ กู้คืนได้)`)) return;
  try { await API.deleteGroup(gid); toast('ลบหมวดแล้ว (อยู่ในถังขยะ) ✓', 'success'); await refresh(); }
  catch (e) { toast(e.message, 'error'); }
}

/* ================= DROPDOWN / BRAND (เพิ่ม-แก้-ลบ ได้ทุกคน) ================= */
async function addDropdown(cat, selId) {
  const v = prompt('เพิ่มรายการใหม่:'); if (!v || !v.trim()) return;
  try {
    const res = await API.create('dropdowns', { category: cat, value: v.trim() });
    S.dropdowns.push({ id: res.id, category: cat, value: v.trim() });
    if (selId) fillDD(selId, cat, v.trim());
    toast('เพิ่ม "' + v.trim() + '" แล้ว ✓', 'success');
  } catch (e) { toast(e.message, 'error'); }
}
async function editDropdown(id) {
  const d = S.dropdowns.find(x => x.id === id); if (!d) return;
  const v = prompt('แก้ไขรายการ:', d.value); if (!v || !v.trim() || v.trim() === d.value) return;
  try { await API.update('dropdowns', id, { value: v.trim() }); d.value = v.trim(); adminTab('dropdowns'); toast('แก้ไขแล้ว ✓', 'success'); }
  catch (e) { toast(e.message, 'error'); }
}
async function delDropdown(id) {
  if (!confirm('ลบรายการนี้? (ย้ายไปถังขยะ)')) return;
  try { await API.remove('dropdowns', id); S.dropdowns = S.dropdowns.filter(d => d.id !== id); adminTab('dropdowns'); toast('ลบแล้ว ✓', 'success'); }
  catch (e) { toast(e.message, 'error'); }
}
async function addBrandQuick(selId) {
  const v = prompt('ชื่อแบรนด์ใหม่:'); if (!v || !v.trim()) return;
  try {
    const res = await API.create('brands', { name: v.trim() });
    S.brands.push({ id: res.id, name: v.trim() });
    if (selId) fillBrandDD(selId, v.trim());
    renderAll();
    toast('เพิ่มแบรนด์ "' + v.trim() + '" แล้ว — ทุกหน้าอัปเดตอัตโนมัติ ✓', 'success');
  } catch (e) { toast(e.message, 'error'); }
}
async function renameBrand(id) {
  const b = S.brands.find(x => x.id === id);
  const v = prompt('ชื่อแบรนด์ใหม่:', b.name); if (!v || !v.trim()) return;
  try { await API.update('brands', id, { name: v.trim() }); toast('แก้ชื่อแล้ว ✓', 'success'); await refresh(); adminTab('brands'); }
  catch (e) { toast(e.message, 'error'); }
}
async function deleteBrand(id) {
  if (!confirm('ลบแบรนด์นี้? (ย้ายไปถังขยะ — งานเดิมที่ใช้ชื่อนี้ยังอยู่)')) return;
  try { await API.remove('brands', id); toast('ลบแล้ว ✓', 'success'); await refresh(); adminTab('brands'); }
  catch (e) { toast(e.message, 'error'); }
}

/* ================= MANAGE MODAL (ทุกคนใช้ได้) ================= */
function openAdmin() { adminTab('members'); openM('aModal'); }
function adminTab(tab) {
  const el = document.getElementById('adminBody');
  if (tab === 'members') {
    el.innerHTML = `<div class="admin-list">` + S.members.map(m => `
      <div class="admin-item"><span class="grow">${m.role === 'prod' ? '🛠️' : '📝'} <strong>${esc(m.name)}</strong> <small style="color:#7a8aa0;">${esc(m.dept || '')}</small></span>
        <button class="btn small blue" onclick="editMember('${m.id}')">แก้ไข</button>
        <button class="btn small gray" onclick="deleteMember('${m.id}')">ลบ</button></div>`).join('') +
      `</div><button class="btn small" style="margin-top:10px;" onclick="addMember()">➕ เพิ่มสมาชิก</button>
      <p style="font-size:12px;color:#7a8aa0;margin-top:6px;">เพิ่ม/ลบสมาชิกแล้ว Dropdown ผู้รับผิดชอบและหน้าออฟฟิศอัปเดตอัตโนมัติ</p>`;
  } else if (tab === 'brands') {
    el.innerHTML = `<div class="admin-list">` + S.brands.map(b => `
      <div class="admin-item"><span class="grow">🏷️ <strong>${esc(b.name)}</strong></span>
        <button class="btn small blue" onclick="renameBrand('${b.id}')">แก้ชื่อ</button>
        <button class="btn small gray" onclick="deleteBrand('${b.id}')">ลบ</button></div>`).join('') +
      `</div><button class="btn small" style="margin-top:10px;" onclick="addBrandQuick()">➕ เพิ่มแบรนด์</button>`;
  } else if (tab === 'dropdowns') {
    const cats = [['contentType','ประเภทคอนเทนต์/งาน'],['dept','ฝ่าย'],['planStatus','สถานะแผน'],['urgency','ความด่วน'],['branch','สาขา'],['prodStatus','สถานะงานผลิต'],['projStatus','สถานะเช็คลิสต์'],['channel','ช่องทางโพสต์']];
    el.innerHTML = cats.map(([cat, label]) => `
      <div style="margin-bottom:12px;"><strong style="color:#1e3a5f;font-size:13px;">${label}</strong>
      <div class="chips" style="margin-top:5px;">` +
      S.dropdowns.filter(d => d.category === cat).map(d =>
        `<span class="chip" style="cursor:default;">${esc(d.value)}
          <button class="edit-btn" style="font-size:11px;" onclick="editDropdown('${d.id}')">✏️</button>
          <button class="del-btn" style="font-size:11px;" onclick="delDropdown('${d.id}')">✕</button></span>`).join('') +
      `<button class="chip add-chip" onclick="addDropdown('${cat}');setTimeout(()=>adminTab('dropdowns'),700)">+ เพิ่ม</button></div></div>`).join('');
  }
}
async function addMember() {
  const name = prompt('ชื่อสมาชิกใหม่:'); if (!name || !name.trim()) return;
  const dept = prompt('รับผิดชอบเพจ/แบรนด์/หน้าที่ (เว้นว่างได้):') || '';
  const isProd = confirm('เป็นทีมงานผลิต/ซ่อมบำรุงไหม? (OK = ทีมผลิต, Cancel = ทีมคอนเทนต์)');
  try { await API.create('members', { name: name.trim(), dept: dept.trim(), role: isProd ? 'prod' : 'content' });
    toast('เพิ่มสมาชิกแล้ว ✓', 'success'); await refresh();
    if (document.getElementById('aModal').classList.contains('open')) adminTab('members'); }
  catch (e) { toast(e.message, 'error'); }
}
async function editMember(id) {
  const m = getMember(id);
  const name = prompt('ชื่อ:', m.name); if (!name || !name.trim()) return;
  const dept = prompt('หน้าที่/แบรนด์:', m.dept || '') || '';
  try { await API.update('members', id, { name: name.trim(), dept: dept.trim() }); toast('บันทึกแล้ว ✓', 'success'); await refresh(); adminTab('members'); }
  catch (e) { toast(e.message, 'error'); }
}
async function deleteMember(id) {
  const m = getMember(id);
  if (!confirm(`ลบสมาชิก "${m.name}"? (ย้ายไปถังขยะ — งานของเขายังอยู่)`)) return;
  try { await API.remove('members', id); toast('ลบแล้ว ✓', 'success'); await refresh(); adminTab('members'); }
  catch (e) { toast(e.message, 'error'); }
}

/* ================= EDIT / SAVE / DELETE / DUPLICATE ================= */
let editKind = 'c', editId = null, editCtx = null, pendingImgs = [], editLinks = [];

function findAny(kind, id) {
  if (kind === 'c') return S.tasks.find(t => t.id === id);
  if (kind === 'p') return S.prodTasks.find(t => t.id === id);
  return S.projItems.find(t => t.id === id);
}
const kindEntity = kind => kind === 'c' ? 'tasks' : kind === 'p' ? 'prodTasks' : 'projItems';

async function delAny(kind, id) {
  if (!confirm('ลบรายการนี้? (จะย้ายไปถังขยะ กู้คืนได้)')) return;
  try { await API.remove(kindEntity(kind), id); toast('ย้ายไปถังขยะแล้ว ✓', 'success'); await refresh(); }
  catch (e) { toast(e.message, 'error'); }
}

/* Duplicate: สร้างงานใหม่จากงานเดิม (Task ID ใหม่) พร้อมคัดลอกลิงก์ */
async function dupTask(kind, id) {
  const t = findAny(kind, id); if (!t) return;
  if (!confirm('สร้างสำเนางานนี้เป็นงานใหม่?')) return;
  const copy = { ...t };
  delete copy.id; delete copy.createdBy; delete copy.updatedBy; delete copy.createdAt; delete copy.updatedAt;
  if (copy.topic) copy.topic += ' (สำเนา)';
  if (copy.detail) copy.detail += ' (สำเนา)';
  copy.postDate = '';
  try {
    const res = await API.create(kindEntity(kind), copy);
    if (kind === 'c') {
      const ls = linksOf(id).map(l => ({ channel: l.channel, url: l.url, likes: l.likes, shares: l.shares }));
      if (ls.length) await API.saveLinks(res.id, ls, { silent: true });
    }
    toast('สร้างสำเนาแล้ว ✓ (Task ID ใหม่: ' + res.id + ')', 'success', 3200);
    await refresh();
  } catch (e) { toast(e.message, 'error'); }
}

function edit(kind, id, ctx, section) {
  editKind = kind; editId = id; editCtx = ctx || null; pendingImgs = []; editLinks = [];
  setAutosave('');
  if (kind === 'c') {
    const sel = document.getElementById('cMember');
    sel.innerHTML = S.members.filter(m => m.role !== 'prod').map(m => `<option value="${m.id}">${esc(m.name)}</option>`).join('');
    fillDD('cType', 'contentType'); fillDD('cDept', 'dept'); fillDD('cPlanSt', 'planStatus'); fillBrandDD('cBrand');
    document.getElementById('cTaskId').textContent = id ? 'Task ID: ' + id : '';
    document.getElementById('btnVersions').style.display = id ? '' : 'none';
    if (id) {
      const t = findAny('c', id);
      document.getElementById('cTitle').textContent = '✏️ แก้ไขงาน';
      cSection.value = t.section; sel.value = t.memberId;
      cDate.value = t.date || ''; cMonth.value = t.month || ''; cOrder.value = t.planOrder || '';
      fillDD('cPlanSt', 'planStatus', t.planStatus); cDue.value = t.due || ''; cPostDate.value = t.postDate || '';
      fillDD('cType', 'contentType', t.type); fillDD('cDept', 'dept', t.dept);
      cTopic.value = t.topic || ''; fillBrandDD('cBrand', t.brand); cPages.value = t.pages || '';
      cKpi.value = t.kpi || 'รอผล'; cNote.value = t.note || '';
      editLinks = linksOf(id).map(l => ({ ...l }));
    } else {
      document.getElementById('cTitle').textContent = '➕ เพิ่มงาน';
      cSection.value = section || 'past';
      if (ctx) sel.value = ctx;
      cDate.value = new Date().toISOString().slice(0, 10);
      cMonth.value = new Date().toISOString().slice(0, 7);
      cOrder.value = ''; cDue.value = ''; cPostDate.value = '';
      cTopic.value = ''; cPages.value = ''; cKpi.value = 'รอผล'; cNote.value = '';
    }
    renderLinkRows(); cSecFields(); renderThumbs('cThumbs', 'task', id); renderFiles('cFiles', 'task', id); openM('cModal');
  } else if (kind === 'p') {
    const sel = document.getElementById('pMember');
    sel.innerHTML = S.members.filter(m => m.role === 'prod').map(m => `<option value="${m.id}">${esc(m.name)}</option>`).join('');
    fillDD('pUrg', 'urgency'); fillDD('pBranch', 'branch'); fillDD('pSt', 'prodStatus');
    if (id) {
      const t = findAny('p', id);
      document.getElementById('pTitle').textContent = '✏️ แก้ไขงานผลิต';
      sel.value = t.memberId; pRecv.value = t.recv || ''; fillDD('pUrg', 'urgency', t.urg);
      fillDD('pBranch', 'branch', t.branch); pDetail.value = t.detail || ''; pFwd.value = t.fwd || '';
      pSend.value = t.send || ''; pDone.value = t.done || ''; fillDD('pSt', 'prodStatus', t.status); pNote.value = t.note || '';
    } else {
      document.getElementById('pTitle').textContent = '➕ เพิ่มงานผลิต/ซ่อมบำรุง';
      if (ctx) sel.value = ctx;
      pRecv.value = new Date().toISOString().slice(0, 10);
      pDetail.value = ''; pFwd.value = ''; pSend.value = ''; pDone.value = ''; pNote.value = '';
    }
    renderThumbs('pThumbs', 'prod', id); openM('pModal');
  } else {
    fillDD('jSt', 'projStatus'); fillDD('jArea', 'branch'); fillBrandDD('jBrand');
    if (id) {
      const t = findAny('j', id);
      document.getElementById('jTitle').textContent = '✏️ แก้ไขรายการ';
      fillDD('jSt', 'projStatus', t.status); jDetail.value = t.detail || ''; jQty.value = t.qty || '';
      fillDD('jArea', 'branch', t.area); fillBrandDD('jBrand', t.brand);
      jOwner.value = t.owner || ''; jDue.value = t.due || ''; jSize.value = t.size || ''; jNote.value = t.note || '';
    } else {
      document.getElementById('jTitle').textContent = '➕ เพิ่มรายการเช็คลิสต์';
      jDetail.value = ''; jQty.value = ''; jOwner.value = ''; jDue.value = ''; jSize.value = ''; jNote.value = '';
    }
    renderThumbs('jThumbs', 'proj', id); openM('jModal');
  }
}
function cSecFields() {
  const isPlan = cSection.value === 'plan';
  document.querySelectorAll('.f-past').forEach(e => e.style.display = isPlan ? 'none' : '');
  document.querySelectorAll('.f-plan').forEach(e => e.style.display = isPlan ? '' : 'none');
  planStChanged();
}
function planStChanged() {
  const isPlan = cSection.value === 'plan';
  const planDone = isPlan && cPlanSt.value === 'เสร็จสิ้น';
  document.querySelectorAll('.f-postdate').forEach(e => e.style.display = planDone ? '' : 'none');
  // KPI + ลิงก์: โชว์เมื่อเป็นงานที่ลงแล้ว หรือแผนที่เสร็จสิ้น (งานเดียวกันโชว์ในตารางสัปดาห์)
  document.querySelectorAll('.f-kpi').forEach(e => e.style.display = (!isPlan || planDone) ? '' : 'none');
  if (planDone && !cPostDate.value) cPostDate.value = new Date().toISOString().slice(0, 10);
}
function openM(id) { document.getElementById(id).classList.add('open'); }
function closeM(id) { document.getElementById(id).classList.remove('open'); }
document.addEventListener('DOMContentLoaded', () => {
  ['cModal','pModal','jModal','aModal','xModal','vModal','hModal'].forEach(id =>
    document.getElementById(id).addEventListener('click', e => { if (e.target.id === id) closeM(id); }));
});

/* ---------- ลิงก์หลายช่องทาง (ไม่จำกัดจำนวน) ---------- */
function renderLinkRows() {
  document.getElementById('linkRows').innerHTML = editLinks.map((l, i) => `
    <div class="link-row">
      <select onchange="editLinks[${i}].channel=this.value;scheduleAutoSave()">${ddValues('channel').map(c =>
        `<option ${l.channel === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
      <input type="url" placeholder="วางลิงก์..." value="${esc(l.url)}" oninput="editLinks[${i}].url=this.value;scheduleAutoSave()">
      <input type="text" placeholder="Like" value="${esc(l.likes)}" oninput="editLinks[${i}].likes=this.value;scheduleAutoSave()">
      <input type="text" placeholder="Share" value="${esc(l.shares)}" oninput="editLinks[${i}].shares=this.value;scheduleAutoSave()">
      <button class="del-btn" onclick="editLinks.splice(${i},1);renderLinkRows();scheduleAutoSave()">🗑️</button>
    </div>`).join('');
}
function addLinkRow() {
  editLinks.push({ channel: ddValues('channel')[0] || 'Facebook', url: '', likes: '', shares: '' });
  renderLinkRows();
}

/* ---------- Auto Save (ข้อ 17) ---------- */
let autosaveTimer = null;
function setAutosave(state) {
  const chip = document.getElementById('autosaveChip');
  if (!chip) return;
  chip.className = 'autosave-chip ' + state;
  chip.textContent = state === 'saving' ? '💾 Saving...' : state === 'saved' ? '✓ Saved' : state === 'error' ? '⚠ Error' : '';
}
function scheduleAutoSave() {
  if (!editId || editKind !== 'c') return;          // Auto Save เฉพาะตอนแก้งานที่มีอยู่แล้ว
  setAutosave('saving');
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(doAutoSave, CONFIG.AUTOSAVE_DELAY);
}
async function doAutoSave() {
  if (!editId || !document.getElementById('cModal').classList.contains('open')) return;
  try {
    await API.update('tasks', editId, buildCRow(), { silent: true });
    await API.saveLinks(editId, editLinks.filter(l => l.url.trim()), { silent: true });
    Object.assign(findAny('c', editId) || {}, buildCRow());
    setAutosave('saved');
  } catch (e) { setAutosave('error'); }
}
document.addEventListener('DOMContentLoaded', () => {
  ['cSection','cMember','cDate','cMonth','cOrder','cPlanSt','cDue','cPostDate','cType','cDept','cTopic','cBrand','cPages','cKpi','cNote']
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.addEventListener('input', scheduleAutoSave); el.addEventListener('change', scheduleAutoSave); }
    });
});

/* ---------- บันทึก ---------- */
function buildCRow() {
  const isPlan = cSection.value === 'plan';
  return {
    memberId: cMember.value, section: cSection.value,
    date: isPlan ? '' : cDate.value, month: isPlan ? cMonth.value : '',
    planOrder: cOrder.value, planStatus: isPlan ? cPlanSt.value : '', due: cDue.value.trim(),
    postDate: isPlan ? cPostDate.value : '',
    type: cType.value, dept: cDept.value, topic: cTopic.value.trim(), brand: cBrand.value,
    pages: cPages.value.trim(), kpi: cKpi.value, note: cNote.value.trim(),
  };
}
async function saveC() {
  if (!cTopic.value.trim()) { toast('กรุณาใส่ชื่องาน/หัวข้อ', 'error'); return; }
  clearTimeout(autosaveTimer);
  const row = buildCRow();
  if (row.section === 'plan' && row.planStatus === 'เสร็จสิ้น' && !row.postDate) {
    toast('ใส่ "วันที่โพสต์จริง" ด้วย เพื่อให้งานไปแสดงในสัปดาห์ที่ถูกต้อง', 'error', 4000);
    return;
  }
  try {
    let taskId = editId;
    if (editId) await API.update('tasks', editId, row);
    else { const res = await API.create('tasks', row); taskId = res.id; }
    await API.saveLinks(taskId, editLinks.filter(l => l.url.trim()), { silent: true });
    await uploadPending('task', taskId);
    closeM('cModal');
    toast(row.section === 'plan' && row.planStatus === 'เสร็จสิ้น'
      ? '✅ บันทึกแล้ว — งานนี้แสดงในสัปดาห์ของวันที่ ' + fmtDate(row.postDate) + ' ด้วย (Task ID เดิม)'
      : 'บันทึกสำเร็จ ✓', 'success', 3200);
    await refresh();
  } catch (e) { toast('บันทึกไม่สำเร็จ: ' + e.message, 'error', 4500); }
}
async function saveP() {
  if (!pDetail.value.trim()) { toast('กรุณาใส่รายการงาน', 'error'); return; }
  const row = { memberId: pMember.value, recv: pRecv.value, urg: pUrg.value, branch: pBranch.value,
    detail: pDetail.value.trim(), fwd: pFwd.value.trim(), send: pSend.value.trim(), done: pDone.value.trim(),
    status: pSt.value, note: pNote.value.trim() };
  try {
    let id = editId;
    if (editId) await API.update('prodTasks', editId, row);
    else { const res = await API.create('prodTasks', row); id = res.id; }
    await uploadPending('prod', id);
    closeM('pModal'); toast('บันทึกสำเร็จ ✓', 'success'); await refresh();
  } catch (e) { toast('บันทึกไม่สำเร็จ: ' + e.message, 'error', 4500); }
}
async function saveJ() {
  if (!jDetail.value.trim()) { toast('กรุณาใส่รายละเอียดงาน', 'error'); return; }
  const row = { status: jSt.value, detail: jDetail.value.trim(), qty: jQty.value.trim(), area: jArea.value,
    brand: jBrand.value, owner: jOwner.value.trim(), due: jDue.value.trim(), size: jSize.value.trim(), note: jNote.value.trim() };
  try {
    let id = editId;
    if (editId) await API.update('projItems', editId, row);
    else { const res = await API.create('projItems', { groupId: editCtx, ...row }); id = res.id; }
    await uploadPending('proj', id);
    closeM('jModal'); toast('บันทึกสำเร็จ ✓', 'success'); await refresh();
  } catch (e) { toast('บันทึกไม่สำเร็จ: ' + e.message, 'error', 4500); }
}

/* ================= รูปภาพ (Google Drive) ================= */
function renderThumbs(elId, refType, refId) {
  const existing = refId ? imagesOf(refType, refId) : [];
  document.getElementById(elId).innerHTML =
    existing.map(im => `<div class="thumb"><img src="${esc(im.thumb || im.url)}" onclick="openLightbox('${esc(im.url)}')">
      <button class="rm" onclick="removeImage('${im.id}','${elId}','${refType}','${refId}')">✕</button></div>`).join('') +
    pendingImgs.map((d, i) => `<div class="thumb"><img src="${d}"><button class="rm" onclick="pendingImgs.splice(${i},1);renderThumbs('${elId}','${refType}','${refId}')">✕</button></div>`).join('');
}
async function removeImage(imgId, elId, refType, refId) {
  if (!confirm('ลบรูปนี้? (ย้ายไปถังขยะ)')) return;
  try { await API.remove('images', imgId); S.images = S.images.filter(i => i.id !== imgId); renderThumbs(elId, refType, refId); toast('ลบรูปแล้ว ✓', 'success'); }
  catch (e) { toast(e.message, 'error'); }
}
async function uploadPending(refType, refId) {
  for (const dataUrl of pendingImgs) {
    const rec = await API.uploadImage(refType, refId, dataUrl);
    S.images.push(rec);
  }
  pendingImgs = [];
}
function activeThumbsEl() {
  if (document.getElementById('cModal').classList.contains('open')) return ['cThumbs', 'task'];
  if (document.getElementById('pModal').classList.contains('open')) return ['pThumbs', 'prod'];
  if (document.getElementById('jModal').classList.contains('open')) return ['jThumbs', 'proj'];
  return null;
}
function addImgFiles(files) {
  const a = activeThumbsEl(); if (!a) return;
  [...files].forEach(f => { if (f && f.type.startsWith('image/'))
    compressImage(f, d => { pendingImgs.push(d); renderThumbs(a[0], a[1], editId); }); });
}
document.addEventListener('paste', e => {
  const items = (e.clipboardData && e.clipboardData.items) ? [...e.clipboardData.items] : [];
  const files = items.filter(it => it.type.startsWith('image/')).map(it => it.getAsFile());
  if (files.length) addImgFiles(files);
});
function openLightbox(src) { document.getElementById('lightboxImg').src = src; document.getElementById('lightbox').classList.add('open'); }

/* ================= ไฟล์แนบ (ข้อ 10) ================= */
function fileItemHtml(f, canDelete) {
  return `<div class="file-item">${fileIcon(f.mime || f.name)}
    <span class="f-name">${esc(f.name)}</span>
    <span class="f-meta">${fmtBytes(f.size)} · ${esc((f.uploadedAt || '').slice(0, 10))}</span>
    <a class="btn small blue" href="${esc(f.url)}" target="_blank" title="เปิดดู">เปิด</a>
    <a class="btn small gray" href="https://drive.google.com/uc?export=download&id=${esc(f.fileId)}" title="ดาวน์โหลด">⬇</a>
    ${canDelete ? `<button class="btn small red" onclick="removeFile('${f.id}')">🗑️</button>` : ''}</div>`;
}
function renderFiles(elId, refType, refId) {
  const files = refId ? filesOf(refType, refId) : [];
  document.getElementById(elId).innerHTML = files.length
    ? files.map(f => fileItemHtml(f, true)).join('')
    : '<div style="color:#8fa1b5;font-size:12px;">ยังไม่มีไฟล์แนบ' + (refId ? '' : ' (บันทึกงานก่อน แล้วจึงแนบไฟล์ได้)') + '</div>';
}
async function removeFile(fileId) {
  if (!confirm('ลบไฟล์นี้? (ย้ายไปถังขยะ)')) return;
  try { await API.remove('attachments', fileId); S.attachments = S.attachments.filter(a => a.id !== fileId);
    renderFiles('cFiles', 'task', editId); toast('ลบไฟล์แล้ว ✓', 'success'); }
  catch (e) { toast(e.message, 'error'); }
}
async function addAttachFiles(files) {
  if (!editId || editKind !== 'c') { toast('บันทึกงานก่อน แล้วจึงแนบไฟล์ได้', 'error'); return; }
  for (const f of [...files]) {
    try { const rec = await API.uploadFile('task', editId, f); S.attachments.push(rec); renderFiles('cFiles', 'task', editId); }
    catch (e) { toast(e.message, 'error', 5000); }
  }
  if (files.length) toast('แนบไฟล์เรียบร้อย ✓', 'success');
}
document.addEventListener('DOMContentLoaded', () => {
  // โซนรูปภาพ
  [['pasteZone','imgInput'],['pasteZoneP','imgInputP'],['pasteZoneJ','imgInputJ']].forEach(([z, f]) => {
    const zone = document.getElementById(z), file = document.getElementById(f);
    zone.addEventListener('click', () => file.click());
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag'));
    zone.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('drag'); addImgFiles(e.dataTransfer.files); });
    file.addEventListener('change', e => { addImgFiles(e.target.files); e.target.value = ''; });
  });
  // โซนไฟล์แนบ
  const fz = document.getElementById('fileZone'), fi = document.getElementById('fileInput');
  fz.addEventListener('click', () => fi.click());
  fz.addEventListener('dragover', e => { e.preventDefault(); fz.classList.add('drag'); });
  fz.addEventListener('dragleave', () => fz.classList.remove('drag'));
  fz.addEventListener('drop', e => { e.preventDefault(); fz.classList.remove('drag'); addAttachFiles(e.dataTransfer.files); });
  fi.addEventListener('change', e => { addAttachFiles(e.target.files); e.target.value = ''; });
});

/* ================= VERSION HISTORY (ข้อ 20) ================= */
async function openVersions() {
  if (!editId) return;
  try {
    const versions = await API.getVersions(editId);
    document.getElementById('hList').innerHTML = versions.length
      ? versions.map(v => `<div class="admin-item">
          <span class="grow"><strong>${esc(v.editedAt)}</strong> โดย ${esc(v.editedBy)}<br><small style="color:#7a8aa0;">${esc(v.summary).slice(0, 120)}</small></span>
          <button class="btn small blue" onclick="restoreVer('${v.id}')">↩ ย้อนกลับเวอร์ชันนี้</button></div>`).join('')
      : '<div style="color:#7a8aa0;font-size:13px;">ยังไม่มีประวัติการแก้ไข</div>';
    openM('hModal');
  } catch (e) { toast(e.message, 'error'); }
}
async function restoreVer(versionId) {
  if (!confirm('ย้อนกลับไปเวอร์ชันนี้? (เวอร์ชันปัจจุบันจะถูกเก็บไว้ในประวัติเช่นกัน)')) return;
  try {
    await API.restoreVersion(versionId);
    closeM('hModal'); closeM('cModal');
    toast('ย้อนเวอร์ชันแล้ว ✓', 'success');
    await refresh();
  } catch (e) { toast(e.message, 'error'); }
}

/* ================= TRASH / RECYCLE BIN (ข้อ 19) ================= */
const TRASH_LABEL = { tasks: 'งานคอนเทนต์', prodTasks: 'งานผลิต', projItems: 'เช็คลิสต์', projGroups: 'หมวด/Phase',
  projects: 'โปรเจกต์', members: 'สมาชิก', brands: 'แบรนด์', dropdowns: 'Dropdown', links: 'ลิงก์', images: 'รูป', attachments: 'ไฟล์แนบ' };
function renderTrash() {
  const list = S.trash.slice().sort((a, b) => (b.deletedAt || '').localeCompare(a.deletedAt || ''));
  document.getElementById('trashList').innerHTML = list.length
    ? `<div class="admin-list" style="max-height:none;">` + list.map(t => `
        <div class="admin-item">
          <span class="trash-entity">${TRASH_LABEL[t.entity] || t.entity}</span>
          <span class="grow">${esc(t.summary).slice(0, 130)}<br><small style="color:#8fa1b5;">ลบโดย ${esc(t.deletedBy)} · ${esc(t.deletedAt)}</small></span>
          <button class="btn small" onclick="restoreT('${t.id}')">↩ กู้คืน</button>
          <button class="btn small red" onclick="purgeT('${t.id}')">ลบถาวร</button></div>`).join('') + `</div>`
    : '<div style="text-align:center;color:#7a8aa0;padding:20px;">ถังขยะว่าง 🎉</div>';
}
async function restoreT(id) {
  try { await API.restoreTrash(id); toast('กู้คืนแล้ว ✓', 'success'); await refresh(); }
  catch (e) { toast(e.message, 'error'); }
}
async function purgeT(id) {
  if (!confirm('ลบถาวร? ข้อมูลและไฟล์จะหายไปจริงๆ กู้คืนไม่ได้อีก')) return;
  try { await API.purgeTrash(id); toast('ลบถาวรแล้ว', 'success'); await refresh(); }
  catch (e) { toast(e.message, 'error'); }
}

/* ================= EXPORT (ข้อ 16: CSV + Excel มีรูป) ================= */
function openExport() {
  fillFilterSelect('xMonth', [...new Set(S.tasks.map(effMonth).filter(Boolean))].sort().reverse().map(k => [k, monthLabel(k)]), 'ทั้งหมด');
  fillFilterSelect('xBrand', S.brands.map(b => [b.name, b.name]), 'ทั้งหมด');
  fillFilterSelect('xMember', S.members.filter(m => m.role !== 'prod').map(m => [m.id, m.name]), 'ทั้งหมด');
  fillFilterSelect('xStatus', [...new Set([...S.tasks.map(t => t.kpi), ...S.tasks.map(t => t.planStatus)].filter(Boolean))].map(v => [v, v]), 'ทั้งหมด');
  openM('xModal');
}
function doExport(fmt) {
  const fm = fVal('xMonth'), fb = fVal('xBrand'), fme = fVal('xMember'), fs = fVal('xStatus');
  const tasks = S.tasks.filter(t =>
    (!fm || effMonth(t) === fm) && (!fb || brandMatch(t.brand, fb)) &&
    (!fme || t.memberId === fme) && (!fs || t.kpi === fs || t.planStatus === fs));
  if (!tasks.length) { toast('ไม่มีข้อมูลตามเงื่อนไข', 'error'); return; }

  const maxImgs = Math.min(5, Math.max(1, ...tasks.map(t => imagesOf('task', t.id).length)));
  const rows = tasks.map(t => {
    const imgs = imagesOf('task', t.id);
    const ls = linksOf(t.id);
    const files = filesOf('task', t.id);
    const r = {
      'Task ID': t.id,
      'Section': t.section === 'past' ? 'ผลงานที่ลงแล้ว' : 'แผนงานเดือน',
      'ชื่องาน': t.topic, 'ผู้รับผิดชอบ': memberName(t.memberId),
      'วันที่โพส': fmtDate(effDate(t)), 'เดือน': t.month, 'ลำดับแผน': t.planOrder,
      'สถานะ': t.planStatus || ('KPI ' + (t.kpi || 'รอผล')), 'กำหนดออนแอร์': t.due,
      'ประเภท': t.type, 'ฝ่าย': t.dept, 'แบรนด์': t.brand, 'เพจ': t.pages, 'หมายเหตุ': t.note,
      'ลิงก์ทั้งหมด': ls.map(l => `${l.channel}: ${l.url}`).join(' | '),
      'Like': ls.map(l => `${l.channel}:${l.likes || '-'}`).join(' | '),
      'Share': ls.map(l => `${l.channel}:${l.shares || '-'}`).join(' | '),
      'ไฟล์แนบ': files.map(f => `${f.name} (${f.url})`).join(' | '),
    };
    for (let i = 0; i < maxImgs; i++) {
      const im = imgs[i];
      r['รูป' + (i + 1)] = im ? (fmt === 'excel' ? (im.thumb || im.url) : im.url) : '';
    }
    return r;
  });
  const headers = Object.keys(rows[0]);
  const stamp = new Date().toISOString().slice(0, 10);
  if (fmt === 'csv') {
    downloadFile(`RMA-tasks-${stamp}.csv`, toCSV(rows, headers));
  } else {
    const imgCols = headers.filter(h => h.startsWith('รูป'));
    downloadFile(`RMA-tasks-${stamp}.xls`, toExcelHTML(rows, headers, imgCols), 'application/vnd.ms-excel;charset=utf-8');
  }
  closeM('xModal');
  toast('ดาวน์โหลด ' + (fmt === 'csv' ? 'CSV' : 'Excel') + ' แล้ว ✓ (ข้อมูลเดิมไม่ถูกกระทบ)', 'success');
}
