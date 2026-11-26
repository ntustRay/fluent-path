import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { lessons as foundationLessons } from "../data/lessons.js";
import { workLessons, workTracks } from "../data/work.js";
import {
  grade, advance, vocabularyQuestion, dayKey, dailyPractice, reviewQueue, backupText,
  restoreBackup, learningCalendar,
} from "../model.js";

const lessons = [...foundationLessons, ...workLessons];

const vocabulary = JSON.parse(
  readFileSync(new URL("../data/vocabulary.json", import.meta.url), "utf8"),
);
const first = lessons[0];
test("every lesson has a unique ID, a guide, five graded questions and local listening audio", () => {
  const ids = new Set();
  for (const l of lessons) {
    assert.ok(l.guide && !ids.has(l.id));
    ids.add(l.id);
    assert.equal(l.questions.length, 5);
    for (const q of l.questions) {
      assert.ok(!ids.has(q.id));
      ids.add(q.id);
      assert.ok(q.explanation && q.choices[q.answer]);
      assert.equal(new Set(q.choices).size, q.choices.length);
      if (l.track === "listening") {
        assert.ok(q.transcript);
        assert.ok(
          existsSync(new URL("../audio/" + q.id + ".mp3", import.meta.url)),
        );
      }
    }
  }
});
test("7,000 distinct headwords produce replayable quizzes with four choices", () => {
  assert.equal(vocabulary.length, 7000);
  assert.equal(new Set(vocabulary.map(([w]) => w.toLowerCase())).size, 7000);
  for (let i = 0; i < vocabulary.length; i++) {
    const q = vocabularyQuestion(vocabulary, i);
    assert.ok(q.word.trim());
    assert.match(vocabulary[i][1], /\p{Script=Han}/u);
    assert.equal(q.choices.length, 4);
    assert.equal(q.choices[q.answer], vocabulary[i][1]);
    assert.deepEqual(vocabularyQuestion(vocabulary, i), q);
  }
});
test("resume preserves grading, unanswered questions cannot advance, and review clears mistakes", () => {
  const makeRound = (questions, track) => ({
    lessonId: first.id,
    title: first.title,
    index: 0,
    score: 0,
    selected: null,
    finished: false,
    track,
    ids: questions.map((q) => q.id),
  });
  let state = {
    xp: 0,
    days: {},
    cleared: {},
    mastered: {},
    mistakes: {},
    notes: {},
    active: makeRound(first.questions, "grammar"),
  };
  advance(state);
  assert.equal(state.active.index, 0);
  for (const [i, q] of first.questions.entries()) {
    const choice = i === 0 ? (q.answer + 1) % q.choices.length : q.answer;
    grade(state, q, choice, first.title);
    state = JSON.parse(JSON.stringify(state));
    grade(state, q, choice, first.title);
    advance(state);
  }
  advance(state);
  assert.equal(state.xp, 40);
  assert.equal(state.days[dayKey()].rounds, 1);
  assert.equal(state.active.finished, true);
  assert.equal(Object.keys(state.mistakes).length, 1);
  assert.equal(state.cleared[first.id], true);
  const missed = first.questions[0];
  state.active = makeRound([missed], "review");
  grade(state, missed, missed.answer, first.title);
  advance(state);
  assert.equal(state.xp, 50);
  assert.equal(Object.keys(state.mistakes).length, 0);
});

function emptyProfile() {
  return restoreBackup(backupText({ xp: 0, days: {}, cleared: {}, mastered: {}, mistakes: {}, notes: {} }));
}

const lookupWork = new Map(workLessons.flatMap((unit) => unit.questions.map((q) => [q.id, { q, unit }])));

test("work lessons have teachable phrases, writing examples and one listening activity per track", () => {
  assert.equal(workLessons.length, 12);
  for (const track of Object.keys(workTracks)) {
    const units = workLessons.filter((unit) => unit.track === track);
    assert.equal(units.length, 4);
    assert.equal(units.flatMap((l) => l.questions).filter((q) => q.transcript).length, 1);
    for (const unit of units) {
      assert.equal(unit.phrases.length, 3);
      assert.ok(unit.phrases.every(([term, meaning, example]) => term && /\p{Script=Han}/u.test(meaning) && example));
      assert.ok(unit.writing.prompt && unit.writing.example && unit.writing.checklist);
      assert.ok(unit.questions.every((q) => q.work));
    }
  }
});

test("daily practice mixes topics, prioritizes up to two due mistakes and respects the chosen focus", () => {
  const state = emptyProfile();
  const date = new Date(2026, 10, 26, 11);
  const first = dailyPractice(state, date);
  assert.equal(first.ids.length, 5);
  assert.equal(new Set(first.ids).size, 5);
  assert.deepEqual(new Set(first.ids.map((id) => lookupWork.get(id).unit.track)), new Set(Object.keys(workTracks)));

  for (const [index, id] of first.ids.slice(0, 3).entries()) {
    state.mistakes[id] = { choice: 0, count: 1, date: index + 1, due: "2026-11-26", step: 0 };
  }
  state.mistakes[first.ids[4]] = { choice: 1, count: 1, date: 6, due: "2026-11-27", step: 0 };
  state.prefs.focus = "engineering";
  const preferred = dailyPractice(state, date);
  assert.deepEqual(preferred.ids.slice(0, 2), [first.ids[2], first.ids[1]]);
  assert.ok(preferred.ids.slice(2).every((id) => lookupWork.get(id).unit.track === "engineering"));
  state.dailyPlan = preferred;
  state.prefs.focus = "business";
  assert.deepEqual(dailyPractice(state, date), preferred);
  assert.equal(dailyPractice(state, new Date(2026, 10, 27, 11)).date, "2026-11-27");
});

test("daily answers survive reload, award XP once and do not mark a course complete", () => {
  let state = emptyProfile();
  const date = new Date(2026, 10, 26, 11);
  const plan = dailyPractice(state, date);
  state.dailyPlan = plan;
  state.active = {
    track: "daily", title: "Daily practice", lessonId: "daily-" + plan.date,
    ids: plan.ids, index: 0, score: 0, selected: null, finished: false,
  };
  for (const id of plan.ids) {
    const { q, unit } = lookupWork.get(id);
    grade(state, q, q.answer, unit.title, date);
    state = restoreBackup(backupText(state));
    grade(state, q, q.answer, unit.title, date);
    advance(state, date);
  }
  assert.equal(state.active.finished, true);
  assert.equal(state.dailyPlan.answers.length, 5);
  assert.equal(state.days[dayKey(date)].answers, 5);
  assert.equal(state.days[dayKey(date)].rounds, 1);
  assert.equal(state.xp, 50);
  assert.deepEqual(state.cleared, {});
  const next = dailyPractice(state, new Date(2026, 10, 27, 11));
  assert.ok(next.ids.every((id) => !plan.ids.includes(id)));
});

test("work mistakes require three due reviews and an early correct retry does not change the schedule", () => {
  const state = emptyProfile();
  const unit = workLessons[0];
  const q = unit.questions[0];
  const answer = (date, choice = q.answer) => {
    state.active = { track: "review", lessonId: "review", title: "Review", ids: [q.id], index: 0, score: 0, selected: null, finished: false };
    grade(state, q, choice, unit.title, date);
    advance(state, date);
  };
  const date = (month, day) => new Date(2026, month - 1, day, 11);
  answer(date(3, 31), (q.answer + 1) % q.choices.length);
  assert.equal(state.mistakes[q.id].due, "2026-04-01");
  assert.deepEqual(reviewQueue(state, { date: date(3, 31) }), []);
  answer(date(3, 31));
  assert.equal(state.mistakes[q.id].step, 0);
  assert.deepEqual(reviewQueue(state, { date: date(4, 1) }), [q.id]);
  answer(date(4, 1));
  assert.equal(state.mistakes[q.id].due, "2026-04-04");
  answer(date(4, 4));
  assert.equal(state.mistakes[q.id].due, "2026-04-11");
  answer(date(4, 11));
  assert.equal(state.mistakes[q.id], undefined);
});

test("backups round-trip existing notes and reject unrelated or malformed files", () => {
  const state = emptyProfile();
  state.notes["q:grammar-habits-train"] = { title: "舊筆記", body: "My example.", date: 1 };
  state.notes["write:business-standup"] = { title: "寫作練習", body: "I’m waiting on the dataset.", date: 2 };
  state.cleared["grammar-habits"] = true;
  state.prefs = { focus: "ai", reminderTime: "17:45" };
  assert.deepEqual(restoreBackup(backupText(state)), state);
  assert.throws(() => restoreBackup("{}"), /FluentPath/);
  assert.throws(() => restoreBackup("not JSON"), /JSON/);
  state.notes.broken = { body: false };
  assert.throws(() => restoreBackup(backupText(state)), /格式有誤/);
});

test("calendar exports a repeating Taipei-time event with an alarm at the next reminder", () => {
  const morning = learningCalendar("08:30", new Date("2026-11-26T00:00:00Z"));
  const next = learningCalendar("08:30", new Date("2026-11-26T00:31:00Z"));
  assert.match(morning, /DTSTART:20261126T003000Z\r\n/);
  assert.match(next, /DTSTART:20261127T003000Z\r\n/);
  assert.match(next, /RRULE:FREQ=DAILY\r\n/);
  assert.match(next, /BEGIN:VALARM\r\nACTION:DISPLAY\r\nTRIGGER:PT0S\r\n/);
  assert.throws(() => learningCalendar("25:00"), /有效/);
});
