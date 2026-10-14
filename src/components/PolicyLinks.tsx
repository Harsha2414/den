import Link from "next/link";

export default function PolicyLinks() {
  return (
    <nav className="policy-links" aria-label="Policies">
      <Link href="/terms">Terms of use</Link>
      <Link href="/privacy">Privacy policy</Link>
      <Link href="/guidelines">Community guidelines</Link>
    </nav>
  );
}
