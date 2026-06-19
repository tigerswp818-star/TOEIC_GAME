import type { SimMeta } from "@/types/simulation";

import ContinuitySim from "./continuity/ContinuitySim";
import ContinuityPreview from "./continuity/ContinuityPreview";
import BernoulliSim from "./bernoulli/BernoulliSim";
import BernoulliPreview from "./bernoulli/BernoulliPreview";
import ReynoldsSim from "./reynolds/ReynoldsSim";
import ReynoldsPreview from "./reynolds/ReynoldsPreview";
import BuoyancySim from "./buoyancy/BuoyancySim";
import BuoyancyPreview from "./buoyancy/BuoyancyPreview";

/**
 * Central catalogue of every simulation. The dashboard and router both read
 * from here, so adding a new simulation is a single entry + its components.
 */
export const SIMULATIONS: SimMeta[] = [
  {
    id: "continuity",
    title: "สมการความต่อเนื่อง",
    titleEn: "Continuity Equation",
    tagline: "ท่อแคบทำให้น้ำไหลเร็วขึ้น เห็นอนุภาคเร่งความเร็วในคอท่อ",
    icon: "🚰",
    accent: "from-cyan-400 to-blue-600",
    formula: "A₁V₁ = A₂V₂",
    status: "ready",
    Sim: ContinuitySim,
    Preview: ContinuityPreview,
  },
  {
    id: "bernoulli",
    title: "เบอร์นูลลี / เวนทูรี",
    titleEn: "Bernoulli / Venturi",
    tagline: "ความเร็วเพิ่ม ความดันลด พร้อมแผนที่สีความดันและมาโนมิเตอร์",
    icon: "🌬️",
    accent: "from-sky-400 to-indigo-600",
    formula: "P/ρg + V²/2g + z = const",
    status: "ready",
    Sim: BernoulliSim,
    Preview: BernoulliPreview,
  },
  {
    id: "reynolds",
    title: "เลขเรย์โนลด์",
    titleEn: "Reynolds Number",
    tagline: "จาก Laminar สู่ Turbulent เห็นเส้นการไหลเรียบจนปั่นป่วน",
    icon: "🌀",
    accent: "from-teal-400 to-emerald-600",
    formula: "Re = ρVD/μ",
    status: "ready",
    Sim: ReynoldsSim,
    Preview: ReynoldsPreview,
  },
  {
    id: "buoyancy",
    title: "แรงลอยตัว",
    titleEn: "Buoyancy",
    tagline: "ทำไมวัตถุลอยหรือจม เห็นลูกศรแรงลอยตัวกับน้ำหนักสู้กัน",
    icon: "🛟",
    accent: "from-blue-400 to-cyan-600",
    formula: "Fb = ρ·g·V",
    status: "ready",
    Sim: BuoyancySim,
    Preview: BuoyancyPreview,
  },
  {
    id: "hydrostatic",
    title: "ความดันของของไหล",
    titleEn: "Hydrostatic Pressure",
    tagline: "ยิ่งลึก ความดันยิ่งสูง P = ρgh",
    icon: "📏",
    accent: "from-blue-500 to-slate-700",
    formula: "P = ρgh",
    status: "soon",
  },
  {
    id: "headloss",
    title: "การสูญเสียในท่อ",
    titleEn: "Pipe Head Loss",
    tagline: "พลังงานสูญเสียจากแรงเสียดทานและข้อต่อ",
    icon: "📉",
    accent: "from-orange-400 to-rose-600",
    formula: "hf = f(L/D)(V²/2g)",
    status: "soon",
  },
  {
    id: "vortex",
    title: "การหมุนวนของของไหล",
    titleEn: "Vortex",
    tagline: "อนุภาคหมุนรอบศูนย์กลาง ความเร็วต่างกันตามรัศมี",
    icon: "🌪️",
    accent: "from-violet-400 to-fuchsia-600",
    formula: "v = ω·r",
    status: "soon",
  },
  {
    id: "flow-around",
    title: "การไหลผ่านวัตถุ",
    titleEn: "Flow Around Object",
    tagline: "เส้นการไหลอ้อมวัตถุ เกิด wake และแรงต้าน",
    icon: "✈️",
    accent: "from-emerald-400 to-teal-600",
    formula: "Drag & Wake",
    status: "soon",
  },
];

export const getSim = (id: string): SimMeta | undefined =>
  SIMULATIONS.find((s) => s.id === id);

export const READY_SIMS = SIMULATIONS.filter((s) => s.status === "ready");
