"""Turn the supplier's Chinese/English album titles into structured Portuguese data."""
import re

CN_NUM = {"一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9, "十": 10}


def cn_to_int(s):
    if s.isdigit():
        return int(s)
    if s == "十":
        return 10
    if s.startswith("十"):
        return 10 + CN_NUM.get(s[1:], 0)
    if "十" in s:
        a, _, b = s.partition("十")
        return CN_NUM.get(a, 1) * 10 + (CN_NUM.get(b, 0) if b else 0)
    return CN_NUM.get(s)


# ---------------------------------------------------------------- brands
BRANDS = [
    # (display name, patterns)
    ("Louis Vuitton", [r"LOUIS VUITTON"]),
    ("Supreme x Nike", [r"Supreme\s*x\s*Nike"]),
    ("New Balance", [r"New Balance"]),
    ("Mizuno", [r"Mizuno", r"美津浓", r"MORELIA"]),
    ("Puma", [r"Puma", r"彪马"]),
    ("Joma", [r"Joma", r"卓玛"]),
    ("Asics", [r"Asics", r"亚瑟士"]),
    ("Adidas", [r"adidas", r"didas", r"阿迪", r"PREDATOR", r"COPA", r"卡帕", r"X CRAZYFAST", r"猎鹰"]),
    ("Nike", [r"Nike", r"耐克", r"刺客", r"GX", r"Ronaldo", r"T90", r"Hypervenom", r"鬼牌", r"毒蜂"]),
]


def detect_brand(t):
    for name, pats in BRANDS:
        for p in pats:
            if re.search(p, t, re.I):
                return name
    return "Outras"


# ---------------------------------------------------------------- model lines (for filtering)
LINES = [
    ("Mercurial", [r"Mercurial", r"刺客", r"Superfly", r"Vapor (?:1|X|XI|XIV|XV)", r"\bR9\b", r"Ronaldo"]),
    ("Phantom", [r"Phantom(?! I\b| II\b)", r"幻影", r"月煞", r"GX"]),
    ("Hypervenom", [r"Hypervenom", r"毒蜂"]),
    ("Tiempo", [r"Tiempo", r"传奇"]),
    ("Magista", [r"Magista", r"鬼牌"]),
    ("T90", [r"T90"]),
    ("Gato", [r"Gato"]),
    ("Predator", [r"Predator", r"猎鹰", r"狂热者"]),
    ("F50", [r"F50"]),
    ("Copa", [r"COPA", r"卡帕"]),
    ("X", [r"\bX Speedportal", r"X CRAZYFAST", r"X系列"]),
    ("Top Sala", [r"Top Sala"]),
    ("Future", [r"FUTURE", r"未来", r"Mg钉"]),
    ("Ultra", [r"Ultra", r"\bUL\b"]),
    ("Morelia", [r"Morelia"]),
    ("Alpha", [r"Alpha", r"阿尔法"]),
    ("Furon", [r"Furon"]),
    ("Tekela", [r"TEKELA"]),
    ("Top Flex", [r"Top Flex"]),
    ("Maxfly", [r"Maxfly"]),
    ("Vapor Edge", [r"Vapor Edge", r"VaPOr Ede", r"橄榄球"]),
]


def detect_line(t):
    for name, pats in LINES:
        for p in pats:
            if re.search(p, t, re.I):
                return name
    return None


# ---------------------------------------------------------------- surfaces
# code -> (short label, explanation)
SURFACES = {
    "FG": ("Relvado natural", "FG – Firm Ground: pitons para relvado natural seco/firme."),
    "SG": ("Relvado natural molhado", "SG – Soft Ground: pitons (de alumínio) para relvado natural macio ou molhado."),
    "AG": ("Relvado sintético", "AG – Artificial Ground: pitons para relvado sintético de pelo comprido."),
    "MG": ("Multi-piso", "MG – Multi Ground: serve para relvado natural e sintético."),
    "TF": ("Sintético / Turf", "TF – Turf: pitons pequenos de borracha para relva sintética curta, pelado e superfícies duras."),
    "IC": ("Futsal / Pavilhão", "IC – Indoor Court: sola lisa para futsal e pavilhão."),
}


def detect_surfaces(prefix, body):
    t = f"{prefix} {body}"
    found = []

    def add(code):
        if code not in found:
            found.append(code)

    up = t.upper()
    if re.search(r"FG\s*/\s*AG", up):
        add("FG"); add("AG")
    if re.search(r"SG", up):
        add("SG")
    if re.search(r"(?<![A-Z])FG|FG钉|长钉|天然硬草地", t, re.I):
        add("FG")
    if re.search(r"(?<![A-Z])AG(?![A-Z])", up):
        add("AG")
    if re.search(r"(?<![A-Z])MG(?![A-Z])|MG钉", up):
        add("MG")
    if re.search(r"(?<![A-Z])TF|TURF|碎钉|草钉", t, re.I):
        add("TF")
    if re.search(r"(?<![A-Z])IC(?![A-Z])|室内|平底|Top Sala|Gato", t, re.I):
        add("IC")
    # Prefix explicitly says AG/SG ("到货AG39-45") -> that is the real sole of this album
    pm = re.search(r"(AG|SG)\s*\d", prefix.upper())
    if pm:
        found = [pm.group(1)]
    # an album with both FG and AG where the English says only AG (e.g. 针织FG … Elite AG)
    return found


# ---------------------------------------------------------------- product type
def detect_kind(t):
    if re.search(r"尺码对照表", t):
        return "sizechart"
    if re.search(r"背袋", t):
        return "Saco"
    if re.search(r"袜", t):
        return "Meias"
    if re.search(r"田径|短跑|Maxfly", t, re.I):
        return "Bicos de atletismo"
    if re.search(r"橄榄球", t):
        return "Chuteiras de futebol americano"
    return "Chuteiras"


# ---------------------------------------------------------------- features
FEATURES = [
    (r"儿童", "Criança"),
    (r"无鞋带|无绑带|Laceless(?! TF 36-45)|\bLL\b|ACCURACY\+", "Sem atacadores"),
    (r"有鞋带|系带", "Com atacadores"),
    (r"全针织", "Malha integral (knit)"),
    (r"(?<!全)针织", "Malha (knit)"),
    (r"梭织", "Tecido entrançado"),
    (r"超纤", "Microfibra"),
    (r"高帮|Superfly|MID", "Cano alto"),
    (r"低帮", "Cano baixo"),
    (r"防水", "Impermeável"),
    (r"全气垫", "Câmara de ar Air Zoom integral"),
    (r"(?<!全)气垫", "Câmara de ar"),
    (r"反舌|翻盖", "Língua dobrável"),
    (r"开舌", "Língua aberta"),
    (r"可拆卸|SG-PRO", "Pitons amovíveis"),
    (r"分离式鞋底", "Sola dividida"),
    (r"电镀", "Acabamento metalizado"),
    (r"MD底|MD原装", "Sola MD"),
    (r"KPU", "Cabedal KPU"),
    (r"Made in Japan|日产", "Made in Japan"),
    (r"女足世界杯", "Edição Mundial Feminino"),
    (r"(?<!女足)世界杯|World Cup", "Edição Mundial"),
    (r"欧洲杯", "Edição Euro"),
    (r"限量", "Edição limitada"),
    (r"复刻", "Reedição / retro"),
    (r"复古|94", "Retro"),
    (r"Bonded Pack", "Bonded Pack"),
    (r"Lucent Pack", "Lucent Pack"),
    (r"IMPULSE PACK", "Impulse Pack"),
    (r"内马尔", "Edição Neymar"),
    (r"姆巴佩|\bKM\b", "Edição Mbappé"),
    (r"罗纳尔多|Ronaldo|\bR9\b", "Edição Ronaldo R9"),
    (r"变色龙|遇火变色", "Muda de cor com o calor"),
    (r"TPU后套", "Contraforte TPU"),
    (r"偏大", "Tamanho grande (escolher um número abaixo)"),
]


def detect_features(t):
    out = []
    for pat, label in FEATURES:
        if re.search(pat, t, re.I) and label not in out:
            out.append(label)
    if "Malha integral (knit)" in out and "Malha (knit)" in out:
        out.remove("Malha (knit)")
    if "Câmara de ar Air Zoom integral" in out and "Câmara de ar" in out:
        out.remove("Câmara de ar")
    if "Sem atacadores" in out and "Com atacadores" in out:
        # titles like "有鞋带 … Laceless": the Chinese is the reliable part
        out.remove("Sem atacadores")
    if "Edição Mundial Feminino" in out and "Edição Mundial" in out:
        out.remove("Edição Mundial")
    return out


# ---------------------------------------------------------------- generation (e.g. 刺客十七代, 猎鹰27代)
def detect_generation(t):
    m = re.search(r"(?:刺客|猎鹰|传奇|未来|鬼牌|毒蜂|蜻蜓|F50)\s*([0-9]{1,2}|[一二三四五六七八九十]{1,3})\s*(?:半)?\s*代", t)
    if m:
        n = cn_to_int(m.group(1))
        if n:
            return n
    m = re.search(r"猎鹰\s*(2[0-9])", t)
    if m:
        return int(m.group(1))
    return None


# ---------------------------------------------------------------- sizes
def _range(a, b):
    a, b = int(a), int(b)
    if 20 <= a <= b <= 50:
        return list(range(a, b + 1))
    return []


def detect_sizes(prefix, body):
    """Returns (sizes list, is_limited_stock)."""
    # "剩39 41 43" / "剩44和45" / "剩42-45" / "蓝色剩44，白色剩41"
    if "剩" in prefix:
        parts = re.findall(r"剩\s*([0-9\s和,，、\-]+)", prefix)
        sizes = set()
        for p in parts:
            r = re.search(r"(\d{2})\s*-\s*(\d{2})", p)
            if r:
                sizes.update(_range(*r.groups()))
            else:
                sizes.update(int(x) for x in re.findall(r"\d{2}", p))
        if sizes:
            return sorted(sizes), True
    for src in (prefix, body):
        r = re.search(r"(\d{2})\s*[-–]\s*(\d{2})", src)
        if r:
            s = _range(*r.groups())
            if s:
                return s, False
    return [], False


# ---------------------------------------------------------------- model name (English part of the title)
STOP = re.compile(r"\b(?:BOOTS?|足球鞋)\b", re.I)


def clean_model(body, brand):
    # keep the longest run of latin text
    runs = re.findall(r"[A-Za-z0-9][A-Za-z0-9 .+'/αβ\-]*[A-Za-z0-9+αβ]", body)
    runs = [r.strip() for r in runs if re.search(r"[A-Za-z]{2,}", r)]
    if not runs:
        return None
    best = max(runs, key=len)
    m = best
    # drop sizes / surface codes / noise at the end
    m = re.sub(r"\s*\b[A-Z]?\d{2}\s*-\s*\d{2}\b.*$", "", m)
    m = re.sub(r"(?i)\s*(?:W)?\d{2}-\d{2}$", "", m)
    m = re.sub(r"(?i)\b(?:FG\s*/\s*AG|FG|AG|SG-PRO|SG|TF|IC|MG|TURF|FT TURF)\b", "", m)
    m = re.sub(r"(?i)(?<=Elite)(?:TF|FG|AG|IC)", "", m)
    m = STOP.sub("", m)
    m = re.sub(r"\s{2,}", " ", m).strip(" -/.")
    if m.lower().startswith("didas "):
        m = "adidas " + m[6:]
    # normalise brand capitalisation at the start
    m = re.sub(r"(?i)^nike\b", "Nike", m)
    m = re.sub(r"(?i)^adidas\b", "Adidas", m)
    m = re.sub(r"(?i)^puma\b", "Puma", m)
    if brand and not m.lower().startswith(brand.lower().split()[0]):
        m = f"{brand} {m}"
    return tidy_model(m) if m else None


KEEP_UPPER = {"FG", "AG", "SG", "TF", "IC", "MG", "MDS", "SE", "KM", "SB", "LV", "R9", "XI", "XV", "XVI", "XIV", "IX", "II", "III", "IV", "V8", "V5", "XXV", "XXVI", "T90", "F50", "F50+", "X", "II+", "GX", "MD"}


def tidy_model(m):
    m = re.sub(r"(?i)VaPOr Ede", "Vapor Edge", m)
    m = re.sub(r"\bGX3\b", "Phantom GX III", m)
    m = re.sub(r"^Puma UL$", "Puma Ultra", m)
    # "Adidas 26 Predator" -> "Adidas Predator" (generation shown separately)
    m = re.sub(r"^(\w+) (2[0-9]) (Predator)", r"\1 \3", m)
    m = re.sub(r"\bLL\b", "Laceless", m)
    words = []
    for w in m.split():
        if w.isupper() and w not in KEEP_UPPER and len(w) >= 3 and not re.fullmatch(r"[IVX]+", w):
            w = w.capitalize()
        words.append(w)
    m = " ".join(words)
    m = re.sub(r"\bAIR\b", "Air", m)
    m = re.sub(r"^Nike Ronaldo$", "Nike Mercurial R9 Ronaldo", m)
    m = re.sub(r"\br9\b", "R9", m)
    m = re.sub(r"\bGX3\b", "Phantom GX III", m)
    return m.strip()


def fallback_model(body, brand, line, gen):
    bits = [brand] if brand != "Outras" else []
    if line:
        bits.append(line)
    if gen:
        bits.append(f"({gen}.ª geração)")
    return " ".join(bits) or "Chuteira"


ROMAN = {"XV": 15, "XVI": 16, "XIV": 14, "IX": 9, "XIII": 13}


def split_title(title):
    m = re.match(r"^([^）)]{0,30})[）)]\s*(.*)$", title)
    if m:
        return m.group(1), m.group(2)
    return "", title


def parse_title(title):
    prefix, body = split_title(title)
    full = f"{prefix} {body}"
    brand = detect_brand(full)
    line = detect_line(full)
    gen = detect_generation(full)
    kind = detect_kind(full)
    surfaces = detect_surfaces(prefix, body) if kind not in ("Saco", "Meias", "sizechart") else []
    sizes, limited = detect_sizes(prefix, body)
    features = detect_features(full)
    if "儿童" in full:
        kind = "Chuteiras" if kind == "Chuteiras" else kind
    model = clean_model(body, brand if brand != "Outras" else None) or fallback_model(body, brand, line, gen)
    if "儿童" in full and "Criança" not in model:
        model = f"{model} (Criança)" if model else "Chuteira de criança"
    return {
        "brand": brand,
        "line": line,
        "generation": gen,
        "kind": kind,
        "surfaces": surfaces,
        "sizes": sizes,
        "limited": limited,
        "features": features,
        "model": model,
        "new": prefix.startswith("新到货"),
    }


def describe(p):
    """Portuguese one-liner, e.g.
    'Disponível (tamanhos 39–45): Adidas Predator Elite (27.ª geração) – malha integral, sem atacadores, chuteiras FG (relvado natural).'"""
    if p["sizes"]:
        if p["limited"]:
            head = "Últimos pares (tamanho" + ("s " if len(p["sizes"]) > 1 else " ") + ", ".join(map(str, p["sizes"])) + ")"
        else:
            head = f"Disponível (tamanhos {p['sizes'][0]}–{p['sizes'][-1]})"
    else:
        head = "Disponível"
    name = p["model"]
    if p["generation"] and "geração" not in name:
        name += f" ({p['generation']}.ª geração)"
    feats = [f[0].lower() + f[1:] if not f.startswith(("Air", "Made", "Bonded", "Lucent", "Impulse", "Edição", "MD", "KPU", "TPU")) else f
             for f in p["features"] if f not in ("Criança",)]
    kind = p["kind"].lower() if p["kind"] != "sizechart" else ""
    if p["surfaces"]:
        codes = "/".join(p["surfaces"])
        labels = " e ".join(SURFACES[c][0].lower() for c in p["surfaces"])
        kind = f"{kind} {codes} ({labels})"
    tail = ", ".join(feats + [kind.strip()]) if kind.strip() else ", ".join(feats)
    return f"{head}: {name}" + (f" – {tail}." if tail else ".")
