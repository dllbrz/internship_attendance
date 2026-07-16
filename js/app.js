/* Sidebar + shared UI helpers.
   All icons are inline SVG in dark blue (#0d2b6b) — no emojis. */

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
  back:      '<svg viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>'
};

function renderSidebar(kind, active){
  const items = kind==='student' ? [
    {group:'Main'},
    {icon:ICONS.dashboard,label:'Dashboard',href:'dashboard.html',key:'dashboard'},
    {icon:ICONS.clock,label:'Attendance',href:'attendance.html',key:'attendance'},
    {icon:ICONS.report,label:'Reports',href:'reports.html',key:'reports'},
    {icon:ICONS.bell,label:'Notifications',href:'notifications.html',key:'notifications'},
    {group:'Account'},
    {icon:ICONS.user,label:'Profile',href:'profile.html',key:'profile'},
    {icon:ICONS.folder,label:'My Requirements',href:'requirements.html',key:'requirements'},
  ] : [
    {group:'Main'},
    {icon:ICONS.dashboard,label:'Dashboard',href:'dashboard.html',key:'dashboard'},
    {icon:ICONS.student,label:'Students',href:'students.html',key:'students'},
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

  return `
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-head">
        <div class="brand-badge"><img src="../assets/naic-engineering-logo.png" alt="Naic Engineering Office seal"></div>
        <div class="brand-text">
          <small>${kind==='student'?'OJT Intern':'Admin Panel'}</small>
          <strong>Naic OJT</strong>
        </div>
      </div>
      <nav class="sidebar-nav">
        ${items.map(i=> i.group
          ? `<div class="nav-group-title">${i.group}</div>`
          : `<a href="${i.href}" class="nav-item ${i.key===active?'active':''}"><span class="nav-icon">${i.icon}</span>${i.label}</a>`
        ).join('')}
      </nav>
      <div class="sidebar-foot">
        <div class="avatar">${avatarInner}</div>
        <div class="user-block">
          <strong>${user.name}</strong>
          <small>${kind==='student'?(user.id||''):'Admin'}</small>
        </div>
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
  return `
    <div class="topbar">
      <div class="topbar-left flex items-center gap-3">
        <button class="back-btn" onclick="goBack()" title="Go back"><span class="nav-icon">${ICONS.back}</span> Back</button>
        <button class="hamburger" onclick="toggleSidebar()"><span class="nav-icon">${ICONS.menu}</span></button>
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

function openModal(id){document.getElementById(id).classList.add('open')}
function closeModal(id){document.getElementById(id).classList.remove('open')}

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
  doc.setTextColor(253,194,43); doc.setFontSize(16); doc.text('Naic OJT Attendance System', 14, 12);
  doc.setTextColor(255,255,255); doc.setFontSize(10); doc.text('Municipality of Naic, Cavite', 14, 20);
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
    <div class="head"><h1>Naic OJT Attendance System</h1>
    <div>Municipality of Naic, Cavite · ${new Date().toLocaleString()}</div></div>
    <h3>${title}</h3>${tableHTML}</body></html>`);
  w.document.close(); w.focus(); setTimeout(()=>w.print(),400);
}
