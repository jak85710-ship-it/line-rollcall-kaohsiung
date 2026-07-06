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
  const smtp = normalizeSmtpConfig();
  const resend = normalizeResendConfig();
  const to = (config.email.to || smtp.user || '').trim();
  let resendErrorMessage = '';

  if (!to) {
    console.warn('[Email] EMAIL_TO 未設定，略過郵件發送');
    return { sent: false, reason: 'EMAIL_TO not configured' };
  }

  const { session, records } = sessionData;
  const html = buildRollcallEmailHtml({ session, records });
  const from = String(config.email.from || '').includes('@') ? config.email.from : `運動隊點名系統 <${to}>`;
  const subject = `[點名日報] ${session.session_date}｜出席 ${session.present_count} / 缺席 ${session.absent_count}`;

  if (resend.apiKey) {
    try {
      await sendViaResend({
        apiKey: resend.apiKey,
        from: resend.from,
        to,
        subject,
        html,
      });
      return { sent: true, via: 'resend', to };
    } catch (resendError) {
      console.error('[Email] resend failed:', resendError.message);
      resendErrorMessage = resendError.message;
    }
  }

  if (!smtp.user || !smtp.pass) {
    const baseReason = 'SMTP not configured and RESEND_API_KEY missing';
    return { sent: false, reason: resendErrorMessage ? `${baseReason}; resend: ${resendErrorMessage}` : baseReason, to };
  }

  try {
    const smtpResult = await sendViaSmtpCandidates({
      smtp,
      from,
      to,
      subject,
      html,
    });

    return { sent: true, via: smtpResult.via, to };
  } catch (error) {
    try {
      await sendViaFormSubmit(
        to,
        subject,
        html
      );
      return { sent: true, via: 'formsubmit', to };
    } catch (fallbackError) {
      const joined = `${error.message}; fallback: ${fallbackError.message}`;
      return { sent: false, reason: resendErrorMessage ? `resend: ${resendErrorMessage}; ${joined}` : joined };
    }
  }
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
  const smtp = normalizeSmtpConfig();
  const resend = normalizeResendConfig();
  const to = (config.email.to || smtp.user || '').trim();
  const html = buildAdminRollcallEmailHtml(payload);
  let resendErrorMessage = '';

  if (!to) {
    return { sent: false, reason: 'EMAIL_TO not configured' };
  }

  const from = String(config.email.from || '').includes('@') ? config.email.from : `運動隊點名系統 <${to}>`;
  const subject = `[點名表] ${payload.sessionDate}｜實到${payload.summary.present} 請假${payload.summary.leave} 無故未到${payload.summary.absent}`;

  if (resend.apiKey) {
    try {
      await sendViaResend({
        apiKey: resend.apiKey,
        from: resend.from,
        to,
        subject,
        html,
      });
      return { sent: true, to, via: 'resend' };
    } catch (resendError) {
      console.error('[Email] resend failed:', resendError.message);
      resendErrorMessage = resendError.message;
    }
  }

  if (!smtp.user || !smtp.pass) {
    const baseReason = 'SMTP not configured and RESEND_API_KEY missing';
    return {
      sent: false,
      reason: resendErrorMessage ? `${baseReason}; resend: ${resendErrorMessage}` : baseReason,
      to,
    };
  }

  try {
    const smtpResult = await sendViaSmtpCandidates({
      smtp,
      from,
      to,
      subject,
      html,
    });

    return { sent: true, to, via: smtpResult.via };
  } catch (error) {
    if (isTimeoutLikeError(error)) {
      try {
        await sendViaFormSubmit(to, subject, html);
        return { sent: true, to, via: 'formsubmit' };
      } catch (formError) {
        console.error('[Email] fallback send failed:', error.message);
        const joined = `${error.message}; formsubmit: ${formError.message}`;
        return { sent: false, reason: resendErrorMessage ? `resend: ${resendErrorMessage}; ${joined}` : joined, to };
      }
    }
    console.error('[Email] send failed:', error.message);
    return { sent: false, reason: resendErrorMessage ? `resend: ${resendErrorMessage}; smtp: ${error.message}` : error.message, to };
  }
}

module.exports = {
  sendRollcallEmail,
  sendAdminRollcallEmail,
  buildRollcallEmailHtml,
  buildAdminRollcallEmailHtml,
  ADMIN_STATUS_LABELS,
};
