require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./src/config');
const { initSheets } = require('./src/services/sheets');
const playerStore = require('./src/services/players');
const apiRoutes = require('./src/routes/api');
const adminRoutes = require('./src/routes/admin');
const lineRoutes = require('./src/routes/line');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', apiRoutes);
app.use('/admin/api', adminRoutes);
app.use('/line', lineRoutes);
app.use('/liff', express.static(path.join(__dirname, 'public', 'liff')));

const adminDir = path.join(__dirname, 'public', 'admin');
const adminIndex = path.join(adminDir, 'index.html');

function sendAdminPanel(req, res) {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.sendFile(adminIndex);
}

app.get('/admin', sendAdminPanel);
app.get('/admin/', sendAdminPanel);
app.get('/admin/index.html', sendAdminPanel);
app.use('/admin', express.static(adminDir, { index: false }));

app.get('/liff/rollcall', (req, res) => {
  const liffId = config.line.liffId;
  if (!liffId) {
    return res.status(500).send('LIFF_ID 未設定');
  }
  res.redirect(`/liff/rollcall.html?liffId=${liffId}`);
});

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'csh-tt-rollcall',
    admin: `${config.baseUrl}/admin/`,
    storage: playerStore.useGoogleSheets() ? 'google-sheets' : 'local-json',
  });
});

app.get('/', sendAdminPanel);

async function start() {
  app.listen(config.port, '0.0.0.0', () => {
    console.log(`Listening on port ${config.port}`);
  });

  try {
    if (playerStore.useGoogleSheets()) {
      await initSheets();
      console.log('[Storage] 使用 Google Sheets 儲存隊員資料');
    } else if (config.google.spreadsheetId) {
      console.warn('[Warning] GOOGLE_SPREADSHEET_ID 已設定但缺少 Service Account，改用本機 data/players.json');
    } else {
      console.log('[Storage] 使用本機 data/players.json（未設定 Google Sheets，屬正常）');
    }
  } catch (error) {
    console.error('[Sheets] Init failed:', error.message);
  }

  try {
    const roster = await playerStore.getAllPlayers();
    console.log(`Server running at ${config.baseUrl}`);
    console.log(`Admin panel: ${config.baseUrl}/admin/`);
    console.log(`隊員名單：${roster.length} 位（${playerStore.useGoogleSheets() ? 'Google Sheets' : '本機 data/players.json'}）`);
    if (config.google.spreadsheetId) {
      console.log(`Google Sheet: https://docs.google.com/spreadsheets/d/${config.google.spreadsheetId}`);
    }
  } catch (error) {
    console.error('[Startup] Failed to load roster:', error.message);
  }
}

start();
