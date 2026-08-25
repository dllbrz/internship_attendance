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

/* ---------------------------------------------------------------------------
   Branded page loader.
   Every authenticated page ships `<div id="shell">Loading…</div>` as its
   initial markup. This file runs while that node is already in the DOM, so we
   swap the bare text for a branded skeleton/spinner. The page code replaces
   #shell.innerHTML once data is ready, which removes the loader automatically.
   --------------------------------------------------------------------------- */
function _installPageLoader(){
  try{
    const shell = document.getElementById('shell');
    if(!shell) return;
    if(!/loading/i.test(shell.textContent || '')) return;   // page already rendered
    const logo = (window.location.pathname.match(/\/(student|admin)\//) ? '../' : '') + 'assets/naic-engineering-logo.png';
    shell.classList.add('shell-loading');
    shell.innerHTML = `
      <div class="page-loader" role="status" aria-live="polite" aria-label="Loading page">
        <img class="page-loader-logo" src="${logo}" alt="" aria-hidden="true">
        <div class="page-loader-spinner" aria-hidden="true"></div>
        <div class="page-loader-text">Preparing your page...</div>
        <div class="page-loader-skeleton" aria-hidden="true">
          <span></span><span></span><span></span>
        </div>
      </div>`;

    // CRITICAL: `.shell-loading` forces `display:block` so the spinner can be
    // centred. The page grid (sidebar | main) only works once that class is
    // gone, so watch #shell and drop the class the moment the page swaps its
    // own markup in. Without this the sidebar renders full-width and the real
    // content is pushed off-screen (blank white page).
    const observer = new MutationObserver(() => {
      if(!shell.querySelector('.page-loader')){
        shell.classList.remove('shell-loading');
        observer.disconnect();
      }
    });
    observer.observe(shell, { childList:true, subtree:false });
    // Belt and braces: if anything mutates the shell without the observer
    // firing (older browsers, sync innerHTML in the same tick), clear it too.
    window.clearPageLoader = function(){
      shell.classList.remove('shell-loading');
      try{ observer.disconnect(); }catch(_){}
    };
  }catch(_){}
}
if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', _installPageLoader);
} else {
  _installPageLoader();
}

const REQUIREMENT_TYPES = [
  {key:'moa', label:'MOA'},
  {key:'internship_agreement', label:'Internship Agreement'},
  {key:'endorsement', label:'Endorsement Letter'},
  {key:'consent', label:'Consent Form'},
  {key:'cv', label:'Curriculum Vitae / Resume'},
  {key:'medical', label:'Medical Certificate'},
  {key:'xray', label:'X-ray result'},
  {key:'insurance', label:'Insurance Certificate'},
  {key:'cor', label:'Certificate of Registration'},
  {key:'others', label:'Others'},
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
    expected_time_in: (p.expected_time_in || '08:00').slice(0,5),
    expected_time_out: (p.expected_time_out || '17:00').slice(0,5),
    break_minutes: (p.break_minutes == null ? 60 : Number(p.break_minutes)),
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
    verified: a.verified,
    credit_type: a.credit_type || null,
    note: a.note || null,
    deleted_at: a.deleted_at || null
  };
}

// ---------- session restore ----------
// BUGFIX (navigation bounces back to the login page):
// supabase-js restores the persisted session ASYNCHRONOUSLY. On a fresh page
// load getSession() can resolve with `null` while the client is still reading
// localStorage or refreshing an expired access token. The old code treated
// that transient null as "signed out" and redirected to login, so clicking any
// sidebar link occasionally kicked the user out. We now wait for the client to
// settle (INITIAL_SESSION / TOKEN_REFRESHED) with a short polling fallback
// before concluding that nobody is signed in.
function _hasPersistedSession(){
  try {
    for(let i=0; i<localStorage.length; i++){
      const k = localStorage.key(i);
      if(k && (k === 'naic_ojt_auth' || /^sb-.*-auth-token$/.test(k))){
        const raw = localStorage.getItem(k);
        if(raw && raw !== 'null' && raw.length > 10) return true;
      }
    }
  } catch(_){}
  return false;
}

async function waitForSession(maxWaitMs){
  const deadline = Date.now() + (maxWaitMs || 6000);

  // Fast path.
  let { data: { session } } = await sb.auth.getSession();
  if(session) return session;

  // Nothing persisted at all → genuinely signed out, don't stall the page.
  if(!_hasPersistedSession()) return null;

  // Give the client a chance to hydrate / refresh.
  const settled = await new Promise(resolve => {
    let done = false;
    let sub = null;
    let poll = null;
    const finish = v => {
      if(done) return;
      done = true;
      if(poll) clearInterval(poll);
      if(sub){ try { sub.unsubscribe(); } catch(_){} }
      resolve(v);
    };
    try {
      const res = sb.auth.onAuthStateChange((event, s2) => {
        if(s2) finish(s2);
        else if(event === 'SIGNED_OUT') finish(null);
      });
      sub = res && res.data && res.data.subscription;
    } catch(_){}
    poll = setInterval(async () => {
      const { data } = await sb.auth.getSession();
      if(data.session) finish(data.session);
      else if(Date.now() > deadline) finish(null);
    }, 250);
    setTimeout(() => finish(null), Math.max(0, deadline - Date.now()));
  });
  if(settled) return settled;

  // Last resort: force a refresh using the stored refresh token.
  try {
    const { data } = await sb.auth.refreshSession();
    if(data && data.session) return data.session;
  } catch(_){}
  const { data: final } = await sb.auth.getSession();
  return final.session || null;
}

// ---------- bootstrap: load session + cache on every page ----------
async function bootstrap(){
  window.__DB__ = { students:[], attendance:[], announcements:[], requirements:[], session:null, currentUser:null, isAdmin:false, admins:[] };
  // Read session from local storage; if the token is being refreshed at
  // navigation time getSession() can transiently return null even though a
  // valid refresh token is present. Give the client one refresh chance
  // before we treat the user as signed out — this fixes the bug where
  // navigating between pages bounces the user back to the login screen.
  const session = await waitForSession();
  if(!session){ return; }

  const userId = session.user.id;
  // roles
  const { data: roles, error: roleError } = await sb.from('user_roles').select('role').eq('user_id', userId);
  if(roleError){ console.error('Role load failed:', roleError); throw roleError; }
  const isAdmin = (roles||[]).some(r=>r.role==='admin');
  window.__DB__.isAdmin = isAdmin;

  // PERFORMANCE: profiles / announcements / attendance / requirements do not
  // depend on each other, so they are fetched CONCURRENTLY instead of one
  // round-trip after another. This is what removes the long "Loading…" wait.
  const attendanceQuery = isAdmin
    ? sb.from('attendance').select('*').is('deleted_at', null).order('date',{ascending:false})
    : sb.from('attendance').select('*').eq('student_id', userId).is('deleted_at', null).order('date',{ascending:false});
  const requirementsQuery = isAdmin
    ? sb.from('requirements').select('*')
    : sb.from('requirements').select('*').eq('student_id', userId);

  const [profileRes, anncRes, attRes, reqRes] = await Promise.all([
    sb.from('profiles').select('*'),
    sb.from('announcements').select('*').order('created_at',{ascending:false}),
    attendanceQuery,
    requirementsQuery
  ]);

  const { data: profiles, error: profileError } = profileRes;
  if(profileError){ console.error('Profile load failed:', profileError); throw profileError; }
  window.__DB__.students = (profiles||[]).map(_mapProfileRow);
  const internIdMap = new Map((profiles||[]).map(p=>[p.id, p.intern_id]));

  // announcements
  const { data: annc, error: annError } = anncRes;
  if(annError){ console.warn('Announcements load failed:', annError); }
  window.__DB__.announcements = (annc||[]).map(a=>({
    id: a.id, title: a.title, body: a.body, author: a.author,
    created_at: a.created_at,
    // publish_at = when interns start seeing it (defaults to creation time).
    publish_at: a.publish_at || a.created_at,
    date: String(a.publish_at || a.created_at || '').slice(0,10)
  }));

  // attendance
  const { data: att, error: attError } = attRes;
  if(attError){ console.warn('Attendance load failed:', attError); }
  window.__DB__.attendance = (att||[]).map(a=>_mapAttendance(a, internIdMap));

  // current user
  if(isAdmin){
    const md = session.user.user_metadata || {};
    window.__DB__.currentUser = {
      id:'A001',
      name: md.full_name || md.name || session.user.email || 'Administrator',
      role:'Admin',
      email: session.user.email,
      avatar: md.avatar_url || null,
      avatar_url: md.avatar_url || null,
      auth_id: userId
    };
    window.__DB__.session = { type:'admin', id:'A001', auth_id:userId };
    window.__DB__.admins = [window.__DB__.currentUser];
  } else {
    const me = (profiles||[]).find(p=>p.id===userId);
    if(me){
      let legacy = window.__DB__.students.find(s=>s.auth_id===userId);
      if(!legacy){ legacy = _mapProfileRow(me); window.__DB__.students.push(legacy); }
      // IMPORTANT: currentUser MUST be the SAME object reference as the entry in
      // window.__DB__.students, so that mutations from loadRequirements() /
      // addStudentRequirement() (which push into st.requirements) are visible
      // to pages that read from currentUser.requirements.
      window.__DB__.currentUser = legacy;
      window.__DB__.session = { type:'student', id:legacy.id, auth_id:userId };
    }
  }

  if(!window.__DB__.session){
    throw new Error(isAdmin ? 'Admin account is missing its role setup.' : 'Your intern profile was not created. Re-run sql/schema.sql, then create the account again.');
  }

  // requirements for current student (or all for admin) — fetched in parallel above
  const { data: reqs, error: reqError } = reqRes;
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

  // global office / shift schedule (shared across every admin device)
  await loadOfficeSchedule();

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
    if(nowMinutes - expected >= (getOfficeSchedule().absent_after_minutes || 60)){
      toInsert.push({ student_id:s.auth_id, date:today, status:'absent', hours:0, verified:false });
    }
  }
  // Timed in but never timed out by the end of their shift -> Absent
  if(window.__DB__.isAdmin){
    for(const s of window.__DB__.students){
      const rec = window.__DB__.attendance.find(a=>a.student_id===s.id && a.date===today);
      if(!rec || !rec.time_in || rec.time_out || rec.status==='absent') continue;
      if(shiftHasEnded(rec, s)){
        await sb.from('attendance').update({ status:'absent' }).eq('id', rec.id);
        rec.status = 'absent';
      }
    }
  }

  if(toInsert.length && window.__DB__.isAdmin){
    await sb.from('attendance').upsert(toInsert, { onConflict:'student_id,date', ignoreDuplicates:true });
    // refresh cache with new absents
    const internIdMap = new Map(window.__DB__.students.map(s=>[s.auth_id, s.id]));
    const { data:att } = await sb.from('attendance').select('*').eq('date',today).is('deleted_at', null);
    (att||[]).forEach(a=>{
      const mapped = _mapAttendance(a, internIdMap);
      if(!window.__DB__.attendance.some(x=>x.id===mapped.id)) window.__DB__.attendance.unshift(mapped);
    });
  }
}

// Navigation-depth reset: the first authenticated page after a sign-in must be
// treated as the "entry page" so the back-button logout prompt appears only
// there (see installBackGuard in js/app.js).
function _resetNavDepth(){ try { sessionStorage.removeItem('naic_ojt_nav_depth'); } catch(_){} }

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
  _resetNavDepth();
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
  const raw = String(usernameOrEmail || '').trim();
  if(!raw) return {ok:false, error:'Enter your username or email address.'};
  if(!password) return {ok:false, error:'Enter your password.'};
  let email = raw;
  // USERNAME LOGIN: administrators may type either their email address or the
  // username saved on their profile. The lookup runs through the security
  // definer function find_admin_email_by_username (see
  // sql/migration-admin-username-and-schedule-status.sql) so no email address
  // is ever exposed to anonymous visitors.
  if(!raw.includes('@')){
    let resolved = null;
    try {
      const { data } = await sb.rpc('find_admin_email_by_username', { _username: raw });
      if(data) resolved = data;
    } catch(_){}
    email = resolved || (raw + '@naic.gov.ph'); // legacy convention fallback
  }
  let { data, error } = await sb.auth.signInWithPassword({ email, password });
  if(error && !raw.includes('@')){
    return {ok:false, error:'Incorrect username or password. You can also sign in with your email address.'};
  }
  if(error) return {ok:false, error:error.message};
  _resetNavDepth();
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
  if(error){
    console.error('Resend confirmation failed:', error);
    return {ok:false, error:_authEmailError(error, 'We could not resend the confirmation code right now.')};
  }
  return {ok:true};
}
function _passwordRecoveryRedirectUrl(){
  const configuredSite = String(window.PUBLIC_SITE_URL || '').trim().replace(/\/+$/, '');
  if(configuredSite){
    try{ return new URL('reset-password.html', configuredSite + '/').href; }catch(_){}
  }
  return authUrl('reset-password.html');
}
// Shared friendly wording for any Auth call that has to send an email.
// Supabase reports SMTP problems as a generic 500 "Error sending ... email";
// surfacing that raw text to interns is confusing, so we translate it.
function _authEmailError(error, fallback){
  const message = String(error && error.message ? error.message : error || '').toLowerCase();
  const status = Number(error && error.status ? error.status : 0);
  if(status === 429 || message.includes('rate limit') || message.includes('too many')){
    return 'Too many emails were requested for this address. Please wait a few minutes and try again.';
  }
  if(message.includes('error sending') || message.includes('smtp')){
    return 'The email service is temporarily unavailable. Please contact the system administrator if this continues.';
  }
  if(message.includes('already registered') || message.includes('already been registered')){
    return 'That email address is already used by another account.';
  }
  if(message.includes('network') || message.includes('failed to fetch')){
    return 'Unable to reach the server. Check your connection and try again.';
  }
  return fallback || (error && error.message) || 'Something went wrong. Please try again.';
}

function _passwordRecoveryError(error){
  const message = String(error && error.message ? error.message : error || '').toLowerCase();
  const status = Number(error && error.status ? error.status : 0);
  if(status === 429 || message.includes('rate limit')){
    return 'Too many reset emails were requested. Please wait a few minutes before trying again.';
  }
  if(message.includes('error sending recovery email') || message.includes('smtp')){
    return 'The password email service is temporarily unavailable. Please contact the system administrator if this continues.';
  }
  if(message.includes('network') || message.includes('failed to fetch')){
    return 'Unable to reach the password service. Check your connection and try again.';
  }
  return 'We could not send the reset email right now. Please try again later.';
}
async function sendPasswordReset(email){
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if(!normalizedEmail || !normalizedEmail.includes('@')) return {ok:false, error:'Enter the email address registered to your intern account.'};
  try{
    const { error } = await sb.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: _passwordRecoveryRedirectUrl()
    });
    if(error){
      console.error('Password recovery request failed:', error);
      return {ok:false, error:_passwordRecoveryError(error)};
    }
    return {ok:true};
  }catch(error){
    console.error('Password recovery request failed:', error);
    return {ok:false, error:_passwordRecoveryError(error)};
  }
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
async function logout(opts){
  // Show a confirmation dialog unless the caller explicitly opts out.
  // (Pass { confirm:false } to bypass, e.g. for internal auth failure cleanup.)
  const needConfirm = !(opts && opts.confirm === false);
  if(needConfirm){
    const ok = await confirmLogout();
    if(!ok) return;
  }
  try { await sb.auth.signOut(); } catch(e){}
  _resetNavDepth();
  window.location.href = _isInSubfolder() ? '../index.html' : 'index.html';
}

function confirmLogout(){
  // Uses the shared accessible dialog from js/app.js when available.
  if(typeof confirmDialog === 'function'){
    return confirmDialog({
      title: 'Log out',
      message: 'Are you sure you want to log out?',
      confirmText: 'Log Out',
      cancelText: 'Cancel',
      danger: true
    });
  }
  return Promise.resolve(window.confirm('Are you sure you want to log out?'));
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
  const status = classifyCheckIn(t, st.expected_time_in);
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
  const brk = breakMinutesFor(st);
  const hours = +Math.max(0, (h2*60+m2-(h1*60+m1) - brk)/60).toFixed(2);
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
  const status = classifyCheckIn(t, s.expected_time_in);
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
  const allowed = ['start_date','end_date','required_hours','active','expected_time_in','expected_time_out','break_minutes','full_name','avatar_url','phone','address','school','course','adviser_name','adviser_contact'];
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
    expected_time_out: upd.expected_time_out ?? st.expected_time_out,
    break_minutes: upd.break_minutes ?? st.break_minutes,
    avatar: upd.avatar_url ?? st.avatar,
    avatar_url: upd.avatar_url ?? st.avatar_url,
    name: upd.full_name ?? st.name,
    phone: upd.phone ?? st.phone,
    address: upd.address ?? st.address,
    school: upd.school ?? st.school,
    course: upd.course ?? st.course,
    adviser_name: upd.adviser_name ?? st.adviser_name,
    adviser_contact: upd.adviser_contact ?? st.adviser_contact
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
// publishAt (optional ISO string) lets the admin schedule an announcement in
// advance: interns only see it once that moment has passed.
async function addAnnouncement(title, body, publishAt){
  const author = (window.__DB__.currentUser||{}).name || 'Admin';
  const row = { title, body, author };
  if(publishAt) row.publish_at = publishAt;
  const { data, error } = await sb.from('announcements').insert(row).select().single();
  if(error) return {ok:false, error: announcementScheduleError(error)};
  const pub = data.publish_at || data.created_at;
  window.__DB__.announcements.unshift({
    id:data.id, title, body, author, created_at:data.created_at,
    publish_at:pub, date:String(pub||'').slice(0,10)
  });
  sortAnnouncements();
  return {ok:true, scheduled: isAnnouncementScheduled({publish_at:pub})};
}

function announcementScheduleError(error){
  return /publish_at/i.test(error.message||'')
    ? 'The database is missing the announcement scheduling column. Run sql/migration-announcement-schedule.sql in Supabase.'
    : error.message;
}
// Newest scheduled/published first.
function sortAnnouncements(){
  window.__DB__.announcements.sort((a,b)=>
    String(b.publish_at||b.date||'').localeCompare(String(a.publish_at||a.date||'')));
}
// True while the publish moment is still in the future.
function isAnnouncementScheduled(a){
  const p = a && (a.publish_at || a.created_at);
  return !!p && new Date(p).getTime() > Date.now();
}
// What the interns are allowed to see right now.
function publishedAnnouncements(){
  return (window.__DB__.announcements||[])
    .filter(a=>!isAnnouncementScheduled(a))
    .sort((a,b)=>String(b.publish_at||b.date||'').localeCompare(String(a.publish_at||a.date||'')));
}
// "Aug 12, 2026 · 8:30 AM"
function fmtDateTime(iso){
  if(!iso) return '—';
  const d = new Date(iso);
  if(isNaN(d)) return '—';
  return d.toLocaleDateString('en-US',{year:'numeric',month:'short',day:'2-digit'}) + ' · ' +
         d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
}
// ISO string -> value for <input type="datetime-local"> (local time).
function toLocalInputValue(iso){
  const d = iso ? new Date(iso) : new Date();
  if(isNaN(d)) return '';
  const p = n => String(n).padStart(2,'0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

// ---------- HELPERS ----------
function fmtDate(iso){ if(!iso) return '—'; const d=new Date(iso); return d.toLocaleDateString('en-US',{year:'numeric',month:'short',day:'2-digit'}); }
// A missing time is shown as "--:--" (an empty clock field), never as a dash.
// "00:00" is treated as EMPTY: the Edit Attendance Record form uses 00:00 to
// mean "no time recorded", so the row must read --:-- and count as Absent.
function isBlankTime(t){ const s=String(t||'').slice(0,5); return !s || s==='00:00'; }
function fmt12(t){ if(isBlankTime(t)) return '--:--'; const [h,m]=String(t).split(':').map(Number); const ap=h>=12?'PM':'AM'; const hh=((h+11)%12)+1; return `${hh}:${String(m).padStart(2,'0')} ${ap}`; }
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
async function freshAccessToken(){
  // getSession() can hand back a token that is already expired (or about to
  // expire) which makes the edge function answer "Invalid session".
  // Refresh proactively whenever the token has <60s of life left.
  let { data:{ session } } = await sb.auth.getSession();
  if(!session) return null;
  const exp = (session.expires_at || 0) * 1000;
  if(!exp || exp - Date.now() < 60000){
    const { data, error } = await sb.auth.refreshSession();
    if(!error && data?.session) session = data.session;
  }
  return session?.access_token || null;
}

async function adminManage(action, payload, _retried){
  try {
    const token = await freshAccessToken();
    if(!token) return { ok:false, error:'Your session expired. Please sign in again.' };

    // Send the bearer token explicitly — relying on the implicit session header
    // is what breaks after a token refresh in some supabase-js builds.
    const { data, error } = await sb.functions.invoke('admin-manage', {
      body: { action, ...(payload||{}) },
      headers: { Authorization: 'Bearer ' + token }
    });

    if(error){
      let msg = error.message || 'Request failed';
      if(/failed to send a request|fetch/i.test(msg)){
        return { ok:false, error:'Admin management service is unavailable. Deploy the "admin-manage" edge function, then try again.' };
      }
      let status = error.context?.status;
      try {
        if(error.context && typeof error.context.json === 'function'){
          const j = await error.context.json();
          if(j && j.error) msg = j.error;
        }
      } catch(_){}
      // One automatic retry with a hard-refreshed token.
      if(!_retried && (status === 401 || /invalid session|jwt|token/i.test(msg))){
        const r = await sb.auth.refreshSession();
        if(r?.data?.session) return adminManage(action, payload, true);
        return { ok:false, error:'Your session expired. Please sign in again.' };
      }
      return { ok:false, error: msg };
    }
    if(data && data.error) return { ok:false, error:data.error };
    return { ok:true, data };
  } catch(e){
    return { ok:false, error: e.message || 'Network error' };
  }
}

// ============================================================================
// OFFICE / SHIFT SCHEDULE (for Scanner Late/Absent thresholds)
// Stored per-browser in localStorage. Admin can override via Scanner settings.
// ============================================================================
const DEFAULT_OFFICE_SCHEDULE = {
  start_time: '08:00',      // expected time-in
  end_time:   '17:00',      // expected time-out
  grace_minutes: 15,        // <= grace = Present; > grace = Late
  absent_after_minutes: 60, // >= this past start = Absent
  break_minutes: 60         // unpaid break deducted from rendered hours
};

// Cached copy so every synchronous caller keeps working. Hydrated from the
// `app_settings` table during bootstrap so a schedule saved by ONE admin
// applies to EVERY admin device and every intern automatically.
let __OFFICE_SCHEDULE__ = (function(){
  try {
    const raw = localStorage.getItem('naic_ojt_office_schedule');
    if(raw) return { ...DEFAULT_OFFICE_SCHEDULE, ...JSON.parse(raw) };
  } catch(_){}
  return { ...DEFAULT_OFFICE_SCHEDULE };
})();

function getOfficeSchedule(){ return { ...__OFFICE_SCHEDULE__ }; }

async function loadOfficeSchedule(){
  try {
    const { data, error } = await sb.from('app_settings').select('value').eq('key','office_schedule').maybeSingle();
    if(!error && data && data.value){
      __OFFICE_SCHEDULE__ = { ...DEFAULT_OFFICE_SCHEDULE, ...data.value };
      localStorage.setItem('naic_ojt_office_schedule', JSON.stringify(__OFFICE_SCHEDULE__));
    }
  } catch(_){}
  return getOfficeSchedule();
}

// Persist globally (admin only). Falls back to a local save when the
// app_settings table has not been created yet.
async function setOfficeSchedule(patch){
  const merged = { ...__OFFICE_SCHEDULE__, ...patch };
  __OFFICE_SCHEDULE__ = merged;
  localStorage.setItem('naic_ojt_office_schedule', JSON.stringify(merged));
  try {
    const { error } = await sb.from('app_settings')
      .upsert({ key:'office_schedule', value: merged, updated_at: new Date().toISOString() }, { onConflict:'key' });
    if(error) return { ok:false, error:error.message, schedule:merged };
  } catch(e){
    return { ok:false, error:e.message || 'Could not save globally.', schedule:merged };
  }
  return { ok:true, schedule:merged };
}

function breakMinutesFor(student){
  const sch = getOfficeSchedule();
  const v = student && student.break_minutes;
  return (v == null || isNaN(v)) ? (sch.break_minutes == null ? 60 : sch.break_minutes) : Number(v);
}

function minutesOf(hhmm){
  if(!hhmm) return null;
  const [h,m] = String(hhmm).split(':').map(Number);
  return h*60 + (m||0);
}

function classifyCheckIn(timeHHMM, expectedHHMM){
  const sch = getOfficeSchedule();
  const now = minutesOf(timeHHMM);
  const expected = minutesOf(expectedHHMM || sch.start_time);
  if(now - expected >= sch.absent_after_minutes) return 'absent';
  if(now - expected > sch.grace_minutes) return 'late';
  return 'present';
}

// Live status of an intern against the shift schedule for TODAY.
// Returns { key, label } — used by the Scanner + Attendance screens.
function shiftStatusFor(student, rec){
  const sch = getOfficeSchedule();
  const start = minutesOf((student && student.expected_time_in) || sch.start_time);
  const end   = minutesOf((student && student.expected_time_out) || sch.end_time);
  const d = new Date();
  const now = d.getHours()*60 + d.getMinutes();

  if(rec && rec.time_in && rec.time_out) return { key:'done',    label:'Completed' };
  if(rec && rec.time_in)                 return { key:rec.status, label:rec.status==='late'?'Late (timed in)':'On time (timed in)' };

  if(now < start)                                   return { key:'ahead',   label:'Ahead of shift' };
  if(now <= start + sch.grace_minutes)              return { key:'pending', label:'Within schedule · Pending' };
  if(now <  start + sch.absent_after_minutes)       return { key:'late',    label:'Late' };
  if(end != null && now > end)                      return { key:'absent',  label:'Absent (shift ended)' };
  return { key:'absent', label:'Absent (past cutoff)' };
}

// ============================================================================
// UNIFIED ATTENDANCE STATE MACHINE (shared by Intern + Admin views)
//   time-in only, on time  -> "Timed In" (green)
//   time-in only, late     -> "Timed In" (yellow)
//   timed out, was on time -> "Present"  (green)
//   timed out, was late    -> "Late"     (yellow)
//   no time-in, or timed in but never timed out by shift end -> "Absent" (red)
// ============================================================================
function shiftHasEnded(rec, student){
  if(!rec) return true;
  if(rec.date !== todayStr()) return true;              // any past day is closed
  const sch = getOfficeSchedule();
  const end = minutesOf((student && student.expected_time_out) || sch.end_time);
  if(end == null) return false;
  const d = new Date();
  return (d.getHours()*60 + d.getMinutes()) > end;
}

// Returns { key:'present'|'late'|'absent', label, tone } — key is used for
// tab filtering/counting, label+tone for display.
function attendanceDisplay(rec, student, opts){
  // opts.admin === true  -> admin portal: manual/credited bookkeeping is shown.
  // default (intern view) -> a manually recorded day looks exactly like a normal
  // present day; the intern never sees that it was typed in by an admin.
  const forAdmin = !!(opts && opts.admin);
  if(!student && rec) student = window.__DB__.students.find(s=>s.id===rec.student_id);
  // Admin-granted scheduled/credited day (rest day, reward, holiday, ...).
  // Hours are credited even though the intern never scanned, so it always
  // counts as PRESENT and carries its own label.
  // An explicitly chosen extended status (Excused / Credited / Half day) always
  // wins, because the admin picked it for that exact day.
  if(rec && EXTENDED_STATUSES.indexOf(rec.status) >= 0){
    const worked = Number(rec.hours || 0) > 0;
    return { key: rec.status === 'excused' ? 'excused' : 'present',
             label: SCHEDULE_STATUS_LABELS[rec.status] || 'Credited',
             tone: statusTone(rec.status), credited: worked, worked: worked };
  }
  if(rec && rec.credit_type && isAbsentCreditType(rec.credit_type)){
    return { key:'absent', tone:'red', credited:false, worked:false,
             label: CREDIT_ABSENT_LABELS[rec.credit_type] || 'Absent' };
  }
  // SAFETY NET: an explicit "absent" status with no time in always wins over a
  // leftover crediting type, so a day the admin marked Absent can never be
  // painted as a present/credited day (admin table, intern history, reports).
  if(rec && rec.status === 'absent' && isBlankTime(rec.time_in)){
    return { key:'absent', label:'Absent', tone:'red', credited:false, worked:false };
  }
  if(rec && rec.credit_type){
    const label = rec.credit_type === 'regular'
      ? (forAdmin ? 'Present (manual)' : 'Present')
      : (rec.credit_type === 'other'
          ? 'Credited'
          : (CREDIT_LABELS[rec.credit_type] || 'Credited'));
    return { key:'present', label, tone:'green', credited:true,
             worked: CREDIT_WORKED_TYPES.indexOf(rec.credit_type) >= 0 };
  }
  if(!rec || isBlankTime(rec.time_in)) return { key:'absent', label:'Absent', tone:'red' };
  const late = rec.status === 'late';
  if(rec.status === 'absent') return { key:'absent', label:'Absent', tone:'red' };
  if(!isBlankTime(rec.time_out)){
    return late ? { key:'late', label:'Late', tone:'yellow' }
                : { key:'present', label:'Present', tone:'green' };
  }
  if(shiftHasEnded(rec, student)) return { key:'absent', label:'Absent', tone:'red' };
  return late ? { key:'late', label:'Timed In', tone:'yellow' }
              : { key:'present', label:'Timed In', tone:'green' };
}

// ============================================================================
// INTERN SELF-EDIT PROFILE
// ============================================================================
async function updateOwnProfile(patch){
  const { data:{user} } = await sb.auth.getUser();
  if(!user) return {ok:false, error:'Not signed in'};
  const allowed = ['full_name','phone','address','school','course','adviser_name','adviser_contact'];
  const upd = {};
  for(const k of Object.keys(patch)){ if(allowed.includes(k)) upd[k]=patch[k]; }
  const { error } = await sb.from('profiles').update(upd).eq('id', user.id);
  if(error) return {ok:false, error:error.message};
  const cu = window.__DB__.currentUser;
  if(cu){
    if(upd.full_name) cu.name = upd.full_name;
    if(upd.phone) cu.phone = upd.phone;
    if(upd.address) cu.address = upd.address;
    if(upd.school) cu.school = upd.school;
    if(upd.course) cu.course = upd.course;
    if(upd.adviser_name) cu.adviser_name = upd.adviser_name;
    if(upd.adviser_contact) cu.adviser_contact = upd.adviser_contact;
  }
  return {ok:true};
}

// ============================================================================
// CHANGE OWN EMAIL (interns and admins)
// ----------------------------------------------------------------------------
// Supabase Auth owns the email address. We ask Auth to change it; depending on
// the project's "Secure email change" setting the user receives one or two
// confirmation links. The `profiles.email` column is only mirrored once the
// change is actually confirmed (see syncOwnEmailFromAuth below, which runs on
// every sign-in/page load path that calls it).
// ============================================================================
async function updateOwnEmail(newEmail){
  const email = String(newEmail || '').trim().toLowerCase();
  if(!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return {ok:false, error:'Enter a valid email address.'};
  if(email.length > 255) return {ok:false, error:'Email address is too long.'};
  const { data:{user} } = await sb.auth.getUser();
  if(!user) return {ok:false, error:'Not signed in.'};
  if((user.email||'').toLowerCase() === email) return {ok:false, error:'That is already your current email address.'};
  const { error } = await sb.auth.updateUser({ email }, { emailRedirectTo: authUrl('') });
  if(error){
    console.error('Email change request failed:', error);
    return {ok:false, error:_authEmailError(error, 'We could not send the One Time Pin right now. Please try again in a few minutes.')};
  }
  return {ok:true, pending:email};
}

// ----------------------------------------------------------------------------
// EMAIL CHANGE — ONE TIME PIN FLOW
// Supabase mails BOTH a confirmation link and a 6-digit token for an email
// change. We only use the token so the whole change happens inside the app:
//   1) requestEmailChangeOtp(newEmail)  → Supabase mails the pin
//   2) the UI opens otpConfirmDialog()  → user types the pin + the word CONFIRM
//   3) verifyEmailChangeOtp(newEmail, pin) → the address is switched
// Requires the "Change Email Address" template in Supabase to contain
// {{ .Token }} and "Secure email change" to be OFF (single confirmation).
// ----------------------------------------------------------------------------
async function requestEmailChangeOtp(newEmail){
  return updateOwnEmail(newEmail);
}
async function verifyEmailChangeOtp(newEmail, token){
  const email = String(newEmail || '').trim().toLowerCase();
  const code  = String(token || '').replace(/\s+/g,'');
  if(!email) return {ok:false, error:'Missing the new email address.'};
  if(!code)  return {ok:false, error:'Enter the One Time Pin from your email.'};
  let { error } = await sb.auth.verifyOtp({ email, token: code, type:'email_change' });
  if(error){
    const msg = /expired|invalid/i.test(error.message)
      ? 'That One Time Pin is invalid or has expired. Send a new code and try again.'
      : error.message;
    return {ok:false, error: msg};
  }
  // Mirror the confirmed address into profiles so every list stays in sync.
  try { await syncOwnEmailFromAuth(); } catch(_){}
  return {ok:true, email};
}

// Mirrors the confirmed auth email into profiles.email so the UI and admin
// lists stay in sync after the user clicks the confirmation link.
async function syncOwnEmailFromAuth(){
  try{
    const { data:{user} } = await sb.auth.getUser();
    if(!user || !user.email) return {ok:false};
    const cu = window.__DB__ && window.__DB__.currentUser;
    if(cu && cu.email && cu.email.toLowerCase() === user.email.toLowerCase()) return {ok:true, changed:false};
    const { error } = await sb.from('profiles').update({ email: user.email }).eq('id', user.id);
    if(error) return {ok:false, error:error.message};
    if(cu) cu.email = user.email;
    return {ok:true, changed:true};
  }catch(e){ return {ok:false, error:String(e && e.message || e)}; }
}

// ============================================================================
// RENAME REQUIREMENT FILE (display name only — storage path unchanged)
// ============================================================================
async function renameStudentRequirement(studentInternId, reqId, newName){
  if(!newName || !newName.trim()) return {ok:false, error:'File name required'};
  const { error } = await sb.from('requirements').update({ file_name:newName.trim() }).eq('id', reqId);
  if(error) return {ok:false, error:error.message};
  const st = window.__DB__.students.find(s=>s.id===studentInternId);
  if(st){
    const r = (st.requirements||[]).find(x=>x.id===reqId);
    if(r) r.name = newName.trim();
  }
  return {ok:true};
}

// ============================================================================
// UPDATE ANNOUNCEMENT (edit an existing announcement)
// ============================================================================
async function updateAnnouncement(id, patch){
  const upd = {};
  if(patch.title != null) upd.title = patch.title;
  if(patch.body  != null) upd.body  = patch.body;
  if('publish_at' in patch) upd.publish_at = patch.publish_at || null;
  const { error } = await sb.from('announcements').update(upd).eq('id', id);
  if(error) return {ok:false, error: announcementScheduleError(error)};
  const a = window.__DB__.announcements.find(x=>x.id===id);
  if(a){
    Object.assign(a, upd);
    if('publish_at' in upd){
      a.publish_at = upd.publish_at || a.created_at;
      a.date = String(a.publish_at||'').slice(0,10);
    }
    sortAnnouncements();
  }
  return {ok:true};
}
async function deleteAnnouncement(id){
  const { error } = await sb.from('announcements').delete().eq('id', id);
  if(error) return {ok:false, error:error.message};
  window.__DB__.announcements = window.__DB__.announcements.filter(a=>a.id!==id);
  return {ok:true};
}

// ============================================================================
// DELETE OWN AVATAR (student clears their profile picture)
// ============================================================================
async function deleteOwnAvatar(){
  const { data:{user} } = await sb.auth.getUser();
  if(!user) return {ok:false, error:'Not signed in'};
  // Attempt to remove common file variants; ignore per-file errors.
  try { await sb.storage.from('avatars').remove(['png','jpg','jpeg','webp','gif'].map(x=>`${user.id}/avatar.${x}`)); } catch(_){}
  const { error } = await sb.from('profiles').update({ avatar_url:null }).eq('id', user.id);
  if(error) return {ok:false, error:error.message};
  if(window.__DB__.currentUser){ window.__DB__.currentUser.avatar=null; window.__DB__.currentUser.avatar_url=null; }
  return {ok:true};
}

// ============================================================================
// ADMIN SELF-EDIT (display name + avatar stored in auth user_metadata)
// ============================================================================
async function updateAdminSelf(patch){
  const upd = {};
  if(patch.full_name != null) upd.full_name = String(patch.full_name).trim();
  // NOTE: use `in` so that an explicit null (delete photo) is applied.
  if('avatar_url' in patch) upd.avatar_url = patch.avatar_url;
  const { data, error } = await sb.auth.updateUser({ data: upd });
  if(error) return {ok:false, error:error.message};
  const cu = window.__DB__.currentUser;
  if(cu){
    if(upd.full_name) cu.name = upd.full_name;
    if('avatar_url' in upd){ cu.avatar = upd.avatar_url || null; cu.avatar_url = upd.avatar_url || null; }
  }
  return {ok:true, user:data?.user};
}

async function uploadAdminAvatar(file){
  const { data:{user} } = await sb.auth.getUser();
  if(!user) return {ok:false, error:'Not signed in'};
  if(file.size > 5*1024*1024) return {ok:false, error:'Image is too large. Please use a file under 5 MB.'};
  if(!/^image\//.test(file.type||'')) return {ok:false, error:'Please choose an image file (JPG or PNG).'};
  const ext = (file.name.split('.').pop()||'png').toLowerCase();
  // FIX: the "avatars" storage policy requires the FIRST folder segment to equal
  // auth.uid(). The old path was `admin/<uid>/...`, whose first segment is
  // "admin", so every admin upload failed with
  // "new row violates row-level security policy". Keep the uid first.
  const path = `${user.id}/admin-avatar.${ext}`;
  const { error } = await sb.storage.from('avatars').upload(path, file, { upsert:true, contentType:file.type });
  if(error) return {ok:false, error:error.message};
  const { data:pub } = sb.storage.from('avatars').getPublicUrl(path);
  const url = pub.publicUrl + '?v=' + Date.now();
  const r = await updateAdminSelf({ avatar_url:url });
  if(!r.ok) return r;
  return {ok:true, url};
}

async function deleteAdminAvatar(){
  // 1) Delete the stored file(s) so the photo is gone for good.
  try{
    const { data:{user} } = await sb.auth.getUser();
    if(user){
      const exts = ['png','jpg','jpeg','webp','gif'];
      const paths = exts.map(x=>`${user.id}/admin-avatar.${x}`)
                        .concat(exts.map(x=>`${user.id}/avatar.${x}`));
      await sb.storage.from('avatars').remove(paths);
    }
  }catch(_){ /* ignore storage errors — metadata clearing below is what matters */ }

  // 2) Clear the reference on the auth user metadata.
  const r = await updateAdminSelf({ avatar_url:null });
  if(!r.ok) return r;
  const cu = window.__DB__.currentUser;
  if(cu){ cu.avatar = null; cu.avatar_url = null; }
  return { ok:true };
}

// ============================================================================
// UNARCHIVE (restore an archived intern back to active list)
// ============================================================================
async function unarchiveStudent(studentInternId){
  return updateStudent(studentInternId, { active:true });
}


// ============================================================================
// ADMIN — ATTENDANCE RECORD MANAGEMENT
// Manual edits, soft delete (recoverable from the Archive page), restore and
// permanent delete.
// ============================================================================

// Only students that ACTUALLY have a record on the given date.
async function fetchAttendanceForDate(dateStr){
  // (see CREDITED SCHEDULE block below for admin-granted rest/reward days)
  const { data, error } = await sb.from('attendance')
    .select('*').eq('date', dateStr).is('deleted_at', null);
  if(error) return { ok:false, error:error.message, rows:[] };
  const internIdMap = new Map(window.__DB__.students.map(s=>[s.auth_id, s.id]));
  const rows = (data||[]).map(a=>_mapAttendance(a, internIdMap));
  // Keep the in-memory cache in sync for this date.
  window.__DB__.attendance = window.__DB__.attendance.filter(a=>a.date!==dateStr).concat(rows);
  return { ok:true, rows };
}

async function updateAttendanceRecord(recordId, patch){
  const upd = {};
  // 00:00 typed in the time fields means "no time recorded" → store NULL so the
  // table shows --:-- everywhere (admin + intern) instead of "12:00 AM".
  if('time_in'  in patch) upd.time_in  = isBlankTime(patch.time_in)  ? null : patch.time_in;
  if('time_out' in patch) upd.time_out = isBlankTime(patch.time_out) ? null : patch.time_out;
  if('status'   in patch) upd.status   = patch.status;
  if('verified' in patch) upd.verified = !!patch.verified;
  if('credit_type' in patch) upd.credit_type = patch.credit_type || null;
  if('note'     in patch) upd.note = patch.note || null;
  if('hours'    in patch && patch.hours != null) upd.hours = Number(patch.hours);

  if(upd.time_in && upd.time_out){
   if(!('hours' in upd)){
    const rec = window.__DB__.attendance.find(a=>a.id===recordId);
    const st  = rec ? window.__DB__.students.find(s=>s.id===rec.student_id) : null;
    const mins = minutesOf(upd.time_out) - minutesOf(upd.time_in) - breakMinutesFor(st);
    upd.hours = +Math.max(0, mins/60).toFixed(2);
   }
  } else if('time_out' in patch && !upd.time_out){
    if(!('hours' in upd)) upd.hours = 0;
  }

  const rec0 = window.__DB__.attendance.find(a=>a.id===recordId);

  // No time in at all (blank or 00:00 – 00:00) → the day rendered no hours and
  // is an ABSENCE. Force hours 0, status 'absent' and drop any crediting type
  // so no view can still paint the day green.
  if('time_in' in patch && !upd.time_in){
    upd.time_out = null;
    upd.hours = 0;
    upd.status = 'absent';
    if(rec0 && rec0.credit_type && !isAbsentCreditType(rec0.credit_type)) upd.credit_type = 'absent';
  }

  // BUGFIX (Edit record → Status "Absent" had no effect):
  // A manually recorded day is stored with credit_type 'regular' (or another
  // crediting type) and real times. Setting the status to Absent alone left the
  // crediting type + times in place, so every view kept painting the day
  // "Present (manual)". Choosing Absent must now always win: the times are
  // cleared, hours reset to 0 and the crediting type becomes an absence type.
  if(upd.status === 'absent'){
    upd.time_in  = null;
    upd.time_out = null;
    upd.hours    = 0;
    const keep = rec0 && rec0.credit_type && isAbsentCreditType(rec0.credit_type);
    if(!('credit_type' in upd)) upd.credit_type = keep ? rec0.credit_type : 'absent';
  }

  // Switching a day back from Absent to Present/Late must not keep an absence
  // credit type, otherwise the row would still render as Absent.
  if((upd.status === 'present' || upd.status === 'late') && !('credit_type' in upd)){
    if(rec0 && rec0.credit_type && isAbsentCreditType(rec0.credit_type)) upd.credit_type = 'regular';
  }

  const { data, error } = await sb.from('attendance').update(upd).eq('id', recordId).select().single();
  if(error) return { ok:false, error:error.message };
  const internIdMap = new Map(window.__DB__.students.map(s=>[s.auth_id, s.id]));
  const mapped = _mapAttendance(data, internIdMap);
  const idx = window.__DB__.attendance.findIndex(a=>a.id===recordId);
  if(idx>=0) window.__DB__.attendance[idx] = mapped;
  return { ok:true, record:mapped };
}

// Soft delete → the record moves to the Archive page.
async function softDeleteAttendance(recordId){
  const { error } = await sb.from('attendance')
    .update({ deleted_at: new Date().toISOString() }).eq('id', recordId);
  if(error) return { ok:false, error:error.message };
  window.__DB__.attendance = window.__DB__.attendance.filter(a=>a.id!==recordId);
  return { ok:true };
}

async function restoreAttendance(recordId){
  const { data, error } = await sb.from('attendance')
    .update({ deleted_at: null }).eq('id', recordId).select().single();
  if(error) return { ok:false, error:error.message };
  const internIdMap = new Map(window.__DB__.students.map(s=>[s.auth_id, s.id]));
  const mapped = _mapAttendance(data, internIdMap);
  if(!window.__DB__.attendance.some(a=>a.id===mapped.id)) window.__DB__.attendance.unshift(mapped);
  return { ok:true, record:mapped };
}

async function purgeAttendance(recordId){
  const { error } = await sb.from('attendance').delete().eq('id', recordId);
  if(error) return { ok:false, error:error.message };
  window.__DB__.attendance = window.__DB__.attendance.filter(a=>a.id!==recordId);
  return { ok:true };
}

async function listDeletedAttendance(){
  const { data, error } = await sb.from('attendance')
    .select('*').not('deleted_at','is',null).order('deleted_at',{ascending:false});
  if(error) return { ok:false, error:error.message, rows:[] };
  const internIdMap = new Map(window.__DB__.students.map(s=>[s.auth_id, s.id]));
  return { ok:true, rows:(data||[]).map(a=>_mapAttendance(a, internIdMap)) };
}

async function purgeAllDeletedAttendance(){
  const { error } = await sb.from('attendance').delete().not('deleted_at','is',null);
  if(error) return { ok:false, error:error.message };
  return { ok:true };
}

// ============================================================================
// CREDITED SCHEDULE (admin grants a day with credited hours)
//   e.g. a reward rest day: the intern does not report for duty but the day
//   is still counted and the hours are added to the rendered total.
//   Stored as a normal attendance row + credit_type/note so BOTH the admin
//   and the intern see it everywhere attendance is displayed.
// ============================================================================
const CREDIT_TYPES = [
  { value:'regular',  label:'Regular day (manual entry)' },
  { value:'reward',   label:'Reward rest day' },
  { value:'rest_day', label:'Scheduled rest day' },
  { value:'excused',  label:'Excused (credited)' },
  { value:'excused_uncredited', label:'Excused (Not Credited) — counts as Absent' },
  { value:'absent',   label:'Absent (no hours credited)' },
  { value:'suspension', label:'Suspension of work (no hours credited)' },
  { value:'holiday',  label:'Holiday' },
  { value:'offsite',  label:'Off-site / official business' },
  { value:'makeup',   label:'Make-up duty' },
  { value:'other',    label:'Other (specify reason)' }
];
const CREDIT_LABELS = CREDIT_TYPES.reduce((m,t)=>(m[t.value]=t.label, m),{});
// Types the intern actually reported for duty (shown as a plain "Present" day).
const CREDIT_WORKED_TYPES = ['regular','makeup','offsite'];
// Types that mean the intern did NOT render hours that day. The row is stored
// with 0 hours, no time in/out and status 'absent', so every view (admin +
// intern), every count and every total treats the day as an absence.
const CREDIT_ABSENT_TYPES = ['excused_uncredited','absent','suspension'];
const CREDIT_ABSENT_LABELS = {
  excused_uncredited: 'Excused (Not Credited)',
  absent: 'Absent',
  suspension: 'Suspension of Work'
};
function isAbsentCreditType(t){ return CREDIT_ABSENT_TYPES.indexOf(t) >= 0; }

// Attendance status the admin can pick in "Add Schedule for an Intern" and in
// the Edit dialog — independent of the schedule type.
const SCHEDULE_STATUSES = [
  { value:'present',  label:'Present' },
  { value:'late',     label:'Late' },
  { value:'absent',   label:'Absent (no hours credited)' },
  { value:'excused',  label:'Excused' },
  { value:'credited', label:'Credited' },
  { value:'half_day', label:'Half day' }
];
const SCHEDULE_STATUS_LABELS = SCHEDULE_STATUSES.reduce((m,s)=>(m[s.value]=s.label,m),{});
// Statuses that are not part of the original present/late/absent set. If the
// database still uses the old CHECK constraint we store the closest legacy
// status and keep the real one in the note (see the migration file).
const EXTENDED_STATUSES = ['excused','credited','half_day'];
function statusTone(st){
  if(st === 'absent') return 'red';
  if(st === 'late' || st === 'excused' || st === 'half_day') return 'yellow';
  return 'green';
}

/**
 * Read the intern's saved shift straight from their profile row (the same data
 * shown on the admin Students page) and refresh the local cache, so any default
 * built from it can never fall back to a stale/office-wide schedule.
 * @param {string} studentInternId OJT-YYYY-XXX
 */
async function fetchStudentSchedule(studentInternId){
  const s = (window.__DB__.students||[]).find(x=>x.id===studentInternId);
  if(!s) return null;
  try {
    const { data, error } = await sb.from('profiles')
      .select('expected_time_in,expected_time_out,break_minutes')
      .eq('id', s.auth_id).maybeSingle();
    if(!error && data){
      if(data.expected_time_in)  s.expected_time_in  = String(data.expected_time_in).slice(0,5);
      if(data.expected_time_out) s.expected_time_out = String(data.expected_time_out).slice(0,5);
      if(data.break_minutes != null) s.break_minutes = Number(data.break_minutes);
    }
  } catch(_){}
  return s;
}

// Default credited hours for a student = shift length minus their break.
function defaultCreditHours(student){
  const sch = getOfficeSchedule();
  const inM  = minutesOf((student && student.expected_time_in)  || sch.start_time);
  const outM = minutesOf((student && student.expected_time_out) || sch.end_time);
  if(inM == null || outM == null) return 8;
  return +Math.max(0, (outM - inM - breakMinutesFor(student))/60).toFixed(2);
}

/**
 * Create (or replace) a credited schedule entry for one intern.
 * @param {string} studentInternId  OJT-YYYY-XXX
 * @param {{date:string, credit_type:string, hours:number, note?:string}} opts
 */
async function addScheduledCredit(studentInternId, opts){
  const s = window.__DB__.students.find(x=>x.id===studentInternId);
  if(!s) return { ok:false, error:'Intern not found.' };
  if(!opts || !opts.date) return { ok:false, error:'Pick a date for the schedule.' };
  if(!CREDIT_LABELS[opts.credit_type]) return { ok:false, error:'Pick a schedule type.' };
  const absentType = isAbsentCreditType(opts.credit_type);
  // The admin now picks the STATUS explicitly, regardless of the schedule type.
  // Absent (either from the status or from an absence schedule type) always
  // means: no time in, no time out, zero credited hours.
  const status = SCHEDULE_STATUS_LABELS[opts.status] ? opts.status : (absentType ? 'absent' : 'present');
  const noHours = (status === 'absent') || absentType;
  const hours = noHours ? 0 : Number(opts.hours);
  if(isNaN(hours) || hours < 0 || hours > 24) return { ok:false, error:'Credited hours must be between 0 and 24.' };

  const sch = getOfficeSchedule();
  const row = {
    student_id : s.auth_id,
    date       : opts.date,
    time_in    : noHours ? null : (opts.time_in  || s.expected_time_in  || sch.start_time || '08:00'),
    time_out   : noHours ? null : (opts.time_out || s.expected_time_out || sch.end_time   || '17:00'),
    hours      : noHours ? 0 : +hours.toFixed(2),
    status     : status,
    verified   : true,
    credit_type: opts.credit_type,
    note       : (opts.note || '').trim() || null,
    deleted_at : null
  };
  try {
    const { data:{ user } } = await sb.auth.getUser();
    if(user) row.credited_by = user.id;
  } catch(_){}

  let { data, error } = await sb.from('attendance')
    .upsert(row, { onConflict:'student_id,date' }).select().single();

  // FALLBACK: some databases were created before 'absent' / 'excused_uncredited'
  // were added to the credit_type CHECK constraint. Rather than silently losing
  // the absence, retry once storing the absence WITHOUT credit_type — the row is
  // still status 'absent' with 0 hours and no times, so it displays as Absent
  // everywhere. (Run sql/migration-absent-status-fix.sql to get the full label.)
  // FALLBACK: databases created before the status CHECK constraint was widened
  // only accept present / late / absent. Keep the day (and record the chosen
  // status in the note) instead of losing the entry.
  if(error && EXTENDED_STATUSES.indexOf(status) >= 0 && /status|check constraint|violates/i.test(error.message)){
    const legacy = Object.assign({}, row);
    legacy.status = (status === 'half_day') ? 'present' : (status === 'credited' ? 'present' : 'present');
    const label = SCHEDULE_STATUS_LABELS[status];
    legacy.note = legacy.note ? (label + ' — ' + legacy.note) : label;
    const retryStatus = await sb.from('attendance')
      .upsert(legacy, { onConflict:'student_id,date' }).select().single();
    data = retryStatus.data; error = retryStatus.error;
  }

  if(error && absentType && /credit_type|check constraint|violates/i.test(error.message)){
    const retryRow = Object.assign({}, row);
    delete retryRow.credit_type;
    retryRow.note = retryRow.note || (opts.credit_type === 'excused_uncredited'
      ? 'Excused (Not Credited)' : 'Marked absent by the admin');
    const retry = await sb.from('attendance')
      .upsert(retryRow, { onConflict:'student_id,date' }).select().single();
    data = retry.data; error = retry.error;
  }

  if(error){
    const msg = /credit_type|note|credited_by/i.test(error.message)
      ? 'The database is missing the credited-schedule columns. Run sql/migration-absent-status-fix.sql in Supabase (SQL Editor), then try again.'
      : error.message;
    return { ok:false, error: msg };
  }
  if(!data) return { ok:false, error:'The schedule could not be saved. Please refresh and try again.' };
  const internIdMap = new Map(window.__DB__.students.map(x=>[x.auth_id, x.id]));
  const mapped = _mapAttendance(data, internIdMap);
  const idx = window.__DB__.attendance.findIndex(a=>a.id===mapped.id);
  if(idx>=0) window.__DB__.attendance[idx] = mapped; else window.__DB__.attendance.unshift(mapped);
  return { ok:true, record:mapped, student:s };
}

// ============================================================================
// SCANNER — TWO-SCAN WORKFLOW
// 1st scan of the day  → Time In
// 2nd scan of the day  → Time Out
// ============================================================================
async function scanAttendance(studentId){
  const s = window.__DB__.students.find(x=>x.id===studentId);
  if(!s) return { ok:false, error:'Student not found' };
  if(!s.active) return { ok:false, error:'Account is archived/inactive' };

  const rec = getTodayAttendance(studentId);
  const t = nowTime();

  // Second scan → Time Out
  if(rec && rec.time_in){
    if(rec.time_out) return { ok:true, already:true, kind:'out', time:rec.time_out, status:rec.status };
    const mins = minutesOf(t) - minutesOf(rec.time_in) - breakMinutesFor(s);
    const hours = +Math.max(0, mins/60).toFixed(2);
    const { data, error } = await sb.from('attendance')
      .update({ time_out:t, hours }).eq('id', rec.id).select().single();
    if(error) return { ok:false, error:error.message };
    rec.time_out = t; rec.hours = Number(data.hours || hours);
    return { ok:true, kind:'out', time:t, hours:rec.hours, status:rec.status };
  }

  // First scan → Time In
  const status = classifyCheckIn(t, s.expected_time_in);
  const row = { student_id:s.auth_id, date:todayStr(), time_in:t, status, verified:true, hours:0, deleted_at:null };
  const { data, error } = await sb.from('attendance').upsert(row, { onConflict:'student_id,date' }).select().single();
  if(error) return { ok:false, error:error.message };
  const mapped = _mapAttendance(data, new Map([[s.auth_id, s.id]]));
  const idx = window.__DB__.attendance.findIndex(a=>a.student_id===studentId && a.date===todayStr());
  if(idx>=0) window.__DB__.attendance[idx] = mapped; else window.__DB__.attendance.unshift(mapped);
  return { ok:true, kind:'in', time:t, status };
}

// ============================================================================
// BULK SCHEDULE ASSIGNMENT (Scanner page — apply to selected interns)
// ============================================================================
async function applyScheduleToStudents(internIds, schedule){
  const patch = {};
  if(schedule.expected_time_in)  patch.expected_time_in  = schedule.expected_time_in;
  if(schedule.expected_time_out) patch.expected_time_out = schedule.expected_time_out;
  if(schedule.break_minutes != null) patch.break_minutes = Number(schedule.break_minutes);
  if(schedule.start_date) patch.start_date = schedule.start_date;
  if(schedule.end_date)   patch.end_date   = schedule.end_date;

  const failed = [];
  for(const id of internIds){
    const r = await updateStudent(id, patch);
    if(!r.ok) failed.push(id + ': ' + r.error);
  }
  return failed.length
    ? { ok:false, error:failed[0], failed }
    : { ok:true, count:internIds.length };
}

// ============================================================================
// ADMIN INVITATIONS — send an email invite link instead of a manual password
// ============================================================================
function publicSiteUrl(){
  const configured = (window.PUBLIC_SITE_URL || '').trim().replace(/\/+$/,'');
  if(configured) return configured;
  return window.location.origin;
}

async function inviteAdmin(email, fullName){
  if(!email || !email.includes('@')) return { ok:false, error:'Enter a valid email address.' };
  // Invited admins land on the dedicated admin registration page. The base
  // address comes from PUBLIC_SITE_URL so the emailed link never points at a
  // password-protected Vercel preview deployment.
  const site = publicSiteUrl();
  return adminManage('invite', {
    email: email.trim().toLowerCase(),
    full_name: (fullName||'').trim(),
    site_url: site,
    redirect_to: site + '/admin-setup-password.html'
  });
}

// Called by admin-setup-password.html right after the invited admin saves a
// password. Sends the "your admin account is ready" confirmation email.
async function notifyAdminSetupComplete(){
  return adminManage('setup_complete', {});
}

// Called by admin-setup-password.html when the invited admin submits the
// onboarding form. Saves their profile details + chosen password, marks the
// account activated and emails a confirmation.
async function completeAdminSetup(details){
  const d = details || {};
  return adminManage('complete_setup', {
    full_name: (d.fullName||'').trim(),
    position:  (d.position||'').trim(),
    contact:   (d.contact||'').trim(),
    password:  d.password || ''
  });
}
