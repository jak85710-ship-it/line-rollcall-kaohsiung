const line = require('@line/bot-sdk');
const config = require('../config');

const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: config.line.channelAccessToken,
});

async function verifyIdToken(idToken) {
  if (!config.line.channelId) {
    throw new Error('LINE_CHANNEL_ID 未設定');
  }

  const response = await fetch(
    'https://api.line.me/oauth2/v2.1/verify',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        id_token: idToken,
        client_id: config.line.channelId,
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LINE ID Token 驗證失敗: ${errorText}`);
  }

  return response.json();
}

async function getProfile(userId) {
  return client.getProfile(userId);
}

module.exports = {
  client,
  verifyIdToken,
  getProfile,
};
