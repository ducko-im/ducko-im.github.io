# Fidelity references

The hero's windows recreate Ducko's Contacts and chat windows. This folder holds what they are compared against.

- `states.json` is the manifest of window and Dock icon states the site can render. Each state has an `id`, the `window` it shows (`contacts`, `chat` or `dock`), the `appearances` to capture, and a `description`. The ducko repo's `Skills/demo-screenshots` reference mode reads it and captures each state from the real app.
- `captures/` holds those captures as `<id>.<appearance>.png`, plus the `capture.json` the capture run writes (its `displayScale` sets the scale the lab shows them at).
- `src/hero/fixtures.ts` builds the hero state for every manifest id. The manifest and the fixtures change together; `src/hero/fixtures.test.ts` fails when they drift apart.

## Comparing

Run `pnpm dev` and open `/lab/`. Each `/lab/<id>/` page renders the window from its fixture at 1× next to the capture. It switches between side-by-side, overlay (with an opacity slider) and difference views, in light or dark (`?appearance=dark`, `?mode=overlay|difference`). A state without a capture shows "No reference captured yet". The lab exists only in development; `pnpm build` emits no lab pages and no captures.
