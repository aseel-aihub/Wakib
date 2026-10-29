# Wakib | واكِب

**Author / المؤلفة: Aseel** — © 2026 Aseel. All rights reserved. See [LICENSE](LICENSE).

A prototype platform that links graduation projects (capstones) to real industry challenges

منصة تربط مشاريع التخرج بتحديات حقيقية من الشركات: تحسب توافق مهارات الطالب مع التحدي، وتكوّن فريق متوازن، وتشترط اعتماد المشرف الأكاديمي ومرشد الشركة قبل بدء المشروع.

> All companies, students and challenges in this prototype are **fictional** demo data. No real company or partnership is represented.
> 
> جميع الشركات والطلاب والتحديات هنا **خيالية** للعرض فقط

**Live Demo:** https://aseel-aihub.github.io/Wakib/

## Four portals 

| Portal | What it does | الوظيفة |
|---|---|---|
| **Student** | Pick skills, see an explainable match score per challenge, apply | اختيار المهارات، نسبة توافق مع شرح، التقديم |
| **Industry Mentor** | Ranked candidates, one-click balanced team, industry approval | ترتيب المرشحين، تكوين فريق متوازن، اعتماد الشركة |
| **Faculty / Admin** | Academic approval, then a GP1/GP2 milestone tracker | الاعتماد الأكاديمي ثم متابعة مراحل GP1/GP2 |
| **University / Ministry** | Skills-gap analytics (supply vs. demand per skill) | تحليل فجوة المهارات (العرض مقابل الطلب) |

## How the matching works 

- **Match score** — cosine similarity between the student's skill vector and the challenge's required skills (`js/match.js`)
- **Explainable** — shows which required skills are covered vs. missing
- **Balanced team** — greedy method: each step adds the student who covers the most of what is still needed
- **Skills gap** — average student level vs. average required level for each skill

## Design 

- Brand colors taken from the Wakib logo (dark green + light green)
- Two themes: **dark** and **light**, switched with the moon/sun button. The choice is saved; the first visit follows the device setting
- الألوان مأخوذة من شعار واكِب، مع وضعين: داكن وفاتح

## Security 

- No `innerHTML` with data — all text is added with `textContent` (prevents XSS)
- Content-Security-Policy: only the project's own scripts, styles, fonts and images can load
- No CDN: icons and logo are stored locally in the project
- Saved browser data is checked and cleaned before use (bad or edited data is ignored)

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
  data.js     — demo data (skills, students, companies, challenges, GP1/GP2 stages)
  match.js    — score, explanation, team building, skills gap
  storage.js  — save / load / clear browser data
  app.js      — draws the 4 portals and handles buttons
vendor/fontawesome/  — local icons (Font Awesome Free, own license)
```

---
© 2026 Aseel — Wakib | واكِب. All rights reserved.
