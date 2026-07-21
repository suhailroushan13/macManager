# macManager — Local Disk & File Manager

![macManager dashboard screenshot](https://upload.suhail.app/7d697c1a45134bdf0ffc2a00d99c03d9.jpeg)

A local file manager and storage analyzer for **macOS**. Browse drives, analyze disk usage, hunt down large files and duplicates, and search your filesystem — in a clean, fast dashboard UI with full light/dark theming.

> ⚠️ This app reads (and can delete, via Finder's Trash) files on the machine it runs on. It is built to run **locally on your own Mac only** — do not deploy it as a public-facing service.

---

## Table of contents

- [Features](#features)
- [Stack](#stack)
- [Prerequisites](#prerequisites)
- [Setup — clone and run on your Mac](#setup--clone-and-run-on-your-mac)
- [Environment variables](#environment-variables)
- [Available scripts](#available-scripts)
- [Architecture](#architecture)
- [Notes & limitations](#notes--limitations)
- [Contributing](#contributing)
- [Code of Conduct](#code-of-conduct)
- [License](#license)

---

## Features

- **Dashboard** — total/used/available storage, file and folder counts, per-drive cards with usage bars, storage donut, file-type breakdown, largest-folder charts, and a live battery widget (percentage, cycle count, health, time remaining/to full).
- **Explorer** — browse any drive or folder with a virtualized, sortable table (name, size, type, extension, owner, permissions, modified). Folders-first natural sort, hidden-file toggle, kind/type filters, per-folder sizes.
- **Search** — bounded recursive filename search with contains / starts-with / ends-with / fuzzy / regex modes and case sensitivity, with live result counts.
- **Scan engine** — background recursive disk scan with pause / resume / cancel, live progress (files/s, current folder, errors), category statistics, and largest files/folders aggregation.
- **Incremental rescan** — a dedicated Rescan action compares the filesystem against the last stored index and only re-walks folders that actually changed, instead of a full re-scan.
- **Persistent folder index (MongoDB)** — folder-level sizes and aggregates are stored and pruned automatically (bounded, self-cleaning) so refreshing the app doesn't require a rescan.
- **Developer folders** — `node_modules`, build output (`dist`, `.next`, `build`), caches, and virtual environments are never excluded from scanning, but are classified and shown separately with a dedicated "Largest node_modules"-style page, UI-only hide filters, and a large-dependency warning.
- **Large Files** — top largest files from the last scan, with open / reveal / trash actions.
- **Duplicate Finder** — size + partial-hash + full-hash pipeline groups files with identical content, shows reclaimable space, select-all-but-first, batch trash.
- **Folder tree** — resizable lazy-loading tree pane in the explorer for fast navigation across drives.
- **Saved searches & favorites** — save any search (query, mode, case, root) or folder to the sidebar and re-run/re-open in one click.
- **Report export** — download the last scan as CSV, JSON, or Markdown.
- **SMART health** — per-drive SMART status (resolved through the APFS physical store) and SSD/HDD indicator via `diskutil`.
- **File actions** — open, reveal in Finder, open Terminal here, copy path, rename, favorite folders, move to Trash (via Finder, always recoverable — never a permanent delete).
- **Preview** — images, video, audio, PDF, and text/code preview in a slide-in panel with full metadata.
- **Settings** — light/dark/system theme, decimal (GB) vs binary (GiB) units, hidden-file visibility, developer-folder filters. Preferences persist locally (localStorage).

## Stack

Next.js (App Router, Turbopack) · TypeScript · Tailwind CSS · shadcn/ui · TanStack Table + Virtual · TanStack Query · Zustand · Recharts · MongoDB driver · Node.js filesystem APIs.

## Prerequisites

This app is built for and tested on **macOS only** (it shells out to `diskutil`, `df`, `osascript`/Finder, `ioreg`, etc.). It will not work on Linux or Windows.

You'll need:

- **macOS** (Apple Silicon or Intel)
- **Node.js 20+** — check with `node -v`. Install via [nodejs.org](https://nodejs.org) or `brew install node`.
- **npm** (bundled with Node)
- **Git**
- *(Optional)* **MongoDB** — local install or a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster, only needed if you want scans to persist across restarts.

## Setup — clone and run on your Mac

```bash
# 1. Clone the repo
git clone <this-repo-url>
cd macManager

# 2. Install dependencies
npm install

# 3. (Optional) configure MongoDB persistence
cp .env.example .env.local
# then edit .env.local and set MONGODB_URI — see "Environment variables" below

# 4. Run the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. Click **Scan Disk** to run the first scan (this walks your filesystem, so it can take a while on a large disk the first time).

To run a production build instead:

```bash
npm run build
npm start
```

## Environment variables

Copy `.env.example` to `.env.local` and fill in your own values. See `.env.example` for the full list — currently just `MONGODB_URI`.

| Variable      | Required | Description |
|---------------|----------|-------------|
| `MONGODB_URI` | No       | Connection string for persisting scan/duplicate results across restarts. Without it, the app runs fully in-memory — everything still works, but results reset when the dev server restarts. |

`.env.local` (and all `.env*` files) are already git-ignored — never commit real credentials.

## Available scripts

```bash
npm run dev     # start dev server (Turbopack) — http://localhost:3000
npm run build   # production build
npm start       # serve production build
npm test        # unit tests (vitest)
npm run lint    # eslint
npx tsc --noEmit -p .   # typecheck
```

## Architecture

```
src/
  app/            # routes + API route handlers (thin, validated)
    api/          # drives, list, search, scan, file (preview), ops, locations, battery
  components/
    layout/       # app shell: sidebar, header, status bar
    ui/           # shadcn/ui primitives
  features/       # feature modules: dashboard, explorer, large-files, duplicates, developer, settings, battery
  server/
    fs/           # filesystem services: drives, entries, search, scanner, ops, battery
    db/           # MongoDB client + bounded/self-pruning persistence (results, folder index)
  hooks/          # React Query hooks
  store/          # Zustand persisted settings (localStorage)
  lib/            # pure utilities (formatting, categorization, dev-folder classification) + tests
  types/          # shared domain types
```

Server services are the only code that touches `node:fs`; route handlers validate input and translate domain errors to a consistent `{ code, message }` envelope; the client consumes typed React Query hooks.

## Notes & limitations

- Drive stats come from `df`/`mount`; APFS used-space is computed as total − free to match Finder.
- Scans skip symlinks (no cycles/double counting) and system directories at the root.
- Duplicate detection fully hashes candidate groups within a byte budget; oversized groups are reported as "sampled match".
- Incremental rescan detects changes via directory mtime — a folder's own mtime changes when entries are added/removed/renamed, but not on file *content* changes deep inside an otherwise-unchanged folder. Run a full scan if you need a guaranteed-fresh read.
- MongoDB persistence is deliberately bounded: only folder-level aggregates are stored (not every file), the last N scan/duplicate runs are kept, and old roots are pruned — the database will not grow unbounded.
- macOS only. Battery/SMART/Trash features rely on macOS-specific tools (`ioreg`, `diskutil`, `osascript`+Finder) and will not run elsewhere.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the in-depth feature breakdown, how to propose changes, and the open TODO checklist.

## Code of Conduct

See [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md).

## License

MIT — see [LICENSE](./LICENSE).
