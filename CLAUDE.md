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
pnpm dev            # http://localhost:13269; run by an agent it detaches (astro dev stop|status|logs)
pnpm build          # into dist/
pnpm preview        # same port; a test instance next to the dev server uses 23269
pnpm lint           # pnpm lint:fix
pnpm format:check   # pnpm format
pnpm check          # astro check
pnpm test           # vitest run
```

# Architecture

## The hero (`src/hero/`)

- `types.ts`, `data.ts`: the `HeroState` model and the demo roster, conversations, canned replies and ambient lines. `initialState()` is the default state.
- `view/`: pure renderers `HeroState → HTML string`, split by region (`renderStatusHeader`, `renderContactsList`, `renderChatHeader`, `renderTimeline`, `renderTabs`, `renderComposer`, titlebars). The server, the client and the lab share them. Every user-typed string goes through `escapeHtml`. Class strings use the `tw` tag so Prettier sorts them.
- `store.ts`, `timers.ts`, `engine.ts`: all state changes go through `store.update`. The engine owns them, with two invariants: live messages are appended only via `send` (outgoing), `receive` (incoming) and `replay` (the intro's scripted outgoing lines), and the active conversation changes only via the private `activate`. That way unread counts, selection and the front window get the same bookkeeping on every path. Composer state (draft, edit) is per conversation. Timers are owned by a conversation id or a name (`hint`, `duck`, `poke`, `ambient`, `intro`) and cancelled per owner.
- `scheduler.ts`: the ambient stream (presence changes, sign-ons, background messages). It is the only thing that pauses (input focus, hidden page, off-screen hero, own status Offline, the intro still playing); the visitor's own message lifecycle never waits on it.
- `intro.ts`: the build-up when the windows first come into view. It starts from `introState()` (visitor offline, roster gray, the visible conversations empty) and plays up to `initialState()` through the engine. Any click in a window or focus on the input skips to the end. Reduced motion skips it, and without JavaScript the server-rendered full state stays.
- `client.ts`: wires the store to the DOM, including the hero icon's Dock-style unread badge and bounce. It repaints a region only when its HTML changed and never repaints the composer, since replacing the textarea would drop its focus and caret. It syncs the textarea instead.

## Window tokens and appearance

The window colors, text sizes and shadows are CSS custom properties in `global.css` (`--mac-*`), exposed to Tailwind through `@theme inline` (`bg-window`, `text-secondary-label`, `bg-bubble-out`, …). Dark follows `prefers-color-scheme`; a `data-appearance="light|dark"` attribute on an ancestor overrides it, for both the tokens and the `dark:` variant. The lab and the OG card use it to force an appearance.

The brand around the windows is the pond: a Tailwind sky gradient matched to the icon, white type, and amber for the primary action. Use Tailwind's sky and amber tokens rather than hex approximations. Light pages such as the Impressum show the pond as a header band instead of coloring their text blue.

## Fidelity manifest and lab

`reference/states.json` lists the window and Dock icon states the ducko repo's `Skills/demo-screenshots` reference mode captures from the real app. `src/hero/fixtures.ts` builds each state; the two must change together (`fixtures.test.ts` checks it). `pnpm dev` serves `/lab/` and `/lab/<id>/` to compare a state with its capture in `reference/captures/`. The lab route returns no paths outside development, so builds contain no lab page and no capture. See `reference/README.md`.

## Release info

`src/lib/release.ts` fetches Ducko's Sparkle appcast at build time for the Download link, version and requirements. A failed fetch or parse fails the build rather than publishing a wrong version. The workflow also runs daily to pick up new releases. GitHub disables scheduled workflows after 60 days without repository activity, so re-enable it in the Actions tab if releases stop showing up.

# Important Notes

- Deployment runs through `.github/workflows/deploy.yml` on push to `main`, daily and on demand; pull requests run the checks only. The Pages source must be "GitHub Actions". The workflow pins its actions to commit SHAs, with the version in a comment, so a moved tag cannot change what builds and deploys the site. Bump them by hand.
- `public/og.png` is a screenshot of `/lab/og/`; see `README.md` for regenerating it.
- The app icon ships as `public/app-icon-{128,256,512}.png` and `apple-touch-icon.png`, rendered by `src/components/AppIcon.astro`. They are resized losslessly from `icon/AppIcon.png` in the [design](https://github.com/ducko-im/design) repo with sharp's `keepIccProfile()`, so they keep its Display P3 profile. Don't route it through `astro:assets`: the image service converts to sRGB and drops the profile, which clips the icon's wide-gamut colors and dulls it next to Tailwind's OKLCH colors. `favicon.ico` is converted to sRGB, since ICO readers ignore profiles.
- The sandboxed build needs network access to `raw.githubusercontent.com` (appcast), `api.fontsource.org` and `cdn.jsdelivr.net` (fonts). The Fonts API also binds a local port.
