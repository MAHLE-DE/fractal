import { gsap } from "gsap";
import {
  nodes,
  edges,
  byId,
  palette,
  raw,
  fold,
  familyAngle,
  publicFamily,
  base,
} from "./model";
import {
  state,
  samples,
  screenPosition,
  setOverlay,
  renderer,
  canvas,
} from "./renderer";
const $ = <T extends HTMLElement = HTMLElement>(s: string) =>
  document.querySelector<T>(s)!;
const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const PANEL = 400;
const FOCUS_ZOOM = 34;
let current = "",
  trail: string[] = [],
  transition = "fiber",
  pending = "",
  results: { id: string; group: string; match: string }[] = [],
  active = 0;
const search = $<HTMLInputElement>("#search");
const panel = $("#panel");
const panelCache = new Map<string, DocumentFragment>();
let panelId = "";
$("#date").textContent = `Valid-Documents · ${raw.meta.validDocuments}`;
$("#opening-count").textContent = `${nodes.filter((n) => n.category !== "PUB").length} standards · ${raw.edges.length} citations`;
function toast(text: string) {
  $("#toast").textContent = text;
  gsap.to("#toast", { opacity: 1, duration: 0.2 });
  gsap.to("#toast", { opacity: 0, delay: 2.5, duration: 0.3 });
}
function breadcrumb() {
  $("#trail").hidden = trail.length === 0;
  $<HTMLButtonElement>("#back").disabled = trail.length < 2;
  $("#breadcrumbs").innerHTML = trail
    .map(
      (id, i) =>
        `${i ? "<span>→</span>" : ""}<button data-crumb="${i}">${esc(id)}</button>`,
    )
    .join("");
  $("#breadcrumbs")
    .querySelectorAll<HTMLButtonElement>("button")
    .forEach(
      (b) =>
        (b.onclick = () => {
          const i = +b.dataset.crumb!;
          const id = trail[i];
          trail = trail.slice(0, i);
          focus(id);
        }),
    );
  const box = $("#breadcrumbs");
  box.scrollLeft = box.scrollWidth;
}
function back() {
  if (trail.length < 2 || pending !== current) return;
  trail.pop();
  const previous = trail.pop()!;
  focus(previous);
}
$("#back").onclick = back;
function renderPanel(id: string) {
  if (panelId === id && panel.childNodes.length) {
    panel.classList.add("visible");
    document.body.classList.add("panel-open");
    return;
  }
  if (panelId) {
    const previous = document.createDocumentFragment();
    previous.append(...panel.childNodes);
    panelCache.set(panelId, previous);
  }
  panelId = id;
  const cached = panelCache.get(id);
  if (cached) {
    panel.append(cached);
    panelCache.delete(id);
    panel.classList.add("visible");
    document.body.classList.add("panel-open");
    panel.scrollTop = 0;
    return;
  }
  while (panelCache.size > 8)
    panelCache.delete(panelCache.keys().next().value!);
  const n = nodes[byId.get(id)!];
  panel.innerHTML = `<div class="eyebrow"><small>STANDARD IN FOCUS</small><span class="chip" style="color:${palette[n.category]}">${n.category}</span></div><h2>${esc(id)}</h2><p class="card-title">${esc(n.title)}</p><p class="previous">${(n as { finalLegacy?: boolean }).finalLegacy ? "Final standard · no new-format code" : esc(n.previous)}${n.language ? " · " + n.language.toUpperCase() : ""}</p>${n.file ? '<button class="open" id="open-pdf">Open PDF ↗</button>' : ""}`;
  const sections = [
    [
      "Requires",
      raw.edges
        .filter((e) => e.source === id)
        .map((e) => ({ ...e, id: e.target })),
    ],
    [
      "Required by",
      [...raw.edges, ...raw.public]
        .filter((e) => e.target === id)
        .map((e) => ({ ...e, id: e.source })),
    ],
    [
      "Public standards",
      raw.public
        .filter((e) => e.source === id)
        .map((e) => ({ ...e, id: e.target })),
    ],
  ] as const;
  for (const [title, list] of sections) {
    const section = document.createElement("section");
    section.innerHTML = `<h3>${title}<b>${list.length}</b></h3>`;
    if (!list.length) section.innerHTML += "<small>No citations</small>";
    const sorted = [...list].sort((a, b) => a.id.localeCompare(b.id));
    let cat = "";
    for (const item of sorted) {
      const ni = byId.get(item.id),
        node = ni === undefined ? null : nodes[ni],
        category = node?.category || "PUB";
      if (category !== cat) {
        section.innerHTML += `<div class="cat" style="color:${palette[category]}">${category === "PUB" ? "PUBLIC STANDARDS" : category}</div>`;
        cat = category;
      }
      const idx = edges.findIndex(
        (e) => e.source === item.source && e.target === item.target,
      );
      const div = document.createElement("div");
      const chain =
        item.mapStatus === "RESOLVIDO"
          ? `Resolved chain · ${item.rawCodes.map(esc).join(", ")} → ${esc(item.target)}<br><br>`
          : "";
      div.innerHTML = `<button class="relation" data-target="${esc(item.id)}" data-edge="${idx}"><strong>${esc(item.id)}</strong><span>${esc(node?.title || "Public standard")}</span></button><details><summary>Evidence · p. ${item.pages.join(", ")}</summary><div class="evidence">${chain}${item.evidence.map(esc).join("<br><br>")}</div></details>`;
      section.append(div);
    }
    panel.append(section);
  }
  if (
    n.category !== "PUB" &&
    !raw.edges.some((e) => e.source === id || e.target === id)
  ) {
    const affinities = raw.affinities.filter((a) => a.source === id);
    const section = document.createElement("section");
    section.innerHTML =
      `<h3>Affinities <b>not a citation</b></h3>` +
      affinities
        .map(
          (a) =>
            `<button class="relation" data-target="${a.target}" data-edge="-1"><strong>${a.target}</strong><span>${a.layer} · proximity only</span></button>`,
        )
        .join("");
    if (!affinities.length)
      section.innerHTML +=
        "<small>No affinity suggestion in this snapshot</small>";
    panel.append(section);
  }
  panel.querySelectorAll<HTMLButtonElement>(".relation").forEach((b) => {
    b.onmouseenter = () => {
      state.hover = +b.dataset.edge!;
    };
    b.onmouseleave = () => (state.hover = -1);
    b.onclick = () => {
      if (byId.has(b.dataset.target!)) focus(b.dataset.target!);
      else showPublic(b.dataset.target!);
    };
  });
  panel.classList.add("visible");
    document.body.classList.add("panel-open");
  panel.scrollTop = 0;
  const open = $<HTMLButtonElement>("#open-pdf");
  if (open)
    open.onclick = () => {
      const folder =
        localStorage.getItem("cascade-documents-root") ||
        (window as any).cascadeConfig?.documentsRoot ||
        "../../link_normas/05_DOCUMENTS/";
      const url = new URL(
        folder.replace(/\\/g, "/").replace(/\/?$/, "/") +
          encodeURIComponent(n.file),
        location.href,
      ).href;
      window.open(url, "_blank");
    };
}
function showPublic(id: string) {
  const parents = raw.public.filter((e) => e.target === id);
  search.value = id;
  showResults();
  toast(`${id} · cited by ${parents.length} standards`);
}
function finish(id: string) {
  current = id;
  state.transitionTarget = -1;
  state.focusBlend = 0;
  state.focus = byId.get(id)!;
  state.run = -1;
  state.flash = 1;
  gsap.to(state, { flash: 0, duration: 0.7 });
  renderPanel(id);
  if (trail.at(-1) !== id) trail.push(id);
  breadcrumb();
}
function focus(id: string) {
  if (!byId.has(id)) return;
  skipOpening();
  pending = id;
  $("#results").hidden = true;
  search.setAttribute("aria-expanded", "false");
  search.blur();
  $("#overview-note").style.opacity = "0";
  const ni = byId.get(id)!,
    n = nodes[ni];
  const targetMix = 0;
  const a = n.angle * (1 - targetMix) + n.mixed * targetMix;
  const delta = Math.atan2(
    Math.sin(-Math.PI / 2 - a - state.rotation),
    Math.cos(-Math.PI / 2 - a - state.rotation),
  );
  const edge = edges.findIndex(
    (e) =>
      (e.source === current && e.target === id) ||
      (e.target === current && e.source === id),
  );
  gsap.killTweensOf(
    state,
    "rotation,zoom,anchor,runProgress,flash,panelSpace,focusBlend",
  );
  gsap.to(state, { panelSpace: PANEL, duration: 0.6, ease: "power2.inOut" });
  state.transitionTarget = ni;
  state.focusBlend = 0;
  state.hover = -1;
  // Transicao automatica: corrida pelo fio quando ha citacao direta; rolagem no anel quando nao ha.
  const fiber = edge >= 0 && !!current;
  // Inercia: duracao cresce com a distancia angular; curvas de aceleracao suaves (sem arrancos).
  const distance = Math.abs(delta) / Math.PI;
  const rollDuration = 1.3 + 1.1 * Math.min(1, distance);
  state.run = fiber ? edge : -1;
  state.runProgress = fiber && edges[edge].source === current ? 0 : 1;
  state.runDirection = state.runProgress === 0 ? 1 : -1;
  if (fiber) {
    const total = 2.6;
    // Afasta suavemente para revelar o fio inteiro, percorre-o e volta a aproximar.
    gsap.to(state, { zoom: 1.7, duration: 0.9, ease: "power2.inOut" });
    gsap.to(state, {
      runProgress: 1 - state.runProgress,
      duration: 1.5,
      delay: 0.45,
      ease: "sine.inOut",
    });
    gsap.to(state, {
      focusBlend: 1,
      rotation: state.rotation + delta,
      anchor: n.radius,
      duration: total,
      ease: "power3.inOut",
      onComplete: () => finish(id),
    });
    gsap.to(state, { zoom: FOCUS_ZOOM, duration: 1.1, delay: total - 1.1, ease: "power2.inOut" });
  } else {
    gsap.to(state, {
      focusBlend: 1,
      rotation: state.rotation + delta,
      anchor: n.radius,
      duration: rollDuration,
      ease: "power3.inOut",
      onComplete: () => finish(id),
    });
    gsap.to(state, { zoom: FOCUS_ZOOM, duration: current ? rollDuration * 0.6 : 1.6, ease: "power2.inOut" });
  }
  if (!current) {
    state.focus = ni;
    renderPanel(id);
  }
}
function overview() {
  gsap.killTweensOf(state);
  state.flash = 0;
  gsap.to(state, {
    panelSpace: 0,
    mix: 0,
    zoom: 1,
    anchor: 1,
    duration: 0.9,
    ease: "power2.inOut",
  });
  state.transitionTarget = -1;
  state.focusBlend = 0;
  state.focus = -1;
  state.run = -1;
  state.hover = -1;
  current = "";
  pending = "";
  panel.classList.remove("visible");
  document.body.classList.remove("panel-open");
  $("#overview-note").style.opacity = "1";
  trail = [];
  breadcrumb();
}
const documents = nodes.filter((n) => n.category !== "PUB");
function highlight(s: string, q: string) {
  if (!q) return esc(s);
  const index = fold(s).indexOf(fold(q));
  return index < 0
    ? esc(s)
    : esc(s.slice(0, index)) +
        "<mark>" +
        esc(s.slice(index, index + q.length)) +
        "</mark>" +
        esc(s.slice(index + q.length));
}
function searchItems(query: string) {
  const q = fold(query),
    words = q.split(" ");
  if (!q) return [];
  const matches: { id: string; group: string; match: string; score: number }[] =
    [];
  for (const n of documents) {
    const main = fold(n.id + " " + n.title + " " + n.previous);
    if (words.every((w) => main.includes(w)))
      matches.push({
        id: n.id,
        group: "Standards",
        match: n.previous,
        score: fold(n.id).startsWith(q) ? 0 : 2,
      });
    else {
      const alias = n.aliases.find((a) => fold(a).includes(q));
      if (alias)
        matches.push({
          id: n.id,
          group: "Legacy codes",
          match: alias,
          score: 1,
        });
    }
  }
  const pubs = [...new Set(raw.public.map((e) => e.target))].filter((p) =>
    words.every((w) => fold(p).includes(w)),
  );
  for (const p of pubs)
    for (const e of raw.public.filter((e) => e.target === p))
      if (!matches.some((m) => m.id === e.source))
        matches.push({
          id: e.source,
          group: "Public standards",
          match: `${p} · page ${e.pages.join(", ")}`,
          score: 1,
        });
  return matches
    .sort((a, b) => a.score - b.score || a.id.localeCompare(b.id))
    .slice(0, 8);
}
function showResults() {
  if (!search.value.trim()) {
    $("#results").hidden = true;
    search.setAttribute("aria-expanded", "false");
    results = [];
    return;
  }
  results = searchItems(search.value);
  active = 0;
  const box = $("#results");
  box.hidden = false;
  search.setAttribute("aria-expanded", "true");
  if (!results.length) {
    box.innerHTML = `<div class="empty">No match for “${esc(search.value)}”</div>`;
    return;
  }
  box.innerHTML = "";
  for (const group of ["Standards", "Public standards", "Legacy codes"]) {
    const items = results.filter((x) => x.group === group);
    if (!items.length) continue;
    box.innerHTML += `<div class="group">${group}</div>`;
    for (const result of items) {
      const n = nodes[byId.get(result.id)!],
        i = results.indexOf(result);
      box.innerHTML += `<button class="result ${i === 0 ? "active" : ""}" role="option" aria-selected="${i === 0}" id="result-${i}" data-result="${i}"><i class="dot" style="background:${palette[n.category]};color:${palette[n.category]}"></i><div><strong>${highlight(n.id, search.value)}</strong><p>${highlight(n.title, search.value)}</p><small>${highlight(result.match, search.value)}</small></div></button>`;
    }
  }
  box
    .querySelectorAll<HTMLButtonElement>(".result")
    .forEach((b) => {
      b.onclick = () => focus(results[+b.dataset.result!].id);
      b.onmouseenter = () => setActive(+b.dataset.result!);
    });
  search.setAttribute("aria-activedescendant", "result-0");
}
function setActive(index: number) {
  active = index;
  $("#results")
    .querySelectorAll(".result")
    .forEach((b) => {
      const selected = +(b as HTMLElement).dataset.result! === active;
      b.classList.toggle("active", selected);
      b.setAttribute("aria-selected", String(selected));
    });
  search.setAttribute("aria-activedescendant", `result-${active}`);
}
function closeResults() {
  $("#results").hidden = true;
  search.setAttribute("aria-expanded", "false");
}
addEventListener("pointerdown", (e) => {
  if (!(e.target as HTMLElement).closest(".search-wrap")) closeResults();
});
let debounce = 0;
search.oninput = () => {
  clearTimeout(debounce);
  debounce = window.setTimeout(showResults, 40);
};
search.onfocus = () => {
  if (search.value) showResults();
};
search.onkeydown = (e) => {
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    if (results.length)
      setActive((active + (e.key === "ArrowDown" ? 1 : -1) + results.length) % results.length);
  }
  if (e.key === "Enter" && results[active]) {
    e.preventDefault();
    focus(results[active].id);
  }
  if (e.key === "Escape") {
    $("#results").hidden = true;
    search.setAttribute("aria-expanded", "false");
    search.blur();
    e.stopPropagation();
  }
};
function skipOpening() {
  state.opening = 1;
  gsap.killTweensOf(openAnimation);
  $("#opening").style.opacity = "0";
  setTimeout(() => ($("#opening").hidden = true), 400);
}
const openAnimation = { value: 0 };
gsap.to(openAnimation, {
  value: 1,
  duration: 3,
  ease: "none",
  onUpdate: () => (state.opening = openAnimation.value),
  onComplete: () => skipOpening(),
});
$("#skip").onclick = skipOpening;
canvas.onclick = (e) => {
  if (state.opening < 1) {
    skipOpening();
    return;
  }
  let best = -1,
    dist = 25;
  nodes.forEach((_, i) => {
    const p = screenPosition(i),
      d = Math.hypot(p.x - e.clientX, p.y - e.clientY);
    if (d < dist) {
      best = i;
      dist = d;
    }
  });
  if (best >= 0) focus(nodes[best].id);
  else overview();
};
$("#overview").onclick = overview;
$("#theme").onclick = () => {
  document.body.classList.toggle("light");
  state.light = +document.body.classList.contains("light");
};
addEventListener("keydown", (e) => {
  if (e.key === "/" && document.activeElement !== search) {
    e.preventDefault();
    search.focus();
  }
  if (e.key === "Escape") {
    if (!$("#results").hidden) closeResults();
    else overview();
  }
  const typing = document.activeElement instanceof HTMLInputElement;
  if (!typing && (e.key === "Backspace" || (e.altKey && e.key === "ArrowLeft"))) {
    e.preventDefault();
    back();
  }
});
canvas.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    gsap.to(state, {
      zoom: Math.max(0.8, Math.min(60, state.zoom * Math.exp(-e.deltaY * 0.0015))),
      duration: 0.25,
      overwrite: "auto",
    });
  },
  { passive: false },
);
const ringCount = nodes.filter((n) => n.category !== "PUB").length + 25;
const ringGap = new Float32Array(nodes.length);
for (const ring of [nodes.filter((n) => n.category !== "PUB"), nodes.filter((n) => n.category === "PUB")]) {
  const order = ring.map((n) => byId.get(n.id)!).sort((a, b) => nodes[a].angle - nodes[b].angle);
  order.forEach((id, k) => {
    const turn = (d: number) => ((d % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const prev = turn(nodes[id].angle - nodes[order[(k - 1 + order.length) % order.length]].angle);
    const next = turn(nodes[order[(k + 1) % order.length]].angle - nodes[id].angle);
    ringGap[id] = Math.min(prev, next);
  });
}
function cellSpacing() {
  return (2 * Math.PI * 0.35 * innerHeight * state.zoom) / ringCount;
}
function cellRadius(i: number) {
  const n = nodes[i];
  const w = n.category === "PUB" ? 1 : n.incoming; // publicas: todas do mesmo tamanho
  const base = n.category === "PUB" ? 1.8 : 1.3 + Math.sqrt(w) * 0.7;
  const z = Math.min(1, Math.max(0, (state.zoom - 3) / 10));
  const scale = Math.min((innerHeight * Math.min(devicePixelRatio, 1.25)) / 1000, 1.5) / Math.min(devicePixelRatio, 1.25);
  const big = Math.min(34, Math.max(6, ((2 * Math.PI * 0.35 * 1000 * state.zoom) / ringCount) * 0.2 + Math.sqrt(w) * 0.8));
  return (base * (1 - z) + big * z) * scale;
}
const labelCanvas = $<HTMLCanvasElement>("#labels"),
  ctx = labelCanvas.getContext("2d")!;
const categories = base.children!;
function labelColor(category: string) {
  return state.light
    ? "rgb(" +
        palette[category]
          .slice(1)
          .match(/../g)!
          .map((x) => Math.round(parseInt(x, 16) * 0.55))
          .join(",") +
        ")"
    : palette[category];
}
let labelCounter = 0;
let labelView = {
  zoom: NaN,
  rotation: NaN,
  mix: NaN,
  panelSpace: NaN,
  hover: -1,
};
const codeLabels = new Map<string, HTMLCanvasElement>();
function codeLabel(id: string, category: string) {
  const bold =
    state.hover >= 0 &&
    (edges[state.hover].source === id || edges[state.hover].target === id);
  const key = id + state.light + bold;
  if (!codeLabels.has(key)) {
    const label = document.createElement("canvas"),
      c = label.getContext("2d")!;
    c.font = `${bold ? "700 " : "600 "}11px 'Segoe UI', sans-serif`;
    label.width = Math.ceil(c.measureText(id).width) + 4;
    label.height = 20;
    c.font = `${bold ? "700 " : "600 "}11px 'Segoe UI', sans-serif`;
    c.fillStyle = labelColor(category);
    c.fillText(id, 2, 14);
    codeLabels.set(key, label);
  }
  return codeLabels.get(key)!;
}
const inset = document.createElement("canvas");
inset.id = "focus-inset";
inset.width = 220;
inset.height = 270;
inset.setAttribute(
  "aria-label",
  "Overview of focus citations: warm requires, cool required by",
);
document.body.append(inset);
const mini = inset.getContext("2d")!;
const edgeLabels = document.createElement("div");
edgeLabels.id = "edge-labels";
edgeLabels.setAttribute("aria-label", "Offscreen citation destinations");
document.body.append(edgeLabels);
let edgeLabelsKey = "";
let lastContextHover = -2;
function worldPoint(id: number, t: number, rotated = true) {
  const n = nodes[id];
  const a =
    n.angle * (1 - state.mix) +
    n.mixed * state.mix +
    (rotated ? state.rotation : 0) +
    (state.live && rotated
      ? 0.0017 * Math.sin(t * (0.17 + ((id * 0.618) % 1) * 0.23) + id * 2.399)
      : 0);
  const r = n.radius * (1 - state.mix) + state.mix;
  return [Math.cos(a) * r, Math.sin(a) * r];
}
const miniCurves = new Map<number, { mix: number; points: number[][] }>();
function focusCurve(index: number) {
  const cached = miniCurves.get(index);
  if (cached && cached.mix === state.mix) return cached.points;
  const e = edges[index],
    start = worldPoint(byId.get(e.source)!, 0, false),
    end = worldPoint(byId.get(e.target)!, 0, false);
  const controls = e.controls.map((c, j) => {
    const a = c[0] * (1 - state.mix) + c[1] * state.mix;
    const point =
      c[3] > 0
        ? worldPoint(c[3] - 1, 0, false)
        : [Math.cos(a) * c[2], Math.sin(a) * c[2]];
    const u = j / (e.controls.length - 1);
    return point.map(
      (v, k) => (start[k] * (1 - u) + end[k] * u) * 0.15 + v * 0.85,
    );
  });
  const cp = (j: number) =>
    controls[Math.max(0, Math.min(controls.length - 1, j))];
  const points = Array.from({ length: 33 }, (_, i) => {
    const u = Math.min(i / 32, 0.999999) * (controls.length + 1),
      k = Math.floor(u) - 2,
      f = u % 1;
    return [0, 1].map(
      (axis) =>
        (cp(k)[axis] * (1 - f) ** 3 +
          cp(k + 1)[axis] * (3 * f ** 3 - 6 * f * f + 4) +
          cp(k + 2)[axis] * (-3 * f ** 3 + 3 * f * f + 3 * f + 1) +
          cp(k + 3)[axis] * f ** 3) /
        6,
    );
  });
  miniCurves.set(index, { mix: state.mix, points });
  return points;
}
function drawFocusContext(t: number, stageWidth: number) {
  const shown = state.focus >= 0;
  inset.hidden = !shown;
  edgeLabels.hidden = !shown || state.zoom < 3;
  if (!shown) return;
  const id = nodes[state.focus].id;
  const links = edges
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => e.source === id || e.target === id);
  mini.clearRect(0, 0, 220, 270);
  mini.fillStyle = state.light ? "#213954" : "#bdcde0";
  mini.font = "600 10px 'Segoe UI', sans-serif";
  mini.textAlign = "left";
  mini.fillText("FOCUS CONNECTIONS", 14, 22);
  mini.strokeStyle = state.light ? "#8c9cad" : "#334a65";
  mini.lineWidth = 1;
  mini.beginPath();
  mini.arc(110, 127, 80, 0, Math.PI * 2);
  mini.stroke();
  if (state.mix < 0.5) {
    mini.strokeStyle = state.light ? "#acb8c6" : "#2c3c50";
    mini.beginPath();
    mini.arc(110, 127, 94.4, 0, Math.PI * 2);
    mini.stroke();
  }
  for (let i = 0; i < nodes.length; i++) {
    const p = worldPoint(i, t);
    mini.fillStyle = palette[nodes[i].category];
    mini.fillRect(110 + p[0] * 80, 127 - p[1] * 80, 1.3, 1.3);
  }
  const offscreen: { id: string; edge: number }[] = [];
  for (const { e, i } of links) {
    const target = e.source === id ? e.target : e.source,
      other = byId.get(target)!;
    const hovered = i === state.hover;
    const points = focusCurve(i);
    mini.strokeStyle =
      e.source === id
        ? state.light
          ? "#916000"
          : "#ffe3a3"
        : state.light
          ? "#00798f"
          : "#7fe8ff";
    mini.globalAlpha = state.hover >= 0 && !hovered ? 0.15 : 0.8;
    mini.lineWidth = hovered ? 2.8 : 1;
    mini.beginPath();
    const cos = Math.cos(state.rotation),
      sin = Math.sin(state.rotation);
    points.forEach((p, j) => {
      const x = 110 + (p[0] * cos - p[1] * sin) * 80,
        y = 127 - (p[0] * sin + p[1] * cos) * 80;
      if (j) mini.lineTo(x, y);
      else mini.moveTo(x, y);
    });
    mini.stroke();
    const p = screenPosition(other, t);
    if (
      p.x < 18 ||
      p.x > stageWidth - 18 ||
      p.y < 155 ||
      p.y > innerHeight - 100
    )
      offscreen.push({ id: target, edge: i });
    if (hovered) {
      const q = worldPoint(other, t);
      mini.beginPath();
      mini.arc(110 + q[0] * 80, 127 - q[1] * 80, 5, 0, Math.PI * 2);
      mini.stroke();
    }
  }
  mini.globalAlpha = 1;
  const marker =
    state.transitionTarget >= 0 ? state.transitionTarget : state.focus;
  const p = worldPoint(marker, t);
  mini.fillStyle = state.light ? "#0b213c" : "#ffffff";
  mini.strokeStyle = state.light ? "#916000" : "#ffe3a3";
  mini.lineWidth = 2;
  mini.beginPath();
  mini.arc(110 + p[0] * 80, 127 - p[1] * 80, 4.5, 0, Math.PI * 2);
  mini.fill();
  mini.stroke();
  mini.fillStyle = state.light ? "#213954" : "#e7f0fc";
  mini.font = "700 11px 'Segoe UI', sans-serif";
  mini.textAlign = "center";
  mini.fillText(nodes[marker].id, 110, 238);
  // Legenda de direcao dentro do mini-mapa (nao sobrepoe o palco).
  mini.font = "600 10.5px 'Segoe UI', sans-serif";
  mini.textAlign = "left";
  const legend: [string, string][] = [
    ["Requires", state.light ? "#916000" : "#ffe3a3"],
    ["Required by", state.light ? "#00798f" : "#7fe8ff"],
  ];
  legend.forEach(([label, color], k) => {
    const x = 24 + k * 96;
    mini.fillStyle = color;
    mini.fillRect(x, 255, 16, 3);
    mini.fillStyle = state.light ? "#213954" : "#c9d7e7";
    mini.fillText(label, x + 22, 260);
  });
  const unique = [...new Map(offscreen.map((x) => [x.id, x])).values()];
  const key = unique.map((x) => x.id + ":" + x.edge).join("|");
  edgeLabels.style.right = `${state.panelSpace + 22}px`;
  if (key !== edgeLabelsKey) {
    edgeLabelsKey = key;
    edgeLabels.innerHTML = unique
      .map(
        (x) =>
          `<button data-edge="${x.edge}" data-target="${esc(x.id)}" style="--tint:${palette[nodes[byId.get(x.id)!].category]}"><span style="color:${edges[x.edge].source === id ? "#ffe3a3" : "#7fe8ff"}">${edges[x.edge].source === id ? "↗" : "↙"}</span> ${esc(x.id)}</button>`,
      )
      .join("");
    edgeLabels.querySelectorAll<HTMLButtonElement>("button").forEach((b) => {
      b.onmouseenter = () => (state.hover = +b.dataset.edge!);
      b.onmouseleave = () => (state.hover = -1);
      b.onclick = () => focus(b.dataset.target!);
    });
  }
  edgeLabels.querySelectorAll<HTMLButtonElement>("button").forEach((b) => {
    const e = state.hover >= 0 ? edges[state.hover] : null;
    b.classList.toggle(
      "hovered",
      !!e && (e.source === b.dataset.target || e.target === b.dataset.target),
    );
  });
}

document.fonts.ready.then(() => codeLabels.clear());
setOverlay((t) => {
  labelCounter++;
  // O texto só se desloca perceptivelmente durante uma transição. A oscilação
  // lenta atualiza rótulos a 15 Hz; células e fibras continuam em cada quadro.
  const moving =
    state.zoom !== labelView.zoom ||
    state.rotation !== labelView.rotation ||
    state.mix !== labelView.mix ||
    state.panelSpace !== labelView.panelSpace ||
    state.hover !== labelView.hover ||
    state.transitionTarget >= 0 ||
    state.opening < 1 ||
    state.flash > 0;
  if (!moving && labelCounter % 4 !== 0) return;
  labelView = {
    zoom: state.zoom,
    rotation: state.rotation,
    mix: state.mix,
    panelSpace: state.panelSpace,
    hover: state.hover,
  };
  const stageWidth = innerWidth - state.panelSpace;
  // The inset is a locator: 15 Hz is sufficient; main GPU fibers stay at RAF rate.
  if (labelCounter % 4 === 0 || state.hover !== lastContextHover) {
    drawFocusContext(t, stageWidth);
    lastContextHover = state.hover;
  }
  (labelCanvas.width === innerWidth && labelCanvas.height === innerHeight) ||
    Object.assign(labelCanvas, { width: innerWidth, height: innerHeight });
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  ctx.globalAlpha = Math.min(1, state.opening * 1.4);
  if (state.zoom < 2) {
    const placed: { x: number; y: number }[] = [];
    for (const cat of [
      ...categories.map((c) => c.data.name),
      ...(state.mix > 0.5 ? ["PUB"] : []),
    ]) {
      const leaves = nodes.filter((n) => n.category === cat),
        a =
          leaves.reduce(
            (s, n) => s + n.angle * (1 - state.mix) + n.mixed * state.mix,
            0,
          ) /
            leaves.length +
          state.rotation,
        r = innerHeight * 0.35 * state.zoom + 35;
      let x = stageWidth / 2 + Math.cos(a) * r,
        y =
          innerHeight / 2 -
          0.35 * (state.zoom * state.anchor - 1) * innerHeight -
          Math.sin(a) * r;
      if (cat === "TEST") {
        x -= 22;
        y += 8;
      }
      if (cat === "W") {
        x += 32;
        y += 12;
      }
      for (const p of placed) if (Math.hypot(x - p.x, y - p.y) < 75) y += 34;
      if (state.focus >= 0 && y > innerHeight - 145) continue;
      placed.push({ x, y });
      ctx.font = "600 13px 'Segoe UI', sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = labelColor(cat);
      ctx.fillText(`${cat} ${leaves.length}`, x, y);
    }
    // Familias do anel publico (ISO, DIN, ASTM...), por fora do anel externo.
    ctx.font = "600 11px 'Segoe UI', sans-serif";
    ctx.fillStyle = state.light ? "#45607c" : "#8ea2ba";
    for (const [family, angle] of familyAngle) {
      const count = nodes.filter((n) => n.category === "PUB" && publicFamily(n.id) === family).length;
      if (count < 5) continue;
      const a = angle + state.rotation,
        r = innerHeight * 0.35 * 1.18 * state.zoom + 26;
      const x = stageWidth / 2 + Math.cos(a) * r,
        y = innerHeight / 2 - 0.35 * (state.zoom * state.anchor - 1) * innerHeight - Math.sin(a) * r;
      if (state.focus >= 0 && y > innerHeight - 145) continue;
      if (y < 80 || placed.some((p) => Math.hypot(x - p.x, y - p.y) < 36)) continue;
      ctx.textAlign = Math.cos(a) > 0.25 ? "left" : Math.cos(a) < -0.25 ? "right" : "center";
      ctx.fillText(`${family} ${count}`, x, y + 4);
    }
  } else if (state.zoom >= 6) {
    const hoverEdge = state.hover >= 0 ? edges[state.hover] : null;
    const visible: { i: number; x: number; y: number }[] = [];
    nodes.forEach((n, i) => {
      const p = screenPosition(i, t);
      if (p.x < -80 || p.x > stageWidth + 80 || p.y < 110 || p.y > innerHeight - 30) return;
      visible.push({ i, x: p.x, y: p.y });
    });
    const wrap = (text: string, width: number) => {
      const words = text.split(" ");
      const lines: string[] = [];
      let line = "";
      for (const w of words) {
        const next = line ? line + " " + w : w;
        if (line && ctx.measureText(next).width > width) {
          lines.push(line);
          line = w;
        } else line = next;
      }
      if (line) lines.push(line);
      if (lines.length > 2) {
        let last = lines[1];
        while (last && ctx.measureText(last + "…").width > width) last = last.replace(/\s*\S+$/, "");
        return [lines[0], (last || lines[1]) + "…"];
      }
      return lines;
    };
    // Espaco de cada rotulo vem da distancia FIXA ate as vizinhas no anel (nao da posicao animada),
    // e o rotulo aparece/some com fade: nada pisca durante o movimento continuo ou a rolagem.
    visible.forEach((v) => {
      const n = nodes[v.i];
      const room = Math.min(160, ringGap[v.i] * 0.35 * innerHeight * state.zoom * n.radius - 16);
      const fade = Math.min(1, Math.max(0, (room - 30) / 14));
      if (fade <= 0) return;
      const r = cellRadius(v.i);
      const focused = v.i === state.focus || v.i === state.transitionTarget;
      const hot = focused || (!!hoverEdge && (hoverEdge.source === n.id || hoverEdge.target === n.id));
      ctx.globalAlpha = focused ? 1 : fade;
      ctx.textAlign = "center";
      ctx.font = `${hot ? 700 : 600} ${focused ? 14 : 12}px 'Segoe UI', sans-serif`;
      ctx.fillStyle = focused ? (state.light ? "#0b213c" : "#ffffff") : labelColor(n.category);
      ctx.fillText(n.id, v.x, v.y + r + 17, Math.max(room, 40));
      const titleFade = Math.min(1, Math.max(0, (room - 60) / 14)) * Math.min(1, Math.max(0, (state.zoom - 16) / 4));
      if (titleFade > 0 && n.title && n.category !== "PUB") {
        ctx.globalAlpha = titleFade;
        ctx.font = "400 11px 'Segoe UI', sans-serif";
        ctx.fillStyle = state.light ? "#3d556f" : "#a9bbcf";
        wrap(n.title, room).forEach((l, q) => ctx.fillText(l, v.x, v.y + r + 33 + q * 14, room));
      }
      ctx.globalAlpha = 1;
    });
  }
  if (state.focus >= 0 && state.zoom < 3) {
    const cited = new Set(
      raw.public
        .filter((e) => e.source === nodes[state.focus].id)
        .map((e) => e.target),
    );
    nodes.forEach((n, i) => {
      if (
        n.category !== "PUB" ||
        !cited.has(n.id)
      )
        return;
      const p = screenPosition(i, t);
      if (
        p.x < 30 ||
        p.x > stageWidth - 20 ||
        p.y < 160 ||
        p.y > innerHeight - 155
      )
        return;
      ctx.save();
      ctx.translate(p.x, p.y);
      const flip = Math.cos(p.angle) < 0;
      ctx.rotate(-p.angle + (flip ? Math.PI : 0));
      ctx.font = "600 10px 'Segoe UI', sans-serif";
      ctx.textAlign = flip ? "right" : "left";
      ctx.fillStyle = labelColor("PUB");
      ctx.fillText(n.id, flip ? -12 : 12, 0);
      ctx.restore();
    });
  }
  if (state.focus >= 0 && state.flash > 0) {
    const p = screenPosition(state.focus, t);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 25 + state.flash * 30, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(210,240,255,${state.flash})`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
});
$("#legend").innerHTML = Object.entries(palette)
  .filter(([c]) => c !== "PUB")
  .map(
    ([c, color]) =>
      `<button style="color:${color}" data-cat="${c}">● ${c}</button>`,
  )
  .join("");
$("#legend")
  .querySelectorAll<HTMLButtonElement>("button")
  .forEach(
    (b) =>
      (b.onclick = () => {
        const cat = Object.keys(palette).indexOf(b.dataset.cat!);
        state.categoryFilter = state.categoryFilter === cat ? -1 : cat;
        $("#legend")
          .querySelectorAll<HTMLButtonElement>("button")
          .forEach(
            (x) =>
              (x.style.opacity =
                state.categoryFilter < 0 || x === b ? "1" : ".35"),
          );
      }),
  );
(window as any).cascade = {
  focus,
  overview,
  skipOpening,
  state,
  samples,
  data: raw,
  nodes,
  edges,
  renderer,
  searchItems,
  pauseAnimations: (paused: boolean) => {
    gsap.globalTimeline.paused(paused);
  },
  configureDocuments: (folder: string) =>
    localStorage.setItem("cascade-documents-root", folder),
  get current() {
    return current;
  },
  get pending() {
    return pending;
  },
};
