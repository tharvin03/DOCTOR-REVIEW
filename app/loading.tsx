/** Shown instantly while a page's data loads (e.g. when the free database is waking up). */
export default function Loading() {
  return (
    <main aria-busy="true" aria-label="Loading">
      <div className="wrap">
        <div className="skeleton" style={{ width: "40%", height: 28 }} />
        <div className="skeleton" style={{ width: "70%", height: 16, marginTop: 14 }} />
        <div className="skeleton card" style={{ height: 96, marginTop: 20 }} />
        <div className="skeleton card" style={{ height: 96 }} />
        <div className="skeleton card" style={{ height: 96 }} />
      </div>
    </main>
  );
}
