# 手機方向盤

電腦執行模擬器，手機開啟獨立的 `controller.html`。手機傳送控制資料；畫面與物理運算留在電腦。可用 iPhone Safari、Android Chrome，感應器需要 HTTPS、授權以及實機校正。未授權時可使用觸控方向盤。

## 免費雲端部署（一次設定）

1. 登入 [Render](https://dashboard.render.com/)，使用 [Deploy to Render](https://render.com/deploy?repo=https://github.com/bboy800820/reverse_challenge) 從本儲存庫建立 Blueprint。
2. `render.yaml` 已指定 **Free**、Singapore、Node 22、`server` 目錄。確認為免費方案後部署；不需要資料庫或付費資源。名稱若已被使用可修改。
3. 等待服務顯示 Live，複製實際提供的 `https://…onrender.com` 網址。開啟其 `/health` 應回傳 `{"ok":true}`。
4. 在電腦模擬器點「連接手機」，貼上這個網址並建立配對。此電腦會記住網址。
5. 若要讓所有使用者自動使用這個服務，在 GitHub repository **Settings → Secrets and variables → Actions → Variables** 建立 `VITE_RELAY_URL`（值為服務網址），再重新執行 Pages workflow。這是公開網址，不是 API key。

目前程式與部署設定可獨立測試；沒有實際 Render URL 時，線上手機配對尚未可用。不要以猜測的服務網址作為預設值。

Render 免費服務無流量 15 分鐘後會休眠，首次重新連線可能需要約一分鐘；若失敗，等待後重新建立配對。免費額度與限制以 [Render 官方文件](https://render.com/docs/free) 為準。

## 練習流程

1. 電腦「連接手機」→「建立配對」→手機掃 QR Code。
2. 預設可直接拖曳方向盤。要用感應，點「啟用方向感應」，同意權限，將手機立起橫拿，點「校正置中」。
3. 手機點「開始／繼續」，選 R 或 D，再點「保持煞車中」放開。油門與煞車需按住；放開油門後 D/R 保留蠕行。踩煞車優先於油門。
4. 轉向幅度可選 30°/45°/70°，代表手機轉多少角度會到達最大車輪角度。改變幅度或螢幕方向需重新校正。
5. 鎖屏、切背景、斷線、逾時、重設場景或進出全螢幕會暫停並保持煞車。重新連線後按繼續才恢復，必要時重新校正。
6. 每個練習室只接受一支手機；兩小時後到期。關閉電腦頁面會結束房間。要恢復鍵盤，打開配對視窗點「結束手機控制，改用鍵盤」。空白鍵在手機控制時也可煞車。

## 開發與驗證

在 `server` 執行 `npm ci`、`npm start`；另在 `app` 執行 `npm ci`、`npm run dev -- --port 5189`。電腦打開 `http://127.0.0.1:5189/reverse_challenge/`，配對服務填 `http://127.0.0.1:8787`。

localhost 模式供同機瀏覽器自動測試；實際手機不能用電腦的 127.0.0.1，請使用 Pages + Render HTTPS 或自行配置可信任的本機 HTTPS。更換網站網域時，需同步設定 Render `ALLOWED_ORIGINS`（逗號分隔完整 origin，不能含路徑）。

- `cd server; npm test`：真實 WebSocket 連線、驗證、單手機、房間隔離、資料限制、斷線。
- `cd app; npm test`：原有物理與新增的遠端輸入安全、感應角度測試。
- `cd app; npm run build`：型別檢查與兩個入口打包。
- `python scripts/verify-phone-controller.py`：本機服務啟動後，獨立 Edge 上下文配對、操作、感應事件注入、斷線與不同尺寸。需 Python Playwright 和 Edge。

控制封包約 30Hz。電腦以 epoch、遞增序號及回傳的電腦時間判斷新鮮度，超過 600ms 不接受；100ms watchdog 會暫停並清除輸入。不是實測延遲保證。QR 的隨機憑證放在 URL fragment；服務無資料庫、不記錄控制封包，重啟後需重新配對。服務限定來源、2048-byte 訊息、每連線 100 訊息/秒、64 個房間、256 連線。

自動測試不代表實體手機驗證完成：iPhone 權限對話框、兩種橫向握持手感、Wi-Fi 延遲與鎖屏行為，需部署後使用實機確認。
