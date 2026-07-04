const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '../../data/players.json');

function ensureDir() {
  const dir = path.dirname(DATA_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadPlayers() {
  ensureDir();
  if (!fs.existsSync(DATA_PATH)) return [];
  return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
}

function savePlayers(players) {
  ensureDir();
  fs.writeFileSync(DATA_PATH, JSON.stringify(players, null, 2), 'utf8');
}

function getAllPlayers() {
  return loadPlayers();
}

function getActivePlayers() {
  return loadPlayers().filter((p) => p.is_active !== false && p.name);
}

function getNextId() {
  const players = loadPlayers();
  if (players.length === 0) return 1;
  return Math.max(...players.map((p) => Number(p.id) || 0)) + 1;
}

function createPlayer(data) {
  const players = loadPlayers();
  const player = {
    id: getNextId(),
    name: data.name,
    grade: data.grade,
    parent_name: data.parent_name,
    parent_phone: data.parent_phone,
    emergency_phone: data.emergency_phone || '',
    notes: data.notes || '',
    is_active: true,
  };
  players.push(player);
  savePlayers(players);
  return player;
}

function updatePlayer(id, data) {
  const players = loadPlayers();
  const index = players.findIndex((p) => p.id === id);
  if (index === -1) return null;

  players[index] = {
    ...players[index],
    ...data,
    id,
  };
  savePlayers(players);
  return players[index];
}

function deletePlayer(id) {
  const players = loadPlayers();
  const index = players.findIndex((p) => p.id === id);
  if (index === -1) return null;
  const [removed] = players.splice(index, 1);
  savePlayers(players);
  return removed;
}

function replaceAllPlayers(players) {
  savePlayers(players);
  return players;
}

module.exports = {
  loadPlayers,
  savePlayers,
  getAllPlayers,
  getActivePlayers,
  createPlayer,
  updatePlayer,
  deletePlayer,
  replaceAllPlayers,
};
