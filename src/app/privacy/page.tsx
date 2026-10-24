import type { Metadata } from "next";
import LegalPage, { Grievance } from "@/components/LegalPage";
import { LEGAL } from "@/lib/legal";

// Read the operator and grievance details when the page loads, not at build time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Privacy policy · Den" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" current="/privacy">
      <p>
        This policy explains what information Den collects, why, who can see it, and the choices you have. Den is run by{" "}
        {LEGAL.operator}, {LEGAL.city} (&ldquo;we&rdquo;). We follow India&rsquo;s Digital Personal Data Protection Act, 2023 and the
        Information Technology Act, 2000 and its rules.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li><b>Account details:</b> your email address, and your name if you sign in with Google.</li>
        <li><b>Profile:</b> name, college, branch or course, year, and the optional &ldquo;About you&rdquo; text.</li>
        <li><b>What you post:</b> posts, comments, likes, notes and links, placement stories, market listings, events, articles, Spaces you host, and debate votes, including photos, videos and files you attach. Photos and files you attach to posts, listings, notes, events and articles can be opened by anyone who has their link.</li>
        <li><b>Private messages:</b> the messages, photos, videos and files you send, and the chats and groups you&rsquo;re in. Files in chats can only be opened by the people in that chat.</li>
        <li><b>Student verification:</b> if you verify, the college email you used, or a photo of your student ID card. Card photos are seen only by Den&rsquo;s reviewers and deleted after the check (within 7 days). We keep only a note of how and when you were verified, and a scrambled fingerprint of the card number so the same card can&rsquo;t verify two accounts. The photo is also sent to our AI provider so it can read the card.</li>
        <li><b>Safety records:</b> people you block, and reports you file or that are filed about your content.</li>
        <li><b>Ask a senior:</b> the questions you type, which are sent to our AI provider to get an answer. We keep only a daily count, not the questions.</li>
        <li><b>Technical data:</b> our hosting providers record basic logs such as IP address, browser and time of request, to keep Den running and secure.</li>
      </ul>
      <p>
        <b>Voice in Spaces is live only.</b> Den does not record Spaces or debates. We use cookies only to keep you signed in. We don&rsquo;t use advertising trackers.
      </p>

      <h2>Why we use it</h2>
      <ul>
        <li>To run Den: sign you in, show your profile and posts, deliver messages, and connect voice in Spaces.</li>
        <li>To show the verified student badge when you sign in with a college email.</li>
        <li>To keep Den safe: review reports, enforce our <a href="/guidelines">community guidelines</a>, and stop abuse.</li>
        <li>To send sign-in codes and important account emails.</li>
        <li>To follow the law and respond to valid legal requests.</li>
      </ul>
      <p>We use your data only with your consent, which you give when you create an account, and only for these purposes. We don&rsquo;t sell your personal data.</p>

      <h2>Who can see what</h2>
      <ul>
        <li><b>Your profile</b> (name, college, branch, year, About you) is visible to all signed-in Den users.</li>
        <li><b>&ldquo;My college&rdquo; posts</b> are visible only to students of your college. <b>&ldquo;All India&rdquo; posts</b> are visible to everyone on Den.</li>
        <li><b>Notes, placement stories, events and market listings</b> are visible to all signed-in students.</li>
        <li><b>Private messages</b> are visible only to the people in that chat.</li>
        <li><b>Spaces</b> are heard live by whoever joins. Campus-only Spaces are open only to your college.</li>
        <li><b>Reports</b> are seen only by Den&rsquo;s moderators. The person you report isn&rsquo;t told who reported them.</li>
      </ul>

      <h2>Service providers</h2>
      <p>We use these companies to run Den. They process data only on our instructions:</p>
      <ul>
        <li><b>Supabase:</b> database and sign-in (stored in Mumbai, India)</li>
        <li><b>Vercel:</b> website hosting</li>
        <li><b>LiveKit:</b> live voice for Spaces</li>
        <li><b>Anthropic:</b> answers for Ask a senior</li>
        <li><b>Brevo:</b> sign-in code emails</li>
        <li><b>Google:</b> &ldquo;Continue with Google&rdquo; sign-in</li>
      </ul>
      <p>Some of these providers may process data outside India, with safeguards they provide.</p>

      <h2>How long we keep it</h2>
      <p>
        We keep your data while your account exists. When you use <b>Delete my account</b> on your profile page, we delete your
        profile, posts, comments, messages, Spaces, votes and other content straight away. Copies may remain in backups or
        provider logs for a short period before they are erased. We may keep a record of serious safety reports where the law requires it.
      </p>

      <h2>Your rights</h2>
      <p>Under the Digital Personal Data Protection Act, 2023, you can:</p>
      <ul>
        <li><b>Access</b> a summary of your personal data and how it&rsquo;s used.</li>
        <li><b>Correct</b> your details: edit your profile any time.</li>
        <li><b>Erase</b> your data: delete your account from your profile page.</li>
        <li><b>Withdraw consent</b> at any time by deleting your account.</li>
        <li><b>Nominate</b> someone to exercise these rights if you die or are unable to.</li>
        <li><b>Complain</b> to our Grievance Officer (below), and then to the Data Protection Board of India.</li>
      </ul>
      <p>To use any of these rights, email {LEGAL.contactEmail}.</p>

      <h2>Age</h2>
      <p>Den is only for people aged {LEGAL.minimumAge} or older. If we learn an account belongs to someone younger, we delete it.</p>

      <h2>Security</h2>
      <p>
        Data travels over encrypted connections, and database rules limit who can read what (for example, only chat members can
        read messages). No system is perfectly secure, so please use a strong Google or college email password and tell us if you notice anything wrong.
      </p>

      <h2>Changes</h2>
      <p>If we change this policy, we&rsquo;ll update the date above and tell you in the app before major changes take effect.</p>

      <h2>Grievance Officer</h2>
      <Grievance />
    </LegalPage>
  );
}
