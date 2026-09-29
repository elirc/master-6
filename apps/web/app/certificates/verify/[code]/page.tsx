import { Award, CheckCircle2 } from "lucide-react";
import { AppShell } from "../../../../components/app-shell";
import { demo } from "../../../../lib/demo-data";

export default async function VerifyCertificatePage({ params }: { params: Promise<{ code: string }> }) {
  const resolvedParams = await params;
  const certificate = demo.certificates.find((item) => item.code === resolvedParams.code) ?? demo.certificates[0]!;

  return (
    <AppShell>
      <section className="page">
        <div className="page-header">
          <div>
            <div className="eyebrow">Certificate Verification</div>
            <h1>{certificate.code}</h1>
          </div>
          <span className="status green">
            <CheckCircle2 size={16} /> Verified
          </span>
        </div>

        <article className="card">
          <Award size={48} aria-hidden="true" />
          <h2>{certificate.course}</h2>
          <p className="muted">Issued to {certificate.learner}</p>
          <div className="toolbar">
            <span className="status green">{certificate.status}</span>
            <span>{certificate.code}</span>
          </div>
        </article>
      </section>
    </AppShell>
  );
}
