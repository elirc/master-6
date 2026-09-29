import { BarChart3, Building2, GraduationCap, TrendingUp } from "lucide-react";
import { AppShell } from "../../components/app-shell";
import { MetricCard } from "../../components/metric-card";
import { demo } from "../../lib/demo-data";

export default function ReportsPage() {
  return (
    <AppShell>
      <section className="page">
        <div className="page-header">
          <div>
            <div className="eyebrow">Reporting</div>
            <h1>Organization learning health</h1>
          </div>
          <button className="button" type="button">
            <BarChart3 size={18} /> Refresh
          </button>
        </div>

        <div className="grid cols-3">
          <MetricCard icon={Building2} label="Organization" value="Northwind" />
          <MetricCard icon={GraduationCap} label="Enrollments" tone="green" value={demo.metrics.enrollments} />
          <MetricCard icon={TrendingUp} label="Completion" tone="gold" value={`${demo.metrics.completionRate}%`} />
        </div>

        <section className="band">
          <h2>Course completion</h2>
          <div className="card">
            <table className="table">
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Progress</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {demo.courses.map((course) => (
                  <tr key={course.id}>
                    <td>{course.title}</td>
                    <td>{course.progress}%</td>
                    <td>{course.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </AppShell>
  );
}
