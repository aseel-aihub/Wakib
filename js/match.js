/*
 * Wakib
 * Author: Aseel
 * (c) 2026 Aseel. All rights reserved.
 * Do not copy or reuse this code or idea without written permission.
 *
 * File: match.js
 * The "brain" of the platform: fit score, explanation, team building, skills gap.
 */

"use strict";

/*
 * Fit score (0 - 100).
 * For every required skill we count how much of the needed level the student has.
 * Example: needs Python 5, student has 4 -> 4 of 5 points.
 * Having MORE than needed does not add extra points.
 * fit = points the student covers / all points the challenge needs.
 */
function fitScore(studentSkills, required) {
  let need = 0;
  let have = 0;
  Object.entries(required).forEach(([skill, level]) => {
    need += level;
    have += Math.min(Number(studentSkills[skill]) || 0, level);
  });
  return need ? Math.round((have / need) * 100) : 0;
}

/*
 * Explain the score, skill by skill.
 * status: "met" (level is enough), "partial" (has it, but lower), "missing" (none).
 */
function explainFit(studentSkills, required) {
  return Object.entries(required).map(([skill, need]) => {
    const has = Number(studentSkills[skill]) || 0;
    let status = "missing";
    if (has >= need) status = "met";
    else if (has > 0) status = "partial";
    return { skill, has, need, status };
  });
}

/*
 * Build a balanced team (greedy method):
 * every round we add the student who fills the biggest part of what is STILL needed.
 * So we get students who complete each other, not 4 people with the same skill.
 *
 * Returns: { team, coveragePct, remaining }
 */
function formBalancedTeam(required, candidates, teamSize = 4, startMembers = []) {
  // Keep team size safe (between 1 and 10).
  const size = Math.min(Math.max(parseInt(teamSize, 10) || 4, 1), 10);

  const remaining = { ...required }; // what is still needed
  const pool = [...candidates];      // copy so we don't change the original
  const team = [];

  // Members already in the team (e.g. the student who builds it) come first.
  startMembers.forEach(m => {
    let points = 0;
    SKILLS.forEach(skill => {
      const need = remaining[skill] || 0;
      const has = Number(m.skills[skill]) || 0;
      points += Math.min(need, has);
      if (remaining[skill]) remaining[skill] = Math.max(0, need - has);
    });
    team.push({ id: m.id, name: m.name, skills: { ...m.skills }, contribution: points });
  });

  while (team.length < size && pool.length > 0) {
    let best = null;
    let bestPoints = 0;
    let bestIndex = -1;

    // Check every candidate: how many needed points can they cover?
    pool.forEach((cand, index) => {
      let points = 0;
      SKILLS.forEach(skill => {
        const need = remaining[skill] || 0;
        const has = Number(cand.skills[skill]) || 0;
        points += Math.min(need, has);
      });
      if (points > bestPoints) {
        bestPoints = points;
        best = cand;
        bestIndex = index;
      }
    });

    // Nobody adds anything new -> stop.
    if (!best) break;

    // Reduce what is still needed by what this student brings.
    SKILLS.forEach(skill => {
      if (remaining[skill]) {
        remaining[skill] = Math.max(0, remaining[skill] - (Number(best.skills[skill]) || 0));
      }
    });

    team.push({ id: best.id, name: best.name, skills: { ...best.skills }, contribution: bestPoints });
    pool.splice(bestIndex, 1); // remove from pool
  }

  // Coverage % = how much of the required points the team covers.
  const totalNeed = Object.values(required).reduce((sum, v) => sum + v, 0);
  const totalLeft = Object.values(remaining).reduce((sum, v) => sum + v, 0);
  const coveragePct = totalNeed ? Math.round(((totalNeed - totalLeft) / totalNeed) * 100) : 100;

  return { team, coveragePct, remaining };
}

/*
 * Team coverage (0 - 100): the team's levels are added up per skill,
 * capped at what the challenge needs.
 */
function teamCoverage(required, members) {
  let need = 0;
  let have = 0;
  Object.entries(required).forEach(([skill, level]) => {
    need += level;
    const sum = members.reduce((t, m) => t + (Number(m.skills[skill]) || 0), 0);
    have += Math.min(sum, level);
  });
  return need ? Math.round((have / need) * 100) : 0;
}

/*
 * Skills gap for the University portal.
 * supply  = average level of the students who HAVE this skill (and how many they are).
 * demand  = average level asked by the challenges that need this skill.
 * gap     = demand - supply (positive = students are behind the market).
 */
function computeSkillsGap(students, challenges) {
  return SKILLS.map(skill => {
    const supplyList = students.map(s => Number(s.skills[skill]) || 0).filter(v => v > 0);
    const demandList = challenges.map(c => c.required[skill] || 0).filter(v => v > 0);

    const avg = list => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0);
    const avgSupply = avg(supplyList);
    const avgDemand = avg(demandList);

    return {
      skill,
      students: supplyList.length,
      challenges: demandList.length,
      avgSupply: +avgSupply.toFixed(1),
      avgDemand: +avgDemand.toFixed(1),
      gap: +(avgDemand - avgSupply).toFixed(1),
    };
  }).sort((a, b) => b.gap - a.gap); // biggest gap first
}
