/**
 * 建立 LINE Rich Menu（選單列）
 * 使用前請在 .env 填好 LINE_CHANNEL_ACCESS_TOKEN、LIFF_ID、BASE_URL
 *
 * 執行：node scripts/setup-rich-menu.js
 */
require('dotenv').config();

const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const liffId = process.env.LIFF_ID;
const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

if (!token) {
  console.error('請先在 .env 設定 LINE_CHANNEL_ACCESS_TOKEN');
  process.exit(1);
}

const liffUrl = liffId ? `https://liff.line.me/${liffId}` : `${baseUrl}/liff/rollcall`;
const adminUrl = `${baseUrl}/admin/`;

async function api(path, options = {}) {
  const res = await fetch(`https://api.line.me${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(JSON.stringify(data));
  }
  return data;
}

async function main() {
  console.log('建立 Rich Menu...');

  const { richMenuId } = await api('/v2/bot/richmenu', {
    method: 'POST',
    body: JSON.stringify({
      size: { width: 2500, height: 843 },
      selected: true,
      name: '桌球隊點名選單',
      chatBarText: '點名選單',
      areas: [
        {
          bounds: { x: 0, y: 0, width: 1250, height: 843 },
          action: { type: 'uri', label: '開始點名', uri: liffUrl },
        },
        {
          bounds: { x: 1250, y: 0, width: 1250, height: 843 },
          action: { type: 'uri', label: '後台管理', uri: adminUrl },
        },
      ],
    }),
  });

  console.log('Rich Menu ID:', richMenuId);
  console.log('');
  console.log('⚠️  還需上傳選單圖片才能顯示。請到 LINE Official Account Manager：');
  console.log('   選單設計 → Rich menus → 選擇此選單 → 上傳 2500×843 圖片');
  console.log('');
  console.log('或使用 LINE Developers Console 上傳圖片後，執行：');
  console.log(`   curl -X POST https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content \\`);
  console.log('     -H "Authorization: Bearer YOUR_TOKEN" \\');
  console.log('     -H "Content-Type: image/png" \\');
  console.log('     --data-binary @richmenu.png');
  console.log('');
  console.log('設為預設選單...');

  await api(`/v2/bot/user/all/richmenu/${richMenuId}`, { method: 'POST' });
  console.log('✓ Rich Menu 已設為預設（需有圖片才會顯示）');
}

main().catch((err) => {
  console.error('失敗:', err.message);
  process.exit(1);
});
