# Repository Overview

The website for [Ducko](https://github.com/ducko-im/ducko), a macOS XMPP client, at `ducko.im`. A single page whose hero recreates Ducko's Contacts and chat windows in HTML, CSS and TypeScript so visitors can try them, plus a German Impressum and a 404 page. Built with [Astro](https://astro.build/), styled with Tailwind CSS v4, hosted on GitHub Pages.

# Technology Stack

- **Static Site Generator**: Astro 7
- **CSS Framework**: Tailwind CSS v4 (CSS-first config in `src/styles/global.css` via `@tailwindcss/vite`, no `tailwind.config.js`; `@tailwindcss/typography` styles the Impressum)
- **Fonts**: Nunito via Astro's Fonts API (Fontsource provider, self-hosted at build). No third-party requests from the browser.
- **Tooling**: ESLint (flat config), Prettier (with the Astro and Tailwind plugins), `astro check`, Vitest
- **Package Manager**: pnpm

# Development Commands

```bash
pnpm install
pnpm dev            # http://localhost:13269; run by an agent it detaches (astro dev stop|status|logs); one per project
pnpm build          # into dist/
pnpm preview        # serves dist/ on the same port; a test instance next to the dev server is a build on 23269
pnpm lint           # pnpm lint:fix
pnpm format:check   # pnpm format
pnpm check          # astro check
pnpm test           # vitest run
```

# Architecture

## The hero (`src/hero/`)

- `types.ts`, `data.ts`: the `HeroState` model and the demo roster and conversations. `initialState()` is the default state.
- `script.ts`, `replies.ts`: what the cast says. `script.ts` holds each conversation's lines by what the visitor's message is about, its beats, sign-off and presence lines, the hooks that pass a plan the visitor mentioned to another conversation, and the storyline. `replies.ts` reads what a message is about (English only) and keeps the reply book. Each conversation says each of its lines at most once per visit, so nothing loops. When no line fits, the reply is the conversation's next beat. A conversation signs off at a goodbye, or once its budget or material runs out.
- `view/`: pure renderers `HeroState → HTML string`, split by region (`renderStatusHeader`, `renderStatusMenu`, `renderContactsList`, `renderChatHeader`, `renderTimeline`, `renderContextMenu`, `renderTabs`, `renderComposer`, titlebars). The server, the client and the lab share them. Every user-typed string goes through `escapeHtml`. Class strings use the `tw` tag so Prettier sorts them. The icons are SF Symbols at the sizes and weights Ducko sets, generated into `symbols.ts` by the fidelity pass's `symbols.swift`. Don't edit that file by hand.
- `store.ts`, `timers.ts`, `engine.ts`: all state changes go through `store.update`. The engine owns them, with two invariants: live messages are appended only via `send` (outgoing), `receive` (incoming) and `replay` (the intro's scripted outgoing lines), and the active conversation changes only via the private `activate`. That way unread counts and the front window get the same bookkeeping on every path. As in Ducko, a message counts as unread unless its conversation is the active one in an open, key chat window. A contact's message gives its chat a background tab and opens a closed chat window behind the key one. A room's message opens nothing. Replies follow the contact's presence. Away and Do Not Disturb read late and answer briefly first, and the next reply brings Do Not Disturb out. An offline contact signs on before the message is delivered. A signed-off contact goes offline for the rest of the visit and never answers again. Composer state (draft, edit) is per conversation. Timers are owned by a conversation id or a name (`hint`, `duck`, `poke`, `presence`, `ambient`, `intro`) and cancelled per owner.
- `scheduler.ts`: the ambient stream. A plan the visitor mentioned in one chat is passed on first. Then the storyline plays once, each step waiting while its conversation is busy with the visitor. Afterwards the stream only changes presence now and then. It is the only thing that pauses (a draft in the input, hidden page, off-screen hero, own status Offline, the intro still playing); the visitor's own message lifecycle never waits on it.
- `intro.ts`: the build-up when the windows first come into view. It starts from `introState()` (visitor offline, roster gray, the visible conversations empty) and plays up to `initialState()` through the engine. Any click in a window or focus on the input skips to the end. Reduced motion skips it, and without JavaScript the server-rendered full state stays.
- `client.ts`: wires the store to the DOM, including the hero icon's Dock-style unread badge and bounce. Once the intro has played out, or at first view under reduced motion, it puts the caret in the key chat window's input unless something else already has focus. Clicking a tab or opening a chat from Contacts puts the caret there too, whatever has focus, since Ducko's message field takes the keyboard when its chat opens. None of this happens on a touch screen, where focus would raise the on-screen keyboard. It repaints a region only when its HTML changed and never repaints the composer, since replacing the textarea would drop its focus and caret. It syncs the textarea instead. The timeline is patched in place (`morph.ts`, keyed by message), so a text selection in an unchanged message survives new messages and receipts.
- Roster and transcript input, as in Ducko: a click on a row selects it, a Command-click on the selected row deselects it, and a double-click, Return, Space on a focused row or a tap opens the chat. While Contacts is key, the arrow keys move the selection. A click in Contacts leaves a text selection in the transcript in place, drawn inactive.
- Menu layers: the status menu and the message context menu render in layers over their windows, because Ducko's menus are windows of their own. A Contacts window fitted to a few rows would clip the status menu, and the context menu reaches past the chat window's edge. `placement.ts` places the context menu where the pointer opened it, as Ducko does, and keeps it on that spot of its bubble while the transcript moves. The lab has no pointer and uses the bubble's center, where the captures click.
- Contacts window height: `client.ts` fits the window to its expanded groups (`contactsWindowHeight`) and slides the rows with the window's edge, as Ducko does. The hero's frame reserves the whole roster's height (`rosterHeight`, set as `--contacts-h`), so collapsing a group never moves the rest of the page.

## Window tokens and appearance

The window colors and shadows are CSS custom properties in `global.css` (`--mac-*`), exposed to Tailwind through `@theme inline` (`bg-window`, `text-secondary-label`, `bg-bubble-out`, …). The text sizes are theme tokens of their own (`--text-mac-*`, used as `text-mac-body` and so on). Dark follows `prefers-color-scheme`; a `data-appearance="light|dark"` attribute on an ancestor overrides it, for both the tokens and the `dark:` variant. The lab and the OG card use it to force an appearance.

Room participant colors in `data.ts` are the ones Ducko's `Color.forNickname` intends: the XEP-0392 hue from the last two bytes of the nickname's SHA-1 (big-endian), as HSLuv with saturation 100 and lightness 50 in light, 65 in dark. Recompute them that way when a nickname changes rather than picking them by eye.

The brand around the windows is the pond: a Tailwind sky gradient matched to the icon, white type, and amber for the primary action. Use Tailwind's sky and amber tokens rather than hex approximations. Light pages such as the Impressum show the pond as a header band instead of coloring their text blue.

## Fidelity manifest and lab

`reference/states.json` lists the window and Dock icon states the ducko repo's `Skills/demo-screenshots` reference mode captures from the real app. `reference/captures/` holds the imported capture run, local only and gitignored, including a copy of the ducko repo's `content.json`, from which `src/hero/fixtures.ts` builds every state. What a state shows changes in the ducko repo's `Skills/demo-screenshots/content.json`, followed by a recapture. It never changes in the fixtures or in the local copy, whose hash the lab checks. The fixtures take each contact's avatar from the hero's roster in `data.ts` by id, so a change to the roster goes with a matching change to that `content.json` and a recapture. `pnpm dev` serves `/lab/`, which validates the capture set and compares every state in difference mode, and `/lab/<id>/` for one state. The lab route returns no paths outside development, so builds contain no lab page and no capture.

The window tokens, the window markup's metrics and the Dock badge in `DockIcon.astro` are tuned against the captures: change them only through a fidelity pass, the project skill `.claude/skills/fidelity-pass/SKILL.md`. `reference/README.md` lists the accepted deviations.

What the windows do on their own follows Ducko as well: a new message, a presence change or a menu gets no animation or effect the app lacks, however small. The site's deliberate extras are the exceptions: the hint bubble for controls that only work in the real app, and the duck easter egg.

## Release info

`src/lib/release.ts` fetches Ducko's Sparkle appcast at build time for the Download link, version and requirements. A failed fetch or parse fails the build rather than publishing a wrong version. The workflow also runs daily to pick up new releases. GitHub disables scheduled workflows after 60 days without repository activity, so re-enable it in the Actions tab if releases stop showing up.

# Important Notes

- Deployment runs through `.github/workflows/deploy.yml` on push to `main`, daily and on demand; pull requests run the checks only. The Pages source must be "GitHub Actions". The workflow pins its actions to commit SHAs, with the version in a comment, so a moved tag cannot change what builds and deploys the site. Bump them by hand.
- `public/og.png` is a screenshot of `/lab/og/`; see `README.md` for regenerating it.
- The app icon ships as `public/app-icon-{128,256,512}.png` and `apple-touch-icon.png`, rendered by `src/components/AppIcon.astro`. They are resized losslessly from `icon/AppIcon.png` in the [design](https://github.com/ducko-im/design) repo with sharp's `keepIccProfile()`, so they keep its Display P3 profile. Don't route it through `astro:assets`: the image service converts to sRGB and drops the profile, which clips the icon's wide-gamut colors and dulls it next to Tailwind's OKLCH colors. `favicon.ico` is converted to sRGB, since ICO readers ignore profiles.
- The sandboxed build needs network access to `raw.githubusercontent.com` (appcast), `api.fontsource.org` and `cdn.jsdelivr.net` (fonts). The Fonts API also binds a local port.
