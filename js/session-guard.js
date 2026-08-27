/* ============================================================================
   Session / "Leave this page?" guard.
   Included on every AUTHENTICATED page (admin/*.html and student/*.html,
   right after js/app.js).

   SCOPE (important): this must ONLY ask before the user leaves the signed-in
   app entirely — i.e. heading back to the public homepage (index.html) or an
   outside link. It must NEVER ask when moving between pages inside the same
   portal (Dashboard → Interns → Attendance → Scanner → Archived → Reports →
   Announcements → Account, etc.) — that navigation must stay instant, with
   no prompt at all.

   Why there's no `beforeunload` listener here: this site is a classic
   multi-page app (every sidebar link is a real page unload, not an in-page
   route change), and `beforeunload` fires for ANY navigation with no way to
   tell — even from inside the event — where the user is headed. Browsers
   deliberately hide the destination for privacy/security reasons, so a
   `beforeunload` listener cannot be scoped to "only when going home" and
   will nag on every single click, which is exactly the false alarm you saw.
   Instead, this guard intercepts the <a> click itself, where the destination
   IS known up front, and only asks when that destination is the homepage or
   an outside domain.

   IMPORTANT — this still cannot catch the Appilix native Bottom Navigation
   Bar (Home/Features/About/Contact): those buttons are drawn by the Appilix
   app shell itself, outside this page's HTML/JavaScript, so no script here
   ever sees the tap before it loads a new URL. That one is fixed on the
   Appilix dashboard side (hide the bottom bar on admin/ and student/ pages) —
   see the setup guide, not this file.
   ============================================================================ */
(function () {
  var LEAVE_TITLE   = 'Leave this page?';
  var LEAVE_MESSAGE = 'Going back will log you out of your account. Continue?';

  // Pages where this guard should NOT apply (nothing to lose by leaving).
  var path = (window.location.pathname || '').toLowerCase();
  if (/login-|signup-|forgot-password|reset-password|admin-setup-password|^\/index\.html$/.test(path)) {
    return;
  }

  /* In-page links/buttons that navigate to a different page. We only ask
     before a link whose destination is the public homepage (index.html /
     site root) or an outside domain — every other in-app link (any other
     admin/*.html or student/*.html page, including across the two portals)
     is left completely alone and navigates instantly, no prompt. Mark any
     homepage/external link that should always be allowed without asking
     with data-skip-leave-guard="true". */
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    if (a.hasAttribute('data-skip-leave-guard')) return;
    if (a.target && a.target !== '' && a.target !== '_self') return; // opens elsewhere/new tab
    var href = a.getAttribute('href') || '';
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) return;

    var dest;
    try { dest = new URL(href, window.location.href); } catch (_) { return; }
    var sameOrigin = dest.origin === window.location.origin;
    var destPath = dest.pathname.replace(/\\/g, '/');
    var isHomepage = sameOrigin && (destPath === '/' || destPath === '' || /\/index\.html$/i.test(destPath));
    var isExternal = !sameOrigin;

    // Any other in-app page (same portal or the other one) — normal,
    // instant navigation, never ask.
    if (!isHomepage && !isExternal) return;

    e.preventDefault();
    var proceed = function () { window.location.href = href; };
    if (typeof confirmDialog === 'function') {
      confirmDialog({
        title: LEAVE_TITLE,
        message: LEAVE_MESSAGE,
        confirmText: 'Leave',
        cancelText: 'Stay',
        danger: true
      }).then(function (ok) { if (ok) proceed(); });
    } else if (window.confirm(LEAVE_TITLE + ' ' + LEAVE_MESSAGE)) {
      proceed();
    }
  }, true);
})();
