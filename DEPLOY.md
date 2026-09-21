# Deploy to Hydra gallery (today)

## Repo (hosted)

- https://github.com/egrojMonroy/hydra-electromagnetic-field
- Patch CDN: https://cdn.jsdelivr.net/gh/egrojMonroy/hydra-electromagnetic-field@main/electromagneticfield.js

## Upload steps (2 minutes)

1. Open https://hydra.ojack.xyz
2. Clear the editor, paste **exactly** this:

```js
// Electromagnetic Field — 3D magnetic dipoles for Hydra
// Audio (mic) = field amount | 4-min magnet choreography | keys 1–4 | mouse tilt
await loadScript("https://cdn.jsdelivr.net/gh/egrojMonroy/hydra-electromagnetic-field@main/electromagneticfield.js")
```

3. Press **Ctrl+Shift+Enter** (allow microphone)
4. Wait until field lines appear
5. Click **upload to gallery** (toolbar)
6. Copy the new URL — it will look like `https://hydra.ojack.xyz/?sketch_id=...`

That `sketch_id` URL is your public gallery link.

## If loadScript fails

Paste the full contents of `electromagneticfield.js` into the editor instead, then upload.
