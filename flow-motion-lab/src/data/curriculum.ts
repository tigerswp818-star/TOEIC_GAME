/** Curriculum model: levels, learning paths and the 15-chapter structure. */

export type Level = "basic" | "intermediate" | "advanced";

export const LEVELS: Record<Level, { label: string; labelEn: string; color: string }> = {
  basic: { label: "พื้นฐาน", labelEn: "Basic", color: "from-emerald-400 to-teal-600" },
  intermediate: { label: "วิศวกรรม", labelEn: "Intermediate", color: "from-sky-400 to-indigo-600" },
  advanced: { label: "ขั้นสูง", labelEn: "Advanced", color: "from-fuchsia-400 to-rose-600" },
};

export interface Chapter {
  id: string;
  number: number;
  title: string;
  titleEn: string;
  level: Level;
  icon: string;
  summary: string;
  objectives: string[];
  topics: string[];
  /** Registry sim ids that belong to this chapter (built or planned). */
  simIds: string[];
  /** Sim ids/labels that are planned but not built yet (shown as coming soon). */
  planned?: string[];
}

export interface LearningPath {
  id: string;
  title: string;
  titleEn: string;
  icon: string;
  blurb: string;
  chapterIds: string[];
}

export const CHAPTERS: Chapter[] = [
  {
    id: "ch1",
    number: 1,
    title: "คุณสมบัติของของไหล",
    titleEn: "Fluid Properties",
    level: "basic",
    icon: "💧",
    summary: "ความหนาแน่น ความหนืด แรงตึงผิว และพฤติกรรมพื้นฐานของของไหล",
    objectives: [
      "เข้าใจความหนาแน่น (Density) น้ำหนักจำเพาะ (Specific weight) และความถ่วงจำเพาะ (Specific gravity)",
      "แยกความหนืดไดนามิก (Dynamic viscosity) กับความหนืดจลน์ (Kinematic viscosity)",
      "เปรียบเทียบของไหลแบบ Newtonian และ Non-Newtonian",
      "อธิบายแรงตึงผิว (Surface tension) การซึมในหลอดเล็ก (Capillary) และ Cavitation",
    ],
    topics: [
      "Density", "Specific weight", "Specific gravity", "Dynamic viscosity",
      "Kinematic viscosity", "Newtonian fluid", "Non-Newtonian fluid",
      "Surface tension", "Capillary action", "Vapor pressure", "Cavitation",
    ],
    simIds: [],
    planned: ["Viscosity Flow Race", "Newtonian vs Non-Newtonian", "Surface Tension & Capillary"],
  },
  {
    id: "ch2",
    number: 2,
    title: "ของไหลสถิต",
    titleEn: "Fluid Statics",
    level: "basic",
    icon: "🛑",
    summary: "ความดันในของไหลที่อยู่นิ่ง แรงบนผนัง แรงลอยตัวและเสถียรภาพ",
    objectives: [
      "ใช้ P = ρgh หาความดันตามความลึก และเข้าใจกฎของปาสคาล (Pascal's Law)",
      "อ่านมาโนมิเตอร์ (Manometer) และหาความดันต่าง",
      "หาแรงรวมและจุดศูนย์กลางแรงดัน (Center of pressure) บนผนัง/ประตูน้ำ",
      "วิเคราะห์แรงลอยตัว (Buoyancy) และเสถียรภาพการลอย (Metacenter เบื้องต้น)",
    ],
    topics: [
      "Pressure at a point", "Pascal's Law", "Hydrostatic pressure", "Manometer",
      "Force on plane surface", "Center of pressure", "Force on curved surface",
      "Buoyancy", "Stability", "Metacenter",
    ],
    simIds: ["hydrostatic", "buoyancy", "manometer", "dam-pressure"],
    planned: ["Pascal's Hydraulic Press", "Floating Stability"],
  },
  {
    id: "ch3",
    number: 3,
    title: "จลนศาสตร์ของของไหล",
    titleEn: "Fluid Kinematics",
    level: "intermediate",
    icon: "🧭",
    summary: "การอธิบายการเคลื่อนที่ของของไหล: streamline, pathline, streakline และ vorticity",
    objectives: [
      "แยกมุมมอง Eulerian กับ Lagrangian",
      "แยก Streamline / Pathline / Streakline",
      "อธิบายสนามความเร็ว (Velocity field) และความเร่ง",
      "แยกการไหลแบบ Rotational / Irrotational และความหมายของ Vorticity",
    ],
    topics: [
      "Eulerian", "Lagrangian", "Streamline", "Streakline", "Pathline",
      "Velocity field", "Steady/Unsteady", "Uniform/Non-uniform",
      "Rotational/Irrotational", "Vorticity",
    ],
    simIds: [],
    planned: ["Streamline/Streakline/Pathline", "Velocity Field", "Rotational vs Irrotational"],
  },
  {
    id: "ch4",
    number: 4,
    title: "การอนุรักษ์มวล & ความต่อเนื่อง",
    titleEn: "Conservation of Mass & Continuity",
    level: "basic",
    icon: "🚰",
    summary: "อัตราการไหลคงที่ในระบบ และความสัมพันธ์พื้นที่–ความเร็ว",
    objectives: [
      "ใช้สมการความต่อเนื่อง A₁V₁ = A₂V₂",
      "เข้าใจ control volume และการอนุรักษ์มวล",
      "วิเคราะห์ท่อแยก (branching) ด้วยสมดุลมวล",
    ],
    topics: ["Conservation of mass", "Control volume", "1D continuity", "Branching pipe flow"],
    simIds: ["continuity"],
    planned: ["Control Volume Mass Balance", "Pipe Junction"],
  },
  {
    id: "ch5",
    number: 5,
    title: "สมการพลังงาน & เบอร์นูลลี",
    titleEn: "Energy Equation & Bernoulli",
    level: "basic",
    icon: "🌬️",
    summary: "ความสัมพันธ์ความดัน–ความเร็ว–ความสูง และพลังงานในการไหล",
    objectives: [
      "ใช้สมการเบอร์นูลลีและเข้าใจ assumptions",
      "แยก pressure head / velocity head / elevation head / total head",
      "เข้าใจ HGL, EGL, pump head, turbine head และ head loss",
    ],
    topics: [
      "Bernoulli", "Pressure head", "Velocity head", "Elevation head", "Total head",
      "HGL", "EGL", "Pump head", "Turbine head", "Extended Bernoulli",
    ],
    simIds: ["bernoulli"],
    planned: ["EGL / HGL Simulator", "Bernoulli Validity Checker"],
  },
  {
    id: "ch6",
    number: 6,
    title: "สมการโมเมนตัม",
    titleEn: "Momentum Equation",
    level: "intermediate",
    icon: "💥",
    summary: "แรงจากการเปลี่ยนโมเมนตัมของของไหล: ลำน้ำกระแทก ข้องอ และหัวฉีด",
    objectives: [
      "ใช้สมการโมเมนตัมเชิงเส้นกับ control volume",
      "หาแรงกระแทกของลำน้ำ (Jet impact)",
      "หาแรงบนข้องอ (Pipe bend) และแรงปฏิกิริยาของหัวฉีด (Nozzle reaction)",
    ],
    topics: [
      "Linear momentum", "Control volume momentum", "Jet impact",
      "Force on nozzle", "Force on pipe bend", "Reaction force", "Momentum flux",
    ],
    simIds: ["jet-impact", "pipe-bend"],
    planned: ["Nozzle Reaction"],
  },
  {
    id: "ch7",
    number: 7,
    title: "การวิเคราะห์มิติ & ความคล้ายคลึง",
    titleEn: "Dimensional Analysis & Similarity",
    level: "intermediate",
    icon: "📐",
    summary: "ตัวเลขไร้มิติ และความคล้ายคลึงระหว่างแบบจำลองกับของจริง",
    objectives: [
      "ตรวจสอบความสอดคล้องของมิติ (Dimensional homogeneity)",
      "เข้าใจ Buckingham Pi และตัวเลขไร้มิติ (Re, Fr, Ma, We, Eu)",
      "เข้าใจความคล้ายคลึงเชิงเรขาคณิต/จลนศาสตร์/พลศาสตร์ ของ model–prototype",
    ],
    topics: [
      "Dimensional homogeneity", "Buckingham Pi", "Model & prototype",
      "Geometric/Kinematic/Dynamic similarity", "Reynolds", "Froude", "Mach", "Weber", "Euler",
    ],
    simIds: [],
    planned: ["Dimension Checker", "Dimensionless Number Explorer", "Model–Prototype Similarity"],
  },
  {
    id: "ch8",
    number: 8,
    title: "การไหลภายในท่อ",
    titleEn: "Internal Flow in Pipes",
    level: "intermediate",
    icon: "🧪",
    summary: "Laminar/Turbulent, friction factor, Moody chart และการสูญเสียในท่อ",
    objectives: [
      "ใช้ Reynolds number แยก Laminar/Turbulent",
      "หา head loss ด้วย Darcy–Weisbach และอ่าน Moody chart",
      "วิเคราะห์ minor loss และท่ออนุกรม/ขนานเบื้องต้น",
    ],
    topics: [
      "Laminar pipe flow", "Hagen–Poiseuille", "Turbulent pipe flow", "Darcy–Weisbach",
      "Friction factor", "Moody chart", "Relative roughness", "Minor losses",
      "Pipes in series/parallel", "Equivalent length",
    ],
    simIds: ["reynolds", "headloss", "moody"],
    planned: ["Laminar Velocity Profile", "Turbulent Velocity Profile", "Series & Parallel Pipes"],
  },
  {
    id: "ch9",
    number: 9,
    title: "ปั๊มและกังหัน",
    titleEn: "Pumps & Turbines",
    level: "intermediate",
    icon: "⚙️",
    summary: "pump curve, system curve, operating point, affinity laws และ cavitation/NPSH",
    objectives: [
      "หา operating point จาก pump curve และ system curve",
      "ใช้ affinity laws (Q∝N, H∝N², P∝N³)",
      "เข้าใจ NPSH และความเสี่ยง cavitation",
    ],
    topics: [
      "Pump head", "Pump power", "Pump/System curve", "Operating point",
      "Affinity laws", "NPSH", "Cavitation", "Turbine head/power",
    ],
    simIds: ["pump-curve"],
    planned: ["Affinity Laws", "Cavitation & NPSH"],
  },
  {
    id: "ch10",
    number: 10,
    title: "การไหลในรางเปิด",
    titleEn: "Open Channel Flow",
    level: "advanced",
    icon: "🌊",
    summary: "Manning equation, Froude number, การไหลวิกฤต และ hydraulic jump",
    objectives: [
      "ใช้ Manning equation หาความเร็ว/อัตราการไหลในรางเปิด",
      "ใช้ Froude number แยก subcritical/critical/supercritical",
      "อธิบาย hydraulic jump และการสูญเสียพลังงาน",
    ],
    topics: [
      "Open channel vs pipe", "Flow depth", "Hydraulic radius", "Wetted perimeter",
      "Manning equation", "Froude number", "Subcritical/Critical/Supercritical",
      "Hydraulic jump", "Weir", "Flume",
    ],
    simIds: [],
    planned: ["Open Channel Flow", "Froude Number", "Hydraulic Jump"],
  },
  {
    id: "ch11",
    number: 11,
    title: "ชั้นขอบเขต & การไหลภายนอก",
    titleEn: "Boundary Layer & External Flow",
    level: "advanced",
    icon: "✈️",
    summary: "No-slip, boundary layer, การแยกตัวของการไหล, wake, drag และ lift",
    objectives: [
      "เข้าใจ no-slip condition และ boundary layer (laminar/turbulent)",
      "อธิบายการแยกตัวของการไหล (separation) wake และ drag",
      "เข้าใจแนวคิด lift บน airfoil เบื้องต้น",
    ],
    topics: [
      "No-slip", "Boundary layer thickness", "Laminar/Turbulent BL", "Separation",
      "Wake", "Drag", "Lift", "Pressure drag", "Skin friction", "Flow around cylinder/airfoil",
    ],
    simIds: ["flow-around"],
    planned: ["Flat Plate Boundary Layer", "Flow Separation", "Airfoil Lift Concept"],
  },
  {
    id: "ch12",
    number: 12,
    title: "การไหลหมุนวน",
    titleEn: "Vortex & Rotational Flow",
    level: "advanced",
    icon: "🌪️",
    summary: "forced vortex, free vortex, circulation และ vorticity",
    objectives: [
      "แยก forced vortex (หมุนเหมือน solid body) กับ free vortex",
      "เข้าใจ circulation และ vorticity",
      "เห็นรูปร่างผิวน้ำและการกระจายความเร็วของ vortex",
    ],
    topics: ["Forced vortex", "Free vortex", "Circulation", "Vorticity", "Rankine vortex"],
    simIds: ["vortex"],
    planned: ["Forced vs Free Vortex", "Circulation Visualizer"],
  },
  {
    id: "ch13",
    number: 13,
    title: "การไหลแบบอัดตัวได้ (เบื้องต้น)",
    titleEn: "Compressible Flow Basics",
    level: "advanced",
    icon: "🚀",
    summary: "Mach number, speed of sound, subsonic/supersonic และ nozzle เบื้องต้น",
    objectives: [
      "เข้าใจความต่างของ compressible กับ incompressible flow",
      "ใช้ Mach number แยก subsonic/sonic/supersonic",
      "เข้าใจ converging–diverging nozzle และ choked flow เบื้องต้น",
    ],
    topics: [
      "Compressible vs incompressible", "Mach number", "Speed of sound",
      "Subsonic/Sonic/Supersonic", "Choked flow", "C-D nozzle", "Shock wave",
    ],
    simIds: [],
    planned: ["Mach Number", "Nozzle Flow"],
  },
  {
    id: "ch14",
    number: 14,
    title: "CFD & การทดลอง",
    titleEn: "Computational & Experimental",
    level: "advanced",
    icon: "🖥️",
    summary: "แนวคิด CFD, mesh, boundary conditions และเครื่องมือวัดการไหล",
    objectives: [
      "เข้าใจว่า CFD คืออะไรและข้อจำกัด",
      "เข้าใจแนวคิด mesh และ boundary conditions",
      "เปรียบเทียบเครื่องมือวัด: Pitot, Venturi, Orifice",
    ],
    topics: [
      "What is CFD", "Mesh", "Boundary conditions", "Limitations",
      "Wind tunnel", "Flow visualization", "Pitot tube", "Venturi meter", "Orifice meter",
    ],
    simIds: [],
    planned: ["CFD Mesh Concept", "Flow Meter Comparison"],
  },
  {
    id: "ch15",
    number: 15,
    title: "การประยุกต์ใช้จริง",
    titleEn: "Real-World Engineering Applications",
    level: "intermediate",
    icon: "🌍",
    summary: "กรณีศึกษาวิศวกรรมจริงพร้อมภาพเคลื่อนไหวสั้น ๆ",
    objectives: [
      "เชื่อมโยงหลักการของไหลกับงานวิศวกรรมจริง",
      "เห็นการประยุกต์ในเขื่อน ประปา เรือ เครื่องบิน ปั๊ม คลองส่งน้ำ ฯลฯ",
    ],
    topics: [
      "เขื่อน/ประตูน้ำ", "ระบบประปา/ท่อส่งน้ำ", "หัวฉีดน้ำ", "เรือและเสถียรภาพ",
      "เครื่องบิน/airfoil", "ปั๊มน้ำ", "คลอง/ฝาย", "ท่อลม/ระบายอากาศ", "aerodynamics รถยนต์", "turbine",
    ],
    simIds: [],
  },
];

export const LEARNING_PATHS: LearningPath[] = [
  {
    id: "beginner",
    title: "เส้นทางผู้เริ่มต้น",
    titleEn: "Beginner Path",
    icon: "🌱",
    blurb: "ปูพื้นฐานคุณสมบัติของไหล ความดัน แรงลอยตัว ความต่อเนื่องและเบอร์นูลลี",
    chapterIds: ["ch1", "ch2", "ch4", "ch5"],
  },
  {
    id: "core",
    title: "แกนวิศวกรรม",
    titleEn: "Engineering Core",
    icon: "🧰",
    blurb: "จลนศาสตร์ ความต่อเนื่อง พลังงาน โมเมนตัม และการวิเคราะห์มิติ",
    chapterIds: ["ch3", "ch4", "ch5", "ch6", "ch7"],
  },
  {
    id: "pipe-pump",
    title: "ท่อและปั๊ม",
    titleEn: "Pipe & Pump",
    icon: "🛠️",
    blurb: "การไหลในท่อ friction Moody chart และระบบปั๊ม",
    chapterIds: ["ch8", "ch9"],
  },
  {
    id: "open-channel",
    title: "รางเปิด",
    titleEn: "Open Channel",
    icon: "🌊",
    blurb: "การไหลในรางเปิด Froude number และ hydraulic jump",
    chapterIds: ["ch10"],
  },
  {
    id: "aerodynamics",
    title: "อากาศพลศาสตร์",
    titleEn: "Aerodynamics",
    icon: "🛩️",
    blurb: "ชั้นขอบเขต การไหลภายนอก wake drag lift และ vortex",
    chapterIds: ["ch11", "ch12"],
  },
  {
    id: "advanced",
    title: "แนวคิดขั้นสูง",
    titleEn: "Advanced Concepts",
    icon: "🚀",
    blurb: "vortex การไหลอัดตัวได้ และ CFD/การทดลอง",
    chapterIds: ["ch12", "ch13", "ch14"],
  },
];

export const getChapter = (id: string): Chapter | undefined =>
  CHAPTERS.find((c) => c.id === id);

/** Chapter that contains a given simulation id. */
export const chapterOfSim = (simId: string): Chapter | undefined =>
  CHAPTERS.find((c) => c.simIds.includes(simId));
