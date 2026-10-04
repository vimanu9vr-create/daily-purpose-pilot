"""Put three seconds of real footage in front of a finished reel.

## The argument

Hook with a person, prove with the product. The generated-or-stock footage buys
the stop; the app footage underneath earns the signup. Making the WHOLE reel
photoreal costs more and says less — a beautiful stock clip of a woman at a
window is the most saturated image in this entire niche, and on its own it
says nothing about what ManifestAI does.

Three seconds is the whole budget. Instagram's stay-or-scroll decision lands at
about 1.7 seconds, so the footage only has to survive that long before the
thing nobody else can show takes over.

## Why the text sits on a scrim

White type over stock footage is unreadable the moment the clip has a bright
patch, and every clip has a bright patch. A dark band under the words costs a
little of the image and guarantees the line is legible at the only size that
matters — a phone in daylight.

Usage:

    export PEXELS_API_KEY=...
    python3 opener.py "woman morning window calm" "You've said it in the car." ManifestAI_Day14_Demo.mp4
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import footage

HERE = Path(__file__).parent
LORA = "/usr/share/fonts/truetype/google-fonts/Lora-Variable.ttf"
SECONDS = 3.0


def build_opener(query: str, line: str, out: Path, pick: int = 0) -> Path:
    src = footage.fetch(query, pick=pick)
    trimmed = HERE / "_opener_raw.mp4"
    # Start a second in: stock clips often open on a static frame before the
    # motion begins, and a still first frame is the one thing the format rules
    # say never to ship.
    footage.to_vertical(src, trimmed, SECONDS, start=1.0)

    escaped = line.replace("'", "’").replace(":", "\\:")
    subprocess.run(
        [
            "ffmpeg", "-y", "-v", "error", "-i", str(trimmed),
            "-vf",
            # Band sits in the lower third, inside the safe area, away from
            # Instagram's own interface at top and bottom.
            "drawbox=x=0:y=1180:w=1080:h=230:color=black@0.55:t=fill,"
            f"drawtext=fontfile='{LORA}':text='{escaped}':fontsize=72:"
            "fontcolor=white:x=(w-tw)/2:y=1245,"
            # Fade out over the last third so the cut to the app is a dissolve
            # rather than a slam.
            f"fade=t=out:st={SECONDS - 0.4}:d=0.4",
            "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
            "-pix_fmt", "yuv420p", str(out),
        ],
        check=True,
    )
    return out


def join(opener: Path, body: Path, out: Path) -> Path:
    """Concatenate by re-encoding.

    Stream copy would be faster and does not work: the two files come from
    different encoders with different GOP structures, and -c copy produces a
    file that plays locally and stalls on a phone.
    """
    lst = HERE / "_join.txt"
    lst.write_text(f"file '{opener.resolve()}'\nfile '{body.resolve()}'\n")
    subprocess.run(
        [
            "ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", str(lst),
            "-f", "lavfi", "-i", "anoisesrc=color=brown:amplitude=0.002:sample_rate=44100",
            "-map", "0:v:0", "-map", "1:a:0", "-shortest",
            "-c:v", "libx264", "-preset", "veryfast", "-profile:v", "main", "-level", "4.0",
            "-pix_fmt", "yuv420p", "-g", "60", "-crf", "20",
            "-c:a", "aac", "-b:a", "128k", "-ar", "44100", "-ac", "2",
            "-movflags", "+faststart", str(out),
        ],
        check=True,
    )
    lst.unlink(missing_ok=True)
    return out


if __name__ == "__main__":
    if len(sys.argv) < 4:
        print(__doc__)
        raise SystemExit(1)
    query, line, body = sys.argv[1], sys.argv[2], HERE / sys.argv[3]
    try:
        op = build_opener(query, line, HERE / "_opener.mp4")
    except footage.MissingKey as e:
        print(e)
        raise SystemExit(1)
    final = join(op, body, HERE / f"{body.stem}_hooked.mp4")
    print("built", final.name)
