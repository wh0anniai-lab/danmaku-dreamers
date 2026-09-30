import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

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

type Pal = { dress: string; hair: string; ribbon: string };
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

type Bullet = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hue: number;
  kind: "ball" | "rice";
};
type Shot = { x: number; y: number; vx: number; vy: number; power: number };
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
};
type Particle = { x: number; y: number; vx: number; vy: number; life: number; hue: number };

type Phase = "title" | "play" | "stageclear" | "clear" | "over";

type Skill = { cd: number; max: number };

function Game() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [phase, setPhase] = useState<Phase>("title");
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
  const startRef = useRef<(() => void) | null>(null);
  const nextRef = useRef<(() => void) | null>(null);
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
    };

    const onDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (
        ["arrowup", "arrowdown", "arrowleft", "arrowright", " ", "q", "w", "e", "r", "shift"].includes(k)
      )
        e.preventDefault();
      keys.add(k);
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
        g.running = false;
        setPhase("over");
      }
    };

    const useUlt = () => {
      if (g.gauge < 1 || g.ult > 0) return;
      g.gauge = 0;
      g.ult = 1.6;
      g.inv = Math.max(g.inv, 1.8);
      g.shake = 18;
      for (const b of g.bullets) burst(b.x, b.y, 2, b.hue);
      g.bullets.length = 0;
      g.score += 300;
      for (const e of g.enemies) {
        e.hp -= e.boss ? 160 : 999;
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

      // movement
      const focus = keys.has("shift");
      const sp = (focus ? 2.0 : 4.2) * (dt * 60);
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
      g.ult = Math.max(0, g.ult - dt);
      g.power = Math.max(0, g.power - dt);
      g.shake = Math.max(0, g.shake - dt * 30);
      g.gauge = Math.min(1, g.gauge + dt / 5);
      for (const k of ["q", "w", "e"] as const) g.skills[k].cd = Math.max(0, g.skills[k].cd - dt);

      // skills
      if (pressed("q") && g.skills.q.cd === 0) {
        g.skills.q.cd = g.skills.q.max;
        g.power = 4;
        burst(g.px, g.py, 20, 40);
      }
      if (pressed("w") && g.skills.w.cd === 0) {
        g.skills.w.cd = g.skills.w.max;
        g.shield = 4;
        burst(g.px, g.py, 20, 200);
      }
      if (pressed("e") && g.skills.e.cd === 0) {
        g.skills.e.cd = g.skills.e.max;
        g.dodge = 1;
        burst(g.px, g.py, 20, 300);
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
        g.shotCd = g.power > 0 ? 0.055 : 0.1;
        const pw = g.power > 0 ? 4 : 2;
        const spread = g.power > 0 ? [-0.22, -0.08, 0.08, 0.22] : [-0.05, 0.05];
        for (const a of spread)
          g.shots.push({ x: g.px, y: g.py - 16, vx: Math.sin(a) * 9, vy: -13, power: pw });
      }

      // spawning
      if (!g.bossSpawned) {
        const tutorial = g.stage === 0 && g.t < TUTORIAL;
        if (!tutorial) g.spawn -= dt;
        if (g.spawn <= 0) {
          g.spawn = Math.max(0.3, 1.5 - dv * 0.12);
          spawnEnemy();
        }
        if (g.t >= BOSS_TIME) {
          g.bossSpawned = true;
          spawnBoss();
        }
      }

      // enemies
      for (const e of g.enemies) {
        e.t += dt;
        if (e.boss) {
          if (e.y < 130) e.y += 40 * dt;
          else {
            e.x += e.vx * dt * 60;
            if (e.x < 70 || e.x > W - 70) e.vx *= -1;
          }
          if (e.y >= 120) {
            e.fire -= dt;
            const hpRatio = e.hp / e.maxHp;
            const aim = Math.atan2(g.py - e.y, g.px - e.x);
            if (e.fire <= 0 && g.stage === 0) {
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
          g.score += e.boss ? 5000 : 100;
          if (e.boss) {
            g.running = false;
            g.bullets.length = 0;
            setPhase(g.stage < STAGES.length - 1 ? "stageclear" : "clear");
          }
          return false;
        }
        return e.y < H + 60;
      });

      // player shots
      for (const s of g.shots) {
        s.x += s.vx * dt * 60;
        s.y += s.vy * dt * 60;
        for (const e of g.enemies) {
          if (Math.hypot(s.x - e.x, s.y - e.y) < e.r + 4) {
            e.hp -= s.power;
            s.y = -999;
            burst(s.x, s.y, 2, 50);
            break;
          }
        }
      }
      g.shots = g.shots.filter((s) => s.y > -20 && s.x > -20 && s.x < W + 20);

      // bullets
      for (const b of g.bullets) {
        b.x += b.vx * dt * 60;
        b.y += b.vy * dt * 60;
        if (Math.hypot(b.x - g.px, b.y - g.py) < b.r + 4) {
          b.y = H + 999;
          hitPlayer();
        }
      }
      g.bullets = g.bullets.filter((b) => b.x > -30 && b.x < W + 30 && b.y > -40 && b.y < H + 30);

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
      // sleeves
      ctx.fillStyle = "#fff3f7";
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
      bg.addColorStop(0, st.bg[0]);
      bg.addColorStop(0.6, st.bg[1]);
      bg.addColorStop(1, st.bg[2]);
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
      for (const s of g.shots) {
        ctx.fillStyle = s.power > 2 ? "#ffe066" : "#9be8ff";
        ctx.beginPath();
        ctx.ellipse(s.x, s.y, 2.6, 7, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // enemies
      for (const e of g.enemies) {
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

      // player
      if (!(g.inv > 0 && Math.floor(g.t * 14) % 2 === 0)) {
        drawGirl(g.px, g.py, g.ult > 0 ? 1 + (1.6 - g.ult) * 0.5 : 1, g.ult);
      }
      if (g.shield > 0) {
        ctx.strokeStyle = `hsl(200 100% 75% / ${0.4 + Math.sin(g.t * 10) * 0.2})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(g.px, g.py, 26, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (g.dodge > 0) {
        ctx.strokeStyle = "hsl(300 100% 80% / 0.7)";
        ctx.setLineDash([6, 6]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(g.px, g.py, 34, g.t * 6, g.t * 6 + Math.PI * 1.5);
        ctx.stroke();
        ctx.setLineDash([]);
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
        const lines: [string, string][] = [
          ["방향키 / 화면 드래그", "이동"],
          ["Shift", "정밀 이동 (사격은 자동)"],
          ["Q", "강화 발출기 4초"],
          ["W", "방어막 (1회 피격 무효)"],
          ["E", "1초 자동 회피"],
          ["R", "게이지 100% — 전탄 소거"],
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
      g.t = 0;
      g.px = W / 2;
      g.py = H - 90;
      g.inv = 1;
      g.shield = 0;
      g.dodge = 0;
      g.ult = 0;
      g.power = 0;
      g.bullets.length = 0;
      g.shots.length = 0;
      g.enemies.length = 0;
      g.parts.length = 0;
      g.spawn = 0.6;
      g.bossSpawned = false;
      g.skills.q.cd = 0;
      g.skills.w.cd = 0;
      g.skills.e.cd = 0;
      taps.clear();
      g.running = true;
      setPhase("play");
    };

    startRef.current = () => {
      g.stage = 0;
      g.lives = 3;
      g.score = 0;
      g.gauge = 0;
      resetStage();
    };
    nextRef.current = () => {
      g.stage = Math.min(STAGES.length - 1, g.stage + 1);
      resetStage();
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

  const touchBtn = (k: string, label: string, cd: number, max: number, ready = true) => (
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

  return (
    <main className="flex min-h-screen flex-col items-center gap-4 bg-background px-4 py-6">
      <header className="text-center">
        <h1 className="text-2xl font-black tracking-tight text-foreground">탄막 소녀 — 총알 피하기</h1>
        <p className="text-xs text-muted-foreground">
          방향키 · 화면 드래그로 이동 · 사격은 자동 · 3개 스테이지, 각 45초에 보스 등장
        </p>
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

          {phase !== "play" && (
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
              <button
                onClick={() => (phase === "stageclear" ? nextRef.current?.() : startRef.current?.())}
                className="rounded-full bg-primary px-6 py-2 text-sm font-bold text-primary-foreground transition-transform hover:scale-105"
              >
                {phase === "title" ? "게임 시작" : phase === "stageclear" ? "다음 스테이지" : "다시 도전"}
              </button>
            </div>
          )}
        </div>
        <div className="grid grid-cols-4 gap-2">
          {touchBtn("q", "강화 발출", hud.q, 6)}
          {touchBtn("w", "방어막", hud.w, 9)}
          {touchBtn("e", "자동 회피", hud.e, 11)}
          {touchBtn("r", "스펠카드", 0, 1, hud.gauge >= 1)}
        </div>
        </div>

        <aside className="w-full max-w-[280px] space-y-3">
          <div className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-center justify-between text-sm">
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
            {skillBox("q", "강화 발출", hud.q, 6)}
            {skillBox("w", "방어막", hud.w, 9)}
            {skillBox("e", "자동 회피", hud.e, 11)}
          </div>

          <div className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-foreground">R · 스펠카드 (전탄 소거)</span>
              <span className="text-muted-foreground">{Math.floor(hud.gauge * 100)}%</span>
            </div>
            <div className="mt-2 h-3 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-destructive transition-[width] duration-100"
                style={{ width: `${hud.gauge * 100}%` }}
              />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-3 text-xs leading-relaxed text-muted-foreground">
            작은 흰 점이 판정 범위입니다. 총알은 자동으로 발사되니 회피에 집중하세요.
          </div>
        </aside>
      </div>
    </main>
  );
}
