// 2.5D "vinyl toy" art: soft-shaded volumes, outlines and contact shadows drawn on a 2D canvas.
// Everything here is pure drawing — no game state — so index.tsx passes in time/positions.

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

export const INK = "#4a3a5c";
const LINE = "rgba(74,58,92,0.55)";

let low = false;
/** low = flat fills, no gradients (for the "저사양" quality setting) */
export const setLowDetail = (v: boolean) => {
  low = v;
};

// ---------- color helpers ----------
const shadeCache = new Map<string, string>();
/** amt > 0 mixes toward warm white, amt < 0 toward deep violet (keeps toy-like shadows) */
export function shade(hex: string, amt: number) {
  const key = hex + amt;
  const hit = shadeCache.get(key);
  if (hit) return hit;
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  const [tr, tg, tb] = amt > 0 ? [255, 252, 245] : [52, 34, 72];
  const a = Math.abs(amt);
  r = Math.round(r + (tr - r) * a);
  g = Math.round(g + (tg - g) * a);
  b = Math.round(b + (tb - b) * a);
  const v = `rgb(${r},${g},${b})`;
  shadeCache.set(key, v);
  return v;
}

// ---------- primitives ----------
type BlobOpt = { rot?: number; line?: boolean; gloss?: boolean; alpha?: number };
/** shaded ellipsoid lit from the top-left */
export function blob(c: Ctx, x: number, y: number, rx: number, ry: number, col: string, o: BlobOpt = {}) {
  c.save();
  c.translate(x, y);
  if (o.rot) c.rotate(o.rot);
  if (o.alpha !== undefined) c.globalAlpha *= o.alpha;
  c.beginPath();
  c.ellipse(0, 0, rx, ry, 0, 0, TAU);
  if (low) c.fillStyle = col;
  else {
    const m = Math.max(rx, ry);
    const gr = c.createRadialGradient(-rx * 0.35, -ry * 0.42, m * 0.08, 0, 0, m * 1.08);
    gr.addColorStop(0, shade(col, 0.6));
    gr.addColorStop(0.5, col);
    gr.addColorStop(1, shade(col, -0.32));
    c.fillStyle = gr;
  }
  c.fill();
  if (o.line !== false) {
    c.strokeStyle = LINE;
    c.lineWidth = 1;
    c.stroke();
  }
  if (o.gloss && !low) {
    c.fillStyle = "rgba(255,255,255,0.6)";
    c.beginPath();
    c.ellipse(-rx * 0.38, -ry * 0.48, rx * 0.26, ry * 0.15, -0.5, 0, TAU);
    c.fill();
  }
  c.restore();
}

/** soft contact shadow on the ground plane */
export function groundShadow(c: Ctx, x: number, y: number, rx: number, a = 0.18) {
  c.fillStyle = `rgba(70,45,90,${a})`;
  c.beginPath();
  c.ellipse(x, y, rx, rx * 0.32, 0, 0, TAU);
  c.fill();
}

/** curved leaf / flame / crest spike pointing along `ang` */
export function spike(c: Ctx, x: number, y: number, ang: number, len: number, wid: number, col: string, curve = 0.25) {
  c.save();
  c.translate(x, y);
  c.rotate(ang);
  c.beginPath();
  c.moveTo(0, -wid / 2);
  c.quadraticCurveTo(len * 0.55, -wid * 0.55 - len * curve * 0.4, len, -len * curve * 0.25);
  c.quadraticCurveTo(len * 0.5, wid * 0.55, 0, wid / 2);
  c.closePath();
  if (low) c.fillStyle = col;
  else {
    const gr = c.createLinearGradient(0, -wid / 2, 0, wid / 2);
    gr.addColorStop(0, shade(col, 0.45));
    gr.addColorStop(0.55, col);
    gr.addColorStop(1, shade(col, -0.3));
    c.fillStyle = gr;
  }
  c.fill();
  c.strokeStyle = LINE;
  c.lineWidth = 0.9;
  c.stroke();
  c.restore();
}

export function starPath(c: Ctx, x: number, y: number, r: number, inner = 0.45, n = 5, rot = -Math.PI / 2) {
  c.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = rot + (i * Math.PI) / n;
    const rr = i % 2 ? r * inner : r;
    c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  c.closePath();
}

export function heartPath(c: Ctx, x: number, y: number, s: number) {
  c.beginPath();
  c.moveTo(x, y + s * 0.9);
  c.bezierCurveTo(x - s * 1.4, y, x - s * 0.8, y - s * 1.1, x, y - s * 0.35);
  c.bezierCurveTo(x + s * 0.8, y - s * 1.1, x + s * 1.4, y, x, y + s * 0.9);
  c.closePath();
}

/** fill the current path with a top-left lit gradient */
function fillLit(c: Ctx, x: number, y: number, r: number, col: string) {
  if (low) c.fillStyle = col;
  else {
    const gr = c.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.1);
    gr.addColorStop(0, shade(col, 0.6));
    gr.addColorStop(0.55, col);
    gr.addColorStop(1, shade(col, -0.3));
    c.fillStyle = gr;
  }
  c.fill();
  c.strokeStyle = LINE;
  c.lineWidth = 1;
  c.stroke();
}

export function glossyStar(c: Ctx, x: number, y: number, r: number, col: string, rot = -Math.PI / 2) {
  starPath(c, x, y, r, 0.5, 5, rot);
  fillLit(c, x, y, r, col);
}
export function glossyHeart(c: Ctx, x: number, y: number, s: number, col: string) {
  heartPath(c, x, y, s);
  fillLit(c, x, y, s, col);
}

// rotating 3D cube (orthographic), painter-sorted faces lit from the top-left
const CV = [
  [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
  [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1],
] as const;
const CF = [
  [0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [3, 2, 6, 7], [0, 3, 7, 4], [1, 2, 6, 5],
] as const;
export function cube(c: Ctx, x: number, y: number, s: number, a: number, col: string, alpha = 1, tilt = 0.6) {
  const ca = Math.cos(a), sa = Math.sin(a), ct = Math.cos(tilt), st = Math.sin(tilt);
  const P = CV.map(([vx, vy, vz]) => {
    const x1 = vx * ca + vz * sa;
    const z1 = -vx * sa + vz * ca;
    return [x1, vy * ct - z1 * st, vy * st + z1 * ct] as const;
  });
  const faces = CF.map((f) => {
    const a0 = P[f[0]]!;
    const a2 = P[f[2]]!;
    const cx = (a0[0] + a2[0]) / 2;
    const cy = (a0[1] + a2[1]) / 2;
    const cz = (a0[2] + a2[2]) / 2;
    return { f, cz, lit: -cx * 0.35 - cy * 0.7 - cz * 0.4 };
  }).sort((p, q) => q.cz - p.cz);
  c.save();
  c.globalAlpha *= alpha;
  c.lineJoin = "round";
  for (const { f, cz, lit } of faces) {
    if (alpha >= 1 && cz > 0.05) continue; // hidden back faces of solid cubes
    c.beginPath();
    for (const i of f) {
      const v = P[i]!;
      c.lineTo(x + v[0] * s, y + v[1] * s);
    }
    c.closePath();
    c.fillStyle = shade(col, Math.max(-0.4, Math.min(0.55, lit * 0.6)));
    c.fill();
    c.strokeStyle = alpha < 1 ? "rgba(255,255,255,0.8)" : LINE;
    c.lineWidth = 0.9;
    c.stroke();
  }
  c.restore();
}

/** big glossy cartoon eye */
function eye(c: Ctx, x: number, y: number, rx: number, ry: number, iris: string, blink = 0) {
  if (blink > 0.5) {
    c.strokeStyle = INK;
    c.lineWidth = 1.2;
    c.beginPath();
    c.arc(x, y + ry * 0.2, rx * 0.9, Math.PI * 1.1, Math.PI * 1.9);
    c.stroke();
    return;
  }
  c.fillStyle = INK;
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, TAU);
  c.fill();
  if (low) c.fillStyle = iris;
  else {
    const gr = c.createLinearGradient(x, y - ry, x, y + ry);
    gr.addColorStop(0, shade(iris, -0.35));
    gr.addColorStop(1, shade(iris, 0.45));
    c.fillStyle = gr;
  }
  c.beginPath();
  c.ellipse(x, y + ry * 0.08, rx * 0.78, ry * 0.8, 0, 0, TAU);
  c.fill();
  c.fillStyle = "#fff";
  c.beginPath();
  c.ellipse(x - rx * 0.32, y - ry * 0.38, rx * 0.34, ry * 0.26, 0, 0, TAU);
  c.fill();
  c.beginPath();
  c.arc(x + rx * 0.35, y + ry * 0.35, rx * 0.15, 0, TAU);
  c.fill();
}
const blinkAt = (t: number, seed: number) => ((t + seed) % 3.7 < 0.12 ? 1 : 0);

// ---------- heroes ----------
export const HERO_COL = [
  { main: "#f6e6c4", a: "#f07a5f", b: "#f2b43c", c: "#1fa39a", d: "#7cb342", shot: "#ffb43c" }, // Haru: sun sprite
  { main: "#f3ead7", a: "#1f3a6b", b: "#2a9d9f", c: "#e2b04a", d: "#9fd3f5", shot: "#7fc4f5" }, // Yuki: constellation sage
  { main: "#f8f1ea", a: "#a77be0", b: "#ef8fb6", c: "#5ec4c4", d: "#e0b04a", shot: "#c79bf0" }, // Karen: paint artist
] as const;

function drawHaru(c: Ctx, t: number) {
  const C = HERO_COL[0];
  const bob = Math.sin(t * 6) * 1;
  // spiral ribbon tail rising behind
  for (let i = 5; i >= 0; i--) {
    const tx = 9 + i * 1.6 + Math.sin(t * 5 - i * 0.7) * 1.4;
    const ty = 7 - i * 4.4;
    c.strokeStyle = i % 2 ? C.c : C.a;
    c.lineWidth = 2.6;
    c.beginPath();
    c.ellipse(tx, ty, 5.4 - i * 0.3, 2, 0.15, 0, TAU);
    c.stroke();
  }
  spike(c, 17, -18, -1.2, 7, 4, C.d, 0.3);
  spike(c, 17, -18, -2.3, 6, 3.6, C.d, -0.3);
  const hy = -9 + bob;
  // crest spikes
  const crest: [number, number, string][] = [
    [-2.55, 14, C.a], [-2.2, 18, C.b], [-1.85, 20, C.a], [-1.5, 18, C.c], [-1.15, 16, C.b], [-0.8, 13, C.c],
  ];
  for (const [a, l, col] of crest) spike(c, Math.cos(a) * 6, hy + Math.sin(a) * 6, a, l, 7.5, col, 0.35);
  spike(c, -10, hy + 1, Math.PI - 0.15, 8, 5, C.c, -0.2);
  spike(c, 10, hy + 1, 0.15, 8, 5, C.c, 0.2);
  // body + limbs
  blob(c, 0, 5 + bob * 0.5, 8.5, 7.5, C.main);
  spike(c, -3, 4 + bob * 0.5, -0.5, 6, 3, C.c, 0.2);
  blob(c, -5, 12, 3.4, 2.5, C.a);
  blob(c, 5, 12, 3.4, 2.5, C.a);
  blob(c, -10, 3 + bob, 2.8, 3.4, C.main);
  blob(c, 10, 3 + bob, 2.8, 3.4, C.main);
  blob(c, -10.5, 6 + bob, 2.4, 2.2, C.a);
  blob(c, 10.5, 6 + bob, 2.4, 2.2, C.a);
  // head
  blob(c, 0, hy, 11.5, 10.5, C.main, { gloss: true });
  // sun emblem
  c.strokeStyle = C.a;
  c.lineWidth = 1.2;
  c.beginPath();
  c.arc(0, hy - 6, 2.3, 0, TAU);
  c.stroke();
  c.fillStyle = C.a;
  c.beginPath();
  c.arc(0, hy - 6, 0.9, 0, TAU);
  c.fill();
  // face
  const bl = blinkAt(t, 0.3);
  eye(c, -4.6, hy + 1.5, 2.9, 3.5, "#1aa6a0", bl);
  eye(c, 4.6, hy + 1.5, 2.9, 3.5, "#1aa6a0", bl);
  c.fillStyle = "#d9534f";
  c.beginPath();
  c.arc(0, hy + 6, 1.7, 0, Math.PI);
  c.fill();
  c.fillStyle = "rgba(240,122,95,0.55)";
  c.beginPath();
  c.arc(-7.6, hy + 5, 1.5, 0, TAU);
  c.arc(7.6, hy + 5, 1.5, 0, TAU);
  c.fill();
}

function drawYuki(c: Ctx, t: number) {
  const C = HERO_COL[1];
  const bob = Math.sin(t * 5) * 1;
  // flame tail
  for (const [a, l, col] of [[2.3, 13, C.b], [2.65, 15, C.d], [2.0, 11, C.b]] as const)
    spike(c, -6, 8, a + Math.sin(t * 6) * 0.08, l, 6, col, 0.4);
  // cape
  c.beginPath();
  c.moveTo(-7, -2 + bob);
  c.quadraticCurveTo(-15, 8, -13, 15 + Math.sin(t * 7) * 1.5);
  c.lineTo(13, 15 + Math.sin(t * 7 + 1) * 1.5);
  c.quadraticCurveTo(15, 8, 7, -2 + bob);
  c.closePath();
  fillLit(c, 0, 4, 14, C.a);
  c.strokeStyle = C.c;
  c.lineWidth = 1.2;
  c.stroke();
  // body
  blob(c, 0, 5 + bob * 0.5, 7.5, 7, C.a);
  blob(c, 0, 6 + bob * 0.5, 4, 4.4, C.main, { line: false });
  c.save();
  c.translate(0, 1 + bob * 0.5);
  c.rotate(Math.PI / 4);
  c.fillStyle = C.c;
  c.fillRect(-2.2, -2.2, 4.4, 4.4);
  c.fillStyle = C.d;
  c.fillRect(-1.1, -1.1, 2.2, 2.2);
  c.restore();
  blob(c, -4.5, 12, 3, 2.4, C.a);
  blob(c, 4.5, 12, 3, 2.4, C.a);
  blob(c, -4.5, 13.2, 2, 1.2, C.main, { line: false });
  blob(c, 4.5, 13.2, 2, 1.2, C.main, { line: false });
  const hy = -9 + bob;
  // side fur
  spike(c, -9, hy + 2, Math.PI - 0.35, 8, 5, C.b, -0.25);
  spike(c, 9, hy + 2, 0.35, 8, 5, C.b, 0.25);
  blob(c, 0, hy, 11, 10, C.main, { gloss: true });
  // constellation hood
  c.beginPath();
  c.moveTo(-11.5, hy - 1);
  c.bezierCurveTo(-12, hy - 14, -2, hy - 19, 5, hy - 24);
  c.quadraticCurveTo(6, hy - 15, 12, hy - 8);
  c.quadraticCurveTo(11.5, hy - 3, 11.5, hy - 1);
  c.quadraticCurveTo(0, hy - 8, -11.5, hy - 1);
  c.closePath();
  fillLit(c, 0, hy - 10, 14, C.a);
  c.strokeStyle = C.c;
  c.lineWidth = 1.3;
  c.beginPath();
  c.moveTo(-11.5, hy - 1);
  c.quadraticCurveTo(0, hy - 8, 11.5, hy - 1);
  c.stroke();
  // star map on hood
  c.fillStyle = "rgba(255,230,160,0.9)";
  c.strokeStyle = "rgba(255,230,160,0.55)";
  c.lineWidth = 0.6;
  const pts = [[-6, hy - 10], [-1, hy - 15], [4, hy - 13], [1, hy - 19]] as const;
  c.beginPath();
  pts.forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py)));
  c.stroke();
  for (const [px, py] of pts) c.fillRect(px - 0.7, py - 0.7, 1.4, 1.4);
  // crystal
  c.beginPath();
  c.moveTo(0, hy - 13);
  c.lineTo(3, hy - 8.5);
  c.lineTo(0, hy - 4.5);
  c.lineTo(-3, hy - 8.5);
  c.closePath();
  fillLit(c, 0, hy - 8.5, 4, C.d);
  c.strokeStyle = C.c;
  c.lineWidth = 1;
  c.stroke();
  // face
  const bl = blinkAt(t, 1.4);
  eye(c, -4.4, hy + 2, 2.8, 3.4, "#2f7be0", bl);
  eye(c, 4.4, hy + 2, 2.8, 3.4, "#2f7be0", bl);
  c.fillStyle = INK;
  c.beginPath();
  c.moveTo(-0.9, hy + 5.2);
  c.lineTo(0.9, hy + 5.2);
  c.lineTo(0, hy + 6.2);
  c.fill();
  c.strokeStyle = INK;
  c.lineWidth = 0.8;
  c.beginPath();
  c.arc(0, hy + 6.4, 1.6, 0.2, Math.PI - 0.2);
  c.stroke();
  // orbiting holo cubes
  for (let k = 0; k < 2; k++) {
    const a = t * 2 + k * Math.PI;
    cube(c, Math.cos(a) * 18, -4 + Math.sin(a) * 6, 2.6, t * 2 + k, C.d, 0.8);
  }
}

function drawKaren(c: Ctx, t: number) {
  const C = HERO_COL[2];
  const bob = Math.sin(t * 5.5) * 1;
  const hy = -9 + bob;
  // paint-swirl plume
  if (!low) {
    const gr = c.createLinearGradient(0, hy - 10, 8, hy - 40);
    gr.addColorStop(0, C.a);
    gr.addColorStop(0.6, C.b);
    gr.addColorStop(1, "#fff2f6");
    c.strokeStyle = gr;
  } else c.strokeStyle = C.a;
  c.lineCap = "round";
  c.lineWidth = 5;
  const sw = Math.sin(t * 3) * 2;
  c.beginPath();
  c.moveTo(1, hy - 9);
  c.bezierCurveTo(-8, hy - 22, -2 + sw, hy - 38, 10 + sw, hy - 34);
  c.stroke();
  c.lineWidth = 1.6;
  c.strokeStyle = "rgba(255,255,255,0.7)";
  c.beginPath();
  c.moveTo(-1, hy - 13);
  c.bezierCurveTo(-6, hy - 22, -2 + sw, hy - 34, 8 + sw, hy - 33);
  c.stroke();
  c.lineCap = "butt";
  // charm
  c.strokeStyle = C.d;
  c.lineWidth = 0.7;
  c.beginPath();
  c.moveTo(10 + sw, hy - 34);
  c.lineTo(11 + sw, hy - 27);
  c.stroke();
  blob(c, 11 + sw, hy - 26, 1.4, 1.4, C.b, { line: false });
  // coat with ragged hem
  c.beginPath();
  c.moveTo(-6, -1 + bob);
  c.lineTo(6, -1 + bob);
  c.lineTo(11, 12);
  for (let i = 0; i <= 6; i++) c.lineTo(11 - i * 3.67, 12 + (i % 2 ? 3 : 0));
  c.closePath();
  fillLit(c, 0, 4, 13, C.main);
  for (const [px, py, col] of [[-5, 6, C.a], [4, 3, C.b], [6, 10, C.c], [-2, 11, C.b]] as const) {
    c.fillStyle = col;
    c.beginPath();
    c.ellipse(px, py + bob * 0.5, 1.8, 1.3, px, 0, TAU);
    c.fill();
  }
  blob(c, -4, 14, 2.6, 2.2, "#3b2f4a");
  blob(c, 4, 14, 2.6, 2.2, "#3b2f4a");
  blob(c, -4, 15.5, 1.8, 1, C.d, { line: false });
  blob(c, 4, 15.5, 1.8, 1, C.d, { line: false });
  // brush
  c.strokeStyle = "#5a3d7a";
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(7, 11);
  c.lineTo(15, -4);
  c.stroke();
  c.fillStyle = C.d;
  c.fillRect(14, -6, 2.4, 2.4);
  blob(c, 16, -8, 1.8, 2.6, C.b, { rot: 0.5 });
  blob(c, 9, 4 + bob, 2.6, 2.6, "#3b2f4a");
  // ears: big patchwork + small cream
  c.beginPath();
  c.moveTo(-4, hy - 7);
  c.lineTo(-20, hy - 24);
  c.lineTo(-12, hy - 2);
  c.closePath();
  fillLit(c, -12, hy - 11, 10, "#f3c9dc");
  c.fillStyle = C.c;
  c.fillRect(-15, hy - 15, 4, 3);
  c.fillStyle = C.a;
  c.fillRect(-13, hy - 10, 3.5, 3.5);
  c.fillStyle = C.d;
  c.fillRect(-17, hy - 20, 3, 2.5);
  c.strokeStyle = INK;
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(-14, hy - 18);
  c.lineTo(-13, hy - 15);
  c.lineTo(-11.5, hy - 17);
  c.lineTo(-10.5, hy - 14);
  c.stroke();
  c.beginPath();
  c.moveTo(4, hy - 8);
  c.lineTo(13, hy - 19);
  c.lineTo(11, hy - 3);
  c.closePath();
  fillLit(c, 9, hy - 10, 8, C.main);
  blob(c, 0, hy, 11, 10, C.main, { gloss: true });
  // paint dabs on face
  c.fillStyle = C.a;
  c.beginPath();
  c.ellipse(-6, hy - 5, 1.6, 1, 0.4, 0, TAU);
  c.fill();
  // eyes: star eye + monocle
  const bl = blinkAt(t, 2.1);
  eye(c, -4.3, hy + 1.5, 2.8, 3.3, "#9b6bd6", bl);
  if (!bl) {
    c.fillStyle = "#fff6c0";
    starPath(c, -4.3, hy + 1.8, 1.3, 0.45);
    c.fill();
  }
  eye(c, 4.5, hy + 1.5, 2.8, 3.3, "#3fb3b3", bl);
  c.strokeStyle = C.d;
  c.lineWidth = 1.4;
  c.beginPath();
  c.arc(4.5, hy + 1.5, 4.2, 0, TAU);
  c.stroke();
  c.fillStyle = "rgba(130,230,230,0.25)";
  c.fill();
  // cat mouth
  c.strokeStyle = INK;
  c.lineWidth = 0.8;
  c.beginPath();
  c.arc(-1, hy + 6, 1, 0, Math.PI);
  c.arc(1, hy + 6, 1, 0, Math.PI);
  c.stroke();
}

const HEROES = [drawHaru, drawYuki, drawKaren];
/** hero sprite (≈44px tall at s=1); `aura` 0..1.6 during the R ultimate */
export function drawHero(c: Ctx, idx: number, x: number, y: number, s: number, t: number, aura = 0) {
  const C = HERO_COL[idx] ?? HERO_COL[0];
  groundShadow(c, x, y + 18 * s, 11 * s);
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  if (aura > 0) {
    const r = (1.6 - aura) * 90 + 20;
    c.globalAlpha = Math.min(1, aura);
    if (!low) {
      const gr = c.createRadialGradient(0, 0, 4, 0, 0, r);
      gr.addColorStop(0, "rgba(255,250,220,0.9)");
      gr.addColorStop(0.5, shade(C.a, 0.4).replace("rgb", "rgba").replace(")", ",0.4)"));
      gr.addColorStop(1, "rgba(255,255,255,0)");
      c.fillStyle = gr;
    } else c.fillStyle = "rgba(255,250,220,0.4)";
    c.beginPath();
    c.arc(0, 0, r, 0, TAU);
    c.fill();
    c.globalAlpha = 1;
  }
  (HEROES[idx] ?? drawHaru)(c, t);
  c.restore();
}

/** Haru's Q companion: a big beaming sun-buddy */
export function drawSunBuddy(c: Ctx, x: number, y: number, t: number, lv: number) {
  c.save();
  c.translate(x, y);
  const rays = lv >= 2 ? `hsl(${(t * 300) % 360} 90% 65%)` : lv ? "#ffd23f" : "#f07a5f";
  for (let i = 0; i < 10; i++) spike(c, 0, 0, t * 1.5 + (i * TAU) / 10, 22 + (i % 2) * 4, 7, i % 2 ? "#f2b43c" : rays, 0);
  blob(c, 0, 0, 15, 15, "#ffd76a", { gloss: true });
  eye(c, -5, -1, 2.2, 2.8, "#c0602a");
  eye(c, 5, -1, 2.2, 2.8, "#c0602a");
  c.fillStyle = "#d9534f";
  c.beginPath();
  c.arc(0, 4, 3, 0, Math.PI);
  c.fill();
  c.fillStyle = "rgba(240,122,95,0.5)";
  c.beginPath();
  c.arc(-9, 4, 2, 0, TAU);
  c.arc(9, 4, 2, 0, TAU);
  c.fill();
  c.restore();
}

// ---------- bosses ----------
function drawLuna(c: Ctx, t: number) {
  const flap = Math.sin(t * 5) * 0.22;
  for (const s of [-1, 1]) {
    for (let i = 0; i < 4; i++)
      spike(c, s * 12, -2, s > 0 ? -0.5 + i * 0.32 + flap : Math.PI + 0.5 - i * 0.32 - flap, 26 - i * 3, 11, i % 2 ? "#8a7bc8" : "#a798dc", s * 0.2);
  }
  c.fillStyle = "rgba(255,240,180,0.9)";
  for (const [px, py] of [[-30, -8], [-24, 6], [28, -6], [33, 6]] as const) {
    starPath(c, px, py + flap * 10, 2, 0.45);
    c.fill();
  }
  blob(c, -6, 17, 3, 2, "#f2cf6b");
  blob(c, 6, 17, 3, 2, "#f2cf6b");
  blob(c, 0, 2, 18, 17, "#4d4a8c", { gloss: true });
  blob(c, 0, 8, 11, 9.5, "#efe4f7", { line: false });
  c.strokeStyle = "#a798dc";
  c.lineWidth = 1.2;
  for (let i = 0; i < 3; i++) {
    c.beginPath();
    c.moveTo(-5 + i * 5 - 2, 6 + (i % 2) * 4);
    c.lineTo(-5 + i * 5, 8 + (i % 2) * 4);
    c.lineTo(-5 + i * 5 + 2, 6 + (i % 2) * 4);
    c.stroke();
  }
  // crescent ear tufts
  for (const s of [-1, 1]) {
    c.save();
    c.translate(s * 11, -16);
    c.rotate(s * 0.5);
    c.beginPath();
    c.arc(0, 0, 6, Math.PI * 0.85, Math.PI * 2.15);
    c.arc(0, 2.5, 4.5, Math.PI * 2.1, Math.PI * 0.9, true);
    c.closePath();
    fillLit(c, 0, 0, 6, "#f2cf6b");
    c.restore();
  }
  blob(c, -7, -4, 7.5, 7.5, "#f6eefc", { line: false });
  blob(c, 7, -4, 7.5, 7.5, "#f6eefc", { line: false });
  const bl = blinkAt(t, 0.8);
  eye(c, -7, -4, 4.6, 5, "#f5b83c", bl);
  eye(c, 7, -4, 4.6, 5, "#f5b83c", bl);
  c.beginPath();
  c.moveTo(-2, 1);
  c.lineTo(2, 1);
  c.lineTo(0, 4.5);
  c.closePath();
  fillLit(c, 0, 2, 3, "#f2b43c");
  glossyStar(c, 0, -24 + Math.sin(t * 3) * 1.5, 4.5, "#ffe08a");
}

function drawCiel(c: Ctx, t: number) {
  // five fanned fox tails
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i - 2) * 0.55 + Math.sin(t * 2 + i) * 0.07;
    spike(c, 0, 10, a, 40, 17, i % 2 ? "#9fd6f2" : "#c6e9f9", 0.3);
  }
  blob(c, 0, 6, 12, 12, "#eef8ff");
  for (let i = 0; i < 7; i++) blob(c, -12 + i * 4, -1 + Math.abs(i - 3) * 0.8, 3, 2.6, "#a8dcf5", { line: false });
  blob(c, -5, 17, 3, 2.2, "#cfeaf8");
  blob(c, 5, 17, 3, 2.2, "#cfeaf8");
  spike(c, -8, -14, -2.0, 14, 8, "#d8f0fb", 0.15);
  spike(c, 8, -14, -1.14, 14, 8, "#d8f0fb", -0.15);
  blob(c, 0, -9, 14, 12, "#f4fbff", { gloss: true });
  // crystal crown
  for (let i = -2; i <= 2; i++) {
    const h = 8 - Math.abs(i) * 2;
    c.beginPath();
    c.moveTo(i * 4.5, -20 - h);
    c.lineTo(i * 4.5 + 2.4, -20);
    c.lineTo(i * 4.5, -17.5);
    c.lineTo(i * 4.5 - 2.4, -20);
    c.closePath();
    fillLit(c, i * 4.5, -21, 4, "#8fd0f5");
  }
  c.fillStyle = "#e2b04a";
  c.fillRect(-11, -19, 22, 2);
  const bl = blinkAt(t, 2.2);
  eye(c, -5.5, -7, 3.2, 3.8, "#2c6fc0", bl);
  eye(c, 5.5, -7, 3.2, 3.8, "#2c6fc0", bl);
  c.fillStyle = INK;
  c.beginPath();
  c.arc(0, -2, 0.9, 0, TAU);
  c.fill();
  c.fillStyle = "rgba(160,200,255,0.6)";
  c.beginPath();
  c.arc(-9, -2, 1.8, 0, TAU);
  c.arc(9, -2, 1.8, 0, TAU);
  c.fill();
  for (let k = 0; k < 3; k++) {
    const a = t * 1.5 + (k * TAU) / 3;
    cube(c, Math.cos(a) * 32, -4 + Math.sin(a) * 10, 3, t * 2 + k, "#9fd8f7", 0.75);
  }
}

function drawScarlet(c: Ctx, t: number) {
  const flap = Math.sin(t * 6) * 0.25;
  for (const s of [-1, 1]) {
    c.save();
    c.scale(s, 1);
    c.rotate(-flap);
    c.beginPath();
    c.moveTo(6, -4);
    c.quadraticCurveTo(26, -26, 44, -12);
    c.quadraticCurveTo(38, -4, 40, 4);
    c.quadraticCurveTo(32, -1, 28, 8);
    c.quadraticCurveTo(22, 1, 16, 10);
    c.quadraticCurveTo(12, 4, 6, 8);
    c.closePath();
    fillLit(c, 26, -6, 22, "#7a3360");
    c.fillStyle = "rgba(255,170,200,0.45)";
    c.beginPath();
    c.moveTo(10, -2);
    c.quadraticCurveTo(26, -18, 38, -10);
    c.quadraticCurveTo(26, -4, 12, 5);
    c.closePath();
    c.fill();
    c.restore();
  }
  blob(c, 0, 7, 12, 11, "#e2526f", { gloss: true });
  c.fillStyle = "#ffe08a";
  for (const [px, py] of [[-5, 5], [3, 3], [6, 10], [-2, 12], [-7, 11]] as const) {
    c.beginPath();
    c.ellipse(px, py, 0.8, 1.2, 0.3, 0, TAU);
    c.fill();
  }
  for (let i = 0; i < 6; i++) blob(c, -10 + i * 4, 15, 2.6, 2, "#fff0f3", { line: false });
  spike(c, -7, -16, -2.1, 12, 9, "#f6a8bd", 0.1);
  spike(c, 7, -16, -1.04, 12, 9, "#f6a8bd", -0.1);
  blob(c, 0, -9, 13, 11.5, "#fbe9ee", { gloss: true });
  // teacup crown
  c.beginPath();
  c.moveTo(-6, -24);
  c.lineTo(6, -24);
  c.quadraticCurveTo(5, -17, 0, -17);
  c.quadraticCurveTo(-5, -17, -6, -24);
  c.closePath();
  fillLit(c, 0, -21, 6, "#fff4f7");
  c.strokeStyle = "#e2526f";
  c.lineWidth = 1.2;
  c.beginPath();
  c.arc(6.5, -21, 2, -1.4, 1.4);
  c.stroke();
  blob(c, 0, -17, 8, 1.6, "#f3c4cc");
  c.strokeStyle = "rgba(255,255,255,0.8)";
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(-1, -26);
  c.bezierCurveTo(-4, -29, 2, -31, -1, -34 - Math.sin(t * 4));
  c.stroke();
  const bl = blinkAt(t, 1.1);
  eye(c, -5, -7, 3.1, 3.6, "#c8203a", bl);
  eye(c, 5, -7, 3.1, 3.6, "#c8203a", bl);
  c.fillStyle = "#fff";
  c.beginPath();
  c.moveTo(-2.5, -2);
  c.lineTo(-1.5, 0.5);
  c.lineTo(-0.5, -2);
  c.moveTo(0.5, -2);
  c.lineTo(1.5, 0.5);
  c.lineTo(2.5, -2);
  c.fill();
  c.fillStyle = "rgba(240,90,120,0.45)";
  c.beginPath();
  c.arc(-8.5, -3, 1.8, 0, TAU);
  c.arc(8.5, -3, 1.8, 0, TAU);
  c.fill();
}

const BOSSES = [drawLuna, drawCiel, drawScarlet];
export function drawBossArt(c: Ctx, stage: number, x: number, y: number, t: number, s = 2) {
  groundShadow(c, x, y + 40, 34, 0.15);
  c.save();
  c.translate(x, y + Math.sin(t * 2) * 2);
  c.scale(s, s);
  (BOSSES[stage] ?? drawLuna)(c, t);
  c.restore();
}

// ---------- enemies / pets ----------
export function drawEnemy(c: Ctx, stage: number, x: number, y: number, r: number, t: number) {
  groundShadow(c, x, y + r + 6, r * 0.7, 0.13);
  c.save();
  c.translate(x, y);
  const k = r / 16;
  c.scale(k, k);
  const bl = blinkAt(t, x);
  if (stage === 0) {
    // moonlight moth puff
    const f = Math.sin(t * 14) * 0.35;
    spike(c, -2, 0, Math.PI + 0.5 + f, 15, 12, "#f6c6dc", 0.2);
    spike(c, 2, 0, -0.5 - f, 15, 12, "#f6c6dc", -0.2);
    blob(c, 0, 0, 11, 10, "#b9a3e6", { gloss: true });
    c.strokeStyle = INK;
    c.lineWidth = 0.8;
    c.beginPath();
    c.moveTo(-3, -9);
    c.quadraticCurveTo(-6, -15, -8, -15);
    c.moveTo(3, -9);
    c.quadraticCurveTo(6, -15, 8, -15);
    c.stroke();
    blob(c, -8, -15, 1.6, 1.6, "#ffe08a", { line: false });
    blob(c, 8, -15, 1.6, 1.6, "#ffe08a", { line: false });
    eye(c, -3.6, 0, 2.2, 2.7, "#5b4b8a", bl);
    eye(c, 3.6, 0, 2.2, 2.7, "#5b4b8a", bl);
  } else if (stage === 1) {
    // jelly slime with snowflake topper
    const sq = 1 + Math.sin(t * 6) * 0.06;
    blob(c, 0, 3, 13 * sq, 11 / sq, "#8ed9e6", { gloss: true, alpha: 0.92 });
    c.strokeStyle = "#ffffff";
    c.lineWidth = 1.4;
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI) / 3;
      c.beginPath();
      c.moveTo(Math.cos(a) * 4, -9 + Math.sin(a) * 4);
      c.lineTo(-Math.cos(a) * 4, -9 - Math.sin(a) * 4);
      c.stroke();
    }
    eye(c, -4, 2, 2.3, 2.8, "#2c6fc0", bl);
    eye(c, 4, 2, 2.3, 2.8, "#2c6fc0", bl);
    c.fillStyle = "rgba(255,150,180,0.5)";
    c.beginPath();
    c.arc(-7.5, 6, 1.6, 0, TAU);
    c.arc(7.5, 6, 1.6, 0, TAU);
    c.fill();
  } else {
    // strawberry bat
    const f = Math.sin(t * 16) * 0.3;
    spike(c, -6, -2, Math.PI + 0.3 + f, 12, 9, "#7a3360", 0.3);
    spike(c, 6, -2, -0.3 - f, 12, 9, "#7a3360", -0.3);
    blob(c, 0, 1, 11, 11.5, "#ef5470", { gloss: true });
    c.fillStyle = "#ffe08a";
    for (const [px, py] of [[-5, 5], [0, 8], [5, 5], [-6, -2], [6, -2]] as const) {
      c.beginPath();
      c.ellipse(px, py, 0.7, 1.1, 0, 0, TAU);
      c.fill();
    }
    for (const a of [-2.3, -1.57, -0.84]) spike(c, Math.cos(a) * 8, Math.sin(a) * 8 + 1, a, 6, 4, "#7cb342", 0.1);
    eye(c, -3.8, 0, 2.2, 2.7, "#5a1830", bl);
    eye(c, 3.8, 0, 2.2, 2.7, "#5a1830", bl);
  }
  c.restore();
}

/** pets (also mid-bosses): 0 azure dragon, 1 phoenix chick, 2 white tiger cub */
export function drawPetArt(c: Ctx, kind: number, x: number, y: number, t: number, s = 1) {
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  if (kind === 0) {
    for (let i = 5; i >= 1; i--) blob(c, Math.sin(t * 6 - i * 0.8) * 3.5, i * 3.4, 5.2 - i * 0.6, 4.6 - i * 0.5, i % 2 ? "#2fa38a" : "#4fd1b6", { line: i < 3 });
    spike(c, -3, -6, -2.1, 6, 2.6, "#f2cf6b", 0.2);
    spike(c, 3, -6, -1.05, 6, 2.6, "#f2cf6b", -0.2);
    blob(c, 0, -2, 6.5, 5.5, "#4fd1b6", { gloss: true });
    eye(c, -2.4, -2.4, 1.4, 1.8, "#c8203a");
    eye(c, 2.4, -2.4, 1.4, 1.8, "#c8203a");
  } else if (kind === 1) {
    const f = Math.sin(t * 12) * 0.5;
    for (const s2 of [-1, 1]) spike(c, s2 * 4, 0, s2 > 0 ? -0.4 - f : Math.PI + 0.4 + f, 10, 6, "#ff7a2e", s2 * 0.3);
    for (let i = -1; i <= 1; i++) spike(c, i * 2, 4, Math.PI / 2 + i * 0.4, 9, 3.5, i ? "#ffcf40" : "#ff5a1e", 0);
    for (let i = -1; i <= 1; i++) spike(c, i * 1.5, -5, -Math.PI / 2 + i * 0.45, 6, 3, "#ff5a1e", 0);
    blob(c, 0, 0, 6.5, 6, "#ffcf6a", { gloss: true });
    eye(c, -2.3, -0.5, 1.3, 1.7, "#5a2a10");
    eye(c, 2.3, -0.5, 1.3, 1.7, "#5a2a10");
    c.fillStyle = "#f2b43c";
    c.beginPath();
    c.moveTo(-1, 1.6);
    c.lineTo(1, 1.6);
    c.lineTo(0, 3.2);
    c.fill();
  } else {
    blob(c, -6, -6, 3, 3, "#f4f4f8");
    blob(c, 6, -6, 3, 3, "#f4f4f8");
    blob(c, -6, -6, 1.5, 1.5, "#f3b8c8", { line: false });
    blob(c, 6, -6, 1.5, 1.5, "#f3b8c8", { line: false });
    blob(c, 0, 0, 9, 8, "#f8f8fc", { gloss: true });
    c.strokeStyle = "#8f7cc0";
    c.lineWidth = 1.3;
    c.beginPath();
    c.moveTo(0, -8);
    c.lineTo(0, -5);
    c.moveTo(-8.5, -1);
    c.lineTo(-5.5, 0);
    c.moveTo(8.5, -1);
    c.lineTo(5.5, 0);
    c.stroke();
    eye(c, -3.2, -0.5, 1.6, 2, "#3b8fe0");
    eye(c, 3.2, -0.5, 1.6, 2, "#3b8fe0");
    c.fillStyle = "#ff8fa8";
    c.beginPath();
    c.arc(0, 2.8, 1, 0, TAU);
    c.fill();
  }
  c.restore();
}

// ---------- bullets ----------
const sprites = new Map<string, HTMLCanvasElement>();
/** glossy candy orb with a darker rim so it reads on pastel backgrounds */
export function candySprite(hue: number, r: number) {
  const h = Math.round(hue / 10) * 10;
  const rr = Math.round(r);
  const key = `b${h}:${rr}:${low ? 1 : 0}`;
  let cv = sprites.get(key);
  if (!cv) {
    cv = document.createElement("canvas");
    const R = rr + 2;
    cv.width = cv.height = R * 2;
    const x = cv.getContext("2d")!;
    x.beginPath();
    x.arc(R, R, rr, 0, TAU);
    if (low) x.fillStyle = `hsl(${h} 85% 62%)`;
    else {
      const gr = x.createRadialGradient(R - rr * 0.35, R - rr * 0.4, rr * 0.1, R, R, rr);
      gr.addColorStop(0, `hsl(${h} 100% 96%)`);
      gr.addColorStop(0.45, `hsl(${h} 90% 72%)`);
      gr.addColorStop(1, `hsl(${h} 80% 52%)`);
      x.fillStyle = gr;
    }
    x.fill();
    x.lineWidth = 1.6;
    x.strokeStyle = `hsl(${h} 70% 32%)`;
    x.stroke();
    x.fillStyle = "rgba(255,255,255,0.9)";
    x.beginPath();
    x.ellipse(R - rr * 0.35, R - rr * 0.4, rr * 0.3, rr * 0.2, -0.6, 0, TAU);
    x.fill();
    sprites.set(key, cv);
  }
  return cv;
}
/** jelly-bean shaped "rice" bullet, pointing along +x */
export function beanSprite(hue: number) {
  const h = Math.round(hue / 10) * 10;
  const key = `r${h}:${low ? 1 : 0}`;
  let cv = sprites.get(key);
  if (!cv) {
    cv = document.createElement("canvas");
    cv.width = 20;
    cv.height = 11;
    const x = cv.getContext("2d")!;
    x.beginPath();
    x.ellipse(10, 5.5, 8, 3.8, 0, 0, TAU);
    if (low) x.fillStyle = `hsl(${h} 85% 62%)`;
    else {
      const gr = x.createLinearGradient(0, 1, 0, 10);
      gr.addColorStop(0, `hsl(${h} 100% 92%)`);
      gr.addColorStop(0.5, `hsl(${h} 90% 68%)`);
      gr.addColorStop(1, `hsl(${h} 80% 48%)`);
      x.fillStyle = gr;
    }
    x.fill();
    x.lineWidth = 1.3;
    x.strokeStyle = `hsl(${h} 70% 30%)`;
    x.stroke();
    x.fillStyle = "rgba(255,255,255,0.85)";
    x.beginPath();
    x.ellipse(11, 3.6, 4, 1.1, 0, 0, TAU);
    x.fill();
    sprites.set(key, cv);
  }
  return cv;
}

// ---------- stages: sky + perspective floor + props ----------
const STAGE_ART = [
  { sky: ["#cdb8ec", "#f6d7e6"], tile: ["#f3d6e8", "#e8cdf0"], fog: "#f6d7e6" }, // moonlit flower field
  { sky: ["#b7e1f5", "#eefaff"], tile: ["#e3f6fb", "#c9ebf6"], fog: "#eefaff" }, // candy ice lake
  { sky: ["#f5bfcd", "#ffeede"], tile: ["#fde7e9", "#f3c6cf"], fog: "#ffeede" }, // strawberry tea manor
] as const;
const HZ = 150; // horizon line

function drawProp(c: Ctx, stage: number, x: number, y: number, s: number, i: number) {
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  groundShadow(c, 0, 0, 14, 0.14);
  if (stage === 0) {
    // giant flower
    c.strokeStyle = "#7cb342";
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(0, 0);
    c.quadraticCurveTo(4, -14, 0, -26);
    c.stroke();
    spike(c, 1, -10, -0.4, 10, 5, "#8bc34a", 0.2);
    const col = i % 2 ? "#f7a8c4" : "#c7a8f0";
    for (let k = 0; k < 5; k++) blob(c, Math.cos((k * TAU) / 5) * 7, -30 + Math.sin((k * TAU) / 5) * 5, 5.5, 4.2, col, { rot: (k * TAU) / 5 });
    blob(c, 0, -30, 4, 3.4, "#ffd76a", { gloss: true });
  } else if (stage === 1) {
    // ice crystal cluster
    for (const [ox, h, w] of [[-6, 22, 8], [5, 30, 9], [12, 16, 6]] as const) {
      c.beginPath();
      c.moveTo(ox - w / 2, 0);
      c.lineTo(ox - w / 2, -h + 6);
      c.lineTo(ox, -h);
      c.lineTo(ox + w / 2, -h + 6);
      c.lineTo(ox + w / 2, 0);
      c.closePath();
      fillLit(c, ox, -h / 2, h / 2, "#a9dcf3");
      c.fillStyle = "rgba(255,255,255,0.55)";
      c.fillRect(ox - w / 2 + 1, -h + 7, 1.6, h - 9);
    }
  } else {
    // teacup on a saucer
    blob(c, 0, -2, 16, 4, "#fbe0e6");
    c.beginPath();
    c.moveTo(-11, -20);
    c.lineTo(11, -20);
    c.quadraticCurveTo(10, -3, 0, -3);
    c.quadraticCurveTo(-10, -3, -11, -20);
    c.closePath();
    fillLit(c, 0, -12, 12, i % 2 ? "#fff4f7" : "#f8d2dc");
    c.strokeStyle = "#e2526f";
    c.lineWidth = 2;
    c.beginPath();
    c.arc(12, -13, 4, -1.3, 1.3);
    c.stroke();
    blob(c, 0, -20, 11, 2.6, "#c97b5a", { line: false });
  }
  c.restore();
}

export function drawStageBg(c: Ctx, stage: number, t: number, W: number, H: number, detail: number) {
  const A = STAGE_ART[stage] ?? STAGE_ART[0];
  // sky
  const sky = c.createLinearGradient(0, 0, 0, HZ);
  sky.addColorStop(0, A.sky[0]);
  sky.addColorStop(1, A.sky[1]);
  c.fillStyle = sky;
  c.fillRect(-20, -20, W + 40, HZ + 21);
  if (stage === 0) {
    const mg = c.createRadialGradient(370, 64, 10, 370, 64, 70);
    mg.addColorStop(0, "rgba(255,250,230,0.9)");
    mg.addColorStop(1, "rgba(255,250,230,0)");
    c.fillStyle = mg;
    c.fillRect(290, 0, 160, 140);
    blob(c, 370, 64, 30, 30, "#fff6dc", { line: false });
    blob(c, 360, 58, 6, 4, "#f1e2c0", { line: false, alpha: 0.6 });
  } else if (stage === 1) {
    for (const [px, w, h] of [[40, 120, 70], [200, 150, 95], [370, 130, 75]] as const) {
      c.fillStyle = "#cbe6f4";
      c.beginPath();
      c.moveTo(px - w / 2, HZ);
      c.lineTo(px, HZ - h);
      c.lineTo(px, HZ);
      c.fill();
      c.fillStyle = "#a9d3ea";
      c.beginPath();
      c.moveTo(px, HZ - h);
      c.lineTo(px + w / 2, HZ);
      c.lineTo(px, HZ);
      c.fill();
      c.fillStyle = "#ffffff";
      c.beginPath();
      c.moveTo(px - w * 0.13, HZ - h * 0.74);
      c.lineTo(px, HZ - h);
      c.lineTo(px + w * 0.13, HZ - h * 0.74);
      c.lineTo(px, HZ - h * 0.8);
      c.fill();
    }
  } else {
    for (const [px, w, h] of [[70, 34, 80], [130, 60, 60], [330, 60, 64], [395, 34, 92]] as const) {
      c.fillStyle = "#f3b3c4";
      c.fillRect(px - w / 2, HZ - h, w, h);
      c.fillStyle = "#e88fa8";
      c.fillRect(px + w / 6, HZ - h, w / 3, h);
      c.fillStyle = "#c95f80";
      c.beginPath();
      c.moveTo(px - w / 2 - 4, HZ - h);
      c.lineTo(px, HZ - h - w * 0.9);
      c.lineTo(px + w / 2 + 4, HZ - h);
      c.fill();
      c.fillStyle = "#fff4d6";
      c.fillRect(px - 4, HZ - h + 14, 8, 11);
    }
  }
  // perspective floor: y = HZ + D / z, x = W/2 + X * 90 / z
  const D = H - HZ;
  const scroll = t * 1.4;
  const frac = scroll % 1;
  const base = Math.floor(scroll);
  c.fillStyle = A.tile[0];
  c.fillRect(-20, HZ, W + 40, H - HZ + 20);
  const rows = detail >= 1 ? 16 : 10;
  const cols = detail >= 0.5 ? 7 : 0;
  c.fillStyle = A.tile[1];
  for (let k = 0; k < rows; k++) {
    const zA = 0.55 + k - frac;
    const zB = zA + 1;
    if (zA <= 0.2) continue;
    const yA = HZ + D / zA;
    const yB = HZ + D / zB;
    if (yB > H + 20) continue;
    if (!cols) {
      if ((k + base) % 2) c.fillRect(-20, yB, W + 40, yA - yB);
      continue;
    }
    for (let X = -cols; X < cols; X++) {
      if ((X + k + base) % 2 === 0) continue;
      c.beginPath();
      c.moveTo(W / 2 + (X * 90) / zA, yA);
      c.lineTo(W / 2 + ((X + 1) * 90) / zA, yA);
      c.lineTo(W / 2 + ((X + 1) * 90) / zB, yB);
      c.lineTo(W / 2 + (X * 90) / zB, yB);
      c.closePath();
      c.fill();
    }
  }
  // props rolling toward the camera along the sides
  if (detail >= 0.5) {
    const props: { x: number; y: number; s: number; i: number }[] = [];
    for (let i = 0; i < 8; i++) {
      const z = ((i * 1.9 - scroll) % 14 + 14) % 14 + 0.9;
      const X = (i % 2 ? 1 : -1) * (2.6 + (i % 3) * 0.7);
      props.push({ x: W / 2 + (X * 90) / z, y: HZ + D / z, s: 3.2 / z, i });
    }
    props.sort((p, q) => p.s - q.s);
    for (const p of props) if (p.y < H + 60) drawProp(c, stage, p.x, p.y, p.s, p.i);
  }
  // horizon haze
  const fog = c.createLinearGradient(0, HZ - 10, 0, HZ + 110);
  fog.addColorStop(0, A.fog);
  fog.addColorStop(1, A.fog + "00");
  c.fillStyle = fog;
  c.fillRect(-20, HZ - 10, W + 40, 120);
}

/** foreground drifting decor (petals / snow / sparkles) */
export function drawStageFx(c: Ctx, stage: number, t: number, W: number, H: number, n: number) {
  if (stage === 0) {
    for (let i = 0; i < n; i++) {
      const sy = ((i * 173 + t * (30 + (i % 5) * 14)) % (H + 20)) - 10;
      const sx = ((i * 97) % W) + Math.sin(t * 1.5 + i) * 14;
      c.fillStyle = i % 3 ? "rgba(247,168,196,0.75)" : "rgba(199,168,240,0.75)";
      c.beginPath();
      c.ellipse(sx, sy, 3.4, 1.8, t * 2 + i, 0, TAU);
      c.fill();
    }
  } else if (stage === 1) {
    c.strokeStyle = "rgba(120,180,220,0.55)";
    c.lineWidth = 1;
    for (let i = 0; i < n; i++) {
      const sy = ((i * 131 + t * (22 + (i % 4) * 10)) % (H + 20)) - 10;
      const sx = ((i * 89) % W) + Math.sin(t + i) * 12;
      const r = 1.6 + (i % 3);
      c.fillStyle = "rgba(255,255,255,0.9)";
      c.beginPath();
      c.arc(sx, sy, r, 0, TAU);
      c.fill();
      c.stroke();
    }
  } else {
    for (let i = 0; i < n; i++) {
      const sy = H - (((i * 151 + t * (26 + (i % 5) * 12)) % (H + 20)) - 10);
      const sx = ((i * 71) % W) + Math.sin(t * 2 + i) * 8;
      if (i % 4 === 0) {
        c.fillStyle = "rgba(240,90,120,0.55)";
        heartPath(c, sx, sy, 3);
        c.fill();
      } else {
        c.strokeStyle = "rgba(255,255,255,0.85)";
        c.lineWidth = 1;
        c.beginPath();
        c.arc(sx, sy, 2 + (i % 3), 0, TAU);
        c.stroke();
      }
    }
  }
}

/** outlined label that reads on both light and dark areas */
export function label(c: Ctx, text: string, x: number, y: number, font: string, fill = INK, stroke = "rgba(255,255,255,0.92)") {
  c.font = font;
  c.lineJoin = "round";
  c.lineWidth = 3;
  c.strokeStyle = stroke;
  c.strokeText(text, x, y);
  c.fillStyle = fill;
  c.fillText(text, x, y);
}
