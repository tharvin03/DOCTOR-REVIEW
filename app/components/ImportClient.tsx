"use client";
import SubmitButton from "@/app/components/SubmitButton";
import { useActionState } from "react";
import { commitImport, previewImport, type ImportState } from "@/app/admin/actions";
import type { RowResult } from "@/lib/import";

const pill = (s: string) => (s === "new" ? "warn" : s === "matched" ? "ok" : s === "error" ? "bad" : "");

function Table({ rows }: { rows: RowResult[] }) {
  return (
    <div className="table-scroll">
      <table>
        <thead><tr><th>Row</th><th>Status</th><th>Doctor</th><th>Hospital</th><th>Notes</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.row}>
              <td>{r.row}</td>
              <td><span className={`pill ${pill(r.status)}`}>{r.status}</span></td>
              <td>{r.doctorName} {r.doctor && <span className={`pill ${pill(r.doctor)}`}>{r.doctor}</span>}</td>
              <td>{r.hospitalName} {r.hospital && <span className={`pill ${pill(r.hospital)}`}>{r.hospital}</span>}</td>
              <td className="small">{r.error}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ImportClient() {
  const [preview, previewAction] = useActionState<ImportState, FormData>(previewImport, {});
  const [done, commitAction] = useActionState<ImportState, FormData>(commitImport, {});

  if (done.committed && done.rows) {
    const ok = done.rows.filter((r) => r.status !== "error").length;
    const failed = done.rows.filter((r) => r.status === "error");
    return (
      <div className="stack">
        <p className="notice success">Import finished: {ok} row(s) saved, {failed.length} failed.</p>
        {failed.length > 0 && <><h2>Failed rows</h2><Table rows={failed} /></>}
        <a className="btn secondary" href="/admin/import">Import another file</a>
      </div>
    );
  }

  const rows = preview.rows;
  const count = (s: string) => rows?.filter((r) => r.status === s).length ?? 0;
  return (
    <div className="stack">
      <form action={previewAction} className="card stack">
        <div><label htmlFor="file">Excel file (.xlsx)</label><input id="file" name="file" type="file" accept=".xlsx" required /></div>
        <div className="row">
          <SubmitButton pendingText="Reading…">Preview</SubmitButton>
          <a href="/admin/import/template" className="btn secondary" data-no-progress>Download template</a>
        </div>
      </form>
      {preview.error && <p className="notice error">{preview.error}</p>}
      {done.error && <p className="notice error">{done.error}</p>}
      {rows && (
        <>
          <p>
            <span className="pill warn">{count("new")} new</span>
            <span className="pill ok">{count("matched")} matched</span>
            <span className="pill bad">{count("error")} errors</span>
            <span className="muted small"> — “new” means a new doctor and/or hospital will be created. Nothing is saved yet.</span>
          </p>
          <Table rows={rows} />
          <form action={commitAction}>
            <input type="hidden" name="raw" value={preview.raw} />
            <SubmitButton disabled={count("error") === rows.length} pendingText="Importing… (this can take a minute)">
              {`Import ${rows.length - count("error")} valid row(s)`}
            </SubmitButton>
            {count("error") > 0 && <span className="muted small"> Rows with errors will be skipped and reported.</span>}
          </form>
        </>
      )}
    </div>
  );
}
