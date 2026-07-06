/* ============================================================
   script.js — ตัวหลักของหน้าเว็บ (UI ทั้งหมด)
   ข้อมูลทุกอย่างมาจาก Google Sheets ผ่าน api.js เท่านั้น
   ============================================================ */

/* ================= STATE ================= */
const S = {
  me: null,            // {email, name, picture, role}
  members: [], tasks: [], prodTasks: [], links: [], images: [],
  brands: [], dropdowns: [], projects: [], projGroups: [], projItems: [], users: [],
};
const COLORS = ['#e63e6d','#3f7fd9','#4caf7d','#e67e22','#9b59b6','#16a2b8','#c0392b','#5e7d2a','#d4a017','#7f8c8d'];
const HAIRS  = ['#3b2a1d','#111','#5a3b22','#222','#6d4c2f','#3b2a1d','#111','#5a3b22','#6d4c2f'];

const isAdmin   = () => S.me && S.me.role === 'admin';
const canEdit   = row => isAdmin() || !row.createdBy || row.createdBy === (S.me && S.me.email);
const getMember = id => S.members.find(m => m.id === id);
const memberColor = m => COLORS[S.members.indexOf(m) % COLORS.length];
const linksOf   = taskId => S.links.filter(l => l.taskId === taskId);
const imagesOf  = (refType, refId) => S.images.filter(i => i.refType === refType && i.refId === refId);
const contentOf = mid => S.tasks.filter(t => t.memberId === mid);
const prodOf    = mid => S.prodTasks.filter(t => t.memberId === mid);

/* Dropdown: อ่านจากชีต Dropdowns (เพิ่มเองได้ ไม่ตายตัว) */
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

/* ================= LOGIN (Google Identity Services) ================= */
window.addEventListener('load', () => {
  document.getElementById('appTitle').textContent = CONFIG.APP_TITLE;

  // โหมดทดสอบ: ข้ามหน้า Login (ใช้คู่กับ ALLOW_INSECURE = true ฝั่ง Apps Script)
  if (CONFIG.TEST_MODE) {
    S.me = { email: 'test@local', name: 'ผู้ทดสอบระบบ', picture: '', role: 'admin' };
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainHeader').style.display = '';
    refresh(true);
    return;
  }

  if (CONFIG.GOOGLE_CLIENT_ID.includes('PASTE_')) {
    document.getElementById('loginErr').textContent = '⚠️ ยังไม่ได้ตั้งค่า GOOGLE_CLIENT_ID ใน config.js (ดู README ขั้นตอนที่ 5)';
    return;
  }
  const tryInit = () => {
    if (!window.google || !google.accounts) { setTimeout(tryInit, 300); return; }
    google.accounts.id.initialize({ client_id: CONFIG.GOOGLE_CLIENT_ID, callback: onSignIn });
    google.accounts.id.renderButton(document.getElementById('gSignIn'),
      { theme: 'filled_blue', size: 'large', text: 'signin_with', locale: 'th' });
  };
  tryInit();
});

async function onSignIn(resp) {
  try {
    const payload = JSON.parse(decodeURIComponent(escape(atob(resp.credential.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')))));
    API.setToken(resp.credential);
    S.me = { email: payload.email, name: payload.name, picture: payload.picture, role: 'user' };
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainHeader').style.display = '';
    await refresh(true);
    toast(`สวัสดี ${S.me.name} 👋`, 'success');
  } catch (err) {
    document.getElementById('loginErr').textContent = '❌ ' + err.message;
  }
}

/* ================= โหลด / ซิงค์ข้อมูล ================= */
window.onDataLoaded = (data, fromCache) => { applyData(data); renderAll(); };

async function refresh(first) {
  try {
    const data = await API.bootstrap(!!first === false);
    applyData(data);
    renderAll();
    if (!first) toast('ซิงค์ข้อมูลแล้ว ✓', 'success', 1200);
  } catch (err) {
    toast('เชื่อมต่อ Google Sheets ไม่สำเร็จ: ' + err.message, 'error', 5000);
  }
}
function applyData(d) {
  ['members','tasks','prodTasks','links','images','brands','dropdowns','projects','projGroups','projItems','users']
    .forEach(k => { if (d[k]) S[k] = d[k]; });
  if (d.me) { S.me = { ...S.me, ...d.me }; }
  renderUserChip();
}
function renderUserChip() {
  if (!S.me) return;
  document.getElementById('userChip').innerHTML =
    `<img src="${esc(S.me.picture || '')}" onerror="this.style.display='none'">
     <span class="uname">${esc(S.me.name)}</span>
     <span class="role ${S.me.role}">${S.me.role === 'admin' ? 'Admin' : 'User'}</span>`;
  document.getElementById('adminBtn').style.display = isAdmin() ? '' : 'none';
}

/* ================= NAV ================= */
let currentPerson = null;
function showView(v) {
  document.querySelectorAll('.view').forEach(x => x.classList.remove('active'));
  document.getElementById('view-' + v).classList.add('active');
  document.querySelectorAll('.nav-btn[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === v));
  if (v === 'dashboard') renderDashboard();
  if (v === 'review') renderReview();
  if (v === 'projects') renderProjects();
  if (v === 'office') document.getElementById('personJump').value = '';
}
function openPerson(id) { currentPerson = id; renderPerson();
  document.querySelectorAll('.view').forEach(x => x.classList.remove('active'));
  document.getElementById('view-person').classList.add('active');
  document.getElementById('personJump').value = id; }

function renderAll() {
  buildOffice();
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
  }
}

/* ================= OFFICE SCENE (ดีไซน์เดิม) ================= */
const chars = {};
function buildOffice() {
  const scene = document.getElementById('officeScene');
  scene.querySelectorAll('.char').forEach(e => e.remove());
  S.members.forEach((m, i) => {
    const c = memberColor(m), hair = HAIRS[i % HAIRS.length];
    const cnt = m.role === 'prod' ? prodOf(m.id).length : contentOf(m.id).length;
    const el = document.createElement('div');
    el.className = 'char walking';
    el.innerHTML = `
      <div class="bubble">📋 มีงาน <b>${cnt}</b> ชิ้น</div>
      <div class="nametag">${esc(m.name)}</div>
      <div class="body-wrap">
        <div class="head"><div class="hair" style="background:${hair}"></div><div class="face">•‿•</div></div>
        <div class="torso" style="background:${c}"></div>
        <div class="legs"><div class="leg"></div><div class="leg"></div></div>
      </div>`;
    const wait = m.role === 'prod'
      ? prodOf(m.id).filter(t => !/เรียบร้อย|เสร็จ/.test(t.status || '')).length
      : contentOf(m.id).filter(t =>
          (t.section === 'past' && t.kpi === 'ไม่ผ่าน') ||
          (t.section === 'plan' && dueState(t.due, t.planStatus === 'เสร็จสิ้น') === 'overdue')).length;
    if (wait > 0) { const b = document.createElement('div'); b.className = 'badge'; b.textContent = wait; el.appendChild(b); }
    el.onclick = () => openPerson(m.id);
    scene.appendChild(el);
    const startX = 5 + Math.random() * 85;
    el.style.left = startX + '%'; el.style.top = (58 + Math.random() * 26) + '%';
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
function topicCell(topic, note) {
  return `<td class="topic-cell">${esc(topic)}${note ? `<span class="note-sub">📝 ${esc(note)}</span>` : ''}</td>`;
}
function actBtns(kind, id, row) {
  if (!canEdit(row)) return '<td></td>';
  return `<td><button class="edit-btn" onclick="edit('${kind}','${id}')">✏️</button><button class="del-btn" onclick="delAny('${kind}','${id}')">🗑️</button></td>`;
}
function collapsible(label, count, extra, bodyHtml) {
  return `<div class="group-card">
    <div class="group-head" onclick="this.parentElement.classList.toggle('closed')">
      <h4>📅 ${label}</h4><span class="gh-count">${count} งาน${extra || ''}</span><span class="arrow">▼</span></div>
    <div class="group-body">${bodyHtml}</div></div>`;
}

function pastTable(rows, withPerson) {
  const head = `<tr>${withPerson ? '<th>คนทำ</th>' : ''}<th>วันที่โพส</th><th>ประเภท</th><th>หัวข้อคอนเทนต์</th><th>ฝ่าย</th><th>แบรนด์</th><th>เพจ</th><th>KPI</th><th>ลิงก์ทุกช่องทาง</th><th>รูป</th><th></th></tr>`;
  return `<table>${head}${rows.map(t => {
    const m = getMember(t.memberId), mc = m ? memberColor(m) : '#8395ab';
    return `<tr>${withPerson ? `<td><span class="tag" style="background:${mc}22;color:${mc}">${m ? esc(m.name) : '-'}</span></td>` : ''}
      <td>${fmtDate(t.date)}</td><td><span class="tag type-tag">${esc(t.type)}</span></td>${topicCell(t.topic, t.note)}
      <td>${esc(t.dept)}</td><td>${esc(t.brand)}</td><td>${esc(t.pages)}</td>
      <td><span class="tag ${kcls(t.kpi || 'รอผล')}">${esc(t.kpi || 'รอผล')}</span></td>
      <td style="text-align:left;min-width:130px;">${linkCell(t.id)}</td>
      <td style="min-width:76px;">${imgCell('task', t.id)}</td>${actBtns('c', t.id, t)}</tr>`;
  }).join('')}</table>`;
}
function planTable(rows) {
  const head = `<tr><th>ลำดับ</th><th>สถานะขั้นตอน</th><th>ประเภท</th><th>รายละเอียด</th><th>แบรนด์</th><th>เพจ</th><th>ฝ่าย</th><th>กำหนดออนแอร์</th><th>รูป</th><th></th></tr>`;
  rows = rows.slice().sort((a, b) => (+a.planOrder || 0) - (+b.planOrder || 0));
  return `<table>${head}${rows.map(t => `<tr>
    <td>${esc(t.planOrder)}</td>
    <td><span class="tag ${stcls(t.planStatus)}">${esc(t.planStatus)}</span></td>
    <td><span class="tag type-tag">${esc(t.type)}</span></td>${topicCell(t.topic, t.note)}
    <td>${esc(t.brand)}</td><td>${esc(t.pages)}</td><td>${esc(t.dept)}</td>
    <td>${esc(t.due)} ${dueBadge(t.due, t.planStatus === 'เสร็จสิ้น')}</td>
    <td style="min-width:76px;">${imgCell('task', t.id)}</td>${actBtns('c', t.id, t)}</tr>`).join('')}</table>`;
}
function prodTable(rows) {
  const head = `<tr><th>วันที่รับงาน</th><th>ความด่วน</th><th>จากสาขา</th><th>รายการงาน / ปัญหา</th><th>ผู้ส่งงานต่อ</th><th>ส่งแบบ/ซ่อม</th><th>เสร็จ/รับของ</th><th>สถานะ</th><th>รูป</th><th></th></tr>`;
  rows = rows.slice().sort((a, b) => (b.recv || '').localeCompare(a.recv || ''));
  return `<table>${head}${rows.map(t => `<tr>
    <td>${fmtDate(t.recv)}</td><td><span class="tag ${/ด่วน/.test(t.urg) ? 'urgent' : 'normal'}">${esc(t.urg)}</span></td>
    <td>${esc(t.branch)}</td>${topicCell(t.detail, t.note)}<td>${esc(t.fwd)}</td><td>${esc(t.send)}</td><td>${esc(t.done)}</td>
    <td><span class="tag ${stcls(t.status)}">${esc(t.status)}</span></td>
    <td style="min-width:76px;">${imgCell('prod', t.id)}</td>${actBtns('p', t.id, t)}</tr>`).join('')}</table>`;
}
function projTable(items) {
  const head = `<tr><th>สถานะงาน</th><th>ขั้นตอน / รายละเอียด</th><th>จำนวน</th><th>พื้นที่/สาขา</th><th>Brand</th><th>ขนาด</th><th>ผู้รับผิดชอบ</th><th>กำหนด</th><th>รูป</th><th></th></tr>`;
  return `<table>${head}${items.map(t => `<tr>
    <td><span class="tag ${stcls(t.status)}">${esc(t.status)}</span></td>${topicCell(t.detail, t.note)}
    <td>${esc(t.qty)}</td><td>${esc(t.area)}</td><td>${esc(t.brand)}</td><td>${esc(t.size)}</td><td>${esc(t.owner)}</td>
    <td>${esc(t.due)} ${dueBadge(t.due, /เสร็จ|เรียบร้อย/.test(t.status || ''))}</td>
    <td style="min-width:76px;">${imgCell('proj', t.id)}</td>${actBtns('j', t.id, t)}</tr>`).join('')}</table>`;
}

/* ================= PERSON VIEW ================= */
const filters = { person: { brand: '' }, review: { brand: '', mode: 'week' }, proj: { sel: '' } };

function brandChips(cid, fkey, onPick) {
  const cur = filters[fkey].brand;
  document.getElementById(cid).innerHTML =
    `<button class="chip ${cur === '' ? 'on' : ''}" onclick="${onPick}('')">ทั้งหมด</button>` +
    S.brands.map(b => `<button class="chip ${cur === b.name ? 'on' : ''}" onclick="${onPick}('${esc(b.name)}')">${esc(b.name)}</button>`).join('') +
    (isAdmin() ? `<button class="chip add-chip" onclick="addBrandQuick()">+ เพิ่มแบรนด์</button>` : '');
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
  const past = all.filter(t => t.section === 'past');
  const plan = all.filter(t => t.section === 'plan');
  document.getElementById('pStats').innerHTML =
    stat(past.length, 'ผลงานที่ลงแล้ว') +
    stat(past.filter(t => t.kpi === 'ผ่าน').length, 'ผ่าน KPI ✅') +
    stat(past.filter(t => t.kpi === 'ไม่ผ่าน').length, 'ไม่ผ่าน ❌') +
    stat(plan.length, 'แผนงานเดือน 🗓️') +
    stat(plan.filter(t => dueState(t.due, t.planStatus === 'เสร็จสิ้น') === 'overdue').length, 'เลยกำหนด ⏰');

  const weekGroups = groupBy(past.slice().sort((a,b)=>(b.date||'').localeCompare(a.date||'')), t => t.date ? weekKey(t.date) : '', weekLabel);
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
        <span class="sec-sub">Monthly Content Plan · เมื่อสถานะ "เสร็จสิ้น" งานจะย้ายไปตารางสัปดาห์อัตโนมัติ</span>
        <button class="btn small" onclick="edit('c',null,'${m.id}','plan')">➕ เพิ่มแผน</button></div>
      ${monthGroups.length ? monthGroups.map(g => collapsible(g.label, g.items.length,
        ' · เสร็จสิ้น ' + g.items.filter(t => t.planStatus === 'เสร็จสิ้น').length, planTable(g.items))).join('')
        : '<div class="card" style="text-align:center;color:#7a8aa0;">ยังไม่มีแผนงาน</div>'}
    </div>`;
}

/* ================= REVIEW + ค้นหาขั้นสูง ================= */
function renderReview() {
  brandChips('reviewChips', 'review', 'pickReviewBrand');
  const mt = document.getElementById('reviewMode');
  mt.className = 'mode-tog';
  mt.innerHTML = `<button class="${filters.review.mode==='week'?'on':''}" onclick="filters.review.mode='week';renderReview()">รายสัปดาห์</button>
                  <button class="${filters.review.mode==='month'?'on':''}" onclick="filters.review.mode='month';renderReview()">รายเดือน</button>`;

  fillFilterSelect('fPerson', S.members.filter(m => m.role !== 'prod').map(m => [m.id, m.name]), 'ผู้รับผิดชอบ: ทุกคน');
  fillFilterSelect('fMonth', [...new Set(S.tasks.map(t => t.section==='past' ? monthKey(t.date) : t.month).filter(Boolean))].sort().reverse().map(k => [k, monthLabel(k)]), 'เดือน: ทั้งหมด');
  fillFilterSelect('fStatus', [...new Set([...S.tasks.map(t=>t.kpi), ...S.tasks.map(t=>t.planStatus)].filter(Boolean))].map(v=>[v,v]), 'สถานะ: ทั้งหมด');
  fillFilterSelect('fChannel', ddValues('channel').map(v=>[v,v]), 'ช่องทาง: ทั้งหมด');
  fillFilterSelect('fType', ddValues('contentType').map(v=>[v,v]), 'ประเภทงาน: ทั้งหมด');

  const q = (document.getElementById('fSearch').value || '').toLowerCase();
  const fp = fVal('fPerson'), fm = fVal('fMonth'), fs = fVal('fStatus'),
        fc = fVal('fChannel'), ft = fVal('fType'), fsec = fVal('fSection');

  let rows = S.tasks.filter(t =>
    brandMatch(t.brand, filters.review.brand) &&
    (!fp || t.memberId === fp) &&
    (!fm || (t.section === 'past' ? monthKey(t.date) : t.month) === fm) &&
    (!fs || t.kpi === fs || t.planStatus === fs) &&
    (!ft || t.type === ft) &&
    (!fc || linksOf(t.id).some(l => l.channel === fc)) &&
    (!fsec || t.section === fsec) &&
    (!q || (t.topic + ' ' + (t.note||'') + ' ' + (t.dept||'')).toLowerCase().includes(q))
  );
  const past = rows.filter(t => t.section === 'past');
  const plan = rows.filter(t => t.section === 'plan');

  const stat = (n, l) => `<div class="stat"><div class="num">${n}</div><div class="lbl">${l}</div></div>`;
  document.getElementById('reviewStats').innerHTML =
    stat(rows.length, 'งานที่พบ' + (filters.review.brand ? ' (' + filters.review.brand + ')' : '')) +
    stat(past.filter(t => t.kpi === 'ผ่าน').length, 'ผ่าน KPI ✅') +
    stat(past.filter(t => t.kpi === 'ไม่ผ่าน').length, 'ไม่ผ่าน ❌') +
    stat(plan.filter(t => t.planStatus !== 'เสร็จสิ้น').length, 'แผนที่ค้างอยู่ 🗓️');

  let html = '';
  if (!fsec || fsec === 'past') {
    const groups = filters.review.mode === 'month'
      ? groupBy(past, t => monthKey(t.date), monthLabel)
      : groupBy(past, t => t.date ? weekKey(t.date) : '', weekLabel);
    html += groups.map(g => collapsible(g.label, g.items.length,
      ' · ผ่าน KPI ' + g.items.filter(t => t.kpi === 'ผ่าน').length,
      pastTable(g.items.sort((a,b)=>(b.date||'').localeCompare(a.date||'')), true))).join('');
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
['fSearch','fPerson','fMonth','fStatus','fChannel','fType','fSection'].forEach(id => {
  document.addEventListener('DOMContentLoaded', () => {
    const el = document.getElementById(id);
    if (el) el.addEventListener(id === 'fSearch' ? 'input' : 'change', debounce(renderReview, 250));
  });
});

/* ================= DASHBOARD ================= */
function renderDashboard() {
  const stat = (n, l, color) => `<div class="stat"><div class="num" style="color:${color||'#1e3a5f'}">${n}</div><div class="lbl">${l}</div></div>`;
  const plan = S.tasks.filter(t => t.section === 'plan');
  const overdue = plan.filter(t => dueState(t.due, t.planStatus === 'เสร็จสิ้น') === 'overdue');
  const soon = plan.filter(t => dueState(t.due, t.planStatus === 'เสร็จสิ้น') === 'soon');
  document.getElementById('dashStats').innerHTML =
    stat(S.tasks.length, 'งานทั้งหมด') +
    stat(plan.filter(t => t.planStatus !== 'เสร็จสิ้น').length, 'รอดำเนินการ ⏳', '#a07b12') +
    stat(plan.filter(t => t.planStatus === 'เสร็จสิ้น').length + S.tasks.filter(t=>t.section==='past'&&t.kpi==='ผ่าน').length, 'เสร็จแล้ว ✅', '#1c7c47') +
    stat(overdue.length, 'เกินกำหนด ⏰', '#c0392b');

  const count = (arr, keyFn) => {
    const m = {}; arr.forEach(x => { const k = keyFn(x) || 'ไม่ระบุ'; m[k] = (m[k] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  };
  barChart('dashByMonth', count(S.tasks, t => { const k = t.section==='past' ? monthKey(t.date) : t.month; return k ? monthLabel(k) : ''; }));
  barChart('dashByBrand', count(S.tasks, t => t.brand));
  barChart('dashByStatus', count(S.tasks, t => t.section === 'past' ? ('KPI ' + (t.kpi || 'รอผล')) : t.planStatus));
  document.getElementById('dashDue').innerHTML =
    (overdue.length + soon.length) === 0 ? '<div style="color:#7a8aa0;font-size:13px;">ไม่มีงานใกล้ถึงกำหนด 🎉</div>' :
    [...overdue.map(t => ({ t, cls: 'due-red', txt: 'เลยกำหนด' })), ...soon.map(t => ({ t, cls: 'due-yellow', txt: 'ใกล้กำหนด' }))]
      .map(({ t, cls, txt }) => {
        const m = getMember(t.memberId);
        return `<div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;font-size:12.5px;">
          <span class="tag ${cls}">${txt}</span><span style="flex:1;">${esc(t.topic)}</span>
          <span style="color:#7a8aa0;">${m ? esc(m.name) : ''} · ${esc(t.due)}</span></div>`;
      }).join('');
}
function barChart(elId, entries) {
  const max = Math.max(1, ...entries.map(e => e[1]));
  document.getElementById(elId).innerHTML = entries.slice(0, 10).map(([label, n]) =>
    `<div class="bar-row"><div class="bar-label" title="${esc(label)}">${esc(label)}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.round(n / max * 100)}%">${n}</div></div></div>`).join('')
    || '<div style="color:#7a8aa0;font-size:13px;">ยังไม่มีข้อมูล</div>';
}

/* ================= PROJECTS ================= */
function renderProjects() {
  if (!filters.proj.sel && S.projects.length) filters.proj.sel = S.projects[0].id;
  document.getElementById('projChips').innerHTML = S.projects.map(p =>
    `<button class="chip ${filters.proj.sel === p.id ? 'on' : ''}" onclick="filters.proj.sel='${p.id}';renderProjects()">${esc(p.name)}</button>`).join('') +
    (isAdmin() ? `<button class="chip add-chip" onclick="addProject()">+ เพิ่มโปรเจกต์</button>` : '');
  const pj = S.projects.find(p => p.id === filters.proj.sel);
  if (!pj) { document.getElementById('projGroups').innerHTML = '<div class="card" style="text-align:center;color:#7a8aa0;">ยังไม่มีโปรเจกต์</div>'; return; }
  const groups = S.projGroups.filter(g => g.projectId === pj.id);
  document.getElementById('projGroups').innerHTML =
    `<div class="card" style="color:#5a6b80;font-size:13px;">${esc(pj.sub || '')}</div>` +
    groups.map(g => {
      const items = S.projItems.filter(x => x.groupId === g.id);
      const done = items.filter(t => /เสร็จ|เรียบร้อย/.test(t.status || '')).length;
      return `<div class="group-card">
        <div class="group-head" onclick="this.parentElement.classList.toggle('closed')">
          <h4>📌 ${esc(g.name)}</h4><span class="gh-count">${items.length} รายการ · เสร็จ ${done}</span>
          <button class="btn small" style="margin-left:8px;" onclick="event.stopPropagation();edit('j',null,'${g.id}')">➕ เพิ่ม</button>
          <span class="arrow">▼</span></div>
        <div class="group-body">${items.length ? projTable(items) : '<div style="text-align:center;color:#7a8aa0;padding:10px;">ยังไม่มีรายการ</div>'}</div></div>`;
    }).join('');
}
async function addProject() {
  const name = prompt('ชื่อโปรเจกต์ใหม่:'); if (!name || !name.trim()) return;
  try { await API.create('projects', { id: uid(), name: name.trim(), sub: '' }); toast('เพิ่มโปรเจกต์แล้ว ✓', 'success'); await refresh(); }
  catch (e) { toast(e.message, 'error'); }
}
async function addProjGroup() {
  const pj = S.projects.find(p => p.id === filters.proj.sel); if (!pj) return;
  const name = prompt(`ชื่อหมวด/อีเวนต์ใหม่ใน "${pj.name}":`); if (!name || !name.trim()) return;
  try { await API.create('projGroups', { id: uid(), projectId: pj.id, name: name.trim() }); toast('เพิ่มหมวดแล้ว ✓', 'success'); await refresh(); }
  catch (e) { toast(e.message, 'error'); }
}

/* ================= DROPDOWN / BRAND (เพิ่มได้จากหน้าเว็บ) ================= */
async function addDropdown(cat, selId) {
  const v = prompt('เพิ่มรายการใหม่:'); if (!v || !v.trim()) return;
  try {
    await API.create('dropdowns', { id: uid(), category: cat, value: v.trim() });
    S.dropdowns.push({ id: uid(), category: cat, value: v.trim() });
    if (selId) fillDD(selId, cat, v.trim());
    toast('เพิ่ม "' + v.trim() + '" แล้ว ✓', 'success');
  } catch (e) { toast(e.message, 'error'); }
}
async function addBrandQuick(selId) {
  const v = prompt('ชื่อแบรนด์ใหม่:'); if (!v || !v.trim()) return;
  try {
    await API.create('brands', { id: uid(), name: v.trim() });
    S.brands.push({ id: uid(), name: v.trim() });
    if (selId) fillBrandDD(selId, v.trim()); else if (document.getElementById('cModal').classList.contains('open')) fillBrandDD('cBrand', v.trim());
    renderAll();
    toast('เพิ่มแบรนด์ "' + v.trim() + '" แล้ว — หน้าตรวจงานอัปเดตอัตโนมัติ ✓', 'success');
  } catch (e) { toast(e.message, 'error'); }
}

/* ================= EDIT / SAVE / DELETE ================= */
let editKind = 'c', editId = null, editCtx = null, pendingImgs = [], editLinks = [];

function findAny(kind, id) {
  if (kind === 'c') return S.tasks.find(t => t.id === id);
  if (kind === 'p') return S.prodTasks.find(t => t.id === id);
  return S.projItems.find(t => t.id === id);
}
async function delAny(kind, id) {
  if (!confirm('ลบรายการนี้?')) return;
  const entity = kind === 'c' ? 'tasks' : kind === 'p' ? 'prodTasks' : 'projItems';
  try { await API.remove(entity, id); toast('ลบแล้ว ✓', 'success'); await refresh(); }
  catch (e) { toast(e.message, 'error'); }
}

function edit(kind, id, ctx, section) {
  editKind = kind; editId = id; editCtx = ctx || null; pendingImgs = []; editLinks = [];
  if (kind === 'c') {
    const sel = document.getElementById('cMember');
    sel.innerHTML = S.members.filter(m => m.role !== 'prod').map(m => `<option value="${m.id}">${esc(m.name)}</option>`).join('');
    fillDD('cType', 'contentType'); fillDD('cDept', 'dept'); fillDD('cPlanSt', 'planStatus'); fillBrandDD('cBrand');
    if (id) {
      const t = findAny('c', id);
      document.getElementById('cTitle').textContent = '✏️ แก้ไขงาน';
      cSection.value = t.section; sel.value = t.memberId;
      cDate.value = t.date || ''; cMonth.value = t.month || ''; cOrder.value = t.planOrder || '';
      fillDD('cPlanSt', 'planStatus', t.planStatus); cDue.value = t.due || ''; cPostDate.value = '';
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
    renderLinkRows(); cSecFields(); renderThumbs('cThumbs', 'task', id); openM('cModal');
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
  const show = cSection.value === 'plan' && cPlanSt.value === 'เสร็จสิ้น';
  document.querySelectorAll('.f-postdate').forEach(e => e.style.display = show ? '' : 'none');
  if (show && !cPostDate.value) cPostDate.value = new Date().toISOString().slice(0, 10);
}
function openM(id) { document.getElementById(id).classList.add('open'); }
function closeM(id) { document.getElementById(id).classList.remove('open'); }
['cModal','pModal','jModal','aModal','xModal'].forEach(id =>
  document.addEventListener('DOMContentLoaded', () =>
    document.getElementById(id).addEventListener('click', e => { if (e.target.id === id) closeM(id); })));

/* ---------- ลิงก์หลายช่องทาง ---------- */
function renderLinkRows() {
  document.getElementById('linkRows').innerHTML = editLinks.map((l, i) => `
    <div class="link-row">
      <select onchange="editLinks[${i}].channel=this.value">${ddValues('channel').map(c =>
        `<option ${l.channel === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
      <input type="url" placeholder="วางลิงก์..." value="${esc(l.url)}" oninput="editLinks[${i}].url=this.value">
      <input type="text" placeholder="Like" value="${esc(l.likes)}" oninput="editLinks[${i}].likes=this.value">
      <input type="text" placeholder="Share" value="${esc(l.shares)}" oninput="editLinks[${i}].shares=this.value">
      <button class="del-btn" onclick="editLinks.splice(${i},1);renderLinkRows()">🗑️</button>
    </div>`).join('');
}
function addLinkRow() {
  editLinks.push({ id: '', channel: ddValues('channel')[0] || 'Facebook', url: '', likes: '', shares: '' });
  renderLinkRows();
}

/* ---------- บันทึก ---------- */
async function saveC() {
  if (!cTopic.value.trim()) { toast('กรุณาใส่หัวข้อ/รายละเอียด', 'error'); return; }
  const isPlan = cSection.value === 'plan';
  const row = {
    memberId: cMember.value, section: cSection.value,
    date: isPlan ? '' : cDate.value, month: isPlan ? cMonth.value : '',
    planOrder: cOrder.value, planStatus: isPlan ? cPlanSt.value : '', due: cDue.value.trim(),
    type: cType.value, dept: cDept.value, topic: cTopic.value.trim(), brand: cBrand.value,
    pages: cPages.value.trim(), kpi: isPlan ? '' : cKpi.value, note: cNote.value.trim(),
  };
  try {
    let taskId = editId;
    if (editId) await API.update('tasks', editId, row);
    else { const res = await API.create('tasks', { id: (taskId = uid()), ...row }); }

    // แผนเสร็จสิ้น -> สร้างงานในตาราง "ผลงานที่ลงแล้ว" ให้อัตโนมัติ ตามวันที่โพสต์จริง
    const existing = editId ? findAny('c', editId) : null;
    if (isPlan && cPlanSt.value === 'เสร็จสิ้น' && cPostDate.value && !(existing && existing.movedPastId)) {
      const pastId = uid();
      await API.create('tasks', { id: pastId, memberId: row.memberId, section: 'past',
        date: cPostDate.value, type: row.type, topic: row.topic, dept: row.dept, brand: row.brand,
        pages: row.pages, kpi: 'รอผล', note: (row.note ? row.note + ' · ' : '') + 'ย้ายมาจากแผนเดือนอัตโนมัติ' });
      await API.update('tasks', taskId, { movedPastId: pastId });
      toast('✅ เสร็จสิ้น! ย้ายงานไปสัปดาห์ของวันที่ ' + fmtDate(cPostDate.value) + ' แล้ว', 'success', 3500);
    }
    if (!isPlan) await API.call('saveLinks', { taskId, links: editLinks.filter(l => l.url.trim()) }, { msg: 'กำลังบันทึกลิงก์...' });
    await uploadPending('task', taskId);
    closeM('cModal'); toast('บันทึกสำเร็จ ✓', 'success'); await refresh();
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
    else await API.create('prodTasks', { id: (id = uid()), ...row });
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
    else await API.create('projItems', { id: (id = uid()), groupId: editCtx, ...row });
    await uploadPending('proj', id);
    closeM('jModal'); toast('บันทึกสำเร็จ ✓', 'success'); await refresh();
  } catch (e) { toast('บันทึกไม่สำเร็จ: ' + e.message, 'error', 4500); }
}

/* ================= รูปภาพ (Google Drive — ห้ามเก็บ Base64 ในชีต) ================= */
function renderThumbs(elId, refType, refId) {
  const existing = refId ? imagesOf(refType, refId) : [];
  document.getElementById(elId).innerHTML =
    existing.map(im => `<div class="thumb"><img src="${esc(im.thumb || im.url)}" onclick="openLightbox('${esc(im.url)}')">
      <button class="rm" onclick="removeImage('${im.id}','${elId}','${refType}','${refId}')">✕</button></div>`).join('') +
    pendingImgs.map((d, i) => `<div class="thumb"><img src="${d}"><button class="rm" onclick="pendingImgs.splice(${i},1);renderThumbs('${elId}','${refType}','${refId}')">✕</button></div>`).join('');
}
async function removeImage(imgId, elId, refType, refId) {
  if (!confirm('ลบรูปนี้?')) return;
  try { await API.remove('images', imgId); S.images = S.images.filter(i => i.id !== imgId); renderThumbs(elId, refType, refId); toast('ลบรูปแล้ว ✓', 'success'); }
  catch (e) { toast(e.message, 'error'); }
}
async function uploadPending(refType, refId) {
  for (const dataUrl of pendingImgs) await API.uploadImage(refType, refId, dataUrl);
  pendingImgs = [];
}
function activeThumbsEl() {
  if (document.getElementById('cModal').classList.contains('open')) return ['cThumbs', 'task'];
  if (document.getElementById('pModal').classList.contains('open')) return ['pThumbs', 'prod'];
  if (document.getElementById('jModal').classList.contains('open')) return ['jThumbs', 'proj'];
  return null;
}
function addFiles(files) {
  const a = activeThumbsEl(); if (!a) return;
  [...files].forEach(f => { if (f && f.type.startsWith('image/'))
    compressImage(f, d => { pendingImgs.push(d); renderThumbs(a[0], a[1], editId); }); });
}
document.addEventListener('paste', e => {
  const items = (e.clipboardData && e.clipboardData.items) ? [...e.clipboardData.items] : [];
  const files = items.filter(it => it.type.startsWith('image/')).map(it => it.getAsFile());
  if (files.length) addFiles(files);
});
document.addEventListener('DOMContentLoaded', () => {
  [['pasteZone','imgInput'],['pasteZoneP','imgInputP'],['pasteZoneJ','imgInputJ']].forEach(([z, f]) => {
    const zone = document.getElementById(z), file = document.getElementById(f);
    zone.addEventListener('click', () => file.click());
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag'));
    zone.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('drag'); addFiles(e.dataTransfer.files); });
    file.addEventListener('change', e => { addFiles(e.target.files); e.target.value = ''; });
  });
});
function openLightbox(src) { document.getElementById('lightboxImg').src = src; document.getElementById('lightbox').classList.add('open'); }

/* ================= EXPORT CSV ================= */
function exportCSV() {
  fillFilterSelect('xMonth', [...new Set(S.tasks.map(t => t.section==='past' ? monthKey(t.date) : t.month).filter(Boolean))].sort().reverse().map(k => [k, monthLabel(k)]), 'ทั้งหมด');
  fillFilterSelect('xBrand', S.brands.map(b => [b.name, b.name]), 'ทั้งหมด');
  fillFilterSelect('xStatus', [...new Set([...S.tasks.map(t=>t.kpi), ...S.tasks.map(t=>t.planStatus)].filter(Boolean))].map(v=>[v,v]), 'ทั้งหมด');
  openM('xModal');
}
function doExport() {
  const fm = fVal('xMonth'), fb = fVal('xBrand'), fs = fVal('xStatus');
  const rows = S.tasks.filter(t =>
    (!fm || (t.section === 'past' ? monthKey(t.date) : t.month) === fm) &&
    (!fb || brandMatch(t.brand, fb)) &&
    (!fs || t.kpi === fs || t.planStatus === fs)
  ).map(t => ({
    Section: t.section === 'past' ? 'ผลงานที่ลงแล้ว' : 'แผนงานเดือน',
    ผู้รับผิดชอบ: (getMember(t.memberId) || {}).name || '',
    วันที่โพส: fmtDate(t.date), เดือน: t.month, ลำดับแผน: t.planOrder, สถานะแผน: t.planStatus,
    ประเภท: t.type, หัวข้อ: t.topic, ฝ่าย: t.dept, แบรนด์: t.brand, เพจ: t.pages,
    KPI: t.kpi, กำหนดออนแอร์: t.due, หมายเหตุ: t.note,
    ลิงก์: linksOf(t.id).map(l => `${l.channel}: ${l.url}`).join(' | '),
    ผู้สร้าง: t.createdBy, แก้ไขล่าสุดโดย: t.updatedBy,
  }));
  if (!rows.length) { toast('ไม่มีข้อมูลตามเงื่อนไข', 'error'); return; }
  downloadFile(`RMA-tasks-${new Date().toISOString().slice(0,10)}.csv`, toCSV(rows, Object.keys(rows[0])));
  closeM('xModal'); toast('ดาวน์โหลด CSV แล้ว ✓', 'success');
}

/* ================= ADMIN ================= */
function openAdmin() { adminTab('brands'); openM('aModal'); }
function adminTab(tab) {
  const el = document.getElementById('adminBody');
  if (tab === 'brands') {
    el.innerHTML = `<div class="admin-list">` + S.brands.map(b => `
      <div class="admin-item"><span class="grow">🏷️ ${esc(b.name)}</span>
        <button class="btn small blue" onclick="renameBrand('${b.id}')">แก้ชื่อ</button>
        <button class="btn small gray" onclick="deleteBrand('${b.id}')">ลบ</button></div>`).join('') +
      `</div><button class="btn small" style="margin-top:10px;" onclick="addBrandQuick()">➕ เพิ่มแบรนด์</button>`;
  } else if (tab === 'dropdowns') {
    const cats = [['contentType','ประเภทคอนเทนต์'],['dept','ฝ่าย'],['planStatus','สถานะแผน'],['urgency','ความด่วน'],['branch','สาขา'],['prodStatus','สถานะงานผลิต'],['projStatus','สถานะเช็คลิสต์'],['channel','ช่องทางโพสต์']];
    el.innerHTML = cats.map(([cat, label]) => `
      <div style="margin-bottom:12px;"><strong style="color:#1e3a5f;font-size:13px;">${label}</strong>
      <div class="chips" style="margin-top:5px;">` +
      S.dropdowns.filter(d => d.category === cat).map(d =>
        `<span class="chip" style="cursor:default;">${esc(d.value)} <button class="del-btn" onclick="delDropdown('${d.id}')">✕</button></span>`).join('') +
      `<button class="chip add-chip" onclick="addDropdown('${cat}');setTimeout(()=>adminTab('dropdowns'),600)">+ เพิ่ม</button></div></div>`).join('');
  } else if (tab === 'members') {
    el.innerHTML = `<div class="admin-list">` + S.members.map(m => `
      <div class="admin-item"><span class="grow">${m.role === 'prod' ? '🛠️' : '📝'} ${esc(m.name)} <small style="color:#7a8aa0;">${esc(m.dept || '')}</small></span>
        <button class="btn small blue" onclick="editMember('${m.id}')">แก้ไข</button>
        <button class="btn small gray" onclick="deleteMember('${m.id}')">ลบ</button></div>`).join('') +
      `</div><button class="btn small" style="margin-top:10px;" onclick="addMember()">➕ เพิ่มสมาชิก</button>`;
  } else if (tab === 'users') {
    el.innerHTML = `<div class="admin-list">` + S.users.map(u => `
      <div class="admin-item"><span class="grow">${esc(u.name || u.email)}<small style="color:#7a8aa0;"> ${esc(u.email)}</small></span>
        <select onchange="changeRole('${esc(u.email)}', this.value, '${u.active}')">
          <option value="user" ${u.role !== 'admin' ? 'selected' : ''}>User</option>
          <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option></select>
        <select onchange="changeRole('${esc(u.email)}', '${u.role}', this.value)">
          <option value="TRUE" ${String(u.active) !== 'FALSE' ? 'selected' : ''}>ใช้งานได้</option>
          <option value="FALSE" ${String(u.active) === 'FALSE' ? 'selected' : ''}>ระงับ</option></select></div>`).join('') + `</div>
      <p style="font-size:12px;color:#7a8aa0;margin-top:8px;">ผู้ใช้ใหม่จะถูกเพิ่มอัตโนมัติเมื่อล็อกอินครั้งแรก (คนแรกสุดเป็น Admin)</p>`;
  }
}
async function renameBrand(id) {
  const b = S.brands.find(x => x.id === id);
  const v = prompt('ชื่อแบรนด์ใหม่:', b.name); if (!v || !v.trim()) return;
  try { await API.update('brands', id, { name: v.trim() }); toast('แก้ชื่อแล้ว ✓', 'success'); await refresh(); adminTab('brands'); }
  catch (e) { toast(e.message, 'error'); }
}
async function deleteBrand(id) {
  if (!confirm('ลบแบรนด์นี้? (งานเดิมที่ใช้ชื่อนี้จะยังอยู่)')) return;
  try { await API.remove('brands', id); toast('ลบแล้ว ✓', 'success'); await refresh(); adminTab('brands'); }
  catch (e) { toast(e.message, 'error'); }
}
async function delDropdown(id) {
  if (!confirm('ลบรายการนี้?')) return;
  try { await API.remove('dropdowns', id); S.dropdowns = S.dropdowns.filter(d => d.id !== id); adminTab('dropdowns'); toast('ลบแล้ว ✓', 'success'); }
  catch (e) { toast(e.message, 'error'); }
}
async function addMember() {
  const name = prompt('ชื่อสมาชิกใหม่:'); if (!name || !name.trim()) return;
  const dept = prompt('รับผิดชอบเพจ/แบรนด์/หน้าที่ (เว้นว่างได้):') || '';
  const isProd = confirm('เป็นทีมงานผลิต/ซ่อมบำรุงไหม? (OK = ทีมผลิต, Cancel = ทีมคอนเทนต์)');
  try { await API.create('members', { id: uid(), name: name.trim(), dept: dept.trim(), role: isProd ? 'prod' : 'content' });
    toast('เพิ่มสมาชิกแล้ว ✓', 'success'); await refresh(); if (document.getElementById('aModal').classList.contains('open')) adminTab('members'); }
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
  if (!confirm('ลบสมาชิกนี้? (งานของเขาจะยังอยู่ในชีต)')) return;
  try { await API.remove('members', id); toast('ลบแล้ว ✓', 'success'); await refresh(); adminTab('members'); }
  catch (e) { toast(e.message, 'error'); }
}
async function changeRole(email, role, active) {
  try { await API.setUserRole(email, role, active); toast('บันทึกสิทธิ์แล้ว ✓', 'success'); await refresh(); adminTab('users'); }
  catch (e) { toast(e.message, 'error'); }
}
