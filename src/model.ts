import raw from "../data/cascade-data.json";
import { hierarchy, cluster } from "d3-hierarchy";
export const palette: Record<string, string> = {
  DSGN: "#6ea4ff",
  MATL: "#f2a35b",
  MEAS: "#4fd2a8",
  MNFG: "#e47fb5",
  PROD: "#ad93ff",
  TEST: "#e3cb52",
  W: "#a3b3c4",
  PUB: "#a3b3c4",
};
export type Node = {
  id: string;
  category: string;
  group: string;
  title: string;
  previous: string;
  language: string;
  file: string;
  aliases: string[];
  angle: number;
  mixed: number;
  radius: number;
  incoming: number;
};
const counts = new Map<string, number>();
for (const e of raw.public)
  counts.set(e.target, (counts.get(e.target) || 0) + 1);
export const topPublic = [...counts]
  .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  .slice(0, 40)
  .map((x) => x[0]);
// Anel externo: TODAS as normas publicas, agrupadas por familia (ISO, DIN, ASTM...), familias maiores primeiro.
const firstToken = (id: string) => id.split(/[\s/-]/)[0].replace(/\d+$/, "");
const familySize = new Map<string, number>();
for (const id of counts.keys())
  familySize.set(firstToken(id), (familySize.get(firstToken(id)) || 0) + 1);
export const publicFamily = (id: string) =>
  (familySize.get(firstToken(id)) || 0) >= 3 ? firstToken(id) : "Other";
const natural = new Intl.Collator("en", { numeric: true });
export const publicFamilies = [...new Set([...counts.keys()].map(publicFamily))].sort(
  (a, b) =>
    (a === "Other" ? 1 : 0) - (b === "Other" ? 1 : 0) ||
    [...counts.keys()].filter((id) => publicFamily(id) === b).length -
      [...counts.keys()].filter((id) => publicFamily(id) === a).length,
);
const publicOrder = [...counts.keys()].sort(
  (a, b) =>
    publicFamilies.indexOf(publicFamily(a)) - publicFamilies.indexOf(publicFamily(b)) ||
    natural.compare(a, b),
);
const FAMILY_GAP = 3; // vagas vazias entre familias
const publicSlots = publicOrder.length + FAMILY_GAP * publicFamilies.length;
const publicAngle = new Map(
  publicOrder.map((id, i) => [
    id,
    ((i + FAMILY_GAP * publicFamilies.indexOf(publicFamily(id))) / publicSlots) * Math.PI * 2 - Math.PI / 2 - 0.4, // giro leve: rotulos de familia longe do topo e da base
  ]),
);
export const familyAngle = new Map(
  publicFamilies.map((f) => {
    const a = publicOrder.filter((id) => publicFamily(id) === f).map((id) => publicAngle.get(id)!);
    return [f, (a[0] + a[a.length - 1]) / 2];
  }),
);
export const nodes: Node[] = raw.nodes.map((n) => ({
  ...n,
  mixed: 0,
  radius: 1,
  incoming: raw.edges.filter((e) => e.target === n.id).length,
}));
for (const id of [...counts.keys()].sort())
  nodes.push({
    id,
    category: "PUB",
    group: "Public standards",
    title: `Cited by ${counts.get(id)} standards`,
    previous: "Public standard",
    language: "",
    file: "",
    aliases: [],
    angle: 0,
    mixed: 0,
    radius: 1.18,
    incoming: counts.get(id) || 0,
  });
export const byId = new Map(nodes.map((n, i) => [n.id, i]));
function layout(list: Node[]) {
  const cats = [...new Set(list.map((n) => n.category))].sort();
  const tree = hierarchy<any>({
    name: "root",
    children: cats.map((cat) => ({
      name: cat,
      children: [
        ...new Set(list.filter((n) => n.category === cat).map((n) => n.group)),
      ]
        .sort()
        .map((g) => ({
          name: cat + "/" + g,
          children: list
            .filter((n) => n.category === cat && n.group === g)
            .map((n) => ({ name: n.id })),
        })),
    })),
  });
  tree.sort((a, b) => a.data.name.localeCompare(b.data.name));
  cluster<any>().size([Math.PI * 2, 1])(tree);
  return tree;
}
export const base = layout(nodes.filter((n) => n.category !== "PUB")),
  mixed = layout(nodes);
const baseLeaves = new Map(base.leaves().map((n) => [n.data.name, n])),
  mixedLeaves = new Map(mixed.leaves().map((n) => [n.data.name, n]));
nodes.forEach((n, i) => {
  n.angle =
    n.category === "PUB"
      ? publicAngle.get(n.id)!
      : baseLeaves.get(n.id)!.x! - Math.PI / 2;
  n.mixed = mixedLeaves.get(n.id)!.x! - Math.PI / 2;
});
export type Edge = {
  source: string;
  target: string;
  evidence: string[];
  pages: number[];
  public?: boolean;
  controls: number[][];
};
export const edges: Edge[] = [
  ...raw.edges,
  ...raw.public.map((e) => ({ ...e, public: true })),
].map((e) => {
  const ml = mixedLeaves.get(e.source)!,
    mr = mixedLeaves.get(e.target)!;
  const route = ml.path(mr);
  const controls = route.map((p, j) => {
    const leaf = j === 0 || j === route.length - 1;
    const id = leaf ? byId.get(p.data.name)! : -1;
    let a = p.x! - Math.PI / 2;
    if (id >= 0) a = nodes[id].angle;
    else if (p.data.name === "PUB" || p.data.name.startsWith("PUB/"))
      a = familyAngle.get(publicFamily(e.target))!; // o feixe publico converge na familia
    else {
      const b = base.descendants().find((b) => b.data.name === p.data.name);
      if (b) a = b.x! - Math.PI / 2;
    }
    return [a, p.x! - Math.PI / 2, p.y!, id + 1];
  });
  return { ...e, controls };
});
export { raw };
export const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
