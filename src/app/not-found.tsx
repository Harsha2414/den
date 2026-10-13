import Link from "next/link";

export default function NotFound() {
  return (
    <main className="onb">
      <h1>Page not found<span>on Campus Adda.</span></h1>
      <p>The link may be broken, or the page was deleted.</p>
      <Link className="primary" href="/">Go to your college home</Link>
    </main>
  );
}
