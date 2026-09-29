import { Filter, Search } from "lucide-react";
import { AppShell } from "../../components/app-shell";
import { demo } from "../../lib/demo-data";

export default function CatalogPage() {
  return (
    <AppShell>
      <section className="page">
        <div className="page-header">
          <div>
            <div className="eyebrow">Course Catalog</div>
            <h1>Published training</h1>
          </div>
          <div className="toolbar">
            <label>
              <span className="eyebrow">Search</span>
              <input className="input" placeholder="Security, manager, data" />
            </label>
            <button className="button secondary" type="button">
              <Filter size={18} /> Filters
            </button>
            <button className="button" type="button">
              <Search size={18} /> Apply
            </button>
          </div>
        </div>

        <div className="grid cols-3">
          {demo.courses.map((course) => (
            <article className="card" key={course.id}>
              <span className={`status ${course.status === "COMPLETED" ? "green" : "blue"}`}>{course.status}</span>
              <h2>{course.title}</h2>
              <p className="muted">{course.summary}</p>
              <div className="toolbar muted">
                <span>{course.lessons} lessons</span>
                <span>{course.quizzes} quizzes</span>
                <span>{course.assignments} assignments</span>
              </div>
              <button className="button success" type="button">
                Enroll
              </button>
            </article>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
