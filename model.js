const key = "fluentpath.en.v1";
const emptyState = () => ({
  xp: 0,
  days: {},
  cleared: {},
  mastered: {},
  mistakes: {},
  notes: {},
  active: null,
});
const isMap = (value) =>
  !!value && typeof value === "object" && !Array.isArray(value);
export function readState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(key));
    if (!isMap(parsed)) return emptyState();
    const state = emptyState();
    for (const name of ["days", "cleared", "mastered", "mistakes", "notes"]) {
      if (isMap(parsed[name])) state[name] = parsed[name];
    }
    state.xp = Number.isSafeInteger(parsed.xp) && parsed.xp > 0 ? parsed.xp : 0;
    state.active =
      isMap(parsed.active) && Array.isArray(parsed.active.ids)
        ? parsed.active
        : null;
    return state;
  } catch {
    return emptyState();
  }
}
export function persist(state) {
  localStorage.setItem(key, JSON.stringify(state));
}
export function dayKey(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}
export function streak(state) {
  const d = new Date();
  if (!state.days[dayKey(d)]?.answers) d.setDate(d.getDate() - 1);
  let count = 0;
  while (state.days[dayKey(d)]?.answers) {
    count++;
    d.setDate(d.getDate() - 1);
  }
  return count;
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
export function grade(state, question, choice, label) {
  const a = state.active;
  if (
    !a ||
    a.selected !== null ||
    a.ids[a.index] !== question.id ||
    !Number.isInteger(choice) ||
    choice < 0 ||
    choice >= question.choices.length
  )
    return;
  a.selected = choice;
  const day = (state.days[dayKey()] ||= { answers: 0, correct: 0, rounds: 0 });
  day.answers++;
  if (choice === question.answer) {
    a.score++;
    day.correct++;
    state.xp += 10;
    if (question.word) state.mastered[question.word] = true;
    delete state.mistakes[question.id];
  } else {
    if (question.word) delete state.mastered[question.word];
    const old = state.mistakes[question.id];
    state.mistakes[question.id] = {
      label,
      choice,
      count: (old?.count || 0) + 1,
      date: Date.now(),
    };
  }
}
export function advance(state) {
  const a = state.active;
  if (!a || a.selected === null || a.finished) return;
  if (a.index + 1 < a.ids.length) {
    a.index++;
    a.selected = null;
    return;
  }
  a.finished = true;
  const day = (state.days[dayKey()] ||= { answers: 0, correct: 0, rounds: 0 });
  day.rounds++;
  if (a.track !== "review" && a.score * 5 >= a.ids.length * 4)
    state.cleared[a.lessonId] = true;
}
