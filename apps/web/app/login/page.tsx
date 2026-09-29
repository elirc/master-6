import { KeyRound, LogIn } from "lucide-react";
import { AppShell } from "../../components/app-shell";

export default function LoginPage() {
  return (
    <AppShell>
      <section className="page">
        <div className="page-header">
          <div>
            <div className="eyebrow">Sign In</div>
            <h1>Northwind Learning</h1>
          </div>
        </div>
        <form className="card grid" style={{ maxWidth: 520 }}>
          <label>
            <span className="eyebrow">Email</span>
            <input className="input" defaultValue="learner@northwind.test" type="email" />
          </label>
          <label>
            <span className="eyebrow">Password</span>
            <input className="input" defaultValue="Password123!" type="password" />
          </label>
          <div className="toolbar">
            <button className="button success" type="button">
              <LogIn size={18} /> Sign in
            </button>
            <span className="muted">
              <KeyRound size={16} /> Demo tenant ready
            </span>
          </div>
        </form>
      </section>
    </AppShell>
  );
}
