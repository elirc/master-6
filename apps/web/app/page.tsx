import { Award, BookOpen, ClipboardCheck, TrendingUp } from "lucide-react";
import { AppShell } from "../components/app-shell";
import { MetricCard } from "../components/metric-card";
import { demo } from "../lib/demo-data";

export default function LearnerDashboardPage() {
  return (
    <AppShell>
      <section className="page">
        <div className="page-header">
          <div>
            <div className="eyebrow">Learner Dashboard</div>
            <h1>Continue your learning</h1>
          </div>
          <div className="toolbar">
            <button className="button secondary" type="button">
              <BookOpen size={18} /> Catalog
            </button>
            <button className="button success" type="button">
              <Award size={18} /> Transcript
            </button>
          </div>
        </div>

        <div className="grid cols-4">
          <MetricCard icon={BookOpen} label="Active courses" value={2} />
          <MetricCard icon={TrendingUp} label="Average progress" tone="green" value="64%" />
          <MetricCard icon={ClipboardCheck} label="Due soon" tone="gold" value={3} />
          <MetricCard icon={Award} label="Certificates" tone="green" value={1} />
        </div>

        <div className="split">
          <section className="band">
            <h2>Enrolled courses</h2>
            <div className="grid">
              {demo.courses.map((course) => (
                <article className="card" key={course.id}>
                  <div className="page-header">
                    <div>
                      <h3>{course.title}</h3>
                      <p className="muted">{course.summary}</p>
                    </div>
                    <span className={`status ${course.status === "COMPLETED" ? "green" : "blue"}`}>{course.status}</span>
                  </div>
                  <div className="progress" aria-label={`${course.progress}% complete`}>
                    <span style={{ width: `${course.progress}%` }} />
                  </div>
                  <div className="toolbar muted">
                    <span>{course.lessons} lessons</span>
                    <span>{course.quizzes} quiz</span>
                    <span>{course.assignments} assignment</span>
                    <span>{course.due}</span>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="band">
            <h2>Due items</h2>
            <div className="card">
              <table className="table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {demo.submissions.map((submission) => (
                    <tr key={submission.title}>
                      <td>{submission.title}</td>
                      <td>
                        <span className="status gold">{submission.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </section>
    </AppShell>
  );
}
