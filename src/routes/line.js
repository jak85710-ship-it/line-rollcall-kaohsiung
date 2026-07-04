const express = require('express');
const line = require('@line/bot-sdk');
const config = require('../config');

const router = express.Router();

function getLineMiddleware() {
  if (!config.line.channelSecret) {
    return null;
  }
  return line.middleware({
    channelSecret: config.line.channelSecret,
  });
}

function getClient() {
  if (!config.line.channelAccessToken) {
    return null;
  }
  return new line.messagingApi.MessagingApiClient({
    channelAccessToken: config.line.channelAccessToken,
  });
}

function liffUrl() {
  if (config.line.liffId) {
    return `https://liff.line.me/${config.line.liffId}`;
  }
  return `${config.baseUrl}/liff/rollcall`;
}

function adminUrl() {
  return `${config.baseUrl}/admin/`;
}

function rollcallFlexMessage() {
  return {
    type: 'flex',
    altText: '中山國小桌球隊 · 開始點名',
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          {
            type: 'text',
            text: '中山國小桌球隊',
            weight: 'bold',
            size: 'lg',
            color: '#047857',
          },
          {
            type: 'text',
            text: '點名表已準備好，請點下方按鈕開始今日點名。',
            wrap: true,
            size: 'sm',
            color: '#475569',
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: '#059669',
            action: {
              type: 'uri',
              label: '開始點名',
              uri: liffUrl(),
            },
          },
          {
            type: 'button',
            style: 'secondary',
            action: {
              type: 'uri',
              label: '後台管理（網頁）',
              uri: adminUrl(),
            },
          },
        ],
      },
    },
  };
}

function welcomeMessages() {
  return [
    {
      type: 'text',
      text: [
        '歡迎使用中山國小桌球隊點名系統 👋',
        '',
        '• 輸入「點名」→ 開啟點名頁面',
        '• 輸入「後台」→ 管理員網頁點名表',
        '• 輸入「說明」→ 查看使用方式',
        '• 輸入「我的ID」→ 取得教練 LINE ID（設定權限用）',
      ].join('\n'),
    },
    rollcallFlexMessage(),
  ];
}

router.post('/webhook', (req, res, next) => {
  const middleware = getLineMiddleware();
  if (!middleware) {
    return res.status(503).json({ error: 'LINE Webhook 尚未設定' });
  }
  return middleware(req, res, next);
}, (req, res) => {
  Promise.all(req.body.events.map(handleEvent))
    .then(() => res.sendStatus(200))
    .catch((error) => {
      console.error('[Webhook] Error:', error);
      res.sendStatus(500);
    });
});

async function handleEvent(event) {
  const client = getClient();
  if (!client) return null;

  if (event.type === 'follow') {
    return client.replyMessage({
      replyToken: event.replyToken,
      messages: welcomeMessages(),
    });
  }

  if (event.type !== 'message' || event.message.type !== 'text') {
    return null;
  }

  const text = event.message.text.trim();

  if (text === '點名' || text === '開始點名') {
    return client.replyMessage({
      replyToken: event.replyToken,
      messages: [rollcallFlexMessage()],
    });
  }

  if (text === '後台' || text === '管理') {
    return client.replyMessage({
      replyToken: event.replyToken,
      messages: [
        {
          type: 'text',
          text: `後台點名表（密碼 12345）：\n${adminUrl()}`,
        },
      ],
    });
  }

  if (text === '我的ID' || text === 'myid') {
    const userId = event.source.userId || '無法取得';
    return client.replyMessage({
      replyToken: event.replyToken,
      messages: [
        {
          type: 'text',
          text: [
            '您的 LINE User ID：',
            userId,
            '',
            '請將此 ID 填入伺服器環境變數 COACH_LINE_USER_IDS，',
            '教練才能使用 LIFF 點名功能。',
          ].join('\n'),
        },
      ],
    });
  }

  if (text === '說明' || text === 'help') {
    return client.replyMessage({
      replyToken: event.replyToken,
      messages: [
        {
          type: 'text',
          text: [
            '【中山國小桌球隊點名系統】',
            '• 輸入「點名」→ LIFF 點名頁面',
            '• 輸入「後台」→ 網頁版完整點名表（5 種狀態）',
            '• 完成後按「確認送出」或「送出點名表」',
            '• 日報會 Email 寄至指定信箱',
          ].join('\n'),
        },
      ],
    });
  }

  return null;
}

module.exports = router;
