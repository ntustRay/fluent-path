# FluentPath

[開啟 FluentPath](https://ntustray.github.io/fluent-path/)

手機優先的工作英文練習。每天用五題練 stand-up、需求確認、Prompt、Agent、Code Review 和效能報告，可在學習設定選擇三類輪練或單一主題。

## 每日練習

- 商業、AI 和程式英文各有四關，共 60 道情境題、36 個附例句的句型和 12 道寫作練習。先寫再打開範例對照，也能把自己的答案存成筆記。
- 工作英文答錯後隔天到期。到期答對會再排 3 天、7 天後複習，完成三次到期複習後移出。每天先練最多兩道到期工作英文錯題，再依偏好與練習紀錄挑題。
- 基礎加練包含原有文法、7,000 單字、多益職場題及聽力。反白英文可查字。基礎題答對後會移出錯題本。

## 提醒與紀錄

在「學習設定」選台灣時間，下載每日提醒的 `.ics`，再匯入行事曆並確認活動通知。Google 日曆可在電腦匯入，再從手機查看。

進度、錯題、筆記和偏好存於目前瀏覽器的 localStorage。換裝置時，在學習設定匯出 JSON，再於新裝置匯入。匯入前會確認是否以備份覆蓋現有紀錄。

## 本機執行

1. 使用 Python 3 在專案根目錄執行 `python -m http.server 8000`。
2. 開啟 `http://localhost:8000`。網站使用原生 ES modules，前端無需安裝套件。
3. 使用 Node.js 20 或更新版本執行 `npm test`，驗證字庫、題庫、音檔與學習流程。

GitHub Pages 從 `main` 發布。

## 教材

- [原創工作英文句型與練習](data/work.js)
- [單字來源與授權](data/vocabulary-source.txt)
- [原創文法、職場閱讀與聽力題](data/lessons.js)
- [重新製作基礎聽力 MP3 的 Windows 腳本](scripts/generate-audio.ps1)

工作英文例句和工作英文聽力使用裝置英文語音。聽力題也可閱讀逐字稿。
