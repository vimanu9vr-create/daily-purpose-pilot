"""Day 09 — "Manifesting doesn't work."

Viggnesh's hook, stated flat and left standing for three seconds before
anything softens it. That pause is the whole hook: an account in this niche
saying the category doesn't work, and then not immediately taking it back.

The story between is the one his own sales page already tells, because it's
true and because a stranger recognises themselves in it: you wrote the
affirmations, you said them to a mirror, you stopped around day four and
quietly concluded something was wrong with you.

Content only. The build is reel.py.
"""

from reel import BURG, INK, LORA, LORA_I, POP_L, Beat, build

BEATS = [
    Beat(3.20, "Manifesting\ndoesn't work.", LORA, 96, INK, cy=1000, gap=126),

    Beat(3.20, "You wrote the affirmations.\nYou said them to the mirror.",
         POP_L, 62, INK, cy=1010, gap=94),

    # The recognition beat. "Around day four" is the detail that turns this
    # from a lecture into something that happened to them specifically —
    # everyone who quit, quit at roughly the same place.
    Beat(3.20, "Around day four you stopped,\nand quietly decided\nit was you.",
         POP_L, 62, INK, cy=980, gap=94),

    # The turn. The exoneration has to arrive before the method, or the method
    # sounds like one more thing they'll fail at.
    Beat(3.00, "It wasn't you. You were handed\na mechanism that isn't true.",
         POP_L, 62, BURG, cy=1010, gap=94),

    # The line they save. Longest beat, enforced by reel.py.
    Beat(4.40, "Describe the Tuesday,\nnot the trophy.", LORA_I, 88, BURG,
         cy=1000, gap=118),

    Beat(3.20, "Reset it in seven days.", LORA, 76, BURG, cy=970, gap=104),
]

if __name__ == "__main__":
    build(BEATS, "ManifestAI_Day09_Reel.mp4")
