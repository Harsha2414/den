import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";

// Read the operator and grievance details when the page loads, not at build time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Community guidelines · Den" };

export default function GuidelinesPage() {
  return (
    <LegalPage title="Community guidelines" current="/guidelines">
      <p>
        Den is a place for students to help each other, share what they know, and argue about ideas without fear.
        These guidelines keep it that way. Breaking them can get your content removed or your account suspended.
      </p>

      <h2>Be respectful</h2>
      <ul>
        <li>No bullying, harassment, threats or <b>ragging</b> of any kind, online or offline.</li>
        <li>No hate or insults based on religion, caste, gender, sexuality, region, language, disability or college.</li>
        <li>Disagree with ideas, not people. Keep debates and comments about the topic.</li>
      </ul>

      <h2>Keep it safe</h2>
      <ul>
        <li>No nudity, sexual content, or sexual messages to people who haven&rsquo;t asked for them.</li>
        <li>Never share someone&rsquo;s photos, phone number, address or private chats without their permission.</li>
        <li>No content that promotes self-harm, violence, drugs or weapons.</li>
        <li>If someone is in danger, call <b>112</b>. If you or a friend are struggling, call Tele-MANAS on <b>14416</b>.</li>
      </ul>

      <h2>Keep it honest</h2>
      <ul>
        <li>Use your real name and college. Don&rsquo;t pretend to be another student, a professor or a company.</li>
        <li>Share real placement and interview experiences. No fake offers, fake CTCs or recruiting scams.</li>
        <li>No spam, chain messages, or selling followers or accounts.</li>
        <li>Market listings must be for real items you own. No fake listings or advance-payment scams.</li>
      </ul>

      <h2>Study fair</h2>
      <ul>
        <li>Sharing your own notes and previous years&rsquo; papers is great.</li>
        <li>Sharing leaked papers, live exam answers, or helping anyone cheat is not allowed.</li>
        <li>Don&rsquo;t upload paid books or courses you don&rsquo;t have the right to share.</li>
      </ul>

      <h2>Spaces and debates</h2>
      <ul>
        <li>Hosts and moderators run the room. Follow their calls on who speaks.</li>
        <li>Let others finish. In debates, speak only on your team&rsquo;s turn.</li>
        <li>Don&rsquo;t record or share a Space without everyone&rsquo;s consent.</li>
      </ul>

      <h2>If something&rsquo;s wrong</h2>
      <ul>
        <li><b>Report</b> any post, comment, Space or person using the flag icon. Reports are private.</li>
        <li><b>Block</b> anyone from their profile so they can&rsquo;t message you.</li>
        <li>Moderators review reports and may remove content, warn, suspend or remove accounts. Serious cases may be reported to the authorities.</li>
      </ul>
    </LegalPage>
  );
}
