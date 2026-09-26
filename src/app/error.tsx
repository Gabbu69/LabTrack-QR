"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="single-form-page"><section className="single-form-card" role="alert">
    <h1>This page could not load</h1><p>Your records have not been cleared. Check your connection and try again.</p>
    <button className="button button-primary" onClick={reset}>Try again</button>
    <a className="text-link" href="/login">Return to sign in</a>
  </section></main>;
}
