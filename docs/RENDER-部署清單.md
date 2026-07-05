# Render 部署清單（jak85710-ship-it）

GitHub 已就緒：https://github.com/jak85710-ship-it/line-rollcall-kaohsiung

## 一鍵建立 Render 服務

1. 開啟此連結（需登入 Render + 授權 GitHub）：

   **https://render.com/deploy?repo=https://github.com/jak85710-ship-it/line-rollcall-kaohsiung**

2. 或手動：**New → Blueprint** → 選上述 repo → 套用 `render.yaml`

3. 部署前在 Render 填寫 **Environment Variables**（見下方表格）

4. 部署完成後，複製服務網址，更新 `BASE_URL` 並重新部署

---

## 環境變數（必填）

| 變數 | 值 |
|------|-----|
| `BASE_URL` | `https://line-rollcall-kaohsiung.onrender.com`（改成你的實際網址） |
| `ADMIN_TOKEN` | `12345` |
| `SMTP_USER` | `ben83127@gmail.com` |
| `SMTP_PASS` | （Gmail 應用程式密碼，勿公開） |
| `EMAIL_FROM` | `運動隊點名系統 <ben83127@gmail.com>` |
| `EMAIL_TO` | `ben83127@gmail.com` |

## 環境變數（LINE 設定後填入）

| 變數 | 說明 |
|------|------|
| `LINE_CHANNEL_ID` | LINE Developers → Basic settings |
| `LINE_CHANNEL_SECRET` | 同上 |
| `LINE_CHANNEL_ACCESS_TOKEN` | Messaging API → Issue |
| `LIFF_ID` | LIFF App ID |
| `COACH_LINE_USER_IDS` | 教練 LINE ID（Bot 輸入「我的ID」取得） |

---

## 部署成功後測試

- 健康檢查：`https://你的網址/health`
- 後台：`https://你的網址/admin/`（密碼 12345）
- LINE Webhook：`https://你的網址/line/webhook`
- LIFF：`https://你的網址/liff/rollcall`

---

## LINE Developers 設定

詳見 [LINE-上架指南.md](./LINE-上架指南.md)
