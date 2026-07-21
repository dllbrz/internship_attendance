/* ============================================================================
   Naic OJT — Supabase-backed data layer.
   Keeps the ORIGINAL synchronous API (getDB, saveDB, etc.) by loading all
   needed data into an in-memory cache (window.__DB__) on page bootstrap.
   Async login/register/timeIn/timeOut functions now return Promises.
   ============================================================================ */

// Instantiate the Supabase client (loaded from CDN before this file)
window.sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'naic_ojt_auth' },
  global: {
    fetch: (input, init) => {
      const headers = new Headers(init && init.headers ? init.headers : {});
      if(String(window.SUPABASE_ANON_KEY || '').startsWith('sb_') && headers.get('Authorization') === `Bearer ${window.SUPABASE_ANON_KEY}`){
        headers.delete('Authorization');
      }
      headers.set('apikey', window.SUPABASE_ANON_KEY);
      return fetch(input, { ...init, headers });
    }
  }
});

const REQUIREMENT_TYPES = [
  {key:'endorsement', label:'Endorsement Letter'},
  {key:'moa', label:'Memorandum of Agreement (MOA)'},
  {key:'waiver', label:'Parent Waiver / Consent'},
  {key:'medical', label:'Medical Certificate'},
  {key:'insurance', label:'Insurance / NSTP Certificate'},
  {key:'resume', label:'Resume / CV'},
];

// ---------- in-memory cache (keeps existing sync callers working) ----------
window.__DB__ = { students:[], attendance:[], announcements:[], requirements:[], session:null, currentUser:null, isAdmin:false, admins:[] };
function getDB(){ return window.__DB__; }
function saveDB(_db){ /* no-op — writes go directly to Supabase */ }

function authUrl(path){
  const base = window.location.origin + window.location.pathname.replace(/[^/]*$/, '');
  return new URL(path, base).href;
}

function showFatal(message){
  const shell = document.getElementById('shell');
  if(shell){
    shell.innerHTML = `<main class="main" style="max-width:720px;margin:0 auto;padding:40px 20px">
      <div class="card">
        <div class="card-title">This page could not finish loading</div>
        <p class="text-muted mt-2">${message}</p>
        <div class="mt-4"><a class="btn btn-primary" href="${_isInSubfolder() ? '../login-student.html' : 'login-student.html'}">Back to login</a></div>
      </div>
    </main>`;
  }
}

// ---------- helpers ----------
function _mapProfileRow(p){
  return {
    id: p.intern_id,           // legacy code uses OJT-YYYY-XXX as id
    auth_id: p.id,
    username: p.username,
    name: p.full_name,
    email: p.email,
    school: p.school,
    course: p.course,
    phone: p.phone,
    address: p.address,
    adviser_name: p.adviser_name,
    adviser_contact: p.adviser_contact,
    required_hours: p.required_hours,
    start_date: p.start_date,
    end_date: p.end_date,
    expected_time_in: p.expected_time_in || '08:00',
    active: p.active,
    avatar: p.avatar_url,          // legacy field name
    avatar_url: p.avatar_url,
    qr_token: p.qr_token,
    requirements: []               // filled in loadRequirements
  };
}
function _mapAttendance(a, internIdMap){
  return {
    id: a.id,
    student_id: internIdMap.get(a.student_id) || a.student_id,
    _auth_id: a.student_id,
    date: a.date,
    time_in: a.time_in ? a.time_in.slice(0,5) : null,
    time_out: a.time_out ? a.time_out.slice(0,5) : null,
    hours: Number(a.hours || 0),
    status: a.status,
    verified: a.verified
  };
}

// ---------- bootstrap: load session + cache on every page ----------
async function bootstrap(){
  window.__DB__ = { students:[], attendance:[], announcements:[], requirements:[], session:null, currentUser:null, isAdmin:false, admins:[] };
  const { data: { session }, error: sessionError } = await sb.auth.getSession();
  if(sessionError){ console.error(sessionError); return; }
  if(!session){ return; }

  const userId = session.user.id;
  // roles
  const { data: roles, error: roleError } = await sb.from('user_roles').select('role').eq('user_id', userId);
  if(roleError){ console.error('Role load failed:', roleError); throw roleError; }
  const isAdmin = (roles||[]).some(r=>r.role==='admin');
  window.__DB__.isAdmin = isAdmin;

  // load ALL profiles (admin sees all; student RLS returns only own + admin only sees own — plus we backfill)
  const { data: profiles, error: profileError } = await sb.from('profiles').select('*');
  if(profileError){ console.error('Profile load failed:', profileError); throw profileError; }
  window.__DB__.students = (profiles||[]).map(_mapProfileRow);
  const internIdMap = new Map((profiles||[]).map(p=>[p.id, p.intern_id]));

  // announcements
  const { data: annc, error: annError } = await sb.from('announcements').select('*').order('created_at',{ascending:false});
  if(annError){ console.warn('Announcements load failed:', annError); }
  window.__DB__.announcements = (annc||[]).map(a=>({
    id: a.id, title: a.title, body: a.body, author: a.author,
    date: (a.created_at||'').slice(0,10)
  }));

  // attendance
  let att;
  let attError;
  if(isAdmin){
    ({data: att, error: attError} = await sb.from('attendance').select('*').order('date',{ascending:false}));
  } else {
    ({data: att, error: attError} = await sb.from('attendance').select('*').eq('student_id', userId).order('date',{ascending:false}));
  }
  if(attError){ console.warn('Attendance load failed:', attError); }
  window.__DB__.attendance = (att||[]).map(a=>_mapAttendance(a, internIdMap));

  // current user
  if(isAdmin){
    window.__DB__.currentUser = { id:'A001', name: session.user.email || 'Administrator', role:'Admin', email: session.user.email };
    window.__DB__.session = { type:'admin', id:'A001', auth_id:userId };
    window.__DB__.admins = [window.__DB__.currentUser];
  } else {
    const me = (profiles||[]).find(p=>p.id===userId);
    if(me){
      const legacy = _mapProfileRow(me);
      window.__DB__.currentUser = legacy;
      window.__DB__.session = { type:'student', id:legacy.id, auth_id:userId };
      // ensure own profile is in students array
      if(!window.__DB__.students.some(s=>s.auth_id===userId)) window.__DB__.students.push(legacy);
    }
  }

  if(!window.__DB__.session){
    throw new Error(isAdmin ? 'Admin account is missing its role setup.' : 'Your intern profile was not created. Re-run sql/schema.sql, then create the account again.');
  }

  // requirements for current student (or all for admin)
  const reqQuery = isAdmin ? sb.from('requirements').select('*') : sb.from('requirements').select('*').eq('student_id', userId);
  const { data: reqs, error: reqError } = await reqQuery;
  if(reqError){ console.warn('Requirements load failed:', reqError); }
  (reqs||[]).forEach(r=>{
    const iid = internIdMap.get(r.student_id);
    const st = window.__DB__.students.find(s=>s.id===iid);
    if(st){
      st.requirements.push({
        id:r.id, name:r.file_name, type:r.file_type, size:r.file_size,
        path:r.file_path, uploaded_at:r.uploaded_at, label:r.label
      });
    }
  });

  // auto-mark absent: any active student without today's record whose expected time-in was > 1 hour ago
  await autoMarkAbsent();
}

async function autoMarkAbsent(){
  const now = new Date();
  const today = now.toISOString().slice(0,10);
  const nowMinutes = now.getHours()*60 + now.getMinutes();
  const toInsert = [];
  for(const s of window.__DB__.students){
    if(!s.active) continue;
    const rec = window.__DB__.attendance.find(a=>a.student_id===s.id && a.date===today);
    if(rec) continue;
    const [eh,em] = (s.expected_time_in||'08:00').split(':').map(Number);
    const expected = eh*60+em;
    if(nowMinutes - expected >= 60){
      toInsert.push({ student_id:s.auth_id, date:today, status:'absent', hours:0, verified:false });
    }
  }
  if(toInsert.length && window.__DB__.isAdmin){
    await sb.from('attendance').upsert(toInsert, { onConflict:'student_id,date', ignoreDuplicates:true });
    // refresh cache with new absents
    const internIdMap = new Map(window.__DB__.students.map(s=>[s.auth_id, s.id]));
    const { data:att } = await sb.from('attendance').select('*').eq('date',today);
    (att||[]).forEach(a=>{
      const mapped = _mapAttendance(a, internIdMap);
      if(!window.__DB__.attendance.some(x=>x.id===mapped.id)) window.__DB__.attendance.unshift(mapped);
    });
  }
}

// ---------- AUTH ----------
async function loginStudent(usernameOrEmail, password){
  // allow login by username or email — resolve username -> email via profiles
  let email = usernameOrEmail;
  if(!email.includes('@')){
    const { data, error } = await sb.rpc('find_student_email_by_username', { _username: usernameOrEmail });
    if(error || !data) return {ok:false, error:'Use your email address, or run the updated sql/schema.sql so username login is enabled.'};
    email = data;
  }
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if(error) return {ok:false, error:error.message};
  // check role isn't admin
  const { data: roles, error: roleError } = await sb.from('user_roles').select('role').eq('user_id', data.user.id);
  if(roleError) return {ok:false, error:'Signed in, but role lookup failed. Re-run sql/schema.sql, then try again.'};
  if((roles||[]).some(r=>r.role==='admin')){
    await sb.auth.signOut();
    return {ok:false, error:'This account is an admin. Use admin login.'};
  }
  return {ok:true, user:data.user};
}
async function loginAdmin(usernameOrEmail, password){
  let email = usernameOrEmail;
  if(!email.includes('@')) email = usernameOrEmail + '@naic.gov.ph'; // convention
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if(error) return {ok:false, error:error.message};
  const { data: roles, error: roleError } = await sb.from('user_roles').select('role').eq('user_id', data.user.id);
  if(roleError) return {ok:false, error:'Signed in, but admin role lookup failed. Re-run sql/schema.sql, then try again.'};
  if(!(roles||[]).some(r=>r.role==='admin')){
    await sb.auth.signOut();
    return {ok:false, error:'This account is not an administrator.'};
  }
  return {ok:true, user:data.user};
}
async function registerStudent(d){
  const required = ['name','username','email','password','phone','address','school','course','adviser_name','adviser_contact','start_date','end_date','required_hours'];
  const labels = {name:'Full name', username:'Username', email:'Email', password:'Password', phone:'Phone', address:'Address', school:'School', course:'Course', adviser_name:'Adviser name', adviser_contact:'Adviser contact', start_date:'Start date', end_date:'End date', required_hours:'Required hours'};
  for(const k of required){
    if(!d[k] || String(d[k]).trim()===''){
      return {ok:false, error:(labels[k]||k)+' is required. Please fill in all fields.'};
    }
  }
  if(d.password.length < 6){
    return {ok:false, error:'Password must be at least 6 characters.'};
  }
  const { data, error } = await sb.auth.signUp({
    email: d.email,
    password: d.password,
    options: {
      emailRedirectTo: authUrl('login-student.html?verified=1'),
      data: {
        full_name: d.name, username: d.username,
        school: d.school, course: d.course, phone: d.phone, address: d.address,
        adviser_name: d.adviser_name, adviser_contact: d.adviser_contact,
        required_hours: d.required_hours, start_date: d.start_date, end_date: d.end_date
      }
    }
  });
  if(error) return {ok:false, error:error.message};
  return {ok:true, user:data.user};
}
async function verifySignupOtp(email, token){
  if(!email || !token) return {ok:false, error:'Email and confirmation code are required.'};
  const { error } = await sb.auth.verifyOtp({ email: email.trim(), token: token.trim(), type:'signup' });
  if(error) return {ok:false, error:error.message};
  await sb.auth.signOut();
  return {ok:true};
}
async function resendSignupOtp(email){
  if(!email || !email.includes('@')) return {ok:false, error:'Enter your registered email address.'};
  const { error } = await sb.auth.resend({ type:'signup', email: email.trim(), options:{ emailRedirectTo: authUrl('login-student.html?verified=1') } });
  if(error) return {ok:false, error:error.message};
  return {ok:true};
}
async function sendPasswordReset(email){
  if(!email || !email.includes('@')) return {ok:false, error:'Enter the email address registered to your intern account.'};
  const { error } = await sb.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: authUrl('reset-password.html')
  });
  if(error) return {ok:false, error:error.message};
  return {ok:true};
}
async function verifyPasswordResetOtp(email, token){
  if(!email || !token) return {ok:false, error:'Email and OTP code are required.'};
  const { data, error } = await sb.auth.verifyOtp({ email: email.trim(), token: token.trim(), type:'recovery' });
  if(error) return {ok:false, error:error.message};
  return {ok:true, session:data.session};
}
async function updateCurrentPassword(password){
  if(!password || password.length < 6) return {ok:false, error:'Password must be at least 6 characters.'};
  const { error } = await sb.auth.updateUser({ password });
  if(error) return {ok:false, error:error.message};
  return {ok:true};
}
async function logout(){
  try { await sb.auth.signOut(); } catch(e){}
  window.location.href = _isInSubfolder() ? '../index.html' : 'index.html';
}
function _isInSubfolder(){
  return /\/(student|admin)\//.test(window.location.pathname);
}

// Guards — called from page inline scripts; return null if not authorized.
async function requireStudent(){
  try{
    await bootstrap();
  }catch(e){
    console.error(e);
    showFatal(e.message || 'Please check your Supabase database setup and refresh.');
    return null;
  }
  if(!window.__DB__.session || window.__DB__.session.type!=='student'){
    const target = _isInSubfolder() ? '../login-student.html' : 'login-student.html';
    window.location.href = target;
    return null;
  }
  return window.__DB__.currentUser;
}
async function requireAdmin(){
  try{
    await bootstrap();
  }catch(e){
    console.error(e);
    showFatal(e.message || 'Please check your Supabase database setup and refresh.');
    return null;
  }
  if(!window.__DB__.session || window.__DB__.session.type!=='admin'){
    window.location.href = _isInSubfolder() ? '../login-admin.html' : 'login-admin.html';
    return null;
  }
  return window.__DB__.currentUser;
}

// ---------- ATTENDANCE ----------
function todayStr(){ return new Date().toISOString().slice(0,10); }
function nowTime(){ const d=new Date(); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; }
function getTodayAttendance(studentId){
  return window.__DB__.attendance.find(a=>a.student_id===studentId && a.date===todayStr()) || null;
}

async function timeIn(studentId){
  const st = window.__DB__.students.find(s=>s.id===studentId);
  if(!st) return {ok:false, error:'Student not found'};
  const existing = getTodayAttendance(studentId);
  if(existing && existing.time_in) return {ok:false, error:'Already timed in today.'};
  const t = nowTime();
  const [h,m]=t.split(':').map(Number);
  const status = (h>8 || (h===8 && m>0)) ? 'late' : 'present';
  const row = { student_id: st.auth_id, date: todayStr(), time_in: t, status, verified:true, hours:0 };
  const { data, error } = await sb.from('attendance').upsert(row, { onConflict:'student_id,date' }).select().single();
  if(error) return {ok:false, error:error.message};
  const mapped = _mapAttendance(data, new Map([[st.auth_id, st.id]]));
  const idx = window.__DB__.attendance.findIndex(a=>a.student_id===studentId && a.date===todayStr());
  if(idx>=0) window.__DB__.attendance[idx]=mapped; else window.__DB__.attendance.unshift(mapped);
  return {ok:true, time:t, status};
}
async function timeOut(studentId){
  const st = window.__DB__.students.find(s=>s.id===studentId);
  if(!st) return {ok:false, error:'Student not found'};
  const rec = getTodayAttendance(studentId);
  if(!rec || !rec.time_in) return {ok:false, error:'You have not timed in yet.'};
  if(rec.time_out) return {ok:false, error:'Already timed out today.'};
  const t = nowTime();
  const [h1,m1]=rec.time_in.split(':').map(Number);
  const [h2,m2]=t.split(':').map(Number);
  const hours = +Math.max(0,(h2*60+m2-(h1*60+m1))/60 - 1).toFixed(2);
  const { data, error } = await sb.from('attendance').update({ time_out:t, hours }).eq('id', rec.id).select().single();
  if(error) return {ok:false, error:error.message};
  rec.time_out = t; rec.hours = hours;
  return {ok:true, time:t, hours};
}
function totalHours(studentId){
  return +window.__DB__.attendance.filter(a=>a.student_id===studentId).reduce((s,a)=>s+(a.hours||0),0).toFixed(2);
}
function studentAttendance(studentId){
  return window.__DB__.attendance.filter(a=>a.student_id===studentId).sort((a,b)=>b.date.localeCompare(a.date));
}

// ---------- SCANNER ----------
function resolveQR(text){
  if(!text) return null;
  const t = String(text).trim();
  let st = window.__DB__.students.find(x=>x.qr_token===t);
  if(!st){
    const m = t.match(/OJT-\d{4}-[A-Za-z0-9]+/i);
    const id = m ? m[0].toUpperCase() : t.toUpperCase();
    st = window.__DB__.students.find(x=>x.id.toUpperCase()===id);
  }
  return st || null;
}
async function markPresent(studentId){
  const s = window.__DB__.students.find(x=>x.id===studentId);
  if(!s) return {ok:false, error:'Student not found'};
  if(!s.active) return {ok:false, error:'Account is archived/inactive'};
  const rec = getTodayAttendance(studentId);
  const t = nowTime();
  const [h,m] = t.split(':').map(Number);
  const status = (h>8 || (h===8 && m>0)) ? 'late' : 'present';
  if(rec && rec.time_in) return {ok:true, already:true, time:rec.time_in, status:rec.status};
  const row = { student_id: s.auth_id, date: todayStr(), time_in: t, status, verified:true, hours:0 };
  const { data, error } = await sb.from('attendance').upsert(row, { onConflict:'student_id,date' }).select().single();
  if(error) return {ok:false, error:error.message};
  const mapped = _mapAttendance(data, new Map([[s.auth_id, s.id]]));
  const idx = window.__DB__.attendance.findIndex(a=>a.student_id===studentId && a.date===todayStr());
  if(idx>=0) window.__DB__.attendance[idx]=mapped; else window.__DB__.attendance.unshift(mapped);
  return {ok:true, time:t, status};
}

// ---------- STUDENT MANAGEMENT (admin) ----------
async function updateStudent(studentInternId, patch){
  // Admin can only edit start_date, end_date, required_hours (enforced by UI)
  const st = window.__DB__.students.find(s=>s.id===studentInternId);
  if(!st) return {ok:false, error:'Not found'};
  const allowed = ['start_date','end_date','required_hours','active','expected_time_in','full_name','avatar_url'];
  const upd = {};
  for(const k of Object.keys(patch)){ if(allowed.includes(k)) upd[k]=patch[k]; }
  const { error } = await sb.from('profiles').update(upd).eq('id', st.auth_id);
  if(error) return {ok:false, error:error.message};
  Object.assign(st, {
    start_date: upd.start_date ?? st.start_date,
    end_date: upd.end_date ?? st.end_date,
    required_hours: upd.required_hours ?? st.required_hours,
    active: upd.active ?? st.active,
    expected_time_in: upd.expected_time_in ?? st.expected_time_in,
    avatar: upd.avatar_url ?? st.avatar,
    avatar_url: upd.avatar_url ?? st.avatar_url,
    name: upd.full_name ?? st.name
  });
  return {ok:true};
}
async function deleteStudent(studentInternId){
  const st = window.__DB__.students.find(s=>s.id===studentInternId);
  if(!st) return {ok:false, error:'Not found'};
  const { error } = await sb.from('profiles').delete().eq('id', st.auth_id);
  if(error) return {ok:false, error:error.message};
  window.__DB__.students = window.__DB__.students.filter(s=>s.id!==studentInternId);
  return {ok:true};
}
async function deleteAllAttendanceForDate(dateStr){
  const { error } = await sb.from('attendance').delete().eq('date', dateStr);
  if(error) return {ok:false, error:error.message};
  window.__DB__.attendance = window.__DB__.attendance.filter(a=>a.date!==dateStr);
  return {ok:true};
}

// ---------- AVATAR + REQUIREMENTS ----------
async function uploadAvatar(file){
  const { data:{user} } = await sb.auth.getUser();
  if(!user) return {ok:false, error:'Not signed in'};
  const ext = (file.name.split('.').pop()||'png').toLowerCase();
  const path = `${user.id}/avatar.${ext}`;
  const { error } = await sb.storage.from('avatars').upload(path, file, { upsert:true, contentType:file.type });
  if(error) return {ok:false, error:error.message};
  const { data:pub } = sb.storage.from('avatars').getPublicUrl(path);
  const url = pub.publicUrl + '?v=' + Date.now();
  const { error:e2 } = await sb.from('profiles').update({ avatar_url:url }).eq('id', user.id);
  if(e2) return {ok:false, error:e2.message};
  if(window.__DB__.currentUser){ window.__DB__.currentUser.avatar=url; window.__DB__.currentUser.avatar_url=url; }
  return {ok:true, url};
}

async function addStudentRequirement(studentInternId, file, label){
  const st = window.__DB__.students.find(s=>s.id===studentInternId);
  if(!st) return {ok:false, error:'Student not found'};
  const path = `${st.auth_id}/${Date.now()}-${file.name}`;
  const { error:upErr } = await sb.storage.from('requirements').upload(path, file, { contentType:file.type });
  if(upErr) return {ok:false, error:upErr.message};
  const { data, error } = await sb.from('requirements').insert({
    student_id: st.auth_id, label: label||'', file_name:file.name, file_path:path,
    file_type:file.type, file_size:file.size
  }).select().single();
  if(error) return {ok:false, error:error.message};
  st.requirements = st.requirements || [];
  st.requirements.push({ id:data.id, name:data.file_name, type:data.file_type, size:data.file_size, path:data.file_path, uploaded_at:data.uploaded_at, label:data.label });
  return {ok:true};
}
async function addStudentRequirementsMultiple(studentInternId, files, label){
  const results = [];
  for(const f of files){ results.push(await addStudentRequirement(studentInternId, f, label)); }
  const failed = results.filter(r=>!r.ok);
  return failed.length ? {ok:false, error:`${failed.length} of ${results.length} failed: `+failed[0].error, results}
                       : {ok:true, count:results.length};
}
async function deleteStudentRequirement(studentInternId, reqId){
  const st = window.__DB__.students.find(s=>s.id===studentInternId);
  if(!st) return;
  const r = (st.requirements||[]).find(x=>x.id===reqId);
  if(r && r.path){ await sb.storage.from('requirements').remove([r.path]); }
  await sb.from('requirements').delete().eq('id', reqId);
  st.requirements = (st.requirements||[]).filter(x=>x.id!==reqId);
}
async function getRequirementUrl(path){
  const { data, error } = await sb.storage.from('requirements').createSignedUrl(path, 60*10);
  return error ? null : data.signedUrl;
}

// ---------- ANNOUNCEMENTS ----------
async function addAnnouncement(title, body){
  const author = (window.__DB__.currentUser||{}).name || 'Admin';
  const { data, error } = await sb.from('announcements').insert({ title, body, author }).select().single();
  if(error) return {ok:false, error:error.message};
  window.__DB__.announcements.unshift({ id:data.id, title, body, author, date:(data.created_at||'').slice(0,10) });
  return {ok:true};
}

// ---------- HELPERS ----------
function fmtDate(iso){ if(!iso) return '—'; const d=new Date(iso); return d.toLocaleDateString('en-US',{year:'numeric',month:'short',day:'2-digit'}); }
function fmt12(t){ if(!t) return '—'; const [h,m]=t.split(':').map(Number); const ap=h>=12?'PM':'AM'; const hh=((h+11)%12)+1; return `${hh}:${String(m).padStart(2,'0')} ${ap}`; }
function humanSize(b){ if(!b) return ''; if(b<1024) return b+' B'; if(b<1024*1024) return (b/1024).toFixed(1)+' KB'; return (b/1048576).toFixed(1)+' MB'; }

// SVG dark-blue icon (used instead of emojis for file types)
function fileIcon(){
  return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0d2b6b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
}

function toast(msg,type='info'){
  let wrap=document.querySelector('.toast-wrap');
  if(!wrap){wrap=document.createElement('div');wrap.className='toast-wrap';document.body.appendChild(wrap);}
  const t=document.createElement('div');t.className='toast '+type;t.textContent=msg;wrap.appendChild(t);
  setTimeout(()=>t.remove(),3500);
}
function startClock(sel){
  const el=document.querySelector(sel); if(!el) return;
  const tick=()=>{
    const d=new Date();
    const t=d.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:true});
    const ds=d.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});
    el.innerHTML=`<div class="time">${t}</div><div class="date">${ds}</div>`;
  };
  tick(); setInterval(tick,1000);
}

/* ---------- DB backup / restore (JSON) — admin only ---------- */
async function exportDB(){
  const snap = {
    exported_at: new Date().toISOString(),
    profiles: (await sb.from('profiles').select('*')).data,
    attendance: (await sb.from('attendance').select('*')).data,
    announcements: (await sb.from('announcements').select('*')).data,
    requirements: (await sb.from('requirements').select('*')).data,
  };
  const blob = new Blob([JSON.stringify(snap,null,2)],{type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'naic_ojt_supabase_'+new Date().toISOString().slice(0,10)+'.json';
  a.click();
}

// ---------- ADMIN MANAGEMENT (calls the admin-manage edge function) ----------
async function adminManage(action, payload){
  try {
    const { data: { session } } = await sb.auth.getSession();
    if(!session) return { ok:false, error:'Your session expired. Please sign in again.' };
    const { data, error } = await sb.functions.invoke('admin-manage', {
      body: { action, ...(payload||{}) }
    });
    if(error){
      // supabase-js wraps non-2xx responses in FunctionsHttpError; try to read the body
      let msg = error.message || 'Request failed';
      try {
        if(error.context && typeof error.context.json === 'function'){
          const j = await error.context.json();
          if(j && j.error) msg = j.error;
        }
      } catch(_){}
      return { ok:false, error: msg };
    }
    if(data && data.error) return { ok:false, error:data.error };
    return { ok:true, data };
  } catch(e){
    return { ok:false, error: e.message || 'Network error' };
  }
}
