import { CheckCircle2, MessageSquare, PlayCircle, Send } from "lucide-react";
import { AppShell } from "../../../components/app-shell";
import { demo } from "../../../lib/demo-data";

export default function CourseWorkspacePage() {
  const course = demo.courses[0]!;

  return (
    <AppShell>
      <section className="page">
        <div className="page-header">
          <div>
            <div className="eyebrow">Course Workspace</div>
            <h1>{course.title}</h1>
          </div>
          <span className="status blue">{course.progress}% Complete</span>
        </div>

        <div className="split">
          <section className="band">
            <h2>Modules</h2>
            {["Security Foundations", "Data Protection"].map((module, index) => (
              <article className="card" key={module}>
                <div className="page-header">
                  <h3>{module}</h3>
                  <span className="status green">{index === 0 ? "In progress" : "Locked"}</span>
                </div>
                <div className="grid">
                  {["Recognizing Phishing", "Account Protection", "Handling Customer Data"].slice(index, index + 2).map((lesson) => (
                    <div className="toolbar" key={lesson}>
                      {index === 0 ? <CheckCircle2 size={18} /> : <PlayCircle size={18} />}
                      <span>{lesson}</span>
                      <button className="button secondary" type="button">
                        Open
                      </button>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </section>

          <section className="band">
            <h2>Assessment</h2>
            <div className="card">
              <h3>Security Awareness Check</h3>
              <p className="muted">Passing score: 80%. Attempts allowed: 3.</p>
              <button className="button" type="button">
                <PlayCircle size={18} /> Start quiz
              </button>
            </div>
            <div className="card">
              <h3>Customer Data Scenario</h3>
              <textarea className="textarea" defaultValue="I would verify the requester and escalate unusual requests." />
              <button className="button success" type="button">
                <Send size={18} /> Submit
              </button>
            </div>
            <div className="card">
              <h3>Discussions</h3>
              {demo.discussionThreads.map((thread) => (
                <div className="toolbar" key={thread.title}>
                  <MessageSquare size={18} />
                  <span>{thread.title}</span>
                  <span className="muted">{thread.posts} posts</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>
    </AppShell>
  );
}
