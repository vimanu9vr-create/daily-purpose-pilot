"""Day 13 — "How to manifest millions."

Viggnesh's concept, built to the locked format. His three parts — the millions
hook, the affirmations, the app at the end — map onto the six beats without
forcing anything.

The hook is deliberately the saturated one. "How to manifest millions" is what
every account in this lane opens with, and that is both the risk and the
reason: the topic has enormous reach and almost no differentiation, so the
video has to earn its keep in beat 2 rather than beat 1. Beat 2 is therefore
the turn against the expected payoff — a video that opens "how to manifest
millions" and then tells you to stop saying "I am a millionaire" is doing the
one thing the viewer did not queue up for.

Beat 3 is the recognition beat and it is the whole video. "In the car" is
small, physical and almost universally true of this audience — people say
affirmations while driving because it is the only unobserved time they have.
Nobody has reflected that back at them.

Beat 5 carries the affirmations themselves, which is what he asked for, and
they are the app's real argument: a scene you could picture, not a quantity you
could not. Longest beat, so a screenshot has time to become one.

Content only. The build is reel.py.
"""

from reel import BURG, INK, LORA, LORA_I, POP_L, Beat, build

BEATS = [
    # The hook he asked for. Broad, saturated, and high-reach — which is why
    # everything after it has to immediately stop being what they expected.
    Beat(2.90, "How to manifest\nmillions.", LORA, 88, INK,
         cy=980, gap=118),

    # The reversal, straight away. The viewer queued up for a method and is
    # handed a refusal; that mismatch is what buys beats three to six.
    Beat(2.90, "Not by saying\n“I am a millionaire.”", POP_L, 64, INK,
         cy=1000, gap=98),

    # The recognition beat. "In the car" because that is where people actually
    # say these — the only unobserved time most of them have — and nobody has
    # ever said it back to them.
    Beat(2.90, "You've said that one\nin the car. Nothing moved.", POP_L, 60, INK,
         cy=1010, gap=92),

    # The turn. Lamp rises. The test stated as a size, because the whole
    # failure being described is that people reach for a number too large to
    # picture.
    Beat(2.90, "Say something small\nenough to picture.", POP_L, 64, BURG,
         cy=1000, gap=98),

    # The affirmations, rewritten.
    #
    # The first version was "I sign my name on the offer" and "the money
    # arrives and I am ready", and it did not connect for two reasons that are
    # worth keeping written down.
    #
    # One: a hook promising MILLIONS cannot pay off with a job offer. The
    # viewer stopped for money and was handed a different subject, which reads
    # as bait even when nothing was intended by it.
    #
    # Two, and worse: "the money arrives and I am ready" is precisely the kind
    # of line this video spends three beats attacking. It is a quantity with no
    # scene attached — unpicture-able, unbelievable, the thing you quit saying
    # by the fourth morning. The video argued against its own payoff.
    #
    # These two are money, and they are scenes. Paying without checking is what
    # having money actually feels like from the inside, which is both more
    # believable and more specific than any number. Nobody else in this lane
    # writes affirmations this small, which is exactly why they are worth
    # screenshotting.
    Beat(4.40, "“I pay for it without\nchecking the balance.”\n“The number goes up\nwhile I'm asleep.”",
         LORA_I, 58, BURG, cy=970, gap=86),

    # THE BRIDGE. Seven beats rather than the locked six, deliberately.
    #
    # The first cut went straight from the affirmations to the app's name, and
    # Viggnesh was right that it landed as an advert bolted onto a nice video.
    # Nothing in between had given anybody a reason to want the thing.
    #
    # This beat creates the need. The first attempt at it read "Saying it twice
    # is why it never stuck", which was muddled: "twice" meant "for two
    # mornings, then you quit", and nobody reconstructs that in three seconds.
    # A line that has to be decoded is a line that gets scrolled.
    #
    # This version gives an instruction instead of a diagnosis. It names the
    # part everybody actually skips — the next morning — and it sets up the
    # only number that matters in beat 7. Now the app is the answer to a
    # question the video just made them ask, rather than a logo at the end.
    Beat(3.30, "Then say it tomorrow.\nThat's the part\neverybody skips.", POP_L, 58, BURG,
         cy=985, gap=88),

    # The close. Names what the app actually does — writes yours, then walks
    # you through the 21 days — which is a real feature rather than a slogan.
    # No URL on screen.
    Beat(3.40, "ManifestAI writes yours.\nThen 21 days of\nfive-minute practice.",
         LORA, 60, BURG, cy=980, gap=90),
]

if __name__ == "__main__":
    build(BEATS, "ManifestAI_Day13_Reel.mp4")
