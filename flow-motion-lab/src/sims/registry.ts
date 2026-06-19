import type { SimMeta } from "@/types/simulation";

import ContinuitySim from "./continuity/ContinuitySim";
import ContinuityPreview from "./continuity/ContinuityPreview";
import BernoulliSim from "./bernoulli/BernoulliSim";
import BernoulliPreview from "./bernoulli/BernoulliPreview";
import ReynoldsSim from "./reynolds/ReynoldsSim";
import ReynoldsPreview from "./reynolds/ReynoldsPreview";
import BuoyancySim from "./buoyancy/BuoyancySim";
import BuoyancyPreview from "./buoyancy/BuoyancyPreview";
import HydrostaticSim from "./hydrostatic/HydrostaticSim";
import HydrostaticPreview from "./hydrostatic/HydrostaticPreview";
import HeadLossSim from "./headloss/HeadLossSim";
import HeadLossPreview from "./headloss/HeadLossPreview";
import VortexSim from "./vortex/VortexSim";
import VortexPreview from "./vortex/VortexPreview";
import FlowAroundSim from "./flowAround/FlowAroundSim";
import FlowAroundPreview from "./flowAround/FlowAroundPreview";
import ManometerSim from "./manometer/ManometerSim";
import ManometerPreview from "./manometer/ManometerPreview";
import DamPressureSim from "./damPressure/DamPressureSim";
import DamPressurePreview from "./damPressure/DamPressurePreview";
import JetImpactSim from "./jetImpact/JetImpactSim";
import JetImpactPreview from "./jetImpact/JetImpactPreview";
import PipeBendSim from "./pipeBend/PipeBendSim";
import PipeBendPreview from "./pipeBend/PipeBendPreview";
import MoodySim from "./moody/MoodySim";
import MoodyPreview from "./moody/MoodyPreview";
import PumpCurveSim from "./pumpCurve/PumpCurveSim";
import PumpCurvePreview from "./pumpCurve/PumpCurvePreview";
import ViscosityRaceSim from "./viscosityRace/ViscosityRaceSim";
import ViscosityRacePreview from "./viscosityRace/ViscosityRacePreview";
import CapillarySim from "./capillary/CapillarySim";
import CapillaryPreview from "./capillary/CapillaryPreview";
import StreamlinesSim from "./streamlines/StreamlinesSim";
import StreamlinesPreview from "./streamlines/StreamlinesPreview";
import RotationalSim from "./rotational/RotationalSim";
import RotationalPreview from "./rotational/RotationalPreview";
import OpenChannelSim from "./openChannel/OpenChannelSim";
import OpenChannelPreview from "./openChannel/OpenChannelPreview";
import HydraulicJumpSim from "./hydraulicJump/HydraulicJumpSim";
import HydraulicJumpPreview from "./hydraulicJump/HydraulicJumpPreview";
import MachSim from "./mach/MachSim";
import MachPreview from "./mach/MachPreview";
import FlowMeterSim from "./flowMeter/FlowMeterSim";
import FlowMeterPreview from "./flowMeter/FlowMeterPreview";

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
    status: "ready",
    Sim: HydrostaticSim,
    Preview: HydrostaticPreview,
  },
  {
    id: "headloss",
    title: "การสูญเสียในท่อ",
    titleEn: "Pipe Head Loss",
    tagline: "พลังงานสูญเสียจากแรงเสียดทานและข้อต่อ",
    icon: "📉",
    accent: "from-orange-400 to-rose-600",
    formula: "hf = f(L/D)(V²/2g)",
    status: "ready",
    Sim: HeadLossSim,
    Preview: HeadLossPreview,
  },
  {
    id: "vortex",
    title: "การหมุนวนของของไหล",
    titleEn: "Vortex",
    tagline: "อนุภาคหมุนรอบศูนย์กลาง ความเร็วต่างกันตามรัศมี",
    icon: "🌪️",
    accent: "from-violet-400 to-fuchsia-600",
    formula: "v = ω·r",
    status: "ready",
    Sim: VortexSim,
    Preview: VortexPreview,
  },
  {
    id: "flow-around",
    title: "การไหลผ่านวัตถุ",
    titleEn: "Flow Around Object",
    tagline: "เส้นการไหลอ้อมวัตถุ เกิด wake และแรงต้าน",
    icon: "✈️",
    accent: "from-emerald-400 to-teal-600",
    formula: "Drag & Wake",
    status: "ready",
    Sim: FlowAroundSim,
    Preview: FlowAroundPreview,
  },
  {
    id: "manometer",
    title: "มาโนมิเตอร์",
    titleEn: "Manometer",
    tagline: "อ่านความดันต่างจากระดับของไหลในหลอด U-tube",
    icon: "🌡️",
    accent: "from-cyan-400 to-blue-600",
    formula: "ΔP = ρgh",
    status: "ready",
    Sim: ManometerSim,
    Preview: ManometerPreview,
  },
  {
    id: "dam-pressure",
    title: "ความดันบนเขื่อน",
    titleEn: "Dam Pressure & Center of Pressure",
    tagline: "แรงดันน้ำบนเขื่อนและจุดศูนย์กลางแรงดัน",
    icon: "🏞️",
    accent: "from-blue-500 to-slate-700",
    formula: "F = ρg·h_c·A",
    status: "ready",
    Sim: DamPressureSim,
    Preview: DamPressurePreview,
  },
  {
    id: "jet-impact",
    title: "แรงกระแทกของลำน้ำ",
    titleEn: "Water Jet Impact",
    tagline: "แรงจากการเปลี่ยนโมเมนตัมของลำน้ำที่ชนแผ่น",
    icon: "💥",
    accent: "from-rose-400 to-orange-600",
    formula: "F = ρQV",
    status: "ready",
    Sim: JetImpactSim,
    Preview: JetImpactPreview,
  },
  {
    id: "pipe-bend",
    title: "แรงบนข้องอท่อ",
    titleEn: "Pipe Bend Force",
    tagline: "แรงบนข้องอจากโมเมนตัมและความดันของของไหล",
    icon: "🔧",
    accent: "from-amber-400 to-rose-600",
    formula: "F = (PA+ρQV)·f(θ)",
    status: "ready",
    Sim: PipeBendSim,
    Preview: PipeBendPreview,
  },
  {
    id: "moody",
    title: "แผนภูมิมูดี้",
    titleEn: "Moody Chart",
    tagline: "friction factor จาก Reynolds number และความขรุขระ",
    icon: "📊",
    accent: "from-teal-400 to-emerald-600",
    formula: "f = f(Re, ε/D)",
    status: "ready",
    Sim: MoodySim,
    Preview: MoodyPreview,
  },
  {
    id: "pump-curve",
    title: "เส้นโค้งปั๊มและระบบ",
    titleEn: "Pump & System Curve",
    tagline: "หา operating point จาก pump curve และ system curve",
    icon: "⚙️",
    accent: "from-sky-400 to-indigo-600",
    formula: "H₀−aQ² = H_s+CQ²",
    status: "ready",
    Sim: PumpCurveSim,
    Preview: PumpCurvePreview,
  },
  {
    id: "viscosity-race",
    title: "แข่งความหนืด",
    titleEn: "Viscosity Flow Race",
    tagline: "ของไหลหนืดมากไหลช้ากว่า — แข่งกันไหลลงรางเอียง",
    icon: "🍯",
    accent: "from-amber-400 to-yellow-600",
    formula: "v ∝ ρg·sinθ/μ",
    status: "ready",
    Sim: ViscosityRaceSim,
    Preview: ViscosityRacePreview,
  },
  {
    id: "capillary",
    title: "แรงตึงผิว & หลอดเล็ก",
    titleEn: "Surface Tension & Capillary",
    tagline: "น้ำไต่ขึ้นหลอดเล็กจากแรงตึงผิว ยิ่งเล็กยิ่งสูง",
    icon: "💧",
    accent: "from-sky-400 to-cyan-600",
    formula: "h = 2σcosθ/(ρgr)",
    status: "ready",
    Sim: CapillarySim,
    Preview: CapillaryPreview,
  },
  {
    id: "streamlines",
    title: "Streamline · Pathline · Streakline",
    titleEn: "Flow Lines Comparator",
    tagline: "ความต่างของเส้นการไหล 3 แบบในการไหลไม่คงตัว",
    icon: "🧭",
    accent: "from-indigo-400 to-violet-600",
    formula: "tangent · trajectory · dye",
    status: "ready",
    Sim: StreamlinesSim,
    Preview: StreamlinesPreview,
  },
  {
    id: "rotational",
    title: "Rotational vs Irrotational",
    titleEn: "Vorticity & Paddle Wheels",
    tagline: "ใบพัดหมุน = rotational, ไม่หมุน = irrotational",
    icon: "🔄",
    accent: "from-fuchsia-400 to-purple-600",
    formula: "ω = ∂v/∂x − ∂u/∂y",
    status: "ready",
    Sim: RotationalSim,
    Preview: RotationalPreview,
  },
  {
    id: "open-channel",
    title: "การไหลในรางเปิด",
    titleEn: "Open Channel Flow",
    tagline: "Manning equation และ Froude number ในรางเปิด",
    icon: "🌊",
    accent: "from-teal-400 to-cyan-600",
    formula: "V = (1/n)R^⅔√S",
    status: "ready",
    Sim: OpenChannelSim,
    Preview: OpenChannelPreview,
  },
  {
    id: "hydraulic-jump",
    title: "การกระโดดของน้ำ",
    titleEn: "Hydraulic Jump",
    tagline: "น้ำเร็วตื้น → ลึกช้า พร้อมการสลายพลังงาน",
    icon: "💦",
    accent: "from-blue-400 to-indigo-600",
    formula: "y₂/y₁ = ½(√(1+8Fr₁²)−1)",
    status: "ready",
    Sim: HydraulicJumpSim,
    Preview: HydraulicJumpPreview,
  },
  {
    id: "mach",
    title: "เลขมัค",
    titleEn: "Mach Number",
    tagline: "subsonic → supersonic และกรวยมัค (Mach cone)",
    icon: "🚀",
    accent: "from-rose-400 to-orange-600",
    formula: "M = V/a",
    status: "ready",
    Sim: MachSim,
    Preview: MachPreview,
  },
  {
    id: "flow-meter",
    title: "เครื่องวัดอัตราการไหล",
    titleEn: "Flow Meter Comparison",
    tagline: "เทียบ Pitot · Venturi · Orifice",
    icon: "📟",
    accent: "from-emerald-400 to-teal-600",
    formula: "Q = Cd·A₂√(2ΔP/ρ(1−β⁴))",
    status: "ready",
    Sim: FlowMeterSim,
    Preview: FlowMeterPreview,
  },
];

export const getSim = (id: string): SimMeta | undefined =>
  SIMULATIONS.find((s) => s.id === id);

export const READY_SIMS = SIMULATIONS.filter((s) => s.status === "ready");
