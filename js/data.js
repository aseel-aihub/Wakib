/*
 * Wakib
 * Author: Aseel
 * (c) 2026 Aseel. All rights reserved.
 * Do not copy or reuse this code or idea without written permission.
 *
 * File: data.js
 * All the demo data of the project (skills, students, companies, challenges).
 *
 * NOTE: All names here are FICTIONAL. No real company or partnership.
 */

"use strict";

// The list of skills used everywhere in the platform.
const SKILLS = Object.freeze([
  "Python", "AI / ML", "Cyber Security", "UI / UX Design",
  "Data Analysis", "Cloud Systems", "Project Management", "Business Analysis",
]);

// Skill level goes from 0 (none) to 5 (expert).
const MIN_LEVEL = 0;
const MAX_LEVEL = 5;

// Fictional students. Each one has skills with a level from 1 to 5.
const STUDENT_POOL = Object.freeze([
  { id: "s1", name: "Lama",   skills: { "Data Analysis": 5, "AI / ML": 4, "Business Analysis": 3 } },
  { id: "s2", name: "Faisal", skills: { "Python": 5, "UI / UX Design": 3, "Cloud Systems": 3 } },
  { id: "s3", name: "Noura",  skills: { "UI / UX Design": 5, "Project Management": 4, "Business Analysis": 2 } },
  { id: "s4", name: "Omar",   skills: { "Cyber Security": 5, "Cloud Systems": 4, "Python": 2 } },
  { id: "s5", name: "Sara",   skills: { "Python": 4, "Data Analysis": 4, "UI / UX Design": 2 } },
  { id: "s6", name: "Khalid", skills: { "Project Management": 5, "Business Analysis": 4, "Cloud Systems": 2 } },
  { id: "s7", name: "Reem",   skills: { "AI / ML": 5, "Python": 4, "Data Analysis": 3 } },
  { id: "s8", name: "Yousef", skills: { "Cloud Systems": 5, "Cyber Security": 3, "Python": 3 } },
]);

// Fictional companies.
const COMPANIES = Object.freeze([
  { id: "c1", name: "Manara Energy",  sector: "Energy" },
  { id: "c2", name: "Etisal Secure",  sector: "Cybersecurity" },
  { id: "c3", name: "Najm Logistics", sector: "Logistics" },
]);

// Challenges posted by the companies. "required" = skills + level needed.
const CHALLENGES = Object.freeze([
  {
    id: "ch1", companyId: "c1",
    title: "Predictive maintenance for pipeline valves",
    description: "Use sensor data and machine learning to predict valve failures before they happen.",
    required: { "Python": 5, "AI / ML": 4, "Data Analysis": 4 },
  },
  {
    id: "ch2", companyId: "c2",
    title: "Zero-trust security for edge servers",
    description: "Design and test a zero-trust access model for edge nodes and cloud servers.",
    required: { "Cyber Security": 5, "Cloud Systems": 4 },
  },
  {
    id: "ch3", companyId: "c3",
    title: "Delivery dashboard for small merchants",
    description: "Build a simple dashboard that connects small online shops to local couriers.",
    required: { "UI / UX Design": 4, "Python": 3, "Data Analysis": 3, "Project Management": 2 },
  },
]);

// Project stages, from the proposal to the final report.
const MILESTONE_TEMPLATE = Object.freeze([
  { name: "Proposal" },
  { name: "Requirements and design" },
  { name: "Development" },
  { name: "Testing" },
  { name: "Final report" },
]);

// Fictional applications already sent by other students (solo or as a team).
const SEED_APPLICATIONS = Object.freeze([
  { id: "a1", challengeId: "ch1", mode: "team", memberIds: ["s7", "s5"] },
  { id: "a2", challengeId: "ch1", mode: "solo", memberIds: ["s1"] },
  { id: "a3", challengeId: "ch2", mode: "solo", memberIds: ["s4"] },
  { id: "a4", challengeId: "ch2", mode: "team", memberIds: ["s8", "s6"] },
  { id: "a5", challengeId: "ch3", mode: "team", memberIds: ["s3", "s2", "s5"] },
  { id: "a6", challengeId: "ch3", mode: "solo", memberIds: ["s6"] },
]);

function getStudent(id) {
  return STUDENT_POOL.find(s => s.id === id) || null;
}

// The only allowed milestone statuses (used to check saved data).
const MILESTONE_STATUSES = Object.freeze(["Not started", "In progress", "Done"]);

// Small helper to find a company by its id.
function getCompany(id) {
  return COMPANIES.find(c => c.id === id) || null;
}
