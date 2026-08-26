/* Sidebar + shared UI helpers.
   All icons are inline SVG in dark navy blue (#0d2b6b). */

const ICONS = {
  dashboard: '<svg viewBox="0 0 24 24"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/></svg>',
  users:     '<svg viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>',
  student:   '<svg viewBox="0 0 24 24"><path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z"/></svg>',
  clock:     '<svg viewBox="0 0 24 24"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.4 0-8-3.6-8-8s3.6-8 8-8 8 3.6 8 8-3.6 8-8 8zm.5-13H11v6l5.2 3.2.8-1.3-4.5-2.7V7z"/></svg>',
  report:    '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm4 18H6V4h7v5h5v11zM8 12h8v2H8zm0 4h8v2H8z"/></svg>',
  bell:      '<svg viewBox="0 0 24 24"><path d="M12 22a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2zm6-6V11c0-3.07-1.63-5.64-4.5-6.32V4a1.5 1.5 0 0 0-3 0v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>',
  user:      '<svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>',
  folder:    '<svg viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-2 .9-2 2v12a2 2 0 0 0 2 2h16c1.1 0 2-.9 2-2V8a2 2 0 0 0-2-2h-8l-2-2z"/></svg>',
  camera:    '<svg viewBox="0 0 24 24"><path d="M12 15.2A3.2 3.2 0 1 0 12 8.8a3.2 3.2 0 0 0 0 6.4zM9 2L7.17 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16c1.1 0 2-.9 2-2V6a2 2 0 0 0-2-2h-3.17L15 2H9zm3 15a5 5 0 1 1 0-10 5 5 0 0 1 0 10z"/></svg>',
  archive:   '<svg viewBox="0 0 24 24"><path d="M20.54 5.23l-1.39-1.68A1.45 1.45 0 0 0 18 3H6c-.47 0-.88.21-1.15.55L3.46 5.23A2 2 0 0 0 3 6.5V19a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6.5c0-.5-.17-.96-.46-1.27zM12 17.5L6.5 12H10v-2h4v2h3.5L12 17.5zM5.12 5l.81-1h12l.94 1H5.12z"/></svg>',
  megaphone: '<svg viewBox="0 0 24 24"><path d="M3 10v4a1 1 0 0 0 1 1h1l4 4V5L5 9H4a1 1 0 0 0-1 1zm13.5 2c0-1.77-1-3.29-2.5-4.03v8.05c1.5-.72 2.5-2.25 2.5-4.02z"/></svg>',
  settings:  '<svg viewBox="0 0 24 24"><path d="M19.14 12.94a7.53 7.53 0 0 0 0-1.88l2.03-1.58a.5.5 0 0 0 .12-.61l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.03 7.03 0 0 0-1.63-.94l-.36-2.54A.49.49 0 0 0 13.9 2h-3.84a.49.49 0 0 0-.5.41l-.36 2.54c-.6.23-1.14.55-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.66 8.47a.5.5 0 0 0 .12.61l2.03 1.58a7.53 7.53 0 0 0 0 1.88l-2.03 1.58a.5.5 0 0 0-.12.61l1.92 3.32c.14.24.42.34.66.22l2.39-.96c.5.39 1.04.71 1.64.94l.36 2.54c.05.24.26.41.5.41h3.84c.24 0 .45-.17.5-.41l.36-2.54c.6-.23 1.14-.55 1.63-.94l2.39.96c.24.09.5 0 .66-.22l1.92-3.32a.5.5 0 0 0-.12-.61l-2.03-1.58zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z"/></svg>',
  logout:    '<svg viewBox="0 0 24 24"><path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5-5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14a2 2 0 0 0 2 2h8v-2H4V5z"/></svg>',
  menu:      '<svg viewBox="0 0 24 24"><path d="M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z"/></svg>',
  back:      '<svg viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>',
  // Navy stat-card icons (each rendered inside .stat-icon which is navy-blue tinted)
  statUsers:   '<svg viewBox="0 0 24 24"><path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>',
  statCheck:   '<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm-1.2 14.2l-4-4 1.4-1.4 2.6 2.6 5.6-5.6L17.8 9z"/></svg>',
  statClose:   '<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm3.5 13.09L14.09 16.5 12 14.41 9.91 16.5 8.5 15.09 10.59 13 8.5 10.91 9.91 9.5 12 11.59l2.09-2.09 1.41 1.41L13.41 13z"/></svg>',
  statLate:    '<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm.5 5H11v6l5.2 3.1.8-1.3-4.5-2.7z"/></svg>',
  statHours:   '<svg viewBox="0 0 24 24"><path d="M12 8v5l4 2 .8-1.3-3.3-2V8zm0-6a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"/></svg>',
  statProgress:'<svg viewBox="0 0 24 24"><path d="M3 3h2v18H3zm4 10h4v8H7zm6-6h4v14h-4zm6-4h4v18h-4z"/></svg>',
  edit:        '<svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75zM20.71 7.04a1 1 0 0 0 0-1.41L18.37 3.29a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75z"/></svg>',
  eye:         '<svg viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5C21.27 7.61 17 4.5 12 4.5zm0 12A4.5 4.5 0 1 1 16.5 12 4.5 4.5 0 0 1 12 16.5zm0-7a2.5 2.5 0 1 0 2.5 2.5A2.5 2.5 0 0 0 12 9.5z"/></svg>',
  // "File symbol" — opens the deleted/archived records drawer.
  file:        '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm3 18H7V4h6v5h4v11zM9 12h6v2H9zm0 4h6v2H9z"/></svg>',
  restore:     '<svg viewBox="0 0 24 24"><path d="M13 3a9 9 0 0 0-9 9H1l3.9 3.9.1.2L9 12H6a7 7 0 1 1 2.05 4.95l-1.42 1.42A9 9 0 1 0 13 3zm-1 5v5l4.25 2.52.75-1.23-3.5-2.08V8z"/></svg>',
  trash:       '<svg viewBox="0 0 24 24"><path d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>',
  x:           '<svg viewBox="0 0 24 24"><path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>',
};

// Icon set for the 4 stat cards on a dashboard (in order: total, present, absent, late)
const STAT_ICONS = {
  total:   ICONS.statUsers,
  present: ICONS.statCheck,
  absent:  ICONS.statClose,
  late:    ICONS.statLate,
  hours:   ICONS.statHours,
  progress:ICONS.statProgress,
  status:  ICONS.statCheck,
};

function profileIconHTML(user, size){
  size = size || 36;
  const initials = ((user && user.name) || 'U').split(' ').map(x=>x[0]).slice(0,2).join('').toUpperCase();
  const src = user && (user.avatar || user.avatar_url);
  const inner = src ? `<img src="${src}" alt="">` : initials;
  return `<span class="profile-icon" style="width:${size}px;height:${size}px;font-size:${Math.round(size*0.4)}px">${inner}</span>`;
}

function renderSidebar(kind, active){
  // The page is about to paint real content — make sure the loading layout
  // override is removed so the sidebar/main grid applies.
  if(typeof window.clearPageLoader === 'function') window.clearPageLoader();
  const items = kind==='student' ? [
    {group:'Account'},
    {icon:ICONS.user,label:'Profile',href:'profile.html',key:'profile'},
    {icon:ICONS.folder,label:'My Requirements',href:'requirements.html',key:'requirements'},
    {group:'Main'},
    {icon:ICONS.dashboard,label:'Dashboard',href:'dashboard.html',key:'dashboard'},
    {icon:ICONS.clock,label:'Attendance',href:'attendance.html',key:'attendance'},
    {icon:ICONS.report,label:'Reports',href:'reports.html',key:'reports'},
    {icon:ICONS.bell,label:'Notifications',href:'notifications.html',key:'notifications'},
  ] : [
    {group:'Main'},
    {icon:ICONS.dashboard,label:'Dashboard',href:'dashboard.html',key:'dashboard'},
    {icon:ICONS.student,label:'Interns',href:'students.html',key:'students'},
    {icon:ICONS.clock,label:'Attendance',href:'attendance.html',key:'attendance'},
    {icon:ICONS.camera,label:'Scanner',href:'scanner.html',key:'scanner'},
    {icon:ICONS.archive,label:'Archived',href:'archived.html',key:'archived'},
    {icon:ICONS.report,label:'Reports',href:'reports.html',key:'reports'},
    {icon:ICONS.megaphone,label:'Announcements',href:'announcements.html',key:'announcements'},
    {group:'Account'},
    {icon:ICONS.settings,label:'Account',href:'account.html',key:'account'},
  ];

  const user = window.__DB__.currentUser || { name:'User', id:'', avatar:null };
  const initials = (user.name||'U').split(' ').map(x=>x[0]).slice(0,2).join('').toUpperCase();
  const avatarInner = user.avatar ? `<img src="${user.avatar}" alt="">` : initials;
  // Bottom profile shortcut → sidebar Profile (student) / Account (admin)
  const profileHref = kind==='student' ? 'profile.html' : 'account.html';

  return `
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-head">
        <div class="brand-badge"><img src="../assets/naic-engineering-logo.png" alt="Naic Engineering Office seal"></div>
        <div class="brand-text">
          <small>${kind==='student'?'OJT Intern':'Admin Panel'}</small>
          <strong>Engineering Office</strong>
        </div>
      </div>
      <nav class="sidebar-nav">
        ${items.map(i=> i.group
          ? `<div class="nav-group-title">${i.group}</div>`
          : `<a href="${i.href}" class="nav-item ${i.key===active?'active':''}"${i.key===active?' aria-current="page"':''}><span class="nav-icon" aria-hidden="true">${i.icon}</span>${i.label}</a>`
        ).join('')}
      </nav>
      <div class="sidebar-foot">
        <a href="${profileHref}" class="foot-profile" title="Open profile">
          <div class="avatar">${avatarInner}</div>
          <div class="user-block">
            <strong>${user.name}</strong>
            <small>${kind==='student'?(user.id||''):'Admin'}</small>
          </div>
        </a>
        <button class="logout-btn logout-text" onclick="logout()" title="Log out">
          <span class="nav-icon">${ICONS.logout}</span> Log Out
        </button>
      </div>
    </aside>
    <div class="sidebar-scrim" id="sidebarScrim" onclick="toggleSidebar(false)"></div>
  `;
}

function toggleSidebar(force){
  const sb=document.getElementById('sidebar');
  const sc=document.getElementById('sidebarScrim');
  const willOpen = typeof force==='boolean' ? force : !sb.classList.contains('open');
  sb.classList.toggle('open', willOpen);
  sc.classList.toggle('open', willOpen);
}

function renderTopbar(title,subtitle,extra=''){
  // Top-right profile/logout removed — controls live at the bottom of the sidebar.
  return `
    <div class="topbar">
      <div class="topbar-left flex items-center gap-3">
        <!-- On-screen "Back" button removed by request: users navigate with the browser/device back gesture. -->
        <button class="hamburger" onclick="toggleSidebar()" aria-label="Toggle navigation menu" aria-controls="sidebar"><span class="nav-icon" aria-hidden="true">${ICONS.menu}</span></button>
        <div>
          <h1>${title}</h1>
          <p>${subtitle||''}</p>
        </div>
      </div>
      <div class="topbar-right">
        ${extra}
        <div class="clock-box" id="clockBox"></div>
      </div>
    </div>
  `;
}

function goBack(){ if(history.length>1){ history.back(); } else { window.location.href='dashboard.html'; } }

/* ---------- Modals ----------
   `.modal` is a fixed overlay (see css/styles.css); `.open` reveals it.
   These helpers are null-safe, lock body scroll, move focus into the dialog,
   and support Escape / click-outside to dismiss. */
function openModal(id){
  const el = document.getElementById(id);
  if(!el){ console.warn('openModal: no element #'+id); return; }
  el.classList.add('open');
  document.body.style.overflow = 'hidden';
  const focusable = el.querySelector('input:not([type=hidden]):not([disabled]), select, textarea, button:not([disabled])');
  if(focusable) setTimeout(()=>focusable.focus(), 30);
}
function closeModal(id){
  const el = document.getElementById(id);
  if(!el) return;
  el.classList.remove('open');
  if(!document.querySelector('.modal.open')) document.body.style.overflow = '';
}
function closeAllModals(){
  document.querySelectorAll('.modal.open').forEach(m=>m.classList.remove('open'));
  document.body.style.overflow = '';
}
document.addEventListener('keydown', e => { if(e.key === 'Escape') closeAllModals(); });
document.addEventListener('click', e => {
  // Click on the overlay itself (not the inner card) dismisses the dialog.
  if(e.target.classList && e.target.classList.contains('modal') && e.target.classList.contains('open')){
    closeModal(e.target.id);
  }
});

/* ---------- Full-screen QR viewer ----------
   Shared by every page that shows a QR code (dashboard, profile, etc).
   Builds one reusable overlay lazily and reuses the image already drawn by
   qrcode.js in `#<holderId>` — no second QR render, so it always matches
   what is on the page. Call viewQR(holderId, downloadFilename, caption). */
function ensureQrFullscreenModal(){
  if(document.getElementById('qrFullscreenModal')) return;
  const div = document.createElement('div');
  div.id = 'qrFullscreenModal';
  div.className = 'qr-fullscreen';
  div.setAttribute('role','dialog');
  div.setAttribute('aria-modal','true');
  div.setAttribute('aria-label','QR code, full screen');
  div.innerHTML = `
    <button type="button" class="qr-fullscreen-close" aria-label="Close full screen QR code" onclick="closeQrFullscreen()">&times;</button>
    <div class="qr-fullscreen-body">
      <img id="qrFullscreenImg" alt="Your QR code, enlarged" src="">
      <div id="qrFullscreenCaption" class="qr-fullscreen-caption"></div>
      <div class="qr-fullscreen-actions">
        <button type="button" class="btn btn-primary" onclick="downloadFullscreenQR()">Download QR Code</button>
        <button type="button" class="btn btn-outline" onclick="closeQrFullscreen()">Close</button>
      </div>
    </div>`;
  document.body.appendChild(div);
  div.addEventListener('click', e => { if(e.target === div) closeQrFullscreen(); });
}
let _qrFullscreenFilename = 'qr-code';
function viewQR(holderId, filename, caption){
  const holder = document.getElementById(holderId||'qr');
  if(!holder){ toast('QR not ready yet.','error'); return; }
  const canvas = holder.querySelector('canvas');
  const img = holder.querySelector('img');
  const dataUrl = canvas ? canvas.toDataURL('image/png') : (img ? img.src : null);
  if(!dataUrl){ toast('QR not ready yet.','error'); return; }
  ensureQrFullscreenModal();
  document.getElementById('qrFullscreenImg').src = dataUrl;
  document.getElementById('qrFullscreenCaption').textContent = caption || '';
  _qrFullscreenFilename = filename || 'qr-code';
  const modal = document.getElementById('qrFullscreenModal');
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
  const closeBtn = modal.querySelector('.qr-fullscreen-close');
  if(closeBtn) setTimeout(()=>closeBtn.focus(), 30);
}
function closeQrFullscreen(){
  const el = document.getElementById('qrFullscreenModal');
  if(!el) return;
  el.classList.remove('open');
  if(!document.querySelector('.modal.open')) document.body.style.overflow = '';
}
function downloadFullscreenQR(){
  const img = document.getElementById('qrFullscreenImg');
  if(!img || !img.src) return;
  const a = document.createElement('a');
  a.href = img.src; a.download = (_qrFullscreenFilename||'qr-code')+'.png';
  document.body.appendChild(a); a.click(); a.remove();
  toast('QR code downloaded.','success');
}
document.addEventListener('keydown', e => { if(e.key === 'Escape') closeQrFullscreen(); });

function exportCSV(filename, rows){
  const csv = rows.map(r=>r.map(c=>{
    const s=String(c==null?'':c);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
  }).join(',')).join('\n');
  const blob = new Blob([csv],{type:'text/csv'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=filename; a.click();
  toast('CSV exported.','success');
}

function exportPDF(filename, title, headers, rows){
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFillColor(10,31,68); doc.rect(0,0,210,26,'F');
  doc.setTextColor(253,194,43); doc.setFontSize(16); doc.text('Engineering Office Attendance System', 14, 12);
  doc.setTextColor(255,255,255); doc.setFontSize(10); doc.text('Municipal Engineering Office', 14, 20);
  doc.setTextColor(20,20,20); doc.setFontSize(13); doc.text(title, 14, 36);
  doc.setFontSize(9); doc.setTextColor(90,90,90);
  doc.text('Generated: '+new Date().toLocaleString(), 14, 42);
  doc.autoTable({ head:[headers], body:rows, startY:48,
    theme:'striped', headStyles:{fillColor:[13,43,107],textColor:255,fontSize:9},
    styles:{fontSize:8,cellPadding:3}, alternateRowStyles:{fillColor:[242,247,255]}
  });
  doc.save(filename); toast('PDF exported.','success');
}

function printReport(title, tableHTML){
  const w = window.open('','_blank');
  w.document.write(`<html><head><title>${title}</title>
    <style>body{font-family:Arial;padding:24px;color:#111}
    h1{color:#0a1f44}h3{color:#0d2b6b}
    table{width:100%;border-collapse:collapse;margin-top:12px}
    th{background:#0d2b6b;color:#fdc22b;padding:8px;text-align:left;font-size:12px}
    td{border-bottom:1px solid #ddd;padding:8px;font-size:12px}
    .head{border-bottom:3px solid #fdc22b;padding-bottom:8px;margin-bottom:16px}
    </style></head><body>
    <div class="head"><h1>Engineering Office Attendance System</h1>
    <div>Municipal Engineering Office · ${new Date().toLocaleString()}</div></div>
    <h3>${title}</h3>${tableHTML}</body></html>`);
  w.document.close(); w.focus(); setTimeout(()=>w.print(),400);
}


/* ============================================================================
   Shared confirmation dialog.
   Accessible (role=dialog, aria-modal, focus moved to the primary action,
   ESC / overlay click cancels) and promise-based so callers can simply
   `if(!(await confirmDialog({...}))) return;`
   ========================================================================== */
function confirmDialog(opts){
  opts = opts || {};
  const title   = opts.title   || 'Please confirm';
  const message = opts.message || 'Are you sure?';
  const yes     = opts.confirmText || 'Confirm';
  const no      = opts.cancelText  || 'Cancel';
  const danger  = opts.danger !== false;

  return new Promise(resolve => {
    const prev = document.getElementById('__confirm_dialog__');
    if(prev) prev.remove();

    const wrap = document.createElement('div');
    wrap.id = '__confirm_dialog__';
    wrap.className = 'confirm-overlay';
    wrap.setAttribute('role','dialog');
    wrap.setAttribute('aria-modal','true');
    wrap.setAttribute('aria-labelledby','__confirm_title__');
    wrap.setAttribute('aria-describedby','__confirm_msg__');
    wrap.innerHTML =
      '<div class="confirm-card">' +
        '<div class="confirm-head" id="__confirm_title__"></div>' +
        '<div class="confirm-body" id="__confirm_msg__"></div>' +
        '<div class="confirm-foot">' +
          '<button type="button" class="btn btn-outline" data-a="no"></button>' +
          '<button type="button" class="btn ' + (danger ? 'btn-danger' : 'btn-primary') + '" data-a="yes"></button>' +
        '</div>' +
      '</div>';
    wrap.querySelector('#__confirm_title__').textContent = title;
    wrap.querySelector('#__confirm_msg__').textContent = message;
    wrap.querySelector('[data-a="no"]').textContent = no;
    wrap.querySelector('[data-a="yes"]').textContent = yes;
    document.body.appendChild(wrap);

    const lastFocus = document.activeElement;
    const done = v => {
      document.removeEventListener('keydown', onKey, true);
      wrap.remove();
      if(lastFocus && lastFocus.focus) try { lastFocus.focus(); } catch(_){}
      resolve(v);
    };
    const onKey = e => {
      if(e.key === 'Escape'){ e.stopPropagation(); done(false); }
      if(e.key === 'Tab'){
        const f = wrap.querySelectorAll('button');
        const first = f[0], last = f[f.length-1];
        if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
        else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey, true);
    wrap.addEventListener('click', e => {
      const a = e.target && e.target.getAttribute && e.target.getAttribute('data-a');
      if(a === 'yes') done(true);
      else if(a === 'no' || e.target === wrap) done(false);
    });
    setTimeout(() => { const b = wrap.querySelector('[data-a="yes"]'); if(b) b.focus(); }, 20);
  });
}

/* Shorthand for destructive actions. */
function confirmDelete(message, title){
  return confirmDialog({
    title: title || 'Delete record',
    message: message || 'This record will be deleted. Continue?',
    confirmText: 'Delete',
    danger: true
  });
}

/* Escaping helpers — available on every page (previously duplicated ad hoc). */
function escapeHtml(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function escapeAttr(s){ return escapeHtml(s); }


/* ============================================================================
   Back-navigation behaviour (mobile + desktop)
   ----------------------------------------------------------------------------
   Goal:
   1. Pressing back on any authenticated page normally goes to the PREVIOUS
      in-app page (Reports -> Dashboard, Profile -> Reports, ...).
   2. Only on the FIRST authenticated page of the session (the page you land on
      right after logging in — there is no earlier in-app page to return to)
      does back ask for confirmation before signing you out:
         "Leave this page? Going back will log you out of your account. Continue?"

   How the "first page" is detected without breaking normal history: each
   authenticated page load stamps an increasing index into history.state. The
   index is restored (not re-issued) when the user returns to a page via back,
   so depth stays stable. Index 1 == entry page == guard is armed.
   ============================================================================ */
function isAuthenticatedPage(){
  const p = location.pathname.toLowerCase();
  if(/\/(admin|student)\//.test(p)) {
    return !/admin-setup-password|login|signup|forgot-password|reset-password/.test(p);
  }
  return false;
}

const NAV_DEPTH_KEY = 'naic_ojt_nav_depth';

function _navIndexForThisPage(){
  const st = (history.state && typeof history.state === 'object') ? history.state : null;
  if(st && typeof st.ojtNavIdx === 'number') return st.ojtNavIdx;   // revisited via back/forward
  let last = 0;
  try { last = parseInt(sessionStorage.getItem(NAV_DEPTH_KEY) || '0', 10) || 0; } catch(_){}
  const idx = last + 1;
  try { sessionStorage.setItem(NAV_DEPTH_KEY, String(idx)); } catch(_){}
  try { history.replaceState({ ...(st || {}), ojtNavIdx: idx }, ''); } catch(_){}
  return idx;
}

function installBackGuard(){
  if(window.__BACK_GUARD__) return;
  if(!isAuthenticatedPage()) return;      // landing/login pages: no guard at all
  window.__BACK_GUARD__ = true;

  const navIdx = _navIndexForThisPage();

  // Not the entry page → let the browser/device back button work normally.
  if(navIdx > 1) return;

  // Entry page: arm a sentinel history entry so we can intercept the back press.
  let lastHash = location.hash;
  let busy = false;
  try { history.pushState({ ojtNavIdx: navIdx, guard:1 }, ''); } catch(_){}

  window.addEventListener('popstate', async () => {
    // Hash-only navigation (anchor links / scroll-spy): let it through.
    if(location.hash !== lastHash){ lastHash = location.hash; return; }
    if(busy) return;
    busy = true;
    // Re-arm the sentinel so a cancelled prompt keeps the user on this page.
    try { history.pushState({ ojtNavIdx: navIdx, guard:1 }, ''); } catch(_){}
    if(typeof confirmDialog !== 'function'){
      busy = false;
      if(window.confirm('Leave this page?\n\nGoing back will log you out of your account. Continue?')){
        if(typeof logout==='function') logout({confirm:false});
      }
      return;
    }
    const ok = await confirmDialog({
      title:'Leave this page?',
      message:'Going back will log you out of your account. Continue?',
      confirmText:'Log Out', cancelText:'Stay', danger:true
    });
    busy = false;
    if(ok && typeof logout==='function') logout({confirm:false});
  });

  // Keep the tracked hash in sync so anchor clicks are never mistaken for a
  // back navigation away from the page.
  window.addEventListener('hashchange', () => { lastHash = location.hash; });
}

// Reset the navigation depth whenever a fresh sign-in happens, so the first
// page after login is always treated as the entry page.
function resetNavDepth(){ try { sessionStorage.removeItem(NAV_DEPTH_KEY); } catch(_){} }

document.addEventListener('DOMContentLoaded', () => { setTimeout(installBackGuard, 100); });

/* ============================================================================
   SHOW / HIDE PASSWORD  (system-wide)
   ----------------------------------------------------------------------------
   Every <input type="password"> automatically gets an eye button on its right
   side. Works for markup that is injected later (dashboards render their HTML
   from JS) because a MutationObserver re-scans the document.
   Opt out on a single field with  data-no-reveal="1".
   ========================================================================== */
const EYE_OPEN_SVG  = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5C21.27 7.61 17 4.5 12 4.5zm0 12A4.5 4.5 0 1 1 16.5 12 4.5 4.5 0 0 1 12 16.5zm0-7A2.5 2.5 0 1 0 14.5 12 2.5 2.5 0 0 0 12 9.5z"/></svg>';
const EYE_CLOSE_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6.5c3.79 0 7.17 2.13 8.82 5.5a10.6 10.6 0 0 1-2.2 2.93l1.42 1.42A12.6 12.6 0 0 0 23 12C21.27 7.61 17 4.5 12 4.5c-1.4 0-2.74.24-3.98.68l1.65 1.65c.75-.21 1.53-.33 2.33-.33zM3.71 2.29 2.29 3.71l2.6 2.6A12.4 12.4 0 0 0 1 12c1.73 4.39 6 7.5 11 7.5 1.86 0 3.62-.43 5.19-1.2l2.6 2.6 1.42-1.42zM12 17.5c-3.79 0-7.17-2.13-8.82-5.5a10.7 10.7 0 0 1 3.1-3.62l2.02 2.02A3.5 3.5 0 0 0 12 15.5c.5 0 .97-.1 1.4-.29l1.34 1.34c-.86.29-1.78.45-2.74.45z"/></svg>';

function attachPasswordReveal(input){
  if(!input || input.dataset.revealReady === '1') return;
  if(input.getAttribute('data-no-reveal') === '1') return;
  input.dataset.revealReady = '1';

  let wrap = input.parentElement;
  if(!wrap || !wrap.classList.contains('pw-field')){
    wrap = document.createElement('div');
    wrap.className = 'pw-field';
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
  }
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'pw-toggle';
  btn.tabIndex = 0;
  btn.innerHTML = EYE_OPEN_SVG;
  btn.setAttribute('aria-label','Show password');
  btn.setAttribute('aria-pressed','false');
  btn.title = 'Show password';
  btn.addEventListener('click', () => {
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    btn.innerHTML = show ? EYE_CLOSE_SVG : EYE_OPEN_SVG;
    const label = show ? 'Hide password' : 'Show password';
    btn.setAttribute('aria-label', label);
    btn.setAttribute('aria-pressed', show ? 'true' : 'false');
    btn.title = label;
    try { input.focus({preventScroll:true}); } catch(_){ }
  });
  wrap.appendChild(btn);
}

function installPasswordReveal(root){
  (root || document).querySelectorAll('input[type="password"]').forEach(attachPasswordReveal);
}
document.addEventListener('DOMContentLoaded', () => {
  installPasswordReveal(document);
  try {
    new MutationObserver(muts => {
      for(const m of muts){
        m.addedNodes && m.addedNodes.forEach(n => {
          if(n.nodeType !== 1) return;
          if(n.matches && n.matches('input[type="password"]')) attachPasswordReveal(n);
          else installPasswordReveal(n);
        });
      }
    }).observe(document.body, { childList:true, subtree:true });
  } catch(_){}
});
window.installPasswordReveal = installPasswordReveal;

/* ============================================================================
   ONE-TIME PIN CONFIRMATION DIALOG
   ----------------------------------------------------------------------------
   Used when changing the email address (admin + intern). The user types the
   6-digit code that Supabase mailed to the NEW address, then types the word
   CONFIRM to authorise the change.
   Resolves with { code } on submit, or null when cancelled.
   Options: title, message, email, confirmText, onResend(async fn)
   ========================================================================== */
function otpConfirmDialog(opts){
  opts = opts || {};
  return new Promise(resolve => {
    const prev = document.getElementById('__otp_dialog__');
    if(prev) prev.remove();
    const wrap = document.createElement('div');
    wrap.id = '__otp_dialog__';
    wrap.className = 'confirm-overlay';
    wrap.setAttribute('role','dialog');
    wrap.setAttribute('aria-modal','true');
    wrap.setAttribute('aria-labelledby','__otp_title__');
    wrap.innerHTML =
      '<div class="confirm-card otp-card">' +
        '<div class="confirm-head" id="__otp_title__"></div>' +
        '<div class="confirm-body">' +
          '<p id="__otp_msg__" style="margin:0 0 14px"></p>' +
          '<div class="form-group">' +
            '<label for="__otp_code__">One Time Pin</label>' +
            '<input class="form-control otp-input" id="__otp_code__" inputmode="numeric" autocomplete="one-time-code" ' +
                   'maxlength="10" placeholder="123456" aria-describedby="__otp_codeHint__">' +
            '<small class="text-muted text-sm" id="__otp_codeHint__">Enter the code from the email we just sent.</small>' +
          '</div>' +
          '<div class="form-group">' +
            '<label for="__otp_word__">Type CONFIRM</label>' +
            '<input class="form-control" id="__otp_word__" autocomplete="off" placeholder="CONFIRM" aria-describedby="__otp_wordHint__">' +
            '<small class="text-muted text-sm" id="__otp_wordHint__">Type the word CONFIRM (in capital letters) to apply the change.</small>' +
          '</div>' +
          '<div class="form-error" id="__otp_err__" role="alert" aria-live="assertive"></div>' +
          '<button type="button" class="btn btn-outline btn-sm" data-a="resend" style="display:none">Resend code</button>' +
        '</div>' +
        '<div class="confirm-foot">' +
          '<button type="button" class="btn btn-outline" data-a="no">Cancel</button>' +
          '<button type="button" class="btn btn-primary" data-a="yes"></button>' +
        '</div>' +
      '</div>';
    wrap.querySelector('#__otp_title__').textContent = opts.title || 'Verify your new email address';
    wrap.querySelector('#__otp_msg__').textContent = opts.message ||
      ('We emailed a One Time Pin to ' + (opts.email || 'your new address') + '. Enter it below, then type CONFIRM.');
    wrap.querySelector('[data-a="yes"]').textContent = opts.confirmText || 'Verify & Change Email';
    document.body.appendChild(wrap);

    const codeEl = wrap.querySelector('#__otp_code__');
    const wordEl = wrap.querySelector('#__otp_word__');
    const errEl  = wrap.querySelector('#__otp_err__');
    const okBtn  = wrap.querySelector('[data-a="yes"]');
    const resend = wrap.querySelector('[data-a="resend"]');
    if(typeof opts.onResend === 'function'){
      resend.style.display = '';
      resend.addEventListener('click', async () => {
        resend.disabled = true; const t = resend.textContent; resend.textContent = 'Sending…';
        try { await opts.onResend(); } catch(_){ }
        resend.disabled = false; resend.textContent = t;
      });
    }
    const lastFocus = document.activeElement;
    const done = v => {
      document.removeEventListener('keydown', onKey, true);
      wrap.remove();
      if(lastFocus && lastFocus.focus) try { lastFocus.focus(); } catch(_){}
      resolve(v);
    };
    const submit = () => {
      const code = (codeEl.value || '').replace(/\s+/g,'');
      const word = (wordEl.value || '').trim();
      errEl.classList.remove('show'); errEl.textContent = '';
      if(!code){ errEl.textContent = 'Enter the One Time Pin from your email.'; errEl.classList.add('show'); codeEl.focus(); return; }
      if(word !== 'CONFIRM'){ errEl.textContent = 'Type CONFIRM exactly (all capital letters) to continue.'; errEl.classList.add('show'); wordEl.focus(); return; }
      done({ code });
    };
    const onKey = e => {
      if(e.key === 'Escape'){ e.stopPropagation(); done(null); }
      if(e.key === 'Enter'){ e.preventDefault(); submit(); }
    };
    document.addEventListener('keydown', onKey, true);
    okBtn.addEventListener('click', submit);
    wrap.addEventListener('click', e => {
      const a = e.target && e.target.getAttribute && e.target.getAttribute('data-a');
      if(a === 'no' || e.target === wrap) done(null);
    });
    setTimeout(()=>codeEl.focus(), 30);
  });
}
window.otpConfirmDialog = otpConfirmDialog;
