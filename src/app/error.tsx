"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="onb">
      <h1>Something broke<span>on our side.</span></h1>
      <p>The page couldn't load. Check your connection and try again.</p>
      <button className="primary" onClick={reset}>Try again</button>
    </main>
  );
}
