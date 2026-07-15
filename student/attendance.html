<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Attendance — Intern · Naic OJT</title>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="../css/styles.css">
</head>
<body>
<div class="app-shell" id="shell"><div style="padding:40px;text-align:center">Loading…</div></div>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="../js/supabase-config.js"></script>
<script src="../js/data.js"></script>
<script src="../js/app.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.1/jspdf.plugin.autotable.min.js"></script>
<script>
let dateQ='';
async function render(){
  const user = await requireStudent(); if(!user) return;
  const today = getTodayAttendance(user.id);
  const all = studentAttendance(user.id);
  const list = dateQ ? all.filter(a=>a.date.includes(dateQ)) : all;
  const total = totalHours(user.id);
  const lateCount = all.filter(a=>a.status==='late').length;
  const presentCount = all.filter(a=>a.status==='present').length;

  document.getElementById('shell').innerHTML = renderSidebar('student','attendance') + `
    <main class="main">
      ${renderTopbar('Attendance','Time in, time out, and review your history.')}
      <div class="stat-grid">
        <div class="stat-card"><div><div class="stat-label">Today</div>
          <div class="stat-value">${today?(today.time_out?'DONE':today.status.toUpperCase()):'NOT IN'}</div>
          <div class="stat-meta">${fmtDate(todayStr())}</div></div><div class="stat-icon"></div></div>
        <div class="stat-card green"><div><div class="stat-label">Total Rendered</div><div class="stat-value">${total}</div><div class="stat-meta">hours</div></div><div class="stat-icon"></div></div>
        <div class="stat-card"><div><div class="stat-label">Present Days</div><div class="stat-value">${presentCount}</div></div><div class="stat-icon"></div></div>
        <div class="stat-card yellow"><div><div class="stat-label">Late Records</div><div class="stat-value">${lateCount}</div></div><div class="stat-icon">️</div></div>
      </div>


      <div class="card">
        <div class="card-head">
          <div><div class="card-title">Attendance History</div><div class="card-subtitle">${list.length} of ${all.length} record(s)</div></div>
          <div class="flex gap-2" style="flex-wrap:wrap">
            <input class="form-control" id="dateSearch" style="width:200px" placeholder=" Search date (YYYY-MM-DD)">
            <input class="form-control" id="datePick" type="date" style="width:170px">
            ${dateQ?`<button class="btn btn-ghost btn-sm" onclick="dateQ='';render()">Clear</button>`:''}
          </div>
        </div>
        <div class="table-wrap"><table><thead><tr><th>Date</th><th>Time In</th><th>Time Out</th><th>Hours</th><th>Status</th></tr></thead>
        <tbody>${list.length?list.map(r=>`<tr><td>${fmtDate(r.date)}</td><td>${fmt12(r.time_in)}</td><td>${fmt12(r.time_out)}</td><td>${r.hours||'—'}</td>
        <td><span class="pill ${r.status==='present'?'green':r.status==='late'?'yellow':'red'}">${r.status}</span></td></tr>`).join(''):'<tr><td colspan="5" class="text-center text-muted" style="padding:24px">No records match this date.</td></tr>'}</tbody></table></div>
      </div>
    </main>`;
  startClock('#clockBox');

  const ds=document.getElementById('dateSearch');
  ds.value=dateQ;
  ds.addEventListener('input',(e)=>{dateQ=e.target.value.trim();render();});
  if(dateQ){ds.focus();ds.setSelectionRange(ds.value.length,ds.value.length);}
  document.getElementById('datePick').addEventListener('change',(e)=>{dateQ=e.target.value;render();});
}
async function doIn(){ const u=await requireStudent(); const r=await timeIn(u.id); if(!r.ok){toast(r.error,'error');return;} toast('Timed in at '+fmt12(r.time)+'!','success'); render();}
async function doOut(){ const u=await requireStudent(); const r=await timeOut(u.id); if(!r.ok){toast(r.error,'error');return;} toast('Timed out at '+fmt12(r.time)+' · +'+r.hours+' hrs','success'); render();}
async function csv(){ const u=await requireStudent(); const rows=[['Date','Time In','Time Out','Hours','Status']]; studentAttendance(u.id).forEach(r=>rows.push([r.date,r.time_in||'',r.time_out||'',r.hours||0,r.status])); exportCSV(u.id+'-attendance.csv',rows);}
async function pdf(){ const u=await requireStudent(); const rows=studentAttendance(u.id).map(r=>[fmtDate(r.date),fmt12(r.time_in),fmt12(r.time_out),r.hours||'—',r.status.toUpperCase()]); exportPDF(u.id+'-attendance.pdf','Attendance History — '+u.name,['Date','Time In','Time Out','Hours','Status'],rows);}
render();
</script>
</body></html>
