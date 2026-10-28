/**
 * @mentions. In the database a mention is stored as @[Name](profile id), so it still links to the right
 * person if two students share a name. While typing, students see and type plain "@Name".
 */
export const MENTION_RE = /@\[([^\]\n]{1,60})\]\(([0-9a-f-]{36})\)/g;

/** Plain "@Name" -> stored token, for every name the student picked from the suggestions. */
export function toStored(text: string, picked: Record<string, string>) {
  let out = text;
  // Longest names first, so "@Ananya Rao" wins over "@Ananya".
  for (const name of Object.keys(picked).sort((a, b) => b.length - a.length)) {
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(`@${esc}(?![\\p{L}\\p{N}])`, "gu"), `@[${name}](${picked[name]})`);
  }
  return out;
}

/** Stored tokens -> plain "@Name" for editing, plus the names and ids found. */
export function fromStored(body: string): { text: string; picked: Record<string, string> } {
  const picked: Record<string, string> = {};
  const text = body.replace(MENTION_RE, (_, name: string, id: string) => { picked[name] = id; return `@${name}`; });
  return { text, picked };
}

/** Plain text of a body (for previews, share text and search). */
export const plainText = (body: string) => body.replace(MENTION_RE, (_, name: string) => `@${name}`);
