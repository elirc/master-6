import type { TranscriptCourse } from "./types.js";

export function buildTranscriptSummary(courses: TranscriptCourse[]): {
  completedCourses: number;
  activeCourses: number;
  certificatesEarned: number;
  averageCompletionPercent: number;
} {
  if (courses.length === 0) {
    return {
      activeCourses: 0,
      averageCompletionPercent: 0,
      certificatesEarned: 0,
      completedCourses: 0
    };
  }

  const totalCompletion = courses.reduce((total, course) => total + course.completionPercent, 0);

  return {
    activeCourses: courses.filter((course) => course.status === "ACTIVE").length,
    averageCompletionPercent: Math.round(totalCompletion / courses.length),
    certificatesEarned: courses.filter((course) => Boolean(course.certificateCode)).length,
    completedCourses: courses.filter((course) => course.status === "COMPLETED").length
  };
}
