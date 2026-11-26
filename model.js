import { workLessons, workTracks } from "./data/work.js";

const key = "fluentpath.en.v1";
const trackKeys = Object.keys(workTracks);
const roundTracks = new Set([
  "grammar", "vocabulary", "toeic", "listening", "review", "daily", ...trackKeys,
]);
const workByTrack = Object.fromEntries(trackKeys.map((track) => [
  track,
  workLessons.filter((unit) => unit.track === track).flatMap((unit) => unit.questions.map((q) => q.id)),
]));
const workIds = new Set(Object.values(workByTrack).flat());
const mixedOrder = Array.from(
  { length: Math.max(...Object.values(workByTrack).map((ids) => ids.length)) },
  (_, index) => trackKeys.map((track) => workByTrack[track][index]).filter(Boolean),
).flat();

const emptyState = () => ({
  xp: 0,
  days: {},
  cleared: {},
  mastered: {},
  mistakes: {},
  notes: {},
  workSeen: {},
  dailyPlan: null,
  prefs: { focus: "mixed", reminderTime: "08:30" },
  active: null,
});
const isMap = (value) =>
  !!value && typeof value === "object" && !Array.isArray(value);
const count = (value) => Number.isSafeInteger(value) && value >= 0 ? value : 0;
const datePattern = /^\d{4}-\d\d-\d\d$/;
const validDay = (value) => typeof value === "string" && datePattern.test(value);
const validIds = (ids) =>
  Array.isArray(ids) && ids.length > 0 && ids.length <= 5 &&
  ids.every((id) => typeof id === "string" && id.length > 0) &&
  new Set(ids).size === ids.length;
const safeKey = (name) => !["__proto__", "prototype", "constructor"].includes(name);
const mapOf = (source, read) =>
  isMap(source) ? Object.fromEntries(Object.entries(source).flatMap(([name, value]) => {
    if (!safeKey(name)) return [];
    const entry = read(value, name);
    return entry === undefined ? [] : [[name, entry]];
  })) : {};

function normalizeState(saved) {
  const state = emptyState();
  if (!isMap(saved)) return state;
  state.xp = count(saved.xp);
  state.days = mapOf(saved.days, (value, name) => {
    if (!validDay(name) || !isMap(value)) return;
    return { answers: count(value.answers), correct: count(value.correct), rounds: count(value.rounds) };
  });
  state.cleared = mapOf(saved.cleared, (value) => value === true ? true : undefined);
  state.mastered = mapOf(saved.mastered, (value) => value === true ? true : undefined);
  state.notes = mapOf(saved.notes, (value) => {
    if (typeof value?.title !== "string" || typeof value.body !== "string") return;
    return { title: value.title, body: value.body, date: count(value.date) };
  });
  state.mistakes = mapOf(saved.mistakes, (value, id) => {
    if (!isMap(value)) return;
    const mistake = {
      label: typeof value.label === "string" ? value.label : "",
      choice: count(value.choice),
      count: count(value.count) || 1,
      date: count(value.date),
    };
    if (workIds.has(id) && validDay(value.due)) {
      mistake.due = value.due;
      mistake.step = Math.min(2, count(value.step));
    }
    return mistake;
  });
  state.workSeen = mapOf(saved.workSeen, (value, id) =>
    workIds.has(id) && count(value) ? value : undefined,
  );
  if (trackKeys.includes(saved.prefs?.focus)) state.prefs.focus = saved.prefs.focus;
  if (validReminderTime(saved.prefs?.reminderTime)) state.prefs.reminderTime = saved.prefs.reminderTime;
  const plan = saved.dailyPlan;
  if (
    validDay(plan?.date) && validIds(plan.ids) && plan.ids.every((id) => workIds.has(id)) &&
    Array.isArray(plan.answers) && plan.answers.length <= plan.ids.length &&
    plan.answers.every((choice) => Number.isInteger(choice) && choice >= 0 && choice < 4)
  ) {
    state.dailyPlan = { date: plan.date, ids: plan.ids, answers: plan.answers };
  }
  const active = saved.active;
  if (
    roundTracks.has(active?.track) && typeof active.title === "string" &&
    typeof active.lessonId === "string" && validIds(active.ids) &&
    Number.isInteger(active.index) && active.index >= 0 && active.index < active.ids.length &&
    (active.selected === null || Number.isInteger(active.selected) && active.selected >= 0 && active.selected < 4)
  ) {
    state.active = {
      track: active.track,
      title: active.title,
      lessonId: active.lessonId,
      ids: active.ids,
      index: active.index,
      score: Math.min(count(active.score), active.ids.length),
      selected: active.selected,
      finished: active.finished === true,
    };
  }
  return state;
}

export function readState() {
  try {
    return normalizeState(JSON.parse(localStorage.getItem(key)));
  } catch {
    return emptyState();
  }
}

export function persist(state) {
  localStorage.setItem(key, JSON.stringify(state));
}

export function backupText(state) {
  return JSON.stringify({ app: "fluent-path", version: 1, state }, null, 2);
}

export function restoreBackup(text) {
  let file;
  try {
    file = JSON.parse(text);
  } catch {
    throw new Error("無法讀取這個 JSON 檔案。");
  }
  const fields = ["days", "cleared", "mastered", "mistakes", "notes"];
  if (file?.app !== "fluent-path" || file.version !== 1 ||
      !Number.isSafeInteger(file.state?.xp) || file.state.xp < 0 ||
      !fields.every((name) => isMap(file.state[name]))) {
    throw new Error("請選擇 FluentPath 匯出的學習備份檔。");
  }
  const restored = normalizeState(file.state);
  if (
    fields.some((name) => Object.keys(restored[name]).length !== Object.keys(file.state[name]).length) ||
    (file.state.dailyPlan != null && !restored.dailyPlan) ||
    (file.state.active != null && !restored.active)
  ) {
    throw new Error("備份中的學習紀錄格式有誤。");
  }
  return restored;
}

export function dayKey(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function afterDays(date, amount) {
  const day = new Date(date);
  day.setDate(day.getDate() + amount);
  return dayKey(day);
}

export function streak(state) {
  const day = new Date();
  if (!state.days[dayKey(day)]?.answers) day.setDate(day.getDate() - 1);
  let total = 0;
  while (state.days[dayKey(day)]?.answers) {
    total++;
    day.setDate(day.getDate() - 1);
  }
  return total;
}

export function reviewQueue(state, { date = new Date(), includeScheduled = false } = {}) {
  const today = dayKey(date);
  return Object.entries(state.mistakes)
    .filter(([, mistake]) => includeScheduled || !mistake.due || mistake.due <= today)
    .sort(([, a], [, b]) => (a.due || "").localeCompare(b.due || "") || b.date - a.date)
    .map(([id]) => id);
}

export function dailyPractice(state, date = new Date()) {
  const today = dayKey(date);
  if (state.dailyPlan?.date === today) return state.dailyPlan;
  const reviews = reviewQueue(state, { date }).filter((id) => workIds.has(id)).slice(0, 2);
  const pool = workByTrack[state.prefs?.focus] || mixedOrder;
  const fill = pool.filter((id) => !reviews.includes(id)).sort((a, b) =>
    Number(!!state.mistakes[a]) - Number(!!state.mistakes[b]) ||
    (state.workSeen?.[a] || 0) - (state.workSeen?.[b] || 0),
  );
  return { date: today, ids: [...reviews, ...fill].slice(0, 5), answers: [] };
}

export function validReminderTime(time) {
  return typeof time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
}

export function learningCalendar(time, now = new Date()) {
  if (!validReminderTime(time)) throw new Error("請選擇有效的提醒時間。");
  const [hour, minute] = time.split(":").map(Number);
  const taipeiOffset = 8 * 60 * 60 * 1000;
  const localNow = now.getTime() + taipeiOffset;
  const next = new Date(localNow);
  next.setUTCHours(hour, minute, 0, 0);
  if (next.getTime() <= localNow) next.setUTCDate(next.getUTCDate() + 1);
  const start = new Date(next.getTime() - taipeiOffset);
  const utc = (date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//FluentPath//Daily English Practice//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    "UID:fluentpath-daily-practice@ntustray.github.io",
    "DTSTAMP:" + utc(now),
    "DTSTART:" + utc(start),
    "DURATION:PT5M",
    "RRULE:FREQ=DAILY",
    "TRANSP:TRANSPARENT",
    "SUMMARY:FluentPath 英文練習",
    "DESCRIPTION:練五題工作英文並複習到期錯題。",
    "URL:https://ntustray.github.io/fluent-path/",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "TRIGGER:PT0S",
    "DESCRIPTION:FluentPath 英文練習",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

// Reproducible choices allow a saved vocabulary mistake to be reconstructed after refresh.
function randomAt(seed) {
  let n = seed >>> 0;
  return () => {
    n = (Math.imul(n, 1664525) + 1013904223) >>> 0;
    return n / 4294967296;
  };
}
export function vocabularyQuestion(words, i) {
  const [word, meaning] = words[i];
  const rng = randomAt(i + 3261);
  const choices = new Set([meaning]);
  while (choices.size < 4 && choices.size < words.length)
    choices.add(words[Math.floor(rng() * words.length)][1]);
  const items = [...choices];
  for (let n = items.length - 1; n > 0; n--) {
    const j = Math.floor(rng() * (n + 1));
    [items[n], items[j]] = [items[j], items[n]];
  }
  return {
    id: "word-" + word,
    prompt: word,
    choices: items,
    answer: items.indexOf(meaning),
    explanation: word + " 的意思是「" + meaning + "」。",
    word,
  };
}
export function grade(state, question, choice, label, date = new Date()) {
  const a = state.active;
  if (
    !a || a.finished || a.selected !== null || a.ids[a.index] !== question.id ||
    !Number.isInteger(choice) || choice < 0 || choice >= question.choices.length
  ) return;
  a.selected = choice;
  const today = dayKey(date);
  const day = (state.days[today] ||= { answers: 0, correct: 0, rounds: 0 });
  day.answers++;
  const plan = state.dailyPlan;
  if (a.track === "daily" && a.lessonId === "daily-" + plan?.date &&
      plan.answers.length === a.index && plan.ids[a.index] === question.id) {
    plan.answers.push(choice);
  }
  if (question.work) (state.workSeen ||= {})[question.id] = date.getTime();
  const old = state.mistakes[question.id];
  if (choice === question.answer) {
    a.score++;
    day.correct++;
    state.xp += 10;
    if (question.word) state.mastered[question.word] = true;
    // A quick retry is useful practice, but it does not shorten a scheduled interval.
    if (question.work && old?.due) {
      if (old.due > today) return;
      const gap = [3, 7][old.step];
      if (gap) {
        old.due = afterDays(date, gap);
        old.step++;
        return;
      }
    }
    delete state.mistakes[question.id];
    return;
  }
  if (question.word) delete state.mastered[question.word];
  state.mistakes[question.id] = {
    label,
    choice,
    count: (old?.count || 0) + 1,
    date: date.getTime(),
    ...(question.work ? { due: afterDays(date, 1), step: 0 } : {}),
  };
}

export function advance(state, date = new Date()) {
  const a = state.active;
  if (!a || a.selected === null || a.finished) return;
  if (a.index + 1 < a.ids.length) {
    a.index++;
    a.selected = null;
    return;
  }
  a.finished = true;
  const day = (state.days[dayKey(date)] ||= { answers: 0, correct: 0, rounds: 0 });
  day.rounds++;
  if (!["review", "daily"].includes(a.track) && a.score * 5 >= a.ids.length * 4)
    state.cleared[a.lessonId] = true;
}
