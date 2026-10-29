/*
 * Wakib
 * Author: Aseel
 * (c) 2026 Aseel. All rights reserved.
 *
 * File: theme.js
 * Dark / light theme. Loaded in <head> so the page opens in the right theme
 * without flashing. The choice is saved in the browser.
 */

"use strict";

const THEME_KEY = "wakib_theme";
const THEMES = ["dark", "light"];

// Read the saved theme. If nothing saved, follow the device setting.
function getSavedTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (THEMES.includes(saved)) return saved;
  } catch (err) { /* storage blocked: use device setting */ }
  const prefersLight = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
  return prefersLight ? "light" : "dark";
}

// Apply a theme (only the two allowed values).
function applyTheme(theme) {
  if (!THEMES.includes(theme)) return;
  document.documentElement.setAttribute("data-theme", theme);
  const btn = document.getElementById("btnTheme");
  if (btn) {
    const label = theme === "dark" ? "Switch to light theme" : "Switch to dark theme";
    btn.setAttribute("aria-label", label);
    btn.title = label;
  }
}

// Switch between dark and light and save the choice.
function toggleTheme() {
  const now = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
  const next = now === "dark" ? "light" : "dark";
  applyTheme(next);
  try { localStorage.setItem(THEME_KEY, next); } catch (err) { /* ignore */ }
}

// Set the theme right away (before the page is drawn).
applyTheme(getSavedTheme());

// Connect the button when the page is ready.
document.addEventListener("DOMContentLoaded", () => {
  applyTheme(document.documentElement.getAttribute("data-theme") || "dark");
  const btn = document.getElementById("btnTheme");
  if (btn) btn.addEventListener("click", toggleTheme);
});
