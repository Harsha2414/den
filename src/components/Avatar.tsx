const COLORS = ["#F4A340", "#7FC8D6", "#9BD3A8", "#F2A7B5", "#C7B8F0", "#F6D06F", "#A9C6F5"];

export function colorFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return COLORS[h % COLORS.length];
}

export default function Avatar({ id, name, size, speaking }: { id: string; name?: string | null; size?: "lg"; speaking?: boolean }) {
  const initial = (name || "?").trim().charAt(0).toUpperCase() || "?";
  return (
    <span className={`av ${size === "lg" ? "lg" : ""} ${speaking ? "speaking" : ""}`} style={{ background: colorFor(id) }} aria-hidden="true">
      {initial}
    </span>
  );
}
