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

- `types.ts`, `data.ts`: the `HeroState` model and the demo roster, conversations, canned replies and ambient lines. `initialState()` is the default state.
- `view/`: pure renderers `HeroState → HTML string`, split by region (`renderStatusHeader`, `renderStatusMenu`, `renderContactsList`, `renderChatHeader`, `renderTimeline`, `renderContextMenu`, `renderTabs`, `renderComposer`, titlebars). The server, the client and the lab share them. Every user-typed string goes through `escapeHtml`. Class strings use the `tw` tag so Prettier sorts them. The icons are SF Symbols at the sizes and weights Ducko sets, generated into `symbols.ts` by the fidelity pass's `symbols.swift`. Don't edit that file by hand.
- `store.ts`, `timers.ts`, `engine.ts`: all state changes go through `store.update`. The engine owns them, with two invariants: live messages are appended only via `send` (outgoing), `receive` (incoming) and `replay` (the intro's scripted outgoing lines), and the active conversation changes only via the private `activate`. That way unread counts, selection and the front window get the same bookkeeping on every path. Composer state (draft, edit) is per conversation. Timers are owned by a conversation id or a name (`hint`, `duck`, `poke`, `ambient`, `intro`) and cancelled per owner.
- `scheduler.ts`: the ambient stream (presence changes, sign-ons, background messages). It is the only thing that pauses (input focus, hidden page, off-screen hero, own status Offline, the intro still playing); the visitor's own message lifecycle never waits on it.
- `intro.ts`: the build-up when the windows first come into view. It starts from `introState()` (visitor offline, roster gray, the visible conversations empty) and plays up to `initialState()` through the engine. Any click in a window or focus on the input skips to the end. Reduced motion skips it, and without JavaScript the server-rendered full state stays.
- `client.ts`: wires the store to the DOM, including the hero icon's Dock-style unread badge and bounce. It repaints a region only when its HTML changed and never repaints the composer, since replacing the textarea would drop its focus and caret. It syncs the textarea instead.
- Menu layers: the status menu and the message context menu render in layers over their windows, because Ducko's menus are windows of their own. A Contacts window fitted to a few rows would clip the status menu, and the context menu reaches past the chat window's edge. `placement.ts` anchors the context menu to its bubble.
- Contacts window height: `client.ts` fits the window to its expanded groups (`contactsWindowHeight`) and slides the rows with the window's edge, as Ducko does. The hero's frame reserves the whole roster's height, so collapsing a group never moves the rest of the page. `--contacts-h` sets that height on wider screens, and the phone deck's fixed height covers it on phones.

## Window tokens and appearance

The window colors and shadows are CSS custom properties in `global.css` (`--mac-*`), exposed to Tailwind through `@theme inline` (`bg-window`, `text-secondary-label`, `bg-bubble-out`, …). The text sizes are theme tokens of their own (`--text-mac-*`, used as `text-mac-body` and so on). Dark follows `prefers-color-scheme`; a `data-appearance="light|dark"` attribute on an ancestor overrides it, for both the tokens and the `dark:` variant. The lab and the OG card use it to force an appearance.

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
