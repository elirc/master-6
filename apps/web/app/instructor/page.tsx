import { BookPlus, ClipboardCheck, MessageSquare, PenSquare } from "lucide-react";
import { AppShell } from "../../components/app-shell";
import { MetricCard } from "../../components/metric-card";
import { demo } from "../../lib/demo-data";

export default function InstructorPage() {
  return (
    <AppShell>
      <section className="page">
        <div className="page-header">
          <div>
            <div className="eyebrow">Instructor Dashboard</div>
            <h1>Author, grade, and coach</h1>
          </div>
          <button className="button success" type="button">
            <BookPlus size={18} /> New course
          </button>
        </div>

        <div className="grid cols-3">
          <MetricCard icon={PenSquare} label="Draft courses" value={4} />
          <MetricCard icon={ClipboardCheck} label="Pending grading" tone="gold" value={demo.metrics.pendingReviews} />
          <MetricCard icon={MessageSquare} label="Open discussions" tone="green" value={11} />
        </div>

        <div className="split">
          <section className="band">
            <h2>Authoring queue</h2>
            {demo.courses.map((course) => (
              <article className="card" key={course.id}>
                <div className="page-header">
                  <div>
                    <h3>{course.title}</h3>
                    <p className="muted">{course.summary}</p>
                  </div>
                  <button className="button secondary" type="button">
                    Edit
                  </button>
                </div>
              </article>
            ))}
          </section>

          <section className="band">
            <h2>Submissions</h2>
            <div className="card">
              <table className="table">
                <thead>
                  <tr>
                    <th>Learner</th>
                    <th>Assignment</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {demo.submissions.map((submission) => (
                    <tr key={`${submission.learner}-${submission.title}`}>
                      <td>{submission.learner}</td>
                      <td>{submission.title}</td>
                      <td>{submission.status}</td>
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
