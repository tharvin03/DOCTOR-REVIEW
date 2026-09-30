"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main>
      <div className="wrap">
        <h1>Something went wrong</h1>
        <p className="muted">The page could not load. This is usually a weak connection or the database waking up. Try again in a moment.</p>
        <button className="btn" onClick={() => reset()}>Try again</button>
      </div>
    </main>
  );
}
