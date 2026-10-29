/*
 * Wakib
 * Author: Aseel
 * (c) 2026 Aseel. All rights reserved.
 * Do not copy or reuse this code or idea without written permission.
 *
 * File: app.js
 * Controls the screen: draws the 4 portals, the demo guide and handles the buttons.
 *
 * Flow: the STUDENT applies solo or builds a team -> the COMPANY approves applicants
 *       -> the SUPERVISOR approves and tracks the stages -> the UNIVERSITY sees the dashboard.
 *
 * SECURITY NOTE:
 * We never put data inside innerHTML. We build elements and use textContent,
 * so no one can inject code (XSS) through saved data or typed text.
 */

"use strict";

const TEAM_SIZE = 4;
const LOW_FIT = 40;          // below this the score badge is grey and we warn the student
const YOU_ID = "you";
const MAX_CUSTOM = 10;       // max challenges a visitor can post in the demo

/* ===================================================================
   1) Helpers
   =================================================================== */

// Create an HTML element with a class and safe text.
function make(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined && text !== null) el.textContent = String(text);
  return el;
}

// Create an icon from Font Awesome.
function icon(name) {
  const i = document.createElement("i");
  i.className = "fa-solid " + name;
  i.setAttribute("aria-hidden", "true");
  return i;
}

// Create a button with an icon (optional) and text.
function makeButton(className, text, iconName) {
  const btn = make("button", className);
  btn.type = "button";
  if (iconName) btn.appendChild(icon(iconName));
  btn.appendChild(document.createTextNode((iconName ? " " : "") + text));
  return btn;
}

// Keep a number inside a range (e.g. 0 to 5).
function clamp(num, min, max) {
  const n = Number(num);
  if (!Number.isFinite(n)) return min;
  return Math.min(Math.max(n, min), max);
}

function hasAnySkill(skills) {
  return Object.values(skills).some(v => v > 0);
}

// Same skills and same levels?
function sameSkills(a, b) {
  return SKILLS.every(s => (Number(a[s]) || 0) === (Number(b[s]) || 0));
}

function byId(id) {
  return document.getElementById(id);
}

/* ===================================================================
   2) App state + checking saved data
   =================================================================== */

function emptyState() {
  return {
    mySkills: {},      // your skill levels
    myApps: {},        // your applications: { challengeId: { mode, memberIds, youSkills } }
    decisions: {},     // company decisions: { applicationId: "approved" | "rejected" }
    projects: {},      // approved projects: { applicationId: { facultyApproved, milestones } }
    custom: [],        // challenges posted in this demo
    introHidden: false,
  };
}

// Keep only valid skills with levels 0-5 (ignore anything strange).
function cleanSkills(raw) {
  const result = {};
  if (!raw || typeof raw !== "object") return result;
  SKILLS.forEach(skill => {
    const level = Math.round(clamp(raw[skill], MIN_LEVEL, MAX_LEVEL));
    if (level > 0) result[skill] = level;
  });
  return result;
}

// Clean text typed by a visitor (no control characters, limited length).
function cleanText(raw, maxLen) {
  return String(raw || "").replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLen);
}

// Check one challenge posted in the demo. If something is wrong we drop it.
function cleanCustomChallenge(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = String(raw.id || "");
  if (!/^u\d{1,16}$/.test(id)) return null;
  if (!getCompany(raw.companyId)) return null;
  const title = cleanText(raw.title, 80);
  const description = cleanText(raw.description, 200);
  const required = cleanSkills(raw.required);
  if (title.length < 5 || !hasAnySkill(required)) return null;
  return { id, companyId: raw.companyId, title, description, required, custom: true };
}

// A stage can't start before the stage before it is done.
function enforceMilestoneOrder(milestones) {
  for (let i = 1; i < milestones.length; i++) {
    if (milestones[i - 1].status !== "Done") milestones[i].status = "Not started";
  }
}

function newMilestones() {
  return MILESTONE_TEMPLATE.map(m => ({ name: m.name, status: "Not started" }));
}

function cleanMilestones(raw) {
  const saved = Array.isArray(raw) ? raw : [];
  const list = MILESTONE_TEMPLATE.map((m, i) => {
    const status = saved[i] && saved[i].status;
    return { name: m.name, status: MILESTONE_STATUSES.includes(status) ? status : "Not started" };
  });
  enforceMilestoneOrder(list);
  return list;
}

// Check one of your applications.
function cleanMyApp(raw) {
  if (!raw || typeof raw !== "object") return null;
  const mode = raw.mode === "team" ? "team" : "solo";
  const youSkills = cleanSkills(raw.youSkills);
  if (!hasAnySkill(youSkills)) return null;
  let memberIds = Array.isArray(raw.memberIds) ? raw.memberIds.map(String) : [];
  // only real demo students, no duplicates, team size limit (you count as one)
  memberIds = [...new Set(memberIds.filter(id => getStudent(id)))].slice(0, TEAM_SIZE - 1);
  if (mode === "solo") memberIds = [];
  if (mode === "team" && memberIds.length === 0) return null;
  return { mode, memberIds, youSkills };
}

// Check all saved data before using it.
function cleanState(saved) {
  const state = emptyState();
  if (!saved || typeof saved !== "object") return state;

  state.mySkills = cleanSkills(saved.mySkills);
  state.introHidden = saved.introHidden === true;
  if (Array.isArray(saved.custom)) {
    state.custom = saved.custom.slice(0, MAX_CUSTOM).map(cleanCustomChallenge).filter(Boolean);
  }

  const challengeIds = CHALLENGES.map(c => c.id).concat(state.custom.map(c => c.id));
  challengeIds.forEach(id => {
    const app = saved.myApps ? cleanMyApp(saved.myApps[id]) : null;
    if (app) state.myApps[id] = app;
  });

  // Decisions and projects only for applications that really exist.
  const appIds = allApplicationsFor(state).map(a => a.id);
  appIds.forEach(id => {
    const d = saved.decisions && saved.decisions[id];
    if (d === "approved" || d === "rejected") state.decisions[id] = d;
    const p = saved.projects && saved.projects[id];
    if (state.decisions[id] === "approved") {
      state.projects[id] = {
        facultyApproved: !!(p && p.facultyApproved === true),
        milestones: cleanMilestones(p && p.milestones),
      };
    }
  });
  return state;
}

/* ---------- applications (yours + the demo ones) ---------- */

function allChallengesFor(st) {
  return CHALLENGES.concat(st.custom);
}

function youMember(skills) {
  return { id: YOU_ID, name: "You", skills: { ...skills } };
}

// Every application as one shape: { id, challengeId, mode, members, mine }
function allApplicationsFor(st) {
  const existing = new Set(allChallengesFor(st).map(c => c.id));
  const seeds = SEED_APPLICATIONS.filter(a => existing.has(a.challengeId)).map(a => ({
    id: a.id,
    challengeId: a.challengeId,
    mode: a.mode,
    members: a.memberIds.map(getStudent).filter(Boolean).map(s => ({ id: s.id, name: s.name, skills: s.skills })),
    mine: false,
  }));
  const mine = Object.entries(st.myApps).filter(([chId]) => existing.has(chId)).map(([chId, app]) => ({
    id: "you-" + chId,
    challengeId: chId,
    mode: app.mode,
    members: [youMember(app.youSkills)].concat(app.memberIds.map(getStudent).filter(Boolean)
      .map(s => ({ id: s.id, name: s.name, skills: s.skills }))),
    mine: true,
  }));
  return mine.concat(seeds);
}

const state = cleanState(loadState());

function persist() {
  saveState(state);
}

function allChallenges() {
  return allChallengesFor(state);
}

function getChallenge(id) {
  return allChallenges().find(c => c.id === id) || null;
}

function allApplications() {
  return allApplicationsFor(state);
}

// Score of an application: fit for one student, coverage for a team.
function appScore(app) {
  const ch = getChallenge(app.challengeId);
  if (!ch) return 0;
  return app.mode === "solo" ? fitScore(app.members[0].skills, ch.required) : teamCoverage(ch.required, app.members);
}

// pending -> approved (by company) -> active (supervisor approved too), or rejected.
function appStatus(app) {
  const d = state.decisions[app.id];
  if (d === "rejected") return "rejected";
  if (d === "approved") return state.projects[app.id] && state.projects[app.id].facultyApproved ? "active" : "approved";
  return "pending";
}

const STATUS_TEXT = { pending: "Waiting for company", approved: "Waiting for supervisor", active: "Active project", rejected: "Not accepted" };

function memberNames(app) {
  return app.members.map(m => m.name).join(", ");
}

/* ===================================================================
   3) Toast messages
   =================================================================== */

// Show a short message. Optional action button (e.g. go to the next portal).
function toast(message, actionText, actionView) {
  const area = byId("toastArea");
  const box = make("div", "toast");
  box.appendChild(icon("fa-circle-check"));
  box.appendChild(make("span", "toast-text", message));

  if (actionText && actionView) {
    const go = makeButton("toast-action", actionText);
    go.appendChild(document.createTextNode(" "));
    go.appendChild(icon("fa-arrow-right"));
    go.addEventListener("click", () => {
      box.remove();
      switchView(actionView);
    });
    box.appendChild(go);
  }

  const close = make("button", "toast-close");
  close.type = "button";
  close.setAttribute("aria-label", "Close message");
  close.appendChild(icon("fa-xmark"));
  close.addEventListener("click", () => box.remove());
  box.appendChild(close);

  area.replaceChildren(box);
  setTimeout(() => { if (box.isConnected) box.remove(); }, 8000);
}

/* ===================================================================
   4) Switching portals + demo guide
   =================================================================== */

const VIEWS = {
  student:   "studentPortal",
  company:   "companyPortal",
  faculty:   "facultyPortal",
  analytics: "analyticsPortal",
};
let currentView = "student";
let dashboardSeen = false; // step 4 is done once the University view was opened

function switchView(view) {
  if (!Object.prototype.hasOwnProperty.call(VIEWS, view)) return; // ignore unknown names
  currentView = view;

  Object.entries(VIEWS).forEach(([name, sectionId]) => {
    byId(sectionId).hidden = name !== view;
  });
  document.querySelectorAll(".tab").forEach(tab => {
    const active = tab.dataset.view === view;
    tab.classList.toggle("active", active);
    if (active) tab.setAttribute("aria-current", "page");
    else tab.removeAttribute("aria-current");
  });

  renderCurrent();
  window.scrollTo({ top: 0 });
}

function renderCurrent() {
  if (currentView === "student") renderStudentPortal();
  if (currentView === "company") renderCompanyPortal();
  if (currentView === "faculty") renderFacultyPortal();
  if (currentView === "analytics") renderAnalyticsPortal();
}

// The 4 steps of the demo, with a "done" mark when the step is finished.
function renderSteps() {
  const mine = allApplications().filter(a => a.mine);
  const steps = [
    { view: "student",   title: "Apply solo or as a team", done: mine.length > 0 },
    { view: "company",   title: "Approve applicants",       done: mine.some(a => ["approved", "active"].includes(appStatus(a))) },
    { view: "faculty",   title: "Approve and track",        done: mine.some(a => appStatus(a) === "active") },
    { view: "analytics", title: "See the dashboard",        done: dashboardSeen },
  ];

  const list = byId("steps");
  list.replaceChildren();
  steps.forEach((s, i) => {
    const li = make("li", "step" + (s.done ? " done" : "") + (s.view === currentView ? " current" : ""));
    const btn = make("button", "step-btn");
    btn.type = "button";
    const num = make("span", "step-num");
    if (s.done) num.appendChild(icon("fa-check"));
    else num.textContent = String(i + 1);
    btn.append(num, make("span", "step-title", s.title));
    if (s.view === currentView) btn.setAttribute("aria-current", "step");
    btn.addEventListener("click", () => switchView(s.view));
    li.appendChild(btn);
    list.appendChild(li);
  });
}

function renderIntro() {
  byId("intro").hidden = state.introHidden;
}

/* ===================================================================
   5) Skill level picker + shared pieces
   =================================================================== */

/*
 * One row per skill with buttons 1-5. Clicking the selected level again clears it.
 * values: object {skill: level}. onChange(skill, level) is called after a change.
 */
function buildSkillPicker(container, values, onChange, disabled) {
  container.replaceChildren();
  SKILLS.forEach(skill => {
    const current = values[skill] || 0;
    const row = make("div", "skill-row" + (current > 0 ? " on" : ""));
    row.appendChild(make("span", "skill-name", skill));

    const levels = make("div", "levels");
    levels.setAttribute("role", "group");
    levels.setAttribute("aria-label", skill + " level");

    for (let lvl = 1; lvl <= MAX_LEVEL; lvl++) {
      const b = make("button", "level" + (current >= lvl ? " filled" : ""), lvl);
      b.type = "button";
      b.setAttribute("aria-pressed", current === lvl ? "true" : "false");
      b.setAttribute("aria-label", skill + " level " + lvl);
      b.disabled = !!disabled;
      b.addEventListener("click", () => {
        onChange(skill, current === lvl ? 0 : lvl); // click again = clear
        // keep keyboard focus on the same button after redraw
        const again = container.querySelector('[aria-label="' + skill + " level " + lvl + '"]');
        if (again) again.focus();
      });
      levels.appendChild(b);
    }
    row.appendChild(levels);
    container.appendChild(row);
  });
}

// Small chips that explain the fit skill by skill.
function buildFitChips(studentSkills, required) {
  const row = make("div", "chips");
  explainFit(studentSkills, required).forEach(x => {
    const names = { met: "fa-check", partial: "fa-arrow-right", missing: "fa-xmark" };
    const chip = make("span", "chip chip-" + x.status);
    chip.title = x.status === "met" ? "Level is enough"
      : x.status === "partial" ? "Has it, but a higher level is needed" : "Missing";
    chip.append(icon(names[x.status]), document.createTextNode(" " + x.skill + " " + x.has + "/" + x.need));
    row.appendChild(chip);
  });
  return row;
}

// Score badge: "86% fit" for one student, "86% coverage" for a team.
function scoreBadge(score, kind) {
  const b = make("span", "badge" + (score < LOW_FIT ? " badge-low" : ""), score + "% " + (kind || "fit"));
  b.title = kind === "coverage"
    ? "How much of the required skill points the team covers together"
    : "Share of the required skill points this person covers";
  return b;
}

function companyLine(ch) {
  const company = getCompany(ch.companyId);
  const text = company ? company.name + " · " + company.sector : "";
  const line = make("span", "meta", text);
  if (ch.custom) line.appendChild(make("span", "tag", "New"));
  return line;
}

function statusPill(status) {
  return make("span", "pill pill-" + status, STATUS_TEXT[status]);
}

function progressBar(pct, label) {
  const bar = make("div", "bar");
  bar.setAttribute("role", "progressbar");
  bar.setAttribute("aria-valuemin", "0");
  bar.setAttribute("aria-valuemax", "100");
  bar.setAttribute("aria-valuenow", String(pct));
  bar.setAttribute("aria-label", label);
  const fill = make("div", "bar-fill");
  fill.style.width = clamp(pct, 0, 100) + "%";
  bar.appendChild(fill);
  return bar;
}

// One line per member with the skill points they bring.
function memberList(ch, members) {
  const box = make("div", "members");
  const team = formBalancedTeam(ch.required, [], members.length, members).team;
  team.forEach(m => {
    const row = make("div", "member");
    const name = make("span", "member-name", m.name);
    const skills = make("span", "member-skills", Object.entries(m.skills).map(([s, v]) => s + " " + v).join(", "));
    const left = make("div", "member-who");
    left.append(name, skills);
    const pts = make("span", "member-pts", "+" + m.contribution + " pts");
    pts.title = "Required skill points this member adds";
    row.append(left, pts);
    box.appendChild(row);
  });
  return box;
}

/* ===================================================================
   6) Student portal: apply solo or build a team
   =================================================================== */

let draft = null; // team being built: { chId, memberIds: [] }

function renderStudentPortal() {
  buildSkillPicker(byId("skillsEditor"), state.mySkills, (skill, level) => {
    if (level > 0) state.mySkills[skill] = level;
    else delete state.mySkills[skill];
    persist();
    renderStudentPortal();
  }, false);

  renderApplications();
  renderChallengeList();
  renderSteps();
}

function renderChallengeList() {
  const list = byId("challengesList");
  list.replaceChildren();

  if (!hasAnySkill(state.mySkills)) {
    const empty = make("div", "empty");
    empty.appendChild(icon("fa-circle-info"));
    empty.appendChild(make("p", "", "Pick a level for at least one skill to see how well each challenge fits you."));
    list.appendChild(empty);
    return;
  }

  allChallenges()
    .map(ch => ({ ch, score: fitScore(state.mySkills, ch.required) }))
    .sort((a, b) => b.score - a.score)
    .forEach(({ ch, score }) => {
      const card = make("article", "item");

      const top = make("div", "item-top");
      const info = make("div", "item-info");
      info.append(companyLine(ch), make("h3", "", ch.title));
      if (ch.description) info.appendChild(make("p", "desc", ch.description));
      top.append(info, scoreBadge(score, "fit"));
      card.append(top, buildFitChips(state.mySkills, ch.required));

      if (state.myApps[ch.id]) card.appendChild(appliedBox(ch));
      else if (draft && draft.chId === ch.id) card.appendChild(teamBuilder(ch));
      else card.appendChild(applyActions(ch, score));

      list.appendChild(card);
    });
}

// Buttons for a challenge you have not applied to yet.
function applyActions(ch, score) {
  const actions = make("div", "item-actions");
  if (score === 0) {
    actions.appendChild(make("span", "status status-muted", "None of your skills match. A team could cover it."));
  } else if (score < LOW_FIT) {
    actions.appendChild(make("span", "status status-warn", "Low fit. A team can cover the rest."));
  }

  const team = makeButton("btn btn-ghost btn-small", "Build a team", "fa-people-group");
  team.addEventListener("click", () => {
    draft = { chId: ch.id, memberIds: [] };
    renderChallengeList();
  });
  actions.appendChild(team);

  const solo = makeButton("btn btn-primary btn-small", "Apply solo", "fa-user");
  solo.disabled = score === 0;
  if (score === 0) solo.title = "You need at least one required skill to apply solo";
  solo.addEventListener("click", () => submitApplication(ch, "solo", []));
  actions.appendChild(solo);
  return actions;
}

function submitApplication(ch, mode, memberIds) {
  state.myApps[ch.id] = { mode, memberIds: [...memberIds], youSkills: { ...state.mySkills } };
  draft = null;
  persist();
  renderStudentPortal();
  byId("companySelect").value = ch.companyId; // open the right company next
  toast(mode === "solo" ? "Applied solo. Next, the company reviews it." : "Team application sent. Next, the company reviews it.",
    "Go to Company", "company");
}

// Inline team builder: you + up to 3 teammates.
function teamBuilder(ch) {
  const box = make("div", "builder");
  const members = [youMember(state.mySkills)].concat(draft.memberIds.map(getStudent).filter(Boolean));
  const coverage = teamCoverage(ch.required, members);

  const head = make("div", "builder-head");
  head.append(make("h4", "", "Your team"), scoreBadge(coverage, "coverage"));
  box.appendChild(head);
  box.appendChild(progressBar(coverage, "Team skill coverage"));

  // members with the points they add + remove button
  const withPts = formBalancedTeam(ch.required, [], members.length, members).team;
  withPts.forEach(m => {
    const row = make("div", "member");
    const left = make("div", "member-who");
    left.append(make("span", "member-name", m.name),
      make("span", "member-skills", Object.entries(m.skills).map(([s, v]) => s + " " + v).join(", ") || "No skills yet"));
    row.appendChild(left);
    row.appendChild(make("span", "member-pts", "+" + m.contribution + " pts"));
    if (m.id !== YOU_ID) {
      const rm = make("button", "icon-btn icon-btn-small");
      rm.type = "button";
      rm.setAttribute("aria-label", "Remove " + m.name);
      rm.appendChild(icon("fa-xmark"));
      rm.addEventListener("click", () => {
        draft.memberIds = draft.memberIds.filter(id => id !== m.id);
        renderChallengeList();
      });
      row.appendChild(rm);
    }
    box.appendChild(row);
  });

  // add a teammate: students sorted by the points they would add
  const full = draft.memberIds.length >= TEAM_SIZE - 1;
  const controls = make("div", "builder-controls");
  if (!full) {
    const remaining = {};
    Object.entries(ch.required).forEach(([skill, need]) => {
      const sum = members.reduce((t, m) => t + (Number(m.skills[skill]) || 0), 0);
      remaining[skill] = Math.max(0, need - sum);
    });
    const options = STUDENT_POOL.filter(s => !draft.memberIds.includes(s.id)).map(s => {
      const adds = Object.entries(remaining).reduce((t, [skill, need]) => t + Math.min(need, Number(s.skills[skill]) || 0), 0);
      return { s, adds };
    }).sort((a, b) => b.adds - a.adds);

    const select = make("select", "select select-small");
    select.setAttribute("aria-label", "Add a teammate");
    options.forEach(({ s, adds }) => {
      const opt = make("option", "", s.name + " · adds " + adds + " pts");
      opt.value = s.id;
      select.appendChild(opt);
    });
    const add = makeButton("btn btn-ghost btn-small", "Add", "fa-plus");
    add.addEventListener("click", () => {
      if (!getStudent(select.value) || draft.memberIds.includes(select.value)) return;
      draft.memberIds.push(select.value);
      renderChallengeList();
    });
    controls.append(select, add);
  } else {
    controls.appendChild(make("span", "hint", "Team is full (" + TEAM_SIZE + " members)."));
  }

  const suggest = makeButton("btn btn-ghost btn-small", "Suggest a balanced team", "fa-wand-magic-sparkles");
  suggest.title = "Picks the students who complete your missing skills";
  suggest.addEventListener("click", () => {
    const result = formBalancedTeam(ch.required, STUDENT_POOL.map(s => ({ id: s.id, name: s.name, skills: s.skills })),
      TEAM_SIZE, [youMember(state.mySkills)]);
    draft.memberIds = result.team.filter(m => m.id !== YOU_ID).map(m => m.id);
    renderChallengeList();
  });
  controls.appendChild(suggest);
  box.appendChild(controls);

  const actions = make("div", "item-actions");
  const cancel = makeButton("btn btn-ghost btn-small", "Cancel");
  cancel.addEventListener("click", () => { draft = null; renderChallengeList(); });
  const send = makeButton("btn btn-primary btn-small", "Apply as a team", "fa-paper-plane");
  send.disabled = draft.memberIds.length === 0;
  if (send.disabled) send.title = "Add at least one teammate";
  send.addEventListener("click", () => submitApplication(ch, "team", draft.memberIds));
  actions.append(cancel, send);
  box.appendChild(actions);
  return box;
}

// What you sent for this challenge and where it stands.
function appliedBox(ch) {
  const app = allApplications().find(a => a.mine && a.challengeId === ch.id);
  const status = appStatus(app);
  const box = make("div", "item-actions");
  const text = app.mode === "solo" ? "Applied solo" : "Applied with " + app.members.slice(1).map(m => m.name).join(", ");
  box.appendChild(make("span", "status status-muted", text));
  box.appendChild(statusPill(status));
  if (status === "pending" || status === "rejected") {
    const withdraw = makeButton("btn btn-ghost btn-small", status === "rejected" ? "Apply again" : "Withdraw");
    withdraw.addEventListener("click", () => {
      delete state.myApps[ch.id];
      delete state.decisions[app.id];
      delete state.projects[app.id];
      persist();
      renderStudentPortal();
      if (status === "pending") toast("Application withdrawn.");
    });
    box.appendChild(withdraw);
  }
  return box;
}

// Your applications and their progress.
function renderApplications() {
  const box = byId("applicationsList");
  box.replaceChildren();

  const mine = allApplications().filter(a => a.mine);
  if (mine.length === 0) {
    box.appendChild(make("p", "muted", "You have not applied yet."));
    return;
  }

  mine.forEach(app => {
    const ch = getChallenge(app.challengeId);
    const status = appStatus(app);
    const row = make("div", "app-row");
    const head = make("div", "app-head");
    head.append(make("span", "app-title", ch.title),
      make("span", "hint", app.mode === "solo" ? "Solo" : "Team of " + app.members.length));
    row.appendChild(head);

    if (status === "rejected") {
      row.appendChild(statusPill(status));
    } else {
      const stage = { pending: 1, approved: 2, active: 3 }[status];
      const track = make("ol", "mini-track");
      track.setAttribute("aria-label", "Application status");
      ["Applied", "Company approved", "Active"].forEach((label, i) => {
        track.appendChild(make("li", i < stage ? "on" : "", label));
      });
      row.appendChild(track);
    }
    box.appendChild(row);
  });
}

/* ===================================================================
   7) Company portal: post challenges + approve applicants
   =================================================================== */

function initCompanySelect() {
  const select = byId("companySelect");
  select.replaceChildren();
  COMPANIES.forEach(c => {
    const opt = make("option", "", c.name);
    opt.value = c.id;
    select.appendChild(opt);
  });
  select.addEventListener("change", () => {
    openChallengeForm(false);
    renderCompanyPortal();
  });
}

function selectedCompanyId() {
  const value = byId("companySelect").value;
  return getCompany(value) ? value : COMPANIES[0].id;
}

function renderCompanyPortal() {
  const companyId = selectedCompanyId();
  const container = byId("companyChallenges");
  container.replaceChildren();

  const list = allChallenges().filter(ch => ch.companyId === companyId);
  if (list.length === 0) {
    const empty = make("div", "empty panel");
    empty.appendChild(icon("fa-circle-info"));
    empty.appendChild(make("p", "", "This company has no challenges yet. Post one to start receiving applications."));
    container.appendChild(empty);
  }

  list.forEach(ch => container.appendChild(buildChallengeBoard(ch)));
  renderSteps();
}

function buildChallengeBoard(ch) {
  const board = make("article", "panel board");

  // ---- challenge ----
  const info = make("div", "item-info");
  info.append(companyLine(ch), make("h2", "", ch.title));
  if (ch.description) info.appendChild(make("p", "desc", ch.description));
  const req = make("div", "chips");
  req.appendChild(make("span", "chips-label", "Needs"));
  Object.entries(ch.required).forEach(([skill, level]) => {
    req.appendChild(make("span", "chip chip-need", skill + " " + level));
  });
  info.appendChild(req);
  board.appendChild(info);

  // ---- applicants ----
  const apps = allApplications().filter(a => a.challengeId === ch.id)
    .map(a => ({ a, score: appScore(a) }))
    .sort((x, y) => (y.a.mine - x.a.mine) || (y.score - x.score));

  const head = make("div", "col-head");
  const pending = apps.filter(x => appStatus(x.a) === "pending").length;
  head.append(make("h3", "", "Applicants"), make("span", "hint", apps.length + " applications · " + pending + " waiting"));
  board.appendChild(head);

  if (apps.length === 0) {
    board.appendChild(make("p", "muted", "No applications yet. Students see this challenge in their portal."));
  }

  const list = make("div", "applicants");
  apps.forEach(({ a, score }) => list.appendChild(applicantRow(ch, a, score)));
  board.appendChild(list);
  return board;
}

function applicantRow(ch, app, score) {
  const status = appStatus(app);
  const row = make("div", "applicant" + (app.mine ? " applicant-you" : "") + " applicant-" + status);

  const top = make("div", "applicant-top");
  const who = make("div", "applicant-who");
  const title = make("span", "applicant-name");
  title.append(icon(app.mode === "solo" ? "fa-user" : "fa-people-group"),
    document.createTextNode(" " + (app.mode === "solo" ? app.members[0].name : "Team: " + memberNames(app))));
  if (app.mine) title.appendChild(make("span", "tag", "Your application"));
  who.appendChild(title);
  who.appendChild(make("span", "hint", app.mode === "solo" ? "Applied solo" : app.members.length + " members"));
  top.append(who, scoreBadge(score, app.mode === "solo" ? "fit" : "coverage"));
  row.appendChild(top);

  row.appendChild(memberList(ch, app.members));

  const actions = make("div", "item-actions");
  if (status === "pending") {
    const reject = makeButton("btn btn-ghost btn-small", "Reject", "fa-xmark");
    reject.addEventListener("click", () => {
      state.decisions[app.id] = "rejected";
      delete state.projects[app.id];
      persist();
      renderCompanyPortal();
      toast("Application rejected.");
    });
    const approve = makeButton("btn btn-primary btn-small", "Approve", "fa-check");
    approve.addEventListener("click", () => {
      state.decisions[app.id] = "approved";
      state.projects[app.id] = { facultyApproved: false, milestones: newMilestones() };
      persist();
      renderCompanyPortal();
      toast("Approved. Next, the supervisor approves the project.", "Go to Supervisor", "faculty");
    });
    actions.append(reject, approve);
  } else {
    actions.appendChild(statusPill(status));
    if (status === "rejected" || status === "approved") {
      const undo = makeButton("btn btn-ghost btn-small", "Undo");
      undo.title = "Move the application back to waiting";
      undo.addEventListener("click", () => {
        delete state.decisions[app.id];
        delete state.projects[app.id];
        persist();
        renderCompanyPortal();
      });
      actions.appendChild(undo);
    }
  }
  row.appendChild(actions);
  return row;
}

/* ---------- Post a challenge ---------- */

let draftSkills = {};

function openChallengeForm(open) {
  byId("newChallengePanel").hidden = !open;
  byId("btnNewChallenge").setAttribute("aria-expanded", open ? "true" : "false");
  byId("ncError").textContent = "";
  if (open) {
    draftSkills = {};
    byId("ncTitle").value = "";
    byId("ncDesc").value = "";
    renderDraftSkills();
    byId("ncTitle").focus();
  }
}

function renderDraftSkills() {
  buildSkillPicker(byId("ncSkills"), draftSkills, (skill, level) => {
    if (level > 0) draftSkills[skill] = level;
    else delete draftSkills[skill];
    byId("ncError").textContent = "";
    renderDraftSkills();
  }, false);
}

function saveChallenge() {
  const title = cleanText(byId("ncTitle").value, 80);
  const description = cleanText(byId("ncDesc").value, 200);
  const required = cleanSkills(draftSkills);
  const error = byId("ncError");

  if (title.length < 5) { error.textContent = "Add a title of at least 5 characters."; byId("ncTitle").focus(); return; }
  if (!hasAnySkill(required)) { error.textContent = "Pick a level for at least one required skill."; return; }
  if (state.custom.length >= MAX_CUSTOM) { error.textContent = "This demo keeps up to " + MAX_CUSTOM + " posted challenges. Reset the demo to post more."; return; }

  const ch = cleanCustomChallenge({ id: "u" + Date.now(), companyId: selectedCompanyId(), title, description, required });
  if (!ch) { error.textContent = "Check the fields and try again."; return; }

  state.custom.push(ch);
  persist();
  openChallengeForm(false);
  renderCompanyPortal();
  toast("Challenge posted. Students can now see it and apply.", "Go to Student", "student");
}

/* ===================================================================
   8) Supervisor portal: approve + track stages
   =================================================================== */

function renderFacultyPortal() {
  const container = byId("facultyList");
  container.replaceChildren();

  const projects = allApplications().filter(a => ["approved", "active"].includes(appStatus(a)))
    .sort((x, y) => y.mine - x.mine);

  if (projects.length === 0) {
    const empty = make("div", "empty panel");
    empty.appendChild(icon("fa-circle-info"));
    empty.appendChild(make("p", "", "No projects yet. Once a company approves an application, it appears here."));
    const go = makeButton("btn btn-ghost btn-small", "Go to Company");
    go.addEventListener("click", () => switchView("company"));
    empty.appendChild(go);
    container.appendChild(empty);
    renderSteps();
    return;
  }

  projects.forEach(app => {
    const ch = getChallenge(app.challengeId);
    const status = appStatus(app);
    const card = make("article", "panel project");
    const head = make("div", "project-head");

    const info = make("div", "item-info");
    const who = app.mode === "solo" ? "Solo: " + app.members[0].name : "Team: " + memberNames(app);
    info.append(companyLine(ch), make("h2", "", ch.title),
      make("p", "muted", who + " · " + appScore(app) + "% " + (app.mode === "solo" ? "fit" : "coverage")));
    if (app.mine) info.appendChild(make("span", "tag tag-start", "Your application"));

    const side = make("div", "project-side");
    if (status === "active") {
      const tag = make("span", "pill pill-active pill-big");
      tag.append(icon("fa-check-double"), document.createTextNode(" Active project"));
      side.appendChild(tag);
    } else {
      side.appendChild(statusLine(true, "Company"));
      side.appendChild(statusLine(false, "Supervisor"));
      const btn = makeButton("btn btn-primary btn-small", "Approve project", "fa-signature");
      btn.addEventListener("click", () => {
        state.projects[app.id].facultyApproved = true;
        persist();
        renderFacultyPortal();
        toast("Project is active. Track its stages below.");
      });
      side.appendChild(btn);
    }

    head.append(info, side);
    card.appendChild(head);
    if (status === "active") card.appendChild(buildMilestones(app.id));
    else card.appendChild(make("p", "muted small", "Stages appear once you approve the project."));
    container.appendChild(card);
  });
  renderSteps();
}

function statusLine(isApproved, label) {
  const line = make("div", "approval-line " + (isApproved ? "ok" : "wait"));
  line.appendChild(icon(isApproved ? "fa-circle-check" : "fa-clock"));
  line.appendChild(make("span", "", label));
  line.appendChild(make("strong", "", isApproved ? "Approved" : "Waiting"));
  return line;
}

// Stage tracker with a progress bar. Stages follow their order.
function buildMilestones(appId) {
  const project = state.projects[appId];
  const box = make("div", "milestones");

  const done = project.milestones.filter(m => m.status === "Done").length;
  const pct = Math.round((done / project.milestones.length) * 100);

  const label = make("div", "bar-label");
  label.append(make("span", "", "Progress"), make("strong", "", done + " of " + project.milestones.length + " stages"));
  box.append(label, progressBar(pct, "Project progress"));

  project.milestones.forEach((m, index) => {
    const blocked = index > 0 && project.milestones[index - 1].status !== "Done";
    const row = make("div", "ms-row" + (blocked ? " blocked" : "") + (m.status === "Done" ? " done" : ""));
    const select = make("select", "select select-small");
    select.setAttribute("aria-label", m.name + " status");
    select.disabled = blocked;
    if (blocked) select.title = "Finish the previous stage first";

    MILESTONE_STATUSES.forEach(st => {
      const opt = make("option", "", st);
      opt.value = st;
      opt.selected = m.status === st;
      select.appendChild(opt);
    });

    // Save the new status (only allowed values). Later stages reset if this one is not done.
    select.addEventListener("change", () => {
      if (!MILESTONE_STATUSES.includes(select.value)) return;
      const list = state.projects[appId].milestones;
      list[index].status = select.value;
      enforceMilestoneOrder(list);
      persist();
      box.replaceWith(buildMilestones(appId));
    });

    const num = make("span", "ms-num", index + 1);
    if (m.status === "Done") { num.textContent = ""; num.appendChild(icon("fa-check")); }
    row.append(num, make("span", "ms-name", m.name), select);
    box.appendChild(row);
  });
  return box;
}

/* ===================================================================
   9) University dashboard: stats + 2 charts
   =================================================================== */

const SVG_NS = "http://www.w3.org/2000/svg";

function svgEl(tag, attrs) {
  const el = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, String(v)));
  return el;
}

function statCard(num, label) {
  const card = make("div", "stat");
  card.append(make("span", "stat-num", num), make("span", "stat-label", label));
  return card;
}

function renderAnalyticsPortal() {
  dashboardSeen = true;
  const apps = allApplications();
  const challenges = allChallenges();
  const counts = { pending: 0, approved: 0, active: 0, rejected: 0 };
  apps.forEach(a => { counts[appStatus(a)] += 1; });

  const students = [...STUDENT_POOL];
  if (hasAnySkill(state.mySkills)) students.push({ id: YOU_ID, name: "You", skills: state.mySkills });

  byId("statsRow").replaceChildren(
    statCard(challenges.length, "Challenges"),
    statCard(apps.length, "Applications"),
    statCard(apps.filter(a => a.mode === "team").length, "Team applications"),
    statCard(counts.active, "Active projects")
  );

  renderAppsDonut(counts, apps.length);
  renderSkillsGap(students, challenges);
  renderSteps();
}

// Chart 1: applications by status (donut).
function renderAppsDonut(counts, total) {
  const wrap = byId("appsChart");
  wrap.replaceChildren();

  const parts = [
    { key: "pending",  label: "Waiting for company" },
    { key: "approved", label: "Waiting for supervisor" },
    { key: "active",   label: "Active projects" },
    { key: "rejected", label: "Not accepted" },
  ];

  const svg = svgEl("svg", { viewBox: "0 0 160 160", class: "donut", role: "img",
    "aria-label": "Applications by status: " + parts.map(p => p.label + " " + counts[p.key]).join(", ") });
  const r = 60;
  const c = 2 * Math.PI * r;
  svg.appendChild(svgEl("circle", { cx: 80, cy: 80, r, class: "donut-track" }));

  let offset = 0;
  parts.forEach(p => {
    const n = counts[p.key];
    if (!total || !n) return;
    const len = (n / total) * c;
    const seg = svgEl("circle", {
      cx: 80, cy: 80, r,
      class: "donut-seg seg-" + p.key,
      "stroke-dasharray": len + " " + (c - len),
      "stroke-dashoffset": -offset,
      transform: "rotate(-90 80 80)",
    });
    offset += len;
    svg.appendChild(seg);
  });

  const num = svgEl("text", { x: 80, y: 78, class: "donut-num", "text-anchor": "middle" });
  num.textContent = String(total);
  const lbl = svgEl("text", { x: 80, y: 98, class: "donut-lbl", "text-anchor": "middle" });
  lbl.textContent = "applications";
  svg.append(num, lbl);

  const legend = make("ul", "donut-legend");
  parts.forEach(p => {
    const li = make("li", "");
    li.append(make("span", "dot seg-" + p.key), make("span", "", p.label), make("strong", "", counts[p.key]));
    legend.appendChild(li);
  });

  wrap.append(svg, legend);
}

// Chart 2: skills gap (student level vs. level companies ask for).
function renderSkillsGap(students, challenges) {
  const gaps = computeSkillsGap(students, challenges).filter(g => g.challenges > 0);
  const chart = byId("skillsGapChart");
  chart.replaceChildren();

  const legend = make("div", "legend");
  legend.append(make("span", "lg lg-supply", "Student level"), make("span", "lg lg-demand", "Level companies ask for"));
  chart.appendChild(legend);

  gaps.forEach(g => {
    const row = make("div", "gap-row");
    const label = make("div", "gap-label");
    label.append(make("span", "gap-name", g.skill),
      make("span", g.gap > 0 ? "gap-val gap-pos" : "gap-val gap-ok", g.gap > 0 ? "Gap " + g.gap : "No gap"));

    const bars = make("div", "gap-bars");
    const supply = make("div", "gap-bar supply");
    supply.style.width = (g.avgSupply / MAX_LEVEL) * 100 + "%";
    supply.title = "Student level " + g.avgSupply + " of 5 (" + g.students + " students)";
    const demand = make("div", "gap-bar demand");
    demand.style.width = (g.avgDemand / MAX_LEVEL) * 100 + "%";
    demand.title = "Asked level " + g.avgDemand + " of 5";
    bars.append(supply, demand);

    row.append(label, bars);
    chart.appendChild(row);
  });

  if (gaps.length === 0) chart.appendChild(make("p", "muted", "No challenges yet."));
  chart.appendChild(make("p", "muted small", "Student level is the average of the students who have the skill (1 to 5)."));
}

/* ===================================================================
   10) Start the app
   =================================================================== */

function resetDemo() {
  if (!window.confirm("This deletes your skills, applications, decisions, posted challenges and projects. Continue?")) return;
  clearState();
  Object.assign(state, emptyState());
  draft = null;
  dashboardSeen = false;
  byId("companySelect").value = COMPANIES[0].id;
  openChallengeForm(false);
  renderIntro();
  switchView("student");
  toast("Demo reset.");
}

function init() {
  // Connect buttons (no onclick in HTML, safer with our security rule).
  document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => switchView(tab.dataset.view));
  });
  byId("brandLink").addEventListener("click", e => { e.preventDefault(); switchView("student"); });
  byId("btnReset").addEventListener("click", resetDemo);

  byId("btnStartDemo").addEventListener("click", () => {
    state.introHidden = true;
    persist();
    renderIntro();
    switchView("student");
    const first = byId("skillsEditor").querySelector("button");
    if (first) first.focus();
  });
  byId("btnHideIntro").addEventListener("click", () => {
    state.introHidden = true;
    persist();
    renderIntro();
  });

  byId("btnNewChallenge").addEventListener("click", () => openChallengeForm(byId("newChallengePanel").hidden));
  byId("btnCancelChallenge").addEventListener("click", () => openChallengeForm(false));
  byId("btnSaveChallenge").addEventListener("click", saveChallenge);
  ["ncTitle", "ncDesc"].forEach(id => byId(id).addEventListener("input", () => { byId("ncError").textContent = ""; }));

  initCompanySelect();
  renderIntro();
  switchView("student");

  // Signature in the browser console.
  console.info("Wakib | واكِب — (c) 2026 Aseel. All rights reserved.");
}

init();
