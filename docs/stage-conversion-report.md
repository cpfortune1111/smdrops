# SMD 關卡 JSON 轉換成果（v1）

日期：2026-10-13  
原始資料：`E:\SMDrops-AssetDump-Full`（唯讀，未修改）

## 轉換結果

反編譯所得的 `SMStageDataImpl.Deserialize`、`SMTile`、`SMAttributeTile` 及 `SMTileInfo` 已重寫成獨立 Python 轉換器，並對整套關卡執行。

| 項目 | 數量 |
|---|---:|
| WW 基礎關卡 | 7,154 |
| JP 與 WW 完全相同、已自動去重 | 7,144 |
| JP 內容不同、保存為 override | 10 |
| JP 限定 ADV／Game Center 關卡 | 35 |
| 最終 catalog 項目 | 7,199 |
| 解析錯誤 | 0 |
| 未讀取尾段 | 0 |
| 棋盤座標錯位 | 0 |

輸出採用「WW base + JP overrides」結構，沒有重複保存 7,144 份相同 JSON。

## 關卡種類

WW 關卡的勝利條件分布：

| 勝利條件 | 數量 |
|---|---:|
| `COLLECT` | 1,287 |
| `CLEAN` | 1,062 |
| `GROWUP` | 965 |
| `DEFEAT` | 770 |
| `SCORE` | 718 |
| `EATEN` | 693 |
| `FIND` | 558 |
| `PAIR` | 490 |
| `ENEMY` | 358 |
| `GOAL` | 134 |
| `TALISMAN` | 65 |
| `STARGET` | 54 |

失敗條件包括 6,486 個步數制關卡及 668 個時間制關卡。全部配置使用 11×11 資料棋盤，但 `playArea` 會限制實際可玩範圍；Web 引擎不應假設每格都可使用。

資料版本包括 1 個 `10100`、7 個 `10110` 及 7,146 個 `10150`，轉換器已按原版的版本條件分支讀取，而不是假設所有檔案版本相同。

## 輸出結構

```text
stage-json/
├─ catalog.json
├─ audit.json
└─ stages/
   ├─ base/                 # 7,154 個 WW 基礎關卡
   └─ jp-overrides/         # 10 個日版差異 + 35 個 ADV 限定

stage-converter/
├─ smd_stage_converter.py
└─ README.md
```

`catalog.json` 是 Web Game 的關卡索引，不需要一次載入全部 252 MiB 未壓縮 JSON。遊戲可先載入 catalog，再按玩家目前地圖／活動延遲載入個別關卡。

每個關卡 JSON 包含：

- 原檔名、SHA-256、格式版本及 revision
- 系列、活動 ID、主／副關卡號
- 勝敗條件、步數／時間、三星分數、目標數量
- 可用顏色、開場 booster、局內 booster
- 特殊棋及 combo 分數
- Timer、Jewel、Cookie、Orb、Pearl 等生成規則
- Boss HP、位置、攻擊間隔、模式及弱點角色
- BGM、event code、segment code
- 棋盤尺寸、play area
- 每格的初始棋子、疊層障礙、掉落規則、Find、Warp、Familiar Spirit、Diana 路徑資料

Enum 同時保留數值及名稱，例如：

```json
{"kind":{"id":15,"name":"WALL"},"form":{"id":0,"name":"NORMAL"}}
```

這樣既方便閱讀，亦能忠實保存原版數值。

## 與其他重製系統的接合方式

今次的 stage schema 已保留後續系統需要的索引：

```text
地圖／期間活動
  └─ series + eventId + mainStage + subStage
       └─ 關卡規則與棋盤
            ├─ 角色／技能修正
            ├─ 通關星數與獎勵
            └─ 玩家存檔

通關獎勵
  ├─ 角色經驗／育成素材
  ├─ Puzzle Piece
  │    └─ 集齊後解鎖 Wallpaper
  └─ 活動貨幣／限定角色
```

角色育成、Puzzle Piece／Wallpaper、活動排期不應硬塞入關卡檔。它們會分成獨立資料表，再以 stage identity、reward ID、character ID 連接。這樣將來替換成原創媒體及角色時，毋須改動 Match-3 關卡本身。

## 建議接續次序

1. 從反編譯程式整理所有棋子、障礙物、勝利條件及特殊組合的實際行為。
2. 建立最小 Web Match-3 runtime，先跑 `SCORE`、`COLLECT`、`CLEAN` 三類關卡。
3. 加入角色資料、技能充能、升級與隊伍選擇。
4. 解碼 map／reward／item 資料，接通星數、Puzzle Piece、Wallpaper 解鎖。
5. 解碼 event setting，以本機活動日曆或永久活動選單取代已關閉的伺服器排程。

期間限定活動可以完整保留內容及規則，但私人離線版最好提供「依原日期輪替」和「自由開啟」兩種模式，避免內容再次因日期或伺服器而消失。

