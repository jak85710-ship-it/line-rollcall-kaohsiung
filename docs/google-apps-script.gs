/**
 * 中山國小桌球隊 · 點名表 Google Apps Script
 * 對應後台五種 ○ 狀態：實到 / 遲到 / 比賽 / 請假 / 無故未到
 */

const CONFIG = {
  SPREADSHEET_ID: '在這裡貼試算表ID',
  LOG_SHEET: '點名紀錄',
  EMAIL_TO: 'ben83127@gmail.com',
  API_SECRET: 'zhongshan2026',
  TEAM_NAME: '中山國小桌球隊',
};

const STATUS_LABELS = {
  present: '○實到',
  late: '○遲到',
  competition: '○比賽',
  leave: '○請假',
  absent: '○無故未到',
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

function statusLabel(status) {
  return STATUS_LABELS[status] || status;
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

function buildSummary(records) {
  const summary = { present: 0, late: 0, competition: 0, leave: 0, absent: 0 };
  records.forEach(function (r) {
    if (summary[r.status] !== undefined) summary[r.status]++;
  });
  return summary;
}

function sendRollcallEmail(data) {
  const summary = buildSummary(data.records);
  const subject = '[點名表] ' + data.date + '｜實到' + summary.present + ' 請假' + summary.leave + ' 無故未到' + summary.absent;

  const rows = data.records.map(function (r) {
    return '<tr>' +
      '<td style="padding:10px;border-bottom:1px solid #eee;">' + esc(r.name) + '</td>' +
      '<td style="padding:10px;border-bottom:1px solid #eee;">' + esc(r.grade || '-') + '</td>' +
      '<td style="padding:10px;border-bottom:1px solid #eee;text-align:center;">' + (r.status === 'present' ? '●' : '○') + '</td>' +
      '<td style="padding:10px;border-bottom:1px solid #eee;text-align:center;">' + (r.status === 'late' ? '●' : '○') + '</td>' +
      '<td style="padding:10px;border-bottom:1px solid #eee;text-align:center;">' + (r.status === 'competition' ? '●' : '○') + '</td>' +
      '<td style="padding:10px;border-bottom:1px solid #eee;text-align:center;">' + (r.status === 'leave' ? '●' : '○') + '</td>' +
      '<td style="padding:10px;border-bottom:1px solid #eee;text-align:center;">' + (r.status === 'absent' ? '●' : '○') + '</td>' +
      '<td style="padding:10px;border-bottom:1px solid #eee;">' + esc(r.parent_phone || '') + '</td>' +
      '<td style="padding:10px;border-bottom:1px solid #eee;">' + esc(r.notes || '') + '</td>' +
      '</tr>';
  }).join('');

  const absentRecords = data.records.filter(function (r) { return r.status === 'absent'; });

  let html = '<div style="font-family:sans-serif;max-width:900px">';
  html += '<div style="background:#047857;color:#fff;padding:24px;border-radius:12px 12px 0 0">';
  html += '<h1 style="margin:0 0 8px;font-size:22px">' + CONFIG.TEAM_NAME + '點名表</h1>';
  html += '<p style="margin:0">日期：' + esc(data.date) + '</p>';
  html += '<p style="margin:8px 0 0">送出時間：' + esc(data.submittedAt) + '</p></div>';
  html += '<div style="padding:20px 24px;background:#fff;border:1px solid #e2e8f0;border-top:0">';
  html += '<p style="color:#475569">○實到　○遲到　○比賽　○請假　○無故未到（●為該生今日狀態）</p>';
  html += '<table style="width:100%;border-collapse:collapse;font-size:14px"><thead><tr style="background:#f8fafc">';
  html += '<th style="padding:10px;text-align:left">姓名</th><th style="padding:10px;text-align:left">班級</th>';
  html += '<th style="padding:10px;text-align:center">○實到</th><th style="padding:10px;text-align:center">○遲到</th>';
  html += '<th style="padding:10px;text-align:center">○比賽</th><th style="padding:10px;text-align:center">○請假</th>';
  html += '<th style="padding:10px;text-align:center">○無故未到</th><th style="padding:10px;text-align:left">家長電話</th>';
  html += '<th style="padding:10px;text-align:left">備註</th></tr></thead><tbody>' + rows + '</tbody></table>';
  html += '<p style="margin:20px 0 0">實到 ' + summary.present + ' 人 · 遲到 ' + summary.late + ' 人 · 比賽 ' + summary.competition +
    ' 人 · 請假 ' + summary.leave + ' 人 · 無故未到 ' + summary.absent + ' 人</p>';

  if (absentRecords.length > 0) {
    html += '<h3 style="color:#dc2626;margin-top:24px">無故未到 · 家長聯絡電話</h3><ul>';
    absentRecords.forEach(function (r) {
      html += '<li><strong>' + esc(r.name) + '</strong>：' + esc(r.parent_phone || '（未填）') + '</li>';
    });
    html += '</ul>';
  }

  html += '</div></div>';

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
