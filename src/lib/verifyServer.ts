import "server-only";
import crypto from "node:crypto";
import nodemailer from "nodemailer";
import { getUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Profile } from "@/lib/types";

export const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

/** The signed-in student's profile, read with the server key (so it works before/after any column changes). */
export async function currentStudent(): Promise<Profile | null> {
  const { user } = await getUser();
  if (!user) return null;
  const { data } = await supabaseAdmin().from("profiles").select("*").eq("id", user.id).maybeSingle();
  return (data as Profile) || null;
}

export const smtpReady = () =>
  !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.SMTP_FROM);

export async function sendCodeEmail(to: string, code: string, name: string) {
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST, port, secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  const first = name.split(" ")[0] || "there";
  await transport.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: `${code} is your Den verification code`,
    text: `Hi ${first},\n\nYour code to verify your student account on Den is ${code}. It works for 10 minutes.\n\nIf you didn't ask for this, you can ignore this email.\n\nDen`,
    html: `<div style="font-family:Arial,sans-serif;font-size:16px;color:#172033">
      <p>Hi ${first.replace(/[<>&"]/g, "")},</p>
      <p>Your code to verify your student account on Den is:</p>
      <p style="font-size:32px;font-weight:700;letter-spacing:6px;margin:16px 0">${code}</p>
      <p>It works for 10 minutes. If you didn't ask for this, you can ignore this email.</p>
      <p style="color:#566274">Den</p></div>`,
  });
}

export type CardReading = {
  is_student_id: boolean;
  name: string;
  college: string;
  belongs_to_college: boolean;
  id_number: string;
  valid_until: string;
  expired: boolean;
  looks_edited_or_screen: boolean;
  confidence: "high" | "medium" | "low";
  notes: string;
};

/** Loose name match: same words, any order, ignores case, dots and initials. */
export function namesMatch(a: string, b: string): boolean {
  const words = (s: string) => s.toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter((w) => w.length > 1);
  const A = words(a), B = words(b);
  if (!A.length || !B.length) return false;
  const [short, long] = A.length <= B.length ? [A, B] : [B, A];
  return short.every((w) => long.includes(w));
}
