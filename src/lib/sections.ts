import type { FieldDef } from "@/components/Field";

export type SectionKey = "posts" | "notes" | "placements" | "listings" | "events";
export type LikeType = "post" | "note" | "placement" | "event";

export interface Section {
  key: SectionKey;
  label: string;
  cta: string;
  likeType?: LikeType;
  likeLabel?: string;
  empty: string;
  fields: FieldDef[];
  /** Convert form values into a database row. Return a string to show as an error. */
  toRow: (v: Record<string, string>) => Record<string, unknown> | string;
}

const VIS = ["My college", "All India"] as const;
export const EVENT_KINDS = ["Fest", "Hackathon", "Workshop", "Talk", "Club recruitment", "Sports", "Cultural", "Meetup", "Other"] as const;
export const TICKET_OPTIONS = ["No ticket needed", "Free ticket with QR check-in"] as const;

export const SECTIONS: Record<SectionKey, Section> = {
  posts: {
    key: "posts", label: "Feed", cta: "Write a post", likeType: "post", likeLabel: "Like",
    empty: "No posts here yet. Ask a doubt or share campus news to start the conversation.",
    fields: [
      { key: "body", label: "What's on your mind?", type: "textarea", required: true, placeholder: "Ask a doubt, share news, find a lost ID card...", max: 3000 },
      { key: "kind", label: "Type", type: "select", options: ["General", "Doubt", "Announcement", "Lost & found", "Hostel life"] },
      { key: "visibility", label: "Who can see it", type: "select", options: VIS, hint: "My college: only students of your college. All India: every student on Den." },
    ],
    toRow: (v) => ({ body: v.body, kind: v.kind, visibility: v.visibility === "All India" ? "india" : "college" }),
  },
  notes: {
    key: "notes", label: "Notes", cta: "Share notes", likeType: "note", likeLabel: "Helpful",
    empty: "No notes shared yet. Upload yours to Google Drive and add the link here.",
    fields: [
      { key: "title", label: "Title", type: "text", required: true, placeholder: "OS unit 2 notes", max: 120 },
      { key: "subject", label: "Subject", type: "text", required: true, placeholder: "Operating Systems", max: 80 },
      { key: "kind", label: "Type", type: "select", options: ["Notes", "PYQ", "Lab manual", "Assignment", "Book / PDF"] },
      { key: "semester", label: "Semester", type: "select", options: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"] },
      { key: "branch", label: "Branch", type: "text", placeholder: "CSE, ECE, BCom...", max: 60 },
      { key: "link", label: "Link (Google Drive etc.)", type: "url", placeholder: "https://", hint: "Make sure the link is set so anyone with it can view." },
    ],
    toRow: (v) => {
      if (v.link && !/^https?:\/\//i.test(v.link)) return "Links must start with https://";
      return { title: v.title, subject: v.subject, kind: v.kind, semester: parseInt(v.semester, 10), branch: v.branch, link: v.link };
    },
  },
  placements: {
    key: "placements", label: "Placements", cta: "Share interview story", likeType: "placement", likeLabel: "Helpful",
    empty: "No placement stories yet. Your interview experience could help a junior land the job.",
    fields: [
      { key: "company", label: "Company", type: "text", required: true, max: 80 },
      { key: "role", label: "Role", type: "text", required: true, placeholder: "SDE intern", max: 80 },
      { key: "ctc", label: "CTC / stipend", type: "text", placeholder: "12 LPA or 40k/month", max: 40 },
      { key: "result", label: "Result", type: "select", options: ["Selected", "Rejected", "In progress"] },
      { key: "rounds", label: "Rounds and questions", type: "textarea", required: true, placeholder: "Online test with 2 DSA questions, then...", max: 4000 },
      { key: "tips", label: "Tips for juniors", type: "textarea", max: 2000 },
    ],
    toRow: (v) => ({ company: v.company, role: v.role, ctc: v.ctc, result: v.result, rounds: v.rounds, tips: v.tips }),
  },
  listings: {
    key: "listings", label: "Market", cta: "Sell something",
    empty: "Nothing for sale yet. List old books, a cycle, a cooler...",
    fields: [
      { key: "item", label: "What are you selling?", type: "text", required: true, max: 100 },
      { key: "price", label: "Price (₹)", type: "number", required: true },
      { key: "condition", label: "Condition", type: "select", options: ["Like new", "Good", "Used"] },
      { key: "contact", label: "Where to meet or how to reach you", type: "text", required: true, placeholder: "Hostel B, room 214, or message me here", max: 120, hint: "Avoid posting your phone number publicly. Buyers can message you on Den." },
      { key: "details", label: "Details", type: "textarea", max: 1000 },
    ],
    toRow: (v) => {
      const price = parseInt(v.price, 10);
      if (!Number.isFinite(price) || price < 0) return "Enter a price in rupees.";
      return { item: v.item, price, condition: v.condition, contact: v.contact, details: v.details };
    },
  },
  events: {
    key: "events", label: "Events", cta: "Create an event",
    empty: "No upcoming events. Create your club's next fest, workshop or hackathon.",
    fields: [
      { key: "title", label: "Event name", type: "text", required: true, max: 120 },
      { key: "kind", label: "Type", type: "select", options: EVENT_KINDS },
      { key: "event_date", label: "Date", type: "date", required: true },
      { key: "start_time", label: "Starts at", type: "time" },
      { key: "end_time", label: "Ends at", type: "time" },
      { key: "venue", label: "Venue", type: "text", max: 120, placeholder: "Main auditorium" },
      { key: "tickets", label: "Entry", type: "select", options: TICKET_OPTIONS, hint: "With tickets, everyone who taps Going gets a QR code, and you scan it at the door." },
      { key: "capacity", label: "Seat limit", type: "number", placeholder: "Leave empty for no limit", hint: "Going stops when the event is full. Students can still tap Interested." },
      { key: "link", label: "Outside registration link (optional)", type: "url", placeholder: "https://" },
      { key: "details", label: "Details", type: "textarea", max: 2000, placeholder: "What's happening, who it's for, what to bring" },
    ],
    toRow: (v) => {
      if (v.link && !/^https?:\/\//i.test(v.link)) return "Links must start with https://";
      let capacity: number | null = null;
      if (v.capacity) {
        capacity = parseInt(v.capacity, 10);
        if (!Number.isFinite(capacity) || capacity < 1) return "Seat limit must be 1 or more, or left empty.";
      }
      if (v.start_time && v.end_time && v.end_time <= v.start_time) return "The end time must be after the start time.";
      if (v.end_time && !v.start_time) return "Add a start time too.";
      return {
        title: v.title, kind: v.kind, event_date: v.event_date, venue: v.venue, link: v.link, details: v.details,
        start_time: v.start_time || null, end_time: v.end_time || null, capacity, tickets: v.tickets === TICKET_OPTIONS[1],
      };
    },
  },
};

export const LIKE_TYPE_OF: Record<SectionKey, LikeType | undefined> = {
  posts: "post", notes: "note", placements: "placement", listings: undefined, events: undefined,
};

export const REPORT_TYPE_OF: Record<SectionKey, string> = {
  posts: "post", notes: "note", placements: "placement", listings: "listing", events: "event",
};
