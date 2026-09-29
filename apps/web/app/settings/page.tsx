import { Bell, Flag, KeyRound, Settings } from "lucide-react";
import { AppShell } from "../../components/app-shell";

export default function SettingsPage() {
  return (
    <AppShell>
      <section className="page">
        <div className="page-header">
          <div>
            <div className="eyebrow">Settings</div>
            <h1>Platform controls</h1>
          </div>
        </div>

        <div className="grid cols-3">
          {[
            { icon: Flag, label: "Feature flags", value: "2 active" },
            { icon: Bell, label: "Notifications", value: "5 queued" },
            { icon: KeyRound, label: "API keys", value: "1 issued" }
          ].map((item) => {
            const Icon = item.icon;
            return (
              <article className="card" key={item.label}>
                <Icon size={24} />
                <h2>{item.label}</h2>
                <p className="muted">{item.value}</p>
                <button className="button secondary" type="button">
                  <Settings size={18} /> Manage
                </button>
              </article>
            );
          })}
        </div>
      </section>
    </AppShell>
  );
}
