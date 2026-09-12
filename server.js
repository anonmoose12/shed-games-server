require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const app = express();

// Render (and most hosts) put the app behind a reverse proxy, so without
// this, req.ip would return the proxy's address instead of the visitor's
// real IP.
app.set('trust proxy', true);

const DATA_FILE = path.join(__dirname, 'data.json');
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const JWT_SECRET = process.env.JWT_SECRET;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

if (!ADMIN_PASSWORD || !JWT_SECRET) {
  console.error('Missing ADMIN_PASSWORD or JWT_SECRET environment variables. Set these before starting the server — see .env.example.');
}

app.use(cors({ origin: ALLOWED_ORIGIN, credentials: true }));
app.use(express.json());
app.use(cookieParser());

function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    return { leaderboard: [], queue: [], matchesPlayed: 0, signupLog: [] };
  }
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    if (!Array.isArray(data.signupLog)) data.signupLog = [];
    return data;
  } catch (e) {
    return { leaderboard: [], queue: [], matchesPlayed: 0, signupLog: [] };
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function requireAdmin(req, res, next) {
  const token = req.cookies.admin_token;
  if (!token) return res.status(401).json({ error: 'Not logged in' });
  try {
    jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    res.status(401).json({ error: 'Session expired, log in again' });
  }
}

// ---- Public routes ----

app.get('/api/state', (req, res) => {
  const data = loadData();
  // signupLog contains emails and IPs — never expose it on the public endpoint.
  res.json({ leaderboard: data.leaderboard, queue: data.queue, matchesPlayed: data.matchesPlayed });
});

app.post('/api/signup', (req, res) => {
  const { username, email } = req.body || {};

  if (!username || !/^[A-Za-z0-9_]{3,20}$/.test(username)) {
    return res.status(400).json({ error: 'Invalid username' });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email' });
  }

  const data = loadData();
  const taken =
    data.leaderboard.some(r => r.username.toLowerCase() === username.toLowerCase()) ||
    data.queue.some(n => n.toLowerCase() === username.toLowerCase());
  if (taken) {
    return res.status(409).json({ error: 'Username already taken' });
  }

  data.queue.push(username);
  data.leaderboard.push({ username, wins: 0 });
  data.signupLog.push({
    username,
    email,
    ip: req.ip,
    at: new Date().toISOString()
  });
  saveData(data);

  res.json({ ok: true, state: { leaderboard: data.leaderboard, queue: data.queue, matchesPlayed: data.matchesPlayed } });
});

// ---- Admin routes ----

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body || {};
  if (!ADMIN_PASSWORD || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Wrong password' });
  }
  const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '12h' });
  res.cookie('admin_token', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: 12 * 60 * 60 * 1000
  });
  res.json({ ok: true });
});

app.post('/api/admin/logout', (req, res) => {
  res.clearCookie('admin_token', { httpOnly: true, secure: true, sameSite: 'none' });
  res.json({ ok: true });
});

app.get('/api/admin/check', requireAdmin, (req, res) => {
  res.json({ loggedIn: true });
});

app.get('/api/admin/signup-log', requireAdmin, (req, res) => {
  const data = loadData();
  res.json({ signupLog: data.signupLog.slice().reverse() }); // newest first
});

app.put('/api/admin/state', requireAdmin, (req, res) => {
  const { leaderboard, queue, matchesPlayed } = req.body || {};
  if (!Array.isArray(leaderboard) || !Array.isArray(queue) || typeof matchesPlayed !== 'number') {
    return res.status(400).json({ error: 'Invalid payload' });
  }
  const cleanLeaderboard = leaderboard
    .filter(r => r && typeof r.username === 'string' && r.username.trim())
    .map(r => ({ username: r.username.trim(), wins: Number(r.wins) || 0 }));
  const cleanQueue = queue
    .filter(n => typeof n === 'string' && n.trim())
    .map(n => n.trim());

  const data = loadData(); // preserve signupLog — don't overwrite it here
  data.leaderboard = cleanLeaderboard;
  data.queue = cleanQueue;
  data.matchesPlayed = Math.max(0, Math.floor(matchesPlayed));
  saveData(data);

  res.json({ ok: true, state: { leaderboard: data.leaderboard, queue: data.queue, matchesPlayed: data.matchesPlayed } });
});

app.listen(PORT, () => {
  console.log('Shed Games server running on port ' + PORT);
});
