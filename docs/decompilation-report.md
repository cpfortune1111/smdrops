# Sailor Moon Drops 1.29.0 反編譯報告

日期：2026-10-13  
來源：`E:\SMDrops-AssetDump-Full`（全程唯讀）

## 結論

WW（國際版）及 JP（日版）APK 的主要遊戲程式 `Assembly-CSharp.dll` 已成功反編譯成可閱讀的 C# 專案。輸出可用來研究原版資料格式、遊戲流程及重製 Web Game，但它不是原始 Unity 專案，亦不能直接一鍵重新建置成原版 APK。

| 項目 | WW | JP |
|---|---:|---:|
| 反編譯 C# 檔案 | 1,085 | 1,210 |
| 專案檔 | `Assembly-CSharp.csproj` | `Assembly-CSharp.csproj` |
| 反編譯工具 | ILSpyCmd 8.2.0.7535 | ILSpyCmd 8.2.0.7535 |
| Unity 版本 | 5.2.5f1 | 5.2.5f1 |
| 腳本後端 | Mono／Managed DLL | Mono／Managed DLL |

JP 多出的程式主要包括日版限定的 ADV／Game Center 功能。兩版輸出已分開保存，方便做差異比較。

## README 所講的「完整」代表甚麼

`READ ME FIRST.txt` 原文將 dump 定義為「盡力做到幾乎完整的圖片及音效集合」，並列出已知缺失；它沒有聲稱保存了原始 Unity 工程、伺服器程式、建置設定或玩家存檔。

目前證據支持以下判斷：

- 關卡布局檔大量存在，而且反編譯程式碼包含完整的反序列化邏輯。
- 劇情／對話指令檔及本地化文字表存在，而且格式已由程式碼及實際檔案交叉驗證。
- 圖像、音效、Live2D 與多數下載內容很豐富，但 README 明列部分活動公告及少量音樂缺失；Unity3D bundle 集合亦明確標示為不完整。
- 原版伺服器、API 回應、帳號資料、營運後台、原始 Unity scene／prefab 關聯和正式 build pipeline 並不在 dump 內。

所以「可重製主要單機體驗」是合理目標；「由現有檔案直接還原原版 App」則不現實。

## 關卡資料確認

主要入口及格式定義可在反編譯檔案中找到：

- `SMStageData.cs`：載入本機或下載的關卡資料，再呼叫反序列化。
- `SMStageDataImpl.cs`：完整讀取關卡二進位格式。
- `BIJBinaryReader.cs`：確認數字及字串使用大端序。
- `JsonExtension.cs`：原程式本身已有將 `SMStageDataImpl` 轉成 JSON 的方法。

關卡檔特徵：

- 檔頭標記：`SMD`
- 現行資料版本：`10150`
- 整數及浮點數：大端序
- 字串：2-byte 大端序長度 + UTF-8
- 內容涵蓋關卡／活動編號、步數或時間限制、勝敗條件、星級分數、目標、可用 booster、BGM、Boss、掉落規則、棋盤大小，以及每格的棋子、屬性、障礙與 warp 等資料。

這代表關卡不需要靠圖片或人工重畫；下一階段可根據反編譯結構批量轉成 Web Game 使用的 JSON。

## 劇情及對話資料確認

`StoryDemoManager` 會讀取故事檔，而 `StoryCommandData` 定義每條指令：

1. 檔頭通常是一個 2-byte 大端序指令數量。
2. 每條指令固定由 7 個 UTF-8 字串組成：`command`、`param0` 至 `param5`。
3. `TEXT` 指令以參數引用 `Language.txt` 的角色名及對白 key。

WW 及 JP 各自核對結果：

| 類型 | 檔案數 |
|---|---:|
| `STORY_*` | 208 |
| `EVENT_*` | 56 |
| `MESSAGE_*` | 11 |
| `TUTORIAL_*` | 2 |
| 合計 | 277 |

每版共解析到 23,993 條指令、3,420 條 `TEXT` 指令、31 種指令類型；沒有遇到無法解析的正式腳本。常見指令包括角色進出、移動、動作、表情、對話、背景、BGM、音效、閃光及震動。

有兩點要特別處理：

- `STORY_180.bin.txt`、`STORY_182.bin.txt`、`STORY_193.bin.txt` 的檔頭 count 只覆蓋前段，但其後仍是格式正確的 7-string 指令。轉換器應在完成 count 後繼續讀取完整紀錄直至 EOF。
- 185 個 `Event_Demo082_*`／`Event_Demo083_*` 對白 key 不存在於兩版隨 APK 提供的 `Language.txt`。腳本本身存在，但對應顯示文字很可能原本來自已下載／更新的語言資料，或在最後版本被移除。因此「劇情指令完整」不等於每句事件文案都能由目前文字表還原。

另請注意：大寫 `EVENT_*` 是正式故事腳本；細寫 `Event_*` 是另一類事件設定資料，不應用故事格式解析。

## 反編譯輸出的限制

- 變數名稱、註解、Unity Inspector 設定及原始資料夾結構無法恢復。
- 專案仍依賴 Unity 5.2.5、UnityEngine DLL 及多個舊版第三方插件；反編譯 `.csproj` 主要供閱讀及搜尋，不保證直接編譯。
- 圖像、動畫、Live2D、音效及 AssetBundle 要另做索引和格式轉換，不能單靠 C# 專案還原。
- 伺服器功能應以本機資料層重新實作，而不是嘗試重建已關閉的服務。

## 建議下一階段

1. 製作唯讀轉換器，把全部關卡轉成有 schema 的 JSON，並產生成功率及異常報告。
2. 把 277 個故事腳本輸出成 JSON，合併可用的 WW／JP `Language.txt`，同時標記 185 個缺字 key。
3. 從反編譯程式整理 Match-3 規則、特殊棋、障礙、勝敗條件和角色技能對照表。
4. 先做不含原版媒體的 Web 核心原型，再接入本機資源作私人驗證；最後逐步替換成原創角色、美術、音效及文本。

這條路比嘗試重建舊 Unity APK 更適合學習，也較容易得到可維護、可離線玩的成果。

