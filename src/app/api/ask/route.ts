import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

type Turn = { role: "user" | "assistant"; content: string };

export async function POST(req: Request) {
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.json({ error: "Sign in to ask a senior." }, { status: 401 });
  const { data: allowed, error: accessErr } = await supabase.rpc("can_participate");
  // If the verification update (0005) isn't in the database yet, the function is missing: allow as before.
  if (!accessErr && allowed === false) return NextResponse.json({ error: "Verify your student account to ask the AI senior." }, { status: 403 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "Ask a senior isn't set up yet." }, { status: 503 });

  let turns: Turn[];
  try {
    const body = await req.json();
    turns = (Array.isArray(body.messages) ? body.messages : [])
      .filter((t: Turn) => (t.role === "user" || t.role === "assistant") && typeof t.content === "string" && t.content.trim())
      .slice(-8)
      .map((t: Turn) => ({ role: t.role, content: t.content.slice(0, 2000) }));
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  while (turns.length && turns[0].role !== "user") turns.shift();
  if (!turns.length || turns[turns.length - 1].role !== "user") return NextResponse.json({ error: "Type a question first." }, { status: 400 });

  const admin = supabaseAdmin();
  const limit = Math.max(1, parseInt(process.env.AI_DAILY_LIMIT || "20", 10) || 20);
  const { data: used, error: usageErr } = await admin.rpc("bump_ai_usage", { p_user: user.id, p_limit: limit });
  if (usageErr) return NextResponse.json({ error: "Couldn't check your daily limit. Try again." }, { status: 500 });
  if (used === -1) return NextResponse.json({ error: `You've used all ${limit} questions for today. Your limit resets at midnight.` }, { status: 429 });

  const { data: p } = await admin.from("profiles").select("branch,year,college_id").eq("id", user.id).maybeSingle<{ branch: string; year: string; college_id: string }>();
  const { data: c } = p ? await admin.from("colleges").select("name").eq("id", p.college_id).maybeSingle<{ name: string }>() : { data: null };

  const system = [
    "You are \"Ask a senior\" on Den, the student network for Indian colleges. You are a friendly, practical senior student helping a junior at an Indian college.",
    p ? `The junior studies ${p.branch}, ${p.year}, at ${c?.name || "an Indian college"}.` : "",
    "Help with studies, exams, placements, internships, resumes, coding prep, GATE, CAT, GRE, higher studies, hostel life and career choices, in the Indian context (campus placements, LPA salaries, mass recruiters vs product companies, and so on).",
    "Be concise and concrete: short paragraphs or simple numbered steps, plain text without markdown symbols.",
    "If you're not sure about a current fact such as a cutoff, date or fee, say so and suggest the official source.",
    "If the junior seems distressed or mentions self-harm, respond with care and encourage them to talk to someone they trust or call the Tele-MANAS helpline at 14416. Never help with cheating in exams.",
  ].filter(Boolean).join(" ");

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
      max_tokens: 1000,
      system,
      messages: turns,
    });
    const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("\n").trim();
    return NextResponse.json({ text: text || "I couldn't come up with an answer. Try asking another way.", remaining: limit - (used as number) });
  } catch {
    return NextResponse.json({ error: "The AI senior is busy right now. Try again in a minute." }, { status: 502 });
  }
}
