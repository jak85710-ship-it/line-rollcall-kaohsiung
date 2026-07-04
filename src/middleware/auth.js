const config = require('../config');
const { verifyIdToken } = require('../services/line');
const { isCoach } = require('../services/coach');

async function requireCoachAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : req.body?.idToken;

    if (!token) {
      return res.status(401).json({ error: '缺少 LINE ID Token' });
    }

    const profile = await verifyIdToken(token);

    if (!isCoach(profile.sub)) {
      return res.status(403).json({ error: '您沒有點名權限，請聯繫管理員' });
    }

    req.lineUser = {
      userId: profile.sub,
      name: profile.name || '教練',
      picture: profile.picture,
    };

    next();
  } catch (error) {
    console.error('[Auth] Coach verification failed:', error.message);
    return res.status(401).json({ error: 'LINE 驗證失敗，請重新登入' });
  }
}

function requireAdminAuth(req, res, next) {
  const token =
    req.headers['x-admin-token'] ||
    req.query.token ||
    req.body?.adminToken;

  if (token !== config.adminToken) {
    return res.status(401).json({ error: '管理員驗證失敗' });
  }

  next();
}

module.exports = {
  requireCoachAuth,
  requireAdminAuth,
};
