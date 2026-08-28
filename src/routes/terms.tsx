import { createFileRoute } from "@tanstack/react-router";

import { LegalPage } from "./privacy";

export const Route = createFileRoute("/terms")({
  head: () => ({ meta: [{ title: "Terms of Use — ManifestAI" }] }),
  component: Terms,
});

function Terms() {
  return (
    <LegalPage title="Terms of Use" updated="28 August 2026">
      <p>
        These terms cover your use of ManifestAI. Using the app means you accept them. They are
        written plainly on purpose.
      </p>

      <h2>What ManifestAI is</h2>
      <p>
        ManifestAI helps you write down what you want, rehearse it through short guided
        visualizations and affirmations, and track the habits that support it. It is a
        personal-growth and focus tool.
      </p>

      <h2>What ManifestAI is not</h2>
      <p>
        <strong>It does not promise outcomes.</strong> Nothing in this app causes external events.
        Visualization and affirmation can help with motivation, attention and follow-through — that
        is the honest claim, and it is the only one we make. Any result you get comes from what you
        do.
      </p>
      <p>
        <strong>It is not medical, psychological, legal or financial advice.</strong> The coach is a
        language model, not a therapist, doctor or advisor. If you are struggling with your mental
        health, please speak to a qualified professional or someone you trust. If you are in crisis,
        contact your local emergency services or a crisis line.
      </p>
      <p>
        Frequency tracks are calm listening sessions. The hertz numbers attached to them are a
        convention in this field, not a medical claim, and we do not assert any physiological
        effect.
      </p>

      <h2>Your account</h2>
      <p>
        You need an account to use the app, and you are responsible for keeping access to it secure.
        You must be at least 13 years old. You can delete your account at any time from{" "}
        <strong>You → Delete account</strong>, which removes everything permanently.
      </p>

      <h2>Your content</h2>
      <p>
        What you write stays yours. You grant us only the permission needed to run the service —
        storing your entries, and sending the relevant text to AI providers to generate your
        stories, affirmations, coaching replies and narration. We do not claim ownership of anything
        you write, and we do not use it to train models.
      </p>

      <h2>AI-generated content</h2>
      <p>
        Stories, affirmations, coaching replies and narration are generated automatically. They can
        be wrong, repetitive or oddly worded. Use your judgement, and do not treat generated text as
        advice from a qualified person.
      </p>

      <h2>Acceptable use</h2>
      <p>
        Do not use ManifestAI to generate content that is illegal, that harasses or endangers
        anyone, or that sexualises minors. Do not attempt to break, overload or reverse-engineer the
        service. We may suspend accounts that do these things.
      </p>

      <h2>Subscriptions</h2>
      <p>
        Some features require a paid subscription. There are two plans: Standard, which unlocks
        everything written, and Voice, which adds studio narration read aloud. What each includes,
        and its price, are shown before you buy. Voice carries a limit on how many narrations can be
        generated in a day and in a month, because studio audio costs money each time it is made;
        the limit is stated on the plan rather than discovered later.
      </p>
      <p>
        Subscriptions are sold by the app store you installed from, not by us. On Android that is
        Google Play, billed to your Google account and managed under Payments &amp; subscriptions.
        On iPhone that is Apple, billed to your Apple ID and managed in your Apple account settings.
        Subscriptions renew automatically unless cancelled at least 24 hours before the current
        period ends. Lifetime is a single payment and does not renew.
      </p>
      <p>
        Cancelling stops the next renewal; it does not refund the period you are already in, and you
        keep access until that period ends. Refunds are handled by whichever store took the payment,
        under that store&rsquo;s own policies — we cannot issue them ourselves. If you pay and the
        plan does not unlock, contact us and we will put it right.
      </p>

      <h2>Availability</h2>
      <p>
        We will try to keep the app working, but we do not guarantee it is always available or free
        of faults. Features may change. If we ever discontinue the service, we will give you notice
        and a way to export what you have written.
      </p>

      <h2>Liability</h2>
      <p>
        To the extent the law allows, ManifestAI is provided as-is, and we are not liable for
        decisions you make or outcomes you experience while using it. Nothing here limits liability
        that cannot legally be limited.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these terms. If a change materially affects you, we will tell you in the app
        rather than quietly editing this page.
      </p>

      <h2>Contact</h2>
      <p>
        Questions: <a href="mailto:vimanu9.vr@gmail.com">vimanu9.vr@gmail.com</a>
      </p>
    </LegalPage>
  );
}
