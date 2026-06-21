import ParticleFlowCanvas, { type DrawContext } from "@/components/canvas/ParticleFlowCanvas";
import { useTheme } from "@/hooks/useTheme";
import { depthColor, velocityColor } from "@/lib/colors";
import { drawArrow, drawStreamline, type Pt } from "@/lib/render/draw";
import { mapClamped } from "@/lib/math";

/* ------------------------------ clip wrapper ------------------------------ */
function Clip({ draw, label }: { draw: (c: DrawContext) => void; label: string }) {
  const { theme } = useTheme();
  return (
    <div className="relative h-40 w-full overflow-hidden rounded-xl bg-gradient-to-b from-slate-100 to-slate-200 dark:from-[#0a1426] dark:to-[#06101f]">
      <ParticleFlowCanvas draw={draw} playing speed={1} theme={theme} className="block h-full w-full" ariaLabel={label} />
    </div>
  );
}

/* ------------------------------ clip draws ------------------------------ */
// 1) Dam: pressure pushes harder near the base.
const damDrops = Array.from({ length: 30 }, () => ({ x: Math.random(), y: Math.random() }));
function damDraw({ ctx, width, height, dt, theme }: DrawContext) {
  const waterRight = width * 0.6;
  for (let i = 0; i < 40; i++) {
    const t = i / 40;
    ctx.fillStyle = depthColor(t, 0.9);
    ctx.fillRect(0, t * height, waterRight, height / 40 + 1);
  }
  // dam (thicker at base)
  ctx.fillStyle = theme === "dark" ? "#334155" : "#64748b";
  ctx.beginPath();
  ctx.moveTo(waterRight, 0);
  ctx.lineTo(waterRight + width * 0.08, 0);
  ctx.lineTo(waterRight + width * 0.22, height);
  ctx.lineTo(waterRight, height);
  ctx.closePath();
  ctx.fill();
  // pressure arrows, longer near the bottom
  for (let i = 1; i <= 5; i++) {
    const y = (i / 6) * height;
    const len = mapClamped(y, 0, height, 8, 46);
    drawArrow(ctx, waterRight - len, y, waterRight, y, "#f59e0b", 2, 6);
  }
  // drifting particles
  for (const p of damDrops) {
    p.y += 0.05 * dt;
    if (p.y > 1) p.y -= 1;
    ctx.fillStyle = velocityColor(0.4, 0.5);
    ctx.beginPath();
    ctx.arc(p.x * waterRight, p.y * height, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

// 2) Hose pinch: narrow end → fast jet.
const hoseP = Array.from({ length: 60 }, () => ({ xf: Math.random(), f: Math.random() * 2 - 1 }));
function hoseDraw({ ctx, width, height, dt, theme }: DrawContext) {
  const cy = height / 2;
  const halfAt = (xf: number) => (xf < 0.7 ? height * 0.28 : height * 0.28 * (1 - (xf - 0.7) / 0.3 * 0.75));
  ctx.strokeStyle = theme === "dark" ? "#1e3a5f" : "#94a3b8";
  ctx.lineWidth = 3;
  for (const sgn of [-1, 1]) {
    ctx.beginPath();
    for (let i = 0; i <= 60; i++) {
      const xf = i / 60;
      if (xf > 0.92) break;
      const y = cy + sgn * halfAt(xf);
      i === 0 ? ctx.moveTo(0, y) : ctx.lineTo(xf * width, y);
    }
    ctx.stroke();
  }
  for (const p of hoseP) {
    const vel = p.xf < 0.7 ? 1 : 3.2;
    p.xf += vel * 0.1 * dt;
    if (p.xf > 1.05) {
      p.xf = 0;
      p.f = Math.random() * 2 - 1;
    }
    const h = p.xf < 0.92 ? halfAt(p.xf) : halfAt(0.92);
    ctx.beginPath();
    ctx.arc(p.xf * width, cy + p.f * h * 0.85, 2.2, 0, Math.PI * 2);
    ctx.fillStyle = velocityColor(Math.min(1, vel / 3.2), 0.95);
    ctx.fill();
  }
}

// 3) Steel ship floats (bobbing) with buoyancy arrow.
function shipDraw({ ctx, width, height, time, theme }: DrawContext) {
  const surfaceY = height * 0.55;
  for (let i = 0; i < 24; i++) {
    const t = i / 24;
    ctx.fillStyle = depthColor(t, 0.9);
    ctx.fillRect(0, surfaceY + t * (height - surfaceY), width, (height - surfaceY) / 24 + 1);
  }
  const bob = Math.sin(time * 1.6) * 4;
  const cx = width / 2;
  const hullY = surfaceY + bob;
  ctx.fillStyle = theme === "dark" ? "#475569" : "#334155";
  ctx.beginPath();
  ctx.moveTo(cx - 46, hullY - 16);
  ctx.lineTo(cx + 46, hullY - 16);
  ctx.lineTo(cx + 30, hullY + 18);
  ctx.lineTo(cx - 30, hullY + 18);
  ctx.closePath();
  ctx.fill();
  drawArrow(ctx, cx, hullY + 18, cx, hullY + 18 - 40, "#06b6d4", 3, 9); // buoyancy up
  drawArrow(ctx, cx, hullY - 16, cx, hullY - 16 + 26, "#f43f5e", 3, 9); // weight down
}

// 4) Venturi flow meter with manometer difference.
const venP = Array.from({ length: 50 }, () => ({ xf: Math.random(), f: Math.random() * 2 - 1 }));
function venturiDraw({ ctx, width, height, dt, theme }: DrawContext) {
  const cy = height * 0.6;
  const halfAt = (xf: number) => {
    const throat = 1 - Math.exp(-((xf - 0.5) ** 2) / 0.01) * 0.7;
    return height * 0.2 * throat;
  };
  ctx.strokeStyle = theme === "dark" ? "#1e3a5f" : "#94a3b8";
  ctx.lineWidth = 3;
  for (const sgn of [-1, 1]) {
    ctx.beginPath();
    for (let i = 0; i <= 60; i++) {
      const xf = i / 60;
      const y = cy + sgn * halfAt(xf);
      i === 0 ? ctx.moveTo(0, y) : ctx.lineTo(xf * width, y);
    }
    ctx.stroke();
  }
  // manometers
  for (const [xf, h] of [[0.2, 0.5], [0.5, 0.18], [0.8, 0.5]] as const) {
    const x = xf * width;
    ctx.strokeStyle = theme === "dark" ? "#334155" : "#94a3b8";
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 5, height * 0.08, 10, cy - halfAt(xf) - height * 0.08);
    ctx.fillStyle = "#06b6d4";
    const top = cy - halfAt(xf) - (cy - halfAt(xf) - height * 0.08) * h;
    ctx.fillRect(x - 4, top, 8, cy - halfAt(xf) - top);
  }
  for (const p of venP) {
    const vel = 1 / (halfAt(p.xf) / (height * 0.2));
    p.xf += vel * 0.06 * dt;
    if (p.xf > 1) {
      p.xf -= 1;
      p.f = Math.random() * 2 - 1;
    }
    ctx.beginPath();
    ctx.arc(p.xf * width, cy + p.f * halfAt(p.xf) * 0.8, 2, 0, Math.PI * 2);
    ctx.fillStyle = velocityColor(Math.min(1, vel / 3), 0.95);
    ctx.fill();
  }
}

// 5) Head loss: energy line slopes down along the pipe.
const lossP = Array.from({ length: 40 }, () => ({ xf: Math.random() }));
function lossDraw({ ctx, width, height, dt, theme }: DrawContext) {
  const cy = height * 0.62;
  const half = height * 0.16;
  ctx.strokeStyle = theme === "dark" ? "#1e3a5f" : "#94a3b8";
  ctx.lineWidth = 3;
  ctx.strokeRect(0, cy - half, width, half * 2);
  // energy grade line sloping downward
  const egl: Pt[] = [];
  for (let i = 0; i <= 20; i++) {
    const xf = i / 20;
    egl.push({ x: xf * width, y: height * 0.12 + xf * height * 0.3 });
  }
  drawStreamline(ctx, egl, "#f59e0b", 2.5, [6, 4]);
  ctx.fillStyle = "#f59e0b";
  ctx.font = "11px sans-serif";
  ctx.fillText("Energy line ↓", 8, height * 0.1);
  for (const p of lossP) {
    p.xf += 0.14 * dt;
    if (p.xf > 1) p.xf -= 1;
    ctx.beginPath();
    ctx.arc(p.xf * width, cy + (Math.random() * 2 - 1) * half * 0.7, 2, 0, Math.PI * 2);
    ctx.fillStyle = velocityColor(0.6, 0.9);
    ctx.fill();
  }
}

// 6) Dye stream: smooth (laminar) then breaks into turbulence.
const dye = Array.from({ length: 90 }, (_, i) => ({ xf: (i / 90), seed: Math.random() * 10 }));
function dyeDraw({ ctx, width, height, dt, time }: DrawContext) {
  const cy = height / 2;
  for (const p of dye) {
    p.xf += 0.12 * dt;
    if (p.xf > 1) p.xf -= 1;
    const turb = mapClamped(p.xf, 0.45, 0.85, 0, 1);
    const wobble =
      Math.sin(p.xf * 30 + time * 4 + p.seed) * 10 * turb +
      Math.sin(p.xf * 70 + time * 7 + p.seed) * 6 * turb;
    ctx.beginPath();
    ctx.arc(p.xf * width, cy + wobble, 2.2, 0, Math.PI * 2);
    ctx.fillStyle = turb > 0.5 ? "rgba(244,63,94,0.9)" : "rgba(34,211,238,0.9)";
    ctx.fill();
  }
}

/* ------------------------------ data ------------------------------ */
const EXAMPLES = [
  { icon: "🏞️", title: "เขื่อนหนาที่ฐาน", draw: damDraw, body: "ยิ่งลึก ความดันน้ำยิ่งสูง (P = ρgh) เขื่อนจึงต้องหนาที่ฐานเพื่อรับแรงดันที่มากที่สุดด้านล่าง", topic: "Hydrostatic Pressure" },
  { icon: "💦", title: "บีบปลายสายยาง", draw: hoseDraw, body: "บีบปลายสายยางให้พื้นที่เล็กลง น้ำพุ่งออกเร็วขึ้น ตามสมการความต่อเนื่อง A₁V₁ = A₂V₂", topic: "Continuity" },
  { icon: "🚢", title: "เรือเหล็กลอยได้", draw: shipDraw, body: "เรือเหล็กกินน้ำลึกพอจนแทนที่น้ำได้มาก แรงลอยตัวจึงมากกว่าน้ำหนัก เรือจึงลอย", topic: "Buoyancy" },
  { icon: "📟", title: "ท่อ Venturi วัดการไหล", draw: venturiDraw, body: "คอท่อแคบทำให้ความดันลด (Bernoulli) ความต่างของระดับน้ำในมาโนมิเตอร์ใช้คำนวณอัตราการไหลได้", topic: "Bernoulli" },
  { icon: "🛢️", title: "ท่อส่งน้ำระยะไกล", draw: lossDraw, body: "พลังงานของน้ำลดลงตลอดท่อจากแรงเสียดทาน (head loss) ยิ่งเร็ว/ยิ่งยาว ยิ่งสูญเสียมาก", topic: "Head Loss" },
  { icon: "🚬", title: "ควัน/สีน้ำในน้ำ", draw: dyeDraw, body: "เส้นสีที่เรียบคือการไหลแบบ Laminar เมื่อความเร็วสูงขึ้นจะแตกเป็น Turbulent ปั่นป่วน", topic: "Reynolds" },
];

export default function RealWorldPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
          เห็นในชีวิตจริง <span className="text-aurora">Real-world</span>
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          หลักการของไหลที่อยู่รอบตัวเรา พร้อมภาพเคลื่อนไหวสั้น ๆ ให้เห็นภาพ
        </p>
      </header>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {EXAMPLES.map((ex) => (
          <article key={ex.title} className="lab-card overflow-hidden p-4">
            <Clip draw={ex.draw} label={ex.title} />
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xl">{ex.icon}</span>
              <h2 className="font-bold text-ink">{ex.title}</h2>
            </div>
            <p className="mt-1.5 text-sm text-ink-soft">{ex.body}</p>
            <span className="lab-chip mt-3">{ex.topic}</span>
          </article>
        ))}
      </div>
    </div>
  );
}
