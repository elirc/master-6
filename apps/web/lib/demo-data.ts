export const demo = {
  auditLogs: [
    { action: "course.published", actor: "Iris Instructor", target: "Security Awareness 2026" },
    { action: "learners.bulk_imported", actor: "Omar OrgAdmin", target: "12 learners" },
    { action: "enrollment.completed", actor: "Leah Learner", target: "Security Awareness 2026" }
  ],
  certificates: [{ code: "CERT-DEMO2026", course: "Security Awareness 2026", learner: "Leah Learner", status: "ISSUED" }],
  courses: [
    {
      assignments: 1,
      due: "May 25, 2026",
      id: "course-security",
      lessons: 3,
      progress: 67,
      quizzes: 1,
      status: "ACTIVE",
      summary: "Annual security awareness training for all employees.",
      title: "Security Awareness 2026"
    },
    {
      assignments: 2,
      due: "June 7, 2026",
      id: "course-manager",
      lessons: 8,
      progress: 25,
      quizzes: 2,
      status: "ACTIVE",
      summary: "Practical coaching, feedback, and performance conversations.",
      title: "Manager Essentials"
    },
    {
      assignments: 1,
      due: "Completed",
      id: "course-data",
      lessons: 5,
      progress: 100,
      quizzes: 1,
      status: "COMPLETED",
      summary: "Customer data handling, privacy principles, and incident escalation.",
      title: "Data Privacy Foundations"
    }
  ],
  discussionThreads: [
    { posts: 8, title: "Phishing examples" },
    { posts: 3, title: "Handling customer exports" }
  ],
  metrics: {
    certificates: 148,
    completionRate: 78,
    courses: 24,
    enrollments: 912,
    pendingReviews: 17,
    users: 426
  },
  submissions: [
    { learner: "Leah Learner", score: null, status: "SUBMITTED", title: "Customer Data Scenario" },
    { learner: "Noah Nguyen", score: 91, status: "GRADED", title: "Manager Feedback Plan" },
    { learner: "Maya Patel", score: null, status: "RETURNED", title: "Privacy Incident Response" }
  ]
};
