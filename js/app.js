(() => {
  "use strict";

  const IG_DM = "https://ig.me/m/as_tuas_chuteiras";
  const PAGE = 36;
  const HIDDEN_BRANDS = new Set(["Louis Vuitton", "Outras"]);

  const C = window.CATALOG || { items: [], surfaces: {} };
  // only football boots (no socks, bags, spikes…) and not the hidden brands
  const ITEMS = C.items.filter((i) => i.kind === "Chuteiras" && !HIDDEN_BRANDS.has(i.brand));
  const BY_ID = new Map(ITEMS.map((i) => [i.id, i]));
  const SURF = C.surfaces;
  const SURF_ORDER = ["FG", "SG", "AG", "MG", "TF", "IC"];
  const SURF_SHORT = { FG: "Relvado natural", SG: "Natural molhado", AG: "Sintético", MG: "Multi-piso", TF: "Turf / pelado", IC: "Futsal" };

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const img = (i, n) => `assets/img/${i.id}/${n}.webp`;
  const sizeRange = (i) => !i.sizes.length ? "—" : i.limited ? i.sizes.join(", ") : `${i.sizes[0]}–${i.sizes[i.sizes.length - 1]}`;
  const fullName = (i) => i.model + (i.generation && !/gera/.test(i.model) ? ` (${i.generation}.ª geração)` : "");
  const shortName = (i) => i.model.replace(new RegExp("^" + i.brand.split(" ")[0] + "\\s+", "i"), "");
  const surfLabel = (code) => (SURF[code] ? SURF[code].label : code);

  ITEMS.forEach((i) => {
    i._q = norm([i.model, i.brand, i.line, i.description, i.id, i.surfaces.join(" "), i.features.join(" "), i.generation ? `${i.generation} geracao` : ""].join(" "));
  });

  // ------------------------------------------------ theme (dark by default, light optional)
  const root = document.documentElement;
  $("#themeToggle").addEventListener("click", () => {
    const next = root.dataset.theme === "light" ? "dark" : "light";
    root.dataset.theme = next;
    try { localStorage.setItem("atc-theme", next); } catch (_) { /* private mode */ }
  });

  // ------------------------------------------------ state
  const state = { q: "", surfaces: new Set(), brand: null, lines: new Set(), size: null, height: null, laces: null, sort: "recent" };
  const HEIGHTS = { alto: "Cano alto", baixo: "Cano baixo" };
  const LACES = { com: "Com atacadores", sem: "Sem atacadores" };
  const heightOf = (i) => (i.features.includes("Cano alto") ? "alto" : "baixo");
  const lacesOf = (i) => (i.features.includes("Sem atacadores") ? "sem" : "com");
  const hasFilters = () => !!(state.q || state.surfaces.size || state.brand || state.lines.size || state.size || state.height || state.laces);
  let filtered = [];
  let shown = 0;
  let spotlight = false; // "Novidades" first

  function matches(i, skip) {
    if (skip !== "surfaces" && state.surfaces.size && !i.surfaces.some((s) => state.surfaces.has(s))) return false;
    if (skip !== "brand" && state.brand && i.brand !== state.brand) return false;
    if (skip !== "lines" && state.lines.size && !state.lines.has(i.line)) return false;
    if (skip !== "size" && state.size && !i.sizes.includes(state.size)) return false;
    if (skip !== "height" && state.height && heightOf(i) !== state.height) return false;
    if (skip !== "laces" && state.laces && lacesOf(i) !== state.laces) return false;
    if (state.q) {
      const words = norm(state.q).split(/\s+/).filter(Boolean);
      if (!words.every((w) => i._q.includes(w))) return false;
    }
    return true;
  }

  const countBy = (list, key) => list.reduce((m, i) => {
    const ks = Array.isArray(key(i)) ? key(i) : [key(i)];
    ks.forEach((k) => { if (k != null) m.set(k, (m.get(k) || 0) + 1); });
    return m;
  }, new Map());
  const ALL_BRANDS = [...countBy(ITEMS, (i) => i.brand).entries()].sort((a, b) => b[1] - a[1]).map((e) => e[0]);

  // ------------------------------------------------ filter UI
  const CHECK = `<svg class="opt__check" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 16.2l-3.5-3.5L4 14.2l5 5 11-11-1.5-1.4z"/></svg>`;
  function opt({ label, value, count, pressed }) {
    return `<button type="button" class="opt" data-value="${esc(value)}" aria-pressed="${pressed}" ${!count && !pressed ? "disabled" : ""}>
      <span class="opt__label">${esc(label)}</span><span class="opt__n">${count}</span>${CHECK}</button>`;
  }
  function ptile(code, count, pressed) {
    return `<button type="button" class="ptile" data-value="${code}" aria-pressed="${pressed}" ${!count && !pressed ? "disabled" : ""} style="--c:var(--s-${code})" title="${esc(SURF[code].help)}">
      <span class="ptile__code">${code}</span><span class="ptile__label">${SURF_SHORT[code] || esc(SURF[code].label)}</span><span class="ptile__n">${count}</span></button>`;
  }
  const BRANDS_SHOWN = 6;
  let showAllBrands = false;
  const setN = (id, n) => { $(id).textContent = n ? `(${n})` : ""; };

  function renderFilters() {
    const sc = countBy(ITEMS.filter((i) => matches(i, "surfaces")), (i) => i.surfaces);
    $("#fSurface").innerHTML = SURF_ORDER.filter((s) => SURF[s]).map((s) => ptile(s, sc.get(s) || 0, state.surfaces.has(s))).join("");
    setN("#nSurface", state.surfaces.size);

    const bc = countBy(ITEMS.filter((i) => matches(i, "brand")), (i) => i.brand);
    const visible = showAllBrands ? ALL_BRANDS : ALL_BRANDS.filter((b, k) => k < BRANDS_SHOWN || b === state.brand);
    $("#fBrand").innerHTML = visible.map((b) => opt({ label: b, value: b, count: bc.get(b) || 0, pressed: state.brand === b })).join("")
      + (ALL_BRANDS.length > BRANDS_SHOWN ? `<button type="button" class="more" data-more>${showAllBrands ? "Menos marcas" : `+ Mais marcas (${ALL_BRANDS.length - visible.length})`}</button>` : "");
    setN("#nBrand", state.brand ? 1 : 0);

    if (!state.brand) {
      $("#fLine").innerHTML = `<p class="hint">Escolhe primeiro uma marca.</p>`;
    } else {
      const lc = countBy(ITEMS.filter((i) => matches(i, "lines")), (i) => i.line);
      const lines = [...lc.entries()].filter((e) => e[0]).sort((a, b) => b[1] - a[1]).map((e) => e[0]);
      state.lines.forEach((l) => { if (!lines.includes(l)) lines.push(l); });
      $("#fLine").innerHTML = lines.map((l) => opt({ label: l, value: l, count: lc.get(l) || 0, pressed: state.lines.has(l) })).join("")
        || `<p class="hint">Sem modelos para esta seleção.</p>`;
    }
    setN("#nLine", state.lines.size);

    const zc = countBy(ITEMS.filter((i) => matches(i, "size")), (i) => i.sizes);
    const allSizes = [...new Set(ITEMS.flatMap((i) => i.sizes))].sort((a, b) => a - b);
    $("#fSize").innerHTML = allSizes.map((z) => `<button type="button" class="size" data-value="${z}" aria-pressed="${state.size === z}" ${!zc.get(z) && state.size !== z ? "disabled" : ""}>${z}</button>`).join("");
    setN("#nSize", state.size ? 1 : 0);

    const hc = countBy(ITEMS.filter((i) => matches(i, "height")), heightOf);
    $("#fHeight").innerHTML = Object.entries(HEIGHTS).map(([k, l]) => opt({ label: l, value: k, count: hc.get(k) || 0, pressed: state.height === k })).join("");
    setN("#nHeight", state.height ? 1 : 0);
    const ac = countBy(ITEMS.filter((i) => matches(i, "laces")), lacesOf);
    $("#fLaces").innerHTML = Object.entries(LACES).map(([k, l]) => opt({ label: l, value: k, count: ac.get(k) || 0, pressed: state.laces === k })).join("");
    setN("#nLaces", state.laces ? 1 : 0);

    const pills = [];
    state.surfaces.forEach((s) => pills.push(["surfaces", s, `${s} · ${surfLabel(s)}`]));
    if (state.brand) pills.push(["brand", state.brand, state.brand]);
    state.lines.forEach((l) => pills.push(["lines", l, l]));
    if (state.size) pills.push(["size", state.size, `Tamanho ${state.size}`]);
    if (state.height) pills.push(["height", state.height, HEIGHTS[state.height]]);
    if (state.laces) pills.push(["laces", state.laces, LACES[state.laces]]);
    $("#active").innerHTML = pills.map(([k, v, l]) => `<button type="button" class="chip" data-remove="${k}" data-value="${esc(v)}">${esc(l)} ✕</button>`).join("")
      + (pills.length > 1 ? `<button type="button" class="chip chip--clear" data-clear>Limpar tudo</button>` : "");
    $("#filterBadge").textContent = pills.length;
    $("#filterBadge").hidden = !pills.length;
  }

  const toggleSet = (set, v) => (set.has(v) ? set.delete(v) : set.add(v));
  const onBtn = (id, sel, fn) => $(id).addEventListener("click", (e) => { const b = e.target.closest(sel); if (b) { fn(b.dataset.value); update(); } });
  onBtn("#fSurface", ".ptile", (v) => toggleSet(state.surfaces, v));
  onBtn("#fLine", ".opt", (v) => toggleSet(state.lines, v));
  onBtn("#fHeight", ".opt", (v) => { state.height = state.height === v ? null : v; });
  onBtn("#fLaces", ".opt", (v) => { state.laces = state.laces === v ? null : v; });
  onBtn("#fSize", ".size", (v) => { const z = +v; state.size = state.size === z ? null : z; });
  $("#fBrand").addEventListener("click", (e) => {
    if (e.target.closest("[data-more]")) { showAllBrands = !showAllBrands; renderFilters(); return; }
    const b = e.target.closest(".opt"); if (!b) return;
    state.brand = state.brand === b.dataset.value ? null : b.dataset.value;
    state.lines.clear(); // models belong to the chosen brand
    update();
  });
  $("#active").addEventListener("click", (e) => {
    if (e.target.closest("[data-clear]")) return clearAll();
    const b = e.target.closest("[data-remove]"); if (!b) return;
    const k = b.dataset.remove, v = b.dataset.value;
    if (state[k] instanceof Set) state[k].delete(v);
    else { state[k] = null; if (k === "brand") state.lines.clear(); }
    update();
  });
  let qTimer;
  $("#q").addEventListener("input", (e) => { clearTimeout(qTimer); qTimer = setTimeout(() => { state.q = e.target.value.trim(); update(); }, 160); });
  $("#sort").addEventListener("change", (e) => { state.sort = e.target.value; update(); });

  function clearAll() {
    state.surfaces.clear(); state.brand = null; state.lines.clear(); state.size = null; state.height = null; state.laces = null;
    state.q = ""; $("#q").value = "";
    update();
  }
  $("#clearFilters").addEventListener("click", clearAll);
  $("#emptyClear").addEventListener("click", clearAll);

  // filters: bottom sheet on mobile, sidebar (hide/show) on desktop
  const sheet = $("#filters"), scrim = $("#scrim");
  const desktop = () => window.matchMedia("(min-width: 1000px)").matches;
  function openSheet() { sheet.classList.add("open"); scrim.hidden = false; document.body.classList.add("lock"); }
  function closeSheet() { sheet.classList.remove("open"); scrim.hidden = true; document.body.classList.remove("lock"); }
  function syncFilterBtn() { $("#filtersLabel").textContent = desktop() ? ($(".layout").classList.contains("nofilters") ? "Mostrar filtros" : "Ocultar filtros") : "Filtros"; }
  $("#openFilters").addEventListener("click", () => { if (desktop()) { $(".layout").classList.toggle("nofilters"); syncFilterBtn(); } else openSheet(); });
  $("#closeFilters").addEventListener("click", closeSheet);
  $("#applyFilters").addEventListener("click", () => { closeSheet(); $(".results").scrollIntoView({ behavior: "smooth" }); });
  scrim.addEventListener("click", closeSheet);

  // ------------------------------------------------ results
  const SORTS = {
    recent: (a, b) => a.order - b.order,
    brand: (a, b) => a.brand.localeCompare(b.brand) || a.model.localeCompare(b.model) || a.order - b.order,
    model: (a, b) => a.model.localeCompare(b.model) || a.order - b.order,
  };

  function update() {
    stopVideo();
    filtered = ITEMS.filter((i) => matches(i)).sort(SORTS[state.sort]);
    // no filters/search + default order → "Novidades" first
    spotlight = !hasFilters() && state.sort === "recent" && filtered.some((i) => i.new);
    if (spotlight) filtered = [...filtered.filter((i) => i.new), ...filtered.filter((i) => !i.new)];
    shown = 0;
    $("#grid").innerHTML = "";
    renderMore();
    renderFilters();
    const n = filtered.length;
    $("#count").innerHTML = `<b>${n.toLocaleString("pt-PT")}</b> ${n === 1 ? "chuteira" : "chuteiras"}`;
    $("#applyCount").textContent = n.toLocaleString("pt-PT");
    $("#empty").hidden = n > 0;
  }

  function card(i) {
    const tags = i.surfaces.map((s) => `<span class="tag tag--surface" style="--c:var(--s-${s})">${s}</span>`).join("")
      + (i.new ? `<span class="tag tag--new">Novo</span>` : "")
      + (i.limited ? `<span class="tag tag--last">Últimos</span>` : "")
      + (i.video ? `<span class="tag tag--video"><svg viewBox="0 0 10 10"><path d="M2 1l7 4-7 4z"/></svg>Vídeo</span>` : "");
    return `<button type="button" class="card" data-id="${i.id}" aria-label="${esc(fullName(i))}">
      <div class="card__img">
        <img src="${img(i, "t")}" alt="${esc(i.model)}" loading="lazy" decoding="async" width="480" height="480">
        <div class="card__tags">${tags}</div>
      </div>
      <div class="card__body">
        <p class="card__brand">${esc(i.brand)}${i.generation ? ` · ${i.generation}.ª geração` : ""}</p>
        <h3 class="card__title">${esc(shortName(i))}</h3>
        <div class="card__meta"><span>${esc(i.surfaces.map(surfLabel).join(" · "))}</span><span>Tam. <b>${sizeRange(i)}</b></span></div>
      </div>
    </button>`;
  }

  const newCount = () => filtered.filter((i) => i.new).length;
  function section(title, sub) {
    return `<div class="grid__head"><h2>${title}</h2>${sub ? `<span>${sub}</span>` : ""}</div>`;
  }
  function renderMore() {
    const next = filtered.slice(shown, shown + PAGE);
    if (!next.length) return;
    let html = "";
    next.forEach((i, k) => {
      const idx = shown + k;
      if (spotlight && idx === 0) html += section("Novidades", `${newCount()} acabadas de chegar`);
      if (spotlight && !i.new && (idx === 0 || filtered[idx - 1].new)) html += section("Todo o catálogo", "");
      html += card(i);
    });
    $("#grid").insertAdjacentHTML("beforeend", html);
    shown += next.length;
  }
  new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting) && shown < filtered.length) renderMore();
  }, { rootMargin: "900px" }).observe($("#sentinel"));
  $("#grid").addEventListener("click", (e) => { const c = e.target.closest(".card"); if (c) openProduct(c.dataset.id); });

  // card video: photo first; the video plays only while the mouse is over the card
  // (or the finger touches it on mobile), one at a time
  let activeVid = null;
  const vidObs = new IntersectionObserver((entries) => entries.forEach((e) => { if (!e.isIntersecting && e.target === activeVid) stopVideo(); }), { threshold: 0.3 });
  function playVideo(cardEl) {
    const i = BY_ID.get(cardEl.dataset.id);
    if (!i || !i.video) return;
    let v = cardEl.querySelector("video");
    if (!v) {
      v = document.createElement("video");
      Object.assign(v, { muted: true, loop: true, playsInline: true, preload: "auto", src: i.video });
      v.setAttribute("playsinline", ""); v.setAttribute("muted", ""); v.disablePictureInPicture = true;
      v.addEventListener("playing", () => { if (v === activeVid) v.classList.add("on"); });
      cardEl.querySelector(".card__img").insertBefore(v, cardEl.querySelector(".card__tags"));
      vidObs.observe(v);
    }
    if (activeVid && activeVid !== v) stopVideo();
    activeVid = v;
    v.muted = true;
    v.play().catch(() => {});
    if (v.readyState >= 3) v.classList.add("on");
  }
  function stopVideo() {
    if (!activeVid) return;
    activeVid.pause();
    activeVid.classList.remove("on");
    activeVid = null;
  }
  $("#grid").addEventListener("pointerover", (e) => {
    if (e.pointerType !== "mouse") return;
    const c = e.target.closest(".card");
    if (c && !c.contains(e.relatedTarget)) playVideo(c);
  });
  $("#grid").addEventListener("pointerout", (e) => {
    if (e.pointerType !== "mouse") return;
    const c = e.target.closest(".card");
    if (c && !c.contains(e.relatedTarget) && activeVid && c.contains(activeVid)) stopVideo();
  });
  $("#grid").addEventListener("touchstart", (e) => { const c = e.target.closest(".card"); if (c) playVideo(c); }, { passive: true });

  // ------------------------------------------------ product modal
  const modal = $("#modal");
  let current = null, pickedSize = null;

  function openProduct(id, push = true) {
    const i = BY_ID.get(id);
    if (!i) return;
    stopVideo();
    current = i;
    pickedSize = state.size && i.sizes.includes(state.size) ? state.size : null;

    // in the detail the video always comes first
    const slides = [];
    if (i.video) slides.push(`<div class="slide"><video src="${esc(i.video)}" poster="${img(i, 0)}" muted autoplay loop playsinline preload="auto" disablepictureinpicture></video></div>`);
    for (let n = 0; n < i.photos; n++) slides.push(`<div class="slide"><img src="${img(i, n)}" alt="${esc(i.model)} — foto ${n + 1}" ${n ? 'loading="lazy"' : ""}></div>`);
    $("#mSlides").innerHTML = slides.join("");
    $("#mSlides").scrollLeft = 0;
    $("#mDots").innerHTML = slides.map((_, n) => `<button type="button" aria-label="Ir para ${n + 1}" class="${n === 0 ? "on" : ""}" data-n="${n}"></button>`).join("");
    const multi = slides.length > 1;
    $("#mPrev").hidden = $("#mNext").hidden = $("#mDots").hidden = !multi;
    const v = $("#mSlides video");
    if (v) { v.muted = true; v.volume = 0; v.play().catch(() => {}); }

    $("#mBrand").textContent = [i.brand, i.line].filter(Boolean).join(" · ");
    $("#mTitle").textContent = shortName(i);
    $("#mBadges").innerHTML = (i.new ? `<span class="tag tag--new">Novidade</span>` : "") + (i.limited ? `<span class="tag tag--last">Últimos pares</span>` : "");
    const surf = i.surfaces.map((s) => `<span class="tile__code" style="--c:var(--s-${s})">${s}</span> ${esc(surfLabel(s))}`).join("<br>");
    $("#mTiles").innerHTML = [
      ["Marca", esc(i.brand)],
      ["Geração", i.generation ? `${i.generation}.ª` : "—"],
      ["Piso", surf || "—"],
      ["Tamanhos", i.sizes.length ? sizeRange(i) : "Pergunta-nos"],
    ].map(([k, val]) => `<div class="tile"><span>${k}</span><b>${val}</b></div>`).join("");
    $("#mFeats").innerHTML = i.features.map((f) => `<span>${esc(f)}</span>`).join("");
    renderSizePick();

    if (!modal.open) { modal.showModal(); document.body.classList.add("lock"); }
    $(".modal__box").scrollTop = 0;
    if (push) history.pushState({ id }, "", `#/c/${id}`);
    document.title = `${fullName(i)} — As Tuas Chuteiras`;
  }

  function renderSizePick() {
    const i = current;
    $("#mSizes").innerHTML = i.sizes.length
      ? i.sizes.map((z) => `<button type="button" class="size" data-value="${z}" aria-pressed="${pickedSize === z}">${z}</button>`).join("")
      : `<p class="muted" style="margin:0">Indica o teu tamanho na mensagem.</p>`;
    $("#mOrderLabel").textContent = pickedSize ? `Pedir tamanho ${pickedSize} no Instagram` : "Pedir no Instagram";
  }
  $("#mSizes").addEventListener("click", (e) => {
    const b = e.target.closest(".size"); if (!b) return;
    const z = +b.dataset.value; pickedSize = pickedSize === z ? null : z; renderSizePick();
  });

  function closeProduct(fromHistory = false) {
    if (!modal.open) return;
    $("#mSlides").innerHTML = "";
    modal.close();
    document.body.classList.remove("lock");
    document.title = "As Tuas Chuteiras — Catálogo";
    if (!fromHistory && location.hash.startsWith("#/c/")) history.back();
  }
  $("#mClose").addEventListener("click", () => closeProduct());
  modal.addEventListener("cancel", (e) => { e.preventDefault(); closeProduct(); });
  modal.addEventListener("click", (e) => { if (e.target === modal) closeProduct(); });

  const slidesEl = $("#mSlides");
  const go = (d) => slidesEl.scrollBy({ left: d * slidesEl.clientWidth, behavior: "smooth" });
  $("#mPrev").addEventListener("click", () => go(-1));
  $("#mNext").addEventListener("click", () => go(1));
  $("#mDots").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) slidesEl.scrollTo({ left: +b.dataset.n * slidesEl.clientWidth, behavior: "smooth" }); });
  slidesEl.addEventListener("scroll", () => {
    const n = Math.round(slidesEl.scrollLeft / slidesEl.clientWidth);
    $$("#mDots button").forEach((d, k) => d.classList.toggle("on", k === n));
  }, { passive: true });

  function orderMessage(i) {
    return [
      "Olá! 👋 Tenho interesse nesta chuteira:",
      `• ${fullName(i)}`,
      i.surfaces.length ? `• Piso: ${i.surfaces.map((s) => `${s} (${surfLabel(s)})`).join(" / ")}` : null,
      `• Tamanho: ${pickedSize || "?"}`,
      `• Ref.: ${i.id}`,
      `• Link: ${location.origin && location.origin !== "null" ? location.origin + location.pathname : ""}#/c/${i.id}`,
      "Está disponível? Obrigado!",
    ].filter(Boolean).join("\n");
  }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (_) { /* fallback */ }
    const ta = document.createElement("textarea");
    ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand("copy"); } catch (_) { ok = false; }
    ta.remove(); return ok;
  }
  $("#mOrder").addEventListener("click", () => {
    if (!current) return;
    if (current.sizes.length && !pickedSize) {
      toast("Escolhe primeiro o teu tamanho 👟");
      $("#mSizes").scrollIntoView({ behavior: "smooth", block: "center" });
      $("#mSizes").animate([{ transform: "translateX(0)" }, { transform: "translateX(-6px)" }, { transform: "translateX(6px)" }, { transform: "translateX(0)" }], { duration: 300 });
      return;
    }
    copy(orderMessage(current));
    toast("Mensagem copiada! Cola-a na conversa do Instagram ✅", 4500);
    window.open(IG_DM, "_blank", "noopener");
  });
  $("#mShare").addEventListener("click", async () => {
    if (!current) return;
    const url = `${location.origin}${location.pathname}#/c/${current.id}`;
    if (navigator.share) { try { await navigator.share({ title: `${fullName(current)} — As Tuas Chuteiras`, url }); } catch (_) { /* cancelled */ } return; }
    copy(url); toast("Link copiado!");
  });

  // ------------------------------------------------ size guide (EU-based)
  const sg = $("#sg");
  const SG = window.SIZE_GUIDE || {};
  const SG_TABS = ["Nike", "Adidas", "Puma", "Mizuno", "New Balance", "Asics", "Medidas"].filter((k) => SG[k]);
  const sgBrandFor = (b) => (b === "Supreme x Nike" ? "Nike" : SG[b] ? b : "Medidas");
  let sgBrand = "Nike", sgGroup = null, sgPick = null;
  function renderSG() {
    const data = SG[sgBrand];
    const groups = Object.keys(data.groups);
    if (!groups.includes(sgGroup)) sgGroup = groups[0];
    $("#sgTabs").innerHTML = SG_TABS.map((k) => `<button type="button" data-v="${k}" aria-pressed="${k === sgBrand}">${k === "Medidas" ? "Outras marcas" : k}</button>`).join("");
    $("#sgGroups").innerHTML = groups.length > 1 ? groups.map((g) => `<button type="button" data-v="${g}" aria-pressed="${g === sgGroup}">${g}</button>`).join("") : "";
    const tb = data.groups[sgGroup];
    $("#sgBody").innerHTML = `<table><thead><tr>${tb.head.map((h) => `<th scope="col">${h}</th>`).join("")}</tr></thead>
      <tbody>${tb.rows.map((r) => `<tr class="${sgPick && parseFloat(r[0]) === sgPick && !/[⅓⅔]/.test(r[0]) ? "is-pick" : ""}">${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
    $("#sgNote").innerHTML = data.note
      ? esc(data.note)
      : "<b>Como medir:</b> mede o pé do calcanhar à ponta do dedo maior e escolhe o tamanho cujo valor em CM é igual ou ligeiramente maior.";
    const row = $("#sgBody tr.is-pick");
    if (row) row.scrollIntoView({ block: "center" });
  }
  function openSG(brand) {
    if (brand) sgBrand = sgBrandFor(brand);
    sgGroup = null;
    sgPick = modal.open ? pickedSize : null;
    renderSG();
    sg.showModal();
    document.body.classList.add("lock");
  }
  $("#sgTabs").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { sgBrand = b.dataset.v; sgGroup = null; renderSG(); } });
  $("#sgGroups").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { sgGroup = b.dataset.v; renderSG(); } });
  $("#sgClose").addEventListener("click", () => sg.close());
  sg.addEventListener("click", (e) => { if (e.target === sg) sg.close(); });
  sg.addEventListener("close", () => { if (!modal.open) document.body.classList.remove("lock"); if (location.hash === "#/tamanhos") history.replaceState(null, "", location.pathname); });
  $$("[data-size-guide]").forEach((b) => b.addEventListener("click", () => openSG(modal.open && current ? current.brand : null)));
  document.addEventListener("keydown", (e) => {
    if (!modal.open || sg.open) return;
    if (e.key === "ArrowRight") go(1);
    if (e.key === "ArrowLeft") go(-1);
  });

  // ------------------------------------------------ cards per row
  const VIEWS = [
    { max: 639, opts: [1, 2], def: 2 },
    { max: 999, opts: [2, 3], def: 3 },
    { max: Infinity, opts: [4, 6], def: 4 },
  ];
  const ICON_BIG = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/></svg>`;
  const ICON_MANY = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="3.6" height="18" rx="1.2"/><rect x="7.8" y="3" width="3.6" height="18" rx="1.2"/><rect x="12.6" y="3" width="3.6" height="18" rx="1.2"/><rect x="17.4" y="3" width="3.6" height="18" rx="1.2"/></svg>`;
  const ICON_ONE = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2"/></svg>`;
  const viewIcon = (n, idx) => (n === 1 ? ICON_ONE : idx === 0 || n === 2 ? ICON_BIG : ICON_MANY);
  let viewMode = null;
  const storeKey = (m) => `atc-cols-${m.max}`;
  function applyView() {
    const m = VIEWS.find((v) => window.innerWidth <= v.max);
    let cols = m.def;
    try { const saved = +localStorage.getItem(storeKey(m)); if (m.opts.includes(saved)) cols = saved; } catch (_) { /* no storage */ }
    $("#grid").style.setProperty("--cols", cols);
    $("#grid").dataset.cols = cols;
    if (viewMode !== m) {
      viewMode = m;
      $("#view").innerHTML = m.opts.map((n, k) => `<button type="button" data-cols="${n}" title="${n} por linha" aria-label="${n} por linha">${viewIcon(n, k)}</button>`).join("");
    }
    $$("#view button").forEach((b) => b.setAttribute("aria-pressed", +b.dataset.cols === cols));
    syncFilterBtn();
  }
  $("#view").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    try { localStorage.setItem(storeKey(viewMode), b.dataset.cols); } catch (_) { /* no storage */ }
    applyView();
  });
  let rz; window.addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(applyView, 120); });

  // ------------------------------------------------ piso explainer (rotating sole animation)
  const SOLE = "M14,46 C14,26 34,17 62,19 C84,21 98,29 120,25 C152,17 190,13 212,27 C224,35 224,57 212,65 C190,79 152,75 120,67 C98,63 84,71 62,73 C34,75 14,66 14,46 Z";
  const inFore = (x, y) => ((x - 168) / 50) ** 2 + ((y - 46) / 24) ** 2 < 0.78;
  const inHeel = (x, y) => ((x - 44) / 28) ** 2 + ((y - 46) / 23) ** 2 < 0.72;
  const inMid = (x, y) => x > 70 && x < 122 && Math.abs(y - 46) < 15;
  const grid = (step, test) => { const p = []; for (let x = 18; x < 222; x += step) for (let y = 20; y < 74; y += step) if (test(x, y)) p.push([x, y]); return p; };
  const STUDS = {
    FG: { r: 4.6, pts: [[132, 34], [132, 58], [156, 29], [156, 63], [182, 29], [182, 63], [204, 46], [33, 35], [33, 57], [58, 31], [58, 61]] },
    SG: { r: 6.5, metal: true, pts: [[136, 33], [136, 59], [180, 30], [180, 62], [36, 36], [36, 56]] },
    AG: { r: 3.6, pts: grid(12, (x, y) => inFore(x, y) || inHeel(x, y)) },
    MG: { r: 3, pts: grid(9.5, (x, y) => inFore(x, y) || inHeel(x, y)) },
    TF: { r: 1.7, pts: grid(5.6, (x, y) => inFore(x, y) || inHeel(x, y) || inMid(x, y)) },
  };
  const PISO_TEXT = {
    FG: "Pitons para relvado natural seco ou firme. A escolha mais comum para jogar em relva.",
    SG: "Pitons de alumínio, mais compridos, para relvado natural macio ou molhado.",
    AG: "Pitons mais curtos e numerosos, feitos para relvado sintético de pelo comprido.",
    MG: "Pitons curtos que funcionam bem tanto em relvado natural como sintético.",
    TF: "Pequenos pitons de borracha para relva sintética curta, pelado e superfícies duras.",
    IC: "Sola lisa de borracha para futsal e pavilhão.",
  };
  function drawSole(code) {
    let inner = `<defs><linearGradient id="metal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f0f0f0"/><stop offset=".5" stop-color="#9a9a9a"/><stop offset="1" stop-color="#dcdcdc"/></linearGradient></defs><path class="sole" d="${SOLE}"/>`;
    if (code === "IC") {
      for (let x = 26; x < 214; x += 9) {
        const ok = (y) => inFore(x, y) || inHeel(x, y) || inMid(x, y);
        if (ok(46)) inner += `<path class="tread" style="animation-delay:${((x / 214) * 0.4).toFixed(2)}s" d="M${x},${ok(30) ? 30 : 38} l5,8 l-5,8 l5,8 ${ok(62) ? "l-5,8" : ""}"/>`;
      }
      inner += `<circle class="tread" cx="168" cy="46" r="10"/><circle class="tread" cx="168" cy="46" r="16"/>`;
    } else {
      const s = STUDS[code];
      inner += s.pts.map(([x, y], k) => `<circle class="stud ${s.metal ? "stud--metal" : ""}" cx="${x}" cy="${y}" r="${s.r}" style="animation-delay:${Math.min(k * (0.5 / s.pts.length), 0.5).toFixed(3)}s"/>`).join("");
    }
    $("#pisoSole").innerHTML = inner;
  }
  let pisoIdx = 0, pisoTimer;
  const PISO_MS = 5000;
  function showPiso(k) {
    pisoIdx = (k + SURF_ORDER.length) % SURF_ORDER.length;
    const code = SURF_ORDER[pisoIdx];
    $("#piso").style.setProperty("--c", `var(--s-${code})`);
    drawSole(code);
    $("#pisoCode").textContent = code;
    $("#pisoLabel").textContent = SURF[code] ? SURF[code].label : "";
    $("#pisoHelp").textContent = PISO_TEXT[code];
    $("#pisoGo").textContent = `Ver chuteiras ${code} →`;
    $("#pisoGo").dataset.code = code;
    $$(".piso__text p").forEach((p) => { p.style.animation = "none"; void p.offsetWidth; p.style.animation = ""; });
    $("#pisoDots").innerHTML = SURF_ORDER.map((c, i) => `<button type="button" data-k="${i}" aria-pressed="${i === pisoIdx}" aria-label="${c}" style="--c:var(--s-${c})">${c}</button>`).join("");
    const bar = $("#pisoBar");
    bar.classList.remove("run"); void bar.offsetWidth; bar.style.setProperty("--dur", `${PISO_MS}ms`); bar.classList.add("run");
  }
  function startPiso() {
    clearInterval(pisoTimer);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    pisoTimer = setInterval(() => { if (!$("#piso").matches(":hover")) showPiso(pisoIdx + 1); }, PISO_MS);
  }
  $("#pisoDots").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { showPiso(+b.dataset.k); startPiso(); } });
  $("#pisoGo").addEventListener("click", (e) => {
    state.surfaces.clear(); state.surfaces.add(e.currentTarget.dataset.code); update();
    $(".results").scrollIntoView({ behavior: "smooth" });
  });

  // ------------------------------------------------ toast
  let tTimer;
  function toast(msg, ms = 2600) {
    const t = $("#toast");
    t.textContent = msg; t.hidden = false;
    clearTimeout(tTimer); tTimer = setTimeout(() => { t.hidden = true; }, ms);
  }

  // ------------------------------------------------ routing (#/c/<id>, #/tamanhos)
  function route() {
    if (location.hash === "#/tamanhos") { if (!sg.open) openSG(null); return; }
    const m = location.hash.match(/^#\/c\/(\d+)/);
    if (m) openProduct(m[1], false);
    else closeProduct(true);
  }
  window.addEventListener("popstate", route);

  // ------------------------------------------------ stats + footer
  $("#stats").innerHTML = [
    [ITEMS.length, "chuteiras"],
    [ALL_BRANDS.length, "marcas"],
    [ITEMS.filter((i) => i.new).length, "novidades"],
  ].map(([n, l]) => `<div class="stat"><b>${n.toLocaleString("pt-PT")}</b><span>${l}</span></div>`).join("");
  if (C.updated) $("#updated").textContent = `Catálogo atualizado em ${C.updated.split(" ")[0].split("-").reverse().join("/")}`;

  applyView();
  update();
  showPiso(0);
  startPiso();
  route();
})();
