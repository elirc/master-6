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
  const lessonRequirementMet =
    !input.rule.requireAllLessons || calculateLessonCompletionPercent(input.lessonProgress) === 100;

  const quizRequirementMet =
    input.rule.minimumQuizScore === undefined ||
    input.quizAttempts.some((attempt) => attempt.score >= input.rule.minimumQuizScore! && attempt.passed);

  const assignmentRequirementMet =
    !input.rule.requireAssignmentsGraded ||
    input.assignmentSubmissions.every((submission) => submission.status === "GRADED");

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
