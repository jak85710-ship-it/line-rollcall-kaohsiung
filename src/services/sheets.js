const { google } = require('googleapis');
const config = require('../config');

const SHEET_PLAYERS = '隊員名單';
const SHEET_ROLLCALL = '點名紀錄';

const PLAYER_HEADERS = [
  'id', '姓名', '年級', '家長姓名', '家長電話', '備用電話', '備註', '啟用',
];

const ROLLCALL_HEADERS = [
  'batch_id', '日期', '教練LINE_ID', '教練姓名', 'player_id',
  '姓名', '年級', '狀態', '家長電話', '備用電話', '送出時間',
];

let sheetsClient;

function getAuth() {
  const { clientEmail, privateKey } = config.google;
  if (!clientEmail || !privateKey) {
    throw new Error('Google Sheets 憑證未設定（GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY）');
  }

  return new google.auth.GoogleAuth({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

async function getSheets() {
  if (!sheetsClient) {
    const auth = getAuth();
    sheetsClient = google.sheets({ version: 'v4', auth });
  }
  return sheetsClient;
}

async function readSheet(sheetName) {
  const sheets = await getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: config.google.spreadsheetId,
    range: `${sheetName}!A:Z`,
  });
  return res.data.values || [];
}

async function appendRows(sheetName, rows) {
  const sheets = await getSheets();
  await sheets.spreadsheets.values.append({
    spreadsheetId: config.google.spreadsheetId,
    range: `${sheetName}!A:Z`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: rows },
  });
}

async function writeSheet(sheetName, rows) {
  const sheets = await getSheets();
  await sheets.spreadsheets.values.update({
    spreadsheetId: config.google.spreadsheetId,
    range: `${sheetName}!A1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: rows },
  });
}

function isActive(value) {
  const v = String(value ?? '').trim().toLowerCase();
  return v === '' || v === '1' || v === 'true' || v === '是' || v === 'y' || v === 'yes';
}

function rowToPlayer(row, rowIndex) {
  return {
    id: Number(row[0]) || rowIndex,
    name: row[1] || '',
    grade: row[2] || '',
    parent_name: row[3] || '',
    parent_phone: row[4] || '',
    emergency_phone: row[5] || '',
    notes: row[6] || '',
    is_active: isActive(row[7]),
  };
}

function rowToRollcallRecord(row) {
  return {
    batch_id: row[0],
    session_date: row[1],
    coach_line_user_id: row[2],
    coach_name: row[3],
    player_id: Number(row[4]),
    name: row[5],
    grade: row[6],
    status: row[7],
    parent_phone: row[8],
    emergency_phone: row[9],
    submitted_at: row[10],
  };
}

async function getAllPlayers() {
  const rows = await readSheet(SHEET_PLAYERS);
  if (rows.length <= 1) return [];

  return rows.slice(1).map((row, i) => ({
    ...rowToPlayer(row, i + 1),
    row_number: i + 2,
  }));
}

async function getNextPlayerId() {
  const players = await getAllPlayers();
  if (players.length === 0) return 1;
  return Math.max(...players.map((p) => Number(p.id) || 0)) + 1;
}

function playerToRow(player) {
  return [
    player.id,
    player.name,
    player.grade,
    player.parent_name,
    player.parent_phone,
    player.emergency_phone || '',
    player.notes || '',
    player.is_active !== false ? '是' : '否',
  ];
}

async function updateRow(sheetName, rowIndex, rowData) {
  const sheets = await getSheets();
  await sheets.spreadsheets.values.update({
    spreadsheetId: config.google.spreadsheetId,
    range: `${sheetName}!A${rowIndex}:H${rowIndex}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [rowData] },
  });
}

async function createPlayer(data) {
  const id = await getNextPlayerId();
  const player = {
    id,
    name: data.name,
    grade: data.grade,
    parent_name: data.parent_name,
    parent_phone: data.parent_phone,
    emergency_phone: data.emergency_phone || '',
    notes: data.notes || '',
    is_active: true,
  };
  await appendRows(SHEET_PLAYERS, [playerToRow(player)]);
  return player;
}

async function updatePlayer(id, data) {
  const players = await getAllPlayers();
  const existing = players.find((p) => p.id === id);
  if (!existing) return null;

  const updated = {
    ...existing,
    name: data.name ?? existing.name,
    grade: data.grade ?? existing.grade,
    parent_name: data.parent_name ?? existing.parent_name,
    parent_phone: data.parent_phone ?? existing.parent_phone,
    emergency_phone: data.emergency_phone ?? existing.emergency_phone,
    notes: data.notes ?? existing.notes,
    is_active: data.is_active ?? existing.is_active,
  };

  await updateRow(SHEET_PLAYERS, existing.row_number, playerToRow(updated));
  return updated;
}

async function deletePlayer(id) {
  const players = await getAllPlayers();
  const existing = players.find((p) => p.id === id);
  if (!existing) return null;

  const sheets = await getSheets();
  const sheetId = await getSheetId(SHEET_PLAYERS);

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: config.google.spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex: existing.row_number - 1,
              endIndex: existing.row_number,
            },
          },
        },
      ],
    },
  });

  return existing;
}

async function getActivePlayers() {
  const rows = await readSheet(SHEET_PLAYERS);
  if (rows.length <= 1) return [];

  return rows
    .slice(1)
    .map((row, i) => rowToPlayer(row, i + 1))
    .filter((p) => p.is_active && p.name);
}

async function getAllRollcallRecords() {
  const rows = await readSheet(SHEET_ROLLCALL);
  if (rows.length <= 1) return [];
  return rows.slice(1).map(rowToRollcallRecord);
}

async function getLatestBatch(sessionDate, coachLineUserId) {
  const records = await getAllRollcallRecords();
  const matched = records.filter(
    (r) => r.session_date === sessionDate && r.coach_line_user_id === coachLineUserId
  );

  if (matched.length === 0) return null;

  matched.sort((a, b) => String(b.submitted_at).localeCompare(String(a.submitted_at)));
  const latestBatchId = matched[0].batch_id;
  return matched.filter((r) => r.batch_id === latestBatchId);
}

async function getSessionByDateAndCoach(sessionDate, coachLineUserId) {
  const batch = await getLatestBatch(sessionDate, coachLineUserId);
  if (!batch || batch.length === 0) return null;

  const present = batch.filter((r) => r.status === 'present').length;
  const absent = batch.filter((r) => r.status === 'absent').length;
  const pending = batch.filter((r) => r.status === 'pending').length;
  const total = batch.length;

  return {
    id: batch[0].batch_id,
    session_date: sessionDate,
    coach_line_user_id: coachLineUserId,
    coach_name: batch[0].coach_name,
    total_count: total,
    present_count: present,
    absent_count: absent,
    leave_count: pending,
    attendance_rate: total > 0 ? Math.round((present / total) * 1000) / 10 : 0,
    submitted_at: batch[0].submitted_at,
  };
}

async function getSessionWithRecords(sessionId) {
  const records = await getAllRollcallRecords();
  const batch = records.filter((r) => r.batch_id === sessionId);
  if (batch.length === 0) return null;

  const session = {
    id: sessionId,
    session_date: batch[0].session_date,
    coach_line_user_id: batch[0].coach_line_user_id,
    coach_name: batch[0].coach_name,
    total_count: batch.length,
    present_count: batch.filter((r) => r.status === 'present').length,
    absent_count: batch.filter((r) => r.status === 'absent').length,
    leave_count: batch.filter((r) => r.status === 'pending').length,
    attendance_rate: 0,
    submitted_at: batch[0].submitted_at,
  };
  session.attendance_rate =
    session.total_count > 0
      ? Math.round((session.present_count / session.total_count) * 1000) / 10
      : 0;

  const detailRecords = batch.map((r) => ({
    id: r.player_id,
    status: r.status,
    name: r.name,
    grade: r.grade,
    parent_phone: r.parent_phone,
    emergency_phone: r.emergency_phone,
  }));

  return { session, records: detailRecords };
}

async function saveRollcall({ sessionDate, coachLineUserId, coachName, records }) {
  const players = await getActivePlayers();
  const playerMap = Object.fromEntries(players.map((p) => [p.id, p]));

  const submittedAt = new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date());

  const batchId = `${sessionDate}_${coachLineUserId}_${Date.now()}`;

  const rows = records.map((record) => {
    const player = playerMap[record.playerId] || {};
    return [
      batchId,
      sessionDate,
      coachLineUserId,
      coachName,
      record.playerId,
      player.name || '',
      player.grade || '',
      record.status,
      player.parent_phone || '',
      player.emergency_phone || '',
      submittedAt,
    ];
  });

  await appendRows(SHEET_ROLLCALL, rows);

  return getSessionWithRecords(batchId);
}

async function bulkImportPlayers(players) {
  const header = PLAYER_HEADERS;
  const rows = [header, ...players.map((p) => playerToRow({ ...p, is_active: true }))];
  await writeSheet(SHEET_PLAYERS, rows);
  return players;
}

async function markEmailSent(sessionId) {
  // Google Sheets 版以 batch_id 標記；Email 狀態可從日誌確認，此函式保留相容性
  return sessionId;
}

function isCoach(lineUserId) {
  if (!lineUserId) return false;
  return config.coachLineUserIds.includes(lineUserId);
}

async function ensureSheetExists(sheets, title, headers) {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: config.google.spreadsheetId,
  });

  const existing = meta.data.sheets?.find((s) => s.properties.title === title);
  if (!existing) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: config.google.spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title } } }],
      },
    });
    await writeSheet(title, [headers]);
    return;
  }

  const rows = await readSheet(title);
  if (rows.length === 0) {
    await writeSheet(title, [headers]);
  }
}

async function initSheets({ seedSample = false } = {}) {
  if (!config.google.spreadsheetId) {
    throw new Error('GOOGLE_SPREADSHEET_ID 未設定');
  }

  const sheets = await getSheets();
  await ensureSheetExists(sheets, SHEET_PLAYERS, PLAYER_HEADERS);
  await ensureSheetExists(sheets, SHEET_ROLLCALL, ROLLCALL_HEADERS);

  if (seedSample) {
    const players = await getActivePlayers();
    if (players.length === 0) {
      await appendRows(SHEET_PLAYERS, [
        ['1', '王小明', '五年級', '王爸爸', '0912-345-678', '0922-111-222', '', '是'],
        ['2', '陳小華', '四年級', '陳媽媽', '0933-456-789', '', '對花生過敏', '是'],
        ['3', '林小安', '六年級', '林爸爸', '0955-678-901', '07-1234567', '', '是'],
      ]);
      console.log('已寫入 3 筆示範隊員至 Google Sheets');
    }
  }

  console.log('Google Sheets 初始化完成');
}

module.exports = {
  initSheets,
  isCoach,
  getActivePlayers,
  getAllPlayers,
  createPlayer,
  updatePlayer,
  deletePlayer,
  bulkImportPlayers,
  getSessionByDateAndCoach,
  getSessionWithRecords,
  saveRollcall,
  markEmailSent,
};
