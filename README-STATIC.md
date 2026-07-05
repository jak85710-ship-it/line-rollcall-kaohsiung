# 中山國小桌球隊 · 點名表

## 網頁版（LINE 群組記事本連結）

**https://jak85710-ship-it.github.io/line-rollcall-kaohsiung/**

- 密碼：`12345`
- Email 自動寄到：`ben83127@gmail.com`
- 介面與 `public/admin/index.html` **完全相同**

設定說明：[docs/設定教學.md](docs/設定教學.md)

## 本機版（npm start）

```powershell
npm start
# http://localhost:3000/admin/
```

使用 `.env` 的 Gmail SMTP 寄信（原本設定不變）。

## 更新網頁版

```powershell
npm run build-static
git add docs/index.html && git push
```

`build-static` 會從 `public/admin/index.html` 自動產生 `docs/index.html`，保證兩者一致。
