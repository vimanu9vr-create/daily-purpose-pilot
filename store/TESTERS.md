# Twelve testers

Google won't let a new personal developer account publish until twelve real
people have been opted into a closed test for **fourteen continuous days**.
Everything else on the launch list takes hours. This one takes fourteen days
whatever you do, which is why it is worth starting before anything is ready.

Aim for **fifteen**, not twelve. People forget, change phones, or uninstall,
and each drop-out restarts that person's clock from zero.

---

## What to send them

```
I've built an app and Google needs 12 people to test it before they'll
let me publish it. Would you help?

You need: an Android phone. It takes 2 minutes to install when I send
the link, and you leave it on your phone for two weeks.

If you're in, reply with the Gmail address that's signed in on your
Android phone.
```

---

## The list

Fill this in as replies come back. Only the Gmail column goes into Play Console.

| # | Name | Gmail (the one on their Android phone) | Said yes | Opted in | Still installed |
| --- | --- | --- | --- | --- | --- |
| 1 |  |  |  |  |  |
| 2 |  |  |  |  |  |
| 3 |  |  |  |  |  |
| 4 |  |  |  |  |  |
| 5 |  |  |  |  |  |
| 6 |  |  |  |  |  |
| 7 |  |  |  |  |  |
| 8 |  |  |  |  |  |
| 9 |  |  |  |  |  |
| 10 |  |  |  |  |  |
| 11 |  |  |  |  |  |
| 12 |  |  |  |  |  |
| 13 |  |  |  |  |  |
| 14 |  |  |  |  |  |
| 15 |  |  |  |  |  |

---

## Three things that disqualify a tester

**An iPhone.** There is no way around this — the closed test is an Android
build. iPhone friends can look at the web app instead, but they don't count.

**The wrong Gmail.** People give their usual email, then open the link on a
phone signed into a different account, and Play tells them they aren't a
tester. It reads like your app is broken. Ask specifically for the address
signed in on the phone.

**Accounts you made yourself.** Twelve addresses you control is the exact
pattern Google's review looks for, and it fails the production application.

---

## Once your account is verified

1. Play Console → **Create app** → complete the listing
2. **Testing → Closed testing → Create track**
3. Upload `android/app/build/outputs/bundle/release/app-release.aab`
4. **Testers** tab → create an email list → paste the twelve Gmail addresses
5. Copy the opt-in link Play generates:
   `https://play.google.com/apps/testing/com.manifestai888.app`
6. Send it to the twelve

Then send them this:

```
Here's the link:
https://play.google.com/apps/testing/com.manifestai888.app

Open it on your Android phone, tap "Become a tester", then tap the
Google Play link that appears and install.

Use the phone signed into the Gmail you gave me, or it'll say you're
not a tester. And please don't uninstall for two weeks — that's what
Google requires.
```

**The clock starts when they opt in, not when you upload.** Check that each
of the twelve actually accepted and installed. Twelve invitations sent is not
twelve testers.

---

## What to ask them for

"Let me know if it breaks" gets you nothing. Ask for something specific:

> Create a dream — type what you actually want, in your own words. Then read
> two of the stories it writes. Tell me one thing: did the stories sound like
> they were about *your* thing, or generic?

That is the question this whole test exists to answer, and it is the one thing
nobody can tell you from inside the project.
