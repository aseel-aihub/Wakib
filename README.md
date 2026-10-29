# Wakib | واكِب

**Author Aseel** — © 2026 Aseel. All rights reserved. See [LICENSE](LICENSE).

A prototype platform that links graduation projects (capstones) to real industry challenges

منصة تربط مشاريع التخرج بتحديات حقيقية من الشركات: تحسب توافق مهارات الطالب مع التحدي، وتكوّن فريق متوازن، وتشترط اعتماد المشرف الأكاديمي ومرشد الشركة قبل بدء المشروع.

> All companies, students and challenges in this prototype are **fictional** demo data. No real company or partnership is represented.
> 
> جميع الشركات والطلاب والتحديات هنا **خيالية** للعرض فقط

**Live Demo:** https://aseel-aihub.github.io/Wakib/

## Four portals 

| Portal | What it does | الوظيفة |
|---|---|---|
| **Student** | Set skill levels (1–5), see an explainable fit score, then **apply solo or build a team** (with a balanced-team suggestion), and follow each application | تحديد المهارات، نسبة توافق مع شرح، التقديم **منفرداً أو بفريق يكوّنه الطالب**، ومتابعة الطلب |
| **Company** | Post a challenge, see the list of applicants (solo or teams), **approve or reject** | طرح تحدٍّ، قائمة المتقدمين، **القبول أو الرفض** |
| **Supervisor** | Approve the project, then track its stages in order (Proposal → Final report) | اعتماد المشروع ثم متابعة مراحله بالترتيب |
| **University** | Dashboard with **2 charts**: applications by status, and the skills gap | لوحة فيها **رسمان**: الطلبات حسب الحالة، وفجوة المهارات |

A short welcome and a 4-step guide walk a first-time visitor through the full flow.

## How the matching works 

- **Fit score** — for each required skill, how much of the needed level the student has (extra levels don't count): `covered points / required points` (`js/match.js`)
- **Team coverage** — the members' levels are added per skill, capped at what the challenge needs
- **Balanced team suggestion** — greedy method: starting with the student, each step adds the classmate who covers the most of what is still needed
- **Skills gap** — average level of the students who have the skill vs. average level asked by challenges

## Design 

- Neutral surfaces with the Wakib logo green as the one accent
- Two themes: **dark** and **light**, switched with the moon/sun button. The choice is saved; the first visit follows the device setting
- الألوان مأخوذة من شعار واكِب، مع وضعين: داكن وفاتح

## Security 

- No `innerHTML` with data — all text is added with `textContent` (prevents XSS)
- Content-Security-Policy: only the project's own scripts, styles, fonts and images can load
- No CDN: icons and logo are stored locally in the project
- Saved browser data and typed text are checked and cleaned before use (bad or edited data is ignored)

## Stack & run 

Vanilla HTML / CSS / JavaScript — no build step, no backend, data saved in the browser (`localStorage`).

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Structure 

```
index.html
css/style.css
assets/       — Wakib logo (one version per theme) + favicon
js/
  theme.js    — dark / light theme (loaded first)
  data.js     — demo data (skills, students, companies, challenges, applications, stages)
  match.js    — fit score, team coverage, team suggestion, skills gap
  storage.js  — save / load / clear browser data
  app.js      — draws the 4 portals, the demo guide and handles buttons
vendor/fontawesome/  — local icons (Font Awesome Free, own license)
```

---
© 2026 Aseel — Wakib | واكِب. All rights reserved.
