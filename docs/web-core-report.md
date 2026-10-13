# Moonlit Match Web Core — 實作報告

## 已完成

本機可玩 Web Game 核心已完成，第一關直接讀取先前由 `lvl_F_0001_00.bin.txt` 轉出的 JSON，而非將關卡重新手寫。

目前功能：

- 相鄰棋子交換及無效交換拒絕
- 橫向／直向三消
- 連鎖、重力跌落、自動補充
- 沒有合法移動時重新洗牌
- 五秒沒有操作時提示合法移動
- 四連產生橫／直線清除棋
- 五連產生 Rainbow 棋
- T／L 交叉產生範圍爆破棋
- 特殊棋連鎖觸發
- `SCORE`、`COLLECT`、`CLEAN` 三種勝利條件
- 步數、分數、三星門檻及結算畫面
- 角色技能充能及全色清除示範
- Puzzle Piece 進度及 Wallpaper 解鎖 placeholder
- 桌面及手機 responsive layout
- 全部視覺均為原創 CSS，不包含原版角色圖片、音樂或 Logo

## 驗證結果

- Node 語法檢查通過
- Score／Collect／Clean 三種引擎自動測試通過
- 真實第一關正確轉成 7×7 可玩區域
- 瀏覽器實際完成一次合法交換：步數 11 → 10、得分 180
- 清障測試顯示 49 個可玩格及 9 個障礙
- 收藏頁正常建立 9 塊拼圖格
- 瀏覽器 console：0 errors
- 本機 HTTP 頁面及關卡 JSON：HTTP 200

## 架構

```text
Converted stage JSON
        ↓
Stage adapter
        ↓
Pure Match-3 engine
        ├─ swap / match / cascade / gravity
        ├─ special pieces / shuffle / hint
        └─ objective / score / skill energy
        ↓
Browser UI
        ├─ stage HUD
        ├─ board renderer
        └─ local collection progress
```

角色育成、獎勵、Puzzle Piece、Wallpaper 及活動排期會維持獨立資料模組，再透過 `stage identity`、`character ID`、`reward ID` 連接，避免日後替換原創媒體時要重寫關卡引擎。

## 發佈狀態

目前交付為本機版本。由於關卡 JSON 是從 APK dump 衍生，安全機制沒有允許在未取得明確外傳授權前推送到遠端 Sites；因此並未上載原始 APK 資源或衍生關卡資料。可玩預覽已在本機瀏覽器開啟。

