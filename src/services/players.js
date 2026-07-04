const config = require('../config');
const sheets = require('./sheets');
const local = require('./players-local');

function useGoogleSheets() {
  return Boolean(
    config.google.spreadsheetId &&
      config.google.clientEmail &&
      config.google.privateKey
  );
}

async function getAllPlayers() {
  if (useGoogleSheets()) {
    try {
      const sheetPlayers = await sheets.getAllPlayers();
      if (sheetPlayers.length > 0) return sheetPlayers;
    } catch (error) {
      console.warn('[Players] Google Sheets 讀取失敗，改用本機資料:', error.message);
    }
  }
  return local.getAllPlayers();
}

async function getActivePlayers() {
  if (useGoogleSheets()) {
    try {
      const sheetPlayers = await sheets.getActivePlayers();
      if (sheetPlayers.length > 0) return sheetPlayers;
    } catch (error) {
      console.warn('[Players] Google Sheets 讀取失敗，改用本機資料:', error.message);
    }
  }
  return local.getActivePlayers();
}

async function createPlayer(data) {
  if (useGoogleSheets()) return sheets.createPlayer(data);
  return local.createPlayer(data);
}

async function updatePlayer(id, data) {
  if (useGoogleSheets()) return sheets.updatePlayer(id, data);
  return local.updatePlayer(id, data);
}

async function deletePlayer(id) {
  if (useGoogleSheets()) return sheets.deletePlayer(id);
  return local.deletePlayer(id);
}

async function bulkImport(players) {
  if (useGoogleSheets()) {
    await sheets.bulkImportPlayers(players);
  }
  local.replaceAllPlayers(players);
  return players;
}

module.exports = {
  useGoogleSheets,
  getActivePlayers,
  getAllPlayers,
  createPlayer,
  updatePlayer,
  deletePlayer,
  bulkImport,
};
