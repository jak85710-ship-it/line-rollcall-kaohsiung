# 不用 GitHub 的上架方式

若不想使用 GitHub，可以用 **Railway** 從本機資料夾直接部署，**完全不需要 GitHub**，也不會碰到你電腦裡的其他專案。

---

## 先說明：GitHub 會不會影響其他資料？

**不會。** 在 GitHub 新建一個 repository，就像多開一個資料夾，**不會讀取、修改或刪除**你帳號裡的其他 repo。

若仍不想用 GitHub，下面方式更適合你。

---

## 推薦方案：Railway（本機直接上傳）

Railway 可從你的電腦**直接把專案資料夾傳上去**，流程類似「上傳 zip」，不需要 GitHub。

### 你需要準備

- 一組 **Railway 帳號**（可用 Google 登入）：[railway.app](https://railway.app)
- 本機專案資料夾：`C:\Users\USER\Projects\line-rollcall-kaohsiung`

### 步驟 1：安裝 Railway CLI

PowerShell 執行：

```powershell
npm install -g @railway/cli
```

### 步驟 2：登入 Railway

```powershell
railway login
```

瀏覽器會開啟，用 Google 或 Email 登入即可。

### 步驟 3：在專案資料夾初始化

```powershell
cd C:\Users\USER\Projects\line-rollcall-kaohsiung
railway init
```

- 選 **Create new project**
- 專案名稱可填：`line-rollcall-kaohsiung`

### 步驟 4：上傳並部署

```powershell
railway up
```

這會把**目前這個資料夾**的程式直接傳到 Railway 並啟動，**不經過 GitHub**。

### 步驟 5：設定公開網址

1. 到 [railway.app/dashboard](https://railway.app/dashboard) 開啟你的專案
2. 點服務 → **Settings** → **Networking**
3. 點 **Generate Domain**，取得網址，例如：
   ```
   https://line-rollcall-kaohsiung-production.up.railway.app
   ```

### 步驟 6：設定環境變數

在 Railway 專案 → **Variables**，新增：

| 變數 | 值 |
|------|-----|
| `BASE_URL` | 上一步的 Railway 網址 |
| `ADMIN_TOKEN` | `12345` |
| `SMTP_USER` | `ben83127@gmail.com` |
| `SMTP_PASS` | Gmail 應用程式密碼 |
| `EMAIL_FROM` | `運動隊點名系統 <ben83127@gmail.com>` |
| `EMAIL_TO` | `ben83127@gmail.com` |
| `LINE_CHANNEL_ID` | （LINE 設定後填入） |
| `LINE_CHANNEL_SECRET` | |
| `LINE_CHANNEL_ACCESS_TOKEN` | |
| `LIFF_ID` | |
| `COACH_LINE_USER_IDS` | （教練 LINE ID，可先留空） |

儲存後 Railway 會自動重新部署。

### 步驟 7：測試

瀏覽器開啟：

```
https://你的網址/health
```

看到 `{"status":"ok",...}` 代表部署成功。

### 之後要更新程式

改完本機程式後，在同一資料夾再執行一次：

```powershell
railway up
```

就會更新線上版本，**仍然不需要 GitHub**。

---

## 接 LINE（與 GitHub 無關）

部署成功取得 HTTPS 網址後，到 [LINE Developers](https://developers.line.biz/console/) 設定：

| 項目 | 網址 |
|------|------|
| Webhook | `https://你的網址/line/webhook` |
| LIFF Endpoint | `https://你的網址/liff/rollcall` |

詳細步驟見：[LINE-上架指南.md](./LINE-上架指南.md) 的「第二步」之後。

---

## 其他替代方案（也不用 GitHub）

### 方案 B：Fly.io（本機 CLI 部署）

```powershell
# 安裝
powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"

# 登入與部署
cd C:\Users\USER\Projects\line-rollcall-kaohsiung
fly launch
fly deploy
```

適合熟悉指令的使用者，同樣從本機直接上傳。

### 方案 C：只在本機使用（不上雲端）

若暫時只需要**後台點名表**，可以：

```powershell
cd C:\Users\USER\Projects\line-rollcall-kaohsiung
npm start
```

同一台 WiFi 的平板/手機開：`http://你的電腦IP:3000/admin/`

- 優點：完全不用任何雲端帳號
- 缺點：**無法接 LINE**（LINE Webhook 需要固定 HTTPS 網址）

### 方案 D：Cloudflare Tunnel（進階）

電腦開著時可暫時提供 HTTPS 給 LINE 測試，不適合正式長期使用。

---

## 方案比較

| 方案 | 需要 GitHub | 可接 LINE | 24 小時運行 | 難度 |
|------|-------------|-----------|-------------|------|
| **Railway 本機上傳** | 否 | 是 | 是 | ★★☆ |
| Fly.io 本機上傳 | 否 | 是 | 是 | ★★★ |
| 本機 npm start | 否 | 否 | 否（電腦要開） | ★☆☆ |
| GitHub + Render | 是 | 是 | 是 | ★★☆ |

---

## 建議你現在這樣做

1. 註冊 [railway.app](https://railway.app)
2. 執行 `npm install -g @railway/cli`
3. 執行 `railway login` → `railway init` → `railway up`
4. 在 Railway 設定 Variables 與公開網址
5. 到 LINE Developers 設定 Webhook 與 LIFF

若你願意，回覆「我要用 Railway」，我可以一步步帶你執行每一道指令。
