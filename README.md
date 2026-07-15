# Naic OJT Attendance Monitoring System

**Full-stack:** Static HTML + CSS + JavaScript frontend, powered by **Supabase** (PostgreSQL + Auth + Storage) as the backend.

> Municipality of Naic, Cavite — OJT Attendance Monitoring System.

## Quick start

1. Read [SETUP.md](./SETUP.md) — 6-step guide to wire up your Supabase project.
2. Paste your Supabase URL + anon key into `js/supabase-config.js`.
3. Run `sql/schema.sql` in the Supabase SQL Editor.
4. Create your admin user (dashboard → Authentication → Users) and grant the `admin` role.
5. Deploy the static files to GitHub Pages / Netlify / Vercel, or run locally with `python -m http.server 8000`.

## Features

### Intern
- Dashboard with live clock, remaining hours, progress ring
- QR-based Time In / Time Out with auto status (present / late)
- Multi-file requirements upload (Supabase Storage)
- Profile with uploadable photo (avatar bucket)
- Attendance history + PDF/CSV/print reports

### Admin
- Dashboard: totals, today's status, trends
- Students list — newly registered accounts appear automatically (auto-recognized)
- Edit only Start Date, End Date, Required Hours per student
- Attendance page: All / Present / Late / Absent tabs, live-updating, auto-absent after 1 hour past expected time-in, "Delete All (Today)"
- Scanner with camera or manual ID — auto-recognizes students
- Announcements, archived students, reports, admin account settings

## Tech
- Vanilla HTML/CSS/JS + Poppins (Google Fonts)
- **Supabase JS SDK v2** (CDN)
- CDN libraries: Chart.js, jsPDF + AutoTable, qrcode.js, html5-qrcode
- Dark-blue inline SVG icons (no emoji icons anywhere)

## License
© 2026 Municipality of Naic · OJT Attendance System.
