// NightShift content script.
// Runs at document_start in the top frame, then keeps in sync with chrome.storage.
(() => {
  "use strict";

  const STYLE_ID = "nightshift-style";
  const ON_CLASS = "nightshift-on";
  const root = document.documentElement;

  const DEFAULTS = { enabled: true, intensity: 100, disabledSites: [] };

  function currentHost() {
    return location.hostname || location.href;
  }

  // Build the stylesheet. The whole page is inverted, then media elements are
  // inverted a second time so photos, video and charts look normal again.
  // (iframes are intentionally left alone — the page-level filter already
  // darkens them, and re-inverting would fight the child frame's own script.)
  function buildCss(intensity) {
    const brightness = Math.max(0.4, Math.min(1.6, intensity / 100)).toFixed(2);
    return `
      html.${ON_CLASS} {
        filter: invert(1) hue-rotate(180deg) contrast(0.92) brightness(${brightness}) !important;
        background: #fafafa !important;
      }
      html.${ON_CLASS} img,
      html.${ON_CLASS} video,
      html.${ON_CLASS} picture,
      html.${ON_CLASS} canvas,
      html.${ON_CLASS} embed,
      html.${ON_CLASS} object,
      html.${ON_CLASS} svg image,
      html.${ON_CLASS} [style*="background-image"],
      html.${ON_CLASS} .nightshift-keep {
        filter: invert(1) hue-rotate(180deg) !important;
      }
    `;
  }

  function ensureStyle(intensity) {
    let el = document.getElementById(STYLE_ID);
    if (!el) {
      el = document.createElement("style");
      el.id = STYLE_ID;
      // documentElement always exists at document_start; <head> may not yet.
      root.appendChild(el);
    }
    el.textContent = buildCss(intensity);
  }

  function apply(state) {
    const disabledHere = (state.disabledSites || []).includes(currentHost());
    const on = !!state.enabled && !disabledHere;

    if (on) {
      ensureStyle(state.intensity ?? 100);
      root.classList.add(ON_CLASS);
    } else {
      root.classList.remove(ON_CLASS);
    }
  }

  // First paint: apply as soon as we know the stored state.
  chrome.storage.local.get(DEFAULTS, apply);

  // Live updates: any change from the popup re-applies in every open tab.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    chrome.storage.local.get(DEFAULTS, apply);
  });
})();
