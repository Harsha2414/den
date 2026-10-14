import type { Metadata } from "next";
import LegalPage, { Grievance } from "@/components/LegalPage";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = { title: "Terms of use · Den" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of use" current="/terms">
      <p>
        These terms are the agreement between you and {LEGAL.operator}, {LEGAL.city}, which runs Den. By creating an account or using Den,
        you agree to these terms, our <a href="/privacy">privacy policy</a> and our <a href="/guidelines">community guidelines</a>.
      </p>

      <h2>Who can use Den</h2>
      <ul>
        <li>You must be at least {LEGAL.minimumAge} years old.</li>
        <li>Den is for college students, alumni and staff in India. Use your real name and your real college.</li>
        <li>One account per person. Don&rsquo;t share your account or sign in as someone else.</li>
        <li>You&rsquo;re responsible for what happens on your account. Tell us if you think someone else is using it.</li>
      </ul>

      <h2>Your content</h2>
      <p>
        You own what you post. By posting, you give Den permission to store it, show it to the people it&rsquo;s shared with, and
        make copies needed to run the service. This permission ends when you delete the content or your account, except for
        copies others already shared and short-lived backups.
      </p>
      <p>Only post things you have the right to share. Don&rsquo;t upload notes, books or papers that copy someone else&rsquo;s work without permission.</p>

      <h2>What you must not post or do</h2>
      <p>As required by India&rsquo;s IT Rules, 2021, you must not post, share or host anything that:</p>
      <ul>
        <li>belongs to someone else and you have no right to share;</li>
        <li>is obscene, pornographic, paedophilic, or invades another person&rsquo;s privacy, including their body;</li>
        <li>insults or harasses anyone on the basis of gender, religion, caste, race, ethnicity or region;</li>
        <li>is defamatory, threatening, or encourages money laundering, gambling or violence;</li>
        <li>is harmful to children;</li>
        <li>infringes a patent, trademark, copyright or other right;</li>
        <li>knowingly spreads false or misleading information, including fake placement offers;</li>
        <li>impersonates another person, college or company;</li>
        <li>threatens the unity, integrity, defence, security or sovereignty of India, friendly relations with other countries, or public order;</li>
        <li>contains viruses or code meant to harm Den or its users; or</li>
        <li>breaks any law in force in India.</li>
      </ul>
      <p>Also don&rsquo;t scrape Den, send spam, create fake accounts, or try to get around blocks, bans or our security rules.</p>

      <h2>Spaces and debates</h2>
      <ul>
        <li>Spaces are live voice rooms. Hosts can invite speakers, mute them, and remove people.</li>
        <li>Don&rsquo;t record a Space or share recordings without the consent of everyone speaking.</li>
        <li>In debates, argue against ideas, not people.</li>
      </ul>

      <h2>Campus market</h2>
      <p>
        Den only lets students post listings. We aren&rsquo;t part of any sale, and we don&rsquo;t check items, prices or payments.
        Meet in public places on campus, check items before paying, and report anything suspicious.
      </p>

      <h2>Ask a senior</h2>
      <p>
        Ask a senior is an AI helper. Its answers can be wrong or out of date, and it isn&rsquo;t professional, medical, legal or
        financial advice. Check important details such as dates, cutoffs and fees with official sources.
      </p>

      <h2>Moderation</h2>
      <p>
        We can remove content or limit, suspend or close accounts that break these terms or our guidelines, or when the law requires it.
        Where we can, we&rsquo;ll tell you why. If you think we made a mistake, contact the Grievance Officer below.
        We remove unlawful content when we receive a valid order from a court or the government, within the time the law sets.
      </p>

      <h2>Deleting your account</h2>
      <p>You can delete your account any time from your profile page. This permanently removes your profile and your content.</p>

      <h2>Den is provided as it is</h2>
      <p>
        We work hard to keep Den running, safe and accurate, but we can&rsquo;t promise it will always be available or error-free.
        We aren&rsquo;t responsible for what other users post or do, or for losses caused by using Den, as far as Indian law allows.
      </p>

      <h2>Changes to these terms</h2>
      <p>We may update these terms. We&rsquo;ll change the date above and tell you in the app before major changes take effect. If you keep using Den after that, you accept the new terms.</p>

      <h2>Law and disputes</h2>
      <p>These terms are governed by the laws of India. Courts in {LEGAL.city} have jurisdiction over any dispute.</p>

      <h2>Grievance Officer</h2>
      <Grievance />
    </LegalPage>
  );
}
