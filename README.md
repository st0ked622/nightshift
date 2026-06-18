# NightShift — Dark Mode for Any Site

A small Chrome extension that turns any website dark. It inverts the page's
colors and re-corrects images and video so photos still look right.

## Install (unpacked)

1. Download [**`nightshift-v1.1.0.zip`**](https://github.com/st0ked622/nightshift/releases/download/v1.1.0/nightshift-v1.1.0.zip),
   or grab the newest build from the
   [**Releases**](https://github.com/st0ked622/nightshift/releases/latest) page.
2. Unzip it.
3. Open `chrome://extensions` in Chrome.
4. Turn on **Developer mode** (top-right).
5. Click **Load unpacked** and select the unzipped `nightshift` folder.
6. Pin the moon icon from the puzzle-piece menu for quick access.

> No download needed if you cloned the repo — just point **Load unpacked** at
> the repo folder.

## Use

Click the icon to open the panel:

- **Dark mode** — master switch for every site.
- **This site** — turn dark mode off for just the site you're on.
- **Brightness** — fine-tune how light or dark inverted pages look.

Changes apply instantly to open tabs.

## How it works

The page is rendered with a CSS `invert` + `hue-rotate` filter, and media
elements (`img`, `video`, `canvas`, etc.) are inverted a second time so they
appear normal. State lives in `chrome.storage`, and the content script
re-applies whenever that storage changes.

## Known limitations

- Sites that already ship a dark theme may look washed out — use **This site**
  to turn NightShift off there.
- Background images set in CSS stylesheets (not inline `style`) are inverted
  along with the page and may look off on some sites.
- Browser pages (`chrome://…`) and the Chrome Web Store can't be themed,
  because extensions aren't allowed to run there.

## Files

| File | Purpose |
| --- | --- |
| `manifest.json` | Extension configuration (Manifest V3) |
| `content.js` | Applies the dark filter, syncs with storage |
| `popup.html` / `popup.js` | The control panel |
| `icons/` | Toolbar and store icons |
