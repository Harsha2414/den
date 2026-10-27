/** Share a Den link: the phone's share sheet (WhatsApp, Instagram...) when there is one, otherwise copy the link. */
export async function shareLink(url: string, title: string, text = ""): Promise<"shared" | "copied" | "cancelled" | "failed"> {
  const nav = typeof navigator !== "undefined" ? navigator : null;
  if (nav?.share) {
    try { await nav.share({ title, text, url }); return "shared"; }
    catch (e) { if ((e as Error)?.name === "AbortError") return "cancelled"; }
  }
  try { await nav?.clipboard?.writeText(url); return "copied"; } catch { return "failed"; }
}

/** A WhatsApp link that opens a chat with this message ready to send. */
export const whatsappLink = (message: string) => `https://wa.me/?text=${encodeURIComponent(message)}`;

/** The message used to invite classmates to Den. */
export function inviteMessage(collegeName: string | undefined, origin: string) {
  return collegeName
    ? `I'm on Den, the student hangout for ${collegeName}. Join here: ${origin}/signup`
    : `Join me on Den, the student hangout for every college in India: ${origin}/signup`;
}
