"""Day 11 — "Manifestation works. Just not the way it's sold."

Day 09 opened with "Manifesting doesn't work." This is the reversal, and the
reversal is the point: conceding the thing is the least expected move a
manifestation account can make two days after attacking it, and a concession
gets read where an attack gets argued with.

It also fixes a weakness in Day 09. "Doesn't work" gives a sceptic permission
to agree and scroll — they already believed that, so nothing was learned and
nothing was kept. "Works, but not for the reason you think" leaves a question
open that can only be closed by watching, which is the difference between
agreement and retention.

The recognition beat is the one that does the work here: "you have already
walked past it." Not a failure they confess to, a near-miss they can't verify
either way — which is far harder to dismiss than an accusation, and lands on
someone who has never once been told that noticing is the mechanism.

The saved line is the honest mechanism in six words. It is the only claim this
brand is allowed to make, and it happens to also be the most interesting thing
anyone will say to this audience today: attention, not attraction.

Content only. The build is reel.py.
"""

from reel import BURG, INK, LORA, LORA_I, POP_L, Beat, build

BEATS = [
    # The claim. A manifestation account conceding the category works is
    # unremarkable; the "but" is what buys the next three seconds.
    Beat(3.20, "Manifestation works.\nJust not the way\nit's sold.", LORA, 84, INK,
         cy=980, gap=112),

    # Name the false mechanism exactly. Not vaguely "the universe" — the
    # specific belief being sold, which is delivery.
    Beat(3.20, "Nothing is being\nsent to you.", POP_L, 66, INK,
         cy=1010, gap=98),

    # The recognition beat. A near-miss rather than an accusation: it can't be
    # checked, so it can't be dismissed, and nobody has said it to them before.
    Beat(3.00, "You have already walked\npast the thing you asked for.",
         POP_L, 60, INK, cy=1010, gap=92),

    # The turn. Lamp rises, the page appears underneath. The real mechanism,
    # stated plainly and without overclaiming it.
    Beat(3.00, "You notice what you\nrehearsed recently.\nThat's the whole trick.",
         POP_L, 60, BURG, cy=990, gap=92),

    # The line they save. The honest mechanism in six words, and the sharpest
    # counter-position available to this brand. Longest beat, enforced.
    Beat(4.60, "You don't attract it.\nYou start seeing it.", LORA_I, 78, BURG,
         cy=1000, gap=110),

    Beat(3.20, "Seven days of rehearsing it.", LORA, 70, BURG,
         cy=970, gap=100),
]

if __name__ == "__main__":
    build(BEATS, "ManifestAI_Day11_Reel.mp4")
