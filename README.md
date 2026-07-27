# fantasy-football-messager

A Node.js/TypeScript script that sends a WhatsApp group message with the latest Fantasy Premier League table and the changes in league positions, using [Baileys](https://github.com/WhiskeySockets/Baileys).

## Setup

1. `npm install`
2. Copy `.env.example` to `.env` and fill in:
   - `LEAGUE_ID` — from the URL of the league table on fantasy.premierleague.com, e.g. `https://fantasy.premierleague.com/leagues/XXXXX/standings/c`
   - `WHATSAPP_GROUP_INVITE_CODE` — the part after `https://chat.whatsapp.com/` in the group's invite link
3. `npm run login`

A QR code is printed in the terminal — scan it from WhatsApp on your phone (Settings > Linked Devices) to log in. The session is then cached in `auth_info_baileys/` so future runs don't require re-scanning.

Once logged in, `npm start` checks whether the current gameweek's scores are finalized (`finished` and `data_checked` on the FPL API) and, if so and it hasn't already been sent (tracked in `send-state.json`), sends the leaderboard. If the gameweek isn't finalized yet, it logs that and exits without connecting to WhatsApp — this is meant to be run repeatedly (see below) rather than once.

## Scripts

- `npm run login` — one-time (or re-)login to WhatsApp via QR code
- `npm start` — check whether the gameweek is finalized and send if so
- `npm run build` — compile to `dist/`
- `npm run typecheck` — type-check without emitting
- `npm test` — run the test suite

## Running on a schedule (GitHub Actions)

`.github/workflows/send-leaderboard.yml` polls every 15 minutes on Monday/Tuesday evenings UTC (the window scores usually finalize in), plus keeps a Tuesday 07:00 UTC fallback in case the polling schedule is delayed, and supports manual runs via "Run workflow" in the Actions tab. Each run is a no-op (no WhatsApp connection) unless the current gameweek is both finalized and not already sent — `send-state.json` (committed back to the repo, plaintext, just a gameweek number) tracks the last gameweek sent so it's never sent twice.

Because Baileys needs its login session (`auth_info_baileys/`) to persist between runs, and GitHub-hosted runners are ephemeral, the workflow keeps the session in the repo as an **encrypted** tarball (`auth_info_baileys.tar.gz.enc`) — decrypting it at the start of each run and re-encrypting/committing it back at the end (session keys rotate over time). The raw `auth_info_baileys/` folder itself stays gitignored and is never committed in plaintext.

> **Note:** the `data_checked`/`is_current`/`finished` fields this relies on were confirmed against a live `bootstrap-static` response (field names and types match). What hasn't been observed live yet is an actual `is_current: true` gameweek transitioning through to `finished`/`data_checked` both `true`, since the season hasn't started — worth a quick sanity check once a real gameweek finalizes.

### Testing before the season starts

Since no gameweek is `is_current` yet, the normal `npm start` flow will always no-op (correctly). To test the actual WhatsApp send pipeline (Baileys auth, group resolution, message delivery) without waiting for the season:

```
FORCE_SEND=true npm start
```

This bypasses the finalization and already-sent checks and sends immediately using whatever standings data is currently available for `LEAGUE_ID` (likely empty/sparse pre-season). It does **not** write to `send-state.json`, so it can't interfere with the real automated gating later. Only ever set `FORCE_SEND` for a manual local/`workflow_dispatch` run — it's never set in the scheduled workflow, so the cron runs are unaffected.

You can also manually trigger `.github/workflows/send-leaderboard.yml` via "Run workflow" in the Actions tab. Leave "Bypass the finalization/already-sent checks" unchecked to verify the CI plumbing (session decrypt/encrypt, secrets, git push-back) as a no-op, or check it to force a real send through the full deployed pipeline before the season starts.

### One-time setup

1. **Log in locally** (if you haven't already): `npm run login`, scan the QR code. This creates `auth_info_baileys/`.
2. **Generate an encryption passphrase** and keep it somewhere safe:
   ```
   openssl rand -base64 32
   ```
3. **Pack the session** into the encrypted tarball:
   ```
   SESSION_ENCRYPTION_KEY=<passphrase from step 2> npm run session:pack
   ```
   This creates `auth_info_baileys.tar.gz.enc` in the repo root.
4. **Commit and push** that file (it's encrypted, safe to commit even to a public repo, but a private repo is still recommended since the invite code below lets anyone join your group):
   ```
   git add auth_info_baileys.tar.gz.enc
   git commit -m "Add encrypted WhatsApp session"
   git push
   ```
5. **Add repository secrets** (Settings → Secrets and variables → Actions → New repository secret):
   - `SESSION_ENCRYPTION_KEY` — the passphrase from step 2
   - `LEAGUE_ID`
   - `WHATSAPP_GROUP_INVITE_CODE`
6. **Allow the workflow to push**: Settings → Actions → General → Workflow permissions → "Read and write permissions" (needed so it can commit the refreshed session back to the repo).

After that, the scheduled run handles itself. If WhatsApp ever logs the session out (e.g. unlinked from your phone), delete `auth_info_baileys.tar.gz.enc`, repeat steps 1–4 locally, and push the new file.
