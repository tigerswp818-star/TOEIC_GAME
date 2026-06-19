import { Link } from "react-router-dom";
import { CORE_LESSONS } from "../data/lessons";
import { ThemeToggle } from "../components/layout/ThemeToggle";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";

/** Animated "water flowing through a pipe" hero graphic. */
function PipeFlowHero() {
  return (
    <svg viewBox="0 0 400 180" className="w-full max-w-xl">
      <defs>
        <linearGradient id="heroPipe" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#bfe3ff" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#3a98f5" stopOpacity="0.6" />
        </linearGradient>
      </defs>
      {/* pipe (wide → narrow → wide) */}
      <path
        d="M0 50 L150 50 L210 75 L260 75 L320 50 L400 50 L400 130 L320 130 L260 105 L210 105 L150 130 L0 130 Z"
        fill="url(#heroPipe)"
        className="stroke-brand-400 dark:stroke-brand-500"
        strokeWidth="2.5"
      />
      {/* animated streamlines */}
      {[-0.5, 0, 0.5].map((ny, i) => {
        const y = (off: number) => 90 + ny * off;
        const d = `M0 ${y(40)} L150 ${y(40)} L210 ${y(15)} L260 ${y(15)} L320 ${y(40)} L400 ${y(40)}`;
        return (
          <path
            key={i}
            d={d}
            fill="none"
            stroke="#1d62d7"
            strokeWidth="2.5"
            strokeDasharray="12 9"
            className="animate-flow-dash"
            style={{ animationDuration: `${1 + i * 0.15}s` }}
            opacity={0.75}
          />
        );
      })}
    </svg>
  );
}

export function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50 via-white to-aqua-50 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
      {/* top bar */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-lg">🌊</span>
          <span className="font-extrabold text-slate-900 dark:text-white">FlowLab</span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/dashboard" className="hidden text-sm font-semibold text-brand-700 hover:underline sm:block dark:text-brand-300">
            แผนการเรียน
          </Link>
          <ThemeToggle />
        </div>
      </header>

      {/* hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-8 px-5 py-10 md:grid-cols-2 md:py-16">
        <div>
          <Badge tone="aqua">Interactive Fluid Mechanics</Badge>
          <h1 className="mt-4 text-4xl font-extrabold leading-tight text-slate-900 sm:text-5xl dark:text-white">
            เรียน Fluid Mechanics<br />
            <span className="bg-gradient-to-r from-brand-600 to-aqua-500 bg-clip-text text-transparent">
              แบบเห็นภาพ
            </span>
          </h1>
          <p className="mt-4 max-w-md text-lg text-slate-600 dark:text-slate-300">
            เข้าใจความดัน การไหล สมการเบอร์นูลลี (Bernoulli) เลขเรย์โนลด์
            (Reynolds number) และการสูญเสียในท่อ (pipe loss) ผ่าน{" "}
            <strong>simulation แบบปรับค่าได้จริง</strong> — ไม่ใช่แค่ท่องสูตร
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/dashboard">
              <Button size="lg">🚀 เริ่มเรียน</Button>
            </Link>
            <Link to="/lesson/bernoulli">
              <Button size="lg" variant="outline">
                ลองเล่น Bernoulli
              </Button>
            </Link>
          </div>
          <div className="mt-6 flex flex-wrap gap-4 text-sm text-slate-500 dark:text-slate-400">
            <span>✓ 8 บทเรียน</span>
            <span>✓ 6+ simulator</span>
            <span>✓ Quiz + Formula sheet</span>
            <span>✓ ไม่ต้องล็อกอิน</span>
          </div>
        </div>
        <div className="flex justify-center">
          <div className="surface w-full p-6">
            <PipeFlowHero />
            <p className="mt-3 text-center text-sm text-slate-500 dark:text-slate-400">
              น้ำไหลเร็วขึ้นเมื่อท่อแคบ — หลักความต่อเนื่อง (Continuity)
            </p>
          </div>
        </div>
      </section>

      {/* module cards */}
      <section className="mx-auto max-w-6xl px-5 pb-20">
        <h2 className="mb-5 text-2xl font-bold text-slate-900 dark:text-white">
          โมดูลหลัก (Main modules)
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CORE_LESSONS.map((l) => (
            <Link
              key={l.id}
              to={l.path}
              className="surface group block overflow-hidden p-5 transition hover:-translate-y-1 hover:shadow-lg"
            >
              <div className={`mb-3 inline-grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br ${l.accent} text-2xl`}>
                {l.icon}
              </div>
              <div className="text-xs font-semibold text-slate-400">บทที่ {l.order}</div>
              <h3 className="mt-0.5 font-bold text-slate-900 group-hover:text-brand-600 dark:text-white dark:group-hover:text-brand-400">
                {l.title}
              </h3>
              <p className="text-xs text-slate-400">{l.titleEn}</p>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{l.summary}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
