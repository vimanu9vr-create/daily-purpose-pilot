"""Day 10 — "Try this 60-second manifestation exercise."

An exercise hook has to deliver the exercise. If it promises sixty seconds of
practice and then spends twenty arguing about affirmations, it has lied in the
first frame — which is the same failure as a hook nobody can finish reading,
just further in.

So the beats ARE the exercise, and the saved line is the whole of it in three
short instructions. A screenshot of that frame is a usable card, which is what
makes it worth saving rather than merely agreeing with.

The exercise is the app's own daily practice — say it, picture it, do one
small thing — and Day 2 of the workbook, which is the ordinary-afternoon
visualisation and the reason skipping the win matters.

Content only. The build is reel.py.
"""

from reel import BURG, INK, LORA, LORA_I, POP_L, Beat, build

BEATS = [
    Beat(3.20, "Try this 60-second\nmanifestation exercise.", LORA, 88, INK,
         cy=1000, gap=118),

    Beat(3.20, "Say what you want.\nOnce, plainly, out loud.", POP_L, 64, INK,
         cy=1010, gap=96),

    # The twist, and the reason this isn't the exercise everyone already does.
    # Skipping the win is counter-intuitive enough to keep someone watching,
    # and it's the actual instruction from Day 2 of the workbook.
    Beat(3.00, "Now skip the moment\nyou get it.", POP_L, 64, INK,
         cy=1010, gap=96),

    # The turn. The lamp comes up here and the page appears underneath.
    Beat(3.00, "Picture an ordinary afternoon,\nmonths after it's true.",
         POP_L, 62, BURG, cy=1010, gap=94),

    # The line they save — the entire exercise, screenshot-sized. Longest
    # beat in the video, enforced by reel.py.
    Beat(4.60, "Say it once.\nPicture the Tuesday.\nDo one small thing tonight.",
         LORA_I, 76, BURG, cy=980, gap=104),

    Beat(3.20, "That's day one of seven.", LORA, 74, BURG, cy=970, gap=102),
]

if __name__ == "__main__":
    build(BEATS, "ManifestAI_Day10_Reel.mp4")
