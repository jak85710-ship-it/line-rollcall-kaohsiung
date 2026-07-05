/**
 * 從 data/players.json 重新產生 docs/index.html
 * 用法：node scripts/build-static-html.js
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const players = JSON.parse(fs.readFileSync(path.join(root, 'data/players.json'), 'utf8'))
  .filter((p) => p.is_active && p.name);

const template = fs.readFileSync(path.join(root, 'docs/index.template.html'), 'utf8');
const html = template.replace('__PLAYERS_JSON__', JSON.stringify(players));

fs.writeFileSync(path.join(root, 'docs/index.html'), html);
console.log(`✓ docs/index.html 已更新（${players.length} 位隊員）`);
