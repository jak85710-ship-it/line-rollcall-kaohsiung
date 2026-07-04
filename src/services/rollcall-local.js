const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '../../data/rollcall-sessions.json');

const STATUS_LABELS = {
  present: '實到',
  late: '遲到',
  competition: '比賽',
  leave: '請假',
  absent: '無故未到',
};

function ensureFile() {
  const dir = path.dirname(DATA_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DATA_PATH)) fs.writeFileSync(DATA_PATH, '[]', 'utf8');
}

function loadSessions() {
  ensureFile();
  return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
}

function saveSession(session) {
  const sessions = loadSessions();
  sessions.push(session);
  fs.writeFileSync(DATA_PATH, JSON.stringify(sessions, null, 2), 'utf8');
  return session;
}

module.exports = {
  STATUS_LABELS,
  saveSession,
  loadSessions,
};
