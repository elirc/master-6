export const roles = ["LEARNER", "INSTRUCTOR", "ADMIN", "ORG_ADMIN"] as const;
export type Role = (typeof roles)[number];

export type Membership = {
  userId: string;
  organizationId: string;
  role: Role;
};

export type Actor = {
  id: string;
  memberships: Membership[];
  impersonatingUserId?: string | undefined;
};

export type CourseStatus = "DRAFT" | "IN_REVIEW" | "PUBLISHED" | "ARCHIVED";
export type EnrollmentStatus = "ACTIVE" | "COMPLETED" | "DROPPED" | "EXPIRED";
export type LessonProgressStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";

export type CompletionRule = {
  requireAllLessons: boolean;
  minimumQuizScore?: number | undefined;
  requireAssignmentsGraded?: boolean | undefined;
};

export type LessonProgressSummary = {
  lessonId: string;
  status: LessonProgressStatus;
};

export type QuizQuestion = {
  id: string;
  points: number;
  correctOptionIds: string[];
};

export type QuizAnswer = {
  questionId: string;
  selectedOptionIds: string[];
};

export type QuizAttemptPolicy = {
  maxAttempts?: number | undefined;
  passingScore: number;
};

export type QuizAttemptSummary = {
  quizId: string;
  score: number;
  passed: boolean;
  submittedAt: Date;
};

export type AssignmentSubmissionSummary = {
  assignmentId: string;
  status: "DRAFT" | "SUBMITTED" | "RETURNED" | "GRADED";
  score?: number | undefined;
  submittedAt?: Date | undefined;
};

export type CertificateEligibilityInput = {
  enrollmentStatus: EnrollmentStatus;
  completionPercent: number;
  requiredQuizPassed: boolean;
  requiredAssignmentsComplete: boolean;
};

export type TranscriptCourse = {
  courseId: string;
  title: string;
  status: EnrollmentStatus;
  completionPercent: number;
  completedAt?: Date | undefined;
  certificateCode?: string | undefined;
};
