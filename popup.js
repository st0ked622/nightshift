// NightShift popup logic.
"use strict";

const DEFAULTS = { enabled: true, intensity: 100, disabledSites: [] };

const masterSwitch = document.getElementById("masterSwitch");
const siteSwitch = document.getElementById("siteSwitch");
const siteRow = document.getElementById("siteRow");
const siteHost = document.getElementById("siteHost");
const intensity = document.getElementById("intensity");
const intensityVal = document.getElementById("intensityVal");
const sliderBlock = document.getElementById("sliderBlock");
const note = document.getElementById("note");

let state = { ...DEFAULTS };
let host = null;          // hostname of the active tab, or null if not themable
let themable = false;

// Pages where content scripts can't run, so dark mode won't apply.
function getThemableHost(url) {
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) return null;
    if (u.hostname === "chromewebstore.google.com" || u.hostname === "chrome.google.com") {
      return null; // the Web Store blocks content scripts
    }
    return u.hostname;
  } catch {
    return null;
  }
}

function setSwitch(el, on) {
  el.setAttribute("aria-checked", on ? "true" : "false");
}

function render() {
  setSwitch(masterSwitch, state.enabled);

  // Brightness controls follow the master toggle.
  intensity.value = state.intensity;
  intensityVal.textContent = `${state.intensity}%`;
  intensity.disabled = !state.enabled;
  sliderBlock.style.opacity = state.enabled ? "1" : "0.45";

  if (!themable) {
    siteHost.textContent = "Can't theme this page";
    siteRow.classList.add("muted");
    setSwitch(siteSwitch, false);
  } else {
    siteHost.textContent = host;
    const disabledHere = state.disabledSites.includes(host);
    // The per-site switch reads as "dark on this site": on = not disabled.
    setSwitch(siteSwitch, state.enabled && !disabledHere);
    if (state.enabled) {
      siteRow.classList.remove("muted");
    } else {
      siteRow.classList.add("muted");
    }
  }

  if (!state.enabled) {
    note.textContent = "Dark mode is off everywhere.";
  } else if (!themable) {
    note.textContent = "Browser and Web Store pages can't be changed.";
  } else {
    note.textContent = "";
  }
}

function save() {
  chrome.storage.local.set(state); // content scripts pick this up via onChanged
}

masterSwitch.addEventListener("click", () => {
  state.enabled = !state.enabled;
  save();
  render();
});

siteSwitch.addEventListener("click", () => {
  if (!themable || !state.enabled) return;
  const set = new Set(state.disabledSites);
  if (set.has(host)) set.delete(host);
  else set.add(host);
  state.disabledSites = [...set];
  save();
  render();
});

intensity.addEventListener("input", () => {
  state.intensity = Number(intensity.value);
  intensityVal.textContent = `${state.intensity}%`;
  save();
});

// Bootstrap: load state and the active tab in parallel.
Promise.all([
  new Promise((res) => chrome.storage.local.get(DEFAULTS, res)),
  new Promise((res) => chrome.tabs.query({ active: true, currentWindow: true }, (t) => res(t[0]))),
]).then(([stored, tab]) => {
  state = { ...DEFAULTS, ...stored };
  host = tab ? getThemableHost(tab.url) : null;
  themable = host !== null;
  render();
});
