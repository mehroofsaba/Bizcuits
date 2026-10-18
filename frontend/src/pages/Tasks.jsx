import { useState } from "react";
import { api } from "../api.js";
import {
  useList,
  Select,
  Empty,
  Field,
  Toast,
  useToast,
  runAi,
  Mascot,
  Loading,
} from "../ui.jsx";

const blank = { title: "", description: "", due_date: "", related: "" };

export default function Tasks() {
  const { rows, reload } = useList("/tasks");
  const products = useList("/products");
  const [t, setT] = useState(blank);
  const [editing, setEditing] = useState(null);
  const [goal, setGoal] = useState("");
  const [steps, setSteps] = useState([]);
  const [busy, setBusy] = useState(false);
  const [cheer, setCheer] = useState(0);
  const [toast, show] = useToast();
  const save = async (e) => {
    e.preventDefault();
    try {
      await api(editing ? `/tasks/${editing}` : "/tasks", {
        method: editing ? "PUT" : "POST",
        body: t,
      });
      setT(blank);
      setEditing(null);
      reload();
    } catch (err) {
      show(err.message, "err");
    }
  };
  const add = async (body) => {
    try {
      await api("/tasks", { method: "POST", body });
      reload();
    } catch (e) {
      show(e.message, "err");
    }
  };
  const toggle = async (x) => {
    const done = x.status !== "done";
    await api(`/tasks/${x.id}`, {
      method: "PUT",
      body: { status: done ? "done" : "open" },
    });
    reload();
    if (done) {
      setCheer((n) => n + 1);
      show("Task complete. Nice work!");
    }
  };
  const plan = async () => {
    setBusy(true);
    const r = await runAi("/ai/plan", { goal }, show);
    setBusy(false);
    if (r) setSteps(r.steps);
  };
  const today = new Date().toISOString().slice(0, 10);
  const open = rows?.filter((x) => x.status === "open") || [],
    done = rows?.filter((x) => x.status === "done") || [];

  // One row layout for every task: checkbox, title + due date, then Edit and Delete on the same line.
  const row = (x) => (
    <div className="task" key={x.id}>
      <label className="task-main">
        <input
          type="checkbox"
          checked={x.status === "done"}
          onChange={() => toggle(x)}
        />
        <span className="task-body">
          <b className={x.status === "done" ? "done-t" : ""}>{x.title}</b>
          <small>
            {x.due_date
              ? x.due_date < today && x.status === "open"
                ? `Overdue · ${x.due_date}`
                : x.due_date
              : "No due date"}
            {x.related ? ` · ${x.related}` : ""}
          </small>
          {x.description && <small>{x.description}</small>}
        </span>
      </label>
      <span className="task-actions">
        <button
          className="btn ghost sm"
          onClick={() => {
            setEditing(x.id);
            setT({
              title: x.title,
              description: x.description,
              due_date: x.due_date,
              related: x.related,
            });
          }}
        >
          Edit
        </button>
        <button
          className="btn ghost sm danger"
          onClick={async () => {
            await api(`/tasks/${x.id}`, { method: "DELETE" });
            reload();
          }}
        >
          Delete
        </button>
      </span>
    </div>
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Daily Flow</h1>
          <p>Tasks and follow-ups. Works even when AI is offline.</p>
        </div>
        <Mascot size={70} className={cheer ? "bounce" : ""} key={cheer} />
      </div>
      <div className="grid g2">
        <section className="card">
          <div className="card-head">
            <h2>{editing ? "Edit task" : "Add task"}</h2>
            <div className="card-actions">
              {editing && (
                <button
                  type="button"
                  className="btn ghost sm"
                  onClick={() => {
                    setEditing(null);
                    setT(blank);
                  }}
                >
                  Cancel
                </button>
              )}
              <button className="btn primary sm" form="task-form">
                {editing ? "Save changes" : "Add task"}
              </button>
            </div>
          </div>
          <form id="task-form" className="stack" onSubmit={save}>
            <Field label="Title">
              <input
                value={t.title}
                onChange={(e) => setT({ ...t, title: e.target.value })}
                required
              />
            </Field>
            <Field label="Notes">
              <textarea
                rows={2}
                value={t.description}
                onChange={(e) => setT({ ...t, description: e.target.value })}
              />
            </Field>
            <div className="row">
              <div className="grow">
                <Field label="Due date">
                  <input
                    type="date"
                    value={t.due_date}
                    onChange={(e) => setT({ ...t, due_date: e.target.value })}
                  />
                </Field>
              </div>
              <div className="grow">
                <Field label="Related to">
                  <Select
                    value={t.related}
                    onChange={(e) => setT({ ...t, related: e.target.value })}
                  >
                    <option value="">Nothing</option>
                    {t.related &&
                      !products.rows?.some(
                        (p) => `Product: ${p.name}` === t.related,
                      ) && <option value={t.related}>{t.related}</option>}
                    {products.rows?.map((p) => (
                      <option key={p.id} value={`Product: ${p.name}`}>
                        Product: {p.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            </div>
          </form>
        </section>
        <section className="card">
          <div className="card-head">
            <h2>Plan a goal</h2>
            <div className="card-actions">
              <button className="btn purple sm" disabled={busy} onClick={plan}>
                Suggest steps
              </button>
            </div>
          </div>
          <div className="stack">
            <Field label="Goal">
              <input
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="Launch my holiday collection"
              />
            </Field>
          </div>
          {busy && <Loading text="Gemma is planning…" />}
          {steps.map((s) => (
            <div className="item" key={s}>
              <small>{s}</small>
              <button
                className="btn ghost sm"
                onClick={async () => {
                  await add({ title: s, related: goal });
                  setSteps(steps.filter((x) => x !== s));
                }}
              >
                Add
              </button>
            </div>
          ))}
          {steps.length > 0 && (
            <p className="hint">
              These are suggestions, not commitments. Add only the ones you
              want, and set your own dates.
            </p>
          )}
        </section>
      </div>
      <section className="card" style={{ marginTop: 16 }}>
        <h2>To do</h2>
        {rows && !open.length ? (
          <Empty
            title="All clear"
            hint="Add a task above to plan your next step."
          />
        ) : (
          <div className="tasks">{open.map(row)}</div>
        )}
      </section>
      {done.length > 0 && (
        <section className="card" style={{ marginTop: 16 }}>
          <h2>Completed</h2>
          <div className="tasks">{done.map(row)}</div>
        </section>
      )}
      <Toast toast={toast} />
    </>
  );
}
