# ducko-im.github.io

The website for [Ducko](https://github.com/ducko-im/ducko) at [ducko.im](https://ducko.im), built with [Astro](https://astro.build/) and hosted on GitHub Pages.

## Prerequisites

- Node.js 22 (22.22.3+), 24 (24.16+) or 26.3+
- pnpm

## Setup

```bash
pnpm install
pnpm dev
```

Then open http://localhost:13269.

## Scripts

| Script                              | What it does                                |
| ----------------------------------- | ------------------------------------------- |
| `pnpm build`                        | Builds the site into `dist/`                |
| `pnpm preview`                      | Serves the build                            |
| `pnpm lint` / `pnpm lint:fix`       | ESLint                                      |
| `pnpm format:check` / `pnpm format` | Prettier                                    |
| `pnpm check`                        | `astro check` (types and Astro diagnostics) |
| `pnpm test`                         | Vitest                                      |

The build reads Ducko's appcast from GitHub for the download link and fails if it can't.

## Open Graph image

`public/og.png` is a 1200×630 screenshot of the dev-only `/lab/og/` page. With `pnpm dev` running:

```bash
agent-browser set viewport 1200 630
agent-browser open http://localhost:13269/lab/og/
agent-browser screenshot public/og.png
```

## Deployment

The GitHub Actions workflow (`.github/workflows/deploy.yml`) builds and deploys on every push to `main`, daily, and on manual dispatch. Pull requests run lint, format, type check and tests only. In the repository's Pages settings, the source must be "GitHub Actions", the custom domain `ducko.im`, and Enforce HTTPS on.

`ducko.im`'s DNS is at Cloudflare. The apex and `www` are DNS-only CNAMEs to `ducko-im.github.io`, so GitHub Pages can issue the site's certificate itself.
