# Shed Games server

A small backend for the Shed Games site. It stores the leaderboard, queue,
and match count in a JSON file, and protects admin changes behind a
password-based login.

## What it does

- `GET /api/state` — public, returns the current leaderboard/queue/matches
- `POST /api/signup` — public, adds a player to the queue and leaderboard, and privately logs their email + IP address for the admin
- `POST /api/admin/login` — checks the admin password, sets a login cookie
- `POST /api/admin/logout` — clears the login cookie
- `GET /api/admin/check` — tells the frontend if you're currently logged in
- `GET /api/admin/signup-log` — admin-only, returns every sign-up with its email, IP address, and timestamp
- `PUT /api/admin/state` — admin-only, overwrites the leaderboard/queue/matches (the signup log is kept separately and untouched by this)

## Running it locally (optional, to test before deploying)

1. Install [Node.js](https://nodejs.org) if you don't have it.
2. In this folder, run:
   ```
   npm install
   cp .env.example .env
   ```
3. Open `.env` and set `ADMIN_PASSWORD` and `JWT_SECRET` to real values.
4. Run:
   ```
   npm start
   ```
5. The server runs at `http://localhost:3000`.

## Deploying it for real (Render.com — free tier)

1. Create a GitHub repository and upload this whole `shed-games-server`
   folder to it (separate from your website's repo).
2. Go to [render.com](https://render.com) and sign up (free).
3. Click **New +** → **Web Service**, and connect the GitHub repo you just made.
4. Set:
   - **Build command:** `npm install`
   - **Start command:** `npm start`
5. Under **Environment**, add these environment variables (same names as
   `.env.example`):
   - `ADMIN_PASSWORD` — your real admin password
   - `JWT_SECRET` — a long random string
   - `ALLOWED_ORIGIN` — the exact URL of your published site
     (e.g. `https://yourusername.github.io`)
6. Click **Create Web Service**. Render builds and starts it, then gives you
   a URL like `https://shed-games-server.onrender.com`.

## Connect the frontend to it

Open `shed-games.html`, find the line near the top of the `<script>` that says:

```js
var API_BASE = "https://YOUR-BACKEND-URL.onrender.com";
```

Replace it with your real Render URL, save the file, and re-upload it to
your website's GitHub repo.

## Honest limitations

- Data is stored in a plain JSON file on the server, not a real database.
  This is fine for a small personal project, but on most free hosting tiers
  the filesystem can be reset when the service redeploys or is rebuilt —
  so don't treat it as permanent, back-it-up-nowhere storage. If you outgrow
  this, swap the `loadData`/`saveData` functions in `server.js` for a real
  hosted database (Supabase's free Postgres tier is a common next step).
- Free tiers on Render (and similar hosts) "sleep" the server after periods
  of inactivity, so the first request after a while can take 30–60 seconds
  to wake it back up. That's normal, not a bug.
- `ALLOWED_ORIGIN` must exactly match your site's URL, or the browser will
  block the admin login from working (this is a deliberate security
  restriction called CORS, not a bug to work around by loosening it).
- IP addresses and email addresses are personal data in most privacy laws
  (e.g. GDPR in the EU, similar rules elsewhere). Collecting them for basic
  abuse-prevention on a small personal project is common and low-risk, but
  if you're running this somewhere with real privacy obligations, it's
  worth a short note on the sign-up page saying you log this info and why.
  This isn't legal advice — check your local requirements if you're unsure.
