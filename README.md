# Mingce App

## Local Run

1. Install dependencies:
   `npm install`
2. Create `.env` (or set env vars in shell), at least:
   - `ADMIN_ENTRY_CODE=your_admin_code`
   - `PORT=3000` (optional)
   - `DB_PATH=./data/game.db` (optional, recommended)
3. Start:
   `npm run dev`

## Zeabur Deployment

Use a Node.js service (or Dockerfile). Recommended Zeabur settings:

- Build command: `npm install && npm run build`
- Start command: `npm run start`
- Port: `3000`

Required environment variables:

- `NODE_ENV=production`
- `ADMIN_ENTRY_CODE=<strong_random_code>`
- `DB_PATH=/data/game.db` (mount this to persistent volume)
- `PORT=3000`

Optional frontend env vars:

- `VITE_API_BASE` (only needed if frontend and backend are on different domains)
- `VITE_API_PROXY_TARGET` (local Vite-only proxy target, default `http://127.0.0.1:3000`)

## Notes

- Server now auto-recovers from corrupted sqlite file by backing it up as:
  `*.corrupt.<timestamp>.bak` and recreating DB.
- In production, if `dist/` is missing, server falls back to Vite middleware mode to keep service alive.

