(() => {
  "use strict";

  const IG_USER = "as_tuas_chuteiras";
  const IG_DM = `https://ig.me/m/${IG_USER}`;
  const PAGE = 36;

  const C = window.CATALOG || { items: [], surfaces: {} };
  const ITEMS = C.items;
  const SURF = C.surfaces;
  const SURF_ORDER = ["FG", "SG", "AG", "MG", "TF", "IC"];
  const KINDS = {
    boots: { label: "Chuteiras", test: (i) => i.kind === "Chuteiras" && !isKid(i) },
    kids: { label: "Criança", test: (i) => isKid(i) },
    other: { label: "Outros", test: (i) => i.kind !== "Chuteiras" },
  };

  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  function isKid(i) { return i.features.includes("Criança") || (i.sizes.length && i.sizes[i.sizes.length - 1] <= 36); }
  const img = (i, n) => `assets/img/${i.id}/${n}.webp`;
  const sizeRange = (i) => !i.sizes.length ? "—" : i.limited ? i.sizes.join(", ") : `${i.sizes[0]}–${i.sizes[i.sizes.length - 1]}`;
  const fullName = (i) => i.model + (i.generation && !/gera/.test(i.model) ? ` (${i.generation}.ª geração)` : "");
  const surfLabel = (code) => (SURF[code] ? SURF[code].label : code);

  // search index
  ITEMS.forEach((i) => {
    i._q = norm([i.model, i.brand, i.line, i.description, i.id, i.surfaces.join(" "), i.features.join(" "), i.generation ? `${i.generation} geracao` : ""].join(" "));
  });

  // ------------------------------------------------ state
  const state = { q: "", surfaces: new Set(), brands: new Set(), lines: new Set(), size: null, kind: null, isNew: false, video: false, last: false, sort: "recent" };
  let filtered = [];
  let shown = 0;

  function matches(i, skip) {
    if (skip !== "surfaces" && state.surfaces.size && !i.surfaces.some((s) => state.surfaces.has(s))) return false;
    if (skip !== "brands" && state.brands.size && !state.brands.has(i.brand)) return false;
    if (skip !== "lines" && state.lines.size && !state.lines.has(i.line)) return false;
    if (skip !== "size" && state.size && !i.sizes.includes(state.size)) return false;
    if (skip !== "kind" && state.kind && !KINDS[state.kind].test(i)) return false;
    if (state.isNew && !i.new) return false;
    if (state.video && !i.video) return false;
    if (state.last && !i.limited) return false;
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

  // ------------------------------------------------ filter UI
  function chip({ label, value, count, pressed, code, color, disabled }) {
    return `<button type="button" class="chip" data-value="${esc(value)}" aria-pressed="${pressed}" ${disabled ? "disabled" : ""} ${color ? `style="--c:${color}"` : ""}>
      ${code ? `<span class="code">${esc(code)}</span>` : ""}${esc(label)} <small>${count}</small></button>`;
  }

  function renderFilters() {
    // surfaces
    const sc = countBy(ITEMS.filter((i) => matches(i, "surfaces")), (i) => i.surfaces);
    $("#fSurface").innerHTML = SURF_ORDER.filter((s) => SURF[s]).map((s) => chip({
      label: SURF[s].label, code: s, value: s, color: `var(--s-${s})`,
      count: sc.get(s) || 0, pressed: state.surfaces.has(s), disabled: !sc.get(s) && !state.surfaces.has(s),
    })).join("");

    // brands (sorted by catalogue size)
    const allBrands = [...countBy(ITEMS, (i) => i.brand).entries()].sort((a, b) => b[1] - a[1]).map((e) => e[0]);
    const bc = countBy(ITEMS.filter((i) => matches(i, "brands")), (i) => i.brand);
    $("#fBrand").innerHTML = allBrands.map((b) => chip({
      label: b, value: b, count: bc.get(b) || 0, pressed: state.brands.has(b), disabled: !bc.get(b) && !state.brands.has(b),
    })).join("");

    // model lines – only those available for the current selection
    const lc = countBy(ITEMS.filter((i) => matches(i, "lines")), (i) => i.line);
    const lines = [...lc.entries()].sort((a, b) => b[1] - a[1]).map((e) => e[0]);
    state.lines.forEach((l) => { if (!lines.includes(l)) lines.push(l); });
    $("#fLine").innerHTML = lines.map((l) => chip({ label: l, value: l, count: lc.get(l) || 0, pressed: state.lines.has(l) })).join("")
      || `<p class="muted" style="margin:0;font-size:13px">Sem modelos para esta seleção.</p>`;

    // sizes
    const zc = countBy(ITEMS.filter((i) => matches(i, "size")), (i) => i.sizes);
    const allSizes = [...new Set(ITEMS.flatMap((i) => i.sizes))].sort((a, b) => a - b);
    $("#fSize").innerHTML = allSizes.map((z) => `<button type="button" class="size" data-value="${z}" aria-pressed="${state.size === z}" ${!zc.get(z) && state.size !== z ? "disabled" : ""} title="${zc.get(z) || 0} modelos">${z}</button>`).join("");

    // kind
    const kindBase = ITEMS.filter((i) => matches(i, "kind"));
    $("#fKind").innerHTML = Object.entries(KINDS).map(([k, v]) => {
      const n = kindBase.filter(v.test).length;
      return chip({ label: v.label, value: k, count: n, pressed: state.kind === k, disabled: !n && state.kind !== k });
    }).join("");

    // active filter pills + badge
    const pills = [];
    state.surfaces.forEach((s) => pills.push(["surfaces", s, `${s} · ${surfLabel(s)}`]));
    state.brands.forEach((b) => pills.push(["brands", b, b]));
    state.lines.forEach((l) => pills.push(["lines", l, l]));
    if (state.size) pills.push(["size", state.size, `Tamanho ${state.size}`]);
    if (state.kind) pills.push(["kind", state.kind, KINDS[state.kind].label]);
    if (state.isNew) pills.push(["isNew", 1, "Novidades"]);
    if (state.video) pills.push(["video", 1, "Com vídeo"]);
    if (state.last) pills.push(["last", 1, "Últimos pares"]);
    $("#active").innerHTML = pills.map(([k, v, l]) => `<button type="button" class="chip" data-remove="${k}" data-value="${esc(v)}">${esc(l)} ✕</button>`).join("");
    const badge = $("#filterBadge");
    badge.textContent = pills.length;
    badge.hidden = !pills.length;
    $("#fNew").checked = state.isNew;
    $("#fVideo").checked = state.video;
    $("#fLast").checked = state.last;
  }

  function toggleSet(set, v) { set.has(v) ? set.delete(v) : set.add(v); }

  $("#fSurface").addEventListener("click", (e) => { const b = e.target.closest(".chip"); if (!b) return; toggleSet(state.surfaces, b.dataset.value); update(); });
  $("#fBrand").addEventListener("click", (e) => {
    const b = e.target.closest(".chip"); if (!b) return;
    toggleSet(state.brands, b.dataset.value);
    // drop model lines that no longer exist for the chosen brands
    if (state.brands.size) state.lines.forEach((l) => { if (!ITEMS.some((i) => i.line === l && state.brands.has(i.brand))) state.lines.delete(l); });
    update();
  });
  $("#fLine").addEventListener("click", (e) => { const b = e.target.closest(".chip"); if (!b) return; toggleSet(state.lines, b.dataset.value); update(); });
  $("#fSize").addEventListener("click", (e) => { const b = e.target.closest(".size"); if (!b) return; const z = +b.dataset.value; state.size = state.size === z ? null : z; update(); });
  $("#fKind").addEventListener("click", (e) => { const b = e.target.closest(".chip"); if (!b) return; state.kind = state.kind === b.dataset.value ? null : b.dataset.value; update(); });
  $("#fNew").addEventListener("change", (e) => { state.isNew = e.target.checked; update(); });
  $("#fVideo").addEventListener("change", (e) => { state.video = e.target.checked; update(); });
  $("#fLast").addEventListener("change", (e) => { state.last = e.target.checked; update(); });
  $("#active").addEventListener("click", (e) => {
    const b = e.target.closest("[data-remove]"); if (!b) return;
    const k = b.dataset.remove, v = b.dataset.value;
    if (state[k] instanceof Set) state[k].delete(v);
    else if (k === "size" || k === "kind") state[k] = null;
    else state[k] = false;
    update();
  });
  let qTimer;
  $("#q").addEventListener("input", (e) => { clearTimeout(qTimer); qTimer = setTimeout(() => { state.q = e.target.value.trim(); update(); }, 160); });
  $("#sort").addEventListener("change", (e) => { state.sort = e.target.value; update(); });

  function clearAll() {
    state.surfaces.clear(); state.brands.clear(); state.lines.clear();
    state.size = null; state.kind = null; state.isNew = state.video = state.last = false;
    state.q = ""; $("#q").value = "";
    update();
  }
  $("#clearFilters").addEventListener("click", clearAll);
  $("#emptyClear").addEventListener("click", clearAll);

  // mobile sheet
  const sheet = $("#filters"), scrim = $("#scrim");
  function openSheet() { sheet.classList.add("open"); scrim.hidden = false; document.body.classList.add("lock"); }
  function closeSheet() { sheet.classList.remove("open"); scrim.hidden = true; document.body.classList.remove("lock"); }
  $("#openFilters").addEventListener("click", openSheet);
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
    filtered = ITEMS.filter((i) => matches(i)).sort(SORTS[state.sort]);
    shown = 0;
    $("#grid").innerHTML = "";
    renderMore();
    renderFilters();
    const n = filtered.length;
    $("#count").innerHTML = `<b>${n}</b> ${n === 1 ? "chuteira" : "chuteiras"}`;
    $("#applyCount").textContent = n;
    $("#empty").hidden = n > 0;
  }

  function card(i) {
    const tags = i.surfaces.map((s) => `<span class="tag tag--surface" style="--c:var(--s-${s})">${s}</span>`).join("")
      + (i.new ? `<span class="tag tag--new">Novo</span>` : "")
      + (i.limited ? `<span class="tag tag--last">Últimos</span>` : "")
      + (i.video ? `<span class="tag tag--video"><svg viewBox="0 0 10 10"><path d="M2 1l7 4-7 4z"/></svg>Vídeo</span>` : "");
    const alt = i.photos > 1 ? `<img class="alt" src="" data-src="${img(i, 1)}" alt="" loading="lazy" decoding="async">` : "";
    return `<button type="button" class="card" data-id="${i.id}" aria-label="${esc(fullName(i))}">
      <div class="card__img">
        <img src="${img(i, "t")}" alt="${esc(i.model)}" loading="lazy" decoding="async" width="480" height="480">
        ${alt}
        <div class="card__tags">${tags}</div>
      </div>
      <div class="card__body">
        <p class="card__brand">${esc(i.brand)}${i.generation ? ` · ${i.generation}.ª geração` : ""}</p>
        <h3 class="card__title">${esc(i.model.replace(new RegExp("^" + i.brand.split(" ")[0] + "\\s+", "i"), ""))}</h3>
        <div class="card__meta"><span>${esc(i.surfaces.map(surfLabel).join(" · ") || i.kind)}</span><span>Tam. <b>${sizeRange(i)}</b></span></div>
      </div>
    </button>`;
  }

  function renderMore() {
    const next = filtered.slice(shown, shown + PAGE);
    if (!next.length) return;
    $("#grid").insertAdjacentHTML("beforeend", next.map(card).join(""));
    shown += next.length;
  }

  new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting) && shown < filtered.length) renderMore();
  }, { rootMargin: "900px" }).observe($("#sentinel"));

  // hover image: load second photo only when the pointer enters a card
  $("#grid").addEventListener("pointerover", (e) => {
    const a = e.target.closest(".card")?.querySelector(".alt[data-src]");
    if (a) { a.src = a.dataset.src; a.removeAttribute("data-src"); }
  });
  $("#grid").addEventListener("click", (e) => { const c = e.target.closest(".card"); if (c) openProduct(c.dataset.id); });

  // ------------------------------------------------ product modal
  const modal = $("#modal");
  let current = null, pickedSize = null;

  function openProduct(id, push = true) {
    const i = ITEMS.find((x) => x.id === id);
    if (!i) return;
    current = i;
    pickedSize = state.size && i.sizes.includes(state.size) ? state.size : null;

    const slides = [];
    if (i.video) slides.push(`<div class="slide"><video src="${esc(i.video)}" poster="${img(i, 0)}" muted autoplay loop playsinline preload="metadata" disablepictureinpicture controlslist="nodownload noplaybackrate noremoteplayback"></video></div>`);
    for (let n = 0; n < i.photos; n++) slides.push(`<div class="slide"><img src="${img(i, n)}" alt="${esc(i.model)} — foto ${n + 1}" ${n ? 'loading="lazy"' : ""}></div>`);
    $("#mSlides").innerHTML = slides.join("");
    $("#mSlides").scrollLeft = 0;
    $("#mDots").innerHTML = slides.map((_, n) => `<button type="button" aria-label="Ir para ${n + 1}" class="${n === 0 ? "on" : ""} ${i.video && n === 0 ? "is-video" : ""}" data-n="${n}"></button>`).join("");
    const multi = slides.length > 1;
    $("#mPrev").hidden = $("#mNext").hidden = $("#mDots").hidden = !multi;
    const v = $("#mSlides video");
    if (v) { v.muted = true; v.volume = 0; v.play().catch(() => {}); }

    $("#mBrand").textContent = i.brand + (i.line && !i.model.includes(i.line) ? ` · ${i.line}` : "");
    $("#mTitle").textContent = fullName(i);
    $("#mBadges").innerHTML = i.surfaces.map((s) => `<span class="tag tag--surface" style="--c:var(--s-${s})">${s} · ${esc(surfLabel(s))}</span>`).join("")
      + (i.new ? `<span class="tag tag--new">Novidade</span>` : "")
      + (i.limited ? `<span class="tag tag--last">Últimos pares</span>` : "");
    $("#mDesc").textContent = i.description;

    const rows = [
      ["Marca", esc(i.brand)],
      ["Modelo", esc(i.model)],
      i.generation ? ["Geração", `${i.generation}.ª geração`] : null,
      ["Piso", i.surfaces.length ? i.surfaces.map((s) => `<b>${s}</b> — ${esc(SURF[s]?.help.replace(/^[A-Z]+ – [^:]+: /, "") || "")}`).join("<br>") : esc(i.kind)],
      ["Tamanhos", i.sizes.length ? `${sizeRange(i)}${i.limited ? " (últimos pares)" : ""}` : "Pergunta-nos"],
      i.features.length ? ["Detalhes", `<div class="feat">${i.features.map((f) => `<span>${esc(f)}</span>`).join("")}</div>`] : null,
    ].filter(Boolean);
    $("#mSpecs").innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("");

    renderSizePick();
    $("#mRef").textContent = `Ref. ${i.id}`;

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
    $("#mOrder").lastChild.textContent = pickedSize ? ` Pedir tamanho ${pickedSize} no Instagram` : " Pedir no Instagram";
  }
  $("#mSizes").addEventListener("click", (e) => {
    const b = e.target.closest(".size"); if (!b) return;
    const z = +b.dataset.value; pickedSize = pickedSize === z ? null : z; renderSizePick();
  });

  function closeProduct(fromHistory = false) {
    if (!modal.open) return;
    $("#mSlides").innerHTML = ""; // stops the video
    modal.close();
    document.body.classList.remove("lock");
    document.title = "As Tuas Chuteiras — Catálogo";
    if (!fromHistory && location.hash.startsWith("#/c/")) history.back();
  }
  $("#mClose").addEventListener("click", () => closeProduct());
  modal.addEventListener("cancel", (e) => { e.preventDefault(); closeProduct(); });
  modal.addEventListener("click", (e) => { if (e.target === modal) closeProduct(); });

  // gallery
  const slidesEl = $("#mSlides");
  const go = (d) => slidesEl.scrollBy({ left: d * slidesEl.clientWidth, behavior: "smooth" });
  $("#mPrev").addEventListener("click", () => go(-1));
  $("#mNext").addEventListener("click", () => go(1));
  $("#mDots").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) slidesEl.scrollTo({ left: +b.dataset.n * slidesEl.clientWidth, behavior: "smooth" }); });
  slidesEl.addEventListener("scroll", () => {
    const n = Math.round(slidesEl.scrollLeft / slidesEl.clientWidth);
    [...$("#mDots").children].forEach((d, k) => d.classList.toggle("on", k === n));
  }, { passive: true });
  document.addEventListener("keydown", (e) => {
    if (!modal.open) return;
    if (e.key === "ArrowRight") go(1);
    if (e.key === "ArrowLeft") go(-1);
  });

  // order via Instagram
  function orderMessage(i) {
    const lines = [
      "Olá! 👋 Tenho interesse nesta chuteira:",
      `• ${fullName(i)}`,
      i.surfaces.length ? `• Piso: ${i.surfaces.map((s) => `${s} (${surfLabel(s)})`).join(" / ")}` : null,
      `• Tamanho: ${pickedSize || "?"}`,
      `• Ref.: ${i.id}`,
      `• Link: ${location.origin && location.origin !== "null" ? location.origin + location.pathname : ""}#/c/${i.id}`,
      "Está disponível? Obrigado!",
    ].filter(Boolean);
    return lines.join("\n");
  }

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (_) { /* fallback below */ }
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
    const url = `${location.origin}${location.pathname}#/c/${current.id}`;
    if (navigator.share) { try { await navigator.share({ title: fullName(current), url }); return; } catch (_) { return; } }
    copy(url); toast("Link copiado!");
  });

  // ------------------------------------------------ toast
  let tTimer;
  function toast(msg, ms = 2600) {
    const t = $("#toast");
    t.textContent = msg; t.hidden = false;
    clearTimeout(tTimer); tTimer = setTimeout(() => { t.hidden = true; }, ms);
  }

  // ------------------------------------------------ routing (#/c/<id>)
  function route() {
    const m = location.hash.match(/^#\/c\/(\d+)/);
    if (m) openProduct(m[1], false);
    else closeProduct(true);
  }
  window.addEventListener("popstate", route);

  // ------------------------------------------------ guide + stats
  $("#guideGrid").innerHTML = SURF_ORDER.filter((s) => SURF[s]).map((s) => {
    const [, title, text] = SURF[s].help.match(/^[A-Z]+ – ([^:]+): (.*)$/) || [, "", SURF[s].help];
    return `<div class="gcard" style="--c:var(--s-${s})"><h3><span class="code">${s}</span>${esc(SURF[s].label)}</h3><p><i>${esc(title)}</i> — ${esc(text)}</p></div>`;
  }).join("");
  document.querySelectorAll("[data-open-guide]").forEach((b) => b.addEventListener("click", () => { closeSheet(); $("#guide").scrollIntoView({ behavior: "smooth" }); }));
  $("#sizeChartLink").hidden = !C.has_size_chart;

  const brands = new Set(ITEMS.map((i) => i.brand)).size;
  $("#stats").innerHTML = [
    [ITEMS.length, "modelos e cores"],
    [brands, "marcas"],
    [ITEMS.filter((i) => i.video).length, "com vídeo"],
  ].map(([n, l]) => `<div class="stat"><b>${n.toLocaleString("pt-PT")}</b><span>${l}</span></div>`).join("");
  if (C.updated) $("#updated").textContent = `Catálogo atualizado em ${C.updated.split(" ")[0].split("-").reverse().join("/")}`;

  update();
  route();
})();
