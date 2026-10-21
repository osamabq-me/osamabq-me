// Renders the profile graphics in assets/ from live GitHub data.
//
//   node scripts/render.mjs            live data (needs GITHUB_TOKEN)
//   node scripts/render.mjs --sample   made-up data, for previewing the design
//
// No dependencies: Node 18+ only. Every card is drawn in a light and a dark
// version so the README can pick the one matching the reader's GitHub theme.
// If anything fails, nothing is written, so the last good images stay up.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = process.argv.find((a) => a.startsWith("--out="))?.slice(6) || path.join(ROOT, "assets");
const SAMPLE = process.argv.includes("--sample");
const config = JSON.parse(await readFile(path.join(ROOT, "profile.config.json"), "utf8"));

// ---------------------------------------------------------------- theme ---

// Colour themes. Pick one with "theme" in profile.config.json.
// Each theme sets the accent and the five calendar shades; neutrals are shared.
const PRESETS = {
  teal:     { light: ["#0f766e", ["#efece6", "#b6dcd4", "#6cbcae", "#2a9384", "#0d5c53"]], dark: ["#2dd4bf", ["#1b2129", "#0f4a43", "#13756a", "#1fa593", "#5eead4"]] },
  ocean:    { light: ["#2563eb", ["#eceff4", "#c3d5f5", "#86aaec", "#3f74d8", "#1e48a8"]], dark: ["#60a5fa", ["#1b2129", "#13315c", "#1d4e8f", "#2f74cc", "#8cc2ff"]] },
  violet:   { light: ["#6d28d9", ["#f0edf6", "#d9ccf3", "#b096e8", "#7d57d6", "#5128a8"]], dark: ["#a78bfa", ["#1d1b26", "#2f2459", "#47358c", "#6e52d2", "#c0adff"]] },
  amber:    { light: ["#b45309", ["#f3efe7", "#f5dca9", "#eeb65a", "#d6891c", "#97590b"]], dark: ["#fbbf24", ["#1f1d17", "#4a3511", "#7a5713", "#c28719", "#fcd34d"]] },
  rose:     { light: ["#be123c", ["#f5eef0", "#f5c8d1", "#ec90a5", "#d64b6c", "#9f1239"]], dark: ["#fb7185", ["#211b1d", "#4c1d2a", "#7d2740", "#c43a5d", "#fda4b4"]] },
  github:   { light: ["#1a7f37", ["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"]], dark: ["#3fb950", ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"]] },
  graphite: { light: ["#27272a", ["#efefef", "#d0d0d0", "#a3a3a3", "#6b6b6b", "#2b2b2b"]], dark: ["#e4e4e7", ["#1b1b1d", "#333336", "#55555a", "#8a8a90", "#d8d8dc"]] },
};
const BASE = {
  light: { bg: "#ffffff", border: "#e4e1d9", ink: "#1c1b19", muted: "#6b675f", faint: "#a29d93", track: "#efece6", tile: "#f7f6f3", tileBorder: "#e7e3da" },
  dark: { bg: "#0d1117", border: "#262c36", ink: "#e6edf3", muted: "#8b949e", faint: "#5b636d", track: "#1b2129", tile: "#161b22", tileBorder: "#262c36" },
};
const blend = (a, b, w) => "#" + [1, 3, 5].map((i) => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - w) + parseInt(b.slice(i, i + 2), 16) * w).toString(16).padStart(2, "0")).join("");
const themeArg = process.argv.find((a) => a.startsWith("--theme="))?.slice(8);
const THEME_NAME = themeArg || config.theme || "teal";
if (!PRESETS[THEME_NAME]) throw new Error(`Unknown theme "${THEME_NAME}". Pick one of: ${Object.keys(PRESETS).join(", ")}`);
const THEMES = Object.fromEntries(["light", "dark"].map((m) => {
  const [accent, heat] = PRESETS[THEME_NAME][m];
  return [m, { ...BASE[m], accent, heat, accentSoft: blend(BASE[m].bg, accent, m === "dark" ? 0.18 : 0.1) }];
}));

const W = 840;
const SANS = "'Segoe UI', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, Arial, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace";

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const fmt = (n) => Number(n).toLocaleString("en-US");
// Rough text width; SVGs shown as <img> can't measure text, so layout uses estimates.
const textW = (s, size, mono = false) => [...String(s)].length * size * (mono ? 0.61 : 0.56);

function svg(h, t, body, title) {
  return `<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" width="${W}" height="${h}" viewBox="0 0 ${W} ${h}" role="img" aria-label="${esc(title)}">
<title>${esc(title)}</title>
<rect x="0.5" y="0.5" width="${W - 1}" height="${h - 1}" rx="10" fill="${t.bg}" stroke="${t.border}"/>
${body}
</svg>
`;
}

const label = (x, y, text, t) =>
  `<text x="${x}" y="${y}" font-family="${MONO}" font-size="11" letter-spacing="1.2" fill="${t.muted}">${esc(text.toUpperCase())}</text>`;

// ---------------------------------------------------------------- cards ---

// Isometric projection helpers for the header drawing.
const ISO = (ox, oy) => (x, y, z = 0) => [ox + (x - y) * 0.866, oy + (x + y) * 0.5 - z];
const pts = (a) => a.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

function artLayers(t, mode, h) {
  const L = 84, gap = 50, thick = 8;
  const P = ISO(694, 28);
  const zs = [0, gap, gap * 2].map((z) => z); // bottom (data), middle (services), top (app)
  const base = 2 * gap; // lift everything so the top slab sits near the top edge
  const p = (x, y, z) => { const [a, b] = P(x, y, z); return [a, b + base]; };
  const line = t.accent, faint = mode === "dark" ? 0.5 : 0.35;
  let art = "";

  const slab = (z, name, i) => {
    const top = [p(0, 0, z), p(L, 0, z), p(L, L, z), p(0, L, z)];
    const sideL = [p(0, L, z), p(L, L, z), p(L, L, z - thick), p(0, L, z - thick)];
    const sideR = [p(L, 0, z), p(L, L, z), p(L, L, z - thick), p(L, 0, z - thick)];
    let g = `<polygon points="${pts(sideL)}" fill="${t.tileBorder}" stroke="${line}" stroke-opacity="${faint}" stroke-width="1"/>`;
    g += `<polygon points="${pts(sideR)}" fill="${t.tile}" stroke="${line}" stroke-opacity="${faint}" stroke-width="1"/>`;
    g += `<polygon points="${pts(top)}" fill="${t.bg}" fill-opacity="0.82" stroke="${line}" stroke-opacity="${faint + 0.15}" stroke-width="1.2"/>`;
    // label along the front-left edge
    const [lx, ly] = p(4, L, z - thick);
    g += `<text transform="translate(${(lx - 2).toFixed(1)} ${(ly + 11).toFixed(1)}) rotate(30)" font-family="${MONO}" font-size="9" letter-spacing="1.5" fill="${t.muted}">${name}</text>`;
    return g;
  };
  // bottom: data (cylinders)
  art += slab(zs[0], "DATA", 0);
  const cyl = (x, y, z) => {
    const [cx, cy] = p(x, y, z), rx = 9, ry = 4.5, hh = 12;
    return `<path d="M${cx - rx},${cy} v-${hh} a${rx},${ry} 0 0 1 ${2 * rx},0 v${hh} a${rx},${ry} 0 0 1 -${2 * rx},0z" fill="${t.tile}" stroke="${line}" stroke-opacity="${faint + 0.2}"/><ellipse cx="${cx}" cy="${cy - hh}" rx="${rx}" ry="${ry}" fill="${t.bg}" stroke="${line}" stroke-opacity="${faint + 0.2}"/>`;
  };
  art += cyl(30, 46, zs[0]) + cyl(54, 46, zs[0]) + cyl(42, 66, zs[0]);
  // middle: services (connected nodes)
  art += slab(zs[1], "API", 1);
  const nodes = [[16, 26], [34, 52], [56, 36], [70, 64]].map(([x, y]) => p(x, y, zs[1]));
  art += `<polyline points="${pts(nodes)}" fill="none" stroke="${line}" stroke-width="1.5" stroke-opacity="0.8"/>`;
  art += nodes.map(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.2" fill="${t.bg}" stroke="${line}" stroke-width="1.5"/>`).join("");
  // top: app (two screens)
  art += slab(zs[2], "APP", 2);
  const panel = (x, y, w, d, z) => [p(x, y, z), p(x + w, y, z), p(x + w, y + d, z), p(x, y + d, z)];
  art += `<polygon points="${pts(panel(12, 12, 38, 28, zs[2]))}" fill="${t.accentSoft}" stroke="${line}" stroke-opacity="0.7"/>`;
  art += `<polygon points="${pts(panel(12, 46, 38, 26, zs[2]))}" fill="${t.tile}" stroke="${line}" stroke-opacity="0.5"/>`;
  art += `<polygon points="${pts(panel(56, 12, 18, 60, zs[2]))}" fill="${t.tile}" stroke="${line}" stroke-opacity="0.5"/>`;
  // a shield beside the stack: security across every layer
  const [sx, sy] = p(L + 26, 4, zs[1] + 8);
  art += `<g transform="translate(${sx.toFixed(1)} ${sy.toFixed(1)})"><path d="M0,-17 L14,-11 V0 C14,9 7,15 0,18 C-7,15 -14,9 -14,0 V-11 Z" fill="${t.bg}" stroke="${line}" stroke-width="1.5"/><path d="M-5,0 L-1,4 L6,-5" fill="none" stroke="${line}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></g>`;
  // a request travelling app -> services -> data and back
  const [a1, a2] = p(31, 26, zs[2]), m = nodes, [d1, d2] = p(42, 56, zs[0] + 12);
  const route = `M${a1.toFixed(1)},${a2.toFixed(1)} L${m[0][0].toFixed(1)},${m[0][1].toFixed(1)} L${m[1][0].toFixed(1)},${m[1][1].toFixed(1)} L${m[2][0].toFixed(1)},${m[2][1].toFixed(1)} L${m[3][0].toFixed(1)},${m[3][1].toFixed(1)} L${d1.toFixed(1)},${d2.toFixed(1)}`;
  art += `<circle r="4" fill="${mode === "dark" ? "#fbbf24" : "#f59e0b"}"><animateMotion dur="5s" repeatCount="indefinite" keyPoints="0;1;0" keyTimes="0;0.5;1" calcMode="linear" path="${route}"/></circle>`;

  return art;
}

// Shared soft background for every header drawing: a dotted field and a glow.
function backdrop(t, mode, h) {
  return `<defs><pattern id="dots" width="14" height="14" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r="1" fill="${t.faint}" opacity="${mode === "dark" ? 0.35 : 0.45}"/></pattern>
<radialGradient id="fadeG"><stop offset="0" stop-color="#fff" stop-opacity="1"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
<mask id="fade"><rect x="500" y="0" width="340" height="${h}" fill="url(#fadeG)"/></mask>
<radialGradient id="glow"><stop offset="0" stop-color="${t.accent}" stop-opacity="${mode === "dark" ? 0.22 : 0.12}"/><stop offset="1" stop-color="${t.accent}" stop-opacity="0"/></radialGradient></defs>
<rect x="500" y="1" width="339" height="${h - 2}" fill="url(#dots)" mask="url(#fade)"/>
<ellipse cx="700" cy="${h / 2}" rx="170" ry="110" fill="url(#glow)"/>`;
}
const spark = (mode) => (mode === "dark" ? "#fbbf24" : "#f59e0b");
const f1 = (n) => n.toFixed(1);

// Data pipeline: three sources flow into a model, which feeds a live dashboard.
function artPipeline(t, mode, h) {
  const cx = 690, cy = h / 2, line = t.accent, op = mode === "dark" ? 0.55 : 0.45;
  let a = "";
  const srcY = [cy - 62, cy, cy + 62], sx = 588;
  const paths = srcY.map((y) => `M${sx + 16},${y} C${sx + 60},${y} ${cx - 60},${cy} ${cx - 26},${cy}`);
  paths.forEach((d) => (a += `<path d="${d}" fill="none" stroke="${line}" stroke-opacity="${op}" stroke-width="1.5"/>`));
  const out = `M${cx + 26},${cy} L${cx + 58},${cy}`;
  a += `<path d="${out}" fill="none" stroke="${line}" stroke-opacity="${op}" stroke-width="1.5"/>`;
  // sources: small database stacks
  srcY.forEach((y) => {
    a += `<g transform="translate(${sx} ${y})"><path d="M-14,-9 v18 a14,5 0 0 0 28,0 v-18" fill="${t.tile}" stroke="${line}" stroke-opacity="0.7"/><ellipse cx="0" cy="-9" rx="14" ry="5" fill="${t.bg}" stroke="${line}" stroke-opacity="0.7"/><path d="M-14,0 a14,5 0 0 0 28,0" fill="none" stroke="${line}" stroke-opacity="0.4"/></g>`;
  });
  // model: hexagon with a spinning ring
  const hex = [0, 1, 2, 3, 4, 5].map((i) => [cx + 26 * Math.cos(Math.PI / 6 + (i * Math.PI) / 3), cy + 26 * Math.sin(Math.PI / 6 + (i * Math.PI) / 3)]);
  a += `<polygon points="${pts(hex)}" fill="${t.accentSoft}" stroke="${line}" stroke-width="1.5"/>`;
  a += `<circle cx="${cx}" cy="${cy}" r="11" fill="none" stroke="${line}" stroke-width="2" stroke-dasharray="14 6"><animateTransform attributeName="transform" type="rotate" from="0 ${cx} ${cy}" to="360 ${cx} ${cy}" dur="6s" repeatCount="indefinite"/></circle>`;
  a += `<text x="${cx}" y="${cy + 44}" text-anchor="middle" font-family="${MONO}" font-size="9" letter-spacing="1.5" fill="${t.muted}">MODEL</text>`;
  // dashboard card with bars that keep updating
  const dx = cx + 58, dy = cy - 46, dw = 66, dh = 92;
  a += `<rect x="${dx}" y="${dy}" width="${dw}" height="${dh}" rx="9" fill="${t.bg}" stroke="${line}" stroke-opacity="0.7"/>`;
  a += `<rect x="${dx + 8}" y="${dy + 9}" width="26" height="4" rx="2" fill="${t.faint}"/>`;
  const bars = [[0.45, 0.8, 0.55], [0.7, 0.4, 0.85], [0.35, 0.65, 0.5], [0.9, 0.6, 0.75]];
  bars.forEach((v, i) => {
    const bx = dx + 9 + i * 13, base = dy + dh - 10, full = dh - 32;
    const ys = v.map((k) => f1(base - k * full)).concat(f1(base - v[0] * full)).join(";");
    const hs = v.map((k) => f1(k * full)).concat(f1(v[0] * full)).join(";");
    a += `<rect x="${bx}" y="${f1(base - v[0] * full)}" width="9" height="${f1(v[0] * full)}" rx="2" fill="${i === 3 ? line : t.heat[2]}"><animate attributeName="y" values="${ys}" dur="6s" repeatCount="indefinite" calcMode="spline" keySplines=".4 0 .2 1;.4 0 .2 1;.4 0 .2 1" keyTimes="0;.33;.66;1"/><animate attributeName="height" values="${hs}" dur="6s" repeatCount="indefinite" calcMode="spline" keySplines=".4 0 .2 1;.4 0 .2 1;.4 0 .2 1" keyTimes="0;.33;.66;1"/></rect>`;
  });
  a += `<text x="${dx + dw / 2}" y="${dy + dh + 18}" text-anchor="middle" font-family="${MONO}" font-size="9" letter-spacing="1.5" fill="${t.muted}">INSIGHT</text>`;
  // data points travelling through the pipes
  paths.forEach((d, i) => {
    a += `<circle r="3.5" fill="${line}"><animateMotion dur="2.4s" begin="${(i * 0.8).toFixed(1)}s" repeatCount="indefinite" path="${d}"/></circle>`;
  });
  a += `<circle r="3.5" fill="${spark(mode)}"><animateMotion dur="1.2s" begin="0.4s" repeatCount="indefinite" path="${out}"/></circle>`;
  return a;
}

// Secure network: requests travel to a shield; trusted ones pass, one bad one is stopped.
function artNetwork(t, mode, h) {
  const cx = 700, cy = h / 2, R = 88, line = t.accent, op = mode === "dark" ? 0.5 : 0.4;
  const n = 8, nodes = [...Array(n)].map((_, i) => { const ang = (i / n) * Math.PI * 2 - Math.PI / 2 + 0.2; return [cx + R * Math.cos(ang) * 1.12, cy + R * Math.sin(ang) * 0.92]; });
  let a = "";
  nodes.forEach(([x, y], i) => {
    const [x2, y2] = nodes[(i + 1) % n];
    a += `<line x1="${f1(x)}" y1="${f1(y)}" x2="${f1(x2)}" y2="${f1(y2)}" stroke="${line}" stroke-opacity="${op * 0.6}"/>`;
    a += `<line x1="${f1(x)}" y1="${f1(y)}" x2="${cx}" y2="${cy}" stroke="${line}" stroke-opacity="${op}" stroke-dasharray="3 4"/>`;
  });
  // pulse rings around the shield
  [0, 1.2].forEach((d) => (a += `<circle cx="${cx}" cy="${cy}" r="30" fill="none" stroke="${line}" stroke-width="1.5" opacity="0"><animate attributeName="r" values="30;62" dur="2.4s" begin="${d}s" repeatCount="indefinite"/><animate attributeName="opacity" values=".55;0" dur="2.4s" begin="${d}s" repeatCount="indefinite"/></circle>`));
  nodes.forEach(([x, y], i) => (a += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${i % 3 === 0 ? 6 : 4.5}" fill="${t.bg}" stroke="${line}" stroke-width="1.5"/>`));
  // trusted requests flowing in
  [0, 2, 4, 6].forEach((k, i) => {
    const [x, y] = nodes[k];
    a += `<circle r="3.2" fill="${line}"><animateMotion dur="2s" begin="${(i * 0.5).toFixed(1)}s" repeatCount="indefinite" path="M${f1(x)},${f1(y)} L${cx},${cy}"/></circle>`;
  });
  // one blocked request: stops at the shield edge and fades
  const [bx, by] = nodes[3], ex = cx + (bx - cx) * 0.4, ey = cy + (by - cy) * 0.4;
  a += `<circle r="3.6" fill="#ef4444"><animateMotion dur="3s" repeatCount="indefinite" keyPoints="0;1;1" keyTimes="0;.6;1" calcMode="linear" path="M${f1(bx)},${f1(by)} L${f1(ex)},${f1(ey)}"/><animate attributeName="opacity" values="1;1;0;0" keyTimes="0;.6;.75;1" dur="3s" repeatCount="indefinite"/></circle>`;
  a += `<g transform="translate(${f1(ex)} ${f1(ey)})" opacity="0"><path d="M-4,-4 L4,4 M4,-4 L-4,4" stroke="#ef4444" stroke-width="2" stroke-linecap="round"/><animate attributeName="opacity" values="0;0;1;0" keyTimes="0;.6;.7;1" dur="3s" repeatCount="indefinite"/></g>`;
  // the shield
  a += `<g transform="translate(${cx} ${cy})"><path d="M0,-26 L21,-17 V0 C21,14 11,23 0,27 C-11,23 -21,14 -21,0 V-17 Z" fill="${t.accentSoft}" stroke="${line}" stroke-width="2"/><path d="M-8,0 L-2,6 L9,-7" fill="none" stroke="${line}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></g>`;
  return a;
}

// Vault: a bank vault door whose dial turns as transactions are stored.
function artVault(t, mode, h) {
  const cx = 704, cy = h / 2, line = t.accent;
  let a = "";
  a += `<rect x="${cx - 78}" y="${cy - 78}" width="156" height="156" rx="18" fill="${t.tile}" stroke="${line}" stroke-opacity="0.5"/>`;
  a += `<circle cx="${cx}" cy="${cy}" r="62" fill="${t.bg}" stroke="${line}" stroke-width="2"/>`;
  for (let i = 0; i < 12; i++) { const ang = (i / 12) * Math.PI * 2; a += `<circle cx="${f1(cx + 54 * Math.cos(ang))}" cy="${f1(cy + 54 * Math.sin(ang))}" r="2.6" fill="${line}" fill-opacity="0.6"/>`; }
  a += `<g><animateTransform attributeName="transform" type="rotate" values="0 ${cx} ${cy};120 ${cx} ${cy};120 ${cx} ${cy};-60 ${cx} ${cy};-60 ${cx} ${cy};0 ${cx} ${cy}" keyTimes="0;.25;.4;.65;.8;1" dur="6s" repeatCount="indefinite"/>`;
  a += `<circle cx="${cx}" cy="${cy}" r="34" fill="${t.accentSoft}" stroke="${line}" stroke-width="1.5"/>`;
  for (let i = 0; i < 24; i++) { const ang = (i / 24) * Math.PI * 2, r1 = i % 3 === 0 ? 26 : 29; a += `<line x1="${f1(cx + r1 * Math.cos(ang))}" y1="${f1(cy + r1 * Math.sin(ang))}" x2="${f1(cx + 33 * Math.cos(ang))}" y2="${f1(cy + 33 * Math.sin(ang))}" stroke="${line}" stroke-width="1.2"/>`; }
  a += `<circle cx="${cx}" cy="${cy - 22}" r="3" fill="${spark(mode)}"/></g>`;
  a += `<circle cx="${cx}" cy="${cy}" r="8" fill="${line}"/>`;
  // status light
  a += `<circle cx="${cx + 64}" cy="${cy - 64}" r="4" fill="#22c55e"><animate attributeName="opacity" values="1;.35;1" dur="1.6s" repeatCount="indefinite"/></circle>`;
  // transactions sliding into the vault
  [0, 1, 2].forEach((i) => {
    const y = cy - 30 + i * 30;
    a += `<g opacity="0"><rect x="0" y="${y - 7}" width="34" height="14" rx="4" fill="${t.bg}" stroke="${line}"/><rect x="5" y="${y - 2}" width="14" height="4" rx="2" fill="${line}"/>`;
    a += `<animateTransform attributeName="transform" type="translate" values="560 0;600 0;618 0" keyTimes="0;.7;1" dur="3s" begin="${i}s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;1;1;0" keyTimes="0;.15;.75;1" dur="3s" begin="${i}s" repeatCount="indefinite"/></g>`;
  });
  return a;
}

// Terminal: a deploy runs and passes its checks, line by line, on a loop.
function artTerminal(t, mode, h) {
  const x = 590, y = 42, w = 228, hh = 168, line = t.accent;
  const ok = mode === "dark" ? "#4ade80" : "#15803d";
  const lines = [
    ["$ ", "./deploy --env prod", t.ink],
    ["✓ ", "tests passed (128)", ok],
    ["✓ ", "security scan clean", ok],
    ["✓ ", "migrations applied", ok],
    ["✓ ", "deployed in 42s", ok],
  ];
  let a = `<rect x="${x}" y="${y}" width="${w}" height="${hh}" rx="12" fill="${t.bg}" stroke="${line}" stroke-opacity="0.55"/>`;
  a += `<path d="M${x},${y + 28} H${x + w}" stroke="${line}" stroke-opacity="0.3"/>`;
  ["#ef4444", "#f59e0b", "#22c55e"].forEach((c, i) => (a += `<circle cx="${x + 16 + i * 14}" cy="${y + 14}" r="4" fill="${c}" opacity="0.85"/>`));
  a += `<text x="${x + w - 12}" y="${y + 18}" text-anchor="end" font-family="${MONO}" font-size="9" fill="${t.faint}">bash</text>`;
  const D = 10, step = 1.4;
  lines.forEach(([pre, txt, col], i) => {
    const ly = y + 54 + i * 22, start = 0.6 + i * step, end = start + (i === 0 ? 1.0 : 0.5), wfull = 9 + (pre + txt).length * 6.8;
    const k = (s) => (s / D).toFixed(3);
    a += `<clipPath id="tl${i}"><rect x="${x + 14}" y="${ly - 13}" height="18" width="0"><animate attributeName="width" values="0;0;${wfull};${wfull};0" keyTimes="0;${k(start)};${k(end)};.94;1" dur="${D}s" repeatCount="indefinite"/></rect></clipPath>`;
    a += `<text clip-path="url(#tl${i})" x="${x + 14}" y="${ly}" font-family="${MONO}" font-size="11.5"><tspan fill="${i === 0 ? line : col}">${esc(pre)}</tspan><tspan fill="${i === 0 ? t.ink : t.muted}">${esc(txt)}</tspan></text>`;
  });
  const cyEnd = y + 54 + lines.length * 22;
  a += `<rect x="${x + 14}" y="${cyEnd - 11}" width="7" height="13" fill="${line}"><animate attributeName="opacity" values="1;0;1" dur="1s" repeatCount="indefinite"/></rect>`;
  return a;
}

// Secure pipeline: data leaves the databases, passes a security shield (one bad
// packet is stopped), runs through the model and comes out as insight.
function artSecure(t, mode, h) {
  const cy = h / 2, line = t.accent, op = mode === "dark" ? 0.55 : 0.45;
  const sx = 508, shx = 604, mx = 692, dx = 742;
  let a = "";
  const srcY = [cy - 50, cy, cy + 50];
  const inPaths = srcY.map((y) => `M${sx + 15},${y} C${sx + 50},${y} ${shx - 52},${cy} ${shx - 24},${cy}`);
  inPaths.forEach((d) => (a += `<path d="${d}" fill="none" stroke="${line}" stroke-opacity="${op}" stroke-width="1.5"/>`));
  const mid = `M${shx + 24},${cy} L${mx - 26},${cy}`, out = `M${mx + 26},${cy} L${dx},${cy}`;
  a += `<path d="${mid}" stroke="${line}" stroke-opacity="${op}" stroke-width="1.5"/><path d="${out}" stroke="${line}" stroke-opacity="${op}" stroke-width="1.5"/>`;
  srcY.forEach((y) => (a += `<g transform="translate(${sx} ${y})"><path d="M-14,-9 v18 a14,5 0 0 0 28,0 v-18" fill="${t.tile}" stroke="${line}" stroke-opacity="0.7"/><ellipse cx="0" cy="-9" rx="14" ry="5" fill="${t.bg}" stroke="${line}" stroke-opacity="0.7"/><path d="M-14,0 a14,5 0 0 0 28,0" fill="none" stroke="${line}" stroke-opacity="0.4"/></g>`));
  // shield with pulse rings
  [0, 1.2].forEach((d) => (a += `<circle cx="${shx}" cy="${cy}" r="24" fill="none" stroke="${line}" stroke-width="1.5" opacity="0"><animate attributeName="r" values="24;46" dur="2.4s" begin="${d}s" repeatCount="indefinite"/><animate attributeName="opacity" values=".5;0" dur="2.4s" begin="${d}s" repeatCount="indefinite"/></circle>`));
  a += `<g transform="translate(${shx} ${cy})"><path d="M0,-24 L19,-16 V0 C19,13 10,21 0,25 C-10,21 -19,13 -19,0 V-16 Z" fill="${t.accentSoft}" stroke="${line}" stroke-width="2"/><path d="M-7,0 L-2,5 L8,-6" fill="none" stroke="${line}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></g>`;
  // model
  const hex = [0, 1, 2, 3, 4, 5].map((i) => [mx + 24 * Math.cos(Math.PI / 6 + (i * Math.PI) / 3), cy + 24 * Math.sin(Math.PI / 6 + (i * Math.PI) / 3)]);
  a += `<polygon points="${pts(hex)}" fill="${t.accentSoft}" stroke="${line}" stroke-width="1.5"/>`;
  a += `<circle cx="${mx}" cy="${cy}" r="10" fill="none" stroke="${line}" stroke-width="2" stroke-dasharray="13 5"><animateTransform attributeName="transform" type="rotate" from="0 ${mx} ${cy}" to="360 ${mx} ${cy}" dur="6s" repeatCount="indefinite"/></circle>`;
  // dashboard
  const dy = cy - 44, dw = 64, dh = 88;
  a += `<rect x="${dx}" y="${dy}" width="${dw}" height="${dh}" rx="9" fill="${t.bg}" stroke="${line}" stroke-opacity="0.7"/><rect x="${dx + 8}" y="${dy + 9}" width="24" height="4" rx="2" fill="${t.faint}"/>`;
  [[0.45, 0.8, 0.55], [0.7, 0.4, 0.85], [0.35, 0.65, 0.5], [0.9, 0.6, 0.75]].forEach((v, i) => {
    const bx = dx + 9 + i * 12.5, base = dy + dh - 10, full = dh - 30;
    const ys = v.map((k) => f1(base - k * full)).concat(f1(base - v[0] * full)).join(";"), hs = v.map((k) => f1(k * full)).concat(f1(v[0] * full)).join(";");
    const sp = `calcMode="spline" keySplines=".4 0 .2 1;.4 0 .2 1;.4 0 .2 1" keyTimes="0;.33;.66;1"`;
    a += `<rect x="${f1(bx)}" y="${f1(base - v[0] * full)}" width="8.5" height="${f1(v[0] * full)}" rx="2" fill="${i === 3 ? line : t.heat[2]}"><animate attributeName="y" values="${ys}" dur="6s" repeatCount="indefinite" ${sp}/><animate attributeName="height" values="${hs}" dur="6s" repeatCount="indefinite" ${sp}/></rect>`;
  });
  // stage labels
  [[sx, "DATA"], [shx, "VERIFY"], [mx, "MODEL"], [dx + dw / 2, "INSIGHT"]].forEach(([x, lb]) => (a += `<text x="${x}" y="${cy + 84}" text-anchor="middle" font-family="${MONO}" font-size="9" letter-spacing="1.5" fill="${t.muted}">${lb}</text>`));
  // trusted packets, then onward
  inPaths.forEach((d, i) => { if (i !== 2) a += `<circle r="3.4" fill="${line}"><animateMotion dur="2.2s" begin="${(i * 0.7).toFixed(1)}s" repeatCount="indefinite" path="${d}"/></circle>`; });
  a += `<circle r="3.4" fill="${line}"><animateMotion dur="1.1s" begin="0.3s" repeatCount="indefinite" path="${mid}"/></circle>`;
  a += `<circle r="3.4" fill="${spark(mode)}"><animateMotion dur="0.9s" begin="0.6s" repeatCount="indefinite" path="${out}"/></circle>`;
  // the blocked packet on the lower path
  a += `<circle r="3.6" fill="#ef4444"><animateMotion dur="3s" repeatCount="indefinite" keyPoints="0;0.86;0.86" keyTimes="0;.6;1" calcMode="linear" path="${inPaths[2]}"/><animate attributeName="opacity" values="1;1;0;0" keyTimes="0;.6;.75;1" dur="3s" repeatCount="indefinite"/></circle>`;
  a += `<g transform="translate(${shx - 30} ${cy + 14})" opacity="0"><path d="M-4,-4 L4,4 M4,-4 L-4,4" stroke="#ef4444" stroke-width="2.2" stroke-linecap="round"/><animate attributeName="opacity" values="0;0;1;0" keyTimes="0;.6;.7;1" dur="3s" repeatCount="indefinite"/></g>`;
  return a;
}

// Product flow: data -> backend -> API -> protect -> user interface (the build).
// A second loop runs data -> pipeline -> insight and feeds back into the
// interface, so analytics powers the product. The shield stops an outside attack.
// Captions tell the OSTA story: architecture, secure, automation -> AI.
function artFlow(t, mode, h) {
  const line = t.accent, op = mode === "dark" ? 0.55 : 0.45, amber = spark(mode);
  const topY = 92, botY = 214, dX = 500, dY = 146;
  const xs = { backend: 572, api: 640, protect: 708, ui: 782 }, pipeX = 598, insX = 700;
  let a = "";
  const L = (d, o = op) => `<path d="${d}" fill="none" stroke="${line}" stroke-opacity="${o}" stroke-width="1.5"/>`;
  const pData1 = `M${dX + 18},${dY - 8} C${dX + 44},${dY - 8} ${xs.backend - 50},${topY} ${xs.backend - 22},${topY}`;
  const pBA = `M${xs.backend + 22},${topY} L${xs.api - 20},${topY}`;
  const pAP = `M${xs.api + 20},${topY} L${xs.protect - 20},${topY}`;
  const pPU = `M${xs.protect + 20},${topY} L${xs.ui - 27},${topY}`;
  const pData2 = `M${dX + 18},${dY + 8} C${dX + 50},${dY + 8} ${pipeX - 56},${botY} ${pipeX - 22},${botY}`;
  const pPI = `M${pipeX + 22},${botY} L${insX - 29},${botY}`;
  // insight feeds back up into the interface, along its right side
  const rx = xs.ui + 40;
  const pBack = `M${insX + 29},${botY} L${rx - 18},${botY} C${rx - 4},${botY} ${rx},${botY - 6} ${rx},${botY - 20} L${rx},${topY + 16} C${rx},${topY + 4} ${rx - 4},${topY} ${xs.ui + 32},${topY}`;
  a += L(pData1) + L(pBA) + L(pAP) + L(pPU) + L(pData2) + L(pPI);
  a += `<path d="${pBack}" fill="none" stroke="${line}" stroke-opacity="${op}" stroke-width="1.5" stroke-dasharray="4 4"/>`;
  a += `<path d="M${xs.ui + 28},${topY} l6,-4 v8 z" fill="${line}" fill-opacity="${op + 0.2}"/>`;
  // data: one database
  a += `<g transform="translate(${dX} ${dY})"><path d="M-18,-16 v32 a18,6 0 0 0 36,0 v-32" fill="${t.tile}" stroke="${line}" stroke-opacity="0.75"/><ellipse cx="0" cy="-16" rx="18" ry="6" fill="${t.bg}" stroke="${line}" stroke-opacity="0.75"/><path d="M-18,-5 a18,6 0 0 0 36,0 M-18,6 a18,6 0 0 0 36,0" fill="none" stroke="${line}" stroke-opacity="0.45"/></g>`;
  // backend: a server with blinking lights
  a += `<g transform="translate(${xs.backend} ${topY})"><rect x="-21" y="-20" width="42" height="40" rx="7" fill="${t.tile}" stroke="${line}" stroke-opacity="0.75"/>`;
  [-11, 0, 11].forEach((y, i) => (a += `<rect x="-15" y="${y - 3.5}" width="20" height="7" rx="2" fill="${t.bg}" stroke="${line}" stroke-opacity="0.4"/><circle cx="11" cy="${y}" r="2.2" fill="#22c55e"><animate attributeName="opacity" values="1;.25;1" dur="${1.2 + i * 0.4}s" repeatCount="indefinite"/></circle>`));
  a += `</g>`;
  // API: braces
  a += `<g transform="translate(${xs.api} ${topY})"><rect x="-20" y="-20" width="40" height="40" rx="10" fill="${t.accentSoft}" stroke="${line}" stroke-width="1.5"/><path d="M-5,-10 c-4,0 -4,2 -4,5 v2 c0,2 -1,3 -3,3 c2,0 3,1 3,3 v2 c0,3 0,5 4,5 M5,-10 c4,0 4,2 4,5 v2 c0,2 1,3 3,3 c-2,0 -3,1 -3,3 v2 c0,3 0,5 -4,5" fill="none" stroke="${line}" stroke-width="1.8" stroke-linecap="round"/></g>`;
  // protect: shield with pulse rings
  [0, 1.2].forEach((dl) => (a += `<circle cx="${xs.protect}" cy="${topY}" r="22" fill="none" stroke="${line}" stroke-width="1.5" opacity="0"><animate attributeName="r" values="22;40" dur="2.4s" begin="${dl}s" repeatCount="indefinite"/><animate attributeName="opacity" values=".5;0" dur="2.4s" begin="${dl}s" repeatCount="indefinite"/></circle>`));
  a += `<g transform="translate(${xs.protect} ${topY})"><path d="M0,-22 L17,-15 V0 C17,12 9,19 0,23 C-9,19 -17,12 -17,0 V-15 Z" fill="${t.accentSoft}" stroke="${line}" stroke-width="2"/><path d="M-6,0 L-1.5,4.5 L7,-5" fill="none" stroke="${line}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></g>`;
  // user interface: an app window
  a += `<g transform="translate(${xs.ui} ${topY})"><rect x="-27" y="-22" width="54" height="44" rx="7" fill="${t.bg}" stroke="${line}" stroke-opacity="0.8"/><path d="M-27,-12 H27" stroke="${line}" stroke-opacity="0.4"/>`;
  [-21, -16, -11].forEach((x) => (a += `<circle cx="${x}" cy="-17" r="1.6" fill="${t.faint}"/>`));
  a += `<rect x="-21" y="-6" width="18" height="22" rx="3" fill="${t.accentSoft}"/><rect x="1" y="-6" width="20" height="5" rx="2" fill="${t.heat[2]}"/><rect x="1" y="2" width="14" height="5" rx="2" fill="${t.heat[1]}"/><rect x="1" y="10" width="17" height="5" rx="2" fill="${t.heat[1]}"/></g>`;
  // pipeline: a funnel that cleans and moves data automatically
  a += `<g transform="translate(${pipeX} ${botY})"><rect x="-21" y="-20" width="42" height="40" rx="9" fill="${t.tile}" stroke="${line}" stroke-opacity="0.75"/><path d="M-12,-10 H12 L4,0 V9 L-4,12 V0 Z" fill="${t.accentSoft}" stroke="${line}" stroke-width="1.6" stroke-linejoin="round"/>`;
  [0, 0.5, 1].forEach((b) => (a += `<circle cx="0" cy="-7" r="1.6" fill="${line}" opacity="0"><animate attributeName="cy" values="-7;10" dur="1.5s" begin="${b}s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;1;1;0" keyTimes="0;.2;.8;1" dur="1.5s" begin="${b}s" repeatCount="indefinite"/></circle>`));
  a += `</g>`;
  // insight: a dashboard with live bars, plus an AI spark
  const ix = insX - 28, iy = botY - 26, iw = 58, ih = 52;
  a += `<rect x="${ix}" y="${iy}" width="${iw}" height="${ih}" rx="8" fill="${t.bg}" stroke="${line}" stroke-opacity="0.75"/>`;
  [[0.5, 0.85, 0.6], [0.75, 0.45, 0.9], [0.35, 0.7, 0.5], [0.9, 0.6, 0.8]].forEach((v, i) => {
    const bx = ix + 8 + i * 11.5, base = iy + ih - 8, full = ih - 18;
    const ys = v.map((k) => f1(base - k * full)).concat(f1(base - v[0] * full)).join(";"), hs = v.map((k) => f1(k * full)).concat(f1(v[0] * full)).join(";");
    const sp = `calcMode="spline" keySplines=".4 0 .2 1;.4 0 .2 1;.4 0 .2 1" keyTimes="0;.33;.66;1"`;
    a += `<rect x="${f1(bx)}" y="${f1(base - v[0] * full)}" width="8" height="${f1(v[0] * full)}" rx="2" fill="${i === 3 ? line : t.heat[2]}"><animate attributeName="y" values="${ys}" dur="6s" repeatCount="indefinite" ${sp}/><animate attributeName="height" values="${hs}" dur="6s" repeatCount="indefinite" ${sp}/></rect>`;
  });
  a += `<path transform="translate(${ix + iw} ${iy})" d="M0,-7 L1.8,-1.8 L7,0 L1.8,1.8 L0,7 L-1.8,1.8 L-7,0 L-1.8,-1.8 Z" fill="${amber}"><animate attributeName="opacity" values="1;.3;1" dur="2s" repeatCount="indefinite"/></path>`;
  // labels
  const lab = (x, y, s) => `<text x="${x}" y="${y}" text-anchor="middle" font-family="${MONO}" font-size="8.5" letter-spacing="1.3" fill="${t.muted}">${s}</text>`;
  a += lab(dX, dY + 38, "DATA") + lab(xs.backend, topY + 36, "BACKEND") + lab(xs.api, topY + 36, "API") + lab(xs.protect, topY + 36, "PROTECT") + lab(xs.ui, topY + 36, "INTERFACE");
  a += lab(pipeX, botY + 36, "PIPELINE") + lab(insX + 1, botY + 42, "INSIGHT");
  // captions: what each part of the system stands for
  const cap = (x, y, s) => `<text x="${x}" y="${y}" text-anchor="middle" font-family="${MONO}" font-size="7.5" letter-spacing="1.5" fill="${line}" fill-opacity="0.75">${s}</text>`;
  a += cap((xs.backend + xs.api) / 2, topY - 38, "ARCHITECTURE") + `<path d="M${xs.backend - 20},${topY - 33} H${xs.api + 20}" stroke="${line}" stroke-opacity="0.25"/>`;
  a += cap(xs.protect - 4, topY - 38, "SECURE");
  a += cap((pipeX + insX) / 2, botY + 62, "AUTOMATION → AI");
  // traffic along the main flow
  const seq = [[pData1, 1.4, 0], [pBA, 0.7, 0.3], [pAP, 0.7, 0.6], [pPU, 0.8, 0.9]];
  seq.forEach(([d, dur, b]) => (a += `<circle r="3.3" fill="${line}"><animateMotion dur="${dur}s" begin="${b}s" repeatCount="indefinite" path="${d}"/></circle>`));
  // data travelling through the insight loop and back to the product
  a += `<circle r="3.3" fill="${line}"><animateMotion dur="1.6s" begin="0.2s" repeatCount="indefinite" path="${pData2}"/></circle>`;
  a += `<circle r="3.3" fill="${line}"><animateMotion dur="0.9s" begin="0.5s" repeatCount="indefinite" path="${pPI}"/></circle>`;
  a += `<circle r="3.3" fill="${amber}"><animateMotion dur="2.4s" begin="0.8s" repeatCount="indefinite" path="${pBack}"/></circle>`;
  // an outside attack aimed at the app, stopped at the shield
  const atk = `M${xs.protect + 46},${topY - 72} L${xs.protect + 14},${topY - 16}`;
  a += `<path d="${atk}" fill="none" stroke="#ef4444" stroke-opacity=".35" stroke-dasharray="3 4"/>`;
  a += `<circle r="3.6" fill="#ef4444"><animateMotion dur="3s" repeatCount="indefinite" keyPoints="0;1;1" keyTimes="0;.55;1" calcMode="linear" path="${atk}"/><animate attributeName="opacity" values="1;1;0;0" keyTimes="0;.55;.7;1" dur="3s" repeatCount="indefinite"/></circle>`;
  a += `<g transform="translate(${xs.protect + 14} ${topY - 16})" opacity="0"><path d="M-4,-4 L4,4 M4,-4 L-4,4" stroke="#ef4444" stroke-width="2.2" stroke-linecap="round"/><animate attributeName="opacity" values="0;0;1;0" keyTimes="0;.55;.65;1" dur="3s" repeatCount="indefinite"/></g>`;
  return a;
}

const ARTS = { flow: artFlow, secure: artSecure, layers: artLayers, pipeline: artPipeline, network: artNetwork, vault: artVault, terminal: artTerminal };

function header(t, _d, mode) {
  const h = (["secure", "flow"].includes(config.headerArt) || /--art=(secure|flow)/.test(process.argv.join(" "))) ? 316 : 250;
  const artName = process.argv.find((a) => a.startsWith("--art="))?.slice(6) || config.headerArt || "layers";
  const art = backdrop(t, mode, h) + (ARTS[artName] || ARTS.layers)(t, mode, h);
  const eyebrow = (config.focus || "").toUpperCase().replace(/ · /g, "  ·  ");
  const status = config.status || "";
  const wide = artName === "secure" || artName === "flow";
  const textR = wide ? 420 : 440;
  const wrap = (str, max) => { const out = [""]; for (const w of String(str || "").split(" ")) { if ((out.at(-1) + " " + w).trim().length > max && out.at(-1)) out.push(w); else out[out.length - 1] = (out.at(-1) + " " + w).trim(); } return out.filter(Boolean); };
  const tl = wide ? wrap(config.tagline, 46) : [config.tagline], sl = config.subline ? (wide ? wrap(config.subline, 38) : [config.subline]) : [];
  let yy = 136, taglineSvg = `<g class="rise" style="animation-delay:.16s">`;
  tl.forEach((ln) => { taglineSvg += `<text x="40" y="${yy}" font-family="${SANS}" font-size="15" font-weight="600" fill="${t.ink}">${esc(ln)}</text>`; yy += 21; });
  yy += 1;
  sl.forEach((ln) => { taglineSvg += `<text x="40" y="${yy}" font-family="${SANS}" font-size="13.5" fill="${t.muted}">${esc(ln)}</text>`; yy += 19; });
  taglineSvg += `</g>`;
  const divY = Math.max(188, yy + 12);
  const dotX = textR - textW(status, 10.5, true) - 1.3 * status.length - 14;
  const text = `
<style>
.rise{animation:rise .7s cubic-bezier(.2,.7,.2,1) both}
.pulse{transform-box:fill-box;transform-origin:center;animation:pulse 2.4s ease-out infinite}
@keyframes rise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@keyframes pulse{0%{opacity:.6;transform:scale(1)}100%{opacity:0;transform:scale(3)}}
@media (prefers-reduced-motion:reduce){.rise,.pulse{animation:none}}
</style>
<g class="rise"><text x="40" y="58" font-family="${MONO}" font-size="10.5" letter-spacing="1.3" fill="${t.accent}">${esc(eyebrow)}</text></g>
<g class="rise" style="animation-delay:.08s"><text x="40" y="104" font-family="${SANS}" font-size="38" font-weight="650" letter-spacing="-0.5" fill="${t.ink}">${esc(config.name)}</text></g>
${taglineSvg}
<line x1="40" y1="${divY}" x2="${textR}" y2="${divY}" stroke="${t.border}"/>
<g class="rise" style="animation-delay:.24s"><text x="40" y="${divY + 24}" font-family="${MONO}" font-size="10.5" letter-spacing="1.3" fill="${t.muted}">${esc((config.location || "").toUpperCase())}</text>
${status ? `<circle cx="44" cy="${divY + 44.5}" r="3.5" fill="#22c55e"/><circle class="pulse" cx="44" cy="${divY + 44.5}" r="3.5" fill="#22c55e"/><text x="56" y="${divY + 48}" font-family="${MONO}" font-size="10.5" letter-spacing="1.3" fill="${t.ink}">${esc(status.toUpperCase())}</text>` : ""}</g>`;
  return svg(h, t, art + text, `${config.name}. ${config.tagline} ${config.subline || ""}`);
}

// Logos come from Simple Icons (CC0), baked into scripts/icons.json so the
// daily run needs no install. Items without a logo get a lettered tile.
const ICONS = JSON.parse(await readFile(path.join(ROOT, "scripts", "icons.json"), "utf8"));
const lum = (hex) => {
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
// Brand colours that would vanish on the background fall back to the text colour.
const mix = (hex, w) => "#" + [0, 2, 4].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - w) + 255 * w).toString(16).padStart(2, "0")).join("");
const iconFill = (hex, t, mode) => {
  const l = lum(hex);
  if (mode === "dark") return l < 0.03 ? t.ink : l < 0.25 ? mix(hex, 0.45) : `#${hex}`;
  return l > 0.75 ? t.ink : `#${hex}`;
};

function wrapLabel(text, maxW, size) {
  const tw = (x) => [...x].length * size * 0.52;
  if (tw(text) <= maxW) return [text];
  const words = text.split(" ");
  let a = words[0], i = 1;
  while (i < words.length && tw(a + " " + words[i]) <= maxW) a += " " + words[i++];
  return [a, words.slice(i).join(" ")].filter(Boolean);
}

function stack(t, _d, mode) {
  const groups = config.stack || [];
  const left = 40, labelCol = 130, cols = 7, tile = 52, icon = 26, fs = 11.5;
  const colW = (W - left * 2 - labelCol) / cols;
  let body = `<style>
.rise{animation:rise .6s cubic-bezier(.2,.7,.2,1) both}
@keyframes rise{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.rise{animation:none}}
</style>`;
  body += `<text x="${left}" y="52" font-family="${SANS}" font-size="20" font-weight="600" fill="${t.ink}">Stack</text>`;
  if (config.stackNote) body += `<text x="${left}" y="76" font-family="${SANS}" font-size="14" fill="${t.muted}">${esc(config.stackNote)}</text>`;
  let y = config.stackNote ? 104 : 80, n = 0;
  groups.forEach((g, gi) => {
    const items = g.items.map((it) => (typeof it === "string" ? { name: it } : it));
    const rows = Math.ceil(items.length / cols);
    let rowH = 0;
    body += `<text x="${left}" y="${y + 30}" font-family="${MONO}" font-size="10.5" letter-spacing="1.2" fill="${t.muted}">${esc(g.group.toUpperCase())}</text>`;
    items.forEach((it, i) => {
      const r = Math.floor(i / cols), c = i % cols;
      const cx = left + labelCol + c * colW + colW / 2, ty = y + 8 + r * 100;
      const tx = cx - tile / 2, delay = (n++ * 0.035).toFixed(3);
      let g2 = `<rect x="${tx.toFixed(1)}" y="${ty}" width="${tile}" height="${tile}" rx="13" fill="${t.tile}" stroke="${t.tileBorder}"/>`;
      const ic = it.icon && ICONS[it.icon];
      if (ic) {
        const sc = icon / 24, ix = cx - icon / 2, iy = ty + (tile - icon) / 2;
        if (ic.stroke) {
          const col = it.color ? iconFill(it.color.slice(1), t, mode) : t.accent;
          g2 += `<path transform="translate(${ix.toFixed(1)} ${iy}) scale(${sc.toFixed(4)})" fill="none" stroke="${col}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" d="${ic.path}"/>`;
        } else g2 += `<path transform="translate(${ix.toFixed(1)} ${iy}) scale(${sc.toFixed(4)})" fill="${iconFill(ic.hex, t, mode)}" d="${ic.path}"/>`;
      } else {
        const mono = it.mono || it.name.split(/[\s/]+/).map((w) => w[0]).join("").slice(0, 3).toUpperCase();
        const msz = mono.length > 2 ? 13 : 16;
        g2 += `<text x="${cx.toFixed(1)}" y="${ty + tile / 2 + msz * 0.36}" text-anchor="middle" font-family="${MONO}" font-size="${msz}" font-weight="600" fill="${it.color ? iconFill(it.color.slice(1), t, mode) : t.accent}">${esc(mono)}</text>`;
      }
      const lines = wrapLabel(it.name, colW - 6, fs);
      lines.forEach((ln, li) => (g2 += `<text x="${cx.toFixed(1)}" y="${ty + tile + 20 + li * 15}" text-anchor="middle" font-family="${SANS}" font-size="${fs}" fill="${t.muted}">${esc(ln)}</text>`));
      body += `<g class="rise" style="animation-delay:${delay}s">${g2}</g>`;
      rowH = Math.max(rowH, r * 100 + tile + 20 + (lines.length - 1) * 15 + 18);
    });
    y += Math.max(rowH, 60);
    if (gi < groups.length - 1) body += `<line x1="${left}" y1="${y + 0.5}" x2="${W - left}" y2="${y + 0.5}" stroke="${t.border}"/>`;
    y += 4;
  });
  const alt = "Stack. " + groups.map((g) => `${g.group}: ${g.items.map((i) => (typeof i === "string" ? i : i.name)).join(", ")}`).join(". ") + ".";
  return svg(y + 28, t, body, alt);
}

function stats(t, d) {
  const tiles = [
    ["Last 12 months", fmt(d.lastYear), "contributions"],
    ["All time", fmt(d.allTime), `since ${d.since}`],
    ["Current streak", fmt(d.currentStreak), d.currentStreak === 1 ? "day" : "days"],
    ["Longest streak", fmt(d.longestStreak), d.longestStreak === 1 ? "day" : "days"],
    ["Best day", fmt(d.bestDay.count), d.bestDay.date ? niceDate(d.bestDay.date) : "—"],
    ["Public repos", fmt(d.publicRepos), "on GitHub"],
  ];
  const tw = (W - 80) / tiles.length;
  let body = label(40, 40, "GitHub activity", t);
  body += `<text x="${W - 40}" y="40" text-anchor="end" font-family="${MONO}" font-size="11" fill="${t.faint}">updated ${esc(d.updated)}</text>`;
  tiles.forEach(([name, value, sub], i) => {
    const x = 40 + i * tw;
    if (i) body += `<line x1="${x - 8}" y1="62" x2="${x - 8}" y2="122" stroke="${t.border}"/>`;
    body += `<text x="${x}" y="76" font-family="${SANS}" font-size="12" fill="${t.muted}">${esc(name)}</text>`;
    body += `<text x="${x}" y="106" font-family="${SANS}" font-size="26" font-weight="600" fill="${t.ink}">${esc(value)}</text>`;
    body += `<text x="${x}" y="124" font-family="${SANS}" font-size="12" fill="${t.faint}">${esc(sub)}</text>`;
  });

  // Contributions per year.
  const years = d.perYear, top = 168, chartH = 70, max = Math.max(1, ...years.map((y) => y.total));
  body += label(40, top - 8, "Contributions per year", t);
  const bgap = 16, bw = Math.min(150, (W - 80 - bgap * (years.length - 1)) / years.length);
  years.forEach((y, i) => {
    const x = 40 + i * (bw + bgap), bh = Math.max(2, (y.total / max) * chartH), by = top + 14 + chartH - bh;
    body += `<rect x="${x}" y="${by.toFixed(1)}" width="${bw}" height="${bh.toFixed(1)}" rx="3" fill="${i === years.length - 1 ? t.accent : t.heat[2]}"/>`;
    body += `<text x="${x + bw / 2}" y="${(by - 6).toFixed(1)}" text-anchor="middle" font-family="${SANS}" font-size="11" fill="${t.muted}">${fmt(y.total)}</text>`;
    body += `<text x="${x + bw / 2}" y="${top + chartH + 30}" text-anchor="middle" font-family="${MONO}" font-size="11" fill="${t.muted}">${y.year}</text>`;
  });
  const alt = `GitHub activity: ${fmt(d.lastYear)} contributions in the last 12 months, ${fmt(d.allTime)} since ${d.since}, current streak ${d.currentStreak} days, longest streak ${d.longestStreak} days, ${fmt(d.publicRepos)} public repositories. Per year: ${years.map((y) => `${y.year} ${y.total}`).join(", ")}.`;
  return svg(top + chartH + 50, t, body, alt);
}

function calendar(t, d) {
  const weeks = d.weeks, cell = 11, gap = 3, step = cell + gap;
  const gridW = weeks.length * step - gap, x0 = Math.round((W - gridW) / 2) + 10, y0 = 78;
  let body = label(40, 40, "Last 12 months", t);
  body += `<text x="${W - 40}" y="40" text-anchor="end" font-family="${SANS}" font-size="12" fill="${t.muted}">${fmt(d.lastYear)} contributions</text>`;
  const LV = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };
  let lastMonth = -1;
  weeks.forEach((w, wi) => {
    const first = w.contributionDays[0];
    const m = new Date(first.date + "T00:00:00Z").getUTCMonth();
    if (m !== lastMonth && wi < weeks.length - 2) {
      if (lastMonth !== -1 || new Date(first.date + "T00:00:00Z").getUTCDate() <= 7)
        body += `<text x="${x0 + wi * step}" y="${y0 - 10}" font-family="${SANS}" font-size="11" fill="${t.muted}">${MONTHS[m]}</text>`;
      lastMonth = m;
    }
    for (const day of w.contributionDays) {
      const wd = new Date(day.date + "T00:00:00Z").getUTCDay();
      body += `<rect x="${x0 + wi * step}" y="${y0 + wd * step}" width="${cell}" height="${cell}" rx="2.5" fill="${t.heat[LV[day.contributionLevel] ?? 0]}"/>`;
    }
  });
  ["Mon", "Wed", "Fri"].forEach((n, i) => {
    body += `<text x="${x0 - 8}" y="${y0 + (1 + i * 2) * step + 9}" text-anchor="end" font-family="${SANS}" font-size="10" fill="${t.muted}">${n}</text>`;
  });
  const ly = y0 + 7 * step + 18;
  let lx = W - 40 - 5 * step - 34;
  body += `<text x="${lx - 8}" y="${ly + 9}" text-anchor="end" font-family="${SANS}" font-size="11" fill="${t.muted}">Less</text>`;
  t.heat.forEach((c, i) => (body += `<rect x="${lx + i * step}" y="${ly}" width="${cell}" height="${cell}" rx="2.5" fill="${c}"/>`));
  body += `<text x="${lx + 5 * step + 4}" y="${ly + 9}" font-family="${SANS}" font-size="11" fill="${t.muted}">More</text>`;
  return svg(ly + 32, t, body, `Contribution calendar for the last 12 months: ${fmt(d.lastYear)} contributions.`);
}

// 3D contribution calendar: one block per day, height by contributions.
// Weeks run up and to the right, weekdays run down and to the right.
function calendar3d(t, d, mode) {
  const weeks = d.weeks, U = [12.3, -2.5], V = [5.6, 5.6], fill = 0.8, maxH = 46;
  const counts = weeks.flatMap((w) => w.contributionDays.map((x) => x.contributionCount));
  const max = Math.max(1, ...counts);
  const LV = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };
  const shade = (hex, k) => blend(hex, mode === "dark" ? "#000000" : "#1c1b19", k);
  const cells = [];
  weeks.forEach((w, x) => w.contributionDays.forEach((day) => {
    const y = new Date(day.date + "T00:00:00Z").getUTCDay(), c = day.contributionCount;
    const hgt = c === 0 ? 2 : 5 + Math.sqrt(c / max) * maxH;
    cells.push({ x, y, hgt, lvl: LV[day.contributionLevel] ?? 0, date: day.date });
  }));
  // bounding box with origin at 0,0
  const at = (x, y) => [x * U[0] + y * V[0], x * U[1] + y * V[1]];
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
  for (const c of cells) for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    const [px, py] = at(c.x + dx, c.y + dy);
    minX = Math.min(minX, px); maxX = Math.max(maxX, px); minY = Math.min(minY, py - c.hgt); maxY = Math.max(maxY, py);
  }
  const top = 78, ox = (W - (maxX - minX)) / 2 - minX, oy = top - minY;
  const P = (x, y, z = 0) => { const [px, py] = at(x, y); return [ox + px, oy + py - z]; };
  // paint back to front: rows further up first, and right-hand weeks before left-hand ones
  cells.sort((a, b) => a.y - b.y || b.x - a.x);
  const g = (1 - fill) / 2;
  let blocks = "";
  for (const c of cells) {
    const x0 = c.x + g, x1 = c.x + 1 - g, y0 = c.y + g, y1 = c.y + 1 - g, h = c.hgt;
    const A = P(x0, y0, h), B = P(x1, y0, h), C = P(x1, y1, h), D = P(x0, y1, h);
    const Db = P(x0, y1, 0), Cb = P(x1, y1, 0), Ab = P(x0, y0, 0);
    const col = t.heat[c.lvl];
    blocks += `<g class="col" style="animation-delay:${(c.x * 0.018).toFixed(3)}s">` +
      `<polygon points="${pts([A, D, Db, Ab])}" fill="${shade(col, 0.22)}"/>` +
      `<polygon points="${pts([D, C, Cb, Db])}" fill="${shade(col, 0.38)}"/>` +
      `<polygon points="${pts([A, B, C, D])}" fill="${col}"/></g>`;
  }
  // month labels along the far (top) edge
  let months = "", last = -1;
  weeks.forEach((w, x) => {
    const m = new Date(w.contributionDays[0].date + "T00:00:00Z").getUTCMonth();
    if (m !== last && x > 0 && x < weeks.length - 2) {
      const [lx, ly] = P(x, 7, 0);
      months += `<text x="${(lx + 2).toFixed(1)}" y="${(ly + 16).toFixed(1)}" font-family="${SANS}" font-size="10" fill="${t.muted}">${MONTHS[m]}</text>`;
    }
    last = m;
  });
  const h = Math.ceil(oy + maxY) + 56;
  let body = `<style>
.col{animation:grow .7s cubic-bezier(.2,.7,.2,1) both}
@keyframes grow{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.col{animation:none}}
</style>`;
  body += label(40, 40, "Last 12 months", t);
  body += `<text x="${W - 40}" y="40" text-anchor="end" font-family="${SANS}" font-size="12" fill="${t.muted}">${fmt(d.lastYear)} contributions</text>`;
  body += blocks + months;
  const ly = h - 22, step = 14;
  let lx = W - 40 - 5 * step - 34;
  body += `<text x="${lx - 8}" y="${ly + 9}" text-anchor="end" font-family="${SANS}" font-size="11" fill="${t.muted}">Less</text>`;
  t.heat.forEach((c, i) => (body += `<rect x="${lx + i * step}" y="${ly}" width="11" height="11" rx="2.5" fill="${c}"/>`));
  body += `<text x="${lx + 5 * step + 4}" y="${ly + 9}" font-family="${SANS}" font-size="11" fill="${t.muted}">More</text>`;
  return svg(h, t, body, `3D contribution calendar for the last 12 months: ${fmt(d.lastYear)} contributions.`);
}

// Overview: the year as one solid 3D strip running from top-left to bottom-right,
// with headline numbers top-right, a language ring bottom-left and totals underneath.
function overview(t, d, mode) {
  const H = 420, weeks = d.weeks, U = [11.3, 5.2], V = [10.2, -5.4], fill = 0.88, maxH = 20;
  const counts = weeks.flatMap((w) => w.contributionDays.map((x) => x.contributionCount));
  const max = Math.max(1, ...counts);
  const LV = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };
  const shade = (hex, k) => blend(hex, "#000000", k);
  const ox = 40, oy = 84;
  const P = (x, y, z = 0) => [ox + x * U[0] + y * V[0], oy + x * U[1] + (7 - y) * -V[1] - z];
  const cells = [];
  weeks.forEach((w, x) => w.contributionDays.forEach((day) => {
    const y = new Date(day.date + "T00:00:00Z").getUTCDay(), c = day.contributionCount;
    cells.push({ x, y: 6 - y, hgt: c === 0 ? 2.5 : 5 + Math.sqrt(c / max) * maxH, lvl: LV[day.contributionLevel] ?? 0 });
  }));
  // far cells first: higher rows (further up the strip) and earlier weeks
  cells.sort((a, b) => b.y - a.y || a.x - b.x);
  const g = (1 - fill) / 2;
  let blocks = "";
  for (const c of cells) {
    const x0 = c.x + g, x1 = c.x + 1 - g, y0 = c.y + g, y1 = c.y + 1 - g, h = c.hgt;
    // corners of the top face: A (front-left), B (front-right), C (back-right), D (back-left)
    const A = P(x0, y0, h), B = P(x1, y0, h), C = P(x1, y1, h), D = P(x0, y1, h);
    const Ab = P(x0, y0, 0), Bb = P(x1, y0, 0), Cb = P(x1, y1, 0);
    const col = t.heat[c.lvl];
    blocks += `<g class="col" style="animation-delay:${(c.x * 0.016).toFixed(3)}s"><polygon points="${pts([A, B, Bb, Ab])}" fill="${shade(col, mode === "dark" ? 0.35 : 0.22)}"/><polygon points="${pts([B, C, Cb, Bb])}" fill="${shade(col, mode === "dark" ? 0.5 : 0.36)}"/><polygon points="${pts([A, B, C, D])}" fill="${col}"/></g>`;
  }
  // the year's total with stars and forks, top-right
  const R = W - 40;
  const star = (x, y) => `<path transform="translate(${x} ${y})" d="M8 0l2.4 5 5.6.8-4 3.9.9 5.5L8 12.6 3.1 15.2 4 9.7 0 5.8 5.6 5z" fill="none" stroke="${t.ink}" stroke-width="1.4" stroke-linejoin="round"/>`;
  const fork = (x, y) => `<g transform="translate(${x} ${y})" fill="none" stroke="${t.ink}" stroke-width="1.4"><circle cx="3" cy="2.5" r="2"/><circle cx="13" cy="2.5" r="2"/><circle cx="8" cy="14" r="2"/><path d="M3 4.5v1.5c0 2 2 3 5 3s5-1 5-3V4.5M8 9v3"/></g>`;
  let stats = `<text x="${R}" y="44" text-anchor="end" font-family="${MONO}" font-size="11" letter-spacing="1.2" fill="${t.muted}">LAST 12 MONTHS</text>`;
  stats += `<text x="${R}" y="96" text-anchor="end" font-family="${SANS}" font-size="48" font-weight="700" letter-spacing="-1" fill="${t.accent}">${fmt(d.lastYear)}</text>`;
  stats += `<text x="${R}" y="120" text-anchor="end" font-family="${SANS}" font-size="15" fill="${t.ink}">contributions</text>`;
  if (d.stars + d.forks > 0) {
    const fw = String(fmt(d.forks)).length * 11, sw2 = String(fmt(d.stars)).length * 11;
    stats += fork(R - fw - 22, 140) + `<text x="${R}" y="154" text-anchor="end" font-family="${SANS}" font-size="18" font-weight="600" fill="${t.ink}">${fmt(d.forks)}</text>`;
    stats += star(R - fw - 34 - sw2 - 22, 140) + `<text x="${R - fw - 34}" y="154" text-anchor="end" font-family="${SANS}" font-size="18" font-weight="600" fill="${t.ink}">${fmt(d.stars)}</text>`;
  }
  // language ring, bottom-left
  const langs = d.languages, total = langs.reduce((a, l) => a + l.size, 0) || 1;
  const rx = 100, ry = 318, Rr = 46, sw = 20, Cc = 2 * Math.PI * Rr;
  let ring = `<circle cx="${rx}" cy="${ry}" r="${Rr}" fill="none" stroke="${t.track}" stroke-width="${sw}"/>`, off = 0;
  langs.forEach((l) => {
    const len = (l.size / total) * Cc;
    ring += `<circle cx="${rx}" cy="${ry}" r="${Rr}" fill="none" stroke="${l.color}" stroke-width="${sw}" stroke-dasharray="${f1(Math.max(len - 1.5, 0.5))} ${f1(Cc)}" stroke-dashoffset="${f1(-off)}" transform="rotate(-90 ${rx} ${ry})"/>`;
    off += len;
  });
  langs.slice(0, 6).forEach((l, i) => {
    const ly = ry - 44 + i * 18;
    ring += `<rect x="${rx + 66}" y="${ly - 9}" width="10" height="10" rx="2" fill="${l.color}"/><text x="${rx + 82}" y="${ly}" font-family="${SANS}" font-size="12" fill="${t.ink}">${esc(l.name)}</text>`;
  });
  const foot = "";
  let body = `<style>
.col{animation:grow .7s cubic-bezier(.2,.7,.2,1) both}
@keyframes grow{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.col{animation:none}}
</style>`;
  body += blocks + stats + ring + foot;
  const alt = `${fmt(d.lastYear)} contributions in the last 12 months, shown as a 3D calendar. Current streak ${d.currentStreak} days, longest ${d.longestStreak} days, ${fmt(d.allTime)} all time, ${d.stars} stars, ${d.forks} forks. Languages: ` + langs.slice(0, 6).map((l) => l.name).join(", ") + ".";
  return svg(H, t, body, alt);
}

// Contributions over the last 31 days, as a smooth line, with four headline numbers.
function activity(t, d) {
  const days = d.last31, max = Math.max(1, ...days.map((x) => x.count));
  const nice = max <= 5 ? 5 : max <= 10 ? 10 : max <= 20 ? 20 : max <= 50 ? 50 : Math.ceil(max / 50) * 50;
  const L = 82, Rt = W - 40, top = 200, bot = 330;
  const X = (i) => L + (i / (days.length - 1)) * (Rt - L), Y = (v) => bot - (v / nice) * (bot - top);
  const p = days.map((x, i) => [X(i), Y(x.count)]);
  let dPath = `M${f1(p[0][0])},${f1(p[0][1])}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2, k = 1 / 6;
    const c1 = [p1[0] + (p2[0] - p0[0]) * k, Math.min(bot, p1[1] + (p2[1] - p0[1]) * k)], c2 = [p2[0] - (p3[0] - p1[0]) * k, Math.min(bot, p2[1] - (p3[1] - p1[1]) * k)];
    dPath += ` C${f1(c1[0])},${f1(c1[1])} ${f1(c2[0])},${f1(c2[1])} ${f1(p2[0])},${f1(p2[1])}`;
  }
  let b = `<text x="40" y="52" font-family="${SANS}" font-size="20" font-weight="600" fill="${t.ink}">Contributions</text>`;
  b += `<text x="40" y="76" font-family="${SANS}" font-size="13.5" fill="${t.muted}">Daily contributions over the last 31 days. Private repositories are included.</text>`;
  b += `<text x="${W - 40}" y="52" text-anchor="end" font-family="${MONO}" font-size="11" letter-spacing="1.2" fill="${t.muted}">UPDATED ${esc(d.updated)}</text>`;
  const tiles = [["Last 12 months", fmt(d.lastYear), ""], ["Active days, 12 months", fmt(d.activeDays), ""], ["Current streak", fmt(d.currentStreak), d.currentStreak === 1 ? "day" : "days"], ["Longest streak", fmt(d.longestStreak), d.longestStreak === 1 ? "day" : "days"]];
  const tw = (W - 80) / 4;
  tiles.forEach(([k, v, u], i) => {
    const x = 40 + i * tw;
    if (i) b += `<line x1="${x - 12}" y1="104" x2="${x - 12}" y2="160" stroke="${t.border}"/>`;
    b += `<text x="${x}" y="116" font-family="${SANS}" font-size="12.5" fill="${t.muted}">${k}</text><text x="${x}" y="152" font-family="${SANS}" font-size="30" font-weight="650" fill="${t.ink}">${v}${u ? `<tspan font-size="14" font-weight="400" fill="${t.muted}"> ${u}</tspan>` : ""}</text>`;
  });
  [0, nice / 2, nice].forEach((v) => (b += `<line x1="${L}" y1="${f1(Y(v))}" x2="${Rt}" y2="${f1(Y(v))}" stroke="${t.border}"/><text x="${L - 10}" y="${f1(Y(v) + 4)}" text-anchor="end" font-family="${MONO}" font-size="10.5" fill="${t.muted}">${v}</text>`));
  b += `<defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.accent}" stop-opacity=".28"/><stop offset="1" stop-color="${t.accent}" stop-opacity="0"/></linearGradient></defs>`;
  b += `<path d="${dPath} L${Rt},${bot} L${L},${bot} Z" fill="url(#area)"/><path d="${dPath}" fill="none" stroke="${t.accent}" stroke-width="2.2" stroke-linejoin="round"/>`;
  const last = p.at(-1), first = p[0];
  b += `<circle cx="${f1(first[0])}" cy="${f1(first[1])}" r="3.5" fill="${t.accent}"/><text x="${f1(first[0] + 6)}" y="${f1(first[1] - 8)}" font-family="${MONO}" font-size="11" fill="${t.ink}">${days[0].count}</text>`;
  b += `<circle cx="${f1(last[0])}" cy="${f1(last[1])}" r="9" fill="${t.accent}" opacity=".18"><animate attributeName="r" values="5;11;5" dur="2.4s" repeatCount="indefinite"/></circle><circle cx="${f1(last[0])}" cy="${f1(last[1])}" r="3.5" fill="${t.accent}"/><text x="${f1(last[0] - 8)}" y="${f1(last[1] - 10)}" text-anchor="end" font-family="${MONO}" font-size="11" fill="${t.ink}">${days.at(-1).count}</text>`;
  [0, 6, 12, 18, 24, 30].forEach((i) => { if (days[i]) { const dt = new Date(days[i].date + "T00:00:00Z"); b += `<text x="${f1(X(i))}" y="${bot + 24}" text-anchor="${i === 0 ? "start" : i === 30 ? "end" : "middle"}" font-family="${MONO}" font-size="11" fill="${t.muted}">${dt.getUTCDate()} ${MONTHS[dt.getUTCMonth()]}</text>`; } });
  return svg(bot + 50, t, b, `Contributions: ${fmt(d.lastYear)} in the last 12 months over ${d.activeDays} active days; current streak ${d.currentStreak} days, longest ${d.longestStreak} days. Line chart of the last 31 days.`);
}

// Languages as horizontal bars, largest first, with the rest grouped as Other.
function langBars(t, d) {
  const all = d.allLanguages || d.languages, total = all.reduce((a, l) => a + l.size, 0) || 1;
  const top = all.slice(0, 5), other = all.slice(5).reduce((a, l) => a + l.size, 0);
  const rows = top.map((l) => [l.name, l.size / total, false]).concat(other ? [["Other", other / total, true]] : []);
  const maxShare = Math.max(...rows.map((r) => r[1]));
  let b = `<text x="40" y="52" font-family="${SANS}" font-size="20" font-weight="600" fill="${t.ink}">Languages</text>`;
  b += `<text x="40" y="76" font-family="${SANS}" font-size="13.5" fill="${t.muted}">Share of code across my repositories.</text>`;
  b += `<text x="${W - 40}" y="52" text-anchor="end" font-family="${MONO}" font-size="11" letter-spacing="1.2" fill="${t.muted}">GITHUB · BY CODE SIZE</text>`;
  const bx = 220, bw = W - 40 - bx - 70;
  rows.forEach(([n, share, isOther], i) => {
    const y = 118 + i * 36, w = Math.max(4, (share / maxShare) * bw);
    b += `<text x="40" y="${y + 5}" font-family="${SANS}" font-size="14" fill="${isOther ? t.muted : t.ink}">${esc(n)}</text>`;
    b += `<rect x="${bx}" y="${y - 6}" width="${f1(w)}" height="12" rx="4" fill="${isOther ? t.faint : t.accent}"><animate attributeName="width" from="0" to="${f1(w)}" dur=".9s" begin="${(i * 0.08).toFixed(2)}s" fill="freeze" calcMode="spline" keySplines=".2 .7 .2 1" keyTimes="0;1"/></rect>`;
    b += `<text x="${f1(bx + w + 10)}" y="${y + 5}" font-family="${MONO}" font-size="12" fill="${t.muted}">${(share * 100).toFixed(1)}%</text>`;
  });
  return svg(118 + rows.length * 36 + 14, t, b, "Languages by share of code: " + rows.map(([n, sh]) => `${n} ${(sh * 100).toFixed(1)}%`).join(", ") + ".");
}

function languages(t, d) {
  const langs = d.languages, total = langs.reduce((a, l) => a + l.size, 0) || 1;
  let body = label(40, 40, "Languages", t);
  body += `<text x="${W - 40}" y="40" text-anchor="end" font-family="${SANS}" font-size="12" fill="${t.muted}">by code size across ${d.languageRepos} repositories</text>`;
  const barY = 60, barW = W - 80;
  body += `<clipPath id="bar"><rect x="40" y="${barY}" width="${barW}" height="12" rx="6"/></clipPath><g clip-path="url(#bar)"><rect x="40" y="${barY}" width="${barW}" height="12" fill="${t.track}"/>`;
  let x = 40;
  for (const l of langs) {
    const w = (l.size / total) * barW;
    body += `<rect x="${x.toFixed(2)}" y="${barY}" width="${(w + 0.5).toFixed(2)}" height="12" fill="${l.color}"/>`;
    x += w;
  }
  body += `</g>`;
  const cols = 3, colW = barW / cols;
  langs.forEach((l, i) => {
    const cx = 40 + (i % cols) * colW, cy = barY + 44 + Math.floor(i / cols) * 28;
    body += `<circle cx="${cx + 5}" cy="${cy - 4}" r="5" fill="${l.color}"/>`;
    body += `<text x="${cx + 18}" y="${cy}" font-family="${SANS}" font-size="13" fill="${t.ink}">${esc(l.name)}</text>`;
    body += `<text x="${cx + colW - 24}" y="${cy}" text-anchor="end" font-family="${MONO}" font-size="12" fill="${t.muted}">${((l.size / total) * 100).toFixed(1)}%</text>`;
  });
  const h = barY + 44 + Math.ceil(langs.length / cols) * 28 + 6;
  return svg(h, t, body, "Languages by share of code: " + langs.map((l) => `${l.name} ${((l.size / total) * 100).toFixed(1)}%`).join(", ") + ".");
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const niceDate = (iso) => { const d = new Date(iso + "T00:00:00Z"); return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`; };

// ----------------------------------------------------------------- data ---

async function gql(query, variables, token) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: { Authorization: `bearer ${token}`, "Content-Type": "application/json", "User-Agent": "profile-graphics" },
      body: JSON.stringify({ query, variables }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && !json.errors) return json.data;
    if (attempt >= 3) throw new Error(`GitHub API ${res.status}: ${JSON.stringify(json.errors || json).slice(0, 400)}`);
    await new Promise((r) => setTimeout(r, 2000 * attempt));
  }
}

const DAYS = `weeks { contributionDays { date contributionCount contributionLevel } }`;

async function fetchLive() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN is not set.");
  // Optional token that can read your private repos. Only language totals are
  // used from them; private repository names are never written anywhere.
  const langToken = process.env.PROFILE_TOKEN || token;
  const login = config.login;

  const base = await gql(`query($login:String!){ user(login:$login){
      createdAt
      repositories(ownerAffiliations:OWNER, privacy:PUBLIC){ totalCount }
      contributionsCollection{ contributionCalendar{ totalContributions ${DAYS} } } } }`, { login }, token);
  const u = base.user;
  if (!u) throw new Error(`User ${login} not found.`);

  // Each year separately: the API only allows one-year windows.
  const startYear = new Date(u.createdAt).getUTCFullYear(), now = new Date();
  const perYear = [], allDays = [];
  for (let y = startYear; y <= now.getUTCFullYear(); y++) {
    const from = new Date(Date.UTC(y, 0, 1)).toISOString();
    const to = y === now.getUTCFullYear() ? now.toISOString() : new Date(Date.UTC(y, 11, 31, 23, 59, 59)).toISOString();
    const r = await gql(`query($login:String!,$from:DateTime!,$to:DateTime!){ user(login:$login){
        contributionsCollection(from:$from,to:$to){ contributionCalendar{ totalContributions ${DAYS} } } } }`, { login, from, to }, token);
    const cal = r.user.contributionsCollection.contributionCalendar;
    perYear.push({ year: y, total: cal.totalContributions });
    for (const w of cal.weeks) allDays.push(...w.contributionDays);
  }

  const langs = new Map(), skipRepos = new Set(config.languages?.excludeRepos || []);
  let after = null, languageRepos = 0, stars = 0, forks = 0;
  do {
    const r = await gql(`query($login:String!,$after:String){ user(login:$login){
        repositories(first:100, after:$after, ownerAffiliations:OWNER, isFork:false){
          pageInfo{ hasNextPage endCursor }
          nodes{ name isPrivate stargazerCount forkCount languages(first:20, orderBy:{field:SIZE, direction:DESC}){ edges{ size node{ name color } } } } } } }`,
      { login, after }, langToken);
    const page = r.user.repositories;
    for (const repo of page.nodes) {
      if (!repo.isPrivate) { stars += repo.stargazerCount; forks += repo.forkCount; }
      if (skipRepos.has(repo.name) || !repo.languages.edges.length) continue;
      languageRepos++;
      for (const e of repo.languages.edges) {
        const cur = langs.get(e.node.name) || { name: e.node.name, color: e.node.color || "#8b949e", size: 0 };
        cur.size += e.size;
        langs.set(e.node.name, cur);
      }
    }
    after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
  } while (after);

  return summarize({
    since: startYear,
    publicRepos: u.repositories.totalCount,
    lastYearCal: u.contributionsCollection.contributionCalendar,
    perYear, allDays, langs: [...langs.values()], languageRepos, stars, forks,
  });
}

function summarize({ since, publicRepos, lastYearCal, perYear, allDays, langs, languageRepos, stars = 0, forks = 0 }) {
  const byDate = new Map(allDays.map((d) => [d.date, d.contributionCount]));
  const dates = [...byDate.keys()].sort();
  let longest = 0, run = 0, best = { count: 0, date: null }, prev = null;
  for (const date of dates) {
    const c = byDate.get(date);
    if (c > best.count) best = { count: c, date };
    const consecutive = prev && (Date.parse(date) - Date.parse(prev)) === 86400000;
    run = c > 0 ? (consecutive || run === 0 ? run + 1 : 1) : 0;
    longest = Math.max(longest, run);
    prev = date;
  }
  // Current streak: today counts if it already has contributions, otherwise start from yesterday.
  let current = 0;
  const day = new Date(dates.at(-1) + "T00:00:00Z");
  if (!byDate.get(dates.at(-1))) day.setUTCDate(day.getUTCDate() - 1);
  while ((byDate.get(day.toISOString().slice(0, 10)) || 0) > 0) { current++; day.setUTCDate(day.getUTCDate() - 1); }

  const hide = new Set(config.languages?.excludeLanguages || []);
  const top = langs.filter((l) => !hide.has(l.name)).sort((a, b) => b.size - a.size).slice(0, config.languages?.top || 6);

  return {
    updated: new Date().toISOString().slice(0, 10),
    since, publicRepos,
    lastYear: lastYearCal.totalContributions,
    weeks: lastYearCal.weeks,
    allTime: perYear.reduce((a, y) => a + y.total, 0),
    perYear, currentStreak: current, longestStreak: longest, bestDay: best,
    languages: top, languageRepos, stars, forks,
    last31: dates.slice(-31).map((dt) => ({ date: dt, count: byDate.get(dt) })),
    activeDays: lastYearCal.weeks.flatMap((w) => w.contributionDays).filter((x) => x.contributionCount > 0).length,
    allLanguages: langs.filter((l) => !hide.has(l.name)).sort((a, b) => b.size - a.size),
  };
}

// Made-up data with a realistic shape, only for previewing the design.
function sampleData() {
  let s = 42;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const end = new Date(Date.UTC(2026, 9, 12)), allDays = [];
  for (let d = new Date(Date.UTC(2022, 0, 1)); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const active = rnd() < (d.getUTCFullYear() >= 2025 ? 0.55 : 0.25);
    allDays.push({ date: d.toISOString().slice(0, 10), contributionCount: active ? 1 + Math.floor(rnd() ** 2 * 14) : 0 });
  }
  const yearAgo = new Date(end); yearAgo.setUTCDate(yearAgo.getUTCDate() - 364 - yearAgo.getUTCDay());
  const recent = allDays.filter((d) => d.date >= yearAgo.toISOString().slice(0, 10));
  const lvl = (c) => (c === 0 ? "NONE" : c < 3 ? "FIRST_QUARTILE" : c < 6 ? "SECOND_QUARTILE" : c < 10 ? "THIRD_QUARTILE" : "FOURTH_QUARTILE");
  const weeks = [];
  for (let i = 0; i < recent.length; i += 7) weeks.push({ contributionDays: recent.slice(i, i + 7).map((d) => ({ ...d, contributionLevel: lvl(d.contributionCount) })) });
  const perYear = [2022, 2023, 2024, 2025, 2026].map((y) => ({ year: y, total: allDays.filter((d) => d.date.startsWith(y)).reduce((a, d) => a + d.contributionCount, 0) }));
  return summarize({
    since: 2022, publicRepos: 31,
    lastYearCal: { totalContributions: recent.reduce((a, d) => a + d.contributionCount, 0), weeks },
    perYear, allDays, languageRepos: 24, stars: 14, forks: 3,
    langs: [
      { name: "Kotlin", color: "#A97BFF", size: 410000 }, { name: "C#", color: "#178600", size: 260000 },
      { name: "Java", color: "#b07219", size: 220000 }, { name: "PHP", color: "#4F5D95", size: 150000 },
      { name: "JavaScript", color: "#f1e05a", size: 90000 }, { name: "Python", color: "#3572A5", size: 60000 },
    ],
  });
}

// ----------------------------------------------------------------- main ---

// --placeholder: real header and stack, "waiting" cards for the data-driven ones.
const PLACEHOLDER = process.argv.includes("--placeholder");
const waiting = (title) => (t) => svg(110, t, label(40, 40, title, t) +
  `<text x="40" y="78" font-family="${SANS}" font-size="14" fill="${t.muted}">Waiting for the first automatic update from GitHub Actions.</text>`, `${title}: waiting for first update.`);

const data = PLACEHOLDER ? null : SAMPLE ? sampleData() : await fetchLive();
const cards = PLACEHOLDER
  ? { header, stack, stats: waiting("GitHub activity"), calendar: waiting("Last 12 months"), languages: waiting("Languages"), overview: waiting("Contributions"), activity: waiting("Contributions"), langbars: waiting("Languages") }
  : { header, stack, stats, calendar: config.calendar === "flat" ? calendar : calendar3d, languages, overview, activity, langbars: langBars };
const files = {};
for (const [name, fn] of Object.entries(cards))
  for (const mode of ["light", "dark"]) files[`${name}-${mode}.svg`] = fn(THEMES[mode], data, mode);

await mkdir(OUT, { recursive: true });
for (const [f, content] of Object.entries(files)) await writeFile(path.join(OUT, f), content);
console.log(`Wrote ${Object.keys(files).length} files to assets/${SAMPLE ? " (sample data)" : ""}.`);
