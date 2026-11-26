import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { lessons } from "../data/lessons.js";
import { grade, advance, vocabularyQuestion, dayKey } from "../model.js";

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
