#!/usr/bin/env python3
"""Build the "As Tuas Chuteiras" catalogue from the supplier's Yupoo shop.

    python3 scripts/scrape.py               # full refresh (list pages re-read, albums cached)
    python3 scripts/scrape.py --fresh       # also re-read every album page
    python3 scripts/scrape.py --photos 6    # photos kept per album (default 5)

Output:
    assets/img/<album id>/t.webp    card thumbnail (cover, 480px)
    assets/img/<album id>/<n>.webp  gallery photos (900px)
    data/catalog.js                 window.CATALOG = {...}  (used by index.html)
    data/catalog.json               same data, for other tools

Requires `cwebp` (brew install webp).
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import yupoo  # noqa: E402
from translate import parse_title, describe, SURFACES  # noqa: E402

ROOT = yupoo.ROOT
IMG_DIR = os.path.join(ROOT, "assets", "img")
DATA_DIR = os.path.join(ROOT, "data")


def log(*a):
    print(*a, flush=True)


def to_webp(raw, dest, width, quality):
    with tempfile.NamedTemporaryFile(suffix=".img", delete=False) as f:
        f.write(raw)
        src = f.name
    try:
        subprocess.run(["cwebp", "-quiet", "-q", str(quality), "-resize", str(width), "0",
                        "-metadata", "none", src, "-o", dest], check=True,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    finally:
        os.unlink(src)


def download_photo(base, ext, dest, width, quality, size="medium"):
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        return True
    try:
        raw = yupoo.fetch(f"{base}/{size}.{ext}", binary=True)
        if len(raw) < 2000:  # error page / placeholder
            raise RuntimeError("tiny")
        to_webp(raw, dest, width, quality)
        return True
    except Exception:
        # some albums only have the big variant
        try:
            raw = yupoo.fetch(f"{base}/big.{ext}", binary=True)
            to_webp(raw, dest, width, quality)
            return True
        except Exception as e:  # noqa: BLE001
            log("   ! photo failed", base, e)
            return False


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--fresh", action="store_true", help="re-download album pages")
    ap.add_argument("--photos", type=int, default=5, help="gallery photos per album")
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--limit", type=int, default=0, help="only N albums (testing)")
    ap.add_argument("--no-images", action="store_true")
    args = ap.parse_args()

    if not shutil.which("cwebp") and not args.no_images:
        sys.exit("cwebp não encontrado — instala com: brew install webp")

    # 1. list pages (always refreshed so new albums appear)
    log("» A ler a lista de álbuns…")
    first = yupoo.list_page(1, max_age_h=0.5)
    pages = yupoo.page_count(first)
    with ThreadPoolExecutor(4) as ex:
        texts = list(ex.map(lambda n: yupoo.list_page(n, max_age_h=0.5), range(1, pages + 1)))
    albums, seen = [], set()
    for t in texts:
        for a in yupoo.parse_list(t):
            if a["id"] not in seen:
                seen.add(a["id"])
                albums.append(a)
    if args.limit:
        albums = albums[: args.limit]
    log(f"  {pages} páginas, {len(albums)} álbuns")

    # 2. album pages
    log("» A ler cada álbum (fotos/vídeos)…")
    age = 0 if args.fresh else None

    def load(a):
        text = yupoo.album_page(a["id"], max_age_h=age)
        m = re.search(r'class="showalbumheader__gallerytitle">([^<]+)<', text)
        if m:
            import html as _h
            a["title"] = _h.unescape(m.group(1)).strip()
        a["media"] = yupoo.parse_album(text)
        return a

    done = 0
    with ThreadPoolExecutor(args.workers) as ex:
        futs = [ex.submit(load, a) for a in albums]
        for f in as_completed(futs):
            try:
                f.result()
            except Exception as e:  # noqa: BLE001
                log("   ! álbum falhou:", e)
            done += 1
            if done % 100 == 0:
                log(f"  {done}/{len(albums)}")

    # 3. structure + images
    log("» A traduzir e a preparar imagens…")
    items, size_chart = [], None
    jobs = []
    for order, a in enumerate(albums):
        media = a.get("media") or []
        photos = [m for m in media if m["type"] == "photo"]
        videos = [m["src"] for m in media if m["type"] == "video"]
        info = parse_title(a["title"])
        if info["kind"] == "sizechart":
            size_chart = a
            continue
        if not photos:
            continue
        # cover first, then album order
        cover_base = None
        if a.get("cover"):
            mm = re.match(r'(https://photo\.yupoo\.com/[^/]+/[0-9a-f]+)/', a["cover"])
            cover_base = mm.group(1) if mm else None
        ordered = sorted(photos, key=lambda p: 0 if p["base"] == cover_base else 1)
        chosen = ordered[: args.photos]
        d = os.path.join(IMG_DIR, a["id"])
        os.makedirs(d, exist_ok=True)
        jobs.append((chosen[0]["base"], chosen[0]["ext"], os.path.join(d, "t.webp"), 480, 70, "small"))
        for i, p in enumerate(chosen):
            jobs.append((p["base"], p["ext"], os.path.join(d, f"{i}.webp"), 900, 72, "medium"))
        info.update({
            "id": a["id"],
            "order": order,
            "title_original": a["title"],
            "description": describe(info),
            "photos": len(chosen),
            "photos_total": len(photos),
            "video": videos[0] if videos else None,
            "source": f"{yupoo.BASE}/albums/{a['id']}?uid=1",
        })
        items.append(info)

    if size_chart and size_chart.get("media"):
        p = next((m for m in size_chart["media"] if m["type"] == "photo"), None)
        if p:
            os.makedirs(os.path.join(ROOT, "assets"), exist_ok=True)
            jobs.append((p["base"], p["ext"], os.path.join(ROOT, "assets", "tabela-tamanhos.webp"), 1200, 80, "big"))

    if not args.no_images:
        log(f"  {len(jobs)} imagens (as já existentes são ignoradas)")
        ok = 0
        with ThreadPoolExecutor(args.workers) as ex:
            futs = [ex.submit(download_photo, *j) for j in jobs]
            for n, f in enumerate(as_completed(futs), 1):
                ok += bool(f.result())
                if n % 500 == 0:
                    log(f"  {n}/{len(jobs)}")
        log(f"  {ok}/{len(jobs)} imagens prontas")
        # drop photos that failed so the site never shows a broken image
        for it in items:
            d = os.path.join(IMG_DIR, it["id"])
            have = [i for i in range(it["photos"]) if os.path.exists(os.path.join(d, f"{i}.webp"))]
            for new, old in enumerate(have):  # close gaps so photos are 0..n-1
                if new != old:
                    os.replace(os.path.join(d, f"{old}.webp"), os.path.join(d, f"{new}.webp"))
            it["photos"] = len(have)
            if have and not os.path.exists(os.path.join(d, "t.webp")):
                shutil.copy(os.path.join(d, "0.webp"), os.path.join(d, "t.webp"))
        items = [it for it in items if it["photos"] > 0]

    # remove image folders of albums that disappeared from the supplier
    keep = {it["id"] for it in items}
    if os.path.isdir(IMG_DIR) and not args.limit:
        for name in os.listdir(IMG_DIR):
            if name not in keep and os.path.isdir(os.path.join(IMG_DIR, name)):
                shutil.rmtree(os.path.join(IMG_DIR, name))

    catalog = {
        "updated": time.strftime("%Y-%m-%d %H:%M"),
        "count": len(items),
        "surfaces": {k: {"label": v[0], "help": v[1]} for k, v in SURFACES.items()},
        "has_size_chart": os.path.exists(os.path.join(ROOT, "assets", "tabela-tamanhos.webp")),
        "items": items,
    }
    # private copy (with supplier title/link) – stays out of the published site
    os.makedirs(yupoo.CACHE, exist_ok=True)
    with open(os.path.join(yupoo.CACHE, "catalog_full.json"), "w", encoding="utf-8") as f:
        json.dump(catalog, f, ensure_ascii=False, indent=1)
    public = dict(catalog, items=[{k: v for k, v in it.items() if k not in ("title_original", "source", "photos_total")}
                                  for it in items])
    catalog = public
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(os.path.join(DATA_DIR, "catalog.json"), "w", encoding="utf-8") as f:
        json.dump(catalog, f, ensure_ascii=False)
    with open(os.path.join(DATA_DIR, "catalog.js"), "w", encoding="utf-8") as f:
        f.write("window.CATALOG = ")
        json.dump(catalog, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";\n")
    log(f"✔ Catálogo com {len(items)} artigos → data/catalog.js")


if __name__ == "__main__":
    main()
