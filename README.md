# calsync

CLI tool that syncs personal Google Calendar events as "Busy" blocks on your work calendar. A self-hosted replacement for Clockwise's calendar sync.

## Features

- **One-way mirror sync** — creates, updates, and deletes blocker events to match your source calendars
- **Multiple source calendars** — sync from as many personal calendars as you want into one work calendar
- **Idempotent** — safe to re-run; only applies diffs
- **Dry run** — preview what would change before syncing
- **Configurable** — customize blocker title, description, sync window, and event filters

## Setup

### 1. Google Cloud credentials

You need an OAuth 2.0 Client ID from Google Cloud Console:

1. Create a project (or use an existing one) at [console.cloud.google.com](https://console.cloud.google.com)
2. Enable the **Google Calendar API**
3. Configure the **OAuth consent screen** (External, add yourself as a test user)
4. Create an **OAuth client ID** (Desktop app) under Credentials
5. Download the JSON file

### 2. Install

```bash
npm install -g calsync-cli
```

Or clone and install locally:

```bash
git clone https://github.com/pedroslopez/calsync-cli.git
cd calsync-cli
npm install && npm run build
npm install -g .
```

### 3. Configure

```bash
# Import your Google Cloud credentials
calsync auth setup ~/Downloads/client_secret_*.json

# Add your Google accounts (opens browser for OAuth)
calsync auth add personal
calsync auth add work

# Set which calendars to sync from and to
calsync source add personal
calsync config set destination work
```

## Usage

```bash
# Preview changes
calsync sync --dry-run

# Run the sync
calsync sync
```

### Managing sources

```bash
calsync source add <account> [--calendar-id <id>]
calsync source list
calsync source remove <account>
```

### Configuration

```bash
calsync config show
calsync config set destination <account>
calsync config set window <days>              # default: 14
calsync config set summary <text>             # default: "Busy"
calsync config set description <text>         # default: "Automatically synced by calsync"
calsync config set skip-allday <true|false>   # default: true
calsync config set skip-declined <true|false> # default: true
```

### Account management

```bash
calsync auth add <name>
calsync auth list
calsync auth remove <name>
```

## How it works

On each `calsync sync` run:

1. Fetches events from all source calendars within the sync window
2. Fetches existing calsync-managed blockers from the destination calendar
3. Computes a diff (create / update / delete)
4. Applies changes to the destination calendar

Blocker events are tracked via `extendedProperties` so calsync never touches events it didn't create. Source events that are all-day or declined are skipped by default.

## Running on a schedule

Pair with cron to keep calendars in sync automatically:

```bash
# Sync every 15 minutes
*/15 * * * * calsync sync >> ~/.config/calsync/sync.log 2>&1
```
