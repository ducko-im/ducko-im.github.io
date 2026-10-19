# Fidelity references

The hero recreates Ducko's Contacts and chat windows and its Dock icon. This folder holds what they are compared against.

- `states.json` is the manifest of window and Dock icon states the site can render. Each state has an `id`, the `window` it shows (`contacts`, `chat` or `dock`), the `appearances` to capture, and a `description`. The ducko repo's `Skills/demo-screenshots` reference mode reads it and captures each state from the real app.
- `captures/` holds one capture run, imported untouched and kept local (gitignored): `<id>.<appearance>.png` per state, `<id>.<appearance>.menu.png` for open menus, the run's `capture.json`, and the `content.json` it was captured with. Prettier ignores the folder, so `content.json` keeps the SHA-256 that `capture.json` records.
- `motion.json` lists the motion clips to record from the real app: the state each clip starts from, the region to record, and the steps to drive.
- `src/hero/fixtures.ts` builds every state from `captures/content.json`. That file is a copy: the ducko repo's `Skills/demo-screenshots/content.json` owns what each state shows, and a change there needs a recapture.

Run `pnpm dev` and open `/lab/`. It validates the capture set and shows every state in both appearances in difference mode. `/lab/<id>/` compares one state side by side, in overlay or in difference. The lab exists only in development; `pnpm build` emits no lab pages and no captures.

The procedure for a rerun (capture, compare, import, validate, tune, sign off) is the project skill `.claude/skills/fidelity-pass/SKILL.md`.

## Known deviations

These are the accepted differences from the real app. Any other difference the lab shows is a regression.

- **Dock backdrop and running indicator.** The Dock crop holds the Dock's glass and the dot under the icon, which have no web counterpart.
- **Menu fill past the window edge.** Where the context menu reaches past its window, its captured glass shows the capture VM's wallpaper.
- **Text cursor.** A capture of a key chat window with a focused field shows a held caret. The lab draws none.
- **Traffic-light gloss.** A two-stop gradient and an edge stand in for macOS's radial gloss and halo.
- **Menu glass tint.** Over colored content, such as a blue bubble, the app's glass tints more strongly than the web's translucent, blurred fill.
- **Text rasterization.** AppKit draws text slightly heavier than browsers, and pixel snapping leaves offsets of up to 1 pt.
- **Icon snapping.** Browsers snap an SVG to whole CSS pixels, so some icons sit 0.5 pt off the capture. The chat header's icons, the delivery checks and the group chevrons are off vertically. The room header's icons, the status chevron and the close button's hover glyph are off horizontally.
- **Selection highlight.** The highlight behind selected message text sits 0.5 pt below the capture's, because the browser draws it on whole CSS pixels.
- **Menu checkmark.** NSMenu draws its own state mark. The status menu shows the closest SF Symbol from the table in `symbols.swift`, which has its shape but not its exact pixels.
- **Roster while offline.** Ducko empties the contact list while your own status is Offline. The hero keeps it gray, since its intro builds up from a gray roster.

## Not yet compared

No motion is compared yet, because the ducko repo's reference mode can't record clips. `motion.json` lists the clips to record.

The motion Ducko's source defines is ported as is: the Contacts window's resize with its row slide (AppKit's 0.2 s per 150 pt, ease-in-out), the group chevron (0.2 s) and the metadata fade (0.15 s). The clips will check it.

macOS draws the rest, and Ducko's source says nothing about it: menus opening and closing, the Dock bounce and badge, window activation, the chat window opening and closing, and tab close. The clips are what that motion will be tuned against.
