/**
 * 中山國小桌球隊 · 點名表 Google Apps Script
 *
 * 設定步驟：
 * 1. 建立 Google 試算表，複製網址中的 Spreadsheet ID
 * 2. 試算表 → 擴充功能 → Apps Script → 貼上此檔全部內容
 * 3. 修改下方 CONFIG
 * 4. 部署 → 新增部署 → 網頁應用程式
 *    - 執行身分：我
 *    - 存取權：任何人
 * 5. 複製部署網址，貼到 index.html 的 GAS_URL
 */

const CONFIG = {
  SPREADSHEET_ID: '在這裡貼試算表ID',
  LOG_SHEET: '點名紀錄',
  EMAIL_TO: 'ben83127@gmail.com',
  API_SECRET: 'zhongshan2026',
  TEAM_NAME: '中山國小桌球隊',
};

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    if (data.secret !== CONFIG.API_SECRET) {
      return jsonOut({ ok: false, error: '驗證失敗' });
    }

    if (!data.records || !data.date) {
      return jsonOut({ ok: false, error: '資料不完整' });
    }

    writeToSheet(data);
    sendRollcallEmail(data);

    return jsonOut({ ok: true, message: '已寫入試算表並寄出 Email' });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err.message || err) });
  }
}

function doGet() {
  return jsonOut({ ok: true, service: CONFIG.TEAM_NAME, status: 'running' });
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheet() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  let sheet = ss.getSheetByName(CONFIG.LOG_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.LOG_SHEET);
    sheet.appendRow(['日期', '送出時間', '姓名', '班級', '狀態', '家長電話', '備註']);
    sheet.getRange(1, 1, 1, 7).setFontWeight('bold').setBackground('#dcfce7');
  }
  return sheet;
}

function writeToSheet(data) {
  const sheet = getSheet();
  const rows = data.records.map(function (r) {
    return [
      data.date,
      data.submittedAt,
      r.name,
      r.grade || '',
      statusLabel(r.status),
      r.parent_phone || '',
      r.notes || '',
    ];
  });
  if (rows.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 7).setValues(rows);
  }
}

function statusLabel(status) {
  if (status === 'present') return '出席';
  if (status === 'absent') return '缺席';
  return '未到';
}

function sendRollcallEmail(data) {
  const present = data.records.filter(function (r) { return r.status === 'present'; });
  const absent = data.records.filter(function (r) { return r.status === 'absent'; });
  const pending = data.records.filter(function (r) { return r.status === 'pending'; });

  const subject = '【' + CONFIG.TEAM_NAME + '】' + data.date + ' 點名日報';

  let html = '<div style="font-family:sans-serif;max-width:640px">';
  html += '<h2 style="color:#047857">' + CONFIG.TEAM_NAME + ' · 點名日報</h2>';
  html += '<p><strong>日期：</strong>' + data.date + '<br>';
  html += '<strong>送出時間：</strong>' + data.submittedAt + '</p>';
  html += '<p>出席 <strong style="color:#059669">' + present.length + '</strong> 人 · ';
  html += '缺席 <strong style="color:#dc2626">' + absent.length + '</strong> 人 · ';
  html += '未到 <strong style="color:#64748b">' + pending.length + '</strong> 人</p>';

  html += '<h3 style="color:#059669">出席（' + present.length + '）</h3><ul>';
  present.forEach(function (r) {
    html += '<li>' + esc(r.name) + (r.grade ? '（' + esc(r.grade) + '）' : '') + '</li>';
  });
  html += '</ul>';

  html += '<h3 style="color:#dc2626">缺席（' + absent.length + '）</h3>';
  if (absent.length === 0) {
    html += '<p>無</p>';
  } else {
    html += '<table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%">';
    html += '<tr style="background:#fee2e2"><th>姓名</th><th>班級</th><th>家長電話</th></tr>';
    absent.forEach(function (r) {
      html += '<tr><td>' + esc(r.name) + '</td><td>' + esc(r.grade || '-') + '</td>';
      html += '<td><strong>' + esc(r.parent_phone || '（未填）') + '</strong></td></tr>';
    });
    html += '</table>';
  }

  if (pending.length > 0) {
    html += '<h3 style="color:#64748b">未到（' + pending.length + '）</h3><ul>';
    pending.forEach(function (r) {
      html += '<li>' + esc(r.name) + (r.grade ? '（' + esc(r.grade) + '）' : '') + '</li>';
    });
    html += '</ul>';
  }

  html += '<p style="color:#94a3b8;font-size:12px;margin-top:24px">此信由 Google Apps Script 自動寄出</p></div>';

  MailApp.sendEmail({
    to: CONFIG.EMAIL_TO,
    subject: subject,
    htmlBody: html,
  });
}

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
