*This project has been created as part of the 42 curriculum by dtereshc.*

<!-- TEAM: add the remaining logins above as `dtereshc, login2, login3, login4`, then
     fill in the Team Information, Features List and Individual Contributions
     tables below. Every team member must appear in all three. -->

# PlanShift

[![Python](https://img.shields.io/badge/Python-3.12-blue?logo=python&logoColor=white)](https://www.python.org/)
[![Django](https://img.shields.io/badge/Django-6.0-092E20?logo=django&logoColor=white)](https://www.djangoproject.com/)
[![SQLite](https://img.shields.io/badge/SQLite-3-003B57?logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![nginx](https://img.shields.io/badge/nginx-TLS-009639?logo=nginx&logoColor=white)](https://nginx.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

## Description

**PlanShift** is a shift-scheduling web application for hourly-employment teams — coffee shops,
restaurants, retail. Managers build a schedule on an interactive calendar, the server enforces the
scheduling rules, and employees see only what has been published to them.

**The goal.** Building a rota by hand is mostly conflict-checking: does this person hold the right
position, are they already booked, did they ask for the day off, is the shift now over capacity?
Every one of those checks is easy to get wrong at 6 a.m. on a Monday. PlanShift moves them into the
application layer, inside the transaction that saves the shift, so an invalid schedule cannot be
written to the database in the first place.

**Overview.** Two roles share one calendar. A manager drafts shifts privately, assigns staff to
them, and publishes a date range in one action; employees then see their own shifts appear, and can
mark days they are unavailable, which immediately blocks any assignment on that day.

### Key features

- Monthly calendar overview with the team list beside it.
- Draft/publish workflow — drafts are manager-only until published.
- Four scheduling rules enforced server-side inside one transaction.
- Team and position management, with one-time generated credentials.
- Employee self-service unavailability, pushed live to open manager calendars over WebSockets.
- Shift search with a text query, filters, sortable columns and pagination.
- Analytics dashboard with KPIs, charts, top lists and CSV/PDF export, refreshed live when shifts change.
- Notification bell: every toast is kept in a per-account history with an unread count.
- Email + password sign-up and login, with passwords stored only as salted PBKDF2 hashes.
- End-to-end HTTPS, with plain HTTP redirected to TLS.
- Accessible Privacy Policy and Terms of Service.

---

