import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: "Privacy Policy — ManifestAI" }] }),
  component: Privacy,
});

const UPDATED = "3 August 2026";

function Privacy() {
  return (
    <LegalPage title="Privacy Policy" updated={UPDATED}>
      <p>
        ManifestAI is a personal-growth app. This policy describes exactly what we collect, why, and
        what you can do about it. It is written to be accurate rather than comprehensive-sounding.
      </p>

      <h2>What we collect</h2>
      <p>
        <strong>Your account.</strong> Your email address, and your display name if you give one. If
        you sign in with Apple or Google, we receive your email address and name from them — nothing
        else, and no access to those accounts.
      </p>
      <p>
        <strong>What you write.</strong> Your desires, goals, obstacles, journal entries, moods,
        habits, affirmations and messages to the coach. This is the content of the app; without it
        there is nothing to personalise.
      </p>
      <p>
        <strong>Settings.</strong> Your chosen voice, narration pace, notification time and
        timezone. Voice and pace are stored on your device only.
      </p>
      <p>
        <strong>Notification tokens.</strong> If you turn on morning notifications, we store the
        push subscription your browser or device issues, so we can send them.
      </p>

      <h2>What we do not collect</h2>
      <p>
        We do not collect your location, contacts, photos, health data, advertising identifiers or
        browsing activity outside the app. We do not use analytics or advertising trackers, and we
        do not build a profile of you for advertising. There are no ads in ManifestAI.
      </p>

      <h2>Who else sees your data</h2>
      <p>
        <strong>Supabase</strong> hosts our database, authentication and file storage. Your data
        lives there under row-level security, which means the database itself refuses to return one
        person's rows to another.
      </p>
      <p>
        <strong>AI providers.</strong> When you generate a story, an affirmation, or talk to the
        coach, the relevant text — your desire, goal, obstacles and recent entries — is sent to an
        AI provider to produce a response. When you use the studio voice, the text of that story is
        sent to a text-to-speech provider to generate audio. These providers process the text to
        return a result; we do not permit them to use it to train models.
      </p>
      <p>We do not sell your data. We do not share it with anyone else, for any purpose.</p>

      <h2>Where your data lives, and for how long</h2>
      <p>
        Your content is kept until you delete it or delete your account. Generated narration audio
        is cached so the same story does not have to be regenerated; it is deleted with your
        account.
      </p>

      <h2>Deleting your account</h2>
      <p>
        You can delete your account from inside the app, under <strong>You → Delete account</strong>
        . This removes your profile, desires, stories, affirmations, journal entries, habits, goals,
        coach conversations, saved audio and notification subscriptions. It is immediate and
        permanent. We do not retain a copy you could later ask us to restore.
      </p>

      <h2>Your rights</h2>
      <p>
        You can access and correct your information inside the app, and delete all of it at any
        time. Depending on where you live you may have additional rights over your personal data,
        including the right to request a copy of it. Write to us and we will help.
      </p>

      <h2>Children</h2>
      <p>
        ManifestAI is not intended for children under 13, and we do not knowingly collect
        information from them. If you believe a child has created an account, contact us and we will
        delete it.
      </p>

      <h2>Security</h2>
      <p>
        Data is encrypted in transit and at rest. Access is scoped per user at the database level
        rather than only in the app, so a bug in the interface cannot expose someone else's entries.
        No system is perfectly secure, and we will not claim otherwise.
      </p>

      <h2>Changes</h2>
      <p>
        If this policy changes in a way that affects how your data is used, we will tell you in the
        app rather than quietly updating this page.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about privacy: <a href="mailto:vimanu9.vr@gmail.com">vimanu9.vr@gmail.com</a>
      </p>
    </LegalPage>
  );
}

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="blush-field min-h-screen px-5 py-14">
      <article className="mx-auto w-full max-w-2xl">
        <Link to="/" className="eyebrow text-muted-foreground hover:text-primary">
          ← ManifestAI
        </Link>
        <h1 className="mt-5 font-display text-4xl font-medium">{title}</h1>
        <p className="mt-2 text-xs text-muted-foreground">Last updated {updated}</p>

        <div className="legal-body mt-9 space-y-4 text-[15px] leading-[1.75] text-foreground/85">
          {children}
        </div>
      </article>
    </div>
  );
}
