import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { currentStudent, namesMatch, sha256, type CardReading } from "@/lib/verifyServer";

export const maxDuration = 60;
const err = (error: string, status = 400) => NextResponse.json({ error }, { status });

const PROMPT = (college: string, name: string) => `You are checking a photo that an Indian college student uploaded to prove they are a student.
The student says they study at: "${college}". They say the name printed on the card is: "${name}".

Look at the image and answer ONLY with a JSON object, no other text, with these keys:
{
  "is_student_id": true/false,        // is this a college or university student identity card (not an Aadhaar, PAN, licence, fee receipt or a random picture)?
  "name": "",                         // the student's name exactly as printed, or "" if unreadable
  "college": "",                      // the institution name as printed
  "belongs_to_college": true/false,   // does the card clearly belong to "${college}" (same institution; abbreviations like IIT Bombay = Indian Institute of Technology Bombay count)?
  "id_number": "",                    // roll number / enrolment / registration / ID number as printed, or ""
  "valid_until": "",                  // validity date or batch end year as printed (e.g. "Jun 2027", "2023-27"), or ""
  "expired": true/false,              // true only if the card is clearly no longer valid as of ${new Date().toISOString().slice(0, 7)}
  "looks_edited_or_screen": true/false, // signs of digital editing, a photo of a screen, a printout of a template, or text that doesn't fit the card
  "confidence": "high" | "medium" | "low", // how sure you are about all of the above from this image
  "notes": ""                         // one short sentence for the human reviewer about anything unclear
}`;

export async function POST(req: Request) {
  const me = await currentStudent();
  if (!me) return err("Sign in first.", 401);
  if (me.verified) return err("You're already verified.");
  if (me.banned_at) return err("Your account is suspended.", 403);

  const body = await req.json().catch(() => ({}));
  const path = String(body.path || "");
  const nameOnCard = String(body.name || "").trim().slice(0, 80);
  if (!path.startsWith(`${me.id}/`) || path.includes("..")) return err("Upload the photo again.");
  if (nameOnCard.length < 2) return err("Type your name as it's printed on the card.");

  const admin = supabaseAdmin();
  const { data: checks } = await admin.from("id_checks").select("status").eq("user_id", me.id);
  const list = (checks || []) as { status: string }[];
  if (list.some((c) => c.status === "pending")) return err("Your card is already being checked. You'll get the tick as soon as a reviewer approves it.");
  if (list.filter((c) => c.status === "rejected").length >= 3) {
    return err("You've tried 3 times. Ask classmates to vouch for you instead, or email us from the Help page.", 429);
  }

  const { data: college } = await admin.from("colleges").select("name").eq("id", me.college_id).maybeSingle<{ name: string }>();
  const { data: file, error: dlErr } = await admin.storage.from("id-cards").download(path);
  if (dlErr || !file) return err("Couldn't read the photo. Upload it again.");
  if (file.size > 5 * 1024 * 1024) return err("The photo is too large. Try again.");
  const mediaType = (["image/jpeg", "image/png", "image/webp"].includes(file.type) ? file.type : "image/jpeg") as "image/jpeg" | "image/png" | "image/webp";
  const data = Buffer.from(await file.arrayBuffer()).toString("base64");

  // Ask the AI to read the card. If it isn't set up or fails, a person reviews it instead.
  let reading: CardReading | null = null;
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const client = new Anthropic();
      const res = await client.messages.create({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
        max_tokens: 500,
        messages: [{ role: "user", content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data } },
          { type: "text", text: PROMPT(college?.name || me.college_id, nameOnCard) },
        ] }],
      });
      const text = res.content.map((c) => (c.type === "text" ? c.text : "")).join("");
      const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
      reading = JSON.parse(json) as CardReading;
    } catch {
      reading = null;
    }
  }

  const nameOk = !!reading && namesMatch(reading.name, nameOnCard) && namesMatch(nameOnCard, me.name);
  let verdict: "match" | "unclear" | "mismatch" | "error" = "error";
  if (reading) {
    if (!reading.is_student_id || !reading.belongs_to_college || (reading.name && !namesMatch(reading.name, nameOnCard))) verdict = "mismatch";
    else if (nameOk && !reading.expired && !reading.looks_edited_or_screen && reading.confidence === "high") verdict = "match";
    else verdict = "unclear";
  }

  const idNum = (reading?.id_number || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const fingerprint = idNum.length >= 4 ? sha256(`${me.college_id}:${idNum}`) : null;
  const ai = reading
    ? { name: reading.name, college: reading.college, belongs_to_college: reading.belongs_to_college, valid_until: reading.valid_until,
        expired: reading.expired, looks_edited_or_screen: reading.looks_edited_or_screen, is_student_id: reading.is_student_id,
        confidence: reading.confidence, notes: reading.notes, profile_name: me.name, name_matches: nameOk, has_id_number: !!idNum }
    : { notes: "The AI couldn't read this card. Please review it by eye.", profile_name: me.name };

  const row = { user_id: me.id, college_id: me.college_id, name_on_card: nameOnCard, photo_path: path, ai_verdict: verdict, ai_reading: ai, card_fingerprint: fingerprint };
  let { error: insErr } = await admin.from("id_checks").insert(row);
  if (insErr && /duplicate|unique/i.test(insErr.message)) {
    // Same card already verified someone else: never auto-approve; a person decides.
    verdict = "mismatch";
    ({ error: insErr } = await admin.from("id_checks").insert({ ...row, ai_verdict: "mismatch", card_fingerprint: null,
      ai_reading: { ...ai, used_before: true, notes: "This card's ID number was already used to verify another account." } }));
  }
  if (insErr) return err("Couldn't save your card. Try again.", 500);

  if (verdict === "match") {
    await admin.from("profiles").update({ verified_via: "id_card" }).eq("id", me.id);
    return NextResponse.json({ result: "verified" });
  }
  return NextResponse.json({ result: "review" });
}
