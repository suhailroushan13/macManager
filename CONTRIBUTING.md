# Contributing to macManager

Thanks for considering a contribution. This is a macOS-only local file manager / storage
analyzer built with Next.js. This doc covers how the codebase is organized, what each feature
actually does under the hood, how to propose changes, and an open TODO list of what's left to
build.

By participating, you agree to follow the [Code of Conduct](./CODE_OF_CONDUCT.md).

## Getting set up

See the [README](./README.md#setup--clone-and-run-on-your-mac) for clone/install/run steps.
You need macOS — the app shells out to `diskutil`, `df`, `ioreg`, and `osascript`/Finder, so it
cannot run on Linux/Windows/CI containers for anything beyond typecheck/lint/unit tests.

Before opening a PR, run:

```bash
npm run lint
npx tsc --noEmit -p .
npm test
npm run build
```

## How the codebase is organized

```
src/
  app/api/        # route handlers — thin, validate input, call server/ services
  server/fs/       # all node:fs / child_process access lives here, nowhere else
  server/db/       # MongoDB client + bounded persistence (never full/unbounded)
  hooks/           # React Query hooks — one per server capability
  store/           # Zustand, localStorage-persisted UI-only state
  features/        # one folder per screen/feature, composed of components + hooks
  lib/             # pure functions (formatting, categorization, dev-folder rules) + tests
```

**Rule of thumb:** if it touches the filesystem or a child process, it belongs in
`server/fs/*`. If it's UI preference (theme, units, filters, favorites), it belongs in the
Zustand store (`localStorage`). If it's server-computed data that should survive a restart
(scan results, folder sizes), it belongs in MongoDB via `server/db/*` — and it must stay
**bounded**: capped run history, capped roots, batched upserts, never an unbounded per-file
collection. Don't add a new unbounded collection without a pruning strategy.

## In-depth feature breakdown

### Scan engine (`src/server/fs/scanner.ts`)
Iterative (non-recursive, queue-based) filesystem walker, pinned to `globalThis` so it survives
Next.js dev-server hot reloads. Two modes:
- **`full`** — walks everything from the given root, classifying every file (category,
  extension) and every directory (size, file count, dev-folder category if applicable),
  accumulating sizes up through every ancestor folder.
- **`rescan`** — loads the previously stored folder index for the root, compares each
  directory's mtime against the stored value, and reuses the stored aggregate for any subtree
  that hasn't changed — skipping the walk entirely for unchanged folders. Changed folders are
  re-walked and their ancestors' aggregates updated.

Progress (files scanned, current path, errors, mode, folders reused) is exposed live via
`useScanResult()`, polled every second while a scan is running.

### Persistent folder index (`src/server/db/folder-index.ts`)
Folder-level aggregates (name, path, parent, size, file count, category breakdown, last
indexed time) are upserted — never appended — so repeated scans don't grow the collection.
Distinct roots are capped (`MAX_STORED_ROOTS`); the oldest are pruned. This is what makes
"Refresh" instant (reads straight from Mongo, no rescan) while "Rescan" stays incremental.

### Developer folder classification (`src/lib/dev-folders.ts`)
Pure, name-based classification (`node_modules`, `dist`, `.next`, `.cache`, `venv`, etc.) into
Dependencies / Build Output / Cache / Virtual Environments. **Never used to skip scanning** —
only to categorize and to drive UI-only hide filters (`src/store/settings-store.ts`) and the
large-dependency warning (`LARGE_DEPENDENCY_WARNING_BYTES`).

### Duplicate finder (`src/server/fs/*`, `useStartDuplicates`)
Three-stage pipeline: group by exact size → partial hash (first N bytes) to eliminate
false positives cheaply → full hash within a byte budget for the remaining candidates.
Groups exceeding the hash budget are reported as "sampled match" rather than silently wrong.

### Battery (`src/server/fs/battery.ts`, `src/hooks/use-animated-percentage.ts`)
Reads `AppleSmartBattery` via `ioreg`. Time estimates are sanity-clamped (macOS reports
`65535`/garbage values when an estimate isn't ready yet or was just unplugged). The displayed
percentage animates cosmetically (ticks forward, never backward, synced across every widget via
a single shared global ticker) at a rate derived from `SECONDS_PER_PERCENT` in
`src/lib/battery-timing.ts` — this is a **visual approximation**, not a second data source.

### File operations (`src/server/fs/operations.ts`)
Open / reveal in Finder / open Terminal / rename are plain `execFile`/`fs` calls. **Trash is
never a permanent delete** — it goes through Finder's `move ... to trash` AppleScript verb
(chosen over `delete` + `POSIX file`/`alias` coercion, both of which have macOS-version-specific
failure modes with certain filenames — see the comments in `operations.ts` before changing this).

## Proposing changes

1. Open an issue first for anything non-trivial (new feature, architecture change) so we can
   agree on the approach before code is written.
2. Keep PRs focused — one feature/fix per PR.
3. Match existing patterns: React Query hooks for server data, Zustand for UI-only prefs, bounded
   Mongo persistence for anything server-computed that needs to survive a restart.
4. No new abstractions/config flags for hypothetical future needs — build what's asked for.
5. Add/update tests for `lib/` changes (`vitest`). UI changes should be manually verified in a
   browser (dev server) before marking a PR ready.

## TODO / roadmap

Rough, unordered list of things that are known-missing or explicitly descoped so far — pick
one up, or propose your own.

### Persistence / scanning
- [ ] Live background file watching (chokidar) — currently descoped in favor of on-demand
      rescan only; real-time MongoDB updates on create/delete/rename would remove the need to
      click Rescan at all.
- [ ] Detect file *content* changes inside an unchanged-mtime folder during rescan (currently a
      known gap — only directory-entry changes are detected).
- [ ] Per-file MongoDB index (currently folders + aggregates only, by design) as an opt-in mode
      for users who want file-level history/search across restarts.
- [ ] Configurable `MAX_STORED_ROOTS` / retention via Settings UI instead of a hardcoded constant.

### Explorer / Search
- [ ] Multi-select + bulk actions in the Explorer table (currently single-item context menu only).
- [ ] Search across multiple roots at once.
- [ ] Column customization (show/hide/reorder columns) in the Explorer table.

### Duplicates
- [ ] Perceptual/near-duplicate detection for images (currently exact-content only).
- [ ] Per-group "keep newest/oldest" auto-select strategies beyond "all but first".

### Developer folders
- [ ] Per-project "clean node_modules" action (trash all `node_modules` under a chosen root in
      one click, with a confirmation showing total reclaimed space).
- [ ] Package-manager–aware size breakdown (npm vs pnpm vs yarn store, since pnpm dedupes).

### Battery / system
- [ ] Historical battery health chart (cycle count / capacity over time) — would need its own
      small time-series collection, bounded/downsampled.
- [ ] CPU/memory/thermal widgets alongside battery on the dashboard.

### General / polish
- [ ] Keyboard shortcuts (navigate, delete, rename, search focus).
- [ ] Drag-and-drop move/copy between Explorer and folder tree.
- [ ] Undo toast for Trash actions (surface the Finder Trash item directly).
- [ ] Multi-window / multi-root scan queue (scan several drives back-to-back without blocking).
- [ ] E2E tests (Playwright) for the golden paths (scan → explore → trash, duplicate scan → trash).
- [ ] CI workflow (lint + typecheck + vitest) on PRs.
- [ ] Windows/Linux support is explicitly out of scope for now — the app leans on macOS-only
      tooling (`diskutil`, `ioreg`, Finder AppleScript) throughout.

If you tackle one of these, update this checklist in the same PR.
