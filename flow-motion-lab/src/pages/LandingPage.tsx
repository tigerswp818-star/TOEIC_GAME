import { Link } from "react-router-dom";
import ParticleFlowCanvas, { type DrawContext } from "@/components/canvas/ParticleFlowCanvas";
import { useTheme } from "@/hooks/useTheme";
import { READY_SIMS, SIMULATIONS } from "@/sims/registry";
import { areaAt, velocityAt } from "@/sims/continuity/continuityModel";
import { velocityColor, pressureColor } from "@/lib/colors";
import { drawArrow } from "@/lib/render/draw";

// Hero pipe: a gentle venturi flowing across the screen.
const HA1 = 0.3;
const HA2 = 0.12;
const HV1 = 1.8;
const heroParticles = Array.from({ length: 150 }, () => ({
  xf: Math.random(),
  f: (Math.random() * 2 - 1) * 0.9,
}));

function heroDraw({ ctx, width, height, dt, theme }: DrawContext) {
  const centerY = height / 2;
  const maxHalf = height * 0.34;
  const halfAt = (xf: number) => maxHalf * (areaAt(xf, HA1, HA2) / HA1);
  const dark = theme === "dark";
  const maxVel = velocityAt(0.5, HA1, HA2, HV1);

  // pressure-tinted pipe interior (sampled strips)
  const strips = 60;
  for (let i = 0; i < strips; i++) {
    const xf = i / strips;
    const vel = velocityAt(xf, HA1, HA2, HV1);
    // high velocity → low pressure (cool); low velocity → high pressure (warm)
    const t = 1 - Math.min(1, (vel - HV1) / (maxVel - HV1 + 1e-6));
    ctx.fillStyle = pressureColor(t, dark ? 0.22 : 0.3);
    const x = xf * width;
    const w = width / strips + 1;
    ctx.fillRect(x, centerY - halfAt(xf), w, halfAt(xf) * 2);
  }

  // pipe walls
  ctx.lineWidth = 3;
  ctx.strokeStyle = dark ? "#1e3a5f" : "#94a3b8";
  for (const sgn of [-1, 1]) {
    ctx.beginPath();
    for (let i = 0; i <= 80; i++) {
      const xf = i / 80;
      const y = centerY + sgn * halfAt(xf);
      i === 0 ? ctx.moveTo(0, y) : ctx.lineTo(xf * width, y);
    }
    ctx.stroke();
  }

  // particles
  for (const p of heroParticles) {
    const vel = velocityAt(p.xf, HA1, HA2, HV1);
    p.xf += vel * 0.09 * dt;
    if (p.xf > 1) {
      p.xf -= 1;
      p.f = (Math.random() * 2 - 1) * 0.9;
    }
    ctx.beginPath();
    ctx.arc(p.xf * width, centerY + p.f * halfAt(p.xf), 2.4, 0, Math.PI * 2);
    ctx.fillStyle = velocityColor(Math.min(1, vel / maxVel), 0.95);
    ctx.fill();
  }

  // direction arrows
  for (const xf of [0.18, 0.5, 0.82]) {
    const vel = velocityAt(xf, HA1, HA2, HV1);
    const len = Math.min(width * 0.12, vel * width * 0.04);
    drawArrow(ctx, xf * width - len / 2, centerY, xf * width + len / 2, centerY, "#f59e0b", 2.5, 8);
  }
}

export default function LandingPage() {
  const { theme } = useTheme();

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 opacity-90">
          <ParticleFlowCanvas
            draw={heroDraw}
            playing
            speed={1}
            theme={theme}
            className="block h-full w-full"
            ariaLabel="ของไหลไหลผ่านท่อใส มีอนุภาคน้ำ ลูกศรทิศทาง และสีตามความดัน"
          />
        </div>
        <div className="relative mx-auto max-w-5xl px-4 py-20 text-center sm:py-28">
          <span className="lab-chip mx-auto mb-5 !bg-surface-raised/80 backdrop-blur">
            🌊 สื่อการเรียนรู้ Fluid Mechanics
          </span>
          <h1 className="mx-auto max-w-3xl text-3xl font-extrabold leading-tight tracking-tight text-ink sm:text-5xl">
            เรียน Fluid Mechanics
            <br />
            <span className="bg-gradient-to-r from-flow-500 to-deep-600 bg-clip-text text-transparent">
              ด้วยภาพเคลื่อนไหว
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-ink-soft sm:text-lg">
            ไม่ต้องท่องสูตร แต่ได้ “เห็น” การไหลจริง — อนุภาคของไหล เส้นการไหล (Streamline)
            ลูกศรความเร็ว (Velocity) และสีความดัน (Pressure) ที่เปลี่ยนทันทีเมื่อคุณปรับค่า
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/lab" className="lab-btn-primary !px-6 !py-3 text-base">
              🧪 เริ่มทดลอง
            </Link>
            <Link to="/sim/continuity" className="lab-btn-ghost !px-6 !py-3 text-base backdrop-blur">
              💧 ดูหลักการไหล
            </Link>
          </div>
        </div>
      </section>

      {/* Feature strip */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { icon: "👁️", title: "เห็นภาพ ไม่ใช่ท่องจำ", body: "ทุกบทมีภาพเคลื่อนไหวกลางจอ ปรับค่าแล้วการไหลเปลี่ยนทันที" },
            { icon: "🎚️", title: "ลองเล่นได้จริง", body: "เลื่อน slider ปรับพื้นที่ ความเร็ว ความหนืด แล้วดูผลแบบ real-time" },
            { icon: "🧭", title: "3 โหมดการเรียน", body: "สำรวจอิสระ · เรียนทีละขั้น (Guided) · โจทย์ท้าทาย (Challenge)" },
          ].map((f) => (
            <div key={f.title} className="lab-card p-5">
              <div className="text-2xl">{f.icon}</div>
              <h3 className="mt-2 font-bold text-ink">{f.title}</h3>
              <p className="mt-1 text-sm text-ink-soft">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Ready simulations */}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <h2 className="text-xl font-bold text-ink sm:text-2xl">การทดลองพร้อมใช้งาน</h2>
            <p className="text-sm text-ink-faint">{READY_SIMS.length} simulation จากทั้งหมด {SIMULATIONS.length} หัวข้อ</p>
          </div>
          <Link to="/lab" className="text-sm font-semibold text-flow-600 hover:underline dark:text-flow-300">
            ดูทั้งหมด →
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {READY_SIMS.map((s) => (
            <Link
              key={s.id}
              to={`/sim/${s.id}`}
              className="lab-card group overflow-hidden p-4 transition hover:-translate-y-0.5 hover:shadow-glow"
            >
              <div className={`mb-3 inline-grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br ${s.accent} text-xl`}>
                {s.icon}
              </div>
              <h3 className="font-bold text-ink">{s.title}</h3>
              <p className="text-xs text-ink-faint">{s.titleEn}</p>
              <p className="mt-2 line-clamp-2 text-sm text-ink-soft">{s.tagline}</p>
              <p className="mt-3 font-mono text-xs text-flow-600 dark:text-flow-300">{s.formula}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
