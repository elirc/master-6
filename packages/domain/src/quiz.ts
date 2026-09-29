import type { QuizAnswer, QuizAttemptPolicy, QuizQuestion } from "./types.js";

export function scoreQuiz(questions: QuizQuestion[], answers: QuizAnswer[]): { score: number; earned: number; possible: number } {
  const answerMap = new Map(answers.map((answer) => [answer.questionId, normalize(answer.selectedOptionIds)]));
  const possible = questions.reduce((total, question) => total + question.points, 0);

  const earned = questions.reduce((total, question) => {
    const selected = answerMap.get(question.id) ?? [];
    const correct = normalize(question.correctOptionIds);
    return arraysEqual(selected, correct) ? total + question.points : total;
  }, 0);

  return {
    earned,
    possible,
    score: possible === 0 ? 0 : Math.round((earned / possible) * 100)
  };
}

export function canStartQuizAttempt(existingAttemptCount: number, policy: QuizAttemptPolicy): boolean {
  return policy.maxAttempts === undefined || existingAttemptCount < policy.maxAttempts;
}

export function selectRandomizedQuestionIds(questionIds: string[], count: number, seed: string): string[] {
  const values = [...questionIds];
  const random = seededRandom(seed);

  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const temp = values[index]!;
    values[index] = values[swapIndex]!;
    values[swapIndex] = temp;
  }

  return values.slice(0, Math.max(0, Math.min(count, values.length)));
}

function normalize(values: string[]): string[] {
  return [...values].sort();
}

function arraysEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function seededRandom(seed: string): () => number {
  let state = 0;
  for (const character of seed) {
    state = (state * 31 + character.charCodeAt(0)) >>> 0;
  }

  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
