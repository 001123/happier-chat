# Known Issues

Upstream bugs this project works around, with the local workaround and the condition for removing it.

Each issue has two checkboxes: tick **Fixed upstream** once a release contains the fix, and **Workaround removed**
once the local patch is gone. When both are ticked, move the issue under **Resolved** and shorten it to the
fix version, removal date, and upstream links.

## Open

### `@tanstack/ai-client`: rejoining a run drops the replay's assistant message

- [ ] **Fixed upstream**
- [ ] **Workaround removed**
- **Status:** Open upstream. Not fixed in `1.1.0` (npm `latest` as of 2026-11-07) or on `main`.
- **Symptom:** When a run is rejoined (for example after a reload mid-stream) and the replay starts with
  reasoning, the replayed thinking and every later part land on an assistant message that is no longer in
  the message list, so the answer disappears.
- **Cause:** `chat()` puts `metadata` on every adapter event, so `REASONING_MESSAGE_START` already creates
  the replay's assistant message. The first rebuild trigger (`REASONING_MESSAGE_CONTENT`, `TEXT_MESSAGE_*`,
  …) then calls `dropTrailingInFlightAssistant()`, which removes that new message instead of the hydrated
  one.
- **Workaround:** `patches/@tanstack__ai-client@1.1.0.patch`, registered in `pnpm-workspace.yaml` under
  `patchedDependencies`. It makes `rebuildsAssistantMessage` return `true` for a `REASONING_MESSAGE_START`
  that carries `metadata`, so the hydrated message is dropped before the replay creates its own.
- **Upstream:**
  - [TanStack/ai#1942](https://github.com/TanStack/ai/pull/1942) (open): records the hydrated assistant
    message id before the replay and drops only that message. This fixes the same bug with a different
    approach.
  - [TanStack/ai#1357](https://github.com/TanStack/ai/pull/1357) (merged, shipped in `1.1.0`): a related
    reasoning-first rejoin fix. It does not cover this case.
- **Removal:** After #1942 ships in a release, upgrade, delete the patch file and its `patchedDependencies`
  entry, then retest rejoining a run that starts with reasoning (both readable and encrypted-only).
- **Upgrade note:** The patch key is pinned to the exact version. When `@tanstack/ai-react` pulls a new
  `ai-client`, rename the patch file and key, and check that the patched code is unchanged.

## Resolved

### `@tanstack/devtools-vite`: `intent` bin shadows `@tanstack/intent`

- [x] **Fixed upstream**
- [x] **Workaround removed**
- **Resolution:** Fixed in `0.8.6` (released 2026-10-29), which no longer ships the `intent` bin. On
  2026-11-07 this project bumped to `^0.8.6` and removed `patches/@tanstack__devtools-vite.patch`.
- **Symptom:** `pnpm exec intent` ran the devtools-vite bin and failed with `ERR_PACKAGE_PATH_NOT_EXPORTED`.
- **Upstream:** [TanStack/devtools#525](https://github.com/TanStack/devtools/issues/525),
  fixed by [TanStack/devtools#542](https://github.com/TanStack/devtools/pull/542).
