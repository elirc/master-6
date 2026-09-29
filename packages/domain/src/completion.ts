import type {
  AssignmentSubmissionSummary,
  CertificateEligibilityInput,
  CompletionRule,
  LessonProgressSummary,
  QuizAttemptSummary
} from "./types.js";

export function calculateLessonCompletionPercent(progress: LessonProgressSummary[]): number {
  if (progress.length === 0) {
    return 0;
  }

  const completed = progress.filter((lesson) => lesson.status === "COMPLETED").length;
  return Math.round((completed / progress.length) * 100);
}

export function isCourseComplete(input: {
  rule: CompletionRule;
  lessonProgress: LessonProgressSummary[];
  quizAttempts: QuizAttemptSummary[];
  assignmentSubmissions: AssignmentSubmissionSummary[];
}): boolean {
  const requiredLessons = input.rule.requiredLessonIds;
  const lessonRequirementMet = requiredLessons !== undefined
    ? requiredLessons.every((id) =>
        input.lessonProgress.some((lesson) => lesson.lessonId === id && lesson.status === "COMPLETED"))
    : !input.rule.requireAllLessons || (input.lessonProgress.length > 0 && input.lessonProgress.every((lesson) => lesson.status === "COMPLETED"));

  const requiredQuizIds = input.rule.requiredQuizIds;
  const quizRequirementMet = requiredQuizIds !== undefined
    ? requiredQuizIds.every((quizId) =>
        input.quizAttempts.some((attempt) =>
          attempt.quizId === quizId && attempt.passed &&
          (input.rule.minimumQuizScore === undefined || attempt.score >= input.rule.minimumQuizScore)))
    : input.rule.minimumQuizScore === undefined || input.quizAttempts.some((attempt) =>
        attempt.passed && attempt.score >= input.rule.minimumQuizScore!);

  const requiredAssignmentIds = input.rule.requiredAssignmentIds;
  const assignmentRequirementMet = requiredAssignmentIds !== undefined
    ? requiredAssignmentIds.every((id) =>
        input.assignmentSubmissions.some((submission) => submission.assignmentId === id && submission.status === "GRADED"))
    : !input.rule.requireAssignmentsGraded || (input.assignmentSubmissions.length > 0 && input.assignmentSubmissions.every((submission) => submission.status === "GRADED"));

  return lessonRequirementMet && quizRequirementMet && assignmentRequirementMet;
}

export function canIssueCertificate(input: CertificateEligibilityInput): boolean {
  return (
    input.enrollmentStatus === "COMPLETED" &&
    input.completionPercent === 100 &&
    input.requiredQuizPassed &&
    input.requiredAssignmentsComplete
  );
}
