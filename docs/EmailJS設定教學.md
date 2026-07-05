# EmailJS 設定教學（寄到 ben83127@gmail.com）

不用 Google Apps Script，直接用 **EmailJS** 從網頁寄信到你的 Gmail。  
免費方案每月約 200 封，點名用途足夠。

---

## 第一步：註冊 EmailJS

1. 前往 [https://www.emailjs.com](https://www.emailjs.com)
2. 用 **ben83127@gmail.com** 註冊（或你慣用的 Google 帳號）
3. 登入後到 **Dashboard**

---

## 第二步：連接 Gmail

1. 左側 **Email Services** → **Add New Service**
2. 選 **Gmail**
3. 按 **Connect Account**，登入 **ben83127@gmail.com**
4. 記下 **Service ID**（例如 `service_xxxxxxx`）

---

## 第三步：建立 Email 模板

1. 左側 **Email Templates** → **Create New Template**
2. 設定：

| 欄位 | 填寫 |
|------|------|
| **To Email** | `{{to_email}}` |
| **Subject** | `{{subject}}` |
| **Content** | 選 **HTML**，貼上：`{{{message_html}}}` |

3. 儲存，記下 **Template ID**（例如 `template_xxxxxxx`）

> 三個大括號 `{{{message_html}}}` 才能正確顯示 HTML 表格。

---

## 第四步：取得 Public Key

1. 左側 **Account** → **General**
2. 找到 **Public Key**（例如 `xxxxxxxxxxxxxxx`）

---

## 第五步：填入 index.html

編輯 `docs/index.html`（或改 template 後執行 `npm run build-static`），找到 `CONFIG`：

```javascript
const CONFIG = {
  PASSWORD: '12345',
  EMAIL_TO: 'ben83127@gmail.com',
  EMAILJS: {
    PUBLIC_KEY: '你的 Public Key',
    SERVICE_ID: 'service_xxxxxxx',
    TEMPLATE_ID: 'template_xxxxxxx',
  },
};
```

Push 到 GitHub 後，GitHub Pages 會自動更新。

---

## 第六步：測試

1. 開啟點名表網址，密碼 `12345`
2. 為每位隊員選一項 ○
3. 按 **送出點名表**
4. 檢查 **ben83127@gmail.com** 收件匣（含垃圾郵件）

---

## 常見問題

### 送出失敗 / 401
- Public Key、Service ID、Template ID 是否正確
- EmailJS 是否已連接 Gmail

### 信是純文字、表格跑版
- 模板 Content 要用 **HTML 模式**
- 變數要用 `{{{message_html}}}`（三個大括號）

### 收不到信
- 看 EmailJS Dashboard → **Logs** 是否有錯誤
- 檢查垃圾郵件匣

---

## 與 Google Apps Script 的差別

| | EmailJS | Google Apps Script |
|--|---------|-------------------|
| 設定難度 | 較簡單 | 較複雜 |
| 寫入試算表 | 否 | 是 |
| 寄 Email | 是 | 是 |
| 需部署腳本 | 否 | 是 |

若只需要 **寄 Email 到 ben83127@gmail.com**，用 EmailJS 即可。
