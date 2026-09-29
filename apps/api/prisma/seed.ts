import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await clearDatabase();

  const passwordHash = await bcrypt.hash("Password123!", 10);

  const org = await prisma.organization.create({
    data: {
      name: "Northwind Learning",
      slug: "northwind-learning"
    }
  });

  const [learner, instructor, admin, orgAdmin] = await Promise.all([
    createUser("learner@northwind.test", "Leah Learner", "LEARNER", org.id, passwordHash),
    createUser("instructor@northwind.test", "Iris Instructor", "INSTRUCTOR", org.id, passwordHash),
    createUser("admin@northwind.test", "Ada Admin", "ADMIN", org.id, passwordHash),
    createUser("orgadmin@northwind.test", "Omar OrgAdmin", "ORG_ADMIN", org.id, passwordHash)
  ]);

  const securityCourse = await prisma.course.create({
    data: {
      createdById: instructor.id,
      organizationId: org.id,
      slug: "security-awareness-2026",
      status: "PUBLISHED",
      summary: "Annual security awareness training for all employees.",
      title: "Security Awareness 2026"
    }
  });

  const securityVersion = await prisma.courseVersion.create({
    data: {
      completionRuleJson: {
        minimumQuizScore: 80,
        requireAllLessons: true,
        requireAssignmentsGraded: true
      },
      courseId: securityCourse.id,
      publishedAt: new Date(),
      status: "PUBLISHED",
      summary: securityCourse.summary,
      title: securityCourse.title,
      versionNumber: 1
    }
  });

  await prisma.course.update({
    data: { currentVersionId: securityVersion.id },
    where: { id: securityCourse.id }
  });

  const foundations = await prisma.module.create({
    data: {
      courseVersionId: securityVersion.id,
      position: 1,
      title: "Security Foundations"
    }
  });

  const dataProtection = await prisma.module.create({
    data: {
      courseVersionId: securityVersion.id,
      position: 2,
      title: "Data Protection"
    }
  });

  const [lessonOne, lessonTwo, lessonThree] = await Promise.all([
    prisma.lesson.create({
      data: {
        content: "Understand phishing, credential safety, and reporting expectations.",
        durationMinutes: 18,
        moduleId: foundations.id,
        position: 1,
        title: "Recognizing Phishing"
      }
    }),
    prisma.lesson.create({
      data: {
        content: "Use password managers, MFA, and device hygiene to reduce risk.",
        durationMinutes: 22,
        moduleId: foundations.id,
        position: 2,
        title: "Account Protection"
      }
    }),
    prisma.lesson.create({
      data: {
        content: "Classify sensitive data and handle customer information responsibly.",
        durationMinutes: 25,
        moduleId: dataProtection.id,
        position: 1,
        title: "Handling Customer Data"
      }
    })
  ]);

  const bank = await prisma.questionBank.create({
    data: {
      organizationId: org.id,
      title: "Security Awareness Question Bank"
    }
  });

  const quiz = await prisma.quiz.create({
    data: {
      courseVersionId: securityVersion.id,
      maxAttempts: 3,
      passingScore: 80,
      questionBankId: bank.id,
      questionCount: 2,
      randomizeQuestionOrder: true,
      title: "Security Awareness Check"
    }
  });

  await createQuestion(quiz.id, bank.id, "What should you do with a suspected phishing email?", [
    ["Forward it to a coworker", false],
    ["Report it using the approved process", true],
    ["Reply asking if it is real", false]
  ]);

  await createQuestion(quiz.id, bank.id, "Which control most directly protects account sign-in?", [
    ["Multi-factor authentication", true],
    ["A wider monitor", false],
    ["Browser bookmarks", false]
  ]);

  const rubric = await prisma.rubric.create({
    data: {
      criteria: {
        create: [
          {
            description: "Identifies the security issue and likely risk.",
            label: "Risk identification",
            maxPoints: 50
          },
          {
            description: "Proposes a clear and policy-aligned response.",
            label: "Response quality",
            maxPoints: 50
          }
        ]
      },
      organizationId: org.id,
      title: "Security Scenario Rubric"
    }
  });

  const assignment = await prisma.assignment.create({
    data: {
      courseVersionId: securityVersion.id,
      dueDaysAfterEnrollment: 14,
      instructions: "Write a short response explaining how you would handle a suspicious customer-data request.",
      rubricId: rubric.id,
      title: "Customer Data Scenario"
    }
  });

  const cohort = await prisma.cohort.create({
    data: {
      courseId: securityCourse.id,
      endsAt: addDays(30),
      name: "May 2026 Security Cohort",
      organizationId: org.id,
      startsAt: new Date()
    }
  });

  const enrollment = await prisma.enrollment.create({
    data: {
      cohortId: cohort.id,
      courseId: securityCourse.id,
      courseVersionId: securityVersion.id,
      dueAt: addDays(21),
      organizationId: org.id,
      status: "ACTIVE",
      userId: learner.id
    }
  });

  await prisma.lessonProgress.createMany({
    data: [
      {
        completedAt: new Date(),
        enrollmentId: enrollment.id,
        lessonId: lessonOne.id,
        startedAt: new Date(),
        status: "COMPLETED"
      },
      {
        enrollmentId: enrollment.id,
        lessonId: lessonTwo.id,
        startedAt: new Date(),
        status: "IN_PROGRESS"
      },
      {
        enrollmentId: enrollment.id,
        lessonId: lessonThree.id,
        status: "NOT_STARTED"
      }
    ]
  });

  await prisma.assignmentSubmission.create({
    data: {
      assignmentId: assignment.id,
      content: "I would verify the requester, avoid sharing data externally, and escalate to Security.",
      enrollmentId: enrollment.id,
      status: "SUBMITTED",
      submittedAt: new Date(),
      userId: learner.id
    }
  });

  await prisma.discussionThread.create({
    data: {
      courseVersionId: securityVersion.id,
      lessonId: lessonOne.id,
      posts: {
        create: {
          authorId: instructor.id,
          body: "Share one phishing signal you have seen in the wild."
        }
      },
      title: "Phishing examples"
    }
  });

  await prisma.featureFlag.createMany({
    data: [
      { enabled: true, key: "advanced-reporting", organizationId: org.id, rolloutPercent: 100 },
      { enabled: true, key: "video-processing", organizationId: org.id, rolloutPercent: 50 }
    ]
  });

  await prisma.apiKey.create({
    data: {
      hashedKey: await bcrypt.hash("northwind_demo_api_key", 10),
      name: "Demo Enterprise API Key",
      organizationId: org.id,
      prefix: "lms_demo"
    }
  });

  await prisma.auditLog.create({
    data: {
      action: "seed.initialized",
      actorUserId: admin.id,
      metadata: { courseId: securityCourse.id },
      organizationId: org.id,
      targetId: securityCourse.id,
      targetType: "Course"
    }
  });

  await prisma.notification.create({
    data: {
      channel: "email",
      organizationId: org.id,
      payload: { courseTitle: securityCourse.title },
      scheduledFor: addDays(2),
      type: "course_due_reminder",
      userId: learner.id
    }
  });

  const event = await prisma.domainEvent.create({
    data: {
      organizationId: org.id,
      payload: { enrollmentId: enrollment.id },
      type: "enrollment.created"
    }
  });

  await prisma.outboxMessage.create({
    data: {
      domainEventId: event.id,
      payload: { eventId: event.id, topic: "enrollment.created" }
    }
  });

  console.log("Seed complete");
  console.table([
    { email: "learner@northwind.test", password: "Password123!", role: "LEARNER" },
    { email: "instructor@northwind.test", password: "Password123!", role: "INSTRUCTOR" },
    { email: "admin@northwind.test", password: "Password123!", role: "ADMIN" },
    { email: "orgadmin@northwind.test", password: "Password123!", role: "ORG_ADMIN" }
  ]);
}

async function createUser(email: string, name: string, role: "LEARNER" | "INSTRUCTOR" | "ADMIN" | "ORG_ADMIN", organizationId: string, passwordHash: string) {
  return prisma.user.create({
    data: {
      email,
      memberships: {
        create: {
          organizationId,
          role
        }
      },
      name,
      passwordHash
    }
  });
}

async function createQuestion(quizId: string, questionBankId: string, prompt: string, options: Array<[string, boolean]>) {
  return prisma.quizQuestion.create({
    data: {
      prompt,
      questionBankId,
      quizId,
      options: {
        create: options.map(([text, isCorrect], position) => ({
          isCorrect,
          position: position + 1,
          text
        }))
      },
      points: 1
    }
  });
}

function addDays(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

async function clearDatabase() {
  await prisma.outboxMessage.deleteMany();
  await prisma.domainEvent.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.featureFlag.deleteMany();
  await prisma.apiKey.deleteMany();
  await prisma.impersonationSession.deleteMany();
  await prisma.csvExport.deleteMany();
  await prisma.learnerTranscriptRow.deleteMany();
  await prisma.certificate.deleteMany();
  await prisma.assignmentSubmission.deleteMany();
  await prisma.quizAttempt.deleteMany();
  await prisma.lessonProgress.deleteMany();
  await prisma.enrollment.deleteMany();
  await prisma.discussionPost.deleteMany();
  await prisma.discussionThread.deleteMany();
  await prisma.cohort.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.rubricCriterion.deleteMany();
  await prisma.rubric.deleteMany();
  await prisma.quizOption.deleteMany();
  await prisma.quizQuestion.deleteMany();
  await prisma.quiz.deleteMany();
  await prisma.questionBank.deleteMany();
  await prisma.lesson.deleteMany();
  await prisma.module.deleteMany();
  await prisma.contentPackage.deleteMany();
  await prisma.videoAsset.deleteMany();
  await prisma.coursePrerequisite.deleteMany();
  await prisma.learningPathItem.deleteMany();
  await prisma.learningPath.deleteMany();
  await prisma.courseVersion.deleteMany();
  await prisma.course.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
