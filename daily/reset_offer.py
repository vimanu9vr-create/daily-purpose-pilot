"""The Seven-Day Reset — the offer video.

Different job to the daily reels, and the difference matters. A daily reel sells
awareness: it has to be interesting enough to hold a stranger and it ends by
naming the app. This one sells a $79 one-time purchase, so it has to do
something the awareness reels never attempt — justify a price.

So the shape is the sales page compressed, not a reel with a price bolted on.

Beat 1 is an accusation rather than a hook. "Your affirmations aren't working"
is addressed at somebody who is already doing this and already privately knows
it isn't landing. That is a much narrower audience than "how to manifest
millions" reaches, and narrow is correct here: a $79 purchase comes from people
who have already tried and failed, not from people who just got curious.

Beats 2 and 3 carry the dusty-glass figure, which is the whole argument. It is
doing two things at once — explaining why their affirmations failed, and
explaining why the thing being sold is seven days of clearing rather than more
affirmations. Without it the product looks like another affirmation app.

Beat 3 is the turn, and the lamp rises here rather than at beat 4 as it does in
the daily reels. "Nobody emptied the glass first" is the moment blame moves off
the viewer and onto the method, and that is the emotional pivot the purchase
depends on.

Beat 5 is the proof-of-work beat — naming Day 1 and Day 7 specifically, because
a vague "seven day programme" reads as a PDF somebody generated in an evening.
Naming what happens on a particular day reads as something that was built.

Beat 7 carries the price, said plainly. Viggnesh's instinct to put "lifetime
access" here was right about the substance and wrong about the words: "lifetime
access" is marketing language this audience has learned to distrust, and "free
for life" is both plainer and more obviously true. "Once" is load-bearing — the
entire differentiator against every app in this category is the absence of a
subscription, and people assume $9.99 a month unless told otherwise.

Content only. The build is reel.py.
"""

from reel import BURG, INK, LORA, LORA_I, POP_L, Beat, build

BEATS = [
    # Not a hook — an accusation, aimed at somebody already doing this and
    # already quietly aware it isn't working. Narrower reach than the millions
    # hook, and deliberately so: $79 comes from people who have tried.
    Beat(2.90, "Your affirmations\naren't working.", LORA, 84, INK,
         cy=980, gap=112),

    # The figure. Concrete, physical, and it does the explaining that three
    # beats of argument would otherwise need.
    Beat(2.90, "You're pouring clean water\ninto a dusty glass.", POP_L, 58, INK,
         cy=1000, gap=94),

    # The turn, early. This is where blame moves off the viewer and onto the
    # method, which is the pivot a purchase depends on — nobody buys a solution
    # while they still believe the failure was a personal defect.
    Beat(2.90, "Nobody emptied\nthe glass first.", POP_L, 64, BURG,
         cy=1000, gap=98),

    # What the thing actually is. Three named phases rather than "a programme",
    # because a named structure reads as built and a vague one reads as
    # generated.
    Beat(2.90, "Seven days. Three phases.\nPurge. Script. Integrate.", POP_L, 56, BURG,
         cy=1000, gap=92),

    # Proof of work. Naming specific days is what separates this from the
    # hundred other seven-day PDFs in this niche — it implies somebody decided
    # what happens on day one as distinct from day seven.
    Beat(4.40, "Day 1: write down what\nyou actually believe.\nDay 7: it runs\nwithout you.",
         LORA_I, 54, BURG, cy=970, gap=82),

    # The app, as the answer to the question beat 5 just raised. "Runs without
    # you" is a claim that needs a mechanism, and this is it.
    Beat(3.30, "ManifestAI is what\nkeeps it running.", POP_L, 58, BURG,
         cy=1000, gap=94),

    # The price, plainly. "Once" removes the subscription objection before it
    # forms; "free for life" is plainer and more credible than "lifetime
    # access", which this audience reads as marketing.
    Beat(3.40, "$79 once.\nThe app free for life.", LORA, 70, BURG,
         cy=990, gap=104),
]

if __name__ == "__main__":
    print(build(BEATS, "ManifestAI_SevenDayReset_Offer.mp4"))
