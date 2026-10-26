import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Bgm } from "@/lib/bgm";
import {
  beanSprite,
  candySprite,
  cube,
  drawBossArt,
  drawEnemy,
  drawHero,
  drawPetArt,
  drawStageBg,
  drawStageFx,
  drawSunBuddy,
  glossyHeart,
  glossyStar,
  HERO_COL,
  INK,
  label,
  setLowDetail,
  spike,
  starPath,
} from "@/lib/art";
import haruPose from "@/assets/char/haru-pose.jpg";
import yukiPose from "@/assets/char/yuki-pose.jpg";
import karenPose from "@/assets/char/karen-pose.jpg";
import haruFace from "@/assets/char/haru-face.jpg";
import yukiFace from "@/assets/char/yuki-face.jpg";
import karenFace from "@/assets/char/karen-face.jpg";
const ART_URLS = [haruPose, yukiPose, karenPose];
const FACE_URLS = [haruFace, yukiFace, karenFace];
const TAU = Math.PI * 2;

type Quality = "low" | "mid" | "high";
const hslCache: Record<number, string> = {};

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
const BOSS_ULT_NAMES = ["월광 「크레센트 레퀴엠」", "빙결 「다이아몬드 블리자드」", "홍월 「스칼렛 디스티니」"];
// boss phases: skill unlocks at 50% hp, phase 2 (+ blast-zone ultimate) at 30% hp
const BOSS_SKILL_HP = 0.5;
const BOSS_P2_HP = 0.3;
const BOSS_CAST = 0.9; // telegraph before a boss skill fires
const BOSS_SKILL_NAMES = ["월광 「초승달 낫」", "빙결 「서리 감옥」", "홍월 「스칼렛 랜스」"];
const BOSS_ULT_CD = 11;
const ZONE_FILL = 2.2; // seconds for a blast zone's gauge to fill before it explodes
const ZONE_BOOM = 0.35;
// circle zone when r > 0, otherwise a w×h rect; x/y is the center
type Zone = { x: number; y: number; r: number; w: number; h: number; delay: number; t: number; boom: number };
type Ups = { q: number; w: number; e: number };
const UP_DESC = { q: "쿨 -15% · 지속 +35%", w: "쿨 -15% · 지속 +35%", e: "쿨 -15% · 효과 +35%" };

const STAGES = [
  { name: "스테이지 1 — 달빛 꽃밭", boss: { name: "달그림자 부엉이 · 루나", hp: 1600 } },
  { name: "스테이지 2 — 얼음 사탕 호수", boss: { name: "서리 여우 여왕 · 시엘", hp: 2300 } },
  { name: "스테이지 3 — 딸기 홍차 저택", boss: { name: "홍차 박쥐 공주 · 스칼렛", hp: 3200 } },
];
const stg = (i: number) => STAGES[Math.max(0, Math.min(STAGES.length - 1, i))]!;

type Char = {
  name: string;
  title: string;
  speed: number;
  skills: { q: [string, number]; w: [string, number]; e: [string, number] };
  ult: { name: string; radius: number; dmg: number; label: string };
  desc: string[];
};
const CHARS: Char[] = [
  {
    name: "하루",
    title: "햇살 정령 · 밸런스형",
    speed: 1,
    skills: { q: ["햇살 분신", 6], w: ["새싹 방패", 9], e: ["두근 스텝", 11] },
    ult: { name: "선라이즈 피날레", radius: 9999, dmg: 160, label: "맵 전체 소거 · 피해 약" },
    desc: ["Q 4초간 햇살 분신 소환 + 강화 사격", "W 1회 피격 무효 새싹 방패", "E 1초간 두근두근 스텝으로 자동 회피"],
  },
  {
    name: "유키",
    title: "별자리 현자 · 제어형",
    speed: 0.95,
    skills: { q: ["성좌 큐브탄", 7], w: ["천구 정지", 12], e: ["성문 도약", 8] },
    ult: { name: "아스트랄 결계", radius: W / 2, dmg: 420, label: "맵 절반 반경 소거 · 피해 중" },
    desc: ["Q 4초간 적을 쫓는 성좌 큐브탄", "W 3초간 모든 탄 속도 1/3", "E 이동 방향으로 성문 도약 + 무적"],
  },
  {
    name: "카렌",
    title: "물감 아티스트 · 근접형",
    speed: 1.1,
    skills: { q: ["물감 붓질", 8], w: ["팔레트 반사", 10], e: ["스플래시 대시", 6] },
    ult: { name: "캔버스 스플래시", radius: W / 3, dmg: 900, label: "맵 1/3 반경 소거 · 피해 강" },
    desc: ["Q 3초간 탄을 지우는 관통 물감 붓질", "W 2.5초간 주변 탄을 적에게 반사", "E 짧은 돌진 + 경로의 탄 소거"],
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
type Shot = { x: number; y: number; vx: number; vy: number; power: number; homing?: boolean; doll?: boolean };
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
  carrier?: boolean;
  life?: number;
};
type Pet = { kind: number; fire: number; a: number };
const LIFE_KILLS = 30;
type Item = { x: number; y: number; kind: number; t: number };
const MID_TIME = 25;
const PET_COL = ["#3fd1b0", "#ff7a2e", "#b9a3e6"];
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
  const [quality, setQuality] = useState<Quality>("high");
  const qRef = useRef<Quality>("high");
  useEffect(() => {
    const v = localStorage.getItem("fxQuality");
    if (v === "low" || v === "mid" || v === "high") { setQuality(v); qRef.current = v; }
  }, []);
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
    bossPhase: 0,
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
    // shadowBlur is the most expensive canvas op: only honor it on "high"
    const sbDesc = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, "shadowBlur")!;
    Object.defineProperty(ctx, "shadowBlur", {
      configurable: true,
      get: () => sbDesc.get!.call(ctx),
      set: (v: number) => sbDesc.set!.call(ctx, qRef.current === "high" ? Math.min(v, 14) : 0),
    });
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
      bossPhase: 0, // 0 normal · 1 skill unlocked (≤50%) · 2 phase 2 (≤30%)
      bossSkill: 0,
      bossCast: 0,
      bossUltCd: 0,
      zones: [] as Zone[],
      banner: { text: "", sub: "", t: 0 },
      trail: { x0: 0, y0: 0, x1: 0, y1: 0, t: 0 }, // E blink/dash path, for effects
      midSpawned: false,
      pets: [] as Pet[],
      items: [] as Item[],
      kills: 0,
      petGuard: 0,
      shotLv: 0,
      shotSide: 0,
      carrierAt: 20,
      carrierSpawned: false,
    };
    const bgm = () => (bgmRef.current ??= new Bgm());

    const HANGUL: Record<string, string> = { "ㅂ": "q", "ㅃ": "q", "ㅈ": "w", "ㅉ": "w", "ㄷ": "e", "ㄸ": "e", "ㄱ": "r", "ㄲ": "r" };
    const keyOf = (e: KeyboardEvent) => {
      const c = e.code;
      if (c === "KeyQ" || c === "KeyW" || c === "KeyE" || c === "KeyR") return c.slice(3).toLowerCase();
      const k = e.key.toLowerCase();
      return HANGUL[k] ?? k;
    };
    const onDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.tagName === "INPUT") return;
      const k = keyOf(e);
      if (
        ["arrowup", "arrowdown", "arrowleft", "arrowright", " ", "q", "w", "e", "r", "shift"].includes(k)
      )
        e.preventDefault();
      keys.add(k);
      if (g.running && ["q", "w", "e", "r"].includes(k)) taps.add(k);
    };
    const onUp = (e: KeyboardEvent) => keys.delete(keyOf(e));
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
      const q = qRef.current;
      const cap = q === "high" ? 220 : q === "mid" ? 110 : 40;
      n = Math.ceil(n * (q === "high" ? 0.8 : q === "mid" ? 0.45 : 0.18));
      for (let i = 0; i < n; i++) {
        if (g.parts.length >= cap) break;
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
      const hp = Math.round(stg(g.stage).boss.hp / 4);
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
        g.shotLv = 0;
        g.running = false;
        keys.clear();
        bgm().stop();
        setPhase("continue");
      }
    };

    // signature boss skill, available once the boss is at or below 50% hp
    const bossSkill = (e: Enemy) => {
      const aim = Math.atan2(g.py - e.y, g.px - e.x);
      g.shake = Math.max(g.shake, 8);
      if (g.stage === 0) {
        // layered crescent fans aimed at the player
        for (let w = 0; w < 3; w++)
          for (let i = -5; i <= 5; i++) shootBullet(e.x, e.y, aim + i * 0.11, 2.4 + w * 0.6, 50 + w * 20);
      } else if (g.stage === 1) {
        // ring around the player closing inward, with two gaps to slip through
        const n = 24;
        const gap = Math.floor(Math.random() * n);
        for (let i = 0; i < n; i++) {
          if (i % 12 === gap % 12) continue;
          const a = (i * Math.PI * 2) / n;
          const x = g.px + Math.cos(a) * 160;
          const y = g.py + Math.sin(a) * 160;
          if (x < 0 || x > W || y < 0 || y > H) continue;
          shootBullet(x, y, a + Math.PI, 1.5, 200, "rice");
        }
      } else {
        // five lances of accelerating rice bullets
        for (let l = -2; l <= 2; l++)
          for (let i = 0; i < 8; i++) shootBullet(e.x, e.y, aim + l * 0.17, 3 + i * 0.5, 0, "rice");
      }
    };

    // blast-zone ultimate (phase 2): zones fill up, then explode
    const spawnZones = () => {
      const zone = (x: number, y: number, r: number, w: number, h: number, delay: number) =>
        g.zones.push({ x: Math.max(20, Math.min(W - 20, x)), y: Math.max(40, Math.min(H - 20, y)), r, w, h, delay, t: 0, boom: -1 });
      if (g.stage === 0) {
        // moonfall: first on the player, the rest scattered and staggered
        zone(g.px, g.py, 64, 0, 0, 0);
        for (let i = 1; i < 6; i++) zone(40 + Math.random() * (W - 80), 220 + Math.random() * (H - 280), 64, 0, 0, i * 0.3);
      } else if (g.stage === 1) {
        // frost grid: horizontal bands, then vertical bands
        for (const y of [270, 430, 590]) zone(W / 2, y, 0, W, 80, 0);
        for (const x of [W * 0.25, W * 0.75]) zone(x, H / 2 + 60, 0, 90, H, 1.2);
      } else {
        // crimson fate: blast on the player, then a ring around where they stood
        const cx = g.px;
        const cy = g.py;
        zone(cx, cy, 95, 0, 0, 0);
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI * 2) / 8;
          zone(cx + Math.cos(a) * 175, cy + Math.sin(a) * 175, 55, 0, 0, 0.9);
        }
      }
    };
    const inZone = (z: Zone, x: number, y: number) =>
      z.r > 0 ? Math.hypot(x - z.x, y - z.y) < z.r : Math.abs(x - z.x) < z.w / 2 && Math.abs(y - z.y) < z.h / 2;

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
      g.banner.t = Math.max(0, g.banner.t - dt);
      g.trail.t = Math.max(0, g.trail.t - dt);
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
          burst(g.px, g.py, 24, g.char === 1 ? 210 : 290);
          g.trail = { x0: ox, y0: oy, x1: g.px, y1: g.py, t: 0.6 };
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
          // Haru Q: tracking amulets on top of the normal stream
          g.shotCd = 0.1;
          for (const a of [-0.05, 0.05])
            g.shots.push({ x: g.px, y: g.py - 16, vx: Math.sin(a) * 9, vy: -13, power: 2 });
          if (g.power > 0 && !g.shots.some((s) => s.doll))
            g.shots.push({ x: g.px, y: g.py - 24, vx: 0, vy: -6, power: 0, doll: true });
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
        // basic shot upgrades (P items)
        const sl = g.shotLv;
        const sp = 1 + sl * 0.15;
        if (sl >= 1) for (const a of [-0.16, 0.16]) g.shots.push({ x: g.px, y: g.py - 14, vx: Math.sin(a) * 10, vy: -13, power: 1.6 * sp });
        if (sl >= 2) for (const a of [-0.32, 0.32]) g.shots.push({ x: g.px, y: g.py - 12, vx: Math.sin(a) * 10, vy: -12, power: 1.6 * sp });
        if (sl >= 3) {
          g.shots.push({ x: g.px, y: g.py - 20, vx: 0, vy: -16, power: 3 });
          g.shotSide = (g.shotSide + 1) % 3;
          if (g.shotSide === 0) for (const s of [-1, 1]) g.shots.push({ x: g.px + s * 18, y: g.py, vx: s * 3, vy: -9, power: 2.5, homing: true });
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
        if (!g.carrierSpawned && g.t >= g.carrierAt) {
          g.carrierSpawned = true;
          g.enemies.push({ x: 60 + Math.random() * (W - 120), y: -30, vx: 0, vy: 1.3, hp: 30 + g.stage * 20, maxHp: 30 + g.stage * 20, r: 16, t: 0, fire: 0, boss: false, carrier: true });
        }
        if (g.t >= MID_TIME && !g.midSpawned) {
          g.midSpawned = true;
          spawnMid();
        }
        if (g.t >= BOSS_TIME) {
          g.enemies = g.enemies.filter((e) => !e.mid && !e.carrier);
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
        } else if (e.carrier) {
          e.y += e.vy * dt * 60;
          e.x += Math.sin(e.t * 2.5) * 1.6 * dt * 60;
        } else if (e.boss) {
          if (e.y < 130) e.y += 40 * dt;
          else {
            e.x += e.vx * dt * 60 * (g.bossPhase === 2 ? 1.4 : 1);
            if (e.x < 70 || e.x > W - 70) e.vx *= -1;
          }
          if (e.y >= 120) {
            e.fire -= dt;
            const hpRatio = e.hp / e.maxHp;
            const aim = Math.atan2(g.py - e.y, g.px - e.x);
            if (g.bossPhase < 1 && hpRatio <= BOSS_SKILL_HP) {
              g.bossPhase = 1;
              g.bossSkill = 1.2;
              g.banner = { text: "BOSS SKILL", sub: BOSS_SKILL_NAMES[g.stage]!, t: 2 };
              g.shake = 10;
              burst(e.x, e.y, 60, 50);
            }
            if (g.bossPhase < 2 && hpRatio <= BOSS_P2_HP) {
              g.bossPhase = 2;
              g.bossSkill = Math.max(g.bossSkill, 3);
              g.bossCast = 0;
              g.bossUltCd = 2.2;
              g.bullets.length = 0;
              g.shake = 22;
              burst(e.x, e.y, 140, 0);
              e.fire = 1.4; // awakening pause
              g.banner = { text: "PHASE 2", sub: "보스가 각성했다!", t: 2.2 };
            }
            const p2 = g.bossPhase === 2;
            if (p2) {
              g.bossUltCd -= dt;
              if (g.bossUltCd <= 0 && g.zones.length === 0) {
                g.bossUltCd = BOSS_ULT_CD;
                spawnZones();
                g.banner = { text: "⚠ BOSS ULTIMATE ⚠", sub: BOSS_ULT_NAMES[g.stage]!, t: 1.8 };
                g.shake = 14;
              }
            }
            if (g.bossPhase >= 1) {
              if (g.bossCast > 0) {
                g.bossCast -= dt;
                if (g.bossCast <= 0) bossSkill(e);
              } else {
                g.bossSkill -= dt;
                if (g.bossSkill <= 0) {
                  g.bossSkill = p2 ? 4.5 : 6;
                  g.bossCast = BOSS_CAST;
                }
              }
            }
            const fired = e.fire <= 0;
            const nb = g.bullets.length;
            if (fired && g.stage === 0) {
              e.fire = hpRatio > 0.5 ? 0.14 : 0.1;
              const n = hpRatio > 0.5 ? 9 : 13;
              const base = e.t * (hpRatio > 0.5 ? 1.7 : -2.3);
              for (let i = 0; i < n; i++)
                shootBullet(e.x, e.y, base + (i * Math.PI * 2) / n, 2.6, hpRatio > 0.5 ? 320 : 20, "rice");
              if (Math.random() < 0.35) {
                for (let i = -2; i <= 2; i++) shootBullet(e.x, e.y, aim + i * 0.12, 4.2, 190);
              }
            } else if (fired && g.stage === 1) {
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
            } else if (fired) {
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
            if (fired && p2) {
              // phase 2: denser, faster fire plus a counter spiral (eased while blast zones charge)
              const charging = g.zones.length > 0;
              e.fire *= charging ? 1 : 0.7;
              if (!charging && Math.random() < 0.5)
                for (let k = 0; k < 3; k++)
                  shootBullet(e.x, e.y, -e.t * 2.8 + (k * Math.PI * 2) / 3, 2.4, [300, 190, 30][g.stage] ?? 0, "rice");
              for (let i = nb; i < g.bullets.length; i++) {
                g.bullets[i]!.vx *= 1.2;
                g.bullets[i]!.vy *= 1.2;
              }
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
          if (e.carrier) g.items.push({ x: e.x, y: e.y, kind: -2, t: 0 });
          else if (!e.boss && !e.mid) {
            g.kills += 1;
            if (g.kills % LIFE_KILLS === 0) g.items.push({ x: e.x, y: e.y, kind: -1, t: 0 });
          }
          if (e.boss) {
            g.running = false;
            g.bullets.length = 0;
            g.zones.length = 0;
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
          let tgt = (s as { tgt?: (typeof g.enemies)[number] }).tgt;
          if (!tgt || tgt.hp <= 0 || tgt.y > H || Math.random() < 0.1) {
            let bd = Infinity;
            tgt = g.enemies[0]!;
            for (const e of g.enemies) {
              const dx = e.x - s.x, dy = e.y - s.y, d = dx * dx + dy * dy;
              if (d < bd) { bd = d; tgt = e; }
            }
            (s as { tgt?: typeof tgt }).tgt = tgt;
          }
          const a = Math.atan2(tgt.y - s.y, tgt.x - s.x);
          s.vx += (Math.cos(a) * 11 - s.vx) * 0.15;
          s.vy += (Math.sin(a) * 11 - s.vy) * 0.15;
        }
        s.x += s.vx * dt * 60;
        s.y += s.vy * dt * 60;
        for (const e of g.enemies) {
          const hr = e.r + (s.doll ? 18 : 4), ddx = s.x - e.x, ddy = s.y - e.y;
          if (ddx * ddx + ddy * ddy < hr * hr) {
            if (s.doll) {
              const R = 60 * (1 + g.up.q * 0.35);
              const dmg = 45 * (1 + g.up.q * 0.35);
              for (const o of g.enemies) if (Math.hypot(o.x - s.x, o.y - s.y) < R + o.r) o.hp -= dmg;
              g.bullets = g.bullets.filter((b) => Math.hypot(b.x - s.x, b.y - s.y) > R);
              burst(s.x, s.y, 30, 350);
              g.shake = Math.max(g.shake, 5);
              s.y = -999;
              break;
            }
            e.hp -= s.power;
            if (g.parts.length < 60 && Math.random() < 0.4) burst(s.x, s.y, 1, 50);
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

      // boss blast zones: gauge fills, then explodes on whoever is inside
      for (const z of g.zones) {
        if (!g.running) break;
        if (z.delay > 0) {
          z.delay -= dt;
          continue;
        }
        if (z.boom >= 0) {
          z.boom += dt;
          continue;
        }
        z.t += dt * (g.slow > 0 ? 0.5 : 1);
        if (z.t >= ZONE_FILL) {
          z.boom = 0;
          g.shake = Math.max(g.shake, 12);
          burst(z.x, z.y, 24, [300, 190, 10][g.stage] ?? 0);
          if (inZone(z, g.px, g.py)) hitPlayer();
        }
      }
      g.zones = g.zones.filter((z) => z.boom < ZONE_BOOM);

      // pet items
      g.items = g.items.filter((it) => {
        it.t += dt;
        it.y += 1.2 * dt * 60;
        it.x += (g.px - it.x) * (Math.hypot(g.px - it.x, g.py - it.y) < 120 ? dt * 4 : 0);
        if (Math.hypot(it.x - g.px, it.y - g.py) < 24) {
          if (it.kind === -2) {
            g.shotLv = Math.min(3, g.shotLv + 1);
            if (g.shotLv === 3) { g.shake = 8; burst(g.px, g.py, 90, 0); }
          } else if (it.kind < 0) g.lives += 1;
          else g.pets.push({ kind: it.kind, fire: 0, a: 0 });
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
        bossPhase: g.bossPhase,
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
    const PAINT = ["#ef8fb6", "#a77be0", "#5ec4c4", "#f6b48a", "#e0b04a"];
    const shotTint = new WeakMap<Shot, number>();
    let shotN = 0;
    // fixed constellation for Yuki's time-stop overlay
    const SKY_PTS = Array.from({ length: 9 }, (_, i) => [60 + ((i * 151) % 360), 120 + ((i * 263) % 440)] as const);

    const drawBoss = (e: Enemy) => {
      drawBossArt(ctx, g.stage, e.x, e.y, g.t);
      // skill cast telegraph: shrinking ring + skill name
      if (g.bossCast > 0) {
        const p = 1 - g.bossCast / BOSS_CAST;
        ctx.strokeStyle = `rgba(242,180,60,${0.5 + p * 0.5})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(e.x, e.y, 80 - p * 45, 0, TAU);
        ctx.stroke();
        ctx.textAlign = "center";
        label(ctx, BOSS_SKILL_NAMES[g.stage] ?? "", e.x, e.y + 70, "bold 13px sans-serif", "#b8620e");
      }
    };

    const draw = () => {
      const QL = qRef.current;
      setLowDetail(QL === "low");
      const bgN = QL === "high" ? 1 : QL === "mid" ? 0.6 : 0.25;
      const ox = g.shake > 0 ? (Math.random() - 0.5) * g.shake : 0;
      const oy = g.shake > 0 ? (Math.random() - 0.5) * g.shake : 0;
      ctx.save();
      ctx.translate(ox, oy);
      drawStageBg(ctx, g.stage, g.t, W, H, bgN);
      drawStageFx(ctx, g.stage, g.t, W, H, Math.round(40 * bgN));

      if (g.ult > 0) {
        ctx.fillStyle = `rgba(255,252,240,${g.ult * 0.3})`;
        ctx.fillRect(-20, -20, W + 40, H + 40);
      }

      // particles
      for (const p of g.parts) {
        ctx.globalAlpha = Math.max(0, p.life);
        const ph = Math.round(p.hue / 15) * 15;
        ctx.fillStyle = hslCache[ph] ??= `hsl(${ph} 85% 62%)`;
        if (QL === "low") ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
        else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 1.4 + p.life * 1.6, 0, TAU);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      // player shots, styled per hero: sun drops / star crystals / paint drops
      const qlv = g.power > 0 ? g.up.q : 0;
      const rainbow = `hsl(${Math.round(((g.t * 420) % 360) / 20) * 20} 95% 62%)`;
      const hc = HERO_COL[g.char] ?? HERO_COL[0];
      for (const s of g.shots) {
        if (s.doll) {
          drawSunBuddy(ctx, s.x, s.y, g.t, g.up.q);
          continue;
        }
        const boosted = qlv > 0 && s.power >= 3;
        const sl = g.shotLv;
        let col: string = hc.shot;
        if (g.char === 2) {
          let n = shotTint.get(s);
          if (n === undefined) shotTint.set(s, (n = shotN++ % PAINT.length));
          col = PAINT[n]!;
        }
        if (boosted) col = qlv >= 2 ? rainbow : "#f2b43c";
        else if (sl >= 3) col = rainbow;
        const sc = (boosted ? 1 + qlv * 0.35 : 1) * (1 + sl * 0.12);
        if (g.char === 1 && s.homing && QL !== "low") {
          cube(ctx, s.x, s.y, 3.6 * sc, g.t * 6 + s.x * 0.05, boosted ? col : "#9fd3f5", 0.9);
          continue;
        }
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(Math.atan2(s.vy, s.vx) + Math.PI / 2);
        ctx.scale(sc, sc);
        if (sl >= 2 && QL !== "low") {
          ctx.globalAlpha = 0.25;
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.ellipse(0, 2, 6, 11, 0, 0, TAU);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        ctx.fillStyle = col;
        ctx.strokeStyle = "rgba(74,58,92,0.5)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (g.char === 1) {
          // star crystal (rhombus)
          ctx.moveTo(0, -8);
          ctx.lineTo(3, 0);
          ctx.lineTo(0, 5);
          ctx.lineTo(-3, 0);
        } else {
          // teardrop: sun drop / paint drop
          ctx.moveTo(0, -8);
          ctx.quadraticCurveTo(4, 0, 0, 4.5);
          ctx.quadraticCurveTo(-4, 0, 0, -8);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.beginPath();
        ctx.ellipse(-0.8, -1.5, 0.9, 2.4, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      }

      // items
      for (const it of g.items) {
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        if (it.kind === -2) {
          cube(ctx, it.x, it.y, 8, it.t * 2.5, "#7fe0b8");
          label(ctx, "P", it.x, it.y, "bold 12px sans-serif");
          label(ctx, "POWER UP", it.x, it.y - 22, "bold 11px sans-serif");
        } else if (it.kind < 0) {
          const k = 1 + Math.sin(it.t * 6) * 0.12;
          glossyHeart(ctx, it.x, it.y, 9 * k, "#f2577f");
          label(ctx, "1UP", it.x, it.y - 20, "bold 11px sans-serif");
        } else {
          glossyStar(ctx, it.x, it.y, 13, PET_COL[it.kind] ?? "#ffe08a", it.t * 2);
          label(ctx, PET_NAMES[it.kind] ?? "", it.x, it.y - 22, "bold 11px sans-serif");
        }
        ctx.textBaseline = "alphabetic";
      }
      // pets
      g.pets.forEach((pt) => drawPetArt(ctx, pt.kind, g.px + Math.cos(pt.a) * 40, g.py + Math.sin(pt.a) * 40, g.t));
      // boss blast zones: outline + gauge growing from the center, flash on explosion
      for (const z of g.zones) {
        if (z.delay > 0) continue;
        const shape = (k: number) => {
          ctx.beginPath();
          if (z.r > 0) ctx.arc(z.x, z.y, z.r * k, 0, TAU);
          else ctx.rect(z.x - (z.w * k) / 2, z.y - (z.h * k) / 2, z.w * k, z.h * k);
        };
        if (z.boom >= 0) {
          ctx.globalAlpha = Math.max(0, 1 - z.boom / ZONE_BOOM);
          ctx.fillStyle = "#fff1d6";
          shape(1 + z.boom * 0.4);
          ctx.fill();
          ctx.globalAlpha = 1;
          continue;
        }
        const p = Math.min(1, z.t / ZONE_FILL);
        const blink = p > 0.75 ? 0.5 + 0.5 * Math.sin(g.t * 40) : 1;
        ctx.fillStyle = `rgba(255,40,70,${0.1 + 0.06 * blink})`;
        shape(1);
        ctx.fill();
        ctx.strokeStyle = `rgba(230,50,80,${0.55 + 0.45 * blink})`;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = `rgba(240,50,60,${0.22 + p * 0.33})`;
        shape(p);
        ctx.fill();
      }
      // enemies
      for (const e of g.enemies) {
        ctx.textAlign = "center";
        if (e.carrier) {
          // gift cube carrying a power-up
          cube(ctx, e.x, e.y, 11, e.t * 2, "#7fe0b8");
          ctx.fillStyle = "#f2577f";
          ctx.fillRect(e.x - 2, e.y - 13, 4, 26);
          ctx.textBaseline = "middle";
          label(ctx, "P", e.x, e.y, "bold 12px sans-serif");
          ctx.textBaseline = "alphabetic";
          continue;
        }
        if (e.mid) {
          const col = PET_COL[g.stage] ?? "#fff";
          drawPetArt(ctx, g.stage, e.x, e.y, e.t, 2.4);
          ctx.fillStyle = "rgba(74,58,92,0.35)";
          ctx.fillRect(e.x - 30, e.y - 42, 60, 5);
          ctx.fillStyle = col;
          ctx.fillRect(e.x - 30, e.y - 42, (60 * e.hp) / e.maxHp, 5);
          label(ctx, `중간 보스 ${Math.max(0, e.life ?? 0).toFixed(1)}s`, e.x, e.y - 48, "bold 11px sans-serif");
          continue;
        }
        if (e.boss) drawBoss(e);
        else drawEnemy(ctx, g.stage, e.x, e.y, e.r, e.t);
      }

      // bullets (cached candy sprites; rice bullets rotated via setTransform)
      for (const b of g.bullets) {
        if (b.kind === "rice") {
          const a = Math.atan2(b.vy, b.vx);
          const c = Math.cos(a);
          const sn = Math.sin(a);
          ctx.setTransform(c, sn, -sn, c, b.x + ox, b.y + oy);
          ctx.drawImage(beanSprite(b.hue), -10, -5.5);
        } else {
          const spr = candySprite(b.hue, b.r);
          ctx.drawImage(spr, b.x - spr.width / 2, b.y - spr.height / 2);
        }
      }
      ctx.setTransform(1, 0, 0, 1, ox, oy);

      const pc = CHARS[g.char]!;
      const upHue = (lv: number, base: number) => (lv >= 2 ? (g.t * 240) % 360 : lv === 1 ? 45 : base);
      // Yuki W: celestial time-stop — navy veil, astrolabe rings, constellation
      if (g.slow > 0) {
        const lv = g.up.w;
        const a = Math.min(1, g.slow * 2);
        ctx.fillStyle = `rgba(40,60,130,${Math.min(0.16 + lv * 0.04, g.slow * 0.1)})`;
        ctx.fillRect(-20, -20, W + 40, H + 40);
        ctx.globalAlpha = a * 0.7;
        ctx.strokeStyle = `hsl(${upHue(lv, 42)} 75% 60%)`;
        for (let i = 0; i < 2 + lv; i++) {
          const r = 130 + i * 40;
          ctx.lineWidth = 2 - i * 0.4;
          ctx.beginPath();
          ctx.arc(W / 2, H / 2, r, 0, TAU);
          ctx.stroke();
          for (let k = 0; k < 24; k++) {
            const ang = (k * TAU) / 24 + g.t * (i % 2 ? -0.4 : 0.3);
            ctx.beginPath();
            ctx.moveTo(W / 2 + Math.cos(ang) * (r - 5), H / 2 + Math.sin(ang) * (r - 5));
            ctx.lineTo(W / 2 + Math.cos(ang) * (r + 5), H / 2 + Math.sin(ang) * (r + 5));
            ctx.stroke();
          }
        }
        ctx.strokeStyle = "rgba(255,240,190,0.8)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        SKY_PTS.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
        ctx.fillStyle = "#fff2b8";
        for (const [x, y] of SKY_PTS) {
          starPath(ctx, x, y, 4, 0.4);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      // Karen Q: paint-stroke laser with wobbling edges and drips
      if (g.char === 2 && g.power > 0) {
        const lv = g.up.q;
        const wv = 11 + lv * 5;
        const top = g.py - 18;
        const edge = (side: number, y: number) => g.px + side * (wv + Math.sin(y * 0.06 + g.t * 14 + side) * 3);
        ctx.beginPath();
        ctx.moveTo(edge(-1, 0), 0);
        for (let y = 0; y <= top; y += 20) ctx.lineTo(edge(-1, y), y);
        ctx.lineTo(edge(-1, top), top);
        ctx.lineTo(edge(1, top), top);
        for (let y = top; y >= 0; y -= 20) ctx.lineTo(edge(1, y), y);
        ctx.closePath();
        const lg = ctx.createLinearGradient(g.px - wv, 0, g.px + wv, 0);
        const stripes = lv >= 2 ? PAINT : lv === 1 ? ["#f2b43c", "#ffe08a", "#f2b43c"] : PAINT.slice(0, 3);
        stripes.forEach((c, i) => lg.addColorStop(i / (stripes.length - 1), c));
        ctx.fillStyle = lg;
        ctx.globalAlpha = 0.85;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = "rgba(74,58,92,0.35)";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.fillRect(g.px - 2, 0, 3, top);
        for (let i = 0; i < 6; i++) {
          const y = (i * 97 + g.t * 260) % Math.max(1, top);
          ctx.fillStyle = PAINT[i % PAINT.length]!;
          ctx.beginPath();
          ctx.arc(edge(i % 2 ? 1 : -1, y) + (i % 2 ? 4 : -4), y, 2.5, 0, TAU);
          ctx.fill();
        }
      }
      // E blink / dash trail
      if (g.trail.t > 0 && g.char !== 0) {
        const tr = g.trail;
        const a = tr.t / 0.6;
        ctx.globalAlpha = a;
        if (g.char === 1) {
          // star gates at both ends, linked by a dotted constellation line
          for (const [x, y] of [[tr.x0, tr.y0], [tr.x1, tr.y1]] as const) {
            ctx.strokeStyle = "#e2b04a";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.ellipse(x, y, 20, 8, 0, 0, TAU);
            ctx.stroke();
            ctx.strokeStyle = "#9fd3f5";
            ctx.beginPath();
            ctx.ellipse(x, y, 13, 5, 0, 0, TAU);
            ctx.stroke();
          }
          ctx.setLineDash([3, 6]);
          ctx.strokeStyle = "#e2b04a";
          ctx.beginPath();
          ctx.moveTo(tr.x0, tr.y0);
          ctx.lineTo(tr.x1, tr.y1);
          ctx.stroke();
          ctx.setLineDash([]);
          cube(ctx, tr.x0, tr.y0, 6, g.t * 3, "#9fd3f5", 0.6);
        } else {
          // paint smear along the dash path + splatter
          const w = 18 + g.up.e * 6;
          ctx.lineCap = "round";
          ctx.strokeStyle = PAINT[1]!;
          ctx.lineWidth = w;
          ctx.beginPath();
          ctx.moveTo(tr.x0, tr.y0);
          ctx.lineTo(tr.x1, tr.y1);
          ctx.stroke();
          ctx.strokeStyle = PAINT[0]!;
          ctx.lineWidth = w * 0.55;
          ctx.stroke();
          ctx.lineCap = "butt";
          for (let i = 0; i < 8; i++) {
            const k = i / 7;
            ctx.fillStyle = PAINT[i % PAINT.length]!;
            ctx.beginPath();
            ctx.arc(tr.x0 + (tr.x1 - tr.x0) * k + Math.sin(i * 7) * w, tr.y0 + (tr.y1 - tr.y0) * k + Math.cos(i * 5) * w, 2 + (i % 3), 0, TAU);
            ctx.fill();
          }
        }
        ctx.globalAlpha = 1;
      }
      // R ultimate range: sunrise rays / astral seal / paint splash
      if (g.ult > 0) {
        const k = 1 - g.ult / 1.6;
        const a = Math.min(1, g.ult);
        if (g.char === 0) {
          ctx.globalAlpha = a * 0.45;
          ctx.fillStyle = "#ffd76a";
          for (let i = 0; i < 14; i++) {
            const ang = (i * TAU) / 14 + g.t * 0.6;
            ctx.beginPath();
            ctx.moveTo(g.px, g.py);
            ctx.lineTo(g.px + Math.cos(ang - 0.08) * 900, g.py + Math.sin(ang - 0.08) * 900);
            ctx.lineTo(g.px + Math.cos(ang + 0.08) * 900, g.py + Math.sin(ang + 0.08) * 900);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
        } else {
          const rr = g.ultR * Math.min(1, k * 3);
          ctx.globalAlpha = a;
          ctx.beginPath();
          if (g.char === 1) ctx.arc(g.px, g.py, rr, 0, TAU);
          else
            for (let i = 0; i <= 40; i++) {
              const ang = (i * TAU) / 40;
              const r2 = rr * (1 + Math.sin(i * 2.7) * 0.07);
              ctx.lineTo(g.px + Math.cos(ang) * r2, g.py + Math.sin(ang) * r2);
            }
          ctx.fillStyle = g.char === 1 ? "rgba(40,60,130,0.16)" : "rgba(239,143,182,0.2)";
          ctx.fill();
          ctx.strokeStyle = g.char === 1 ? "#e2b04a" : PAINT[1]!;
          ctx.lineWidth = 4;
          ctx.stroke();
          if (g.char === 1) {
            ctx.strokeStyle = "rgba(159,211,245,0.9)";
            ctx.lineWidth = 2;
            starPath(ctx, g.px, g.py, rr * 0.92, 0.42, 8, g.t);
            ctx.stroke();
          } else
            for (let i = 0; i < 10; i++) {
              const ang = (i * TAU) / 10 + 0.3;
              ctx.fillStyle = PAINT[i % PAINT.length]!;
              ctx.beginPath();
              ctx.arc(g.px + Math.cos(ang) * rr * 0.8, g.py + Math.sin(ang) * rr * 0.8, 6 + (i % 3) * 3, 0, TAU);
              ctx.fill();
            }
          ctx.globalAlpha = 1;
        }
      }
      // player
      if (!(g.inv > 0 && g.ult === 0 && Math.floor(g.t * 14) % 2 === 0))
        drawHero(ctx, g.char, g.px, g.py, g.ult > 0 ? 1 + (1.6 - g.ult) * 0.5 : 1, g.t, g.ult);
      // Karen W: palette reflect ring
      if (g.reflect > 0) {
        const lv = g.up.w;
        ctx.strokeStyle = `hsl(${upHue(lv, 300)} 70% 70% / 0.7)`;
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 6]);
        ctx.beginPath();
        ctx.arc(g.px, g.py, 60, g.t * 2, g.t * 2 + TAU);
        ctx.stroke();
        ctx.setLineDash([]);
        const n = 6 + lv * 2;
        for (let i = 0; i < n; i++) {
          const ang = g.t * 3 + (i * TAU) / n;
          ctx.fillStyle = PAINT[i % PAINT.length]!;
          ctx.strokeStyle = "rgba(74,58,92,0.45)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.ellipse(g.px + Math.cos(ang) * 60, g.py + Math.sin(ang) * 60, 6, 4.5, ang, 0, TAU);
          ctx.fill();
          ctx.stroke();
        }
      }
      // Haru W: sprout bubble shield with orbiting leaves
      if (g.shield > 0) {
        const lv = g.up.w;
        const r = 28 + lv * 3;
        if (QL !== "low") {
          const gr = ctx.createRadialGradient(g.px - r * 0.3, g.py - r * 0.4, 2, g.px, g.py, r);
          gr.addColorStop(0, "rgba(255,255,240,0.12)");
          gr.addColorStop(0.75, "rgba(170,220,120,0.16)");
          gr.addColorStop(1, "rgba(124,179,66,0.45)");
          ctx.fillStyle = gr;
        } else ctx.fillStyle = "rgba(170,220,120,0.25)";
        ctx.beginPath();
        ctx.arc(g.px, g.py, r, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = lv ? `hsl(${upHue(lv, 45)} 85% 50% / 0.85)` : "rgba(124,179,66,0.85)";
        ctx.lineWidth = 2;
        ctx.stroke();
        const n = 6 + lv * 2;
        for (let i = 0; i < n; i++) {
          const ang = g.t * 2 + (i * TAU) / n;
          spike(ctx, g.px + Math.cos(ang) * r, g.py + Math.sin(ang) * r, ang + Math.PI / 2, 9, 5, i % 2 ? "#8bc34a" : "#7cb342", 0.3);
        }
      }
      // Haru E: heartbeat ring + golden steps underfoot
      if (g.dodge > 0) {
        const lv = g.up.e;
        const R = 34 + lv * 4;
        ctx.strokeStyle = `hsl(${upHue(lv, 8)} 80% 58% / 0.9)`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i <= 90; i++) {
          const ang = (i / 90) * TAU;
          const ph = (((ang * 3 - g.t * 8) % TAU) + TAU) % TAU;
          const rr = R + (ph < 0.6 ? Math.sin((ph / 0.6) * TAU) * 7 : 0);
          ctx.lineTo(g.px + Math.cos(ang) * rr, g.py + Math.sin(ang) * rr);
        }
        ctx.stroke();
        for (let k = 0; k < 3; k++) {
          const x = g.px - 14 + k * 9;
          const y = g.py + 24 + k * 3 + Math.sin(g.t * 10 + k) * 1.5;
          ctx.fillStyle = `rgba(242,180,60,${0.85 - k * 0.2})`;
          ctx.beginPath();
          ctx.moveTo(x - 6, y);
          ctx.lineTo(x + 6, y);
          ctx.lineTo(x + 9, y - 4);
          ctx.lineTo(x - 3, y - 4);
          ctx.closePath();
          ctx.fill();
        }
      }
      // hitbox
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(g.px, g.py, 2.6, 0, TAU);
      ctx.fill();
      ctx.stroke();

      // tutorial (stage 1, first 5s)
      if (g.running && g.stage === 0 && g.t < TUTORIAL) {
        ctx.globalAlpha = Math.min(1, (TUTORIAL - g.t) * 2);
        ctx.fillStyle = "rgba(255,250,242,0.94)";
        ctx.beginPath();
        ctx.roundRect(36, 150, W - 72, 310, 16);
        ctx.fill();
        ctx.strokeStyle = "rgba(167,123,224,0.5)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.textAlign = "center";
        ctx.fillStyle = INK;
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
          ctx.fillStyle = "#c0602a";
          ctx.fillText(k, W / 2 - 10, y);
          ctx.textAlign = "left";
          ctx.fillStyle = INK;
          ctx.fillText(v, W / 2 + 10, y);
        });
        ctx.textAlign = "center";
        ctx.fillStyle = "#a77be0";
        ctx.font = "bold 14px sans-serif";
        ctx.fillText(`적 출현까지 ${Math.ceil(TUTORIAL - g.t)}초`, W / 2, 440);
        ctx.globalAlpha = 1;
      }
      // phase 2 tint + boss announcements
      if (g.bossPhase === 2 && g.bossSpawned) {
        ctx.fillStyle = `rgba(200,30,70,${0.07 + Math.sin(g.t * 4) * 0.03})`;
        ctx.fillRect(-20, -20, W + 40, H + 40);
      }
      if (g.banner.t > 0) {
        ctx.globalAlpha = Math.min(1, g.banner.t * 2);
        ctx.fillStyle = "rgba(60,40,80,0.7)";
        ctx.fillRect(0, 180, W, 62);
        ctx.textAlign = "center";
        ctx.fillStyle = g.banner.text === "BOSS SKILL" ? "#ffd36e" : "#ff6b8b";
        ctx.font = "bold 13px sans-serif";
        ctx.fillText(g.banner.text, W / 2, 202);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 20px serif";
        ctx.fillText(g.banner.sub, W / 2, 230);
        ctx.globalAlpha = 1;
      }
      // ult cut-in: concept-art pose slides in on a band in the hero's colors
      if (g.ult > 0.5) {
        const p = 1.6 - g.ult; // 0 -> 1.1
        const slide = p < 0.2 ? 1 - p / 0.2 : p > 0.85 ? (p - 0.85) / 0.25 : 0;
        const alpha = Math.max(0, 1 - Math.max(0, p - 0.85) / 0.25);
        const band = () => {
          ctx.beginPath();
          ctx.moveTo(0, H / 2 - 120);
          ctx.lineTo(W, H / 2 - 160);
          ctx.lineTo(W, H / 2 + 80);
          ctx.lineTo(0, H / 2 + 120);
          ctx.closePath();
        };
        ctx.globalAlpha = alpha;
        band();
        const bg = ctx.createLinearGradient(0, H / 2 - 160, 0, H / 2 + 120);
        bg.addColorStop(0, "#fff7ea");
        bg.addColorStop(1, "#f6e3f0");
        ctx.fillStyle = bg;
        ctx.fill();
        ctx.fillStyle = hc.a;
        ctx.fillRect(0, H / 2 - 124, W, 4);
        ctx.fillStyle = hc.c;
        ctx.fillRect(0, H / 2 + 118, W, 4);
        ctx.save();
        band();
        ctx.clip();
        const art = artImgs[g.char];
        if (art && art.complete && art.naturalWidth > 0) {
          const ah = 300;
          const aw = (art.naturalWidth / art.naturalHeight) * ah;
          const ax = 130 - aw / 2 - slide * 300;
          ctx.drawImage(art, ax, H / 2 - 170 - p * 12, aw, ah);
          // feather the photo's right edge into the band
          const fade = ctx.createLinearGradient(ax + aw - 50, 0, ax + aw, 0);
          fade.addColorStop(0, "rgba(251,239,236,0)");
          fade.addColorStop(1, "rgba(251,239,236,1)");
          ctx.fillStyle = fade;
          ctx.fillRect(ax + aw - 50, H / 2 - 180, 52, ah + 30);
        } else drawHero(ctx, g.char, 140 - slide * 300, H / 2 - 20, 4.5, g.t);
        ctx.restore();
        ctx.textAlign = "right";
        label(ctx, `「${pc.ult.name}」`, W - 20 + slide * 300, H / 2 - 10, "bold 26px serif");
        label(ctx, `${pc.name} — SPELL CARD`, W - 20 + slide * 300, H / 2 + 18, "bold 14px sans-serif", hc.a);
        ctx.globalAlpha = 1;
      }
      // stage banner
      const bannerStart = g.stage === 0 ? TUTORIAL : 0;
      if (g.running && g.t >= bannerStart && g.t < bannerStart + 2.2) {
        ctx.globalAlpha = Math.min(1, (bannerStart + 2.2 - g.t) * 2);
        ctx.textAlign = "center";
        label(ctx, stg(g.stage).name, W / 2, H / 2 - 40, "bold 22px sans-serif");
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
      g.bossPhase = 0;
      g.bossSkill = 0;
      g.bossCast = 0;
      g.bossUltCd = 0;
      g.zones.length = 0;
      g.banner.t = 0;
      g.trail.t = 0;
      g.midSpawned = false;
      g.carrierSpawned = false;
      g.carrierAt = 8 + Math.random() * 30;
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
      g.kills = 0;
      g.score = 0;
      g.gauge = 0;
      g.up = { q: 0, w: 0, e: 0 };
      g.pets = [];
      g.shotLv = 0;
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
      g.zones.length = 0;
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
        <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
          <span>효과 품질</span>
          {(["low", "mid", "high"] as const).map((q) => (
            <button
              key={q}
              onClick={() => { setQuality(q); qRef.current = q; localStorage.setItem("fxQuality", q); }}
              className={`rounded-full border px-2 py-0.5 ${quality === q ? "border-primary text-foreground" : "border-border hover:text-foreground"}`}
            >
              {q === "low" ? "저사양" : q === "mid" ? "보통" : "고품질"}
            </button>
          ))}
        </div>
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
              <div className="mb-1 flex justify-between text-[10px] font-bold tracking-widest text-foreground">
                <span>{stg(hud.stage).boss.name}</span>
                {hud.bossPhase === 2 && <span className="text-destructive">PHASE 2</span>}
              </div>
              <div className="relative h-2 overflow-hidden rounded-full bg-background/60">
                <div
                  className="h-full bg-destructive transition-[width] duration-100"
                  style={{ width: `${(hud.bossHp / hud.bossMax) * 100}%` }}
                />
                {[BOSS_SKILL_HP, BOSS_P2_HP].map((m) => (
                  <div key={m} className="absolute inset-y-0 w-0.5 bg-foreground/70" style={{ left: `${m * 100}%` }} />
                ))}
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
                      <img src={FACE_URLS[i]} alt={c.name} className="h-12 w-12 rounded-full border border-border object-cover" />
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
                {hud.lives > 5 ? `♥ × ${hud.lives}` : "♥".repeat(Math.max(0, hud.lives))}
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
