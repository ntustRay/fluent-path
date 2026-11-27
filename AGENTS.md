# FluentPath

## 教材與程式

- 工作英文教材在 `data/work.js`，文法、職場閱讀與基礎聽力在 `data/lessons.js`。保留單元和題目的唯一 ID，避免舊進度失去對應。
- `model.js` 負責每日練習、錯題間隔、行事曆與備份。調整 localStorage 結構時要以舊紀錄和 JSON 匯入驗證相容。
- `speech.js` 管理音檔與裝置語音。調整聽力教材時，同步逐字稿及對應音檔，維護 [單字來源](data/vocabulary-source.txt)。

## 開發與驗證

- 在根目錄執行 `python -m http.server 8000`，使用 Node.js 20+ 跑 `npm test`。
- 改動學習流程後，在窄螢幕檢查作答、複習、音訊失敗提示和備份操作。維持 GitHub Pages 可直接提供靜態檔案。
