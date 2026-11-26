import { lessons as foundationLessons } from "./data/lessons.js";
import { workLessons, workTracks } from "./data/work.js";
import { speak, stopSpeaking } from "./speech.js";
import {
  readState,
  persist,
  dayKey,
  streak,
  vocabularyQuestion,
  grade,
  advance,
  dailyPractice,
  reviewQueue,
  validReminderTime,
  learningCalendar,
  backupText,
  restoreBackup,
} from "./model.js";

const $ = (selector) => document.querySelector(selector);
const main = $("#main");
const dialog = $("#panel");
const state = readState();
const lessons = [...workLessons, ...foundationLessons];
const tracks = {
  ...workTracks,
  grammar: {
    title: "文法森林",
    type: "文法",
    desc: "用句型和時態說清楚每一句話。",
    color: "green",
  },
  vocabulary: {
    title: "7,000 單字山脈",
    type: "單字",
    desc: "每次認識 5 個字，再挑戰字義。",
    color: "amber",
  },
  toeic: {
    title: "多益港灣",
    type: "多益",
    desc: "在職場情境裡練習閱讀與應答。",
    color: "blue",
  },
  listening: {
    title: "聽力海岸",
    type: "聽力",
    desc: "聽懂對話和廣播裡的關鍵細節。",
    color: "purple",
  },
};
const paths = {
  meeting: '<path d="M5 3h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-7l-6 4v-4H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM7 8h10m-10 4h7"/>',
  spark: '<path d="M12 2c0 6 4 10 10 10-6 0-10 4-10 10 0-6-4-10-10-10 6 0 10-4 10-10z"/>',
  code: '<path d="m8 6-6 6 6 6m8-12 6 6-6 6m-2-15-4 18"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12a2 2 0 0 0 4 0"/>',
  map: '<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2zM9 3v16m6-14v16"/>',
  review: '<path d="M3 10a9 9 0 1 1 1 7m-1-7V4m0 6h6M12 7v5l3 2"/>',
  notes:
    '<rect x="5" y="3" width="15" height="18" rx="2"/><path d="M9 3v18m3-13h5m-5 4h4M3 7h3m-3 5h3m-3 5h3"/>',
  book: '<path d="M3 4c4-1 6-1 9 1 3-2 5-2 9-1v15c-4-1-6-1-9 1-3-2-5-2-9-1zM12 5v15"/>',
  flame:
    '<path d="M13 2c1 5 5 6 4 11 1-1 2-3 2-4 4 8-1 13-7 13-5 0-9-4-8-9 0-3 2-6 4-8-1 4 0 6 2 7 3-3 4-6 3-10z"/>',
  bolt: '<path d="m14 2-11 12h7l-1 8 12-14h-8z"/>',
  flag: '<path d="M5 22V3m0 1c5-4 9 4 15 0v10c-6 4-10-4-15 0"/>',
  play: '<path d="m8 4 12 8-12 8z"/>',
  check: '<path d="m4 12 5 5L21 5"/>',
  volume:
    '<path d="M3 9h4l5-5v16l-5-5H3zm13-1a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  search: '<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/>',
  close: '<path d="m5 5 14 14M19 5 5 19"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  target:
    '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  pin: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0z"/><circle cx="12" cy="10" r="2"/>',
  edit: '<path d="m3 16 12-12 5 5L8 21l-5 1zM13 6l5 5"/>',
  trophy:
    '<path d="M7 3h10v6c0 4-2 6-5 6s-5-2-5-6zM7 5H3v2c0 3 2 5 5 5m9-7h4v2c0 3-2 5-5 5m-4 3v5m-4 1h8"/>',
};
function icon(name) {
  return `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name] || ""}</svg>`;
}
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const fmt = (value) => value.toLocaleString("en-US");
const byLesson = new Map(lessons.map((l) => [l.id, l]));
const byQuestion = new Map(
  lessons.flatMap((l) => l.questions.map((q) => [q.id, { q, lesson: l }])),
);
let words = [],
  wordIndex = new Map(),
  bankError = false,
  saveWarned = false,
  batchPage = 0,
  dictionaryEpoch = 0;
let chosen = null,
  currentNote = null,
  lastSelection = "",
  noticeTimer;
const routes = { map: "練習", review: "錯題", library: "教材", notes: "筆記" };
const focusOptions = { mixed: "三類輪練", ...Object.fromEntries(Object.entries(workTracks).map(([id, track]) => [id, track.title])) };
let renderedDay;
const route = () => location.hash.slice(1) || "map";
function go(where) {
  if (route() === where) render();
  else location.hash = where;
}
function toast(message) {
  const n = dialog.open ? $("#panel-notice") : $("#notice");
  n.textContent = message;
  n.classList.add("show");
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => n.classList.remove("show"), 3400);
}
function save() {
  try {
    persist(state);
    return true;
  } catch {
    if (!saveWarned) toast("瀏覽器無法儲存，這次進度會保留到關閉分頁。");
    saveWarned = true;
    return false;
  }
}
function tile(track) {
  return workTracks[track]
    ? icon(workTracks[track].icon)
    : `<img class="pixel" src="./assets/tile-${track}.png" alt="">`;
}
function progress(value, max) {
  return `<div class="bar" role="progressbar" aria-label="完成進度" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${Math.min(value, max)}"><i style="width:${max ? Math.min(100, (value / max) * 100) : 0}%"></i></div>`;
}
function header() {
  const view = route().split("/")[0],
    nav = routes[view] ? view : view === "settings" ? "" : "map";
  $("#nav").innerHTML = Object.entries(routes)
    .map(
      ([id, name]) =>
        `<a href="#${id}" ${id === nav ? 'aria-current="page"' : ""}>${icon(id === "library" ? "book" : id)}<span>${name}</span></a>`,
    )
    .join("");
  $("#player").innerHTML =
    `<button class="lookup-top" data-do="lookup" aria-label="查字典">${icon("search")}</button><span class="xp">${icon("bolt")}${fmt(state.xp)} XP</span><img src="./assets/fox.png" alt="狐狸冒險者" class="avatar pixel">`;
}
function units(track) {
  return track === "vocabulary"
    ? Math.ceil(words.length / 5)
    : lessons.filter((l) => l.track === track).length;
}
function completed(track) {
  return track === "vocabulary"
    ? Object.keys(state.cleared).filter((k) => /^vocab-\d+$/.test(k)).length
    : lessons.filter((l) => l.track === track && state.cleared[l.id]).length;
}
function vocabLesson(index) {
  if (!Number.isInteger(index) || index < 0 || index >= units("vocabulary"))
    return null;
  return {
    id: "vocab-" + index,
    track: "vocabulary",
    title: "單字小徑 " + (index + 1),
    summary: "認識這一組單字，再用五題練習字義。",
    guide: "先聽發音，試著遮住中文回想字義，再開始挑戰。",
    level: "5 個單字",
    questions: words
      .slice(index * 5, index * 5 + 5)
      .map((_, n) => vocabularyQuestion(words, index * 5 + n)),
  };
}
function findLesson(id) {
  return (
    byLesson.get(id) ||
    (/^vocab-\d+$/.test(id) ? vocabLesson(Number(id.slice(6))) : null)
  );
}
function findQuestion(id) {
  const known = byQuestion.get(id);
  if (known) return known;
  const i = wordIndex.get(id.startsWith("word-") ? id.slice(5).toLowerCase() : "");
  if (i === undefined) return null;
  return {
    q: vocabularyQuestion(words, i),
    lesson: {
      id: "vocab-" + Math.floor(i / 5),
      track: "vocabulary",
      title: "單字小徑 " + (Math.floor(i / 5) + 1),
    },
  };
}
function courseCard(key) {
  const track = tracks[key];
  const total = units(key);
  const done = completed(key);
  return `<a class="course ${track.color}" href="#track/${key}">
    <div class="course-top"><span class="tile-icon">${tile(key)}</span></div>
    <h3>${esc(track.title)}</h3><p>${esc(track.desc)}</p>
    <div class="course-status"><span>${key === "vocabulary" ? fmt(words.length) + " 個單字" : "通過 " + done + " / " + total + " 關"}</span>${key === "vocabulary" ? `<b>${total ? Math.round(done / total * 100) : 0}%</b>` : ""}</div>${progress(done, total || 1)}</a>`;
}
function home() {
  const date = new Date();
  const plan = dailyPractice(state, date);
  const doing = state.active && !state.active.finished ? state.active : null;
  const done = plan.answers.length >= plan.ids.length;
  const next = byQuestion.get(plan.ids[plan.answers.length]);
  const ready = reviewQueue(state, { date }).filter((id) => findQuestion(id)).length;
  const title = doing?.title || next?.lesson.title || "今天的練習已完成";
  const planTracks = [...new Set(plan.ids.map((id) => byQuestion.get(id)?.lesson.track))];
  const topic = doing && doing.track !== "daily"
    ? tracks[doing.track]?.title || "錯題回顧"
    : !doing && done
      ? "已完成 " + plan.answers.length + " 題"
      : planTracks.length === 1 ? workTracks[planTracks[0]].title : "工作情境輪練";
  const showReview = !doing && done && ready;
  return `<section class="home-intro"><div><h1>工作英文練習</h1><p>從會議、AI 到 Code Review，每天練五題。</p></div><div class="lang"><span class="lang-dot"></span> 英文 <b>EN</b></div></section>
  <section class="hero" aria-labelledby="daily-title"><div class="hero-copy">
    <div class="hero-tag">${icon("flag")} ${doing ? "進行中的練習" : "今日練習"}</div>
    <h2 id="daily-title">${esc(title)}</h2><p>${esc(topic)}</p>
    ${doing
      ? `<a href="#play" class="button gold">${icon("play")} 繼續練習</a>`
      : done
        ? `<a href="#${showReview ? "review" : "library"}" class="button gold">${showReview ? "複習到期錯題" : "看英文句型"}</a>`
        : `<button class="button gold" data-do="daily">${icon("play")} ${plan.answers.length ? "繼續今日練習" : "開始今日練習"}</button>`}
  </div><div class="hero-art"><img class="pixel" src="./assets/hero-landscape.png" alt=""></div></section>
  <div class="dashboard work-dashboard">
    <section class="work-courses"><div class="section-head"><h2>工作主題</h2><a class="ext" href="#library">看句型教材</a></div>
      <div class="tiles work-tiles">${Object.keys(workTracks).map(courseCard).join("")}</div>
    </section>
    <aside aria-label="學習進度"><div class="section-head"><h2>今日進度</h2></div>
      <div class="daily"><div class="streak"><span class="streak-icon">${icon("flame")}</span><div><b>連續學習 ${streak(state)} 天</b><small>作答一題即可打卡</small></div></div>
        <div class="task-row"><span>每日練習</span><b>${plan.answers.length} / ${plan.ids.length} 題</b></div>
        ${progress(plan.answers.length, plan.ids.length)}
        ${doing && doing.track !== "daily" && !done ? '<button class="daily-shortcut" data-do="daily">做今日練習</button>' : ""}
      </div>
      <a href="#review" class="side-link">${icon("review")}<span><b>錯題回顧</b><small>${ready ? "有 " + ready + " 題到期" : "目前沒有到期錯題"}</small></span>${icon("chevron")}</a>
      <a href="#settings" class="side-link">${icon("bell")}<span><b>學習設定</b><small>選主題、設定提醒或備份紀錄</small></span>${icon("chevron")}</a>
    </aside>
    <section class="foundation-courses"><div class="section-head"><h2>基礎加練</h2></div>
      <div class="tiles">${Object.keys(tracks).filter((key) => !workTracks[key]).map(courseCard).join("")}</div>
    </section>
  </div>`;
}
function innerHead(title, desc, back = "#map", backText = "練習首頁") {
  return `<a class="back" href="${esc(back)}">‹ ${esc(backText)}</a><h1>${esc(title)}</h1>${desc ? `<p class="sub">${esc(desc)}</p>` : ""}`;
}
function trackPage(key) {
  const t = tracks[key];
  if (!t) return home();
  const isWord = key === "vocabulary",
    total = units(key),
    size = 20;
  const first = isWord
    ? Math.min(batchPage, Math.max(0, Math.ceil(total / size) - 1)) * size
    : 0;
  const list = isWord
    ? Array.from({ length: Math.min(size, total - first) }, (_, i) =>
        vocabLesson(first + i),
      )
    : lessons.filter((l) => l.track === key);
  return `<div class="inner ${t.color}">${innerHead(t.title, t.desc)}<div class="track-summary"><span class="tile-icon">${tile(key)}</span><div><b>已通過 ${completed(key)} / ${fmt(total)} 關</b>${progress(completed(key), total || 1)}</div></div>
 ${isWord ? `<div class="track-tools"><button data-do="lookup">${icon("search")} 查找單字</button>${total ? `<label>關卡範圍 <select id="batch-page">${Array.from({ length: Math.ceil(total / size) }, (_, i) => `<option value="${i}" ${i * size === first ? "selected" : ""}>${i * size + 1}–${Math.min(total, (i + 1) * size)} 關</option>`).join("")}</select></label>` : ""}</div>${bankError ? '<p role="alert">字庫載入失敗。<button data-do="retry-bank">重新載入</button></p>' : ""}` : ""}
 <div class="lesson-list">${list.map((l, i) => `<a href="#lesson/${esc(l.id)}"><span class="node ${state.cleared[l.id] ? "cleared" : ""}">${state.cleared[l.id] ? icon("check") : first + i + 1}</span><span><b>${esc(l.title)}</b><small>${esc(isWord ? l.questions.map((q) => q.word).join(" · ") : l.summary)}</small></span><span class="level">${esc(l.level)}</span>${icon("chevron")}</a>`).join("")}</div></div>`;
}
function phrases(unit) {
  return `<div class="phrase-list">${unit.phrases.map(([term, meaning, example]) =>
    `<div class="phrase-row"><div><b lang="en">${esc(term)}</b><p>${esc(meaning)}</p><p class="phrase-example" lang="en">${esc(example)}</p></div>
      <button type="button" class="icon-btn" data-do="say" data-value="${esc(example)}" aria-label="${esc("朗讀例句 " + term)}">${icon("volume")}</button></div>`,
  ).join("")}</div>`;
}
function intro(unit) {
  const vocabulary = unit.track === "vocabulary";
  return `<div class="inner ${tracks[unit.track].color}">${innerHead(unit.title, unit.summary, "#track/" + unit.track, tracks[unit.track].title)}
    <div class="study-card"><div class="section-head"><h2>${icon("book")} ${unit.phrases ? "先看用法" : "闖關前先讀"}</h2><span>${esc(unit.level)}</span></div><p class="guide lookup-zone">${esc(unit.guide)}</p>
      ${unit.phrases ? phrases(unit) : ""}
      ${vocabulary ? `<div class="study-words">${unit.questions.map((q) => `<div><button class="text-btn" data-do="word" data-value="${esc(q.word)}">${esc(q.word)}</button><span>${esc(q.choices[q.answer])}</span><button class="icon-btn" data-do="say" data-value="${esc(q.word)}" aria-label="${esc(q.word)} 發音">${icon("volume")}</button></div>`).join("")}</div>` : ""}
      <p class="muted">共 ${unit.questions.length} 題，答對八成即可通關。每答對一題獲得 10 XP。</p>
      <div class="actions unit-actions"><button class="button primary" data-do="start" data-value="${esc(unit.id)}">${icon("play")} 開始挑戰</button>${unit.writing ? `<a href="#writing/${esc(unit.id)}" class="button">${icon("edit")} 寫一句英文</a>` : ""}</div>
    </div></div>`;
}
function writingPage(id) {
  const unit = byLesson.get(id);
  if (!unit?.writing)
    return `<div class="inner">${innerHead("找不到這個寫作練習", "", "#library", "句型教材")}</div>`;
  const saved = state.notes["write:" + unit.id];
  const { prompt, example, checklist } = unit.writing;
  return `<div class="inner">${innerHead("寫一句英文", unit.title, "#lesson/" + unit.id, "回到教材")}
    <section class="study-card">
      <form id="writing-form" data-lesson="${esc(unit.id)}">
        <label class="writing-prompt" for="writing-answer">${esc(prompt)}</label>
        <textarea id="writing-answer" rows="5" maxlength="8000" lang="en" required placeholder="Write your answer here…">${esc(saved?.body)}</textarea>
        <div class="actions"><button class="button primary" type="submit">存成筆記</button><a class="ext" href="#notes">查看我的筆記</a></div>
      </form>
      <details class="answer-example"><summary>看範例與自評提示</summary>
        <p class="lookup-zone" lang="en">${esc(example)}</p>
        <button class="button" data-do="say" data-value="${esc(example)}">${icon("volume")} 朗讀範例</button>
        <p>${esc(checklist)}</p>
      </details></section></div>`;
}
function library() {
  return `<div class="inner">${innerHead("工作英文教材", "找片語、看例句，也能把同一個工作情境寫成自己的英文。")}
    <div class="phrase-tools">
      <label>搜尋句型<input id="phrase-search" type="search" placeholder="輸入英文或中文，例如卡關"></label>
      <label>主題<select id="phrase-track"><option value="all">全部主題</option>${Object.entries(workTracks).map(([id, track]) => `<option value="${id}">${esc(track.title)}</option>`).join("")}</select></label>
    </div>
    <p id="phrase-count" class="muted" role="status">${workLessons.flatMap((unit) => unit.phrases).length} 個句型</p>
    <div class="phrase-library">${workLessons.map((unit) =>
      `<section class="study-card phrase-set ${tracks[unit.track].color}" data-track="${unit.track}">
        <div class="section-head"><h2>${esc(unit.title)}</h2><span>${esc(tracks[unit.track].title)}</span></div>
        ${phrases(unit)}
        <div class="actions"><a class="ext" href="#lesson/${unit.id}">前往練習</a><a class="ext" href="#writing/${unit.id}">寫一句英文</a></div>
      </section>`).join("")}</div></div>`;
}
function filterPhrases() {
  const term = $("#phrase-search").value.trim().toLowerCase();
  const topic = $("#phrase-track").value;
  let total = 0;
  for (const section of main.querySelectorAll(".phrase-set")) {
    const topicMatches = topic === "all" || section.dataset.track === topic;
    const headingMatches = section.querySelector("h2").textContent.toLowerCase().includes(term);
    let count = 0;
    for (const phrase of section.querySelectorAll(".phrase-row")) {
      const matches = topicMatches && (headingMatches || phrase.textContent.toLowerCase().includes(term));
      phrase.hidden = !matches;
      if (matches) count++;
    }
    section.hidden = count === 0;
    total += count;
  }
  $("#phrase-count").textContent = total ? total + " 個句型" : "找不到相符的句型，試試其他關鍵字或主題。";
}
function settings() {
  const days = Object.entries(state.days).filter(([, day]) => day.answers > 0).sort(([a], [b]) => b.localeCompare(a));
  return `<div class="inner settings">${innerHead("學習設定", "調整每日練習，並查看或帶走目前瀏覽器的學習資料。")}
    <section class="study-card"><h2>每日練習主題</h2>
      <label for="focus-track">優先練習</label>
      <select id="focus-track">${Object.entries(focusOptions).map(([id, label]) => `<option value="${id}" ${state.prefs.focus === id ? "selected" : ""}>${esc(label)}</option>`).join("")}</select>
      <p class="muted">每天最多先排兩題到期的工作英文錯題，其餘依主題挑選。已開始的每日練習會保留。</p>
    </section>
    <section class="study-card"><h2>每日提醒</h2>
      <label for="reminder-time">開始時間（台灣時間）</label>
      <input id="reminder-time" type="time" required value="${esc(state.prefs.reminderTime)}">
      <p class="muted">下載後匯入行事曆，再確認活動已開啟通知。使用 Google 日曆時，請先在電腦匯入。</p>
      <button type="button" class="button primary" data-do="calendar">${icon("bell")} 下載每日提醒 .ics</button>
    </section>
    <section class="study-card"><h2>學習紀錄與備份</h2>
      <p class="muted">題目進度、錯題、筆記和設定存在目前的瀏覽器。換裝置時可用 JSON 備份還原。</p>
      ${days.length ? `<table class="study-history"><caption>最近 ${Math.min(days.length, 7)} 個練習日</caption><thead><tr><th scope="col">日期</th><th scope="col">作答</th><th scope="col">答對</th></tr></thead><tbody>${days.slice(0, 7).map(([date, d]) => `<tr><th scope="row">${esc(date)}</th><td>${fmt(d.answers)}</td><td>${fmt(d.correct)}</td></tr>`).join("")}</tbody></table>` : '<p class="muted">開始作答後，這裡會顯示練習日期和題數。</p>'}
      <div class="actions"><button class="button" data-do="export-backup">匯出學習資料</button><button class="button" data-do="pick-backup">匯入備份</button><input type="file" id="backup-file" accept=".json,application/json" hidden></div>
    </section></div>`;
}
function roundBack(active) {
  if (active.track === "daily") return ["#map", "今日練習"];
  if (active.track === "review") return ["#review", "錯題回顧"];
  return ["#track/" + active.track, tracks[active.track].title];
}
function resultPage(active) {
  const [href, label] = roundBack(active);
  const writingUnit = active.ids.map((id) => byQuestion.get(id)?.lesson).find((unit) => unit?.writing);
  return `<div class="inner"><div class="result"><span class="medal">${icon("trophy")}</span>
    <h1>${active.track === "daily" ? "今日練習完成" : active.score === active.ids.length ? "全題答對！" : active.score * 5 >= active.ids.length * 4 ? "挑戰成功！" : "完成練習！"}</h1>
    ${active.track === "daily" ? "" : `<p>${esc(active.title)}</p>`}
    <div class="result-score">${active.score} <small>/ ${active.ids.length} 題</small></div>
    <b>本次獲得 ${active.score * 10} XP</b>
    <div class="actions"><a class="button primary" href="${href}">回到${esc(label)}</a>
      ${writingUnit ? `<a class="button" href="#writing/${writingUnit.id}">${icon("edit")} 寫一句英文</a>` : Object.keys(state.mistakes).length && active.track !== "review" ? '<a class="button" href="#review">複習錯題</a>' : ""}
    </div></div></div>`;
}
function quiz() {
  const a = state.active;
  if (!a)
    return `<div class="inner">${innerHead("選擇一個關卡", "從學習地圖選擇想練習的主題。")}<a class="button primary" href="#map">前往地圖</a></div>`;
  if (a.finished) return resultPage(a);
  const found = findQuestion(a.ids[a.index]);
  if (!found)
    return `<div class="inner">${innerHead("題目暫時無法載入", "重新載入字庫後可繼續。")}<button data-do="retry-bank">重新載入</button></div>`;
  const { q } = found,
    answered = a.selected !== null,
    good = answered && a.selected === q.answer;
  const [backHref, backText] = roundBack(a);
  return `<div class="inner quiz">${innerHead(a.title, "", backHref, backText)}
 <div class="quiz-progress"><span>第 ${a.index + 1} / ${a.ids.length} 題</span><b>${a.score * 10} XP</b></div>${progress(a.index + (answered ? 1 : 0), a.ids.length)}
 <section class="study-card"><div class="question-meta"><span>${esc(tracks[found.lesson.track].type)}挑戰</span><button data-do="question-note">${icon("edit")} 筆記</button></div>
 ${q.transcript ? `<div class="listen"><button class="button primary" data-do="listen">${icon("volume")} ${q.work ? "播放英文" : "播放音檔"}</button><button data-do="slow">慢速 0.8×</button></div>` : ""}
 ${q.transcript && q.work && !answered ? `<details class="listen-transcript"><summary>以文字閱讀</summary><p class="lookup-zone" lang="en">${esc(q.transcript)}</p></details>` : ""}
 <h2 class="question lookup-zone" lang="en">${esc(q.prompt)}</h2>${q.word ? `<button class="say" data-do="say" data-value="${esc(q.word)}">${icon("volume")} 聽發音</button>` : ""}
 <div class="answers">${q.choices.map((c, i) => `<button class="answer lookup-zone ${answered ? (i === q.answer ? "right" : i === a.selected ? "wrong" : "") : chosen === i ? "chosen" : ""}" data-do="choice" data-value="${i}" aria-pressed="${chosen === i || a.selected === i}" ${answered ? "disabled" : ""}><span>${String.fromCharCode(65 + i)}</span>${esc(c)}</button>`).join("")}</div>
 ${answered ? `<div class="feedback ${good ? "good" : "bad"}" role="status"><b>${good ? "答對了！ +10 XP" : "已加入錯題回顧"}</b><p class="lookup-zone">${esc(q.explanation)}</p>${q.transcript ? `<details><summary>查看聽力逐字稿</summary><p class="lookup-zone" lang="en">${esc(q.transcript)}</p></details>` : ""}</div><button class="button primary" data-do="next">${a.index + 1 === a.ids.length ? "查看結果" : "下一題"}</button>` : `<button class="button primary" data-do="submit" ${chosen === null ? "disabled" : ""}>確認答案</button>`}</section>
 <p class="tip">${icon("search")} 反白英文單字即可查字典，也可以用頁首的放大鏡查詢。</p></div>`;
}
function review() {
  const today = dayKey();
  const rows = reviewQueue(state, { includeScheduled: true })
    .map((id) => ({ id, m: state.mistakes[id], found: findQuestion(id) }))
    .filter((entry) => entry.found);
  const ready = rows.filter(({ m }) => !m.due || m.due <= today).length;
  return `<div class="inner">${innerHead("錯題回顧", "工作英文錯題在隔天安排複習，到期答對後再間隔 3 天與 7 天。")}
    ${rows.length ? `<div class="track-tools"><b>${ready} 題到期 · ${rows.length - ready} 題已排程</b>${ready ? `<button class="button primary" data-do="review">${icon("play")} 複習 ${Math.min(ready, 5)} 題</button>` : ""}</div>
      <div class="review-list">${rows.map(({ id, m, found }) => {
        const { q, lesson: unit } = found;
        const status = !m.due || m.due <= today ? "可複習" : m.due + " 到期";
        return `<article><small>${esc(unit.title)} · 答錯 ${m.count} 次 · ${esc(status)}</small><h3 class="lookup-zone" lang="en">${esc(q.prompt)}</h3>
          <details class="review-answer"><summary>看上次錯答與解析</summary><p>上次錯答 <strong>${esc(q.choices[m.choice] || "未記錄")}</strong></p><p>正確答案 <strong>${esc(q.choices[q.answer])}</strong></p><p>${esc(q.explanation)}</p></details>
          <button data-do="single" data-value="${esc(id)}">重練這題</button></article>`;
      }).join("")}</div>` : `<div class="empty">${icon("check")}<h2>目前沒有待複習的題目</h2><a href="#map" class="button primary">前往練習</a></div>`}
    </div>`;
}
function notebook() {
  const rows = Object.entries(state.notes).sort(
    (a, b) => b[1].date - a[1].date,
  );
  return `<div class="inner">${innerHead("我的筆記", "收下查過的單字，也可以記下文法規則或自己的例句。")}<div class="track-tools"><b>${rows.length} 則筆記</b><button class="button primary" data-do="new-note">${icon("edit")} 新增筆記</button></div>${rows.length ? `<div class="review-list">${rows.map(([key, n]) => `<article><h3>${esc(n.title)}</h3><p class="lookup-zone">${esc(n.body)}</p><button data-do="edit-note" data-value="${esc(key)}">編輯筆記</button></article>`).join("")}</div>` : `<div class="empty">${icon("notes")}<h2>寫下第一則學習筆記</h2><p>查字後可直接收藏詞義，在題目右上角也可以記筆記。</p></div>`}</div>`;
}
function render() {
  const [view, part] = route().split("/");
  header();
  const unit = view === "lesson" && findLesson(part || "");
  const pages = {
    map: home,
    track: () => trackPage(part),
    lesson: () => unit ? intro(unit) : `<div class="inner">${innerHead("找不到關卡", "請回到練習首頁選擇關卡。")}</div>`,
    play: quiz,
    review,
    notes: notebook,
    library,
    writing: () => writingPage(part),
    settings,
  };
  main.innerHTML = (Object.hasOwn(pages, view) ? pages[view] : home)();
  renderedDay = dayKey();
  document.title = (main.querySelector("h1")?.textContent || "英文練習") + "｜FluentPath";
}
function start(track, title, lessonId, ids, plan = null) {
  if (!ids.length) return;
  const prior = state.active;
  if (prior && !prior.finished && prior.lessonId === lessonId && track !== "review") {
    go("play");
    return;
  }
  if (plan && plan.answers.length >= ids.length) return;
  if (prior && !prior.finished) {
    const message = prior.track === "daily"
      ? "要切換練習嗎？今天已回答的題目會保留。"
      : "要切換挑戰嗎？已作答的 XP 與錯題會保留，目前這一關將重新開始。";
    if (!window.confirm(message)) return;
  }
  const answers = plan?.answers || [];
  if (plan) state.dailyPlan = plan;
  state.active = {
    track,
    title,
    lessonId,
    ids,
    index: answers.length,
    score: answers.filter((choice, index) => byQuestion.get(ids[index])?.q.answer === choice).length,
    selected: null,
    finished: false,
  };
  chosen = null;
  save();
  go("play");
}
function panel(title, body) {
  $("#panel-body").innerHTML =
    `<div class="panel-head"><h2 id="panel-title">${esc(title)}</h2><button class="icon-btn" data-do="close" aria-label="關閉">${icon("close")}</button></div>${body}<p id="panel-notice" role="status"></p>`;
  if (!dialog.open) dialog.showModal();
}
const basicGlosses = {
  i: "我",
  you: "你；你們",
  he: "他",
  she: "她",
  it: "它",
  we: "我們",
  they: "他們",
  my: "我的",
  your: "你的",
  our: "我們的",
  is: "是；be 的現在式",
  are: "是；be 的現在式",
  was: "是；be 的過去式",
  were: "是；be 的過去式",
  am: "是；與 I 搭配的 be 動詞",
  the: "這個；該（定冠詞）",
  a: "一個（不定冠詞）",
  an: "一個（母音音開頭的字前使用）",
  does: "做；助動詞 do 的第三人稱單數",
  did: "do 的過去式",
  has: "有；have 的第三人稱單數",
  had: "have 的過去式",
  went: "go 的過去式；去了",
  took: "take 的過去式",
  bought: "buy 的過去式；買了",
  sent: "send 的過去式；寄出了",
  at: "在（時間點或位置）",
  to: "向；到；接原形動詞",
  of: "……的",
  for: "為了；給；持續",
  from: "從；來自",
  on: "在……上；在某一天",
  by: "藉由；在……之前；在旁邊",
  in: "在……裡面",
  not: "不；非",
  and: "和；而且",
  if: "如果",
  will: "將會",
};
function localMeaning(word) {
  const base = word.toLowerCase().replace(/[’]/g, "'");
  function lookup(w) {
    const i = wordIndex.get(w);
    return Object.hasOwn(basicGlosses, w)
      ? basicGlosses[w]
      : i !== undefined
        ? words[i][1]
        : "";
  }
  const direct = lookup(base);
  if (direct) return direct;
  const variants = [];
  if (base.endsWith("ies")) variants.push(base.slice(0, -3) + "y");
  if (base.endsWith("ied")) variants.push(base.slice(0, -3) + "y");
  if (base.endsWith("es")) variants.push(base.slice(0, -2));
  if (base.endsWith("s")) variants.push(base.slice(0, -1));
  if (base.endsWith("ed")) variants.push(base.slice(0, -1), base.slice(0, -2));
  if (base.endsWith("ing"))
    variants.push(base.slice(0, -3), base.slice(0, -3) + "e");
  const stem = base.replace(/(?:ed|ing)$/, "");
  if (stem.length > 2 && stem.at(-1) === stem.at(-2))
    variants.push(stem.slice(0, -1));
  for (const v of variants) {
    const m = lookup(v);
    if (m) return `原形 ${v} · ${m}`;
  }
  return "";
}
function dictionary(word = "") {
  const epoch = ++dictionaryEpoch;
  const searched = word.trim().toLowerCase().slice(0, 80);
  const meaning = localMeaning(searched);
  const noteKey = "word:" + searched,
    old = state.notes[noteKey];
  panel(
    "隨選字典",
    `<form id="dictionary-form"><label for="dictionary-input">查詢英文單字</label><div class="form-row"><input type="search" id="dictionary-input" name="term" required maxlength="80" value="${esc(searched)}" placeholder="輸入英文，例如 station"><button class="button primary">查詢</button></div></form>${searched ? `<div class="dict-word"><h3 lang="en">${esc(searched)}</h3><button class="icon-btn" data-do="say" data-value="${esc(searched)}" aria-label="播放單字發音">${icon("volume")}</button></div><p id="definition">${esc(meaning || "正在查詢線上英英字典…")}</p><a class="ext" href="https://dictionary.cambridge.org/dictionary/english-chinese-traditional/${encodeURIComponent(searched)}" target="_blank" rel="noopener">查看 Cambridge 英漢詞典 ↗</a>${wordIndex.has(searched) ? `<p><a class="ext" href="#lesson/vocab-${Math.floor(wordIndex.get(searched) / 5)}" data-do="close">前往這個單字的練習關卡</a></p>` : ""}<form id="word-note"><label for="word-body">我的單字筆記</label><textarea id="word-body" rows="3" maxlength="8000" placeholder="寫下例句或要記住的地方">${esc(old?.body ?? meaning)}</textarea><button class="button primary">${icon("notes")} ${old ? "更新筆記" : "存到我的筆記"}</button></form>` : ""}`,
  );
  if (searched && !meaning) {
    fetch(
      "https://api.dictionaryapi.dev/api/v2/entries/en/" +
        encodeURIComponent(searched),
      { signal: AbortSignal.timeout(5500) },
    )
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (epoch !== dictionaryEpoch || !dialog.open || !$("#definition"))
          return;
        const def = data?.[0]?.meanings?.[0]?.definitions?.[0]?.definition;
        $("#definition").textContent = def
          ? "英英釋義 · " + def
          : "內建詞庫未收錄，可以開啟 Cambridge 查詢。";
        if (def && !old && !$("#word-body").value) $("#word-body").value = def;
      })
      .catch(() => {
        if (epoch === dictionaryEpoch && $("#definition"))
          $("#definition").textContent =
            "目前無法連線查詢，可開啟 Cambridge 查看完整詞條。";
      });
  }
  $("#dictionary-form").onsubmit = (e) => {
    e.preventDefault();
    const term = $("#dictionary-input").value.trim();
    if (term) dictionary(term);
  };
  if (searched)
    $("#word-note").onsubmit = (e) => {
      e.preventDefault();
      state.notes[noteKey] = {
        title: searched,
        body: $("#word-body").value.trim() || meaning || searched,
        date: Date.now(),
      };
      save();
      dialog.close();
      if (route() === "notes") render();
      toast("已儲存單字筆記");
    };
  if (!searched) $("#dictionary-input").focus();
}
function noteEditor(key, title = "", body = "") {
  currentNote = key;
  const old = state.notes[key];
  panel(
    old ? "編輯筆記" : "新增學習筆記",
    `<form id="note-form"><label for="note-title">標題</label><input id="note-title" required maxlength="180" value="${esc(old?.title ?? title)}"><label for="note-body">內容</label><textarea rows="5" id="note-body" required maxlength="8000" placeholder="試著寫下自己的例句…">${esc(old?.body ?? body)}</textarea><div class="actions"><button class="button primary">儲存筆記</button>${old ? '<button type="button" data-do="delete-note">刪除</button>' : ""}</div></form>`,
  );
  $("#note-form").onsubmit = (e) => {
    e.preventDefault();
    const t = $("#note-title").value.trim(),
      b = $("#note-body").value.trim();
    if (!t || !b) return toast("請填寫標題和內容");
    state.notes[key] = { title: t, body: b, date: Date.now() };
    save();
    dialog.close();
    if (route() === "notes") render();
    toast("已儲存學習筆記");
  };
}
function download(content, type, name) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function importBackup(file) {
  if (file.size > 15_000_000) return toast("備份檔超過 15 MB。請選擇原始學習備份檔。");
  let restored;
  try {
    restored = restoreBackup(await file.text());
  } catch (error) {
    return toast(error.message || "備份檔無法讀取。");
  }
  if (!window.confirm("匯入後會以備份內容取代目前瀏覽器的學習進度、錯題、筆記與設定。要繼續嗎？")) return;
  try {
    persist(restored);
  } catch {
    return toast("瀏覽器無法儲存備份，請檢查儲存空間後重試。");
  }
  Object.assign(state, restored);
  chosen = null;
  stopSpeaking();
  render();
  toast("已還原學習資料");
}
document.addEventListener("click", (e) => {
  const button = e.target.closest("[data-do]");
  if (!button) return;
  const action = button.dataset.do,
    value = button.dataset.value || "";
  const a = state.active,
    q = a && !a.finished ? findQuestion(a.ids[a.index])?.q : null;
  if (action === "close") return dialog.close();
  if (action === "lookup") return dictionary();
  if (action === "word") return dictionary(value);
  if (action === "sources")
    return panel(
      "教材與資料來源",
      '<p>工作英文題、句型與範例，以及文法、多益職場題和聽力逐字稿，均由 FluentPath 原創。基礎聽力使用預錄音檔，工作英文使用裝置語音。</p><p><a href="./data/vocabulary-source.txt" target="_blank" rel="noopener">單字清單的選詞方式與授權</a></p><p>查字優先使用內建詞庫，另可使用 Free Dictionary API 英英釋義與 Cambridge 英漢詞典。</p>',
    );
  if (action === "daily") {
    const plan = dailyPractice(state);
    return start("daily", "今日工作英文", "daily-" + plan.date, plan.ids, plan);
  }
  if (action === "calendar") {
    const field = $("#reminder-time");
    if (!field.reportValidity()) return;
    return download(learningCalendar(field.value), "text/calendar;charset=utf-8", "fluentpath-daily.ics");
  }
  if (action === "export-backup") {
    return download(backupText(state), "application/json;charset=utf-8", "fluentpath-" + dayKey() + ".json");
  }
  if (action === "pick-backup") return $("#backup-file").click();
  if (action === "retry-bank") return loadBank();
  if (action === "say") return speak(value).catch((e) => toast(e.message));
  if (action === "listen" || action === "slow") {
    if (q?.transcript)
      speak(q.transcript, { id: q.work ? undefined : q.id, slow: action === "slow" }).catch((e) =>
        toast(e.message),
      );
    return;
  }
  if (action === "start") {
    const l = findLesson(value);
    if (l)
      start(
        l.track,
        l.title,
        l.id,
        l.questions.map((q) => q.id),
      );
    return;
  }
  if (action === "choice" && q && a.selected === null) {
    if (window.getSelection()?.toString().trim()) return;
    chosen = Number(value);
    main.querySelectorAll(".answer").forEach((b, i) => {
      b.classList.toggle("chosen", i === chosen);
      b.setAttribute("aria-pressed", String(i === chosen));
    });
    main.querySelector('[data-do="submit"]').disabled = false;
    return;
  }
  if (action === "submit" && q && chosen !== null) {
    grade(state, q, chosen, findQuestion(q.id).lesson.title);
    save();
    render();
    main.querySelector('[data-do="next"]')?.focus({ preventScroll: true });
    return;
  }
  if (action === "next") {
    stopSpeaking();
    advance(state);
    chosen = null;
    save();
    render();
    window.scrollTo(0, 0);
    main.focus({ preventScroll: true });
    return;
  }
  if (action === "single" || action === "review") {
    const ids =
      action === "single"
        ? [value]
        : reviewQueue(state).filter((id) => findQuestion(id)).slice(0, 5);
    return start("review", "錯題回顧", "review", ids);
  }
  if (action === "new-note") return noteEditor("note:" + crypto.randomUUID());
  if (action === "edit-note") return noteEditor(value);
  if (action === "question-note" && q)
    return noteEditor("q:" + q.id, q.prompt.slice(0, 180));
  if (action === "delete-note" && currentNote && confirm("刪除這則筆記？")) {
    delete state.notes[currentNote];
    save();
    dialog.close();
    if (route() === "notes") render();
    toast("已刪除筆記");
  }
});
main.addEventListener("change", (event) => {
  const field = event.target;
  if (field.id === "batch-page") {
    batchPage = Number(field.value);
    render();
    $("#batch-page").focus();
  }
  if (field.id === "phrase-track") filterPhrases();
  if (field.id === "focus-track" && Object.hasOwn(focusOptions, field.value)) {
    state.prefs.focus = field.value;
    if (save()) toast("已儲存練習主題");
  }
  if (field.id === "reminder-time" && validReminderTime(field.value)) {
    state.prefs.reminderTime = field.value;
    if (save()) toast("已儲存提醒時間");
  }
  if (field.id === "backup-file" && field.files.length) {
    const file = field.files[0];
    field.value = "";
    importBackup(file);
  }
});
main.addEventListener("input", (event) => {
  if (event.target.id === "phrase-search") filterPhrases();
});
main.addEventListener("submit", (event) => {
  if (event.target.id !== "writing-form") return;
  event.preventDefault();
  const unit = byLesson.get(event.target.dataset.lesson);
  const body = $("#writing-answer").value.trim();
  if (!unit?.writing || !body) return toast("請先寫一段英文。");
  state.notes["write:" + unit.id] = { title: unit.title + "｜寫作練習", body, date: Date.now() };
  if (save()) toast("已存成學習筆記");
});
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && renderedDay !== dayKey() && ["map", "review"].includes(route()) && !dialog.open) render();
});
let selectionTimer;
function selectedLookup() {
  if (dialog.open) return;
  const sel = window.getSelection(),
    word = sel?.toString().trim();
  if (!word) {
    lastSelection = "";
    return;
  }
  const anchor = sel.anchorNode?.parentElement,
    focus = sel.focusNode?.parentElement;
  if (
    !/^[A-Za-z]+(?:['’–-][A-Za-z]+)*$/.test(word) ||
    word.length > 60 ||
    !main.contains(anchor) ||
    !main.contains(focus) ||
    anchor?.closest("input, textarea, select") ||
    lastSelection === word
  )
    return;
  lastSelection = word;
  sel.removeAllRanges();
  dictionary(word);
}
document.addEventListener("selectionchange", () => {
  clearTimeout(selectionTimer);
  if (!dialog.open) selectionTimer = setTimeout(selectedLookup, 500);
});
document.addEventListener("pointerup", () => {
  clearTimeout(selectionTimer);
  selectionTimer = setTimeout(selectedLookup, 120);
});
dialog.addEventListener("close", () => {
  dictionaryEpoch++;
  lastSelection = "";
});
dialog.addEventListener("click", (e) => {
  if (e.target === dialog) {
    const r = dialog.getBoundingClientRect();
    if (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    )
      dialog.close();
  }
});
window.addEventListener("hashchange", () => {
  stopSpeaking();
  chosen = null;
  if (dialog.open) dialog.close();
  render();
  window.scrollTo(0, 0);
  main.focus({ preventScroll: true });
});
window.addEventListener("storage", (e) => {
  if (e.key === "fluentpath.en.v1") {
    Object.assign(state, readState());
    chosen = null;
    render();
  }
});
async function loadBank() {
  try {
    const response = await fetch("./data/vocabulary.json");
    if (!response.ok) throw Error();
    const rows = await response.json();
    if (!Array.isArray(rows) || !rows.length) throw Error();
    words = rows;
    wordIndex = new Map(words.map(([w], i) => [w.toLowerCase(), i]));
    bankError = false;
  } catch {
    bankError = true;
  }
  const current = route();
  const activeId = state.active ? state.active.ids[state.active.index] : null;
  if (current === "map" || current === "review" || current === "track/vocabulary" ||
      current.startsWith("lesson/vocab-") || (current === "play" && activeId?.startsWith("word-"))) render();
}
render();
loadBank();
