# narrate-story — why it is the way it is

Lifted out of `index.ts`, which had become 40% commentary. Each section is
referenced from the line it used to sit above.

## 1. `/**`

Narration model.

This was `eleven_turbo_v2_5`, which ElevenLabs now lists as deprecated and
describes as a low-latency model for real-time agents and chatbots. We were
using a model built for speed to read a meditation — and it sounded like it:
flatter, thinner, and slightly hurried, which is the opposite of calm.

`eleven_multilingual_v2` is their recommendation for narration and long-form
content, and it's the one they describe as most stable across a long
generation. It costs more per character and takes a couple of seconds longer
to produce. Both are the right trade for something a person listens to with
their eyes closed, and neither is felt after the first play because the
result is cached forever.

## 2. `const OUTPUT_FORMAT = "mp3_44100_64";`

Output format.

Was `mp3_44100_128`. Reported as "it got stuck at 19 sec" on a frequency
track whose file is demonstrably complete — 47 sentences, 179 seconds, all
of it in storage. What ran out was the download, not the audio.

128kbps is a music bitrate. This is one voice, slowly, over a soft pad;
64kbps is transparent for speech and halves the file. A three-minute track
goes from about 2.9MB to 1.4MB, which halves both the time before playback
can start and the chance of stalling part-way through on a phone connection.

This is also the honest answer to "I need it to be fast". Generation time is
fixed by how much text there is, but transfer time is ours to choose, and we
had been paying double for a fidelity nobody can hear on a voice track.

## 3. `const MODEL = Deno.env.get("NARRATION_MODEL") ?? "eleven_flash_v2_5";`

Which model reads it. **This default changed, and it is on probation.**

`eleven_multilingual_v2` is ElevenLabs' recommendation for narration and the
one they describe as most stable across a long generation. It is full price:
one credit per character, so **39c** for the average 2,139-character story.

`eleven_flash_v2_5` bills half a credit per character — **20c** for the same
story. It is built for real-time agents rather than long-form reading, so it
is faster and slightly less settled over three minutes.

### Why the default moved

It used to sit on quality, with the reasoning that halving the bill by
halving the thing people are paying for is a bad trade. That reasoning was
right, and it was argued against a cost figure that turned out to be wrong by
an order of magnitude — a story is 2,139 characters, not the ~230 the old
arithmetic implied. At 39c a listen, the Voice plan's 45-a-month ceiling costs
$17.55 against $10.49 of net revenue. It doesn't work. At 20c it does.

So the trade is no longer quality against thrift, it is Flash against no voice
at all.

### How to judge it, and how to undo it

`RENDER_VERSION` was deliberately **not** bumped. Every story already narrated
keeps its `multilingual_v2` audio and plays untouched; only new renders use
Flash. That makes an old story and a new one a direct comparison on the same
voice, the same settings and the same phone.

The thing to listen for is the complaint this app has already had once: the
voice sounding clipped or hurried rather than settled. If it's there, set the
`NARRATION_MODEL` secret to `eleven_multilingual_v2` — that reverts it with no
deploy and no re-rendering — and the plan maths has to be solved another way,
by shortening the stories or by raising the price.

## 4. `const RENDER_VERSION = "v7";`

Bumped when a change is meant to reach audio that already exists.

v4 switched from estimated sentence times to real ones. v5 slowed the voice
to 0.7 and opened the gaps to 2.4s. v6 gives each half of a split narration
the text either side of it, so the two halves sound like one performance
instead of two. Each of those was a fix somebody had complained about, and
cached audio is keyed by voice — so without the bump only brand new tracks
would change, and the fix would look like it hadn't worked.

### But bumping is not free, and it is the single most expensive habit here

Two thirds of every character ever bought on this account was waste, and the
largest share of it was this constant: four bumps in a week while tuning the
pacing, each one re-buying the entire library. Storage still holds five
separate renders of "abundance-888-hz". Every one was paid for.

So the rule is narrower than it looks. Bump when existing audio is *wrong* and
must be replaced. Do **not** bump merely because something changed.

The move to Flash in §3 is the worked example: it changes the model, and it
deliberately does not bump. Old audio isn't wrong, it's just more expensive
than the next one will be — and leaving it alone costs nothing, preserves a
direct A/B against the new renders, and keeps a reversal free.

## 5. `const VOICE_SETTINGS = {`

Settings tuned for calm rather than expressive.

style at 0 is the important one: any amount of it makes the model perform
the line, and performance is what made this sound like an advert instead of
something to fall asleep to. Higher stability keeps the delivery even across
a long piece, and speaker boost is off because it adds a forward, present
quality that works for a voiceover and fights a bedtime story.

## 6. `speed: 0.7,`

Slower than natural speech.

Was 0.85, and reported back as still feeling fast — "it's not like the
universe is speaking". The logs confirmed 0.85 was genuinely being applied
rather than being rejected and silently dropped, so the setting was right
and the number was wrong.

0.7 is close to the floor of what stays natural; below it the model starts
to slur rather than slow. Most of the remaining effect comes from the
silence between sentences instead, which is the cheaper lever.

## 7. `const BREAK_SECONDS = 2.4;`

Silence between sentences.

This single number does more for the feeling of space than any voice
setting. At 0.9s the narration reads like an audiobook. At 1.6s it reads
like something said into a large room. At 2.4s it stops sounding like
reading at all — the gap is long enough that each line arrives on its own
rather than as the next item in a list, and long enough for the ambient bed
to be heard underneath, which is where the atmosphere actually lives.

It is also what makes a slow voice bearable: 0.7 speed with short gaps just
sounds sluggish. Slow delivery plus long silence sounds deliberate.

## 8. `const OPENING_SENTENCES = 2;`

How much of the story gets generated first.

The complaint: "voice starts playing after 40 secs, I need immediately
because it gets frustrating." That was accurate and it's a straight
consequence of the design — ElevenLabs was asked for the entire track, and
an eighteen-minute sleep script is thousands of characters. Nothing could
play until the last character was rendered.

Nobody needs the last character to start listening. So the opening is
requested on its own and comes back in a few seconds, the player starts, and
the remainder is fetched underneath while those first lines are being read.

Two sentences rather than one: a single sentence can be four words, which
would run out before the rest arrives. Two plus the 1.6s pause between them
buys roughly ten to fifteen seconds of cover, which is comfortably more than
the rest takes to render.

## 9. `const NARRATION_ALLOWANCE = { free, standard, voice }`

How much narration each tier may commission, and why the tier decides.

Narration is not a cost centre in this app, it is the entire cost. Text runs
on Gemini's free tier and photographs on Pexels' free allowance; ElevenLabs
bills per character, and nothing was counting it. One person on a slow
afternoon could empty the month's allowance for everybody, and that is not a
hypothetical: it is what happened.

### The measured numbers

Taken from production rather than estimated. The average narrated story is
**2,139 characters**. ElevenLabs Creator is **$22 for 121,000 credits**
(checked August 2026), so a credit costs $0.000182. `multilingual_v2` bills
one credit per character, `flash_v2_5` bills half.

That makes one listen **39c** at full quality, or **20c** on Flash.

The figures this replaces were wrong by an order of magnitude. They assumed
about 2,300 characters a *day* when a single story is 2,139 — so the
"generous" cap of ten a day was roughly $60 a month per subscriber against
$8.99 of revenue. A cap set by intuition rather than by measurement is not
a cap.

### Why the tier decides, not just "paid"

One price covering both text and voice means the person who only reads pays
for the person who listens, and the app loses more money the more its best
feature gets used. Standard is priced low and includes no narration; Voice is
priced to cover its own bill. See `src/features/billing/plans.ts`.

Three windows, not one. `perDay` stops a single evening consuming the month.
`perMonth` bounds the tail so one enthusiastic subscriber can't outrun the
subscription paying for them. `total` exists only on free, where narration is
a trial that ends rather than an allowance that resets forever — three
listens costs about 60c to give away, a fair price for letting somebody hear
the thing they'd be buying. Three a *day* would be $18 a month per person,
for people who may never pay.

### The exemption

The shared library is exempt. Those tracks are keyed by title, so one render
serves every user who ever opens them; charging a person's allowance for a
file that already exists would be punishing them for someone else's
generosity.

## 10. `if (!part && story.audio_url && story.audio_voice?.startsWith(`${voice}@`) && !f`

ANY existing audio in this voice is good enough. Not just this version.

This used to require an exact match on `voice@RENDER_VERSION`, so every
time I changed a voice setting the entire library was invalidated and
re-rendered from scratch — and I bumped that constant four times in one
week tuning the pacing. Storage still holds five separate renders of
"abundance-888-hz", one per bump. Every one was paid for.

The version exists so that a settings change reaches new audio. It was
never worth re-buying thousands of tracks that already sound fine, and
nobody listening can hear the difference between v6 and v7 anyway — they
can only hear the difference between audio and no audio.

`force: true` re-renders deliberately, which is what the maintenance
page uses when a change is actually worth paying for.

## 11. `const isCatalogue = story.source === "catalogue";`

Sleep, meditation and frequency tracks are word-for-word identical for
every user, but each user gets their own `moments` row — so without this
we would pay ElevenLabs to narrate the same script once per person, and
every one of them would wait several seconds for audio that already
exists. That is both the loading complaint and the largest cost line.

Personal stories still get their own file. Only the shared catalogue is
keyed by title rather than by user.

## 12. `const marksPath = `${path.replace(/\.mp3$/, "")}.marks.json`;`

Sentence times live beside the audio as a small JSON file.

The whole-story marks are stored on the `moments` row, but a part has
nowhere to go there — and without somewhere to put them, a cached part
would have to be regenerated purely to recover its timings, which would
defeat the caching entirely. A few hundred bytes next to the mp3 is
cheaper than a schema change and doesn't need a migration.

## 13. `let found = audioUrl;`

Somebody has already paid for this one. Point this user's row at it
and return without touching ElevenLabs.

Older render versions count. A v5 file is Sarah reading the same
script; charging again for a marginally different pause length is how
five copies of "abundance-888-hz" ended up in storage.

## 14. `if (!isCatalogue) {`

THE CAP. Checked here, after every cache path has had its chance.

Placement is the whole design. Everything above this line either found
existing audio or established that none exists, so a cached hit never
costs somebody their allowance — you are only charged for a narration
that is actually bought.

The shared library is exempt for the same reason: it is keyed by title,
so the first person to open a sleep track pays for everyone, and taking
their allowance for it would punish them for being first.

### Two refusals, not one

A Standard subscriber gets **402 `voice_not_included`**. A Voice subscriber
who has used today's three gets **429 `daily_limit`**. These must be
different, because the screens they produce are opposites: one says "come
back tomorrow", and the other has to say "this is on the Voice plan".

Telling a Standard subscriber to come back tomorrow sends them back tomorrow
to find nothing has changed, which reads as a broken app rather than a plan
boundary — and it wastes the one moment they wanted the voice enough to press
a button.

The free trial running out is a third case again (`trial_used`), for the same
reason: "it resets at midnight" is a lie when the allowance is a lifetime
total.

### This copy of `tierOf` is the one that decides

The client has its own copy in `plans.ts`. That one only controls what gets
drawn on screen. Anyone can edit what runs in their own browser, so a gate
that lives there is a suggestion — the subscription row is read here, with
the service key, on every uncached render.

## 15. `const CONTEXT_CHARS = 400;`

Tell the model what comes either side of this chunk.

THIS IS THE FIX FOR "the voice first feels robotic and after some
seconds it goes fast."

Splitting the narration in two made it start quickly, but it also meant
asking ElevenLabs for two unrelated performances. The opening is around
eighty characters — with no context at all, the model has nothing to
pitch against and delivers it flat and clipped, which is what "robotic"
is. The remainder is thousands of characters, so it settles into a
natural, flowing, noticeably quicker read. Two different voices, joined
fifteen seconds in.

`previous_text` and `next_text` exist precisely for this: ElevenLabs
documents them as improving continuity when concatenating separate
generations. Giving the opening a glimpse of what follows, and the
remainder a glimpse of what preceded it, makes both halves sound like
one person reading one thing.

Neither is spoken. They are context only.

## 16. `const speak = (settings: Record<string, number | boolean>) =>`

`/with-timestamps` rather than the plain endpoint.

It returns the audio as base64 plus the start and end time of every
character, which is the whole point: the previous version guessed the
timings from a hardcoded 2.25 words per second, and a guess that is even
slightly wrong accumulates. By the twentieth sentence of a story the
highlighted line and the voice were seconds apart — reported as "voice
and wordings doesn't tally, voice goes fast".

No estimate can fix that, because real delivery isn't uniform: Sarah
slows on long clauses, pauses at commas, and takes a different amount of
time on "no" than on "unremarkable". The only correct source for when a
sentence starts is the engine that spoke it.

## 17. `if (ttsRes.status === 401 || ttsRes.status === 403) {`

SAY WHY. This returned a bare 502 and logged nothing.

Every narration request failed for a day and the only trace was
"POST | 502" in the edge log — no reason, nowhere. That is the same
mistake that cost a day on the Gemini side: the most common failure was
the one that recorded the least.

It matters here because 401 from ElevenLabs is two different problems
wearing the same status. A revoked or rotated key needs a new key; a
spent monthly quota needs either waiting or a bigger plan. Telling them
apart is the difference between a two-minute fix and an afternoon.

## 18. `await fetch(`${supabaseUrl}/rest/v1/narration_spend`, {`

Record what we just bought.

After the upload rather than before it, so a failed render doesn't cost
somebody a narration they never received. The window where a crash
between upload and here loses a record is small and errs the right way:
the user gets a free one rather than being charged for nothing.

## 19. `function marksFromAlignment(`

Turn per-character times into the moment each sentence begins.

ElevenLabs times every character it spoke. We know where each sentence
starts in the script we sent, so a sentence's start time is the time of the
character at that offset.

The one wrinkle is that the returned character list doesn't always match the
text we sent one-for-one — SSML break tags and text normalisation ("20000cr"
becoming words) change the length. So when the lengths disagree, positions
are scaled proportionally instead. That is still enormously better than the
old estimate: it's anchored to the real total duration rather than to an
assumed reading speed, so error can't accumulate across a long story.
