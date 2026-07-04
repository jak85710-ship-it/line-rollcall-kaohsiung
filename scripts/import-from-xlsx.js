require('dotenv').config();

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const config = require('../src/config');
const { initSheets, bulkImportPlayers } = require('../src/services/sheets');
const local = require('../src/services/players-local');

const xlsxPath =
  process.argv[2] ||
  path.join(__dirname, '../data/import.xlsx');

function parsePlayersFromWorkbook(filePath) {
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  const players = [];
  const seen = new Set();

  for (const row of rows) {
    const id = Number(row[0]);
    const grade = String(row[1] ?? '').trim();
    const name = String(row[2] ?? '').trim();

    if (!Number.isInteger(id) || id <= 0 || !name) continue;
    if (name === '學生' || name === '編號') continue;
    if (seen.has(id)) continue;

    seen.add(id);
    players.push({
      id,
      name,
      grade: grade || '',
      parent_name: '',
      parent_phone: '',
      emergency_phone: '',
      notes: '',
      is_active: true,
    });
  }

  players.sort((a, b) => a.id - b.id);
  return players;
}

async function main() {
  if (!fs.existsSync(xlsxPath)) {
    console.error('找不到檔案:', xlsxPath);
    process.exit(1);
  }

  const players = parsePlayersFromWorkbook(xlsxPath);
  console.log(`解析完成：${players.length} 位隊員`);

  local.savePlayers(players);
  console.log('已寫入本機隊員名單：data/players.json');

  if (config.google.spreadsheetId && config.google.clientEmail && config.google.privateKey) {
    await initSheets();
    await bulkImportPlayers(players);
    console.log('已同步至 Google Sheets「隊員名單」');
  } else {
    console.log('Google Sheets 未設定，僅寫入本機 data/players.json');
  }
}

main().catch((error) => {
  console.error('匯入失敗:', error.message);
  process.exit(1);
});
