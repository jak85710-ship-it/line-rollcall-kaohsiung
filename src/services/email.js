const nodemailer = require('nodemailer');
const config = require('../config');

function normalizeSmtpConfig() {
  return {
    host: (config.smtp.host || 'smtp.gmail.com').trim(),
    port: Number(config.smtp.port) || 587,
    secure: Boolean(config.smtp.secure),
    user: (config.smtp.user || '').trim(),
    pass: String(config.smtp.pass || '').replace(/\s+/g, ''),
  };
}

function normalizeResendConfig() {
  return {
    apiKey: (config.resend?.apiKey || '').trim(),
    from: (config.resend?.from || '').trim() || 'onboarding@resend.dev',
  };
}

function buildTransport(options) {
  return nodemailer.createTransport({
    host: options.host,
    port: options.port,
    secure: options.secure,
    requireTLS: !options.secure,
    connectionTimeout: 30000,
    greetingTimeout: 30000,
    socketTimeout: 45000,
    tls: {
      rejectUnauthorized: false,
    },
    auth: {
      user: options.user,
      pass: options.pass,
    },
  });
}

function buildSmtpCandidates(smtp) {
  const starttls587 = { ...smtp, host: 'smtp.gmail.com', port: 587, secure: false };
  const ssl465 = { ...smtp, host: 'smtp.gmail.com', port: 465, secure: true };
  const original = { ...smtp };
  const raw = [];

  if (original.port === 465 && original.secure) {
    raw.push(starttls587, ssl465);
  } else {
    raw.push(original, starttls587, ssl465);
  }

  const seen = new Set();
  return raw.filter((item) => {
    const key = `${item.host}:${item.port}:${item.secure}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isTimeoutLikeError(error) {
  const code = String(error?.code || '').toUpperCase();
  const message = String(error?.message || '').toLowerCase();
  return (
    ['ETIMEDOUT', 'ESOCKET', 'ECONNECTION'].includes(code) ||
    message.includes('timeout') ||
    message.includes('timed out')
  );
}

async function sendViaFormSubmit(to, subject, html) {
  const response = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(to)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      _subject: subject,
      _template: 'box',
      _captcha: 'false',
      message: html,
    }),
  });
  const data = await response.json().catch(() => ({}));
  const ok = response.ok && (data.success === true || data.success === 'true');
  if (!ok) {
    throw new Error(data.message || `FormSubmit failed: HTTP ${response.status}`);
  }
}

async function sendViaResend({ apiKey, from, to, subject, html }) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.message || data?.error || `Resend failed: HTTP ${response.status}`;
    throw new Error(message);
  }

  return data;
}

async function sendViaSmtpCandidates({ smtp, from, to, subject, html }) {
  const candidates = buildSmtpCandidates(smtp);
  let lastError = null;

  for (const candidate of candidates) {
    try {
      await buildTransport(candidate).sendMail({
        from,
        to,
        subject,
        html,
      });
      return {
        sent: true,
        via: `smtp-${candidate.port}-${candidate.secure ? 'ssl' : 'starttls'}`,
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('SMTP send failed');
}

function resolveFromAddress(smtpUser, fallbackTo) {
  const configured = String(config.email.from || '').trim();
  if (configured.includes('@')) return configured;
  const mailbox = (smtpUser || fallbackTo || 'noreply@example.com').trim();
  return `運動隊點名系統 <${mailbox}>`;
}

async function deliverEmail({ to, subject, html }) {
  const smtp = normalizeSmtpConfig();
  const resend = normalizeResendConfig();
  const normalizedTo = (to || config.email.to || smtp.user || '').trim();

  if (!normalizedTo) {
    return { sent: false, reason: 'EMAIL_TO not configured' };
  }

  let resendErrorMessage = '';
  if (resend.apiKey) {
    try {
      await sendViaResend({
        apiKey: resend.apiKey,
        from: resend.from,
        to: normalizedTo,
        subject,
        html,
      });
      return { sent: true, via: 'resend', to: normalizedTo };
    } catch (resendError) {
      resendErrorMessage = resendError.message;
      console.error('[Email] resend failed:', resendErrorMessage);
    }
  }

  const from = resolveFromAddress(smtp.user, normalizedTo);
  if (smtp.user && smtp.pass) {
    try {
      const smtpResult = await sendViaSmtpCandidates({
        smtp,
        from,
        to: normalizedTo,
        subject,
        html,
      });
      return { sent: true, via: smtpResult.via, to: normalizedTo };
    } catch (smtpError) {
      if (!isTimeoutLikeError(smtpError)) {
        const reason = resendErrorMessage
          ? `resend: ${resendErrorMessage}; smtp: ${smtpError.message}`
          : smtpError.message;
        return { sent: false, reason, to: normalizedTo };
      }
      try {
        await sendViaFormSubmit(normalizedTo, subject, html);
        return { sent: true, via: 'formsubmit', to: normalizedTo };
      } catch (formError) {
        const joined = `${smtpError.message}; formsubmit: ${formError.message}`;
        const reason = resendErrorMessage ? `resend: ${resendErrorMessage}; ${joined}` : joined;
        return { sent: false, reason, to: normalizedTo };
      }
    }
  }

  try {
    await sendViaFormSubmit(normalizedTo, subject, html);
    return { sent: true, via: 'formsubmit', to: normalizedTo };
  } catch (formError) {
    const baseReason = `SMTP not configured and RESEND_API_KEY missing; formsubmit: ${formError.message}`;
    const reason = resendErrorMessage ? `resend: ${resendErrorMessage}; ${baseReason}` : baseReason;
    return { sent: false, reason, to: normalizedTo };
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatPlayerRow(player, statusLabel, statusColor) {
  const phones = [
    player.parent_phone ? `家長：${escapeHtml(player.parent_phone)}` : null,
    player.emergency_phone
      ? `備用：${escapeHtml(player.emergency_phone)}`
      : null,
  ]
    .filter(Boolean)
    .join(' / ');

  return `
    <tr>
      <td style="padding:10px;border-bottom:1px solid #eee;">${escapeHtml(player.name)}</td>
      <td style="padding:10px;border-bottom:1px solid #eee;">${escapeHtml(player.grade)}</td>
      <td style="padding:10px;border-bottom:1px solid #eee;color:${statusColor};font-weight:600;">${statusLabel}</td>
      <td style="padding:10px;border-bottom:1px solid #eee;">${phones || '-'}</td>
    </tr>
  `;
}

function buildRollcallEmailHtml({ session, records }) {
  const present = records.filter((r) => r.status === 'present');
  const absent = records.filter((r) => r.status === 'absent');
  const pending = records.filter((r) => r.status === 'pending');

  const submittedAt = new Date(session.submitted_at).toLocaleString('zh-TW', {
    timeZone: 'Asia/Taipei',
  });

  const presentRows = present
    .map((p) => formatPlayerRow(p, '出席', '#15803d'))
    .join('');
  const absentRows = absent
    .map((p) => formatPlayerRow(p, '缺席/請假', '#b91c1c'))
    .join('');
  const pendingRows = pending
    .map((p) => formatPlayerRow(p, '未點名', '#64748b'))
    .join('');

  return `
<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8">
  <title>點名日報表 - ${escapeHtml(session.session_date)}</title>
</head>
<body style="font-family:'Segoe UI',Arial,sans-serif;background:#f8fafc;color:#0f172a;margin:0;padding:24px;">
  <div style="max-width:720px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,0.08);">
    <div style="background:linear-gradient(135deg,#059669,#047857);color:#fff;padding:24px 28px;">
      <h1 style="margin:0 0 8px;font-size:24px;">國小運動團隊點名日報表</h1>
      <p style="margin:0;opacity:0.95;">訓練日期：${escapeHtml(session.session_date)}</p>
      <p style="margin:8px 0 0;opacity:0.95;">送出時間：${escapeHtml(submittedAt)}</p>
      <p style="margin:8px 0 0;opacity:0.95;">教練：${escapeHtml(session.coach_name || '教練')}</p>
    </div>

    <div style="padding:24px 28px;">
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        <tr>
          <td style="padding:12px;background:#ecfdf5;border-radius:12px;text-align:center;">
            <div style="font-size:28px;font-weight:700;color:#047857;">${session.present_count}</div>
            <div style="color:#065f46;">出席</div>
          </td>
          <td style="width:12px;"></td>
          <td style="padding:12px;background:#fef2f2;border-radius:12px;text-align:center;">
            <div style="font-size:28px;font-weight:700;color:#b91c1c;">${session.absent_count}</div>
            <div style="color:#991b1b;">缺席/請假</div>
          </td>
          <td style="width:12px;"></td>
          <td style="padding:12px;background:#f1f5f9;border-radius:12px;text-align:center;">
            <div style="font-size:28px;font-weight:700;color:#334155;">${session.attendance_rate}%</div>
            <div style="color:#475569;">出席率</div>
          </td>
        </tr>
      </table>

      <h2 style="font-size:18px;color:#047857;margin:0 0 12px;">出席名單 (${present.length})</h2>
      ${renderTable(presentRows, '目前無出席紀錄')}

      <h2 style="font-size:18px;color:#b91c1c;margin:28px 0 12px;">缺席/請假名單 (${absent.length})</h2>
      <p style="margin:0 0 12px;color:#64748b;font-size:14px;">以下含家長聯絡電話，可直接撥打聯繫。</p>
      ${renderTable(absentRows, '今日全員出席')}

      ${
        pending.length
          ? `<h2 style="font-size:18px;color:#64748b;margin:28px 0 12px;">未點名 (${pending.length})</h2>${renderTable(pendingRows, '')}`
          : ''
      }
    </div>
  </div>
</body>
</html>
  `.trim();
}

function renderTable(rows, emptyMessage) {
  if (!rows) {
    return `<p style="color:#64748b;">${escapeHtml(emptyMessage)}</p>`;
  }

  return `
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <thead>
        <tr style="background:#f8fafc;">
          <th style="padding:10px;text-align:left;">姓名</th>
          <th style="padding:10px;text-align:left;">年級</th>
          <th style="padding:10px;text-align:left;">狀態</th>
          <th style="padding:10px;text-align:left;">聯絡電話</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

async function sendRollcallEmail(sessionData) {
  const { session, records } = sessionData;
  const html = buildRollcallEmailHtml({ session, records });
  const subject = `[點名日報] ${session.session_date}｜出席 ${session.present_count} / 缺席 ${session.absent_count}`;
  return deliverEmail({ to: config.email.to, subject, html });
}

const ADMIN_STATUS_LABELS = {
  present: '○實到',
  late: '○遲到',
  competition: '○比賽',
  leave: '○請假',
  absent: '○無故未到',
};

function buildAdminRollcallEmailHtml({ sessionDate, submittedAt, records, summary }) {
  const rows = records
    .map(
      (r) => `
    <tr>
      <td style="padding:10px;border-bottom:1px solid #eee;">${escapeHtml(r.name)}</td>
      <td style="padding:10px;border-bottom:1px solid #eee;">${escapeHtml(r.grade || '-')}</td>
      <td style="padding:10px;border-bottom:1px solid #eee;text-align:center;">${r.status === 'present' ? '●' : '○'}</td>
      <td style="padding:10px;border-bottom:1px solid #eee;text-align:center;">${r.status === 'late' ? '●' : '○'}</td>
      <td style="padding:10px;border-bottom:1px solid #eee;text-align:center;">${r.status === 'competition' ? '●' : '○'}</td>
      <td style="padding:10px;border-bottom:1px solid #eee;text-align:center;">${r.status === 'leave' ? '●' : '○'}</td>
      <td style="padding:10px;border-bottom:1px solid #eee;text-align:center;">${r.status === 'absent' ? '●' : '○'}</td>
      <td style="padding:10px;border-bottom:1px solid #eee;">${escapeHtml(r.parent_phone || '')}</td>
      <td style="padding:10px;border-bottom:1px solid #eee;">${escapeHtml(r.notes || '')}</td>
    </tr>`
    )
    .join('');

  return `
<!DOCTYPE html>
<html lang="zh-Hant">
<head><meta charset="UTF-8"><title>點名表 ${escapeHtml(sessionDate)}</title></head>
<body style="font-family:'Segoe UI',Arial,sans-serif;background:#f8fafc;padding:24px;">
  <div style="max-width:900px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,0.08);">
    <div style="background:#047857;color:#fff;padding:24px;">
      <h1 style="margin:0 0 8px;font-size:22px;">中山國小桌球隊點名表</h1>
      <p style="margin:0;">日期：${escapeHtml(sessionDate)}</p>
      <p style="margin:8px 0 0;">送出時間：${escapeHtml(submittedAt)}</p>
    </div>
    <div style="padding:20px 24px;">
      <p style="margin:0 0 16px;color:#475569;">○實到　○遲到　○比賽　○請假　○無故未到（●為該生今日狀態）</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="background:#f8fafc;">
            <th style="padding:10px;text-align:left;">姓名</th>
            <th style="padding:10px;text-align:left;">班級</th>
            <th style="padding:10px;text-align:center;">○實到</th>
            <th style="padding:10px;text-align:center;">○遲到</th>
            <th style="padding:10px;text-align:center;">○比賽</th>
            <th style="padding:10px;text-align:center;">○請假</th>
            <th style="padding:10px;text-align:center;">○無故未到</th>
            <th style="padding:10px;text-align:left;">家長電話</th>
            <th style="padding:10px;text-align:left;">備註</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="margin:20px 0 0;color:#334155;">
        實到 ${summary.present} 人 · 遲到 ${summary.late} 人 · 比賽 ${summary.competition} 人 · 請假 ${summary.leave} 人 · 無故未到 ${summary.absent} 人
      </p>
    </div>
  </div>
</body>
</html>`.trim();
}

async function sendAdminRollcallEmail(payload) {
  const html = buildAdminRollcallEmailHtml(payload);
  const subject = `[點名表] ${payload.sessionDate}｜實到${payload.summary.present} 請假${payload.summary.leave} 無故未到${payload.summary.absent}`;
  return deliverEmail({ to: config.email.to, subject, html });
}

function buildRollcallRangeSummaryHtml({ startDate, endDate, generatedAt, sessions }) {
  const totals = { present: 0, late: 0, competition: 0, leave: 0, absent: 0 };
  const playerMap = new Map();

  for (const session of sessions) {
    const summary = session.summary || {};
    totals.present += Number(summary.present || 0);
    totals.late += Number(summary.late || 0);
    totals.competition += Number(summary.competition || 0);
    totals.leave += Number(summary.leave || 0);
    totals.absent += Number(summary.absent || 0);

    for (const record of session.records || []) {
      const key = `${record.playerId || ''}-${record.name || ''}`;
      if (!playerMap.has(key)) {
        playerMap.set(key, {
          name: record.name || '',
          grade: record.grade || '',
          present: 0,
          late: 0,
          competition: 0,
          leave: 0,
          absent: 0,
          total: 0,
          lastDate: '',
          lastStatus: '',
        });
      }
      const row = playerMap.get(key);
      const status = String(record.status || '');
      if (status in totals) {
        row[status] += 1;
        row.total += 1;
      }
      if (!row.lastDate || String(session.sessionDate) > row.lastDate) {
        row.lastDate = session.sessionDate || '';
        row.lastStatus = record.statusLabel || ADMIN_STATUS_LABELS[status] || status;
      }
    }
  }

  const playerRows = Array.from(playerMap.values())
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'zh-Hant'))
    .map(
      (r) => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(r.name)}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(r.grade || '-')}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${r.total}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${r.present}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${r.late}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${r.competition}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${r.leave}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${r.absent}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(r.lastDate || '-')}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(r.lastStatus || '-')}</td>
      </tr>`
    )
    .join('');

  const sessionRows = sessions
    .map((s) => {
      const summary = s.summary || {};
      const count = (s.records || []).length;
      return `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(s.sessionDate || '-')}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(s.submittedAt || '-')}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${count}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${Number(summary.present || 0)}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${Number(summary.late || 0)}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${Number(summary.competition || 0)}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${Number(summary.leave || 0)}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${Number(summary.absent || 0)}</td>
      </tr>`;
    })
    .join('');

  const detailSections = sessions
    .map((s) => {
      const rows = (s.records || [])
        .map(
          (r) => `
          <tr>
            <td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(r.name || '')}</td>
            <td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(r.grade || '-')}</td>
            <td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(r.statusLabel || ADMIN_STATUS_LABELS[r.status] || r.status || '-')}</td>
            <td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(r.parent_phone || '')}</td>
            <td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(r.notes || '')}</td>
          </tr>`
        )
        .join('');
      return `
      <h3 style="margin:20px 0 8px;font-size:16px;color:#0f172a;">${escapeHtml(s.sessionDate || '-')}（送出：${escapeHtml(s.submittedAt || '-')})</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:12px;">
        <thead>
          <tr style="background:#f8fafc;">
            <th style="padding:8px;text-align:left;">姓名</th>
            <th style="padding:8px;text-align:left;">班級</th>
            <th style="padding:8px;text-align:left;">狀態</th>
            <th style="padding:8px;text-align:left;">家長電話</th>
            <th style="padding:8px;text-align:left;">備註</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
    })
    .join('');

  return `
  <html lang="zh-Hant">
  <head><meta charset="UTF-8"><title>點名彙整 ${escapeHtml(startDate)} ~ ${escapeHtml(endDate)}</title></head>
  <body style="font-family:Segoe UI,Arial,sans-serif;background:#f8fafc;padding:20px;color:#0f172a;">
    <div style="max-width:980px;margin:0 auto;background:#fff;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.08);overflow:hidden;">
      <div style="background:#047857;color:#fff;padding:20px;">
        <h1 style="margin:0;font-size:22px;">點名彙整報表</h1>
        <p style="margin:8px 0 0;">期間：${escapeHtml(startDate)} ～ ${escapeHtml(endDate)}</p>
        <p style="margin:6px 0 0;">產生時間：${escapeHtml(generatedAt)}｜共 ${sessions.length} 次點名</p>
      </div>
      <div style="padding:20px;">
        <h2 style="margin:0 0 10px;font-size:18px;">期間總覽</h2>
        <p style="margin:0 0 16px;color:#334155;">
          實到 ${totals.present} 人次 · 遲到 ${totals.late} 人次 · 比賽 ${totals.competition} 人次 · 請假 ${totals.leave} 人次 · 無故未到 ${totals.absent} 人次
        </p>

        <h2 style="margin:0 0 10px;font-size:18px;">每日統計</h2>
        <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:18px;">
          <thead>
            <tr style="background:#f8fafc;">
              <th style="padding:8px;text-align:left;">日期</th>
              <th style="padding:8px;text-align:left;">送出時間</th>
              <th style="padding:8px;text-align:center;">人數</th>
              <th style="padding:8px;text-align:center;">實到</th>
              <th style="padding:8px;text-align:center;">遲到</th>
              <th style="padding:8px;text-align:center;">比賽</th>
              <th style="padding:8px;text-align:center;">請假</th>
              <th style="padding:8px;text-align:center;">無故未到</th>
            </tr>
          </thead>
          <tbody>${sessionRows}</tbody>
        </table>

        <h2 style="margin:0 0 10px;font-size:18px;">隊員統計（完整）</h2>
        <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:18px;">
          <thead>
            <tr style="background:#f8fafc;">
              <th style="padding:8px;text-align:left;">姓名</th>
              <th style="padding:8px;text-align:left;">班級</th>
              <th style="padding:8px;text-align:center;">出現次數</th>
              <th style="padding:8px;text-align:center;">實到</th>
              <th style="padding:8px;text-align:center;">遲到</th>
              <th style="padding:8px;text-align:center;">比賽</th>
              <th style="padding:8px;text-align:center;">請假</th>
              <th style="padding:8px;text-align:center;">無故未到</th>
              <th style="padding:8px;text-align:left;">最近日期</th>
              <th style="padding:8px;text-align:left;">最近狀態</th>
            </tr>
          </thead>
          <tbody>${playerRows}</tbody>
        </table>

        <h2 style="margin:0 0 10px;font-size:18px;">各次點名明細（完整）</h2>
        ${detailSections}
      </div>
    </div>
  </body>
  </html>`.trim();
}

async function sendRollcallRangeSummaryEmail({ startDate, endDate, sessions }) {
  const generatedAt = new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date());

  const html = buildRollcallRangeSummaryHtml({ startDate, endDate, generatedAt, sessions });
  const subject = `[點名彙整] ${startDate}~${endDate}（共 ${sessions.length} 次）`;
  return deliverEmail({ to: config.email.to, subject, html });
}

module.exports = {
  sendRollcallEmail,
  sendAdminRollcallEmail,
  sendRollcallRangeSummaryEmail,
  buildRollcallEmailHtml,
  buildAdminRollcallEmailHtml,
  ADMIN_STATUS_LABELS,
};
