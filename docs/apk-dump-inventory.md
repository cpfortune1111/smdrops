# Sailor Moon Drops APK Dump：唯讀 Inventory 與 Web Remake 初步評估

盤點日期：2026-10-13  
來源：`E:\SMDrops-AssetDump-Full`  
方式：只讀取原資料夾；未修改、重新命名或刪除任何來源檔案。為辨識 managed assembly 類型，僅把 WW APK 內的 DLL 複製到工作區暫存分析。

## 1. 結論摘要

這份 dump 足以作為「重新實作」Sailor Moon Drops 類型 Web Game 的主要技術參考，而且比普通美術資源包完整得多：它包含兩個 1.29.0 APK、可反射／反編譯的 Unity Mono C# assembly、7,000 多份關卡變體資料、地圖／故事／技能／角色設定、大量 PNG、WAV、Unity asset bundles，以及 159 個整理過的 Live2D 角色包。

但它不是完整 Unity 原始專案，也不能直接一鍵轉成 Web。正確方向是：

1. 反編譯 C#，建立行為規格；
2. 解碼二進位關卡及 master data，轉成 JSON；
3. 在 TypeScript／Canvas 或 WebGL 上重寫 puzzle engine；
4. 以離線本機系統取代已關閉的 server、社交與課金服務；
5. 經授權後才使用原 IP 圖像、角色、音樂、語音與商標。

初步可行性：

| 範圍 | 可行性 | 判斷 |
|---|---:|---|
| 核心三消玩法重寫 | 高 | C# 邏輯、類型、方法名稱與關卡資料均存在 |
| 特殊棋子／技能／障礙還原 | 高至中 | 規則可由 `PuzzleManager`、`GameStatePuzzle` 和資料類別重建，但仍要驗證細節與 timing |
| 地圖、角色成長、故事、收藏 | 中至高 | 大量資料與 UI 資源存在；server-dependent 流程須改成本機版 |
| Live2D 角色演出 | 中 | Cubism 2 格式素材完整度高，但 Web runtime 相容、授權與個別壞檔需處理 |
| 1:1 完整復刻所有內容 | 中至低 | asset bundles 明示並非完整，server、save、metadata、部分活動圖和原 Unity project 缺失 |
| 原 APK 直接移植成 Web | 低 | Unity 5.2.5 Android build，應視為逆向參考而非可移植專案 |

## 2. 全庫概況

排除 `__MACOSX`、AppleDouble `._*` 和 `.DS_Store` 後：

- 25,252 個檔案
- 4.025 GiB
- 16,004 個 `.txt`，約 118.8 MiB
- 5,716 個 `.unity3d`，約 1,118.2 MiB
- 2,822 個 `.png`，約 984.4 MiB
- 699 個 `.wav`，約 1,353.8 MiB
- 7 個外層角色 `.zip`，約 432.1 MiB
- 2 個 `.apk`，約 114.7 MiB

注意：大量 Unity bundle 同時保存 `Original` 和 `Decrypted`，所以檔案數及容量包含功能上重複的加密／解密副本。

## 3. 根目錄

| 項目 | 內容 |
|---|---|
| `smdrops-jp-1.29.0.apk` | JP 最終 Android APK，60,903,329 bytes |
| `smdrops-ww-1.29.0.apk` | 國際版 Android APK，59,326,617 bytes |
| `Characters` | 7 個巢狀 ZIP，159 個 Live2D 角色／服裝包 |
| `Files (JP)` | 14,768 檔案，約 2.036 GiB |
| `Files (WW)` | 10,488 檔案，約 1.455 GiB |
| `READ ME FIRST.txt` | dump 作者的結構、缺失及解密說明 |
| `__MACOSX` | macOS 封裝雜項，可忽略 |

## 4. APK 與程式碼

### 技術棧

- Unity `5.2.5f1`，版本字串直接存在 APK 的 `assets/bin/Data/mainData`。
- Mono managed build，不是 IL2CPP。
- WW APK：9,355 entries，解壓後約 256.5 MB。
- JP APK：9,559 entries，解壓後約 265.5 MB。
- 兩版均含 `classes.dex`、`libmono.so`、`libunity.so`、Unity data 及 managed DLL。

### 主要 managed assemblies

| Assembly | WW 大小 | 說明 |
|---|---:|---|
| `Assembly-CSharp.dll` | 5,426,176 bytes | 主要遊戲程式；可列出 3,067 個 types |
| `Assembly-CSharp.dll`（JP） | 6,430,720 bytes | 比 WW 大，包含 JP-only ADV／Game Center 系統 |
| `Assembly-CSharp-firstpass.dll` | 56,832 bytes | 早期編譯插件程式 |
| `Live2DUnity.dll` | 792,064 bytes | Live2D Unity runtime integration |
| `UnityEngine.dll` | 403,456 bytes | Unity 5 時代 managed API |
| `UnityEngine.UI.dll` | 200,704 bytes | Unity UI |
| `P31RestKit.dll` | 40,448 bytes | REST/network helper |
| `ICSharpCode.SharpZipLib.dll`、`Ionic.Zip.CF.dll` | 約 68–71 KB | 壓縮／存檔處理 |

### 已確認的遊戲邏輯

主要類別包括：

- `PuzzleManager`
- `GameStatePuzzle`
- `SMStageData` / `SMStageDataImpl`
- `StageCreator`
- `PuzzleTile` / `TileData`
- `SkillEffectData`
- `CompanionData`
- `StoryCommandData` / `StoryDemoData`
- `GameMain` / `GameStateManager`
- `GameConnectManager` 與約 38 個 `Connect*` 類型
- 地圖、活動、每日挑戰、收藏、玩家存檔及商店類型

`PuzzleManager` 的方法名稱直接顯示核心行為，包括 swap、match、fall、shuffle、combo、clear bonus、技能、booster、boss gimmick，以及以下特殊組合：

- Wave + Wave
- Wave + Bomb
- Wave + Rainbow
- Bomb + Bomb
- Bomb + Paint
- Bomb + Rainbow
- Paint + Paint
- Paint + Rainbow
- Rainbow + Rainbow

也可看到 `Skill_TransformRainbow`、`Skill_TransformBomb`、`Skill_TransformWave`、`Skill_GimmickBreak`、`Skill_Shuffle`、`Skill_Swap` 等技能實作入口。

### 已確認的關卡勝負條件

`STAGE_WIN_CONDITION` 包含：

`SCORE`, `COLLECT`, `EATEN`, `CLEAN`, `ALL_CLEAN`, `SPECIAL_EATEN`, `PAIR`, `TIMER`, `FIND`, `DEFEAT`, `ENEMY`, `GROWUP`, `GOAL`, `TALISMAN`, `STARGET`。

`STAGE_LOSE_CONDITION` 包含：

`MOVES`, `TIME`, `NO_MATCH`, `TIMER_TIMEOUT`。

因此 dump 不只提供畫面素材，還保留了相當完整的 gameplay vocabulary 和控制流程。

## 5. 關卡及資料檔

### 關卡數量

| 區域 | `lvl_*` 總數 | 主線系列變體 | 活動變體 | JP ADV |
|---|---:|---:|---:|---:|
| JP | 7,189 | 1,188 | 5,966 | 35 |
| WW | 7,154 | 1,188 | 5,966 | 0 |

「變體」很重要：檔名尾端 `_00`, `_01` 等表示同一 stage 可能有多個版本／難度／revision，不能把 7,154 當成 7,154 個獨立關卡。

主線 prefix 與檔案數：

- `STARS`: 274
- `F`: 260
- `S`: 205
- `R`: 156
- `SS`: 155
- `GF00`: 138

### 其他主要資料

每個 JP／WW `Text Files` 資料夾各有約 8,000 個檔案。副檔名雖為 `.txt`，多數實際上仍是帶 NUL bytes 的自訂二進位序列化資料，不是可直接編輯的文字或 JSON。

已確認數量：

- 398 個 `Event_*` 劇情／活動資料
- 208 個 `STORY_*` 主故事資料，另有少量其他 story files
- 126 個 `NewEventPage_*`
- 11 個 `MESSAGE_*`
- 2 個 tutorial scripts
- 6 個 `NewMapPage*` 及多個 `Map_*`
- `Language.txt`：JP 約 481 KB、WW 約 383 KB
- `Accessories.bin.txt`
- `Companion.bin.txt`
- `SkillEffect.bin.txt`
- `Tile.bin.txt` / JP `TileAdv.bin.txt`
- `StoryDemoData.bin.txt`
- `DailyChallenge.txt`
- `TrophyMission.bin.txt`
- JP-only `AdvMasterTable.bin.txt`, `AdvStageData.bin.txt`, enemy／wave／skill data

### 關卡 schema 可恢復程度

`SMStageData` 的反射結果顯示關卡資料包含：

- series、stage/event ID、main/sub stage number、revision
- 棋盤 width/height、play area 矩形、grid data
- 可用顏色及 candy 種類數
- 步數／時間限制
- bronze/silver/gold 分數
- collect／ingredient／paper／pair 目標
- booster slots
- 特殊棋子及 combo 參數
- timer、jewel、cookie、orb、foot piece、pearl 生成頻率及上限
- boss HP、位置、攻擊間隔、攻擊 pattern、弱點角色
- stencil/find data、Diana path data
- BGM、event／segment／test code

這代表可藉由反編譯 `SMStageDataImpl` 的讀取函式，建立可靠的 binary-to-JSON converter；目前尚未做完整解碼及逐關驗證。

## 6. 圖像與 UI

### PNG

- JP：2,153 PNG，約 634.3 MiB；包含大量 ADV figures。
- WW：669 PNG，約 350.1 MiB。
- 常見尺寸：`512x512`, `1024x1024`, `2048x2048`, `512x1024`, `1024x2048`。
- JP 額外有大量 `128x128`、`256x256` figure icon／mini assets。

可識別內容包括：

- puzzle tiles、HUD、background
- boosters、技能效果
- 世界地圖及 event maps
- event banners／appeals
- collection、episode icons
- wallpapers
- tips、dialog、shop、story UI
- JP ADV enemy、figure、HUD 及 minigame images

許多大圖是 sprite atlas，而不是可直接逐件使用的 UI 元件；切片矩形、pivot、動畫順序需要由 Unity bundle 或對應資料恢復。

## 7. Unity asset bundles

全部共有 5,716 個 `.unity3d`，數字包含 Original／Decrypted 成對副本。

| 區域 | Decrypted bundles | 約大小 |
|---|---:|---:|
| JP Main | 706 | 196.8 MiB |
| JP ADV | 84 | 5.3 MiB |
| JP ADV Figures | 1,320 | 151.3 MiB |
| WW Main | 748 | 205.8 MiB |

WW decrypted bundles 中可識別：

- 311 個 `atlas_*`
- 172 個 `audio_*`
- 172 個 `partner_*` Live2D／角色 bundles
- 大量 event、map、skill bundles

這些 bundle 對還原 atlas metadata、prefab references、AudioClip、Live2D runtime data 和 UI 動畫很重要。不過 dump 作者已明確指出，bundle 集合取自最後一次下載狀態，舊版本中已被刪除的檔案並不完整。

## 8. Live2D 與動畫

`Characters` 內共有 159 個整理過的角色／服裝 ZIP：

| 分組 | 包數 |
|---|---:|
| Inner Senshi | 54 |
| Misc | 30 |
| Outer Senshi | 23 |
| Pairs | 7 |
| Special Episode | 3 |
| Starlights | 9 |
| Villains | 33 |

抽樣 `SMDrops - Sailor Moon.zip` 已確認包含：

- `model.moc`：Live2D Cubism 2 model
- `model.json`
- texture PNG
- `.mtn` motions：wait、talk、hit、jump、skill、win、lose、death 等
- `.exp.json` expressions
- `physics.json`
- 原始未拆版 `model.json`
- 手動載入說明

因此角色動作資料的保存狀況相當好。風險是部分 package 的 `model.json`／physics 已知不能直接在 Viewer 開啟；此外 Cubism 2 Web runtime 的合法取得、相容性和打包方式必須另行確認。若不能使用相容 runtime，可考慮預先渲染成 sprite／video，但互動性和檔案大小會受影響。

Unity UI 動畫、particle、tween 和 skill effect 並未被整理成 Web animation timeline；這些仍需由 bundles／C# 行為重建。

## 9. 音效與音樂

| 區域 | 總 WAV | BGM | SE/JIN | Sailor Moon voice | 大小 |
|---|---:|---:|---:|---:|---:|
| JP | 350 | 41 | 275 | 34 | 683.9 MiB |
| WW | 349 | 40 | 275 | 34 | 669.9 MiB |

抽樣格式：

- BGM：PCM WAV、44.1 kHz、stereo；例 `SM01_001_BGM.wav` 約 46.05 秒。
- SE：PCM WAV、44.1 kHz、stereo。
- voice：PCM WAV、48 kHz、mono。

Web 版不宜原樣發佈 1.35 GiB WAV；應轉成瀏覽器支援的壓縮格式，並保留 loop point／播放時機。兩區大量音訊重複，內容 pipeline 應先去重。

已知音訊缺口：BGM 17 看來從未存在；BGM 999 在版本間有替換，JP dump 另保存 `Moonlight Densetsu` 備份。

## 10. 明確缺失與風險

### 技術缺失

- 沒有 Unity 原始 project、`Assets` tree、scene/prefab source、import settings 或版本控制歷史。
- 沒有原始 `.cs` source；只有可反編譯的 IL assembly。
- 沒有正式 backend/server、資料庫、API response corpus 或營運後台。
- dump 作者明示沒有包含 metadata 與 save data。
- server shutdown 後，登入、驗證、遠端下載、排名、好友、gift、課金、活動時間表等流程不能原樣運作。
- Unity bundles 並非歷史全集；最後更新前被移除的內容可能只留下已抽出的圖／音訊，甚至完全缺失。
- `.txt` 資料仍需依照 C# serializer 解碼，尚未形成可直接使用的 JSON schema。
- atlas slicing、pivot、particle、tween、UI animation 必須額外恢復。
- Live2D 個別 package 有已知壞 `model.json`／physics 問題。

### dump README 列出的內容缺口

- JP：EventAppeal 030 以前及 rerun 065 以前可能不存在或已刪除。
- JP：Game Center event announcements 15–18 不確定是否曾存在。
- JP：Prince Dimande `EventAppeal059` 明確缺失。
- WW：EventAppeal 034–042、044–060 多項缺失或來源不明。
- 部分早期 event maps 只有單一語言版本。

### 權利與發佈風險

技術上能還原，不代表有權公開發佈。角色、名稱、Logo、劇情、插圖、Live2D、音樂、語音及商標均可能受權利保護；dump 本身也不構成授權。若目標是公開 Web Game，應先決定：

- 取得正式授權；或
- 只用逆向結果理解玩法，改用原創 IP、原創美術與音訊；或
- 把研究限制在私人保存／互通性範圍，並另行取得專業法律意見。

## 11. 建議開發階段

### Phase 0 — 保存與範圍鎖定

- 對來源檔產生 SHA-256 manifest，保留 immutable baseline。
- 決定「玩法重製」還是「原 IP 復刻」，先處理授權邊界。
- 定義第一版只做離線單機，排除好友、排名、課金及遠端活動。

### Phase 1 — Forensics 與資料轉換

- 完整反編譯 JP／WW `Assembly-CSharp.dll`。
- 找出 `SMStageDataImpl`、master table、story、language 的讀取／解密函式。
- 建立 `lvl_*.bin` → JSON converter。
- 選 20 個代表關卡交叉驗證棋盤、目標、障礙、步數及 boss。
- 從 bundles 匯出 atlas metadata、AudioClip 名稱、prefab references。

### Phase 2 — Core Web Vertical Slice

- TypeScript + Canvas/WebGL 實作 swap、match、fall、refill、cascade、shuffle。
- 實作 wave、bomb、rainbow、paint 及特殊組合。
- 支援 moves/time、score、collect、clean、pair 等基本勝負條件。
- 先用原創 placeholder，完成 5–10 個可玩的代表關卡。

### Phase 3 — 障礙、角色與技能

- 依 `TileData`／`SMStageData` 加入 wall、paper、ingredient、orb、find、boss 等 gimmick。
- 建立 data-driven skill registry。
- 整合一個 Live2D 角色或 sprite fallback，完成 wait／hit／skill／win／lose。

### Phase 4 — Meta Game 與離線替代

- 世界地圖、關卡解鎖、星星、收藏、角色升級、故事播放器。
- IndexedDB/local save；加入 schema version 與 migration。
- 移除或 stub 原 server、social、ranking、IAP、gift 流程。

### Phase 5 — Content Migration

- 批次轉換經授權的圖片、音訊、故事、關卡及角色資料。
- atlas 切片、音訊壓縮、資源 manifest、按需載入和 cache。
- 建立自動驗證：缺 asset、無解棋盤、無合法 move、錯誤目標、壞 Live2D reference。

### Phase 6 — QA 與發佈

- 以原 APK 錄影／實機行為作對照測試。
- 調整 scoring、RNG、cascade、技能 timing 與動畫節奏。
- 行動裝置效能、記憶體、觸控、離線 cache、PWA 測試。
- 進行授權、隱私與發佈審查。

## 12. 下一輪最有價值的檢查

1. 反編譯 `SMStageDataImpl` 的 deserialize 方法，實際轉出 3–5 個關卡 JSON。
2. 對 `PuzzleManager` 建立「方法 → 遊戲規則」對照表。
3. 選一個 `partner_*` bundle 與整理版角色 ZIP，驗證 Web Live2D 播放。
4. 解析一個 atlas，確認 sprite rect/pivot 能否完整恢復。
5. 列出所有 network endpoints 及需要離線替代的功能，但不連線或呼叫舊 server。

完成這五項後，才適合估算完整 remake 的人月、內容覆蓋率及 MVP 範圍。

