require('dotenv').config();

function parseList(value) {
  return (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

module.exports = {
  port: Number(process.env.PORT) || 3000,
  baseUrl: process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`,
  line: {
    channelId: process.env.LINE_CHANNEL_ID || '',
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
    channelSecret: process.env.LINE_CHANNEL_SECRET || '',
    liffId: process.env.LIFF_ID || '',
  },
  coachLineUserIds: parseList(process.env.COACH_LINE_USER_IDS),
  adminToken: process.env.ADMIN_TOKEN || '12345',
  google: {
    spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID || '',
    clientEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '',
    privateKey: process.env.GOOGLE_PRIVATE_KEY || '',
  },
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
  email: {
    from: process.env.EMAIL_FROM || '運動隊點名系統 <noreply@example.com>',
    to: process.env.EMAIL_TO || process.env.SMTP_USER || '',
  },
  resend: {
    apiKey: process.env.RESEND_API_KEY || '',
    from: process.env.RESEND_FROM || 'onboarding@resend.dev',
  },
};
