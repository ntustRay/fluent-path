# FluentPath

手機優先的英文學習遊戲。從文法和單字短關卡開始，也能練習原創多益職場題、聽力測驗，並用個人筆記和錯題回顧複習。

## 開始練習

開啟 [FluentPath 學習地圖](https://ntustray.github.io/fluent-path/)。每關五題，答對四題即可通關。單字可以先看字義、聽發音，再測驗。文法與多益題附繁中解析，聽力題附正常與慢速播放及作答後逐字稿。

反白英文單字可開啟字典。單字與題目都能寫筆記，答錯的題目會進入錯題本，再次答對後移出。進度和筆記存在目前瀏覽器的 localStorage。

## 本機執行

使用 Python 3 在專案根目錄執行 `python -m http.server 8000`，再開啟 `http://localhost:8000`。網站採用原生 ES modules，不需要安裝前端套件。

使用 Node.js 20 或更新版本執行 `npm test`，檢查字庫、題庫、音檔及作答紀錄。推送至 `main` 後由 GitHub Pages 發布。

## 教材

- [單字來源與授權](data/vocabulary-source.txt)
- [原創文法、職場閱讀與聽力題](data/lessons.js)
- [重新製作聽力 MP3 的 Windows 腳本](scripts/generate-audio.ps1)
