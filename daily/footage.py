"""Free photoreal footage, from Pexels.

## Why this exists

Every reel so far is typography on a rendered gradient. The research is
consistent that raw, real footage currently outperforms polished design in
short form, and thirteen days of 8-view posts is not evidence against it.

The obvious fix was a video-generation subscription. The arithmetic killed it:
Runway Standard is $15/month for roughly 625 credits, a 30-second generated
video costs about 150 of them before retries, and retries are not optional —
so $15 buys one finished 30-second video a month that fights you on face
consistency across cuts.

Pexels video is free, licensed for commercial use including paid ads, has no
credit ceiling and no monthly fee. For a three-second hook under text — which
is what actually matters — a stock clip of real morning light is worth more
than a generated one, because nobody is looking at it long enough for the
difference to register.

The trade, stated honestly: you take what the library has rather than
specifying the exact shot, and other people use the same clips. Both matter
for a hero shot. Neither matters much for three seconds behind a hook.

## The key

Reads PEXELS_API_KEY from the environment. It lives as a Supabase secret
rather than in .env, so export it before running:

    export PEXELS_API_KEY=...        # from supabase secrets, or pexels.com/api

Never hardcode it here. This file is committed.
"""

from __future__ import annotations

import json
import os
import subprocess
import urllib.parse
import urllib.request
from pathlib import Path

API = "https://api.pexels.com/videos/search"
CACHE = Path(__file__).parent / "footage"


class MissingKey(RuntimeError):
    pass


def _key() -> str:
    key = os.environ.get("PEXELS_API_KEY", "").strip()
    if not key:
        raise MissingKey(
            "PEXELS_API_KEY is not set.\n"
            "  export PEXELS_API_KEY=<your key>\n"
            "Get one free at pexels.com/api, or read the existing one with:\n"
            "  npx supabase secrets list --project-ref pkxkksamenqcvsaulceq"
        )
    return key


def search(query: str, per_page: int = 15) -> list[dict]:
    """Portrait clips matching a query, longest-lived first.

    Portrait only. A landscape clip cropped to 9:16 loses two thirds of the
    frame and almost always cuts the subject in half — which is exactly the
    kind of thing that looks fine in a contact sheet and awful on a phone.
    """
    url = f"{API}?{urllib.parse.urlencode({'query': query, 'orientation': 'portrait', 'per_page': per_page, 'size': 'medium'})}"
    req = urllib.request.Request(url, headers={"Authorization": _key()})
    with urllib.request.urlopen(req, timeout=20) as r:
        data = json.load(r)
    return data.get("videos", [])


def best_file(video: dict) -> dict | None:
    """The highest portrait rendition at or under 1080 wide.

    Above 1080 is wasted — the output is 1080x1920 — and downloading a 4K file
    to throw most of it away is slow on a phone tether, which is where this
    will often be run.
    """
    files = [f for f in video.get("video_files", []) if (f.get("height") or 0) > (f.get("width") or 0)]
    files = [f for f in files if (f.get("width") or 0) <= 1200] or files
    return max(files, key=lambda f: (f.get("width") or 0), default=None)


def fetch(query: str, pick: int = 0) -> Path:
    """Download one clip and return its path. Cached by id, so re-runs are free."""
    videos = search(query)
    if not videos:
        raise RuntimeError(f"No portrait footage for {query!r}. Try fewer, plainer words.")
    video = videos[min(pick, len(videos) - 1)]
    f = best_file(video)
    if not f:
        raise RuntimeError(f"Clip {video['id']} has no usable rendition.")

    CACHE.mkdir(exist_ok=True)
    out = CACHE / f"pexels_{video['id']}.mp4"
    if out.exists():
        return out

    # Attribution isn't required by the Pexels licence but is decent practice,
    # and it's the only record of where a clip came from if a question is ever
    # asked about it.
    (CACHE / f"pexels_{video['id']}.txt").write_text(
        f"{video.get('url', '')}\nby {video.get('user', {}).get('name', 'unknown')}\n"
    )
    urllib.request.urlretrieve(f["link"], out)
    return out


def to_vertical(src: Path, dst: Path, seconds: float, start: float = 0.0) -> Path:
    """Crop to 1080x1920, trim, and strip audio.

    Audio is dropped deliberately: these get a trending track added in the
    Instagram app, and a stock clip's own ambience fighting that is worse than
    silence. Centre crop — portrait sources rarely need more thought than that.
    """
    subprocess.run(
        [
            "ffmpeg", "-y", "-v", "error", "-ss", str(start), "-t", str(seconds), "-i", str(src),
            "-vf", "scale=1080:1920:force_original_aspect_ratio=increase,"
                   "crop=1080:1920,setsar=1,fps=30",
            "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
            "-pix_fmt", "yuv420p", str(dst),
        ],
        check=True,
    )
    return dst


if __name__ == "__main__":
    import sys

    q = " ".join(sys.argv[1:]) or "woman morning window light calm"
    try:
        p = fetch(q)
    except MissingKey as e:
        print(e)
        raise SystemExit(1)
    print("downloaded", p)
