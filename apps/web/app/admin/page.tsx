import { Activity, Award, Database, Download, Flag, ShieldCheck, Users } from "lucide-react";
import { AppShell } from "../../components/app-shell";
import { MetricCard } from "../../components/metric-card";
import { demo } from "../../lib/demo-data";

export default function AdminPage() {
  return (
    <AppShell>
      <section className="page">
        <div className="page-header">
          <div>
            <div className="eyebrow">Admin Dashboard</div>
            <h1>Training operations</h1>
          </div>
          <div className="toolbar">
            <button className="button secondary" type="button">
              <Download size={18} /> Export CSV
            </button>
            <button className="button" type="button">
              <Users size={18} /> Import learners
            </button>
          </div>
        </div>

        <div className="grid cols-4">
          <MetricCard icon={Users} label="Users" value={demo.metrics.users} />
          <MetricCard icon={Database} label="Courses" value={demo.metrics.courses} />
          <MetricCard icon={Activity} label="Completion" tone="green" value={`${demo.metrics.completionRate}%`} />
          <MetricCard icon={Award} label="Certificates" tone="gold" value={demo.metrics.certificates} />
        </div>

        <div className="split">
          <section className="band">
            <h2>Audit log</h2>
            <div className="card">
              <table className="table">
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Actor</th>
                    <th>Target</th>
                  </tr>
                </thead>
                <tbody>
                  {demo.auditLogs.map((log) => (
                    <tr key={`${log.action}-${log.target}`}>
                      <td>{log.action}</td>
                      <td>{log.actor}</td>
                      <td>{log.target}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="band">
            <h2>Controls</h2>
            <div className="card">
              <div className="toolbar">
                <Flag size={18} />
                <strong>advanced-reporting</strong>
                <span className="status green">Enabled</span>
              </div>
              <div className="toolbar">
                <ShieldCheck size={18} />
                <strong>Admin impersonation</strong>
                <span className="status gold">Audited</span>
              </div>
            </div>
          </section>
        </div>
      </section>
    </AppShell>
  );
}
