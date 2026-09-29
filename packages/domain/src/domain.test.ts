import { describe, expect, it } from "vitest";
import {
  buildTranscriptSummary,
  calculateLessonCompletionPercent,
  canImpersonate,
  canIssueCertificate,
  canManageCourse,
  canStartQuizAttempt,
  isCourseComplete,
  isFeatureEnabled,
  scoreQuiz,
  selectRandomizedQuestionIds
} from "./index.js";

describe("authorization helpers", () => {
  it("allows instructors to manage courses in their organization", () => {
    expect(
      canManageCourse(
        { id: "user-1", memberships: [{ organizationId: "org-1", role: "INSTRUCTOR", userId: "user-1" }] },
        "org-1"
      )
    ).toBe(true);
  });

  it("allows org admins to impersonate when not already impersonating", () => {
    expect(
      canImpersonate(
        { id: "admin-1", memberships: [{ organizationId: "org-1", role: "ORG_ADMIN", userId: "admin-1" }] },
        "org-1"
      )
    ).toBe(true);
  });
});

describe("completion rules", () => {
  it("does not treat missing required assignments as complete", () => {
    expect(isCourseComplete({
      rule: { requireAllLessons: false, requireAssignmentsGraded: true, requiredAssignmentIds: ["a1"] },
      lessonProgress: [], quizAttempts: [], assignmentSubmissions: []
    })).toBe(false);
  });
  it("does not treat a missing required lesson or quiz row as complete", () => {
    expect(isCourseComplete({
      rule: { requireAllLessons: true, requiredLessonIds: ["lesson-1", "lesson-2"], requiredQuizIds: ["quiz-1"], minimumQuizScore: 80 },
      lessonProgress: [{ lessonId: "lesson-1", status: "COMPLETED" }],
      quizAttempts: [],
      assignmentSubmissions: []
    })).toBe(false);
  });
  it("keeps the legacy all-progress rule strict when IDs are omitted", () => {
    expect(isCourseComplete({
      rule: { requireAllLessons: true },
      lessonProgress: [],
      quizAttempts: [],
      assignmentSubmissions: []
    })).toBe(false);
    expect(isCourseComplete({
      rule: { requireAllLessons: true },
      lessonProgress: [{ lessonId: "lesson-1", status: "COMPLETED" }],
      quizAttempts: [],
      assignmentSubmissions: []
    })).toBe(true);
  });
  it("honors explicit assessment IDs even when the broad flag is false", () => {
    expect(isCourseComplete({
      rule: { requireAllLessons: false, requiredQuizIds: ["quiz-1"], requireAssignmentsGraded: false, requiredAssignmentIds: ["assignment-1"] },
      lessonProgress: [],
      quizAttempts: [{ quizId: "quiz-1", score: 90, passed: true, submittedAt: new Date() }],
      assignmentSubmissions: []
    })).toBe(false);
  });
  it("allows an explicitly configured course with no assessments", () => {
    expect(isCourseComplete({
      rule: { requireAllLessons: true, requiredLessonIds: ["lesson-1"], requiredQuizIds: [], requiredAssignmentIds: [], requireAssignmentsGraded: true },
      lessonProgress: [{ lessonId: "lesson-1", status: "COMPLETED" }],
      quizAttempts: [],
      assignmentSubmissions: []
    })).toBe(true);
  });
  it("calculates lesson completion percentage", () => {
    expect(
      calculateLessonCompletionPercent([
        { lessonId: "1", status: "COMPLETED" },
        { lessonId: "2", status: "IN_PROGRESS" }
      ])
    ).toBe(50);
  });

  it("requires lessons, quiz passing, and graded assignments when configured", () => {
    expect(
      isCourseComplete({
        rule: { minimumQuizScore: 80, requireAllLessons: true, requireAssignmentsGraded: true },
        lessonProgress: [{ lessonId: "1", status: "COMPLETED" }],
        quizAttempts: [{ passed: true, quizId: "quiz-1", score: 92, submittedAt: new Date() }],
        assignmentSubmissions: [{ assignmentId: "assignment-1", score: 95, status: "GRADED", submittedAt: new Date() }]
      })
    ).toBe(true);
  });

  it("issues certificates only for complete enrollments", () => {
    expect(
      canIssueCertificate({
        completionPercent: 100,
        enrollmentStatus: "COMPLETED",
        requiredAssignmentsComplete: true,
        requiredQuizPassed: true
      })
    ).toBe(true);
  });
});

describe("quiz rules", () => {
  it("scores exact option matches", () => {
    expect(
      scoreQuiz(
        [
          { correctOptionIds: ["a"], id: "q1", points: 2 },
          { correctOptionIds: ["b", "c"], id: "q2", points: 3 }
        ],
        [
          { questionId: "q1", selectedOptionIds: ["a"] },
          { questionId: "q2", selectedOptionIds: ["c", "b"] }
        ]
      )
    ).toEqual({ earned: 5, possible: 5, score: 100 });
  });

  it("enforces quiz retake policies", () => {
    expect(canStartQuizAttempt(2, { maxAttempts: 2, passingScore: 80 })).toBe(false);
  });

  it("randomizes question selection deterministically", () => {
    expect(selectRandomizedQuestionIds(["a", "b", "c", "d"], 2, "learner-1")).toEqual(
      selectRandomizedQuestionIds(["a", "b", "c", "d"], 2, "learner-1")
    );
  });
});

describe("transcripts and flags", () => {
  it("summarizes transcript progress", () => {
    expect(
      buildTranscriptSummary([
        { certificateCode: "CERT-1", completionPercent: 100, courseId: "c1", status: "COMPLETED", title: "Security" },
        { completionPercent: 25, courseId: "c2", status: "ACTIVE", title: "Compliance" }
      ])
    ).toEqual({ activeCourses: 1, averageCompletionPercent: 63, certificatesEarned: 1, completedCourses: 1 });
  });

  it("evaluates rollout flags with a stable subject bucket", () => {
    expect(isFeatureEnabled({ enabled: true, key: "new-reporting", rolloutPercent: 100 }, "org-1")).toBe(true);
  });
});
