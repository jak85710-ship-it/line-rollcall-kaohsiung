# 中山國小桌球隊 · 點名表（純前端版）

> **目前使用方式：免伺服器、免 LINE 官方帳號**  
> 固定網址 → LINE 群組記事本 → 教練手機點名 → **EmailJS 寄信**

## 快速開始

1. **設定教學**：[docs/設定教學.md](docs/設定教學.md)
2. **Email 設定**：[docs/EmailJS設定教學.md](docs/EmailJS設定教學.md)
3. **點名表單**：`docs/index.html`（GitHub Pages 發布）

### 固定網址（開啟 GitHub Pages 後）

```
https://jak85710-ship-it.github.io/line-rollcall-kaohsiung/
```

密碼：`12345`

---

## 舊版 Node.js 伺服器

根目錄的 `server.js`、LINE Bot、Render 部署為**舊方案**，可忽略。  
新方案不需要 `npm start`、不需要 Render、不需要 LINE Developers。

---

## 更新隊員名單

```powershell
npm run import-roster   # 從 Excel 匯入（可選）
npm run build-static    # 重新產生 docs/index.html
git add docs/index.html && git commit -m "Update roster" && git push
```
