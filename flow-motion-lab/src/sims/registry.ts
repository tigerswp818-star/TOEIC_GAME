import type { SimMeta } from "@/types/simulation";

import ContinuitySim from "./continuity/ContinuitySim";
import ContinuityPreview from "./continuity/ContinuityPreview";
import PumpSystemCurveSim from "./pumpSystemCurve/PumpSystemCurveSim";
import PumpSystemCurvePreview from "./pumpSystemCurve/PumpSystemCurvePreview";
import VfdSpeedSim from "./vfdSpeed/VfdSpeedSim";
import VfdSpeedPreview from "./vfdSpeed/VfdSpeedPreview";
import CavitationSim from "./cavitation/CavitationSim";
import CavitationPreview from "./cavitation/CavitationPreview";
import EnergyCostSim from "./energyCost/EnergyCostSim";
import EnergyCostPreview from "./energyCost/EnergyCostPreview";
import WaterHammerSim from "./waterHammer/WaterHammerSim";
import WaterHammerPreview from "./waterHammer/WaterHammerPreview";
import TroubleshootingSim from "./troubleshooting/TroubleshootingSim";
import TroubleshootingPreview from "./troubleshooting/TroubleshootingPreview";
import MultiPumpSim from "./multiPump/MultiPumpSim";
import MultiPumpPreview from "./multiPump/MultiPumpPreview";
import MotorLoadSim from "./motorLoad/MotorLoadSim";
import MotorLoadPreview from "./motorLoad/MotorLoadPreview";
import MotorStartingSim from "./motorStarting/MotorStartingSim";
import MotorStartingPreview from "./motorStarting/MotorStartingPreview";
import VfdVsThrottleSim from "./vfdVsThrottle/VfdVsThrottleSim";
import VfdVsThrottlePreview from "./vfdVsThrottle/VfdVsThrottlePreview";
import PidPressureSim from "./pidPressure/PidPressureSim";
import PidPressurePreview from "./pidPressure/PidPressurePreview";
import CheckValveSlamSim from "./checkValveSlam/CheckValveSlamSim";
import CheckValveSlamPreview from "./checkValveSlam/CheckValveSlamPreview";
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
import NonNewtonianSim from "./nonNewtonian/NonNewtonianSim";
import NonNewtonianPreview from "./nonNewtonian/NonNewtonianPreview";
import PascalSim from "./pascal/PascalSim";
import PascalPreview from "./pascal/PascalPreview";
import FloatingStabilitySim from "./floatingStability/FloatingStabilitySim";
import FloatingStabilityPreview from "./floatingStability/FloatingStabilityPreview";
import ControlVolumeSim from "./controlVolume/ControlVolumeSim";
import ControlVolumePreview from "./controlVolume/ControlVolumePreview";
import PipeJunctionSim from "./pipeJunction/PipeJunctionSim";
import PipeJunctionPreview from "./pipeJunction/PipeJunctionPreview";
import EglHglSim from "./eglHgl/EglHglSim";
import EglHglPreview from "./eglHgl/EglHglPreview";
import BernoulliValiditySim from "./bernoulliValidity/BernoulliValiditySim";
import BernoulliValidityPreview from "./bernoulliValidity/BernoulliValidityPreview";
import NozzleReactionSim from "./nozzleReaction/NozzleReactionSim";
import NozzleReactionPreview from "./nozzleReaction/NozzleReactionPreview";
import VelocityFieldSim from "./velocityField/VelocityFieldSim";
import VelocityFieldPreview from "./velocityField/VelocityFieldPreview";
import DimensionCheckerSim from "./dimensionChecker/DimensionCheckerSim";
import DimensionCheckerPreview from "./dimensionChecker/DimensionCheckerPreview";
import DimensionlessSim from "./dimensionless/DimensionlessSim";
import DimensionlessPreview from "./dimensionless/DimensionlessPreview";
import SimilaritySim from "./similarity/SimilaritySim";
import SimilarityPreview from "./similarity/SimilarityPreview";
import LaminarProfileSim from "./laminarProfile/LaminarProfileSim";
import LaminarProfilePreview from "./laminarProfile/LaminarProfilePreview";
import TurbulentProfileSim from "./turbulentProfile/TurbulentProfileSim";
import TurbulentProfilePreview from "./turbulentProfile/TurbulentProfilePreview";
import PipeNetworkSim from "./pipeNetwork/PipeNetworkSim";
import PipeNetworkPreview from "./pipeNetwork/PipeNetworkPreview";
import AffinitySim from "./affinity/AffinitySim";
import AffinityPreview from "./affinity/AffinityPreview";
import NpshSim from "./npsh/NpshSim";
import NpshPreview from "./npsh/NpshPreview";
import FroudeSim from "./froude/FroudeSim";
import FroudePreview from "./froude/FroudePreview";
import WeirSim from "./weir/WeirSim";
import WeirPreview from "./weir/WeirPreview";
import BoundaryLayerSim from "./boundaryLayer/BoundaryLayerSim";
import BoundaryLayerPreview from "./boundaryLayer/BoundaryLayerPreview";
import FlowSeparationSim from "./flowSeparation/FlowSeparationSim";
import FlowSeparationPreview from "./flowSeparation/FlowSeparationPreview";
import AirfoilSim from "./airfoil/AirfoilSim";
import AirfoilPreview from "./airfoil/AirfoilPreview";
import ForcedFreeVortexSim from "./forcedFreeVortex/ForcedFreeVortexSim";
import ForcedFreeVortexPreview from "./forcedFreeVortex/ForcedFreeVortexPreview";
import CirculationSim from "./circulation/CirculationSim";
import CirculationPreview from "./circulation/CirculationPreview";
import CdNozzleSim from "./cdNozzle/CdNozzleSim";
import CdNozzlePreview from "./cdNozzle/CdNozzlePreview";
import CfdMeshSim from "./cfdMesh/CfdMeshSim";
import CfdMeshPreview from "./cfdMesh/CfdMeshPreview";

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
    id: "pump-system-curve",
    title: "กราฟปั๊มและกราฟระบบ",
    titleEn: "Pump Curve vs System Curve",
    tagline: "หาจุดทำงาน (Operating Point) เทียบ VFD กับการหรี่วาล์ว และ BEP",
    icon: "📈",
    accent: "from-cyan-400 to-violet-600",
    formula: "H_pump(Q) = H_system(Q)",
    status: "ready",
    Sim: PumpSystemCurveSim,
    Preview: PumpSystemCurvePreview,
  },
  {
    id: "vfd-speed",
    title: "ควบคุมรอบด้วย VFD",
    titleEn: "VFD Speed Control",
    tagline: "ปรับความถี่ → รอบ/flow/กำลัง ตาม affinity และเทียบการประหยัดกับหรี่วาล์ว",
    icon: "🎛️",
    accent: "from-emerald-400 to-cyan-600",
    formula: "P ∝ N³",
    status: "ready",
    Sim: VfdSpeedSim,
    Preview: VfdSpeedPreview,
  },
  {
    id: "cavitation",
    title: "ความเสี่ยง Cavitation",
    titleEn: "Cavitation Risk (NPSH)",
    tagline: "NPSHa vs NPSHr — ฟองไอที่ทำลายใบพัด ปรับอุณหภูมิ/ความสูงดูด",
    icon: "🫧",
    accent: "from-sky-400 to-rose-500",
    formula: "NPSHa > NPSHr",
    status: "ready",
    Sim: CavitationSim,
    Preview: CavitationPreview,
  },
  {
    id: "energy-cost",
    title: "พลังงานและค่าไฟสถานี",
    titleEn: "Energy Cost Calculator",
    tagline: "kWh/m³ ค่าไฟ/เดือน และประสิทธิภาพรวมของสถานีสูบน้ำ",
    icon: "⚡",
    accent: "from-amber-400 to-emerald-500",
    formula: "kWh/m³ = Pin / Q",
    status: "ready",
    Sim: EnergyCostSim,
    Preview: EnergyCostPreview,
  },
  {
    id: "water-hammer",
    title: "ค้อนน้ำ Water Hammer",
    titleEn: "Water Hammer",
    tagline: "แรงดันกระชากจากการปิดวาล์วเร็ว (Joukowsky) + คลื่นวิ่งย้อนกลับ",
    icon: "🔨",
    accent: "from-rose-400 to-orange-500",
    formula: "ΔP = ρ a ΔV",
    status: "ready",
    Sim: WaterHammerSim,
    Preview: WaterHammerPreview,
  },
  {
    id: "troubleshooting",
    title: "วิเคราะห์ปัญหาปั๊ม",
    titleEn: "Pump Troubleshooting",
    tagline: "เลือกอาการ → สาเหตุที่เป็นไปได้ + การตรวจสอบเบื้องต้นที่ปลอดภัย",
    icon: "🔧",
    accent: "from-slate-400 to-cyan-600",
    formula: "อาการ → สาเหตุ → ตรวจสอบ",
    status: "ready",
    Sim: TroubleshootingSim,
    Preview: TroubleshootingPreview,
  },
  {
    id: "multi-pump",
    title: "จัดปั๊มหลายตัว",
    titleEn: "Multi-Pump Optimizer",
    tagline: "เดินปั๊มกี่ตัวให้ใกล้ BEP ประหยัดสุด · duty/assist/standby + VFD",
    icon: "🔢",
    accent: "from-teal-400 to-indigo-600",
    formula: "เดินใกล้ BEP = ประหยัด",
    status: "ready",
    Sim: MultiPumpSim,
    Preview: MultiPumpPreview,
  },
  {
    id: "motor-load",
    title: "โหลดมอเตอร์ไฟฟ้า",
    titleEn: "Motor Load",
    tagline: "กำลังไฟฟ้า/กล ความเร็ว แรงบิด สลิป และ overload (P=√3VI·PF)",
    icon: "🔌",
    accent: "from-cyan-400 to-teal-600",
    formula: "P = √3 V I PF η",
    status: "ready",
    Sim: MotorLoadSim,
    Preview: MotorLoadPreview,
  },
  {
    id: "motor-starting",
    title: "การสตาร์ทมอเตอร์",
    titleEn: "Motor Starting Comparison",
    tagline: "เทียบ DOL / Star-Delta / Soft Starter / VFD — กระแสและแรงบิดสตาร์ท",
    icon: "🚦",
    accent: "from-amber-400 to-rose-500",
    formula: "I_start: DOL≫VFD",
    status: "ready",
    Sim: MotorStartingSim,
    Preview: MotorStartingPreview,
  },
  {
    id: "vfd-vs-throttle",
    title: "VFD เทียบหรี่วาล์ว",
    titleEn: "VFD vs Throttling",
    tagline: "ลด flow สองวิธี เทียบพลังงานและค่าไฟ/เดือน",
    icon: "⚖️",
    accent: "from-emerald-400 to-rose-500",
    formula: "VFD ประหยัดกว่า",
    status: "ready",
    Sim: VfdVsThrottleSim,
    Preview: VfdVsThrottlePreview,
  },
  {
    id: "pid-pressure",
    title: "ควบคุมแรงดันด้วย PID",
    titleEn: "PID Pressure Control",
    tagline: "เซนเซอร์ + VFD รักษาแรงดันปลายทาง — จูน Kp/Ki ดู overshoot",
    icon: "🎯",
    accent: "from-cyan-400 to-amber-500",
    formula: "PID → VFD → P",
    status: "ready",
    Sim: PidPressureSim,
    Preview: PidPressurePreview,
  },
  {
    id: "check-valve-slam",
    title: "Check Valve Slam",
    titleEn: "Check Valve Slam",
    tagline: "วาล์วกันกลับกระแทกเมื่อปั๊มหยุด — แรงดันพุ่ง ΔP=ρaΔV",
    icon: "🚪",
    accent: "from-rose-400 to-amber-500",
    formula: "ΔP = ρ a ΔV",
    status: "ready",
    Sim: CheckValveSlamSim,
    Preview: CheckValveSlamPreview,
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
  {
    id: "non-newtonian",
    title: "Newtonian vs Non-Newtonian",
    titleEn: "Non-Newtonian Fluids",
    tagline: "ความหนืดเปลี่ยนตาม shear rate — น้ำ ซอส แป้งข้าวโพด",
    icon: "🥫",
    accent: "from-amber-400 to-orange-600",
    formula: "τ = τ₀ + K·γ̇ⁿ",
    status: "ready",
    Sim: NonNewtonianSim,
    Preview: NonNewtonianPreview,
  },
  {
    id: "pascal",
    title: "แม่แรงไฮดรอลิก",
    titleEn: "Pascal's Hydraulic Press",
    tagline: "กฎปาสคาล — แรงเล็กยกของหนักด้วยพื้นที่ลูกสูบ",
    icon: "🛠️",
    accent: "from-slate-400 to-blue-700",
    formula: "F₂ = F₁·A₂/A₁",
    status: "ready",
    Sim: PascalSim,
    Preview: PascalPreview,
  },
  {
    id: "floating-stability",
    title: "เสถียรภาพการลอย",
    titleEn: "Floating Stability & Metacenter",
    tagline: "เรือเสถียรหรือพลิกคว่ำ — G, B และ metacenter",
    icon: "⛵",
    accent: "from-cyan-400 to-blue-600",
    formula: "GM = KB + BM − KG",
    status: "ready",
    Sim: FloatingStabilitySim,
    Preview: FloatingStabilityPreview,
  },
  {
    id: "control-volume",
    title: "สมดุลมวล Control Volume",
    titleEn: "Control Volume Mass Balance",
    tagline: "inflow vs outflow → ของไหลสะสมหรือคงที่",
    icon: "📦",
    accent: "from-teal-400 to-cyan-600",
    formula: "dV/dt = ΣQin − ΣQout",
    status: "ready",
    Sim: ControlVolumeSim,
    Preview: ControlVolumePreview,
  },
  {
    id: "pipe-junction",
    title: "ท่อแยก",
    titleEn: "Pipe Junction",
    tagline: "Q_in = Q_out1 + Q_out2 — สมดุลมวลที่จุดแยก",
    icon: "🔱",
    accent: "from-sky-400 to-indigo-600",
    formula: "Q_in = ΣQ_out",
    status: "ready",
    Sim: PipeJunctionSim,
    Preview: PipeJunctionPreview,
  },
  {
    id: "egl-hgl",
    title: "เส้นพลังงาน EGL & HGL",
    titleEn: "Energy & Hydraulic Grade Lines",
    tagline: "ปั๊มเติม กังหัน/แรงเสียดทานดึงพลังงานออก",
    icon: "📈",
    accent: "from-emerald-400 to-teal-600",
    formula: "EGL = P/ρg + V²/2g + z",
    status: "ready",
    Sim: EglHglSim,
    Preview: EglHglPreview,
  },
  {
    id: "bernoulli-validity",
    title: "เช็คเงื่อนไขเบอร์นูลลี",
    titleEn: "Bernoulli Validity Checker",
    tagline: "ใช้เบอร์นูลลีได้ไหม? เช็ก 4 สมมติฐาน",
    icon: "✅",
    accent: "from-lime-400 to-emerald-600",
    formula: "steady·incompressible·inviscid·streamline",
    status: "ready",
    Sim: BernoulliValiditySim,
    Preview: BernoulliValidityPreview,
  },
  {
    id: "nozzle",
    title: "แรงปฏิกิริยาหัวฉีด",
    titleEn: "Nozzle Reaction Force",
    tagline: "หัวฉีดเร่งน้ำ → แรงดันถอยหลัง (เหมือนสายดับเพลิง)",
    icon: "🚿",
    accent: "from-rose-400 to-orange-600",
    formula: "R = ρQ(V₂−V₁) + P₁A₁",
    status: "ready",
    Sim: NozzleReactionSim,
    Preview: NozzleReactionPreview,
  },
  {
    id: "velocity-field",
    title: "สนามความเร็ว",
    titleEn: "Velocity Field Explorer",
    tagline: "uniform · source · sink · vortex — เวกเตอร์และ streamline",
    icon: "🧮",
    accent: "from-indigo-400 to-violet-600",
    formula: "v(x,y) field",
    status: "ready",
    Sim: VelocityFieldSim,
    Preview: VelocityFieldPreview,
  },
  {
    id: "dimension-checker",
    title: "ตรวจสอบมิติ",
    titleEn: "Dimensional Homogeneity Checker",
    tagline: "สมการสมดุลมิติไหม? เครื่องชั่งมิติ [M L T]",
    icon: "⚖️",
    accent: "from-slate-400 to-indigo-600",
    formula: "[M^a L^b T^c] LHS = RHS",
    status: "ready",
    Sim: DimensionCheckerSim,
    Preview: DimensionCheckerPreview,
  },
  {
    id: "dimensionless",
    title: "ตัวเลขไร้มิติ",
    titleEn: "Dimensionless Number Explorer",
    tagline: "Re · Fr · Ma · We — เลือกสถานการณ์ เห็นตัวเลขที่สำคัญ",
    icon: "🔢",
    accent: "from-cyan-400 to-blue-600",
    formula: "Re · Fr · Ma · We",
    status: "ready",
    Sim: DimensionlessSim,
    Preview: DimensionlessPreview,
  },
  {
    id: "similarity",
    title: "แบบจำลองกับของจริง",
    titleEn: "Model & Prototype Similarity",
    tagline: "รักษา Re หรือ Fr ให้เท่ากันระหว่าง model กับ prototype",
    icon: "🚢",
    accent: "from-sky-400 to-teal-600",
    formula: "Re_m = Re_p / Fr_m = Fr_p",
    status: "ready",
    Sim: SimilaritySim,
    Preview: SimilarityPreview,
  },
  {
    id: "laminar-profile",
    title: "หน้าตัดความเร็ว Laminar",
    titleEn: "Laminar Velocity Profile",
    tagline: "พาราโบลา u(r)=u_max(1−(r/R)²) — no-slip ที่ผนัง",
    icon: "🩸",
    accent: "from-rose-400 to-red-600",
    formula: "u = u_max(1−(r/R)²)",
    status: "ready",
    Sim: LaminarProfileSim,
    Preview: LaminarProfilePreview,
  },
  {
    id: "turbulent-profile",
    title: "หน้าตัดความเร็ว Turbulent",
    titleEn: "Turbulent Velocity Profile",
    tagline: "หน้าตัดแบนกว่า laminar (กฎ 1/7) — เทียบกันได้",
    icon: "🌫️",
    accent: "from-fuchsia-400 to-rose-600",
    formula: "u = u_max(1−r/R)^(1/n)",
    status: "ready",
    Sim: TurbulentProfileSim,
    Preview: TurbulentProfilePreview,
  },
  {
    id: "pipe-network",
    title: "ท่ออนุกรม & ขนาน",
    titleEn: "Pipes in Series & Parallel",
    tagline: "อนุกรมบวก head loss · ขนานแยก flow ลดการสูญเสีย",
    icon: "🛢️",
    accent: "from-orange-400 to-amber-600",
    formula: "series: Σhf · parallel: Σering Q",
    status: "ready",
    Sim: PipeNetworkSim,
    Preview: PipeNetworkPreview,
  },
  {
    id: "affinity",
    title: "กฎสัดส่วนปั๊ม",
    titleEn: "Pump Affinity Laws",
    tagline: "Q∝N · H∝N² · Power∝N³ เมื่อเปลี่ยนรอบปั๊ม",
    icon: "🔁",
    accent: "from-sky-400 to-indigo-600",
    formula: "Q∝N, H∝N², P∝N³",
    status: "ready",
    Sim: AffinitySim,
    Preview: AffinityPreview,
  },
  {
    id: "npsh",
    title: "Cavitation & NPSH",
    titleEn: "Cavitation & NPSH",
    tagline: "ความดันต่ำกว่าความดันไอ → ฟองไอในปั๊ม",
    icon: "🫧",
    accent: "from-violet-400 to-blue-600",
    formula: "NPSH_a = (P_atm+P_s−P_v)/ρg − z − h_L",
    status: "ready",
    Sim: NpshSim,
    Preview: NpshPreview,
  },
  {
    id: "froude",
    title: "เลขฟรูด",
    titleEn: "Froude Number",
    tagline: "subcritical/critical/supercritical — คลื่นผิวน้ำ",
    icon: "🌊",
    accent: "from-cyan-400 to-teal-600",
    formula: "Fr = V/√(gy)",
    status: "ready",
    Sim: FroudeSim,
    Preview: FroudePreview,
  },
  {
    id: "weir",
    title: "ฝายน้ำล้น",
    titleEn: "Weir Flow Measurement",
    tagline: "วัดอัตราการไหลจากหัวน้ำเหนือสันฝาย",
    icon: "⛲",
    accent: "from-blue-400 to-cyan-600",
    formula: "Q = Cd·(2/3)√(2g)·b·H^1.5",
    status: "ready",
    Sim: WeirSim,
    Preview: WeirPreview,
  },
  {
    id: "boundary-layer",
    title: "ชั้นขอบเขตบนแผ่นเรียบ",
    titleEn: "Flat Plate Boundary Layer",
    tagline: "no-slip + ชั้นขอบเขตหนาขึ้นตามระยะ x",
    icon: "📏",
    accent: "from-emerald-400 to-teal-600",
    formula: "δ = 5x/√(Re_x)",
    status: "ready",
    Sim: BoundaryLayerSim,
    Preview: BoundaryLayerPreview,
  },
  {
    id: "flow-separation",
    title: "การแยกตัวของการไหล",
    titleEn: "Flow Separation & Vortex Shedding",
    tagline: "separation point, wake และ Kármán vortex street",
    icon: "🍥",
    accent: "from-fuchsia-400 to-rose-600",
    formula: "adverse ∂p/∂x → separation",
    status: "ready",
    Sim: FlowSeparationSim,
    Preview: FlowSeparationPreview,
  },
  {
    id: "airfoil",
    title: "แรงยกของปีก",
    titleEn: "Airfoil Lift Concept",
    tagline: "ความดันบน-ล่างต่างกัน → lift และ stall",
    icon: "🛩️",
    accent: "from-sky-400 to-indigo-600",
    formula: "F_L = ½ρV²C_L·A",
    status: "ready",
    Sim: AirfoilSim,
    Preview: AirfoilPreview,
  },
  {
    id: "forced-free-vortex",
    title: "Forced vs Free Vortex",
    titleEn: "Forced & Free Vortex",
    tagline: "solid-body (vθ=ωr) เทียบ free (vθ=C/r) + ผิวน้ำ",
    icon: "🌀",
    accent: "from-violet-400 to-fuchsia-600",
    formula: "vθ = ωr  ·  vθ = C/r",
    status: "ready",
    Sim: ForcedFreeVortexSim,
    Preview: ForcedFreeVortexPreview,
  },
  {
    id: "circulation",
    title: "Circulation รอบเส้นปิด",
    titleEn: "Circulation Visualizer",
    tagline: "Γ = ∮V·dl รอบเส้นปิดในสนาม vortex",
    icon: "♻️",
    accent: "from-purple-400 to-violet-600",
    formula: "Γ = ∮ V·dl",
    status: "ready",
    Sim: CirculationSim,
    Preview: CirculationPreview,
  },
  {
    id: "cd-nozzle",
    title: "หัวฉีดลู่เข้า-บานออก",
    titleEn: "Converging–Diverging Nozzle",
    tagline: "เร่งถึง M=1 ที่คอคอด แล้ว supersonic (choked)",
    icon: "🚀",
    accent: "from-rose-400 to-orange-600",
    formula: "M=1 at throat (choked)",
    status: "ready",
    Sim: CdNozzleSim,
    Preview: CdNozzlePreview,
  },
  {
    id: "cfd-mesh",
    title: "แนวคิด Mesh ของ CFD",
    titleEn: "CFD Mesh Concept",
    tagline: "mesh ละเอียด = แม่นกว่า แต่ใช้ compute มากกว่า",
    icon: "🖥️",
    accent: "from-slate-400 to-cyan-600",
    formula: "cells ∝ N² (cost ∝ cells)",
    status: "ready",
    Sim: CfdMeshSim,
    Preview: CfdMeshPreview,
  },
];

export const getSim = (id: string): SimMeta | undefined =>
  SIMULATIONS.find((s) => s.id === id);

export const READY_SIMS = SIMULATIONS.filter((s) => s.status === "ready");
