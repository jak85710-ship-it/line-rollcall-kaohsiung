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
app.use('/admin', express.static(path.join(__dirname, 'public', 'admin')));

app.get('/liff/rollcall', (req, res) => {
  const liffId = config.line.liffId;
  if (!liffId) {
    return res.status(500).send('LIFF_ID 未設定');
  }
  res.redirect(`/liff/rollcall.html?liffId=${liffId}`);
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'line-rollcall-kaohsiung',
    storage: playerStore.useGoogleSheets() ? 'google-sheets' : 'local-json',
    lineConfigured: Boolean(config.line.channelSecret && config.line.channelAccessToken),
    liffConfigured: Boolean(config.line.liffId),
  });
});

app.get('/', (req, res) => {
  res.redirect('/admin/');
});

async function start() {
  try {
    if (config.google.spreadsheetId) {
      await initSheets();
    } else {
      console.warn('[Warning] GOOGLE_SPREADSHEET_ID 未設定，請完成 Google Sheets 串接');
    }
  } catch (error) {
    console.error('[Sheets] Init failed:', error.message);
  }

  app.listen(config.port, async () => {
    const roster = await playerStore.getAllPlayers();
    console.log(`Server running at ${config.baseUrl}`);
    console.log(`LIFF rollcall: ${config.baseUrl}/liff/rollcall.html`);
    console.log(`Admin panel: ${config.baseUrl}/admin/`);
    console.log(`隊員名單：${roster.length} 位（${playerStore.useGoogleSheets() ? 'Google Sheets' : '本機 data/players.json'}）`);
    if (config.google.spreadsheetId) {
      console.log(`Google Sheet: https://docs.google.com/spreadsheets/d/${config.google.spreadsheetId}`);
    }
  });
}

start();
