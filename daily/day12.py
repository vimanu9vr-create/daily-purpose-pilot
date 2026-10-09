"""Day 12 — "Stop saying 'I am abundant.'"

Day 09 attacked the category. Day 11 conceded it works and named the mechanism
— noticing, not attracting. This one does the only thing left that is worth
doing: it attacks the SPECIFIC SENTENCE the audience is already saying, and
hands them the replacement.

Why this seam and not another. The documented complaint in these communities
is not that manifestation is nonsense — it is that repeating "I am a
millionaire" while behind on rent feels like lying to yourself. People build
affirmations they cannot believe, say them for three or four mornings, feel
faintly stupid, and quit. That is the single most common lived experience in
the audience and almost nobody makes content about it, because the saturated
lane is writing MORE affirmations of exactly that kind.

So the hook is a command, not a claim: "Stop saying 'I am abundant.'" A
manifestation account telling you to stop affirming is a pattern interrupt in
the strict sense — it does not match the expected format of the feed it
appears in, and the mismatch has to be resolved before the viewer can
comfortably scroll. Research this week puts the stay-or-scroll decision at
about 1.7 seconds, so the whole hook is four words and a quote.

Beat 3 is the recognition beat and it carries the video. "The fourth morning"
is specific enough to be checkable against their own memory and small enough
that nobody can argue with it — which is the difference between being caught
and being accused. Day 11 used a near-miss for the same reason.

Beat 5 is real UI copy, verbatim from the app: the line under SAY THIS ONE.
That matters more than it looks. It means the thing they screenshot IS the
product, so the save and the demo are the same object, and nothing has been
invented to make the point.

Content only. The build is reel.py.
"""

from reel import BURG, INK, LORA, LORA_I, POP_L, Beat, build

BEATS = [
    # The command. Four words plus the quote — a manifestation account telling
    # you to stop affirming is the mismatch that buys the next three seconds.
    Beat(3.00, "Stop saying\n“I am abundant.”", LORA, 84, INK,
         cy=980, gap=112),

    # Why, in the body rather than the mind. Not "it's wrong" — "you don't
    # believe it", which they can check instantly and privately.
    Beat(3.20, "Some part of you\nknows it isn't true yet.", POP_L, 64, INK,
         cy=1000, gap=98),

    # The recognition beat. The fourth morning is small, specific and
    # unarguable — they either remember quitting or they don't, and most do.
    Beat(3.00, "That's why you stopped\non the fourth morning.", POP_L, 60, INK,
         cy=1010, gap=92),

    # The turn. Lamp rises. The rule restated as a test they can apply
    # themselves, which is what makes it useful rather than clever.
    Beat(3.00, "A line only works if\nyou could picture it\nhappening this year.",
         POP_L, 58, BURG, cy=980, gap=88),

    # The line they save — and it is the app's own copy, verbatim. The
    # screenshot and the product demo are the same object. Longest beat, so a
    # screenshot has time to become one.
    Beat(4.60, "“I sign my name on the\ndream job offer.”", LORA_I, 76, BURG,
         cy=1000, gap=108),

    # Close. Names what the app actually does — writes the line for the goal
    # you typed — without a URL on screen.
    Beat(3.20, "Written for your goal.\nSeven days of saying it.", LORA, 64, BURG,
         cy=990, gap=100),
]

if __name__ == "__main__":
    build(BEATS, "ManifestAI_Day12_Reel.mp4")
