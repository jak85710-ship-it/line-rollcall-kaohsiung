/**
 * 從 public/admin/index.html 產生 docs/index.html（與原本後台一模一樣）
 * 用法：npm run build-static
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const adminHtml = fs.readFileSync(path.join(root, 'public/admin/index.html'), 'utf8');
const staticScript = fs.readFileSync(path.join(root, 'docs/static-app.js'), 'utf8');

const players = JSON.parse(fs.readFileSync(path.join(root, 'data/players.json'), 'utf8'))
  .filter((p) => p.is_active && p.name);

const scriptBody = staticScript.replace('__PLAYERS_JSON__', JSON.stringify(players));

const output = adminHtml.replace(/<script>[\s\S]*<\/script>/, `<script>\n${scriptBody}  </script>`);

fs.writeFileSync(path.join(root, 'docs/index.html'), output);
console.log(`✓ docs/index.html 已從 admin 模板產生（${players.length} 位隊員）`);
console.log('  密碼：12345｜Email：ben83127@gmail.com');
