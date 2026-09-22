# The format — locked

Day 08 is the reference. Every reel from here follows this unless Viggnesh
says otherwise. Written down because I drifted off it twice in one week and
cost him two rebuilds.

Reference build: `day08.py` · `cover8.py`

---

## Why this one works

It is slow enough to read, it teaches one thing, and it hands over a line
worth screenshotting. Those three, in that order. Everything below exists to
protect one of them.

The two videos that failed failed for the same reason — 9 seconds across five
beats gave each line 1.4s, which is less time than it takes to read two lines
of type. Nobody finished a sentence before the next replaced it, so nothing
was kept. Speed reads as emptiness.

---

## The shape

Six beats. 18–20 seconds.

| Beat | Job | Time |
| --- | --- | --- |
| 1 | The question, or a flat claim | ~3.2s |
| 2 | The thing that doesn't work, named exactly | ~3.2s |
| 3 | **The recognition beat** — the specific detail that makes them feel caught | ~3.0s |
| 4 | The turn. Light warms, ruled lines begin | ~3.0s |
| 5 | **The line they save.** Longest beat in the video | ~4.4s |
| 6 | Seven days of these · Link in bio | ~3.2s |

**Beat 3 is the one that does the emotional work.** "You stopped by Thursday."
"An ordinary afternoon, months in." Specific enough that it could only be
about them. Without this beat the video is a lecture.

**Beat 5 is the only reason anyone follows.** It must be true, unarguable, and
short enough to screenshot. It holds longest by design — a screenshot needs
time to become one.

---

## Hard rules

- **No beat under 2.2s.** Asserted at build time.
- **Beat 5 must be the longest.** Asserted, so a later edit can't demote it.
- **Beats are contiguous.** No gaps — a gap has no defined frame and the
  lookup falls through to the wrong beat.
- **Cross-dissolve 0.34s, never a hard cut.** At 0.55 both lines sit near zero
  opacity at the boundary and it flickers blank; at 0.22 it feels clipped.
- **Text on screen at frame 0**, fully opaque. The first frame is the only one
  you're guaranteed.
- **Nothing below 46px.**
- **Text between y=690 and y=1450.**

## The look

- Palette: the app's own. Cream `247,233,236` · blush `250,240,240` · burgundy
  `92,31,46` · rose `214,150,164` · ink `58,22,32`. **Never near-black.** The
  app is soft pink; someone tapping through from a hard dark video lands on a
  different product.
- Lora for the lines carrying feeling. Lora Italic for the saved line.
  Poppins Light for plain statements. Poppins Medium only for the sign-off.
- Light does the argument: cold window wash top-left while the problem is
  stated, warm lamp lower-right growing from the turn.
- Ruled lines draw in one at a time after the turn, one every ~0.34s, faint.
  The frame becomes a page. It's the product, said without a word.
- A slow breath on the whole frame — `1 + 0.010·sin(t·0.55)`. Never still,
  never busy.
- No shake. No scale snap. No dust. No impact.

## Covers

Alternate light and dark against the previous day so the grid has rhythm.
Everything readable must sit inside y=420–1500 — the square crop — and that's
asserted at build time, not eyeballed.

---

## Never

- **Fabricated testimonials or earnings claims.** Not "I made millions saying
  this", not invented user counts, not results. Illegal in most places,
  obvious to the people you're trying to persuade, and it contradicts page one
  of the workbook.
- **Selling a generic affirmation straight.** "Money flows to me freely" is
  the thing Day 02 told people to stop saying. Use it as the counter-example,
  never as the promise.
- **Promising outcomes.** Claims stay on attention, noticing, rehearsal,
  consistency, acting sooner. That's the honest mechanism and it's the one the
  product is built on.
- **A URL on screen.** "Link in bio" only.
- **Naming an audio track as trending.** It can't be verified from here. Say
  "trending audio from the Reels library" and describe the mood.

---

## Before encoding

1. Contact sheet, 10–12 frames, and actually look at it.
2. Measure luminance range per frame across the text band. More than ~6 frames
   below 60 means a dissolve is leaving a hole.
3. Verify every frame draws its own beat.
4. Then encode.

```
ffmpeg -y -framerate 30 -i fr/f%03d.jpg \
 -f lavfi -i "anoisesrc=color=brown:amplitude=0.002:sample_rate=44100" \
 -map 0:v:0 -map 1:a:0 -shortest -vf "noise=alls=4:allf=t" \
 -c:v libx264 -preset veryfast -profile:v main -level 4.0 -pix_fmt yuv420p \
 -g 60 -crf 20 -c:a aac -b:a 128k -ar 44100 -ac 2 -movflags +faststart out.mp4
```

## Caption shape

The hook, expanded. The recognition beat, in full sentences. The turn. The
saved line on its own line, italic. Then: seven days, ten minutes each, no
wishing. Close on **"Comment RESET and I'll send you day one, free. Or it's in
my bio."**

Audio note every time: mood, tempo, and the exact second the swell should land
— which is always the turn, beat 4.
