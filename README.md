# My To-Do List - 多人即時協作待辦清單應用程式

> 🌐 **線上體驗網址 (GitHub Pages)**: [https://chiayulai.github.io/My-To-Do-List/](https://chiayulai.github.io/My-To-Do-List/)

這是一個針對 Firebase 專案 **`my-to-do-list-c081d`** 打造的現代化多人即時協作待辦清單（To-Do List）網頁應用程式。

支援 **Google 帳號一鍵登入**、**多清單管理**、**專屬邀請代碼與分享連結加入**、**任務指派**、**優先級/截止日篩選** 以及 **Cloud Firestore 即時同步協作**。

---

## 🌟 核心特色

1. **Google 帳號快速登入**：採用 Firebase Authentication (Google Auth Provider)，自動同步個人頭像與使用者資料。
2. **多人即時協作 (Multi-User Collaboration)**：
   - 建立無限多個個人或協作清單（例如：家庭採買、產品衝刺、活動籌劃）。
   - **專屬 6 碼邀請碼 (如 `TD-A8B9C2`)**：好友只需點擊「加入」輸入代碼即可一鍵加入協作。
   - **分享網址 (Direct Invite Link)**：一鍵複製邀請連結（支援 `?invite=...` 參數），好友打開網頁自動加入。
   - **成員角色識別**：清晰區分「擁有者」與「協作者」。
3. **豐富的待辦功能**：
   - 任務完成度即時進度條（如：3 / 5 已完成，60%）。
   - 優先級標籤（🔥 緊急重要、⚡ 普通、☕ 較不急）。
   - 截止日期選擇與逾期智慧提醒。
   - 協作成員指派（「指派給特定成員」或「🙋 只看我」快速篩選）。
   - 即時關鍵字搜尋與狀態篩選（全部、進行中、已完成）。
4. **即時協作動態 (Activity Feed)**：
   - 右側側邊欄即時記錄隊友的動作（例如：「王小明 完成了 購買牛奶」、「李小華 新增了待辦事項」）。
5. **零相依性本地開發伺服器**：
   - 內建 PowerShell 高效 HTTP 伺服器，**無需安裝 Node.js、Python 或任何全域套件**，Windows 系統雙擊即可直接運行。

---

## 🚀 快速啟動

專案資料夾位置：
```
C:\Users\ASUS\.gemini\antigravity\scratch\My To-Do List
```

### 啟動方式：
1. **方式一（最簡單）**：在資料夾中雙擊 **`start.bat`**。
2. **方式二（PowerShell 指令）**：
   ```powershell
   cd "C:\Users\ASUS\.gemini\antigravity\scratch\My To-Do List"
   powershell -ExecutionPolicy Bypass -File .\start-server.ps1
   ```

伺服器將在 **`http://localhost:5000/`** 啟動，並自動在 Google Chrome / 預設瀏覽器中開啟應用！

---

## ⚙️ Firebase 專案設定 (`my-to-do-list-c081d`)

為了讓 Google 登入與雲端資料庫完整運作，請至 [Firebase Console](https://console.firebase.google.com/) 進行以下 3 步設定：

### 步驟 1：取得 Web App API Key
1. 進入 Firebase 控制台：[專案總覽 (my-to-do-list-c081d)](https://console.firebase.google.com/project/my-to-do-list-c081d/settings/general)
2. 在「**專案設定**」>「**一般**」下方找到「**你的應用程式**」。
3. 若尚未建立 Web App，請點擊 **新增應用程式 (</>)** 並輸入名稱 `My To-Do List`。
4. 複製產生的 `firebaseConfig` 中的 `apiKey`。
5. **填入設定（二選一）**：
   - **方式 A（網頁內填寫）**：直接在瀏覽器開啟應用，點擊右上角「**⚙️ Firebase 設定**」，貼上 API Key 並點擊儲存。
   - **方式 B（修改檔案）**：開啟 `firebase-config.js`，將 `apiKey: ""` 填入。

### 步驟 2：啟用 Google 登入
1. 前往 Firebase 控制台的 **Authentication** > **Sign-in method**。
2. 點擊「**新增提供者**」，選擇 **Google**。
3. 切換為「**啟用**」，選擇專案支援電子郵件，然後點擊「**儲存**」。
4. 進入「**已授權的網域**」，確認清單中包含 `localhost`（Firebase 預設已包含）。

### 步驟 3：建立 Firestore 資料庫並套用規則
1. 前往 Firebase 控制台的 **Firestore Database**。
2. 點擊「**建立資料庫**」，選擇「以實際工作模式啟動」或「以測試模式啟動」，並選擇離您最近的地點（如 `asia-east1` 台灣）。
3. 點擊「**規則 (Rules)**」分頁，將專案中的 `firestore.rules` 檔案內容完整貼上並點擊「**發佈 (Publish)**」。

---

## 📁 檔案結構說明

```text
My To-Do List/
├── index.html            # 應用主介面 (包含導航、清單管理、待辦面板與協作動態)
├── style.css             # 自訂動畫、樣式與滾動條美化
├── app.js                # Firebase Auth & Cloud Firestore 核心邏輯 (ES Modules)
├── firebase-config.js    # Firebase 專案設定與本機儲存快取
├── firestore.rules       # Cloud Firestore 安全性規則檔案
├── start-server.ps1      # PowerShell 零依賴本地 HTTP 伺服器
├── start.bat             # Windows 一鍵啟動腳本
└── README.md             # 本說明文件
```

---

## 👥 如何進行多人協作測試？

1. 在正常瀏覽器視窗中開啟 `http://localhost:5000/`，點擊「使用 Google 登入」，登入第一組 Google 帳號。
2. 點擊「+ 新增」建立一個協作清單（例如：「團隊衝刺事項」）。
3. 點擊清單右上方的「**邀請成員**」，點擊「**複製代碼**」（例如：`TD-AB1234`）或複製分享連結。
4. 開啟**無痕視窗 (Incognito)** 或另一個瀏覽器，同樣訪問 `http://localhost:5000/`，登入第二組 Google 帳號。
5. 點擊「加入」並貼上剛才的 6 位數邀請碼。
6. 此時兩邊的螢幕會**即時同步**！任一方新增、勾選完成、修改優先級或指派任務，另一方無需重新整理網頁即可秒級看到更新！
