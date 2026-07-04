require('dotenv').config();

const { initSheets } = require('../src/services/sheets');

const seedSample = process.argv.includes('--seed');

initSheets({ seedSample })
  .then(() => {
    console.log('完成！請至 Google Sheets 查看「隊員名單」與「點名紀錄」分頁。');
    process.exit(0);
  })
  .catch((error) => {
    console.error('初始化失敗:', error.message);
    process.exit(1);
  });
