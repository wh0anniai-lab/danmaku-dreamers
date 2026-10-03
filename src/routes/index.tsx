import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Bgm } from "@/lib/bgm";
import haruArt from "@/assets/haru.jpg.asset.json";
import yukiArt from "@/assets/yuki.jpg.asset.json";
import karenArt from "@/assets/karen.jpg.asset.json";
const ART_URLS = [haruArt.url, yukiArt.url, karenArt.url];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "탄막 소녀 — 총알 피하기 탄막 슈팅" },
      {
        name: "description",
        content:
          "동방 프로젝트 스타일 탄막 슈팅 게임. 방향키로 피하고 Q/W/E/R 스킬로 45초 보스를 격파하세요.",
      },
      { property: "og:title", content: "탄막 소녀 — 총알 피하기 탄막 슈팅" },
      {
        property: "og:description",
        content: "5초마다 거세지는 탄막, 45초 보스전. 목숨 3개로 스테이지를 클리어하세요.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Game,
});

const W = 480;
const H = 680;
const BOSS_TIME = 45;
const TUTORIAL = 5;
const BOSS_ULT = 7;
const BOSS_ULT_NAMES = ["월광 「크레센트 레퀴엠」", "빙결 「다이아몬드 블리자드」", "홍월 「스칼렛 디스티니」"];
type Ups = { q: number; w: number; e: number };
const UP_DESC = { q: "쿨 -15% · 지속 +35%", w: "쿨 -15% · 지속 +35%", e: "쿨 -15% · 효과 +35%" };

type Pal = { dress: string; hair: string; ribbon: string; sleeve?: string; acc?: "fox" | "flower" | "sword" };
const STAGES = [
  {
    name: "스테이지 1 — 환상향의 밤하늘",
    bg: ["#150a25", "#22103a", "#3b1550"],
    fx: "stars" as const,
    enemy: "#ff8ac4",
    shape: "star" as const,
    boss: {
      name: "밤의 마녀 · 루나",
      hp: 1600,
      wing: "rgba(120,60,180,0.55)",
      hat: "#2b1b46",
      pal: { dress: "#2b1b46", hair: "#f5e27a", ribbon: "#ff4d6d" },
    },
  },
  {
    name: "스테이지 2 — 얼어붙은 안개 호수",
    bg: ["#061a2b", "#0b3450", "#1b5a78"],
    fx: "snow" as const,
    enemy: "#8fe3ff",
    shape: "fairy" as const,
    boss: {
      name: "얼음 요정 여왕 · 시엘",
      hp: 2300,
      wing: "rgba(150,225,255,0.55)",
      hat: "#1c4d7a",
      pal: { dress: "#3aa0e8", hair: "#dff6ff", ribbon: "#1c4d7a" },
    },
  },
  {
    name: "스테이지 3 — 홍염의 저택",
    bg: ["#240606", "#4a0d0d", "#7a1f10"],
    fx: "embers" as const,
    enemy: "#ffb347",
    shape: "spike" as const,
    boss: {
      name: "홍마의 아가씨 · 스칼렛",
      hp: 3200,
      wing: "rgba(40,10,20,0.75)",
      hat: "#f4e9ee",
      pal: { dress: "#b0122a", hair: "#c9b8ff", ribbon: "#b0122a" },
    },
  },
];
const stg = (i: number) => STAGES[Math.max(0, Math.min(STAGES.length - 1, i))]!;
const PLAYER_PAL: Pal = { dress: "#e8467c", hair: "#7d59ea", ribbon: "#ff4d6d" };

type Char = {
  name: string;
  title: string;
  pal: Pal;
  speed: number;
  shot: string;
  skills: { q: [string, number]; w: [string, number]; e: [string, number] };
  ult: { name: string; radius: number; dmg: number; label: string };
  desc: string[];
};
const CHARS: Char[] = [
  {
    name: "하루",
    title: "무녀 · 밸런스형",
    pal: { dress: "#d8263a", hair: "#2a2026", ribbon: "#e8344a", sleeve: "#fbf7f2", acc: "fox" },
    speed: 1,
    shot: "#9be8ff",
    skills: { q: ["강화 발출", 6], w: ["방어막", 9], e: ["자동 회피", 11] },
    ult: { name: "몽환봉인", radius: 9999, dmg: 160, label: "맵 전체 소거 · 피해 약" },
    desc: ["Q 4초간 4갈래 강화 사격", "W 1회 피격 무효 방어막", "E 1초간 자동으로 탄 회피"],
  },
  {
    name: "유키",
    title: "얼음 마법사 · 제어형",
    pal: { dress: "#8fd3ee", hair: "#bfe4ee", ribbon: "#2f4f8a", sleeve: "#e4f6fb", acc: "flower" },
    speed: 0.95,
    shot: "#c8f0ff",
    skills: { q: ["유도 빙탄", 7], w: ["시간 감속", 12], e: ["순간이동", 8] },
    ult: { name: "절대영도", radius: W / 2, dmg: 420, label: "맵 절반 반경 소거 · 피해 중" },
    desc: ["Q 4초간 적을 쫓는 유도탄", "W 3초간 모든 탄 속도 1/3", "E 이동 방향으로 순간이동 + 무적"],
  },
  {
    name: "카렌",
    title: "홍염 검사 · 근접형",
    pal: { dress: "#7a1424", hair: "#2b1d3d", ribbon: "#c8203a", sleeve: "#f6b3a8", acc: "sword" },
    speed: 1.1,
    shot: "#ffcf70",
    skills: { q: ["화염 레이저", 8], w: ["반사 결계", 10], e: ["돌진", 6] },
    ult: { name: "홍련참", radius: W / 3, dmg: 900, label: "맵 1/3 반경 소거 · 피해 강" },
    desc: ["Q 3초간 탄을 태우는 관통 레이저", "W 2.5초간 주변 탄을 적에게 반사", "E 짧은 돌진 + 경로의 탄 소거"],
  },
];

type Bullet = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hue: number;
  kind: "ball" | "rice";
};
type Shot = { x: number; y: number; vx: number; vy: number; power: number; homing?: boolean };
type Enemy = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  r: number;
  t: number;
  fire: number;
  boss: boolean;
  maxHp: number;
  mid?: boolean;
  life?: number;
};
type Pet = { kind: number; fire: number; a: number };
type Item = { x: number; y: number; kind: number; t: number };
const MID_TIME = 25;
const PET_COL = ["#3fd1b0", "#ff7a2e", "#e8eefc"];
const MID_LIFE = 10;
const PET_NAMES = ["청룡", "불사조", "백호"];
const PET_DESC = [
  "Q 뇌룡 유도탄 · W 용린 탄 소거 · E 용돌진",
  "Q 화염 고리 · W 재생의 불꽃 · E 불새 무적",
  "Q 호조 할퀴기 · W 포효 감속 · E 도약 일격",
];
type Particle = { x: number; y: number; vx: number; vy: number; life: number; hue: number };

type Phase = "title" | "select" | "play" | "stageclear" | "clear" | "over" | "continue";

type Skill = { cd: number; max: number };

function Game() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [phase, setPhase] = useState<Phase>("title");
  const [charIdx, setCharIdx] = useState(0);
  const [coin, setCoin] = useState("");
  const [coinErr, setCoinErr] = useState(false);
  const [muted, setMuted] = useState(false);
  const bgmRef = useRef<Bgm | null>(null);
  const [hud, setHud] = useState({
    lives: 3,
    time: 0,
    level: 1,
    score: 0,
    q: 0,
    w: 0,
    e: 0,
    gauge: 0,
    bossHp: 0,
    bossMax: 0,
    shield: 0,
    dodge: 0,
    stage: 0,
  });
  const [ups, setUps] = useState<Ups>({ q: 0, w: 0, e: 0 });
  const [upPick, setUpPick] = useState<keyof Ups | null>(null);
  const startRef = useRef<((c: number) => void) | null>(null);
  const nextRef = useRef<((u: Ups) => void) | null>(null);
  const reviveRef = useRef<(() => void) | null>(null);
  const tapRef = useRef<((k: string) => void) | null>(null);


  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const keys = new Set<string>();
    const taps = new Set<string>();

    const g = {
      running: false,
      stage: 0,
      t: 0,
      lives: 3,
      score: 0,
      px: W / 2,
      py: H - 90,
      inv: 0,
      shield: 0,
      dodge: 0,
      gauge: 0,
      ult: 0,
      shotCd: 0,
      power: 0,
      bullets: [] as Bullet[],
      shots: [] as Shot[],
      enemies: [] as Enemy[],
      parts: [] as Particle[],
      spawn: 0,
      bossSpawned: false,
      skills: {
        q: { cd: 0, max: 6 } as Skill,
        w: { cd: 0, max: 9 } as Skill,
        e: { cd: 0, max: 11 } as Skill,
      },
      shake: 0,
      pose: 0,
      char: 0,
      slow: 0,
      reflect: 0,
      ultR: 9999,
      up: { q: 0, w: 0, e: 0 } as Ups,
      bossUlt: 0,
      bossUltUsed: false,
      midSpawned: false,
      pets: [] as Pet[],
      items: [] as Item[],
      petGuard: 0,
    };
    const bgm = () => (bgmRef.current ??= new Bgm());

    const onDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.tagName === "INPUT") return;
      const k = e.key.toLowerCase();
      if (
        ["arrowup", "arrowdown", "arrowleft", "arrowright", " ", "q", "w", "e", "r", "shift"].includes(k)
      )
        e.preventDefault();
      keys.add(k);
      if (g.running && ["q", "w", "e", "r"].includes(k)) taps.add(k);
    };
    const onUp = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);

    // touch / mouse drag movement (relative)
    let drag: { id: number; x: number; y: number } | null = null;
    const onPD = (ev: PointerEvent) => {
      if (!g.running) return;
      ev.preventDefault();
      drag = { id: ev.pointerId, x: ev.clientX, y: ev.clientY };
      canvas.setPointerCapture(ev.pointerId);
    };
    const onPM = (ev: PointerEvent) => {
      if (!drag || ev.pointerId !== drag.id || !g.running) return;
      ev.preventDefault();
      const r = canvas.getBoundingClientRect();
      const s = (W / r.width) * 1.25;
      g.px = Math.max(14, Math.min(W - 14, g.px + (ev.clientX - drag.x) * s));
      g.py = Math.max(20, Math.min(H - 20, g.py + (ev.clientY - drag.y) * s));
      drag.x = ev.clientX;
      drag.y = ev.clientY;
    };
    const onPU = (ev: PointerEvent) => {
      if (drag && ev.pointerId === drag.id) drag = null;
    };
    canvas.addEventListener("pointerdown", onPD);
    canvas.addEventListener("pointermove", onPM);
    canvas.addEventListener("pointerup", onPU);
    canvas.addEventListener("pointercancel", onPU);
    tapRef.current = (k) => {
      if (g.running) taps.add(k);
    };
    const pressed = (k: string) => keys.has(k) || taps.has(k);

    const burst = (x: number, y: number, n: number, hue: number) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = 0.5 + Math.random() * 3.5;
        g.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, hue });
      }
    };

    const level = () => Math.min(9, Math.floor(g.t / 5) + 1);
    const diff = () => Math.min(11, level() + g.stage * 2);

    const spawnEnemy = () => {
      const lv = diff();
      g.enemies.push({
        x: 40 + Math.random() * (W - 80),
        y: -30,
        vx: (Math.random() - 0.5) * 1.2,
        vy: 0.5 + lv * 0.08,
        hp: 5 + lv * 3,
        maxHp: 5 + lv * 3,
        r: 16,
        t: Math.random() * 10,
        fire: 0,
        boss: false,
      });
    };

    const spawnBoss = () => {
      g.enemies.length = 0;
      g.bullets.length = 0;
      g.enemies.push({
        x: W / 2,
        y: -60,
        vx: 1.1,
        vy: 0.6,
        hp: stg(g.stage).boss.hp,
        maxHp: stg(g.stage).boss.hp,
        r: 30,
        t: 0,
        fire: 0,
        boss: true,
      });
      g.shake = 12;
    };

    const spawnMid = () => {
      const hp = stg(g.stage).boss.hp / 2;
      g.enemies.push({ x: W / 2, y: -40, vx: 1.4, vy: 0, hp, maxHp: hp, r: 24, t: 0, fire: 1, boss: false, mid: true, life: MID_LIFE });
      g.shake = 8;
    };
    const petSkill = (k: "q" | "w" | "e") => {
      const near = () => {
        let best: Enemy | null = null;
        let bd = Infinity;
        for (const e of g.enemies) {
          const d = Math.hypot(e.x - g.px, e.y - g.py);
          if (d < bd) { bd = d; best = e; }
        }
        return best;
      };
      g.pets.forEach((pt, i) => {
        const ox = g.px + Math.cos(pt.a) * 40;
        const oy = g.py + Math.sin(pt.a) * 40;
        if (pt.kind === 0) {
          if (k === "q") for (let j = 0; j < 8; j++) g.shots.push({ x: ox, y: oy, vx: Math.cos(-Math.PI / 2 + (j - 3.5) * 0.3) * 8, vy: Math.sin(-Math.PI / 2 + (j - 3.5) * 0.3) * 8, power: 5, homing: true });
          else if (k === "w") g.petGuard = Math.max(g.petGuard, 2.5);
          else for (let j = 0; j < 12; j++) g.shots.push({ x: ox + (j - 6) * 3, y: oy, vx: 0, vy: -16, power: 6 });
          burst(ox, oy, 18, 160);
        } else if (pt.kind === 1) {
          if (k === "q") for (let j = 0; j < 16; j++) { const a = (j / 16) * Math.PI * 2; g.shots.push({ x: ox, y: oy, vx: Math.cos(a) * 9, vy: Math.sin(a) * 9, power: 4 }); }
          else if (k === "w") g.bullets = g.bullets.filter((b) => Math.hypot(b.x - g.px, b.y - g.py) > 90);
          else g.inv = Math.max(g.inv, 0.8);
          burst(ox, oy, 22, 20);
        } else {
          const t = near();
          if (k === "q" && t) { t.hp -= 40; burst(t.x, t.y, 20, 0); }
          else if (k === "w") g.slow = Math.max(g.slow, 1.5);
          else if (t) { t.hp -= 80; burst(t.x, t.y, 30, 50); }
          burst(ox, oy, 18, 0);
        }
        void i;
      });
    };

    const shootBullet = (x: number, y: number, ang: number, sp: number, hue: number, kind: Bullet["kind"] = "ball") => {
      g.bullets.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, r: kind === "rice" ? 4 : 6, hue, kind });
    };

    const hitPlayer = () => {
      if (g.inv > 0 || g.dodge > 0) return;
      if (g.shield > 0) {
        g.shield = 0;
        g.inv = 1;
        burst(g.px, g.py, 26, 200);
        g.shake = 8;
        return;
      }
      g.lives -= 1;
      g.inv = 2.2;
      g.shake = 14;
      burst(g.px, g.py, 60, 330);
      g.bullets = g.bullets.filter((b) => Math.hypot(b.x - g.px, b.y - g.py) > 90);
      if (g.lives <= 0) {
        g.lives = 0;
        g.pets = [];
        g.running = false;
        keys.clear();
        bgm().stop();
        setPhase("continue");
      }
    };

    const useUlt = () => {
      if (g.gauge < 1 || g.ult > 0) return;
      const u = CHARS[g.char]!.ult;
      g.gauge = 0;
      g.ult = 1.6;
      g.ultR = u.radius;
      g.inv = Math.max(g.inv, 1.8);
      g.shake = 18;
      g.bullets = g.bullets.filter((b) => {
        if (Math.hypot(b.x - g.px, b.y - g.py) < u.radius) {
          burst(b.x, b.y, 2, b.hue);
          return false;
        }
        return true;
      });
      g.score += 300;
      for (const e of g.enemies) {
        if (Math.hypot(e.x - g.px, e.y - g.py) < u.radius + e.r) {
          e.hp -= e.boss || e.mid ? u.dmg : 999;
          burst(e.x, e.y, 30, 50);
        }
      }
    };

    let last = performance.now();
    let raf = 0;

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      if (g.running) update(dt);
      draw();
    };

    const update = (dt: number) => {
      g.t += dt;
      const lv = level();
      const dv = diff();

      const ch = CHARS[g.char]!;
      // movement
      const focus = keys.has("shift");
      const sp = (focus ? 2.0 : 4.2) * ch.speed * (dt * 60);
      if (keys.has("arrowleft")) g.px -= sp;
      if (keys.has("arrowright")) g.px += sp;
      if (keys.has("arrowup")) g.py -= sp;
      if (keys.has("arrowdown")) g.py += sp;
      g.px = Math.max(14, Math.min(W - 14, g.px));
      g.py = Math.max(20, Math.min(H - 20, g.py));

      // timers
      g.inv = Math.max(0, g.inv - dt);
      g.shield = Math.max(0, g.shield - dt);
      g.dodge = Math.max(0, g.dodge - dt);
      g.slow = Math.max(0, g.slow - dt);
      g.reflect = Math.max(0, g.reflect - dt);
      g.ult = Math.max(0, g.ult - dt);
      g.bossUlt = Math.max(0, g.bossUlt - dt);
      // ultimate keeps erasing every bullet inside its range while active
      if (g.ult > 0) g.bullets = g.bullets.filter((b) => Math.hypot(b.x - g.px, b.y - g.py) >= g.ultR);
      g.power = Math.max(0, g.power - dt);
      g.shake = Math.max(0, g.shake - dt * 30);
      g.gauge = Math.min(1, g.gauge + dt / 5);
      for (const k of ["q", "w", "e"] as const) g.skills[k].cd = Math.max(0, g.skills[k].cd - dt);
      const mq = 1 + 0.35 * g.up.q;
      const mw = 1 + 0.35 * g.up.w;
      const me = 1 + 0.35 * g.up.e;

      // skills (per character)
      if (pressed("q") && g.skills.q.cd === 0) {
        g.skills.q.cd = g.skills.q.max;
        g.power = (g.char === 2 ? 3 : 4) * mq;
        burst(g.px, g.py, 20, g.char === 1 ? 195 : 40);
        petSkill("q");
      }
      if (pressed("w") && g.skills.w.cd === 0) {
        g.skills.w.cd = g.skills.w.max;
        if (g.char === 0) g.shield = 4 * mw;
        else if (g.char === 1) g.slow = 3 * mw;
        else g.reflect = 2.5 * mw;
        burst(g.px, g.py, 20, g.char === 2 ? 30 : 200);
        petSkill("w");
      }
      if (pressed("e") && g.skills.e.cd === 0) {
        g.skills.e.cd = g.skills.e.max;
        petSkill("e");
        if (g.char === 0) {
          g.dodge = 1 * me;
          burst(g.px, g.py, 20, 300);
        } else {
          let dx = (keys.has("arrowright") ? 1 : 0) - (keys.has("arrowleft") ? 1 : 0);
          let dy = (keys.has("arrowdown") ? 1 : 0) - (keys.has("arrowup") ? 1 : 0);
          if (!dx && !dy) dy = -1;
          const dl = Math.hypot(dx, dy);
          dx /= dl;
          dy /= dl;
          const dist = (g.char === 1 ? 140 : 120) * (1 + 0.15 * g.up.e);
          const ox = g.px;
          const oy = g.py;
          burst(ox, oy, 24, g.char === 1 ? 195 : 20);
          g.px = Math.max(14, Math.min(W - 14, g.px + dx * dist));
          g.py = Math.max(20, Math.min(H - 20, g.py + dy * dist));
          g.inv = Math.max(g.inv, (g.char === 1 ? 0.8 : 0.5) * me);
          if (g.char === 2) {
            // dash clears bullets along the path
            g.bullets = g.bullets.filter((b) => {
              const vx = g.px - ox;
              const vy = g.py - oy;
              const L = vx * vx + vy * vy || 1;
              const t = Math.max(0, Math.min(1, ((b.x - ox) * vx + (b.y - oy) * vy) / L));
              return Math.hypot(b.x - (ox + vx * t), b.y - (oy + vy * t)) > 26 + 8 * g.up.e;
            });
          }
          burst(g.px, g.py, 24, g.char === 1 ? 195 : 20);
        }
      }
      if (pressed("r")) useUlt();
      taps.clear();

      // auto dodge: nudge away from nearest bullet
      if (g.dodge > 0) {
        let bx = 0,
          by = 0;
        for (const b of g.bullets) {
          const d = Math.hypot(b.x - g.px, b.y - g.py);
          if (d < 110 && d > 0.1) {
            bx -= (b.x - g.px) / d / d * 140;
            by -= (b.y - g.py) / d / d * 140;
          }
        }
        g.px = Math.max(14, Math.min(W - 14, g.px + bx * dt * 12));
        g.py = Math.max(20, Math.min(H - 20, g.py + by * dt * 12));
      }

      // player shots (auto fire)
      g.shotCd -= dt;
      if (g.shotCd <= 0) {
        if (g.char === 0) {
          g.shotCd = g.power > 0 ? 0.055 : 0.1;
          const pw = g.power > 0 ? 4 : 2;
          const spread = g.power > 0 ? [-0.22, -0.08, 0.08, 0.22] : [-0.05, 0.05];
          for (const a of spread)
            g.shots.push({ x: g.px, y: g.py - 16, vx: Math.sin(a) * 9, vy: -13, power: pw });
        } else if (g.char === 1) {
          g.shotCd = 0.09;
          if (g.power > 0)
            for (const a of [-0.9, -0.3, 0.3, 0.9])
              g.shots.push({ x: g.px, y: g.py - 12, vx: Math.sin(a) * 8, vy: -8, power: 3, homing: true });
          else
            for (const a of [-0.04, 0.04])
              g.shots.push({ x: g.px, y: g.py - 16, vx: Math.sin(a) * 9, vy: -13, power: 2 });
        } else {
          g.shotCd = 0.08;
          g.shots.push({ x: g.px, y: g.py - 18, vx: 0, vy: -15, power: 3 });
        }
      }

      // spawning
      if (!g.bossSpawned) {
        const tutorial = g.stage === 0 && g.t < TUTORIAL;
        if (!tutorial) g.spawn -= dt;
        if (g.spawn <= 0) {
          g.spawn = Math.max(0.3, 1.5 - dv * 0.12);
          spawnEnemy();
        }
        if (g.t >= MID_TIME && !g.midSpawned) {
          g.midSpawned = true;
          spawnMid();
        }
        if (g.t >= BOSS_TIME) {
          g.enemies = g.enemies.filter((e) => !e.mid);
          g.bossSpawned = true;
          spawnBoss();
          bgm().play("boss", g.stage * 2);
        }
      }

      // enemies
      for (const e of g.enemies) {
        e.t += dt;
        if (e.mid) {
          e.life = (e.life ?? 0) - dt;
          if (e.y < 150) e.y += 60 * dt;
          e.x += e.vx * dt * 60;
          if (e.x < 60 || e.x > W - 60) e.vx *= -1;
          e.fire -= dt;
          if (e.fire <= 0) {
            e.fire = 0.45;
            const n = 12 + g.stage * 4;
            const hue = [280, 30, 190][g.stage] ?? 0;
            for (let i = 0; i < n; i++) shootBullet(e.x, e.y, e.t * 1.3 + (i * Math.PI * 2) / n, 2.2 + g.stage * 0.3, hue, "rice");
            const aim = Math.atan2(g.py - e.y, g.px - e.x);
            for (let i = -1; i <= 1; i++) shootBullet(e.x, e.y, aim + i * 0.15, 3.6, hue + 40);
          }
          if ((e.life ?? 0) <= 0) { burst(e.x, e.y, 40, 200); e.y = H + 999; e.hp = 1; }
        } else if (e.boss) {
          if (e.y < 130) e.y += 40 * dt;
          else {
            e.x += e.vx * dt * 60;
            if (e.x < 70 || e.x > W - 70) e.vx *= -1;
          }
          if (e.y >= 120) {
            e.fire -= dt;
            const hpRatio = e.hp / e.maxHp;
            const aim = Math.atan2(g.py - e.y, g.px - e.x);
            if (hpRatio <= 0.1 && !g.bossUltUsed) {
              g.bossUltUsed = true;
              g.bossUlt = BOSS_ULT;
              g.bullets.length = 0;
              g.shake = 20;
              burst(e.x, e.y, 120, 0);
              e.fire = 1.2; // wind-up
            }
            if (g.bossUlt > 0) {
              // boss is invulnerable-ish during wind-up, then fires its ultimate
              e.x += (W / 2 - e.x) * Math.min(1, dt * 3);
              if (e.fire <= 0) {
                if (g.stage === 0) {
                  e.fire = 0.07;
                  for (let k = 0; k < 6; k++) {
                    shootBullet(e.x, e.y, e.t * 2.6 + (k * Math.PI) / 3, 3.0, 300, "rice");
                    shootBullet(e.x, e.y, -e.t * 2.6 + (k * Math.PI) / 3, 2.4, 50, "rice");
                  }
                } else if (g.stage === 1) {
                  e.fire = 0.32;
                  const n = 30;
                  const off = Math.random() * 0.2;
                  for (let i = 0; i < n; i++) shootBullet(e.x, e.y, off + (i * Math.PI * 2) / n, 2.0, 190);
                  for (let i = 0; i < 4; i++)
                    shootBullet(20 + Math.random() * (W - 40), -10, Math.PI / 2 + (Math.random() - 0.5) * 0.4, 2.6, 210, "rice");
                } else {
                  e.fire = 0.06;
                  for (let k = 0; k < 5; k++)
                    shootBullet(e.x, e.y, e.t * 3.4 + (k * Math.PI * 2) / 5, 3.4, 0, "rice");
                  if (Math.random() < 0.12)
                    for (let i = -3; i <= 3; i++) shootBullet(e.x, e.y, aim + i * 0.1, 4.6, 30);
                }
              }
            } else if (e.fire <= 0 && g.stage === 0) {
              e.fire = hpRatio > 0.5 ? 0.14 : 0.1;
              const n = hpRatio > 0.5 ? 9 : 13;
              const base = e.t * (hpRatio > 0.5 ? 1.7 : -2.3);
              for (let i = 0; i < n; i++)
                shootBullet(e.x, e.y, base + (i * Math.PI * 2) / n, 2.6, hpRatio > 0.5 ? 320 : 20, "rice");
              if (Math.random() < 0.35) {
                for (let i = -2; i <= 2; i++) shootBullet(e.x, e.y, aim + i * 0.12, 4.2, 190);
              }
            } else if (e.fire <= 0 && g.stage === 1) {
              e.fire = hpRatio > 0.5 ? 0.22 : 0.16;
              const n = hpRatio > 0.5 ? 14 : 18;
              const off = (Math.floor(e.t * 5) % 2) * (Math.PI / n);
              for (let i = 0; i < n; i++) shootBullet(e.x, e.y, off + (i * Math.PI * 2) / n, 2.2, 195);
              if (Math.random() < 0.4)
                for (let i = -3; i <= 3; i++) shootBullet(e.x, e.y, aim + i * 0.09, 3.6, 170, "rice");
              if (hpRatio <= 0.5)
                for (const s of [-1, 1])
                  for (let i = 0; i < 3; i++)
                    shootBullet(e.x + s * 50, e.y, e.t * 3 * s + (i * Math.PI * 2) / 3, 2.8, 220, "rice");
            } else if (e.fire <= 0) {
              e.fire = hpRatio > 0.5 ? 0.08 : 0.065;
              for (let k = 0; k < 4; k++) {
                shootBullet(e.x, e.y, e.t * 2.1 + (k * Math.PI) / 2, 3, 10, "rice");
                shootBullet(e.x, e.y, -e.t * 1.6 + (k * Math.PI) / 2, 2.3, 40, "rice");
              }
              if (Math.random() < 0.1)
                for (let i = 0; i < 24; i++) shootBullet(e.x, e.y, (i * Math.PI * 2) / 24 + e.t, 1.8, 0);
              if (hpRatio <= 0.5 && Math.random() < 0.18)
                for (let i = -2; i <= 2; i++) shootBullet(e.x, e.y, aim + i * 0.13, 4.5, 50);
            }
          }
        } else {
          e.x += e.vx * dt * 60;
          e.y += e.vy * dt * 60;
          if (e.x < 20 || e.x > W - 20) e.vx *= -1;
          e.fire -= dt;
          if (e.fire <= 0 && e.y > 10) {
            e.fire = Math.max(0.5, 1.9 - dv * 0.14);
            const a = Math.atan2(g.py - e.y, g.px - e.x);
            const speed = 2 + dv * 0.2;
            const hue = g.stage === 0 ? 280 : g.stage === 1 ? 195 : 20;
            if (dv <= 2) shootBullet(e.x, e.y, a, speed, hue);
            else if (dv <= 4) for (let i = -1; i <= 1; i++) shootBullet(e.x, e.y, a + i * 0.2, speed, hue);
            else if (dv <= 6) {
              const n = 8 + dv;
              for (let i = 0; i < n; i++) shootBullet(e.x, e.y, (i * Math.PI * 2) / n + e.t, speed * 0.85, hue - 40, "rice");
            } else {
              const n = 12;
              for (let i = 0; i < n; i++) shootBullet(e.x, e.y, (i * Math.PI * 2) / n + e.t * 2, speed * 0.9, 60, "rice");
              for (let i = -2; i <= 2; i++) shootBullet(e.x, e.y, a + i * 0.15, speed, 300);
            }
          }
        }
      }
      g.enemies = g.enemies.filter((e) => {
        if (e.hp <= 0) {
          burst(e.x, e.y, e.boss ? 160 : 24, e.boss ? 320 : 50);
          g.score += e.boss ? 5000 : e.mid ? 2000 : 100;
          if (e.mid) g.items.push({ x: e.x, y: e.y, kind: g.stage, t: 0 });
          if (e.boss) {
            g.running = false;
            g.bullets.length = 0;
            bgm().stop();
            setPhase(g.stage < STAGES.length - 1 ? "stageclear" : "clear");
          }
          return false;
        }
        return e.y < H + 60;
      });

      // player shots
      for (const s of g.shots) {
        if (s.homing && g.enemies.length) {
          let tgt = g.enemies[0]!;
          let bd = Infinity;
          for (const e of g.enemies) {
            const d = Math.hypot(e.x - s.x, e.y - s.y);
            if (d < bd) {
              bd = d;
              tgt = e;
            }
          }
          const a = Math.atan2(tgt.y - s.y, tgt.x - s.x);
          s.vx += (Math.cos(a) * 11 - s.vx) * 0.15;
          s.vy += (Math.sin(a) * 11 - s.vy) * 0.15;
        }
        s.x += s.vx * dt * 60;
        s.y += s.vy * dt * 60;
        for (const e of g.enemies) {
          if (Math.hypot(s.x - e.x, s.y - e.y) < e.r + 4) {
            e.hp -= s.power;
            burst(s.x, s.y, 2, 50);
            s.y = -999;
            break;
          }
        }
      }
      g.shots = g.shots.filter((s) => s.y > -20 && s.y < H + 20 && s.x > -20 && s.x < W + 20);

      // laser (Karen Q)
      if (g.char === 2 && g.power > 0) {
        for (const e of g.enemies)
          if (Math.abs(e.x - g.px) < e.r + 12 && e.y < g.py) e.hp -= 95 * dt;
        g.bullets = g.bullets.filter((b) => !(Math.abs(b.x - g.px) < 12 && b.y < g.py - 10));
      }
      // reflect barrier (Karen W)
      if (g.reflect > 0) {
        g.bullets = g.bullets.filter((b) => {
          if (Math.hypot(b.x - g.px, b.y - g.py) < 60) {
            const tgt = g.enemies[0];
            const a = tgt ? Math.atan2(tgt.y - b.y, tgt.x - b.x) : -Math.PI / 2;
            g.shots.push({ x: b.x, y: b.y, vx: Math.cos(a) * 10, vy: Math.sin(a) * 10, power: 4 });
            return false;
          }
          return true;
        });
      }

      // bullets
      const bs = g.slow > 0 ? 0.33 : 1;
      for (const b of g.bullets) {
        b.x += b.vx * dt * 60 * bs;
        b.y += b.vy * dt * 60 * bs;
        if (Math.hypot(b.x - g.px, b.y - g.py) < b.r + 4) {
          b.y = H + 999;
          hitPlayer();
          if (!g.running) break;
        }
      }
      g.bullets = g.bullets.filter((b) => b.x > -30 && b.x < W + 30 && b.y > -40 && b.y < H + 30);

      // pet items
      g.items = g.items.filter((it) => {
        it.t += dt;
        it.y += 1.2 * dt * 60;
        it.x += (g.px - it.x) * (Math.hypot(g.px - it.x, g.py - it.y) < 120 ? dt * 4 : 0);
        if (Math.hypot(it.x - g.px, it.y - g.py) < 24) {
          g.pets.push({ kind: it.kind, fire: 0, a: 0 });
          burst(it.x, it.y, 50, 140);
          return false;
        }
        return it.y < H + 30;
      });
      // pets orbit + auto fire
      g.petGuard = Math.max(0, g.petGuard - dt);
      g.pets.forEach((pt, i) => {
        pt.a = g.t * 2.4 + (i * Math.PI * 2) / g.pets.length;
        pt.fire -= dt;
        if (pt.fire <= 0) {
          pt.fire = 0.35;
          g.shots.push({ x: g.px + Math.cos(pt.a) * 40, y: g.py + Math.sin(pt.a) * 40, vx: 0, vy: -12, power: 1.5 });
        }
        if (g.petGuard > 0 && pt.kind === 0) {
          const ox = g.px + Math.cos(pt.a) * 40, oy = g.py + Math.sin(pt.a) * 40;
          g.bullets = g.bullets.filter((b) => Math.hypot(b.x - ox, b.y - oy) > 34);
        }
      });

      for (const p of g.parts) {
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.94;
        p.vy *= 0.94;
        p.life -= dt * 1.6;
      }
      g.parts = g.parts.filter((p) => p.life > 0);

      const boss = g.enemies.find((e) => e.boss);
      setHud({
        lives: g.lives,
        time: g.t,
        level: lv,
        score: g.score,
        q: g.skills.q.cd,
        w: g.skills.w.cd,
        e: g.skills.e.cd,
        gauge: g.gauge,
        bossHp: boss ? boss.hp : 0,
        bossMax: boss ? boss.maxHp : 0,
        shield: g.shield,
        dodge: g.dodge,
        stage: g.stage,
      });
    };

    const artImgs = ART_URLS.map((u) => {
      const im = new Image();
      im.src = u;
      return im;
    });
    const drawPet = (kind: number, x: number, y: number, a: number, sc = 1) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(sc, sc);
      if (kind === 0) {
        // azure dragon: serpentine body
        for (let i = 6; i >= 0; i--) {
          const sx = Math.sin(g.t * 6 - i * 0.8) * 4;
          ctx.fillStyle = i % 2 ? "#2fa38a" : "#3fd1b0";
          ctx.beginPath();
          ctx.arc(sx, i * 3.2, 5 - i * 0.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = "#4fe6c2";
        ctx.beginPath();
        ctx.ellipse(0, -3, 6, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ffe08a";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-3, -6); ctx.lineTo(-6, -12);
        ctx.moveTo(3, -6); ctx.lineTo(6, -12);
        ctx.stroke();
        ctx.fillStyle = "#ff3b3b";
        ctx.fillRect(-3, -4, 1.5, 1.5);
        ctx.fillRect(1.5, -4, 1.5, 1.5);
      } else if (kind === 1) {
        // phoenix: flapping wings + tail plumes
        const f = Math.sin(g.t * 12) * 0.5;
        ctx.fillStyle = "rgba(255,90,30,0.9)";
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.quadraticCurveTo(s * 12, -10 - f * 8, s * 16, -2 + f * 6);
          ctx.quadraticCurveTo(s * 8, 2, 0, 3);
          ctx.fill();
        }
        ctx.fillStyle = "#ffcf40";
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath();
          ctx.ellipse(i * 3, 10, 1.6, 6, i * 0.3, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = "#ffe9a0";
        ctx.beginPath();
        ctx.ellipse(0, 0, 3.5, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ff5a1e";
        ctx.beginPath();
        ctx.moveTo(0, -9); ctx.lineTo(2, -4); ctx.lineTo(-2, -4);
        ctx.fill();
      } else {
        // white tiger: head with stripes
        ctx.fillStyle = "#f4f4f8";
        ctx.beginPath();
        ctx.arc(-6, -7, 3, 0, Math.PI * 2);
        ctx.arc(6, -7, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(0, 0, 9, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#1c1c2a";
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(0, -8); ctx.lineTo(0, -4);
        ctx.moveTo(-8, -1); ctx.lineTo(-4, 0);
        ctx.moveTo(8, -1); ctx.lineTo(4, 0);
        ctx.moveTo(-7, 3); ctx.lineTo(-4, 3);
        ctx.moveTo(7, 3); ctx.lineTo(4, 3);
        ctx.stroke();
        ctx.fillStyle = "#4fb4ff";
        ctx.fillRect(-4, -2, 2, 2);
        ctx.fillRect(2, -2, 2, 2);
        ctx.fillStyle = "#ff8fa8";
        ctx.fillRect(-1, 2, 2, 1.5);
      }
      void a;
      ctx.restore();
    };
    const drawGirl = (x: number, y: number, scale: number, ult: number, pal: Pal = PLAYER_PAL) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(scale, scale);
      const flap = Math.sin(g.t * 8) * 2;
      // ult aura
      if (ult > 0) {
        const r = (1.6 - ult) * 90 + 20;
        ctx.globalAlpha = Math.min(1, ult);
        const grd = ctx.createRadialGradient(0, 0, 4, 0, 0, r);
        grd.addColorStop(0, "rgba(255,240,180,0.9)");
        grd.addColorStop(1, "rgba(255,120,200,0)");
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      // skirt / dress
      ctx.fillStyle = pal.dress;
      ctx.beginPath();
      ctx.moveTo(-4, -2);
      ctx.lineTo(4, -2);
      ctx.lineTo(13, 18 + flap);
      ctx.lineTo(-13, 18 + flap);
      ctx.closePath();
      ctx.fill();
      if (pal.acc === "sword") {
        ctx.save();
        ctx.rotate(-0.5);
        ctx.fillStyle = "#f2c6d4";
        ctx.fillRect(-1.2, -6, 2.4, 34);
        ctx.fillStyle = "#3a1a22";
        ctx.fillRect(-1.6, -14, 3.2, 8);
        ctx.restore();
      }
      // sleeves
      ctx.fillStyle = pal.sleeve ?? "#fff3f7";
      ctx.beginPath();
      ctx.ellipse(-9, 0, 5, 7, -0.3, 0, Math.PI * 2);
      ctx.ellipse(9, 0, 5, 7, 0.3, 0, Math.PI * 2);
      ctx.fill();
      // body
      ctx.fillStyle = "#fff8fb";
      ctx.beginPath();
      ctx.ellipse(0, -3, 7, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      // long twin-tail hair back
      ctx.fillStyle = pal.hair;
      ctx.beginPath();
      ctx.ellipse(-12, -6 + flap * 0.6, 5, 16, 0.2, 0, Math.PI * 2);
      ctx.ellipse(12, -6 - flap * 0.6, 5, 16, -0.2, 0, Math.PI * 2);
      ctx.fill();
      // head
      ctx.fillStyle = "#ffe6d8";
      ctx.beginPath();
      ctx.arc(0, -16, 9, 0, Math.PI * 2);
      ctx.fill();
      // hair front
      ctx.fillStyle = pal.hair;
      ctx.beginPath();
      ctx.arc(0, -18, 9.6, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-9.6, -18);
      ctx.lineTo(-9.6, -13);
      ctx.lineTo(-4, -16);
      ctx.closePath();
      ctx.moveTo(9.6, -18);
      ctx.lineTo(9.6, -13);
      ctx.lineTo(4, -16);
      ctx.closePath();
      ctx.fill();
      // ribbon
      ctx.fillStyle = pal.ribbon;
      ctx.beginPath();
      ctx.ellipse(-8, -23, 4, 2.6, -0.4, 0, Math.PI * 2);
      ctx.ellipse(8, -23, 4, 2.6, 0.4, 0, Math.PI * 2);
      ctx.fill();
      if (pal.acc === "fox") {
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.ellipse(6, -26, 5, 3.5, 0.5, 0, Math.PI * 2);
        ctx.moveTo(3, -29); ctx.lineTo(4, -34); ctx.lineTo(7, -29);
        ctx.moveTo(7, -28); ctx.lineTo(11, -32); ctx.lineTo(10, -26);
        ctx.fill();
        ctx.fillStyle = "#d8263a";
        ctx.fillRect(4, -26.5, 4, 1);
        // floating fox fire
        ctx.fillStyle = "rgba(255,110,40,0.85)";
        ctx.beginPath();
        ctx.ellipse(-15, -14 + Math.sin(g.t * 6) * 2, 2.4, 4, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (pal.acc === "flower") {
        ctx.fillStyle = "#eaf8ff";
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          ctx.beginPath();
          ctx.arc(7 + Math.cos(a) * 2.2, -22 + Math.sin(a) * 2.2, 1.6, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = "#5aa8e0";
        ctx.beginPath();
        ctx.arc(7, -22, 1, 0, Math.PI * 2);
        ctx.fill();
        // butterflies
        ctx.fillStyle = "rgba(60,110,200,0.8)";
        for (let i = 0; i < 2; i++) {
          const bx = Math.cos(g.t * 2 + i * 3) * 18, by = -10 + Math.sin(g.t * 3 + i) * 8;
          const f = Math.abs(Math.sin(g.t * 12 + i)) * 2 + 0.5;
          ctx.beginPath();
          ctx.ellipse(bx - f, by, f, 2, 0, 0, Math.PI * 2);
          ctx.ellipse(bx + f, by, f, 2, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      // eyes
      ctx.fillStyle = "#2b2140";
      ctx.beginPath();
      ctx.ellipse(-3.3, -15, 1.5, 2.2, 0, 0, Math.PI * 2);
      ctx.ellipse(3.3, -15, 1.5, 2.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(-3.8, -15.8, 0.6, 0, Math.PI * 2);
      ctx.arc(2.8, -15.8, 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    const drawBoss = (e: Enemy) => {
      const st = stg(g.stage);
      ctx.save();
      ctx.translate(e.x, e.y);
      const puls = 1 + Math.sin(g.t * 4) * 0.04;
      ctx.scale(puls, puls);
      ctx.fillStyle = st.boss.wing;
      if (g.stage === 1) {
        // ice crystal wings
        for (const s of [-1, 1])
          for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(s * (30 + i * 12), -30 + i * 18);
            ctx.lineTo(s * (50 + i * 10), -10 + i * 16);
            ctx.closePath();
            ctx.fill();
          }
      } else if (g.stage === 2) {
        // bat wings
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(0, -6);
          ctx.lineTo(s * 30, -28);
          ctx.lineTo(s * 64, -18);
          ctx.lineTo(s * 52, 0);
          ctx.lineTo(s * 40, -6);
          ctx.lineTo(s * 30, 8);
          ctx.lineTo(s * 18, 0);
          ctx.lineTo(0, 14);
          ctx.closePath();
          ctx.fill();
        }
      } else {
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(0, -4);
          ctx.quadraticCurveTo(s * 46, -30, s * 58, 6);
          ctx.quadraticCurveTo(s * 30, 2, 0, 16);
          ctx.closePath();
          ctx.fill();
        }
      }
      ctx.restore();
      drawGirl(e.x, e.y + 6, 1.9, 0, st.boss.pal);
      ctx.fillStyle = st.boss.hat;
      if (g.stage === 0) {
        ctx.beginPath();
        ctx.ellipse(e.x, e.y - 26, 26, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(e.x - 14, e.y - 27);
        ctx.lineTo(e.x + 14, e.y - 27);
        ctx.lineTo(e.x + 2, e.y - 48);
        ctx.closePath();
        ctx.fill();
      } else if (g.stage === 1) {
        // tiara
        ctx.fillStyle = "#bff0ff";
        ctx.beginPath();
        ctx.moveTo(e.x - 14, e.y - 30);
        for (let i = 0; i <= 4; i++) {
          ctx.lineTo(e.x - 14 + i * 7, e.y - (i % 2 === 0 ? 44 : 34));
        }
        ctx.lineTo(e.x + 14, e.y - 30);
        ctx.closePath();
        ctx.fill();
      } else {
        // mob cap
        ctx.beginPath();
        ctx.ellipse(e.x, e.y - 34, 22, 12, 0, Math.PI, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#b0122a";
        ctx.fillRect(e.x - 20, e.y - 35, 40, 3);
      }
    };

    const draw = () => {
      const st = stg(g.stage);
      ctx.save();
      if (g.shake > 0)
        ctx.translate((Math.random() - 0.5) * g.shake, (Math.random() - 0.5) * g.shake);
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, st.bg[0]!);
      bg.addColorStop(0.6, st.bg[1]!);
      bg.addColorStop(1, st.bg[2]!);
      ctx.fillStyle = bg;
      ctx.fillRect(-20, -20, W + 40, H + 40);
      if (st.fx === "stars") {
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        for (let i = 0; i < 60; i++) {
          const sx = (i * 97) % W;
          const sy = ((i * 173 + g.t * (40 + (i % 5) * 20)) % (H + 20)) - 10;
          ctx.fillRect(sx, sy, 2, 2 + (i % 3));
        }
      } else if (st.fx === "snow") {
        ctx.fillStyle = "rgba(230,248,255,0.55)";
        for (let i = 0; i < 70; i++) {
          const sy = ((i * 131 + g.t * (25 + (i % 4) * 12)) % (H + 20)) - 10;
          const sx = ((i * 89) % W) + Math.sin(g.t + i) * 12;
          ctx.beginPath();
          ctx.arc(sx, sy, 1 + (i % 3), 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        for (let i = 0; i < 55; i++) {
          const sy = H - (((i * 151 + g.t * (50 + (i % 5) * 18)) % (H + 20)) - 10);
          const sx = ((i * 71) % W) + Math.sin(g.t * 2 + i) * 8;
          ctx.fillStyle = `hsl(${20 + (i % 4) * 8} 100% 60% / 0.6)`;
          ctx.fillRect(sx, sy, 2, 2);
        }
      }

      if (g.ult > 0) {
        ctx.fillStyle = `rgba(255,255,255,${g.ult * 0.28})`;
        ctx.fillRect(-20, -20, W + 40, H + 40);
      }

      // particles
      for (const p of g.parts) {
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = `hsl(${p.hue} 90% 70%)`;
        ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
      }
      ctx.globalAlpha = 1;

      // player shots
      const qlv = g.power > 0 ? g.up.q : 0;
      for (const s of g.shots) {
        const boosted = qlv > 0 && s.power >= 3;
        ctx.fillStyle = boosted
          ? qlv >= 2
            ? `hsl(${(g.t * 300 + s.x) % 360} 100% 70%)`
            : "#ffd23f"
          : s.power > 3
            ? "#ffe066"
            : CHARS[g.char]!.shot;
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(Math.atan2(s.vy, s.vx) + Math.PI / 2);
        if (boosted) {
          ctx.shadowColor = ctx.fillStyle as string;
          ctx.shadowBlur = 6 + qlv * 6;
        }
        const sc = boosted ? 1 + qlv * 0.35 : 1;
        ctx.beginPath();
        ctx.ellipse(0, 0, 2.6 * sc, 7 * sc, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // pet items
      for (const it of g.items) {
        ctx.save();
        ctx.translate(it.x, it.y);
        ctx.rotate(it.t * 2);
        ctx.shadowBlur = 18;
        ctx.shadowColor = PET_COL[it.kind] ?? "#fff";
        ctx.fillStyle = PET_COL[it.kind] ?? "#fff";
        ctx.beginPath();
        for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4; const rr = i % 2 ? 6 : 13; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 11px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(PET_NAMES[it.kind] ?? "", it.x, it.y - 18);
      }
      // pets
      g.pets.forEach((pt) => drawPet(pt.kind, g.px + Math.cos(pt.a) * 40, g.py + Math.sin(pt.a) * 40, pt.a));
      // enemies
      for (const e of g.enemies) {
        if (e.mid) {
          ctx.save();
          ctx.translate(e.x, e.y);
          const col = PET_COL[g.stage] ?? "#fff";
          ctx.shadowBlur = 20;
          ctx.shadowColor = col;
          ctx.rotate(e.t);
          ctx.strokeStyle = col;
          ctx.lineWidth = 3;
          ctx.beginPath();
          for (let i = 0; i < 6; i++) { const a = (i * Math.PI) / 3; ctx.lineTo(Math.cos(a) * e.r, Math.sin(a) * e.r); }
          ctx.closePath();
          ctx.stroke();
          ctx.rotate(-e.t * 2);
          ctx.fillStyle = col;
          ctx.globalAlpha = 0.5;
          ctx.fillRect(-12, -12, 24, 24);
          ctx.globalAlpha = 1;
          ctx.restore();
          drawPet(g.stage, e.x, e.y, e.t, 1.3);
          ctx.fillStyle = "rgba(0,0,0,0.5)";
          ctx.fillRect(e.x - 30, e.y - 40, 60, 5);
          ctx.fillStyle = col;
          ctx.fillRect(e.x - 30, e.y - 40, (60 * e.hp) / e.maxHp, 5);
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 11px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(`중간 보스 ${Math.max(0, e.life ?? 0).toFixed(1)}s`, e.x, e.y - 46);
          continue;
        }
        if (e.boss) drawBoss(e);
        else {
          const st = stg(g.stage);
          ctx.save();
          ctx.translate(e.x, e.y);
          if (st.shape === "star") {
            ctx.rotate(e.t);
            ctx.fillStyle = st.enemy;
            ctx.beginPath();
            for (let i = 0; i < 5; i++) {
              const a = (i * Math.PI * 2) / 5;
              ctx.lineTo(Math.cos(a) * e.r, Math.sin(a) * e.r);
            }
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = "#3d1a4d";
            ctx.beginPath();
            ctx.arc(0, 0, 6, 0, Math.PI * 2);
            ctx.fill();
          } else if (st.shape === "fairy") {
            const f = Math.sin(e.t * 14) * 0.4;
            ctx.fillStyle = "rgba(200,245,255,0.6)";
            for (const s of [-1, 1]) {
              ctx.beginPath();
              ctx.ellipse(s * 11, -4, 10, 5, s * (0.5 + f), 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.fillStyle = st.enemy;
            ctx.beginPath();
            ctx.moveTo(0, -2);
            ctx.lineTo(8, 12);
            ctx.lineTo(-8, 12);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = "#ffe6d8";
            ctx.beginPath();
            ctx.arc(0, -6, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#e6f9ff";
            ctx.beginPath();
            ctx.arc(0, -8, 6.5, Math.PI, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.rotate(-e.t * 2);
            ctx.fillStyle = st.enemy;
            ctx.beginPath();
            for (let i = 0; i < 16; i++) {
              const a = (i * Math.PI * 2) / 16;
              const rr = i % 2 === 0 ? e.r + 3 : e.r - 6;
              ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
            }
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = "#5a0a0a";
            ctx.beginPath();
            ctx.arc(0, 0, 5, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }
      }

      // bullets
      for (const b of g.bullets) {
        ctx.fillStyle = `hsl(${b.hue} 100% 85%)`;
        if (b.kind === "rice") {
          ctx.save();
          ctx.translate(b.x, b.y);
          ctx.rotate(Math.atan2(b.vy, b.vx));
          ctx.fillStyle = `hsl(${b.hue} 100% 65%)`;
          ctx.beginPath();
          ctx.ellipse(0, 0, 7, 3, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#fff";
          ctx.beginPath();
          ctx.ellipse(1, 0, 3, 1.4, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else {
          const grd = ctx.createRadialGradient(b.x, b.y, 1, b.x, b.y, b.r + 3);
          grd.addColorStop(0, "#ffffff");
          grd.addColorStop(0.5, `hsl(${b.hue} 100% 70%)`);
          grd.addColorStop(1, `hsl(${b.hue} 100% 50% / 0)`);
          ctx.fillStyle = grd;
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.r + 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      const pc = CHARS[g.char]!;
      // slow-time tint
      if (g.slow > 0) {
        const lv = g.up.w;
        const tint = lv >= 2 ? "200,170,255" : lv === 1 ? "120,255,240" : "150,220,255";
        ctx.fillStyle = `rgba(${tint},${Math.min(0.18 + lv * 0.05, g.slow * 0.1)})`;
        ctx.fillRect(-20, -20, W + 40, H + 40);
        if (lv >= 1) {
          // frozen clock rings
          ctx.strokeStyle = `rgba(${tint},0.35)`;
          ctx.lineWidth = 2;
          for (let i = 0; i < lv + 1; i++) {
            ctx.beginPath();
            ctx.arc(W / 2, H / 2, ((g.t * 80 + i * 140) % 420) + 20, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      }
      // laser
      if (g.char === 2 && g.power > 0) {
        const lv = g.up.q;
        const wv = 10 + lv * 5 + Math.sin(g.t * 40) * 3;
        const edge = lv >= 2 ? `hsla(${(g.t * 240) % 360},100%,60%,0)` : lv === 1 ? "rgba(255,210,40,0)" : "rgba(255,120,40,0)";
        const core = lv >= 2 ? `hsla(${(g.t * 240) % 360},100%,85%,0.95)` : lv === 1 ? "rgba(255,255,220,0.98)" : "rgba(255,245,200,0.95)";
        const lg = ctx.createLinearGradient(g.px - wv, 0, g.px + wv, 0);
        lg.addColorStop(0, edge);
        lg.addColorStop(0.5, core);
        lg.addColorStop(1, edge);
        ctx.fillStyle = lg;
        ctx.fillRect(g.px - wv * 1.6, 0, wv * 3.2, g.py - 18);
        if (lv >= 1) {
          ctx.fillStyle = "rgba(255,255,255,0.9)";
          ctx.fillRect(g.px - 2, 0, 4, g.py - 18);
        }
      }
      // ult range ring
      if (g.ult > 0 && g.ultR < 2000) {
        const k = 1 - g.ult / 1.6;
        const rr = g.ultR * Math.min(1, k * 3);
        ctx.fillStyle = `hsl(${g.char === 1 ? 195 : 15} 100% 70% / ${g.ult * 0.18})`;
        ctx.beginPath();
        ctx.arc(g.px, g.py, rr, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `hsl(${g.char === 1 ? 195 : 15} 100% 80% / ${g.ult * 0.6})`;
        ctx.lineWidth = 4;
        ctx.stroke();
      }
      // player
      if (!(g.inv > 0 && g.ult === 0 && Math.floor(g.t * 14) % 2 === 0)) {
        drawGirl(g.px, g.py, g.ult > 0 ? 1 + (1.6 - g.ult) * 0.5 : 1, g.ult, pc.pal);
        if (g.char === 1) {
          ctx.fillStyle = "#1c4d7a";
          ctx.beginPath();
          ctx.moveTo(g.px - 12, g.py - 24);
          ctx.lineTo(g.px + 12, g.py - 24);
          ctx.lineTo(g.px + 3, g.py - 42);
          ctx.closePath();
          ctx.fill();
        } else if (g.char === 2) {
          ctx.strokeStyle = "#ffe0b0";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(g.px + 12, g.py + 6);
          ctx.lineTo(g.px + 20, g.py - 22);
          ctx.stroke();
        }
      }
      // upgraded skills: Lv1 = gold accents, Lv2 = rainbow + extra rings
      const upHue = (lv: number, base: number) => (lv >= 2 ? (g.t * 240) % 360 : lv === 1 ? 45 : base);
      const ring = (r: number, hue: number, a: number, lw: number, rot = 0, dash = false) => {
        ctx.strokeStyle = `hsl(${hue} 100% 70% / ${a})`;
        ctx.lineWidth = lw;
        if (dash) ctx.setLineDash([6, 6]);
        ctx.beginPath();
        if (dash) ctx.arc(g.px, g.py, r, rot, rot + Math.PI * 1.5);
        else ctx.arc(g.px, g.py, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      };
      const glowOn = (lv: number, hue: number) => {
        ctx.shadowColor = `hsl(${hue} 100% 65%)`;
        ctx.shadowBlur = lv * 12;
      };
      if (g.reflect > 0) {
        const lv = g.up.w;
        const h = upHue(lv, 30);
        glowOn(lv, h);
        ring(60, h, 0.5 + Math.sin(g.t * 16) * 0.25, 3 + lv * 2);
        if (lv >= 1) ring(68, h, 0.35, 2, g.t * 5, true);
        if (lv >= 2) ring(76, (h + 120) % 360, 0.35, 2, -g.t * 7, true);
        ctx.shadowBlur = 0;
      }
      if (g.shield > 0) {
        const lv = g.up.w;
        const h = upHue(lv, 200);
        glowOn(lv, h);
        ring(26, h, 0.4 + Math.sin(g.t * 10) * 0.2, 3 + lv * 1.5);
        if (lv >= 1) {
          // hexagram seal
          ctx.strokeStyle = `hsl(${h} 100% 75% / 0.5)`;
          ctx.lineWidth = 1.5;
          for (const off of lv >= 2 ? [0, Math.PI / 3] : [0]) {
            ctx.beginPath();
            for (let i = 0; i <= 3; i++) {
              const a = g.t * 2 + off + (i * Math.PI * 2) / 3;
              const x = g.px + Math.cos(a) * 34;
              const y = g.py + Math.sin(a) * 34;
              if (i === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }
            ctx.stroke();
          }
        }
        ctx.shadowBlur = 0;
      }
      if (g.dodge > 0) {
        const lv = g.up.e;
        const h = upHue(lv, 300);
        glowOn(lv, h);
        ring(34, h, 0.7, 2 + lv, g.t * 6, true);
        if (lv >= 1) ring(42, h, 0.5, 2, -g.t * 8, true);
        if (lv >= 2) ring(50, (h + 180) % 360, 0.45, 2, g.t * 10, true);
        ctx.shadowBlur = 0;
      }
      // after-image trail for upgraded E dash/blink
      if (g.up.e > 0 && g.char !== 0 && g.inv > 0 && g.ult === 0) {
        const h = upHue(g.up.e, g.char === 1 ? 195 : 20);
        ctx.fillStyle = `hsl(${h} 100% 70% / 0.25)`;
        ctx.beginPath();
        ctx.arc(g.px, g.py, 18 + g.up.e * 6 + Math.sin(g.t * 20) * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      // hitbox
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(g.px, g.py, 2.2, 0, Math.PI * 2);
      ctx.fill();

      // tutorial (stage 1, first 5s)
      if (g.running && g.stage === 0 && g.t < TUTORIAL) {
        ctx.globalAlpha = Math.min(1, (TUTORIAL - g.t) * 2);
        ctx.fillStyle = "rgba(10,5,22,0.78)";
        ctx.beginPath();
        ctx.roundRect(36, 150, W - 72, 310, 16);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,200,230,0.5)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.textAlign = "center";
        ctx.fillStyle = "#ffd6ea";
        ctx.font = "bold 20px sans-serif";
        ctx.fillText("조작 가이드", W / 2, 188);
        const cc = CHARS[g.char]!;
        const lines: [string, string][] = [
          ["방향키 / 화면 드래그", "이동"],
          ["Shift", "정밀 이동 (사격은 자동)"],
          ["Q", cc.desc[0]!.slice(2)],
          ["W", cc.desc[1]!.slice(2)],
          ["E", cc.desc[2]!.slice(2)],
          ["R", `게이지 100% — ${cc.ult.label}`],
        ];
        ctx.font = "14px sans-serif";
        lines.forEach(([k, v], i) => {
          const y = 226 + i * 32;
          ctx.textAlign = "right";
          ctx.fillStyle = "#ffe066";
          ctx.fillText(k, W / 2 - 10, y);
          ctx.textAlign = "left";
          ctx.fillStyle = "#ffffff";
          ctx.fillText(v, W / 2 + 10, y);
        });
        ctx.textAlign = "center";
        ctx.fillStyle = "#ff8ac4";
        ctx.font = "bold 14px sans-serif";
        ctx.fillText(`적 출현까지 ${Math.ceil(TUTORIAL - g.t)}초`, W / 2, 440);
        ctx.globalAlpha = 1;
      }
      // boss ultimate warning
      if (g.bossUlt > 0) {
        const a = Math.min(1, g.bossUlt);
        ctx.fillStyle = `rgba(160,0,30,${0.12 + Math.sin(g.t * 12) * 0.06})`;
        ctx.fillRect(-20, -20, W + 40, H + 40);
        if (g.bossUlt > BOSS_ULT - 1.6) {
          ctx.globalAlpha = a;
          ctx.textAlign = "center";
          ctx.fillStyle = "#ff3355";
          ctx.font = "bold 13px sans-serif";
          ctx.fillText("⚠ BOSS ULTIMATE ⚠", W / 2, 200);
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 22px serif";
          ctx.fillText(`「${BOSS_ULT_NAMES[g.stage]}」`, W / 2, 230);
          ctx.globalAlpha = 1;
        }
      }
      // ult cut-in
      if (g.ult > 0.5) {
        const p = 1.6 - g.ult; // 0 -> 1.1
        const slide = p < 0.2 ? 1 - p / 0.2 : p > 0.85 ? (p - 0.85) / 0.25 : 0;
        const alpha = Math.max(0, 1 - Math.max(0, p - 0.85) / 0.25);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = "rgba(10,5,25,0.75)";
        ctx.beginPath();
        ctx.moveTo(0, H / 2 - 120);
        ctx.lineTo(W, H / 2 - 160);
        ctx.lineTo(W, H / 2 + 80);
        ctx.lineTo(0, H / 2 + 120);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = pc.pal.dress;
        ctx.fillRect(0, H / 2 - 124, W, 3);
        ctx.fillRect(0, H / 2 + 118, W, 3);
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(0, H / 2 - 120);
        ctx.lineTo(W, H / 2 - 160);
        ctx.lineTo(W, H / 2 + 80);
        ctx.lineTo(0, H / 2 + 120);
        ctx.closePath();
        ctx.clip();
        const art = artImgs[g.char];
        if (art && art.complete && art.naturalWidth > 0) {
          const ah = 480;
          const aw = (art.naturalWidth / art.naturalHeight) * ah;
          ctx.globalAlpha = alpha * 0.25;
          ctx.drawImage(art, 150 - aw / 2 - slide * 300 + 30, H / 2 - 260 + p * 30, aw * 1.15, ah * 1.15);
          ctx.globalAlpha = alpha;
          ctx.drawImage(art, 150 - aw / 2 - slide * 300, H / 2 - 220 - p * 20, aw, ah);
        } else {
          drawGirl(150 - slide * 300, H / 2 + 40, 6.5, 0, pc.pal);
        }
        ctx.restore();
        ctx.textAlign = "right";
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 30px serif";
        ctx.fillText(`「${pc.ult.name}」`, W - 24 + slide * 300, H / 2 - 10);
        ctx.font = "bold 14px sans-serif";
        ctx.fillStyle = pc.pal.hair;
        ctx.fillText(`${pc.name} — SPELL CARD`, W - 24 + slide * 300, H / 2 + 18);
        ctx.globalAlpha = 1;
      }
      // stage banner
      const bannerStart = g.stage === 0 ? TUTORIAL : 0;
      if (g.running && g.t >= bannerStart && g.t < bannerStart + 2.2) {
        ctx.globalAlpha = Math.min(1, (bannerStart + 2.2 - g.t) * 2);
        ctx.textAlign = "center";
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 22px sans-serif";
        ctx.fillText(st.name, W / 2, H / 2 - 40);
        ctx.globalAlpha = 1;
      }

      ctx.restore();
    };

    const resetStage = () => {
      const c = CHARS[g.char]!;
      g.t = 0;
      g.px = W / 2;
      g.py = H - 90;
      g.inv = 1;
      g.shield = 0;
      g.dodge = 0;
      g.slow = 0;
      g.reflect = 0;
      g.ult = 0;
      g.power = 0;
      g.bossUlt = 0;
      g.bossUltUsed = false;
      g.midSpawned = false;
      g.items.length = 0;
      g.petGuard = 0;
      g.bullets.length = 0;
      g.shots.length = 0;
      g.enemies.length = 0;
      g.parts.length = 0;
      g.spawn = 0.6;
      g.bossSpawned = false;
      g.skills.q = { cd: 0, max: c.skills.q[1] * (1 - 0.15 * g.up.q) };
      g.skills.w = { cd: 0, max: c.skills.w[1] * (1 - 0.15 * g.up.w) };
      g.skills.e = { cd: 0, max: c.skills.e[1] * (1 - 0.15 * g.up.e) };
      taps.clear();
      g.running = true;
      bgm().play(`stage${g.stage}`);
      setPhase("play");
    };

    startRef.current = (c: number) => {
      g.char = c;
      g.stage = 0;
      g.lives = 3;
      g.score = 0;
      g.gauge = 0;
      g.up = { q: 0, w: 0, e: 0 };
      g.pets = [];
      setUps({ q: 0, w: 0, e: 0 });
      setUpPick(null);
      resetStage();
    };
    nextRef.current = (u: Ups) => {
      g.up = { ...u };
      g.stage = Math.min(STAGES.length - 1, g.stage + 1);
      resetStage();
    };
    reviveRef.current = () => {
      g.lives = 3;
      g.inv = 3;
      g.bullets = g.bullets.filter((b) => Math.hypot(b.x - g.px, b.y - g.py) > 160);
      burst(g.px, g.py, 80, 50);
      keys.clear();
      taps.clear();
      g.running = true;
      if (g.bossSpawned) bgm().play("boss", g.stage * 2);
      else bgm().play(`stage${g.stage}`);
      setPhase("play");
    };

    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      canvas.removeEventListener("pointerdown", onPD);
      canvas.removeEventListener("pointermove", onPM);
      canvas.removeEventListener("pointerup", onPU);
      canvas.removeEventListener("pointercancel", onPU);
    };
  }, []);

  const ch = CHARS[charIdx]!;

  const touchBtn = (k: string, label: string, cd: number, ready = true) => (
    <button
      key={k}
      onPointerDown={(ev) => {
        ev.preventDefault();
        tapRef.current?.(k);
      }}
      className="relative h-14 touch-none select-none overflow-hidden rounded-xl border border-border bg-card text-foreground active:scale-95"
    >
      <div className="text-base font-black">{k.toUpperCase()}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
      {(cd > 0 || !ready) && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/70 text-xs font-bold">
          {cd > 0 ? cd.toFixed(1) : `충전 ${Math.floor(hud.gauge * 100)}%`}
        </div>
      )}
    </button>
  );

  const skillBox = (key: string, name: string, cd: number, max: number) => (
    <div className="relative overflow-hidden rounded-lg border border-border/60 bg-card/60 px-3 py-2 text-center">
      <div className="text-sm font-bold text-foreground">{key.toUpperCase()}</div>
      <div className="text-[10px] text-muted-foreground">{name}</div>
      {cd > 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/75 text-sm font-bold text-foreground">
          {cd.toFixed(1)}
        </div>
      )}
      <div
        className="absolute bottom-0 left-0 h-[3px] bg-primary transition-[width] duration-100"
        style={{ width: `${(1 - cd / max) * 100}%` }}
      />
    </div>
  );

  const submitCoin = () => {
    if (coin.trim().toLowerCase() === "lovable") {
      setCoin("");
      setCoinErr(false);
      reviveRef.current?.();
    } else {
      setCoinErr(true);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center gap-4 bg-background px-4 py-6">
      <header className="text-center">
        <h1 className="text-2xl font-black tracking-tight text-foreground">탄막 소녀 — 총알 피하기</h1>
        <p className="text-xs text-muted-foreground">
          방향키 · 화면 드래그로 이동 · 사격은 자동 · 3개 스테이지, 각 45초에 보스 등장
        </p>
        <button
          onClick={() => {
            const m = !muted;
            setMuted(m);
            bgmRef.current?.setMuted(m);
          }}
          className="mt-1 rounded-full border border-border px-3 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
        >
          {muted ? "♪ 음악 켜기" : "♪ 음악 끄기"}
        </button>
      </header>

      <div className="flex w-full max-w-[860px] flex-col items-center gap-4 md:flex-row md:items-start md:justify-center">
        <div className="flex flex-col gap-3" style={{ width: W, maxWidth: "100%" }}>
        <div className="relative">
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            className="w-full touch-none select-none rounded-xl border border-border shadow-lg"
          />
          {hud.bossMax > 0 && (
            <div className="pointer-events-none absolute left-3 right-3 top-3">
              <div className="mb-1 text-[10px] font-bold tracking-widest text-foreground">
                {stg(hud.stage).boss.name}
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-background/60">
                <div
                  className="h-full bg-destructive transition-[width] duration-100"
                  style={{ width: `${(hud.bossHp / hud.bossMax) * 100}%` }}
                />
              </div>
            </div>
          )}

          {phase === "select" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 overflow-y-auto rounded-xl bg-background/85 px-4 py-4 text-center backdrop-blur-sm">
              <h2 className="text-xl font-black text-foreground">캐릭터 선택</h2>
              <div className="flex w-full flex-col gap-2">
                {CHARS.map((c, i) => (
                  <button
                    key={c.name}
                    onClick={() => setCharIdx(i)}
                    className={`rounded-xl border p-3 text-left transition-colors ${
                      i === charIdx ? "border-primary bg-primary/15" : "border-border bg-card/70"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <img src={ART_URLS[i]} alt={c.name} className="h-10 w-10 rounded-full border border-border object-cover object-top" />
                      <span className="font-black text-foreground">{c.name}</span>
                      <span className="text-[11px] text-muted-foreground">{c.title}</span>
                    </div>
                    <ul className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
                      {c.desc.map((d) => (
                        <li key={d}>{d}</li>
                      ))}
                      <li className="font-bold text-foreground">
                        R {c.ult.name} — {c.ult.label}
                      </li>
                    </ul>
                  </button>
                ))}
              </div>
              <button
                onClick={() => startRef.current?.(charIdx)}
                className="rounded-full bg-primary px-6 py-2 text-sm font-bold text-primary-foreground transition-transform hover:scale-105"
              >
                {ch.name}(으)로 출격
              </button>
            </div>
          )}

          {phase === "continue" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-xl bg-background/85 px-6 text-center backdrop-blur-sm">
              <h2 className="text-2xl font-black text-foreground">INSERT COIN</h2>
              <p className="text-sm text-foreground">coin을 더 넣으시겠습니까?</p>
              <p className="text-xs text-muted-foreground">코인 코드를 입력하면 지금 이 자리에서 목숨 3개로 부활합니다.</p>
              <form
                onSubmit={(ev) => {
                  ev.preventDefault();
                  submitCoin();
                }}
                className="flex gap-2"
              >
                <input
                  autoFocus
                  value={coin}
                  onChange={(ev) => {
                    setCoin(ev.target.value);
                    setCoinErr(false);
                  }}
                  placeholder="코인 코드"
                  className="w-40 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                />
                <button className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
                  투입
                </button>
              </form>
              {coinErr && <p className="text-xs font-bold text-destructive">코인이 맞지 않습니다.</p>}
              <p className="text-sm font-bold text-foreground">SCORE {hud.score}</p>
              <button
                onClick={() => setPhase("select")}
                className="text-xs text-muted-foreground underline"
              >
                포기하고 처음부터
              </button>
            </div>
          )}

          {phase !== "play" && phase !== "select" && phase !== "continue" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-xl bg-background/80 px-6 text-center backdrop-blur-sm">
              <h2 className="text-xl font-black text-foreground">
                {phase === "title"
                  ? "탄막 소녀 — 3개의 이변"
                  : phase === "stageclear"
                    ? `STAGE ${hud.stage + 1} CLEAR!`
                    : phase === "clear"
                      ? "ALL CLEAR! 이변 해결"
                      : "GAME OVER"}
              </h2>
              <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
                {phase === "stageclear"
                  ? `다음: ${STAGES[hud.stage + 1]?.name ?? ""}`
                  : "목숨 3개로 3개 스테이지를 돌파하세요. 5초마다 탄막이 거세지고 45초에 보스가 나타납니다."}
                <br />
                키보드: 방향키 + Q/W/E/R · 태블릿: 화면 드래그 + 하단 버튼
              </p>
              {phase !== "title" && (
                <p className="text-sm font-bold text-foreground">SCORE {hud.score}</p>
              )}
              {phase === "stageclear" && (
                <div className="w-full max-w-xs">
                  <p className="mb-2 text-xs font-bold text-foreground">
                    스킬 강화 1회 — 하나를 고르세요
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {(["q", "w", "e"] as const).map((k) => (
                      <button
                        key={k}
                        disabled={ups[k] >= 2}
                        onClick={() => setUpPick(k)}
                        className={`rounded-lg border p-2 text-[11px] transition-colors disabled:opacity-40 ${
                          upPick === k ? "border-primary bg-primary/20" : "border-border bg-card"
                        }`}
                      >
                        <div className="font-black text-foreground">
                          {k.toUpperCase()} Lv{ups[k] + 1}
                          {upPick === k ? `→${ups[k] + 2}` : ""}
                        </div>
                        <div className="text-muted-foreground">{ch.skills[k][0]}</div>
                        <div className="mt-1 text-[10px] text-muted-foreground">{UP_DESC[k]}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <button
                disabled={phase === "stageclear" && !upPick}
                onClick={() => {
                  if (phase === "stageclear") {
                    if (!upPick) return;
                    const n = { ...ups, [upPick]: ups[upPick] + 1 };
                    setUps(n);
                    setUpPick(null);
                    nextRef.current?.(n);
                  } else setPhase("select");
                }}
                className="rounded-full bg-primary px-6 py-2 text-sm font-bold text-primary-foreground transition-transform hover:scale-105 disabled:opacity-40"
              >
                {phase === "title" ? "게임 시작" : phase === "stageclear" ? "강화하고 다음 스테이지" : "다시 도전"}
              </button>
            </div>
          )}
        </div>
        <div className="grid grid-cols-4 gap-2">
          {touchBtn("q", ch.skills.q[0], hud.q)}
          {touchBtn("w", ch.skills.w[0], hud.w)}
          {touchBtn("e", ch.skills.e[0], hud.e)}
          {touchBtn("r", "궁극기", 0, hud.gauge >= 1)}
        </div>
        </div>

        <aside className="w-full max-w-[280px] space-y-3">
          <div className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">캐릭터</span>
              <span className="font-bold text-foreground">{ch.name}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">목숨</span>
              <span className="text-foreground">
                {"♥".repeat(Math.max(0, hud.lives))}
                <span className="text-muted-foreground">
                  {"♡".repeat(Math.max(0, 3 - hud.lives))}
                </span>
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">스테이지</span>
              <span className="font-bold text-foreground">{hud.stage + 1} / 3</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">난이도</span>
              <span className="font-bold text-foreground">LV {hud.level} / 9</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">시간</span>
              <span className="font-bold text-foreground">{hud.time.toFixed(1)}s</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">점수</span>
              <span className="font-bold text-foreground">{hud.score}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {skillBox("q", ch.skills.q[0], hud.q, ch.skills.q[1])}
            {skillBox("w", ch.skills.w[0], hud.w, ch.skills.w[1])}
            {skillBox("e", ch.skills.e[0], hud.e, ch.skills.e[1])}
          </div>

          <div className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-foreground">R · {ch.ult.name}</span>
              <span className="text-muted-foreground">{Math.floor(hud.gauge * 100)}%</span>
            </div>
            <div className="mt-1 text-[10px] text-muted-foreground">{ch.ult.label}</div>
            <div className="mt-2 h-3 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-destructive transition-[width] duration-100"
                style={{ width: `${hud.gauge * 100}%` }}
              />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-3 text-xs leading-relaxed text-muted-foreground">
            작은 흰 점이 판정 범위입니다. 궁극기는 범위가 좁을수록 보스에게 큰 피해를 줍니다 — 범위 안에 보스를 넣으세요.
          </div>
        </aside>
      </div>
    </main>
  );
}
