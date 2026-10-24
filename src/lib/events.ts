import type { CampusEvent } from "./types";
import { TICKET_OPTIONS } from "./sections";

/** Today's date in India, as YYYY-MM-DD. */
export const todayIST = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);

export const isPast = (ev: Pick<CampusEvent, "event_date">) => ev.event_date < todayIST();

/** "18:00:00" -> "6 pm", "18:30:00" -> "6:30 pm" */
export function timeLabel(t: string | null | undefined): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const hh = h % 12 || 12;
  return `${hh}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h < 12 ? "am" : "pm"}`;
}

export function dateLabel(d: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-IN", opts);
}

/** "Sat, 10 Jan · 6 pm to 9 pm" */
export function whenText(ev: CampusEvent): string {
  const t = ev.start_time ? ` · ${timeLabel(ev.start_time)}${ev.end_time ? ` to ${timeLabel(ev.end_time)}` : ""}` : "";
  return dateLabel(ev.event_date) + t;
}

/** Form values for editing an event in the Composer. */
export function eventToValues(ev: CampusEvent): Record<string, string> {
  return {
    title: ev.title, kind: ev.kind, event_date: ev.event_date,
    start_time: (ev.start_time || "").slice(0, 5), end_time: (ev.end_time || "").slice(0, 5),
    venue: ev.venue || "", tickets: ev.tickets ? TICKET_OPTIONS[1] : TICKET_OPTIONS[0],
    capacity: ev.capacity ? String(ev.capacity) : "", link: ev.link || "", details: ev.details || "",
    media: JSON.stringify(ev.media || []),
  };
}

// ---------- Calendar ----------

const pad = (n: number) => String(n).padStart(2, "0");
const stamp = (d: Date) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
const dayStamp = (d: Date) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;

/** Event times are in India time (UTC+5:30). Returns start/end, or all-day dates when there's no time. */
function span(ev: CampusEvent): { allDay: boolean; start: Date; end: Date } {
  const [y, mo, d] = ev.event_date.split("-").map(Number);
  if (!ev.start_time) {
    return { allDay: true, start: new Date(Date.UTC(y, mo - 1, d)), end: new Date(Date.UTC(y, mo - 1, d + 1)) };
  }
  const at = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return new Date(Date.UTC(y, mo - 1, d, h, m) - 5.5 * 3600e3);
  };
  const start = at(ev.start_time);
  const end = ev.end_time ? at(ev.end_time) : new Date(start.getTime() + 2 * 3600e3);
  return { allDay: false, start, end };
}

export function googleCalendarUrl(ev: CampusEvent, pageUrl: string): string {
  const s = span(ev);
  const dates = s.allDay ? `${dayStamp(s.start)}/${dayStamp(s.end)}` : `${stamp(s.start)}/${stamp(s.end)}`;
  const p = new URLSearchParams({
    action: "TEMPLATE", text: ev.title, dates, location: ev.venue || "",
    details: `${ev.details ? ev.details + "\n\n" : ""}On Den: ${pageUrl}`, ctz: "Asia/Kolkata",
  });
  return `https://calendar.google.com/calendar/render?${p}`;
}

const icsEscape = (t: string) => t.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/[,;]/g, (c) => "\\" + c);

/** A .ics file that Apple Calendar, Outlook and others can open. Includes a reminder 1 hour before. */
export function icsFile(ev: CampusEvent, pageUrl: string): string {
  const s = span(ev);
  const when = s.allDay
    ? [`DTSTART;VALUE=DATE:${dayStamp(s.start)}`, `DTEND;VALUE=DATE:${dayStamp(s.end)}`]
    : [`DTSTART:${stamp(s.start)}`, `DTEND:${stamp(s.end)}`];
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Den//Events//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${ev.id}@den`, `DTSTAMP:${stamp(new Date())}`, ...when,
    `SUMMARY:${icsEscape(ev.title)}`,
    ev.venue ? `LOCATION:${icsEscape(ev.venue)}` : "",
    `DESCRIPTION:${icsEscape(`${ev.details ? ev.details + "\n\n" : ""}On Den: ${pageUrl}`)}`,
    `URL:${pageUrl}`,
    ev.cancelled_at ? "STATUS:CANCELLED" : "STATUS:CONFIRMED",
    "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:Reminder", s.allDay ? "TRIGGER:-PT15H" : "TRIGGER:-PT1H", "END:VALARM",
    "END:VEVENT", "END:VCALENDAR",
  ].filter(Boolean).join("\r\n");
}

export function downloadIcs(ev: CampusEvent, pageUrl: string) {
  const blob = new Blob([icsFile(ev, pageUrl)], { type: "text/calendar;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${ev.title.replace(/[^\w\s-]/g, "").trim().slice(0, 40) || "event"}.ics`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/** Pull a 10-character ticket code out of whatever the camera read. */
export const extractTicketCode = (raw: string) => (raw.toUpperCase().match(/[0-9A-F]{10}/) || [""])[0];
