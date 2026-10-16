---
name: fidelity-pass
description: 'Reruns the fidelity pass that keeps the ducko.im hero''s Contacts and chat windows and Dock badge indistinguishable from the real Ducko app: capture new references with the ducko repo''s reference mode, compare them with the previous set, import and validate them in the dev-only /lab/, tune the web windows state by state, and get sign-off. Use when the user asks to "run a fidelity pass", "rerun the fidelity pass", "update the reference captures", "import new captures", "retune the hero after a macOS or Ducko update", "check the hero against the real app", "compare the hero with the reference captures", or "add a state to the fidelity manifest".'
---

# Fidelity Pass

`<ducko>` is the ducko checkout next to this repo, `../ducko`. Make a new work folder under the session scratchpad for this pass and call it `<work>`; it is separate from the `$WORK` folder the ducko skill builds its app copy in. Run commands from the repo root. Run `pnpm dev`, `agent-browser` (`shoot.sh` included), anything else that reaches the dev server, and every `swift` command unsandboxed.

## Step 1: Capture

Follow `<ducko>/Skills/demo-screenshots/SKILL.md`, section "Reference Mode for the Website", R1–R5, with this repo's `reference/states.json` as the manifest. Hand the run's `out` folder over into `<work>/new/` rather than into `reference/captures/`, which Step 2 still needs. Continue once `<work>/new/capture.json` has an empty `skipped[]`.

## Step 2: Compare with the Previous Set

Compare every PNG name on either side:

```bash
mkdir -p <work>/diff
for f in $( (ls reference/captures; ls <work>/new) | grep '\.png$' | sort -u); do
  echo "$f: $(swift <ducko>/Skills/demo-screenshots/scripts/compare.swift reference/captures/$f <work>/new/$f <work>/diff/$f 2>&1)"
done
```

A pair prints its count of differing pixels, "size differs", or "not an image" for a file that exists on one side only. Read the diff PNG of each pair with a nonzero count.

List the states whose pair reports "size differs" or "not an image", or whose diff shows more than text anti-aliasing and the "(edited …)" label. Tuning starts at the listed states. Sign-off still covers every state.

Also `diff` the old and new `capture.json` and `content.json`. They show a changed macOS or Ducko build, changed window sizes and changed content.

## Step 3: Import

`reference/captures/` is gitignored, so `<work>/old/` becomes the only copy of the previous set. Leave the new files exactly as they are: the lab checks `content.json` against the SHA-256 that `capture.json` records, and Prettier ignores `reference/captures/` for that reason. Move the current set aside and copy the new one in:

```bash
mkdir -p <work>/old reference/captures && find reference/captures -maxdepth 1 -type f -exec mv {} <work>/old/ \; && cp <work>/new/* reference/captures/
```

## Step 4: Validate

Start `pnpm dev` (port 13269), or reuse the server this session already started, and open `/lab/`. The validation panel must read "The capture set is complete and valid." An unsupported `content.json` version is fixed in this repo, by the first bullet below. Fix every other listed problem at its source in the ducko repo: rerun the affected states with `--ids`, or hand over again for a wrong pixel size, hash or file. Pull the corrected `out` into `<work>/new/`, run the Step 2 loop over just the changed files against their old copies in `<work>/old/`, and copy them into `reference/captures/`.

Then run each of these that applies:

- **The panel reports an unsupported `content.json` version.** Rework `stateFor` in `src/hero/fixtures.ts` for the new contract (the `content.json` table in the ducko skill) and raise `CONTENT_VERSION`.
- **The `contacts-key` capture's width, or the `chat-key` capture's width or height, differs from `WINDOW_SIZES` in `src/hero/data.ts`** (compare the `size` in `capture.json`, in points). Adopt the widths and the chat height. The Contacts height is not taken from the capture: the hero fits it to its own roster with `contactsWindowHeight` in `src/hero/view/contacts.ts`, and `WINDOW_SIZES.contacts.height` holds the whole roster's height, which `pnpm test` checks. Then run the live-page check from Step 5.

A state whose content no longer resolves shows its error on its `/lab/` card instead of a window. Fix the mapping in `stateFor`, or the ducko repo's `content.json` when the error names a time zone or a missing state entry.

## Step 5: Tune

Work through the regions in this order, light first, then dark: window chrome (corner radius, title bar, traffic lights, key and inactive), Contacts header and rows, group headers, selection, chat header, offline strip, bubbles and metadata, edit bar, composer, tab bar, menus and hovers, Dock badge.

Allowed edits:

- window tokens in `src/styles/global.css`
- classes and markup in `src/hero/view/*.ts`
- the icon table in [symbols.swift](scripts/symbols.swift), never the `src/hero/view/symbols.ts` it generates
- the badge in `src/components/DockIcon.astro`, which the live hero shares
- `src/hero/placement.ts`, for a menu's lift and the position it takes when no pointer opened it, as in the lab
- `src/hero/fixtures.ts` and `types.ts`, only to map `content.json` fields; a difference in what a state shows goes to the ducko repo's `content.json` and a recapture
- `src/hero/data.ts`, for the live hero's own roster and copy
- `WINDOW_SIZES`, only under Step 4's size condition, or its Contacts height when a tuned metric or the live roster changes the whole roster's height

The icons are SF Symbols exported from this Mac. Each table entry names the symbol and the text style or size and weight Ducko's view sets for it. After changing the table, run `swift .claude/skills/fidelity-pass/scripts/symbols.swift src/hero/view/symbols.ts`, then `pnpm format`. The export follows the captures only when this Mac runs the macOS release `capture.json` records, which the generated file's header names. Rerun it once a recapture and this Mac are on the same new release, and leave `symbols.ts` as it is while they differ. AppKit draws some glyphs itself, such as a menu's indicator. Render candidates for one with `swift .claude/skills/fidelity-pass/scripts/symbols.swift --png <work>/candidates <symbol> <point-size> <weight>`, enter the closest in the table, and bring what still differs to Step 6.

Measure rather than eyeball. The PNGs carry the capture display's color profile, so convert the captures to sRGB once per import:

```bash
swift .claude/skills/fidelity-pass/scripts/srgb.swift reference/captures <work>/srgb
```

Menu states come out composited with their menu layers.

After each edit, screenshot the state's web window at 2x and measure it against the capture with [measure.py](scripts/measure.py). It needs Pillow, NumPy and SciPy, and its docstring lists its commands (`boxes`, `scan`, `color`, `zoom`):

```bash
.claude/skills/fidelity-pass/scripts/shoot.sh <work> <id> <appearance>
python3 .claude/skills/fidelity-pass/scripts/measure.py <work> <id> <appearance> boxes <x,y,w,h> [merge]
```

`shoot.sh` uses the agent-browser session named in `AGENT_BROWSER_SESSION`, by default `fidelity-pass`. Export `AGENT_BROWSER_SESSION=fidelity-pass` for this step's other `agent-browser` calls too, so the pass has one session to close.

Read the `zoom` image for shapes and glyphs, and `boxes`, `scan` and `color` for positions, sizes and colors. Keep these in mind while tuning:

- Browsers snap text and SVGs to whole CSS pixels, so a 0.5 pt nudge lands 0 or 1 pt away. Leave residuals of 0.5 pt.
- Fractional border widths don't draw as written: borders of 1.25, 1.5 and 1.75 px all measured like 1 px in the 2x screenshots. For a stroke weight in between, draw the stroke as an inset ring (`inset-ring-[1.5px]`), which is a box-shadow and draws at its written width.
- Sample system colors from the captures. macOS changes them between releases.
- After changing the height of anything above the Contacts list (the title bar and divider in `chrome.ts`, which the chat window shares, or the status header), a group header or a row, update the matching height constant at the top of `src/hero/view/contacts.ts`, or the live window clips or scrolls its list. `pnpm test` then fails until `WINDOW_SIZES.contacts.height` and the row height in that test match again. A changed title bar height also moves the status menu's `top` offset in `renderStatusMenu`.
- Judge a menu's fill only where it lies over its window. Past the window edge, the captured glass shows the capture VM's wallpaper.
- The captures open a menu that appears at the pointer, such as the message context menu, at a fixed position, here the bubble's center. Keep that position the lab's default only, and let the live hero follow the visitor's pointer as the app does, so matching a capture never changes how the live hero responds.
- Bring anything the web cannot reproduce, such as glass or vibrancy, to Step 6 as an open deviation instead of tuning it further.

After each region, screenshot the `/lab/` overview in Chromium and read it, along with the affected states in overlay. The overview is many screens tall: take it with `agent-browser screenshot --full` at a wide viewport and split the image into screen-sized parts to read it. Keep `pnpm test` green.

The overview's difference mode hides shifts of a point or two. Before an edit that changes a shared element's size or metrics, such as an icon's box, count every state's differing pixels into `<work>/counts-before.txt`, and after it into `<work>/counts-after.txt`:

```bash
for pair in $(python3 -c "import json; print(' '.join(f\"{s['id']}.{a}\" for s in json.load(open('reference/states.json'))['states'] for a in s['appearances']))"); do
  .claude/skills/fidelity-pass/scripts/shoot.sh <work> ${pair%.*} ${pair##*.} >/dev/null
  echo "$pair: $(swift <ducko>/Skills/demo-screenshots/scripts/compare.swift <work>/web/$pair.png <work>/srgb/$pair.png 2>&1)"
done > <work>/counts-<before|after>.txt
```

Read the zoom of every state whose count rose, and tune it unless what moved is a residual this step accepts.

The edits also change the live hero. Before sign-off, check the live page `/` in light and dark: no scrolling at 1440×900, 1280×720, 1024×768 and 1024×700; scaled and not scrolling at 1280×600; the 820×1180 layout; the 390×844 phone deck. At every width, the Contacts window fits its expanded groups and shows the whole roster, Rooms included, without scrolling its list.

## Step 6: Sign Off

Output as text: the `/lab/` URL, the validation result, the states Step 2 listed, and the open deviations with what differs in each. Name the entries under "Known deviations" in `reference/README.md` that still apply.

Ask Tobias for two checks in Safari:

- An overlay pass at 50% opacity on every window state and `dock-badge`.
- A Digital Color Meter check, set to sRGB, in side-by-side mode, in both appearances, within ±2 per channel. The color set:
  - incoming and outgoing bubbles
  - row selection, key and inactive
  - text selection highlight, key
  - selected tab fill
  - separator
  - window background and title bar
  - presence dots
  - offline strip
  - Dock badge fill

Then use `AskUserQuestion`: one question whether all states pass (approve all, or name those that look off), and one multi-select question per batch of up to four open deviations, asking which to accept. When an answer carries a remark that raises a difference the questions did not list, add it to the open deviations and ask about it in the next round; a remark is not an acceptance. Tune the states he names and the rejected deviations, then ask again, until every state is approved and every remaining deviation accepted. Record the accepted deviations under "Known deviations" in `reference/README.md`, each with its reason, and drop entries that no longer apply. Then close the pass's browser session with `AGENT_BROWSER_SESSION=fidelity-pass agent-browser close`.

## Extending the Manifest

When the hero gains a state, or adopts a Ducko UI element the captures do not cover, add the state to `reference/states.json` and its content entry to `<ducko>/Skills/demo-screenshots/content.json`, as that skill's "Adding a State" describes. The fixture follows from the content. Map any state field `stateFor` does not handle yet, then capture and run this pass.

`reference/motion.json` lists the motion clips the hero needs from the real app. The ducko reference mode can't record them yet. Once it can, add a recording, measuring and sign-off step for them to this skill, and remove the "Not yet compared" section from `reference/README.md`.
