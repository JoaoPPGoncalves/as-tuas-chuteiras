"""Low-level helpers to read the supplier's Yupoo catalogue (stdlib only)."""
import html
import os
import re
import time
import urllib.request
import urllib.error

SHOP = "lyzs88"
BASE = f"https://{SHOP}.x.yupoo.com"
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0 Safari/537.36")
# Yupoo photo CDN only serves images when the referer is the shop itself.
HEADERS = {"User-Agent": UA, "Referer": BASE + "/", "Accept-Language": "en-US,en;q=0.8"}

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, ".cache")


def fetch(url, binary=False, retries=3):
    last = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=40) as r:
                data = r.read()
            return data if binary else data.decode("utf-8", "replace")
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            last = e
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"failed {url}: {last}")


def cached_page(name, url, max_age_h=None):
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, name)
    if os.path.exists(path):
        age_h = (time.time() - os.path.getmtime(path)) / 3600
        if max_age_h is None or age_h < max_age_h:
            with open(path, encoding="utf-8") as f:
                return f.read()
    text = fetch(url)
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)
    return text


def list_page(n, max_age_h=None):
    return cached_page(f"list_{n}.html", f"{BASE}/albums?page={n}", max_age_h)


def page_count(text):
    m = re.search(r'name="page"[^>]*max="(\d+)"', text)
    return int(m.group(1)) if m else 1


def parse_list(text):
    """Return albums on a list page: id, title, category, cover, count."""
    out = []
    cat_names = {}
    for m in re.finditer(r'href="/photos/[^/]+/collections/(\d+)"[^>]*>([^<]+)<', text):
        cat_names[m.group(1)] = html.unescape(m.group(2)).strip()
    blocks = re.split(r'(?=<a\s+class="album3__main")', text)
    for b in blocks[1:]:
        m = re.search(r'data-album-id="(?:(\d+)-)?(\d+)"\s*title="([^"]*)"', b)
        if not m:
            continue
        cat, aid, title = m.group(1), m.group(2), html.unescape(m.group(3)).strip()
        cover = re.search(r'data-origin-src="([^"]+)"', b)
        cnt = re.search(r'album__photonumber">\s*(\d+)', b)
        out.append({
            "id": aid,
            "title": title,
            "category_id": cat,
            "category": cat_names.get(cat, ""),
            "cover": cover.group(1) if cover else None,
            "count": int(cnt.group(1)) if cnt else None,
        })
    return out


def album_page(aid, max_age_h=None):
    return cached_page(f"album_{aid}.html", f"{BASE}/albums/{aid}?uid=1", max_age_h)


def parse_album(text):
    """Return ordered media of an album: photos (base URL) and videos (mp4)."""
    media = []
    main = text.find('class="showalbum__imagecardwrap')
    if main < 0:
        main = 0
    for m in re.finditer(r'<div class="image__imagewrap" data-type="(photo|video)">(.*?)</div>',
                         text[main:], re.S):
        kind, inner = m.group(1), m.group(2)
        if kind == "video":
            p = re.search(r'data-path="([^"]+\.mp4)"', inner)
            t = re.search(r'data-origin-src="([^"]+)"', inner)
            if p:
                media.append({"type": "video",
                              "src": "https://uvd.yupoo.com" + p.group(1),
                              "thumb": t.group(1) if t else None})
        else:
            o = re.search(r'data-origin-src="([^"]+)"', inner)
            if o:
                url = o.group(1)
                if url.startswith("//"):
                    url = "https:" + url
                # https://photo.yupoo.com/<shop>/<hash>/<file>  ->  base for size variants
                b = re.match(r'(https://photo\.yupoo\.com/[^/]+/[0-9a-f]+)/', url)
                if b:
                    media.append({"type": "photo", "base": b.group(1), "ext": url.rsplit(".", 1)[-1]})
    return media
