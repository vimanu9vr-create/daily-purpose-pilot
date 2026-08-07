/**
 * Sleep tracks, meditations and frequency sessions.
 *
 * Unlike stories, these aren't written from the user's desires — they're the
 * same for everyone, so they live as a fixed catalogue rather than being
 * generated. Seeded into `moments` on first visit so the player, favourites
 * and narration caching all work identically to stories.
 */

import type { ImageTheme } from "./imagery";

export type TrackKind = "sleep" | "meditation" | "frequency";

export type CatalogueTrack = {
  slug: string;
  kind: TrackKind;
  title: string;
  hook: string;
  theme: ImageTheme;
  minutes: number;
  body: string;
};

export const KIND_LABELS: Record<string, string> = {
  story: "Trending now",
  affirmation: "Affirmations",
  sleep: "Sleep tracks",
  meditation: "Meditations",
  frequency: "Frequencies",
};

export const KIND_ORDER = ["story", "affirmation", "sleep", "meditation", "frequency"];

export const TRACKS: CatalogueTrack[] = [
  // ---------- Sleep ----------
  {
    slug: "sleep-safe-to-love",
    kind: "sleep",
    title: "You are safe to love again",
    hook: "You are safe to love again",
    theme: "love",
    minutes: 15,
    body: `Let your shoulders drop. There is nothing left to solve tonight.

Notice the weight of you against the bed. Not the shape of you — the weight. The way the mattress has already taken it, and has been taking it since you lay down, without being asked.

Find the places that are still holding. Your jaw, probably. The small muscles around your eyes. Somewhere between your shoulder blades. Let each one be a little heavier than it was a moment ago. Not relaxed. Just heavier.

Breathe in for four. Hold for two. Out for six.

Again. In for four. Hold. Out, slowly, for six.

You have spent a long time being careful. Reading rooms before you entered them. Noticing the shift in someone's voice before they knew it had shifted. Bracing, quietly, before anything had actually happened.

That was reasonable. It came from somewhere real. Somebody taught you that, and you learned it well, because you were paying attention.

But it costs something to run all night. It costs something to keep a part of yourself standing guard while the rest of you sleeps.

Tonight you can set it down. Not forever. Nobody is asking you to be defenceless. Just until morning.

Let the room be a room. Let the dark be ordinary dark. Nothing in it is waiting for you.

In for four. Out for six.

Think of a moment when you were genuinely at ease with another person. It doesn't have to be romantic and it doesn't have to be recent. A kitchen. A car. Someone's shoulder against yours in a cinema. A conversation that went quiet and the quiet was comfortable.

You didn't have to earn that. You weren't performing. You were just there, and it was fine.

That version of you is not gone. That is not a person you used to be. That is you, with the guard down.

You are allowed to want closeness without preparing for its loss. Those are two separate things, and you have been carrying them as one.

You are allowed to be soft in a body that learned to be armoured. The armour was a skill. Softness is also a skill, and it is the one you are practising now.

In for four. Hold for two. Out for six.

Your hands are heavy. Your arms are heavy. The backs of your legs have given up entirely.

Notice you are still breathing without deciding to. Notice your heart has been doing its work all day without a single instruction from you. There are parts of you that have never once needed to be told what to do.

Trust is not a decision you make. It's something that settles, in a body that's had enough rest to allow it.

So tonight, only this: rest. That's the whole task.

Tomorrow will ask things of you. Not now.

In for four. Out for six.

Nothing is required of you between this moment and the morning. Nothing at all.

Let the day finish without you.`,
  },
  {
    slug: "sleep-put-the-day-down",
    kind: "sleep",
    title: "Put the day down",
    hook: "Put the day down",
    theme: "calm",
    minutes: 12,
    body: `Wherever you are, let your body get heavier.

Start at the top. Your forehead. Let it be smooth. Let your eyebrows stop doing whatever they were doing.

Your jaw. Most people hold their whole day in their jaw and never notice. Let your back teeth come apart, just slightly.

Your throat. Your shoulders — let them fall away from your ears. Further than you think. Further than that.

Breathe out, longer than you breathed in.

The day is over. Not finished — over. Those are different, and tonight only one of them matters.

There are things you didn't get to. There always are. That's not a failure of yours, that's the arithmetic of being a person with a life. There is more to do than there are hours, and there always will be, and lying here recounting the shortfall changes precisely none of it.

Let's put them down properly, one at a time.

Think of the thing you keep circling back to. The one that surfaced three times today. Picture it as an object — a stone, a folder, a small weight in your palm. Feel how much it weighs.

Now set it on the floor beside the bed. Not gone. Not solved. Just outside of you, on the floor, where it will still be in the morning if it matters.

There's another one. There usually is. Set that down too.

And the one underneath those — the older one, the one that isn't really about today. That can go on the floor as well.

Breathe out, longer than you breathed in.

Your hands are empty now. Notice that. Whatever your hands are actually resting on, notice that they aren't holding anything.

There is a version of tonight where you lie here and rehearse tomorrow. Where you run the conversation you might have, several times, with several different endings. You know that version well.

It has never once helped. Not once. You have never woken up better prepared because you spent an hour at 1am imagining a version of a day that didn't happen.

So not tonight.

Tomorrow you get to be awake and capable and think about all of it properly, with the actual information, which you do not currently have.

Right now your only job is to lie here and get heavier.

Feel the bed under your back. Feel where your body ends and the sheet begins. Feel the temperature of the air on your face — probably slightly cooler than the rest of you.

Breathe in through your nose. Out through your mouth, slowly.

Notice that the room is doing nothing. It's just a room, holding still, waiting for you to stop.

Your legs are heavy. Your hips have let go. Your lower back has stopped bracing against something that isn't there.

The day is on the floor beside the bed.

You don't have to carry it while you sleep. That was never part of the arrangement.

Let go of the next thought. And the one after it.

Just weight, and breath, and dark.`,
  },
  {
    slug: "sleep-tomorrow-is-not-here",
    kind: "sleep",
    title: "Tomorrow is not here yet",
    hook: "Tomorrow is not here yet",
    theme: "home",
    minutes: 18,
    body: `Tomorrow is not here yet. You cannot do anything about it from this bed.

Read that again, slowly, and notice whether some part of you disagrees.

Most people have a part that disagrees. A part convinced that if it just thinks hard enough tonight, it can get ahead of tomorrow. That worry is a form of preparation.

It isn't. It never has been. Worry feels like work because it's effortful and it's about something real, but effort isn't the same as progress, and lying still in the dark you have no ability whatsoever to affect what happens in twelve hours.

That's not a hard truth. That's a release, if you'll let it be.

Let your body get heavy. Start with your feet. Feel them. Let them be dead weight.

Your calves. Your knees. Your thighs — let them sink.

Your hips, letting go of a whole day of holding you upright.

Breathe in for four. Out for six.

Here is what is true right now, in this actual moment.

You are lying down. You are warm, or close enough. Nothing in this room requires anything from you. Your body is breathing without your help. Your heart is beating without your permission.

That is the complete list of what is happening. Everything else is memory or forecast, and neither of those exists anywhere except inside your head.

Your stomach. Your chest, rising and falling. Let your ribs be loose.

Your hands. Uncurl your fingers if they're curled.

Your arms, heavy. Your shoulders, further down than they were.

Breathe in for four. Out for six.

The thing you're worried about may well happen. That's the honest version — not "everything will be fine", because neither of us knows that.

But if it happens, it happens tomorrow, to a rested version of you who has the actual details in front of her. Not to this version, in the dark, with only imagination for material.

You are more capable rested than you are worried. That's not motivation, it's just true. Every difficult thing you've handled well, you handled awake and fed and slept. Every one you handled badly, you were probably running on nothing.

So sleep isn't avoidance tonight. Sleep is the preparation. It's the only preparation available from here.

Your neck. Your jaw. The space between your eyebrows.

Let your tongue rest on the floor of your mouth.

Breathe in for four. Hold. Out for six.

Notice the sounds in the room, whatever they are. Let them be sounds. They aren't asking for anything from you either.

Tomorrow is not here. It isn't nearly here. It doesn't exist yet in any form you can touch.

There is only this: a body, getting heavier. Air, going in and out. A room, holding still.

If a thought arrives, let it arrive and let it leave. You don't have to follow it anywhere.

In for four. Out for six.

Heavier.

The day is done. Let it be done.`,
  },

  // ---------- Meditation ----------
  {
    slug: "meditation-morning-clarity",
    kind: "meditation",
    title: "Morning clarity",
    hook: "Begin before the day begins",
    theme: "calm",
    minutes: 8,
    body: `Sit however you are. There is no correct posture for this.

Let your eyes close, or let them rest half-open on something dull. Either is fine.

Take one breath that's deeper than the one before it. Then let your breathing go back to whatever it wants to do. You're not managing it. You're just here while it happens.

This is the first quiet moment of your day. Most days don't get one. Most days start already in motion — a phone, a message, a small decision before you're properly awake, and then you're running and you don't stop until you lie down again.

Today you get about eight minutes first. That changes something, and not for mystical reasons. You're just going to make the day's first few decisions from a settled place instead of a reactive one.

Notice where you are. The temperature of the air. The surface under you. Whatever light is in the room.

Now bring the day to mind. Not the whole thing — the shape of it. The two or three things that actually matter.

Look at them without doing anything about them.

Notice which one your attention keeps returning to. There's usually one. It might not be the biggest. Often it's the one with a person attached, or the one you've been avoiding.

That's the one, then. That's today's real work, and now you know it before the day tells you.

Breathe.

Here's the question worth asking, and it's smaller than you'd expect. Not "how do I do all of this." That question has no answer at this hour.

What is the first thing?

Not the best thing. Not the most important thing. The first. The one you could begin within the next hour, in the state you're actually in.

Let it be small enough to be certain about. Open the document. Send the message. Put on the shoes. Make the call you've moved twice.

Something with a definite edge, that you'll know you've done.

Sit with it for a moment. Picture yourself doing it — not succeeding at it, just doing it. The physical version. Hand on the door. Fingers on the keys.

Notice if some part of you tenses at the picture. That's useful information. That tension is usually where the real difficulty is, and it's rarely where you assumed.

Breathe out slowly.

You don't have to feel ready. Ready is not a state that reliably arrives. Most things worth doing get done by people who felt more or less like you feel right now, and started anyway.

You also don't need today to be exceptional. Exceptional is not a plan. A good day is mostly an ordinary day in which the first thing got done, and then the next one looked more possible.

One more slow breath.

Notice you're calmer than you were eight minutes ago. Not transformed — calmer. That's the honest size of what this does, and it's enough.

The day starts when you stand up. You know what the first thing is.

Go and do that one.`,
  },
  {
    slug: "meditation-steady-under-pressure",
    kind: "meditation",
    title: "Steady under pressure",
    hook: "Steady, with the pressure still there",
    theme: "confidence",
    minutes: 10,
    body: `Something is pressing on you. Don't push it away yet.

Sit, and let your breathing be exactly as fast as it is. Don't slow it deliberately. Just notice its speed. That's information.

Now find where the pressure lives in your body. It's somewhere specific — it always is. Chest, throat, stomach, the space between your shoulders. Jaw, for a lot of people.

Put your attention there. Not to fix it. Just to look.

Notice the shape of it. Notice whether it's still or moving. Whether it's hot or tight or hollow.

You've probably spent the day feeling this without once looking at it directly. That's the ordinary way to handle it — get on with things, carry it in the background. It works, until the background gets full.

Breathe into that place. Not to dissolve it. Just so it isn't somewhere you're avoiding.

Here's something worth knowing about pressure. Most of what you're feeling is not the situation. It's the rehearsal.

The situation is one thing, happening once, at a specific time. The rehearsal is you running it forty times, with variations, while doing something else. That's what's exhausting. Not the event — the forty.

See if you can separate them.

What is actually true, right now, that you know for certain? Not what might happen. What is the case.

Usually it's a much shorter list than it felt like.

Breathe.

Now the part that helps. Of everything in this situation, what is genuinely yours?

Some of it isn't. Some of it belongs to other people's decisions, or to timing, or to things that were already in motion before you arrived. You can carry those, and you probably are, but carrying them changes nothing about them.

Set those down. Not permanently. Just for the next few minutes, so you can see what's left.

What's left is your part. It's smaller. It's also the only part that responds to effort.

Look at it directly. Is there an action in it? Usually there is one, and usually you already know what it is, and usually you've known for longer than you'd admit.

If there's an action, name it to yourself now. Plainly, without softening it.

If there isn't — if this is genuinely one of the ones you can only wait through — then name that instead. Waiting is a legitimate answer. It stops being unbearable the moment you stop pretending it's a failure to act.

Breathe out, longer than you breathed in.

Feel that place in your body again. Check whether it's changed. It might not have. That's fine — that's honest. This isn't a technique for making difficulty disappear.

What it does is stop the difficulty from having the whole room.

You are steadier than you were. Not fine. Steadier.

That's enough to do the next thing with.`,
  },
  {
    slug: "meditation-releasing-comparison",
    kind: "meditation",
    title: "Releasing comparison",
    hook: "Their timeline is not yours",
    theme: "wealth",
    minutes: 9,
    body: `Bring to mind the person you keep measuring yourself against.

You knew who it was immediately. That's how you know this one's worth doing.

Sit with the discomfort of having thought of them. Don't argue with it. Don't be generous about it yet.

Breathe.

Comparison is not a character flaw. It's a very old piece of machinery. Knowing your position in a group used to determine whether you ate. Your nervous system hasn't been told that circumstances have changed.

So this isn't about becoming the sort of person who doesn't compare. That person doesn't exist. This is about noticing what the machinery is actually measuring.

Picture them. Picture what you know of their life — the part you can see.

Now notice something about that picture. It has no bad mornings in it. No hour in the bathroom at a party. No message they reread eleven times before sending. No stretch where they didn't know what they were doing either.

You are comparing your inside to their outside. Everyone does it. It is not a fair fight and it was never designed to be one.

Breathe out, slowly.

Here's the more useful question. When you feel that pull towards them — what specifically is it pointing at?

It's never the whole person. It's one thing. The ease they seem to have. The work you wanted to be doing. The way people respond to them. The particular freedom of it.

Find the one thing.

Now — that thing is information. Envy is a badly-behaved compass, but it is a compass. It points at something you want and haven't admitted to wanting, usually because wanting it feels presumptuous.

Say it to yourself, in plain words. What is the thing?

Sit with it for a moment without deciding anything.

Notice how different it feels to want something than to resent someone for having it. Same information. Completely different weight.

One is a direction. The other is just a wound you keep touching.

Breathe.

Their having it takes nothing from you. That's not a comforting phrase, it's arithmetic — there is no fixed quantity of good work, or love, or ease, that they have drawn down.

And here is the part that matters. You are not behind. There is no schedule. The schedule is something you assembled from other people's visible moments, and it does not exist anywhere outside your own head.

You have your own timing. It has been yours the whole time.

One more breath.

What is the thing you actually want? You named it a moment ago.

What's the smallest move towards it that's available this week? Not the plan. One move.

Take that instead of the comparison. It's the same energy, pointed somewhere it can do something.`,
  },

  // ---------- Frequency ----------
  {
    slug: "frequency-528",
    kind: "frequency",
    title: "Renewal 528 Hz",
    hook: "Renewal · 528 Hz",
    theme: "health",
    minutes: 5,
    body: `Settle in. Let the tone do most of the work.

You don't need to concentrate on it. You don't need to do anything with it at all. Let it be in the room the way weather is in the room.

Let your breathing find its own pace. Slower than usual, probably, but you don't have to force that. It tends to happen on its own when there's a steady sound to sit inside.

Feel where your body meets whatever is holding it.

Some people feel a tone like this in the chest. Some in the space behind the eyes. Some feel nothing in particular, and that's not a failure — it just means your attention is somewhere else today, which is allowed.

Breathe.

You don't have to believe anything about this frequency for the next few minutes to be worth having. What's actually happening is simple and it's enough: a steady sound, a slow breath, and no task.

That combination is rare in a day. Most sounds you hear want something from you. This one doesn't.

Let your jaw loosen. Let your shoulders drop.

If a thought comes, let it pass through. You're not clearing your mind — that isn't a thing minds do. You're just not chasing anything for a while.

Breathe in. Breathe out, longer.

Notice the quality of your attention right now. Not what you're thinking about. The texture of the attention itself. Whether it's darting or settled.

Whatever it is, don't correct it. Just notice.

The tone holds steady. It doesn't need you to be doing this well.

A few more breaths.

Feel your hands. Feel the weight of your head. Feel the air on your face.

There is nothing to achieve here, and nothing being measured. When it ends, you'll get up, and the only thing that will have changed is that you spent a few minutes not being pulled at.

That's the whole offer. Stay for the rest of it.`,
  },
  {
    slug: "frequency-639",
    kind: "frequency",
    title: "Connection 639 Hz",
    hook: "Connection · 639 Hz",
    theme: "love",
    minutes: 4,
    body: `Let your breath slow to meet the tone.

Not deliberately. Just notice it happening as you sit with a steady sound for long enough.

Let your shoulders come down. Let your hands rest open, if they aren't already.

This one is about connection, which is a word that gets used loosely. So let's be specific.

Think of one person. Not the most important person in your life — just the one who came to mind when you read that. Minds are usually right about this.

Hold them in your attention for a moment. Not the relationship. Not what's unresolved in it. Just them, as a person, existing today, somewhere, with their own morning and their own worries you know nothing about.

Breathe.

Notice what you feel. It might be warm. It might be complicated. It might be both at once, which is the ordinary case for anyone you've known a while.

Don't tidy it. Just let it be what it is for a few breaths.

The tone continues underneath.

There's something worth sitting with here. Most distance between people isn't caused by anything dramatic. It's caused by nobody moving first. Two people, each waiting, each reading the silence as an answer.

Silence is almost never an answer. It's usually just silence.

Breathe in. Out, slower.

Is there someone you've let drift, not through any decision, but by default?

You don't have to do anything about that right now. This isn't the part where you fix it. Just notice that it drifted, and that drifting is not the same as ending.

Feel your breath moving. Feel the weight of you where you're sitting.

Let the tone be steady around all of it.

If something occurs to you in the next few minutes — a name, a message you could send, a call you've been meaning to make — let it arrive without acting on it yet. It'll still be there afterwards.

For now, just this. A sound that doesn't want anything. A body slowing down. A person you thought of, still out there, going about their day.

Stay a while longer.`,
  },
  {
    slug: "frequency-888",
    kind: "frequency",
    title: "Abundance 888 Hz",
    hook: "Abundance · 888 Hz",
    theme: "wealth",
    minutes: 4,
    body: `Sit and let the tone settle around you.

Let your breathing lengthen on its own. Feel your weight where you're sitting.

This one gets called an abundance frequency, which invites a particular kind of thinking. Let's not do that kind of thinking. Let's do something more useful with the time.

Breathe.

Bring to mind, plainly, the thing you want more of. Money, probably, or the freedom that money is standing in for. Be honest about which. They're not the same and it matters which one you're actually after.

Hold it in mind without arguing about whether you should want it.

You're allowed to want it. Wanting more is not greed and it is not a character defect. It's usually just a person who has been tired for a long time, wanting to stop calculating.

Breathe out, slowly.

Now notice something about how it feels to want it. There's often a tightness that comes with it — a clench, somewhere. Chest or stomach usually.

That tightness is scarcity, and it's worth knowing it's there, because it makes people worse at exactly the thing they're reaching for. Decisions made from that clench are usually small, defensive ones.

You don't have to get rid of it. Just notice you're carrying it.

Let the tone be steady. Let your jaw unclench.

Here's the more interesting question, and it takes a minute to answer honestly.

What would actually change? Not the number. The days. What would a Tuesday look like, specifically, if this were already true?

Sit with that. Let it be concrete rather than grand. What time do you get up. What do you not think about. Who do you see. What stops being a calculation.

Notice which detail lands hardest. That one is what you actually want. The number was just the route to it.

Breathe.

Some of what you pictured is available sooner than you'd think, and doesn't require the number at all. That's usually true, and it's usually surprising.

You don't have to work out which parts right now. Just let the picture be clear, and let the tightness ease while you look at it.

A few more breaths, with the tone holding underneath.

Nothing to solve here. Just a clear picture, and a body that isn't braced.`,
  },
  {
    slug: "frequency-963",
    kind: "frequency",
    title: "Become confident 963 Hz",
    hook: "Become confident · 963 Hz",
    theme: "confidence",
    minutes: 4,
    body: `Let the tone hold the room.

Sit up, if you can — this one goes better with a straight back. Not rigid. Just upright.

Let your hands rest. Let your breath find a slower rhythm on its own.

Confidence is a badly understood word. Most people picture certainty, or volume, or the absence of nerves. It's none of those, and chasing those is why it stays out of reach.

Breathe.

Think of a time you did something you were afraid of. It doesn't have to be impressive. It could be a phone call. It could be walking into a room where you knew nobody.

Bring back the specifics. Where you were. What your hands were doing.

Now notice the thing that matters: you were afraid, and you did it anyway. The fear didn't lift first. It didn't wait politely for you to be ready. It was there the whole time and you moved regardless.

That is the entire mechanism. That's all it has ever been.

Breathe out, slowly.

The version of confidence you've been waiting for — where the nerves are gone before you begin — is not something other people have. It's not what you're seeing when you watch someone move through a room easily. What you're seeing is someone who stopped requiring the fear to leave first.

Let that land for a moment.

Feel your back. Feel the tone in the room. Feel your breath going in and out without instruction.

Now think of the thing currently in front of you. The one you've been circling. The conversation, the ask, the piece of work, the message.

Notice the fear. Locate it in your body. It's real and it's fine and it's not going anywhere.

Now, holding it, picture doing the thing anyway. Not it going well — just doing it. The first move. The physical first move.

Sit with that picture while the tone holds.

Your body will tell you it isn't ready. Bodies say that. It's not information about the thing, it's information about your nervous system, and it is wrong about this often enough that it doesn't get the final say.

Breathe in. Out, longer.

You've done this before. You have specific evidence, and you brought it to mind a few minutes ago.

Stay here a little longer with a straight back and a steady sound.

Then go and do the thing while still slightly afraid. That's how it's always been done.`,
  },
];

/** A gentle note about what frequency tracks are, shown once in the Library. */
export const FREQUENCY_DISCLAIMER =
  "Frequency tracks are calm listening sessions. The specific hertz numbers are a tradition in this space rather than a medical claim.";
