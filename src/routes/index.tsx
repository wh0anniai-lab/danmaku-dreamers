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

type Phase = "title" | "play" | "clear" | "over";

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
  });
  const startRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const keys = new Set<string>();

    const g = {
      running: false,
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

    const burst = (x: number, y: number, n: number, hue: number) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = 0.5 + Math.random() * 3.5;
        g.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, hue });
      }
    };

    const level = () => Math.min(9, Math.floor(g.t / 5) + 1);

    const spawnEnemy = () => {
      const lv = level();
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
        hp: 1600,
        maxHp: 1600,
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
      if (keys.has("q") && g.skills.q.cd === 0) {
        g.skills.q.cd = g.skills.q.max;
        g.power = 4;
        burst(g.px, g.py, 20, 40);
      }
      if (keys.has("w") && g.skills.w.cd === 0) {
        g.skills.w.cd = g.skills.w.max;
        g.shield = 4;
        burst(g.px, g.py, 20, 200);
      }
      if (keys.has("e") && g.skills.e.cd === 0) {
        g.skills.e.cd = g.skills.e.max;
        g.dodge = 1;
        burst(g.px, g.py, 20, 300);
      }
      if (keys.has("r")) useUlt();

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
        g.spawn -= dt;
        if (g.spawn <= 0) {
          g.spawn = Math.max(0.35, 1.5 - lv * 0.13);
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
            if (e.fire <= 0) {
              e.fire = hpRatio > 0.5 ? 0.14 : 0.1;
              const n = hpRatio > 0.5 ? 9 : 13;
              const base = e.t * (hpRatio > 0.5 ? 1.7 : -2.3);
              for (let i = 0; i < n; i++)
                shootBullet(e.x, e.y, base + (i * Math.PI * 2) / n, 2.6, hpRatio > 0.5 ? 320 : 20, "rice");
              if (Math.random() < 0.35) {
                const a = Math.atan2(g.py - e.y, g.px - e.x);
                for (let i = -2; i <= 2; i++) shootBullet(e.x, e.y, a + i * 0.12, 4.2, 190);
              }
            }
          }
        } else {
          e.x += e.vx * dt * 60;
          e.y += e.vy * dt * 60;
          if (e.x < 20 || e.x > W - 20) e.vx *= -1;
          e.fire -= dt;
          if (e.fire <= 0 && e.y > 10) {
            e.fire = Math.max(0.5, 1.9 - lv * 0.16);
            const a = Math.atan2(g.py - e.y, g.px - e.x);
            const speed = 2 + lv * 0.22;
            if (lv <= 2) shootBullet(e.x, e.y, a, speed, 280);
            else if (lv <= 4) for (let i = -1; i <= 1; i++) shootBullet(e.x, e.y, a + i * 0.2, speed, 280);
            else if (lv <= 6) {
              const n = 8 + lv;
              for (let i = 0; i < n; i++) shootBullet(e.x, e.y, (i * Math.PI * 2) / n + e.t, speed * 0.85, 140, "rice");
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
            setPhase("clear");
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
      });
    };

    const drawGirl = (x: number, y: number, scale: number, ult: number) => {
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
      ctx.fillStyle = "#e8467c";
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
      ctx.fillStyle = "#6d4bd6";
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
      ctx.fillStyle = "#7d59ea";
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
      ctx.fillStyle = "#ff4d6d";
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
      ctx.save();
      ctx.translate(e.x, e.y);
      const puls = 1 + Math.sin(g.t * 4) * 0.04;
      ctx.scale(puls, puls);
      // wings
      ctx.fillStyle = "rgba(120,60,180,0.55)";
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(0, -4);
        ctx.quadraticCurveTo(s * 46, -30, s * 58, 6);
        ctx.quadraticCurveTo(s * 30, 2, 0, 16);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      drawGirl(e.x, e.y + 6, 1.9, 0);
      // hat
      ctx.fillStyle = "#2b1b46";
      ctx.beginPath();
      ctx.ellipse(e.x, e.y - 26, 26, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(e.x - 14, e.y - 27);
      ctx.lineTo(e.x + 14, e.y - 27);
      ctx.lineTo(e.x + 2, e.y - 48);
      ctx.closePath();
      ctx.fill();
    };

    const draw = () => {
      ctx.save();
      if (g.shake > 0)
        ctx.translate((Math.random() - 0.5) * g.shake, (Math.random() - 0.5) * g.shake);
      // background
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, "#150a25");
      bg.addColorStop(0.6, "#22103a");
      bg.addColorStop(1, "#3b1550");
      ctx.fillStyle = bg;
      ctx.fillRect(-20, -20, W + 40, H + 40);
      // stars
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      for (let i = 0; i < 60; i++) {
        const sx = (i * 97) % W;
        const sy = ((i * 173 + g.t * (40 + (i % 5) * 20)) % (H + 20)) - 10;
        ctx.fillRect(sx, sy, 2, 2 + (i % 3));
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
          ctx.save();
          ctx.translate(e.x, e.y);
          ctx.rotate(e.t);
          ctx.fillStyle = "#ff8ac4";
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

      ctx.restore();
    };

    startRef.current = () => {
      g.t = 0;
      g.lives = 3;
      g.score = 0;
      g.px = W / 2;
      g.py = H - 90;
      g.inv = 1;
      g.shield = 0;
      g.dodge = 0;
      g.gauge = 0;
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
      g.running = true;
      setPhase("play");
    };

    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, []);

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
          방향키 이동 · Shift 정밀이동 · 사격은 자동 · 45초에 보스 등장
        </p>
      </header>

      <div className="flex w-full max-w-[860px] flex-col items-center gap-4 md:flex-row md:items-start md:justify-center">
        <div className="relative" style={{ width: W, maxWidth: "100%" }}>
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            className="w-full rounded-xl border border-border shadow-lg"
          />
          {hud.bossMax > 0 && (
            <div className="absolute left-3 right-3 top-3">
              <div className="mb-1 text-[10px] font-bold tracking-widest text-foreground">
                STAGE BOSS
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
                  ? "스테이지 1 — 환상향의 탄막"
                  : phase === "clear"
                    ? "STAGE CLEAR!"
                    : "GAME OVER"}
              </h2>
              <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
                목숨 3개. 5초마다 탄막이 거세지고 45초에 보스가 나타납니다.
                <br />
                Q 강화 발출기 · W 방어막 · E 1초 자동 회피 · R 게이지 만충 시 전탄 소거
              </p>
              {phase !== "title" && (
                <p className="text-sm font-bold text-foreground">SCORE {hud.score}</p>
              )}
              <button
                onClick={() => startRef.current?.()}
                className="rounded-full bg-primary px-6 py-2 text-sm font-bold text-primary-foreground transition-transform hover:scale-105"
              >
                {phase === "title" ? "게임 시작" : "다시 도전"}
              </button>
            </div>
          )}
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
