# ManifestAI — what's left

Last updated 12 August 2026, after building the blueprint out.

## The blueprint, item by item

Everything below is built, with passing tests or a clean build behind it.
Nothing here is scaffolded or stubbed.

    Splash / entry                    done
    Onboarding, nine questions        done
    Home dashboard                    done
    Daily practice, seven steps       done
    Today's action                    done
    AI coach                          done
    Goals with why, category, date    done
    Milestones                        done
    Progress, derived not typed       done
    Journal with prompts and mood     done
    Journal search, tags, favourites  done
    Voice to text                     done
    Gratitude                         done
    Vision boards                     done
    Meditation and sleep library      done
    Audio player                      done
    Notifications, timezone aware     done
    Streaks                           done
    Weekly insights                   done
    Sunday review                     done
    Achievements                      done
    Personalisation                   done
    Privacy, export, delete account   done
    Subscription tiers                paywall done, checkout not wired
    iOS and Android shells            done

Three things were deliberately built differently from the blueprint. Each is a
considered disagreement rather than a shortcut.

**The practice isn't seven fixed steps.** It's assembled from the time and the
styles someone chose. A fixed session is the same mistake as an 18-minute
sleep track containing forty seconds of audio: one number applied to everybody.

**Practice and Journal aren't tabs.** Five tabs is the ceiling for thumbs on a
phone. The practice is offered on Home, where someone already is; the journal
is reached at the end of a practice, which is when anyone wants it.

**Progress is computed, never stored.** Two thirds from milestones ticked, one
third from actions completed. The old `goals.progress` column was an integer a
human typed, so it could read 62% on a goal untouched for months.

## Yours, and small

**Listen to a session end to end.** Still the one thing nobody has done. It
decides whether the writing is good enough to build a business on, and no
amount of code answers it. The narration model changed on 12 August, from a
deprecated low-latency one to the model ElevenLabs recommends for narration —
so whatever you heard before is no longer representative.

**Turn notifications on** in the app on this account, if you haven't.

## Mine, ready when you say

**Pre-generate the ten catalogue tracks.** About 24,000 characters of
ElevenLabs quota, once, shared by every future user. Worth doing before
strangers see the app.

**Turn on Sentry.** Built and dormant. Needs a free DSN in `.env` as
`VITE_SENTRY_DSN`. Until then errors only reach the browser console, which
means only you see them.

**Wire the checkout.** Paddle or Lemon Squeezy. `WebStore.purchase()` is the
one function that needs writing; the webhook that flips someone to premium is
already deployed.

## Costs money, and gates the stores

Google Play is $25 once, and a personal developer account needs twelve testers
opted in for fourteen continuous days before publishing. That clock costs
nothing to start and is the longest single item in the project.

Play also takes 10% of subscription revenue in the US, UK and EEA whichever
billing route you use — so a PWA signup is worth more than a Play signup.

Apple is $99 a year and needs identity verification. Not needed while there is
no iOS build.

## The honest state

The app does everything the blueprint describes, on your own infrastructure,
at a public URL, with 62 tests covering the things that have actually broken.

What's still unproven is whether it's *good*. Twenty-four thousand words of
guided audio exist and no human has listened to a session all the way through.
That's the next milestone, and it isn't an engineering one.
