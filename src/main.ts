import { gsap } from "gsap";
import {
  nodes,
  edges,
  byId,
  palette,
  raw,
  fold,
  topPublic,
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
$("#date").textContent = `VALID-DOCUMENTS · ${raw.meta.validDocuments}`;
function toast(text: string) {
  $("#toast").textContent = text;
  gsap.to("#toast", { opacity: 1, duration: 0.2 });
  gsap.to("#toast", { opacity: 0, delay: 2.5, duration: 0.3 });
}
function breadcrumb() {
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
}
function renderPanel(id: string) {
  if (panelId === id && panel.childNodes.length) {
    panel.classList.add("visible");
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
    panel.scrollTop = 0;
    return;
  }
  while (panelCache.size > 8)
    panelCache.delete(panelCache.keys().next().value!);
  const n = nodes[byId.get(id)!];
  panel.innerHTML = `<div class="eyebrow"><small>STANDARD IN FOCUS</small><span class="chip" style="color:${palette[n.category]}">${n.category}</span></div><h2>${esc(id)}</h2><p class="card-title">${esc(n.title)}</p><p class="previous">${esc(n.previous)}${n.language ? " · " + n.language.toUpperCase() : ""}</p>${n.file ? '<button class="open" id="open-pdf">Open PDF ↗</button>' : ""}`;
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
      $<HTMLInputElement>("#file-path").value = url;
      $<HTMLDialogElement>("#file-dialog").showModal();
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
  state.focus = byId.get(id)!;
  state.run = -1;
  state.flash = 1;
  gsap.to(state, { flash: 0, duration: 0.7 });
  renderPanel(id);
  $("#focus-label").innerHTML =
    `<strong>${esc(id)}</strong><span>${esc(nodes[state.focus].title)}</span>`;
  if (trail.at(-1) !== id) trail.push(id);
  breadcrumb();
}
function focus(id: string) {
  if (!byId.has(id)) return;
  if (
    nodes[byId.get(id)!].category === "PUB" &&
    !topPublic.includes(id) &&
    state.mix < 0.99
  ) {
    $<HTMLSelectElement>("#public").value = "mixed";
    gsap.to(state, { mix: 1, duration: 0.7, onComplete: () => focus(id) });
    return;
  }
  skipOpening();
  pending = id;
  $("#results").hidden = true;
  search.setAttribute("aria-expanded", "false");
  search.blur();
  $("#overview-note").style.opacity = "0";
  const ni = byId.get(id)!,
    n = nodes[ni];
  const a = n.angle * (1 - state.mix) + n.mixed * state.mix;
  const delta = Math.atan2(
    Math.sin(-Math.PI / 2 - a - state.rotation),
    Math.cos(-Math.PI / 2 - a - state.rotation),
  );
  const edge = edges.findIndex(
    (e) =>
      (e.source === current && e.target === id) ||
      (e.target === current && e.source === id),
  );
  gsap.killTweensOf(state);
  const duration = transition === "fiber" && edge >= 0 ? 1.2 : 0.9;
  state.hover = -1;
  state.run = edge;
  state.runProgress = edge >= 0 && edges[edge].source === current ? 0 : 1;
  state.runDirection = state.runProgress === 0 ? 1 : -1;
  const fiber = transition === "fiber" && edge >= 0;
  if (fiber) {
    gsap.to(state, {
      runProgress: 1 - state.runProgress,
      duration: 1.0,
      delay: 0.1,
      ease: "none",
    });
    gsap.to(state, { zoom: 1.25, duration: 0.2, ease: "power2.out" });
  } else {
    state.run = -1;
    if (current && transition === "fiber")
      toast("No direct citation · using Ring roll");
  }
  gsap.to(state, {
    rotation: state.rotation + delta,
    anchor: n.radius * (1 - state.mix) + state.mix,
    duration,
    ease: "power2.inOut",
    onComplete: () => finish(id),
  });
  gsap.to(state, {
    zoom: 14 * (1 + state.mix * (nodes.length / 595 - 1)),
    duration: fiber ? 0.25 : duration,
    delay: fiber ? 0.95 : 0,
    ease: "power2.inOut",
  });
  if (!current) {
    state.focus = ni;
    renderPanel(id);
  }
}
function overview() {
  gsap.killTweensOf(state);
  gsap.to(state, { zoom: 1, anchor: 1, duration: 0.9, ease: "power2.inOut" });
  state.focus = -1;
  state.run = -1;
  state.hover = -1;
  current = "";
  pending = "";
  panel.classList.remove("visible");
  $("#focus-label").innerHTML = "";
  $("#overview-note").style.opacity = "1";
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
    .forEach((b) => (b.onclick = () => focus(results[+b.dataset.result!].id)));
  search.setAttribute("aria-activedescendant", "result-0");
}
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
    active =
      (active + (e.key === "ArrowDown" ? 1 : -1) + results.length) %
      results.length;
    $("#results")
      .querySelectorAll(".result")
      .forEach((b, i) => {
        const selected = +(b as HTMLElement).dataset.result! === active;
        b.classList.toggle("active", selected);
        b.setAttribute("aria-selected", String(selected));
      });
    search.setAttribute("aria-activedescendant", `result-${active}`);
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
$<HTMLSelectElement>("#transition").onchange = (e) =>
  (transition = (e.target as HTMLSelectElement).value);
$<HTMLSelectElement>("#public").onchange = (e) => {
  const mix = (e.target as HTMLSelectElement).value === "mixed" ? 1 : 0;
  const n = state.focus >= 0 ? nodes[state.focus] : null;
  const delta = n ? (n.mixed - n.angle) * (state.mix - mix) : 0;
  gsap.to(state, {
    mix,
    rotation: state.rotation + delta,
    anchor: n ? n.radius * (1 - mix) + mix : 1,
    duration: 1,
    ease: "power2.inOut",
  });
};
function liveLabel() {
  $("#live").setAttribute("aria-pressed", String(state.live));
  $("#live").textContent = state.live ? "◉ Live motion" : "○ Motion paused";
}
liveLabel();
$("#live").onclick = () => {
  state.live = !state.live;
  liveLabel();
};
$("#theme").onclick = () => {
  document.body.classList.toggle("light");
  state.light = +document.body.classList.contains("light");
};
$("#close-dialog").onclick = () => $<HTMLDialogElement>("#file-dialog").close();
$("#copy-path").onclick = () => {
  const input = $<HTMLInputElement>("#file-path");
  input.select();
  document.execCommand("copy");
  toast("Document path copied");
};
addEventListener("keydown", (e) => {
  if (e.key === "/" && document.activeElement !== search) {
    e.preventDefault();
    search.focus();
  }
  if (e.key === "Escape") overview();
  if (e.key.toLowerCase() === "f" && document.activeElement !== search)
    $("#fps").toggleAttribute("hidden");
});
canvas.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    gsap.to(state, {
      zoom: Math.max(0.8, Math.min(36, state.zoom - e.deltaY * 0.018)),
      duration: 0.25,
      overwrite: "auto",
    });
  },
  { passive: false },
);
const direction = document.createElement("div");
direction.id = "direction";
direction.innerHTML = "<span>↗ Requires</span><span>↙ Required by</span>";
document.body.append(direction);
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
let labelView = { zoom: NaN, rotation: NaN, mix: NaN };
const codeLabels = new Map<string, HTMLCanvasElement>();
function codeLabel(id: string, category: string) {
  const key = id + state.light;
  if (!codeLabels.has(key)) {
    const label = document.createElement("canvas"),
      c = label.getContext("2d")!;
    c.font = "11px Mono";
    label.width = Math.ceil(c.measureText(id).width) + 4;
    label.height = 20;
    c.font = "11px Mono";
    c.fillStyle = labelColor(category);
    c.fillText(id, 2, 14);
    codeLabels.set(key, label);
  }
  return codeLabels.get(key)!;
}
document.fonts.ready.then(() => codeLabels.clear());
setOverlay((t) => {
  direction.style.opacity = state.focus >= 0 ? "1" : "0";
  labelCounter++;
  // O texto só se desloca perceptivelmente durante uma transição. A oscilação
  // lenta atualiza rótulos a 15 Hz; células e fibras continuam em cada quadro.
  const moving =
    state.zoom !== labelView.zoom ||
    state.rotation !== labelView.rotation ||
    state.mix !== labelView.mix ||
    state.opening < 1 ||
    state.flash > 0;
  if (!moving && labelCounter % 4 !== 0) return;
  labelView = { zoom: state.zoom, rotation: state.rotation, mix: state.mix };
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
      let x = innerWidth / 2 + Math.cos(a) * r,
        y =
          innerHeight / 2 -
          0.35 * (state.zoom * state.anchor - 1) * innerHeight -
          Math.sin(a) * r;
      for (const p of placed) if (Math.hypot(x - p.x, y - p.y) < 75) y += 34;
      placed.push({ x, y });
      ctx.font = "600 15px Display";
      ctx.textAlign = "center";
      ctx.fillStyle = labelColor(cat);
      ctx.fillText(`${cat} ${leaves.length}`, x, y);
    }
  } else if (state.zoom >= 8 * (1 + state.mix * (nodes.length / 595 - 1))) {
    nodes.forEach((n, i) => {
      if (n.category === "PUB" && state.mix < 0.5) return;
      const p = screenPosition(i, t);
      if (
        p.x < 30 ||
        p.x > innerWidth - 390 ||
        p.y < 160 ||
        p.y > innerHeight - 100 ||
        i === state.focus
      )
        return;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(-p.angle);
      ctx.textAlign = "right";
      ctx.font = "11px Mono";
      ctx.fillStyle = labelColor(n.category);
      ctx.shadowColor = state.light ? "#ffffff" : "#0b1220";
      ctx.shadowBlur = 0;
      const label = codeLabel(n.id, n.category);
      ctx.drawImage(label, -20 - label.width, -14);
      ctx.restore();
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
        !cited.has(n.id) ||
        (state.mix < 0.5 && !topPublic.includes(n.id))
      )
        return;
      const p = screenPosition(i, t);
      if (
        p.x < 30 ||
        p.x > innerWidth - 380 ||
        p.y < 160 ||
        p.y > innerHeight - 155
      )
        return;
      ctx.save();
      ctx.translate(p.x, p.y);
      const flip = Math.cos(p.angle) < 0;
      ctx.rotate(-p.angle + (flip ? Math.PI : 0));
      ctx.font = "10px Mono";
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
  if (labelCounter % 20 === 0 && !$("#fps").hidden) {
    const s = samples.slice(-120);
    $("#fps").textContent =
      `${(1000 / (s.reduce((a, b) => a + b, 0) / s.length)).toFixed(1)} FPS · ${raw.edges.length} citation fibers`;
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
  configureDocuments: (folder: string) =>
    localStorage.setItem("cascade-documents-root", folder),
  get current() {
    return current;
  },
  get pending() {
    return pending;
  },
};
