/* ============================================================================
   Session / "Leave this page?" guard.
   Included on every AUTHENTICATED page (admin/*.html and student/*.html,
   right after js/app.js) so that leaving the page — closing the tab,
   refreshing, typing a new address, or tapping a link that leads outside the
   signed-in portal — asks for confirmation first instead of silently
   dropping the session screen.

   IMPORTANT — read this before assuming this "fixes" the Appilix bottom
   navigation bar:
   The Home / Features / About / Contact buttons you configured in the
   Appilix dashboard's "Bottom Navigation Bar" module are NATIVE Android/iOS
   buttons drawn by the Appilix app shell itself. They live OUTSIDE the
   webpage/DOM, so no JavaScript running on the page (this file included)
   can intercept a tap on them before they load a new URL — the app
   navigates the WebView directly, the same way typing a new address in a
   browser's address bar would. This is a platform limitation, not a bug in
   this script.
   The supported, reliable fix for THAT specific problem is a one-time
   setting change in your Appilix dashboard (hide the Bottom Navigation Bar
   on the admin/ and student/ pages) — see the setup guide that came with
   this update for the exact steps.
   What this file DOES reliably catch, on both the plain website and inside
   the Appilix WebView: in-page links/buttons that navigate to a different
   page (e.g. an old link back to the public site), and — on real desktop
   and mobile browsers — refreshing, closing the tab, or navigating away via
   the browser's own UI.
   ============================================================================ */
(function () {
  var LEAVE_TITLE   = 'Leave this page?';
  var LEAVE_MESSAGE = 'Going back will log you out of your account. Continue?';

  // Pages where this guard should NOT nag (nothing to lose by leaving).
  var path = (window.location.pathname || '').toLowerCase();
  if (/login-|signup-|forgot-password|reset-password|admin-setup-password|^\/index\.html$/.test(path)) {
    return;
  }

  var intentionalLeave = false; // set true right before a deliberate navigation (e.g. logout())

  /* ---- 1) Browser/native "close or replace this document" event ----------
     Fires for tab close, refresh, typing a new URL, bookmarks, and (in real
     browsers, not guaranteed inside every WebView) the device Back
     gesture. Browsers no longer show custom text here (a security
     restriction), but returning a string still makes the confirmation
     dialog itself appear. */
  window.addEventListener('beforeunload', function (e) {
    if (intentionalLeave) return;
    e.preventDefault();
    e.returnValue = LEAVE_MESSAGE;
    return LEAVE_MESSAGE;
  });

  /* ---- 2) In-page links/buttons that navigate to a different page --------
     Anything the user can tap INSIDE our own HTML that points somewhere
     else. We let normal in-app navigation (sidebar links to other
     admin/student pages, the Log Out button, mailto:, tel:, same-page #
     anchors) through untouched, and only ask for confirmation before a link
     that would leave the signed-in app entirely (the public site, an
     external domain, etc.). Mark any link that should always be allowed
     without asking with data-skip-leave-guard="true". */
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
    var inSamePortalFolder = sameOrigin && dest.pathname.replace(/\\/g, '/').split('/').slice(0, -1).join('/')
      === window.location.pathname.replace(/\\/g, '/').split('/').slice(0, -1).join('/');

    // Navigating to another page in the SAME admin/ or student/ folder (the
    // normal sidebar) is intentional in-app navigation — never ask.
    if (inSamePortalFolder) return;

    e.preventDefault();
    var proceed = function () {
      intentionalLeave = true;
      window.location.href = href;
    };
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

  // Let the rest of the app (e.g. data.js's logout()) mark a navigation as
  // intentional so beforeunload doesn't double-prompt on top of its own
  // "Are you sure you want to log out?" confirmation.
  window.__markIntentionalLeave = function () { intentionalLeave = true; };
})();
