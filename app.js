import { lessons } from "./data/lessons.js";
import { speak, stopSpeaking } from "./speech.js";
import {
  readState,
  persist,
  dayKey,
  streak,
  vocabularyQuestion,
  grade,
  advance,
} from "./model.js";

const $ = (selector) => document.querySelector(selector);
const main = $("#main");
const dialog = $("#panel");
const state = readState();
const tracks = {
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
const routes = { map: "學習地圖", review: "錯題回顧", notes: "我的筆記" };
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
  } catch {
    if (!saveWarned) toast("瀏覽器無法儲存，這次進度會保留到關閉分頁。");
    saveWarned = true;
  }
}
function tile(track, cls = "") {
  return `<img class="pixel ${cls}" src="./assets/tile-${track}.png" alt="">`;
}
function progress(value, max) {
  return `<div class="bar" role="progressbar" aria-label="完成進度" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${Math.min(value, max)}"><i style="width:${max ? Math.min(100, (value / max) * 100) : 0}%"></i></div>`;
}
function header() {
  const view = route().split("/")[0],
    nav = routes[view] ? view : "map";
  $("#nav").innerHTML = Object.entries(routes)
    .map(
      ([id, name]) =>
        `<a href="#${id}" ${id === nav ? 'aria-current="page"' : ""}>${icon(id)}<span>${name}</span></a>`,
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
function nextMission() {
  if (state.active && !state.active.finished)
    return {
      title: state.active.title,
      track: state.active.track,
      link: "#play",
      resume: true,
    };
  const next = lessons.find(
    (l) => l.track === "grammar" && !state.cleared[l.id],
  );
  if (next) return { ...next, link: "#lesson/" + next.id };
  const v = words.findIndex((w) => !state.mastered[w[0]]);
  if (v >= 0)
    return {
      ...vocabLesson(Math.floor(v / 5)),
      link: "#lesson/vocab-" + Math.floor(v / 5),
    };
  const more = lessons.find((l) => !state.cleared[l.id]) || lessons[0];
  return { ...more, link: "#lesson/" + more.id };
}
function home() {
  const now = nextMission(),
    track = tracks[now.track],
    today = state.days[dayKey()] || {},
    hasReview = Object.keys(state.mistakes).length;
  const task = (name, n, max) =>
    `<div class="task-row"><span class="task-check ${n >= max ? "done" : ""}">${n >= max ? icon("check") : ""}</span><span>${name}</span><b>${Math.min(n, max)} / ${max}</b></div>`;
  return `<section class="home-intro"><div><div class="game-label">${icon("flag")} 冒險者 Lv. ${Math.floor(state.xp / 100) + 1} · 距升級 ${100 - state.xp % 100} XP</div><h1>英文學習地圖</h1><p>每次五題，走一段自己的英文冒險。</p></div><div class="lang"><span class="lang-dot"></span> 英文 <b>EN</b></div></section>
 <section class="hero"><div class="hero-copy"><div class="hero-tag">${icon("flag")} ${now.resume ? "進行中的關卡" : "今日主線"}</div><h2>${esc(track?.title || "錯題回顧")}</h2><p>${esc(now.title)}</p><a href="${esc(now.link)}" class="button gold">${icon("play")} ${now.resume ? "繼續挑戰" : "開始冒險"}</a></div><div class="hero-art"><img class="pixel" src="./assets/hero-landscape.png" alt="背著行囊的小狐狸沿森林小徑前往山頂旗幟"></div></section>
 <div class="dashboard"><section><div class="section-head"><h2>${icon("map")} 冒險區域</h2><span>4 個區域</span></div>
 <div class="tiles">${Object.entries(tracks)
   .map(([k, t]) => {
     const total = units(k),
       done = completed(k);
     return `<a class="course ${t.color}" href="#track/${k}"><div class="course-top"><div class="tile-icon">${tile(k)}</div><div class="course-meta">${({grammar:"句型與時態",vocabulary:"5 字一關",toeic:"Part 5–7",listening:"可慢速重播"})[k]}</div></div><h3>${esc(t.title)}</h3><p>${esc(t.desc)}</p><div class="course-status"><span>${k === "vocabulary" ? fmt(words.length) + " 個單字" : total + " 個關卡"}</span><b>${total ? Math.round((done / total) * 100) : 0}%</b></div>${progress(done, total || 1)}</a>`;
   })
   .join("")}</div></section>
 <aside><div class="section-head"><h2>${icon("target")} 今日任務</h2></div><div class="daily"><div class="streak"><span class="streak-icon">${icon("flame")}</span><div><b>連續學習 ${streak(state)} 天</b><small>今天答一題就能打卡</small></div></div>
 ${task("完成 5 道練習", today.answers || 0, 5)}${task("答對 3 道題目", today.correct || 0, 3)}${task("完成 1 次挑戰", today.rounds || 0, 1)}</div>
 <a href="#review" class="side-link">${icon("review")}<span><b>錯題回顧</b><small>${hasReview ? "有 " + hasReview + " 題等你再挑戰" : "答錯的題目會收在這裡"}</small></span>${icon("chevron")}</a></aside></div>`;
}
function innerHead(title, desc, back = "#map", backText = "學習地圖") {
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
function intro(l) {
  const v = l.track === "vocabulary";
  return `<div class="inner ${tracks[l.track].color}">${innerHead(l.title, l.summary, "#track/" + l.track, tracks[l.track].title)}
 <div class="study-card"><div class="section-head"><h2>${icon("book")} 闖關前先讀</h2><span>${esc(l.level)}</span></div><p class="guide lookup-zone">${esc(l.guide)}</p>
 ${v ? `<div class="study-words">${l.questions.map((q) => `<div><button class="text-btn" data-do="word" data-value="${esc(q.word)}">${esc(q.word)}</button><span>${esc(q.choices[q.answer])}</span><button class="icon-btn" data-do="say" data-value="${esc(q.word)}" aria-label="${esc(q.word)} 發音">${icon("volume")}</button></div>`).join("")}</div>` : ""}
 <p class="muted">共 ${l.questions.length} 題，答對八成即可通關。每答對一題獲得 10 XP。</p><button class="button primary" data-do="start" data-value="${esc(l.id)}">${icon("play")} 開始挑戰</button></div></div>`;
}
function quiz() {
  const a = state.active;
  if (!a)
    return `<div class="inner">${innerHead("選擇一個關卡", "從學習地圖選擇想練習的主題。")}<a class="button primary" href="#map">前往地圖</a></div>`;
  if (a.finished)
    return `<div class="inner"><div class="result"><span class="medal">${icon("trophy")}</span><h1>${a.score === a.ids.length ? "全題答對！" : a.score * 5 >= a.ids.length * 4 ? "挑戰成功！" : "完成練習！"}</h1><p>${esc(a.title)}</p><div class="result-score">${a.score} <small>/ ${a.ids.length} 題</small></div><b>本次獲得 ${a.score * 10} XP</b><div class="actions"><a class="button primary" href="#${a.track === "review" ? "review" : "track/" + a.track}">回到${a.track === "review" ? "錯題回顧" : "學習區域"}</a>${Object.keys(state.mistakes).length ? '<a class="button" href="#review">複習錯題</a>' : '<a class="button" href="#map">學習地圖</a>'}</div></div></div>`;
  const found = findQuestion(a.ids[a.index]);
  if (!found)
    return `<div class="inner">${innerHead("題目暫時無法載入", "重新載入字庫後可繼續。")}<button data-do="retry-bank">重新載入</button></div>`;
  const { q } = found,
    answered = a.selected !== null,
    good = answered && a.selected === q.answer;
  return `<div class="inner quiz">${innerHead(a.title, "", a.track === "review" ? "#review" : "#track/" + a.track, a.track === "review" ? "錯題回顧" : tracks[a.track].title)}
 <div class="quiz-progress"><span>第 ${a.index + 1} / ${a.ids.length} 題</span><b>${a.score * 10} XP</b></div>${progress(a.index + (answered ? 1 : 0), a.ids.length)}
 <section class="study-card"><div class="question-meta"><span>${esc(tracks[found.lesson.track].type)}挑戰</span><button data-do="question-note">${icon("edit")} 筆記</button></div>
 ${q.transcript ? '<div class="listen"><button class="button primary" data-do="listen">' + icon("volume") + ' 播放音檔</button><button data-do="slow">慢速 0.8×</button></div>' : ""}
 <h2 class="question lookup-zone" lang="en">${esc(q.prompt)}</h2>${q.word ? `<button class="say" data-do="say" data-value="${esc(q.word)}">${icon("volume")} 聽發音</button>` : ""}
 <div class="answers">${q.choices.map((c, i) => `<button class="answer lookup-zone ${answered ? (i === q.answer ? "right" : i === a.selected ? "wrong" : "") : chosen === i ? "chosen" : ""}" data-do="choice" data-value="${i}" aria-pressed="${chosen === i || a.selected === i}" ${answered ? "disabled" : ""}><span>${String.fromCharCode(65 + i)}</span>${esc(c)}</button>`).join("")}</div>
 ${answered ? `<div class="feedback ${good ? "good" : "bad"}" role="status"><b>${good ? "答對了！ +10 XP" : "已加入錯題回顧"}</b><p class="lookup-zone">${esc(q.explanation)}</p>${q.transcript ? `<details><summary>查看聽力逐字稿</summary><p class="lookup-zone" lang="en">${esc(q.transcript)}</p></details>` : ""}</div><button class="button primary" data-do="next">${a.index + 1 === a.ids.length ? "查看結果" : "下一題"}</button>` : `<button class="button primary" data-do="submit" ${chosen === null ? "disabled" : ""}>確認答案</button>`}</section>
 <p class="tip">${icon("search")} 反白英文單字即可查字典，也可以用頁首的放大鏡查詢。</p></div>`;
}
function review() {
  const rows = Object.entries(state.mistakes)
    .sort((a, b) => b[1].date - a[1].date)
    .map(([id, m]) => ({ id, m, found: findQuestion(id) }))
    .filter((x) => x.found);
  return `<div class="inner">${innerHead("錯題回顧", "答錯的題目會留在這裡，重新答對即可移出。")}
 ${rows.length ? `<div class="track-tools"><b>${rows.length} 題待複習</b><button class="button primary" data-do="review">${icon("play")} 練習 ${Math.min(rows.length, 5)} 題</button></div><div class="review-list">${rows.map(({ id, m, found }) => `<article><small>${esc(found.lesson.title)} · 答錯 ${m.count} 次</small><h3 class="lookup-zone">${esc(found.q.prompt)}</h3><button data-do="single" data-value="${esc(id)}">重練這題</button></article>`).join("")}</div>` : `<div class="empty">${icon("check")}<h2>目前沒有待複習的題目</h2><a href="#map" class="button primary">前往學習地圖</a></div>`}</div>`;
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
  const l = view === "lesson" && findLesson(part || "");
  const output =
    view === "track"
      ? trackPage(part)
      : view === "lesson"
        ? l
          ? intro(l)
          : `<div class="inner">${innerHead("找不到關卡", "請回到學習地圖選擇關卡。")}</div>`
        : view === "play"
          ? quiz()
          : view === "review"
            ? review()
            : view === "notes"
              ? notebook()
              : home();
  main.innerHTML = output;
  document.title =
    (main.querySelector("h1")?.textContent || "英文練習") + "｜FluentPath";
}
function start(track, title, lessonId, ids) {
  if (
    state.active &&
    !state.active.finished &&
    state.active.lessonId === lessonId &&
    track !== "review"
  ) {
    go("play");
    return;
  }
  if (
    state.active &&
    !state.active.finished &&
    !window.confirm(
      "要切換挑戰嗎？已作答的 XP 與錯題會保留，目前這一關將重新開始。",
    )
  )
    return;
  if (!ids.length) return;
  state.active = {
    track,
    title,
    lessonId,
    ids,
    index: 0,
    score: 0,
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
      '<p>文法、多益職場題及聽力逐字稿由 FluentPath 原創。聽力使用合成英語語音錄製。</p><p><a href="./data/vocabulary-source.txt" target="_blank" rel="noopener">單字清單的選詞方式與授權</a></p><p>查字優先使用內建詞庫，另可使用 Free Dictionary API 英英釋義與 Cambridge 英漢詞典。</p>',
    );
  if (action === "retry-bank") return loadBank();
  if (action === "say") return speak(value).catch((e) => toast(e.message));
  if (action === "listen" || action === "slow") {
    if (q?.transcript)
      speak(q.transcript, { id: q.id, slow: action === "slow" }).catch((e) =>
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
        : Object.keys(state.mistakes)
            .sort((a, b) => state.mistakes[b].date - state.mistakes[a].date)
            .filter((id) => findQuestion(id))
            .slice(0, 5);
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
main.addEventListener("change", (e) => {
  if (e.target.id === "batch-page") {
    batchPage = Number(e.target.value);
    render();
    $("#batch-page").focus();
  }
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
  render();
}
render();
loadBank();
