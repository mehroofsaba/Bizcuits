import { useEffect, useState } from "react";
import { api, money, download } from "../api.js";
import { Empty, Toast, useToast, runAi, Loading, ask } from "../ui.jsx";

export default function Analytics() {
  const [s, setS] = useState(null);
  const [errors, setErrors] = useState([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, show] = useToast();
  const load = () =>
    api("/sales/summary")
      .then(setS)
      .catch((e) => show(e.message, "err"));
  useEffect(() => {
    load();
  }, []);
  const upload = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const fd = new FormData();
    fd.append("file", f);
    setErrors([]);
    try {
      const r = await api("/sales/upload", { method: "POST", body: fd });
      setErrors(r.errors);
      show(`Imported ${r.imported} rows`);
      load();
    } catch (err) {
      setErrors(err.data?.errors || [err.message]);
    }
    e.target.value = "";
  };
  const max = s ? Math.max(...s.monthly.map((m) => m.total)) : 1;
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Sales Analytics</h1>
          <p>Upload a CSV. Totals are calculated by code, not guessed by AI.</p>
        </div>
        <div className="row">
          <button
            className="btn ghost wide"
            onClick={() =>
              download("sales-template.csv", "date,product,quantity,amount\n")
            }
          >
            Download template
          </button>
          <label className="btn primary wide" style={{ cursor: "pointer" }}>
            Upload CSV
            <input type="file" accept=".csv" onChange={upload} className="sr" />
          </label>
        </div>
      </div>
      <p className="hint">
        Needs columns: date, product, quantity, and amount (or price). Max 2 MB.
      </p>
      {errors.length > 0 && (
        <div className="warn" role="alert">
          {errors.map((e) => (
            <div key={e}>{e}</div>
          ))}
        </div>
      )}
      {!s ? (
        <section className="card" style={{ marginTop: 16 }}>
          <Empty
            title="No sales data"
            hint="Import a CSV to see totals, top products and monthly sales."
          />
        </section>
      ) : (
        <>
          <div className="grid g3" style={{ margin: "16px 0" }}>
            <div className="card">
              <small className="hint">Total recorded sales</small>
              <div className="kpi">{money(s.total_sales)}</div>
            </div>
            <div className="card">
              <small className="hint">Orders (rows)</small>
              <div className="kpi">{s.orders}</div>
            </div>
            <div className="card">
              <small className="hint">Units sold</small>
              <div className="kpi">{s.units}</div>
            </div>
          </div>
          {s.comparison && (
            <section className="card" style={{ marginBottom: 16 }}>
              <h2>Month compared with the one before</h2>
              <p>
                <b>{s.comparison.latest_month}</b>: {money(s.comparison.latest)}{" "}
                vs <b>{s.comparison.previous_month}</b>:{" "}
                {money(s.comparison.previous)} (
                {s.comparison.change_percent > 0 ? "+" : ""}
                {s.comparison.change_percent}%)
              </p>
              <p className="hint">
                This compares recorded totals only. It does not show what caused
                the change.
              </p>
            </section>
          )}
          <div className="grid g2">
            <section className="card">
              <h2>Sales by month</h2>
              <div
                className="bars"
                style={{ marginBottom: 28 }}
                role="img"
                aria-label="Monthly sales bars"
              >
                {s.monthly.map((m) => (
                  <div
                    key={m.month}
                    style={{ height: `${(m.total / max) * 100}%` }}
                    title={`${m.month}: ${money(m.total)}`}
                  >
                    <span>{m.month.slice(2)}</span>
                  </div>
                ))}
              </div>
            </section>
            <section className="card">
              <h2>Top products</h2>
              {s.top_products.map((p, i) => (
                <div className="item" key={p.product}>
                  <span>
                    {i + 1}. {p.product}
                    <small> · {p.units} units</small>
                  </span>
                  <b>{money(p.total)}</b>
                </div>
              ))}
            </section>
          </div>
          <section className="card" style={{ marginTop: 16 }}>
            <div className="row">
              <button
                className="btn purple sm"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  const r = await runAi("/ai/explain-sales", {}, show);
                  setBusy(false);
                  if (r) setText(r.text);
                }}
              >
                Explain with Gemma
              </button>
              <button
                className="btn ghost sm danger"
                onClick={async () => {
                  if (
                    await ask("Delete all imported sales?", {
                      title: "Clear sales data",
                      ok: "Delete",
                      danger: true,
                    })
                  ) {
                    await api("/sales", { method: "DELETE" });
                    setS(null);
                  }
                }}
              >
                Clear sales data
              </button>
            </div>
            {busy && <Loading text="Gemma is reading the numbers…" />}
            {text && <p>{text}</p>}
            <p className="hint">
              Gemma explains the numbers above. It does not calculate them or
              say what caused a change.
            </p>
          </section>
        </>
      )}
      <Toast toast={toast} />
    </>
  );
}
