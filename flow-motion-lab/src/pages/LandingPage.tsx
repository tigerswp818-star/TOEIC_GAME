import { Link } from "react-router-dom";
import ParticleFlowCanvas, { type DrawContext } from "@/components/canvas/ParticleFlowCanvas";
import { useTheme } from "@/hooks/useTheme";
import { CHAPTERS } from "@/data/curriculum";
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
        <div className="absolute inset-0">
          <ParticleFlowCanvas
            draw={heroDraw}
            playing
            speed={1}
            theme={theme}
            className="block h-full w-full"
            ariaLabel="ของไหลไหลผ่านท่อใส มีอนุภาคน้ำ ลูกศรทิศทาง และสีตามความดัน"
            zoomable={false}
          />
        </div>
        {/* Scrim — fades the live canvas into the page so the headline pops. */}
        <div className="absolute inset-0 bg-gradient-to-b from-surface/40 via-surface/55 to-surface" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-flow-400/40 to-transparent" />

        <div className="relative mx-auto max-w-5xl px-4 py-24 text-center sm:py-32">
          <span className="lab-chip mx-auto mb-6 animate-fade-in ring-1 ring-flow-400/30 !bg-surface-raised/70">
            <span className="animate-pulse-soft">🌊</span> สื่อการเรียนรู้ Fluid Mechanics · Interactive
          </span>
          <h1 className="mx-auto max-w-3xl text-4xl font-extrabold leading-[1.1] tracking-tight text-ink sm:text-6xl">
            เรียน Fluid Mechanics
            <br />
            <span className="text-aurora">ด้วยภาพเคลื่อนไหว</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base text-ink-soft sm:text-lg">
            ไม่ต้องท่องสูตร แต่ได้ “เห็น” การไหลจริง — อนุภาคของไหล เส้นการไหล (Streamline)
            ลูกศรความเร็ว (Velocity) และสีความดัน (Pressure) ที่เปลี่ยนทันทีเมื่อคุณปรับค่า
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link to="/lab" className="lab-btn-primary !px-7 !py-3.5 text-base">
              🧪 เริ่มทดลอง
            </Link>
            <Link to="/sim/continuity" className="lab-btn-ghost !px-7 !py-3.5 text-base">
              💧 ดูหลักการไหล
            </Link>
          </div>

          {/* Stat ribbon */}
          <dl className="mx-auto mt-12 grid max-w-2xl grid-cols-3 gap-3">
            {[
              { value: `${SIMULATIONS.length}`, label: "Simulation" },
              { value: `${CHAPTERS.length}`, label: "บทเรียน" },
              { value: "3", label: "ระดับ · โหมด" },
            ].map((s) => (
              <div key={s.label} className="glass rounded-2xl px-4 py-4">
                <dt className="bg-aurora-text bg-clip-text font-mono text-2xl font-bold text-transparent sm:text-3xl">
                  {s.value}
                </dt>
                <dd className="mt-0.5 text-xs text-ink-faint">{s.label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Feature strip */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { icon: "👁️", grad: "from-flow-400 to-deep-600", title: "เห็นภาพ ไม่ใช่ท่องจำ", body: "ทุกบทมีภาพเคลื่อนไหวกลางจอ ปรับค่าแล้วการไหลเปลี่ยนทันที" },
            { icon: "🎚️", grad: "from-deep-500 to-iris-600", title: "ลองเล่นได้จริง", body: "เลื่อน slider ปรับพื้นที่ ความเร็ว ความหนืด แล้วดูผลแบบ real-time" },
            { icon: "🧭", grad: "from-iris-500 to-flow-500", title: "3 โหมดการเรียน", body: "สำรวจอิสระ · เรียนทีละขั้น (Guided) · โจทย์ท้าทาย (Challenge)" },
          ].map((f, i) => (
            <div
              key={f.title}
              className="lab-card group animate-rise p-6 hover:-translate-y-1 hover:ring-aurora"
              style={{ animationDelay: `${i * 90}ms` }}
            >
              <div className={`grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br ${f.grad} text-2xl shadow-glow transition group-hover:scale-110`}>
                {f.icon}
              </div>
              <h3 className="mt-4 font-bold text-ink">{f.title}</h3>
              <p className="mt-1.5 text-sm text-ink-soft">{f.body}</p>
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
          {READY_SIMS.map((s, i) => (
            <Link
              key={s.id}
              to={`/sim/${s.id}`}
              style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}
              className="lab-card group relative animate-rise overflow-hidden p-4 hover:-translate-y-1 hover:ring-aurora"
            >
              {/* gradient wash that blooms on hover */}
              <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${s.accent} opacity-0 transition-opacity duration-300 group-hover:opacity-[0.08]`} />
              <div className={`relative mb-3 inline-grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br ${s.accent} text-xl shadow-glow transition group-hover:scale-110`}>
                {s.icon}
              </div>
              <h3 className="relative font-bold text-ink">{s.title}</h3>
              <p className="relative text-xs text-ink-faint">{s.titleEn}</p>
              <p className="relative mt-2 line-clamp-2 text-sm text-ink-soft">{s.tagline}</p>
              <p className="relative mt-3 font-mono text-xs text-flow-600 dark:text-flow-300">{s.formula}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
