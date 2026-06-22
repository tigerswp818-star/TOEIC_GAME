/** Curriculum model: levels, learning paths and the 15-chapter structure. */

export type Level = "basic" | "intermediate" | "advanced" | "pumpstation";

export const LEVELS: Record<Level, { label: string; labelEn: string; color: string }> = {
  basic: { label: "พื้นฐาน", labelEn: "Basic", color: "from-emerald-400 to-teal-600" },
  intermediate: { label: "วิศวกรรม", labelEn: "Intermediate", color: "from-sky-400 to-indigo-600" },
  advanced: { label: "ขั้นสูง", labelEn: "Advanced", color: "from-fuchsia-400 to-rose-600" },
  pumpstation: { label: "สถานีสูบจ่ายน้ำ", labelEn: "Pump Station", color: "from-cyan-400 to-violet-600" },
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
    simIds: ["viscosity-race", "capillary", "non-newtonian"],
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
    simIds: ["hydrostatic", "buoyancy", "manometer", "dam-pressure", "pascal", "floating-stability"],
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
    simIds: ["streamlines", "rotational", "velocity-field"],
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
    simIds: ["continuity", "control-volume", "pipe-junction"],
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
    simIds: ["bernoulli", "egl-hgl", "bernoulli-validity"],
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
    simIds: ["jet-impact", "pipe-bend", "nozzle"],
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
    simIds: ["dimension-checker", "dimensionless", "similarity"],
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
    simIds: ["reynolds", "headloss", "moody", "laminar-profile", "turbulent-profile", "pipe-network"],
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
    simIds: ["pump-curve", "affinity", "npsh"],
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
    simIds: ["open-channel", "hydraulic-jump", "froude", "weir"],
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
    simIds: ["flow-around", "boundary-layer", "flow-separation", "airfoil"],
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
    simIds: ["vortex", "forced-free-vortex", "circulation"],
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
    simIds: ["mach", "cd-nozzle"],
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
    simIds: ["flow-meter", "cfd-mesh"],
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

  // ══ หมวดสถานีสูบจ่ายน้ำ Pump Station (เชิงการเรียนรู้ — ไม่ใช่ระบบควบคุมจริง) ══
  {
    id: "ch16",
    number: 16,
    title: "ภาพรวมสถานีสูบจ่ายน้ำ",
    titleEn: "Pump Station Overview",
    level: "pumpstation",
    icon: "🏭",
    summary:
      "องค์ประกอบของสถานีสูบจ่ายน้ำตั้งแต่บ่อพักถึงโครงข่ายจ่ายน้ำ · ⚠️ เนื้อหาเชิงการเรียนรู้เท่านั้น งานไฟฟ้าแรงสูงและระบบสูบน้ำจริงต้องทำโดยวิศวกร/ช่างผู้ชำนาญ",
    objectives: [
      "รู้จักองค์ประกอบหลัก: บ่อพัก (Reservoir/Sump) ปั๊ม มอเตอร์ VFD วาล์ว ท่อ ถัง โครงข่ายจ่ายน้ำ",
      "เข้าใจเส้นทางน้ำจากบ่อพัก → ปั๊ม → ท่อส่ง → ถัง/โครงข่าย",
      "รู้บทบาทของ sensor (ความดัน/อัตราการไหล/ระดับน้ำ) และระบบ SCADA",
      "ตระหนักถึงความปลอดภัยของไฟฟ้า เครื่องจักรหมุน และระบบแรงดัน",
    ],
    topics: [
      "Reservoir/Sump", "Pump", "Electric motor", "VFD/Inverter", "Suction pipe", "Discharge pipe",
      "Check valve", "Gate/Butterfly valve", "Pressure sensor", "Flow meter", "Level sensor",
      "Control panel", "SCADA/Monitoring", "Storage/Elevated tank", "Distribution network",
    ],
    simIds: [],
  },
  {
    id: "ch17",
    number: 17,
    title: "หลักการทำงานของปั๊มน้ำ",
    titleEn: "Pump Fundamentals",
    level: "pumpstation",
    icon: "⚙️",
    summary: "ปั๊มหอยโข่งสร้างหัว (head) อย่างไร · Pump curve, System curve, จุดทำงาน, BEP, NPSH และ cavitation",
    objectives: [
      "อ่าน Pump curve และ System curve แล้วหาจุดทำงาน (Operating point)",
      "เข้าใจ Best Efficiency Point (BEP) และผลของการเดินห่างจาก BEP",
      "คำนวณกำลัง: Ph = ρgQH, Ps = Ph/η และ TDH",
      "เข้าใจ affinity laws (Q∝N, H∝N², P∝N³) และความเสี่ยง cavitation/NPSH",
    ],
    topics: [
      "Centrifugal pump", "Pump head", "Flow rate", "Pump curve", "System curve", "Operating point",
      "BEP", "Pump efficiency", "Shut-off head", "Run-out", "Pump power", "NPSH", "Cavitation", "Affinity laws",
    ],
    simIds: ["pump-system-curve", "cavitation"],
  },
  {
    id: "ch18",
    number: 18,
    title: "มอเตอร์ไฟฟ้าสำหรับปั๊ม",
    titleEn: "Electric Motor for Pump",
    level: "pumpstation",
    icon: "🔌",
    summary:
      "มอเตอร์เหนี่ยวนำขับปั๊มอย่างไร · ความเร็ว แรงบิด สลิป ประสิทธิภาพ และการป้องกัน · ⚠️ การตรวจ/ซ่อมระบบไฟฟ้าต้องทำโดยช่างหรือวิศวกรที่ได้รับอนุญาต ห้ามเปิดตู้ไฟเอง",
    objectives: [
      "เข้าใจความเร็วซิงโครนัส Ns = 120f/p และสลิป s = (Ns−Nr)/Ns",
      "คำนวณกำลังมอเตอร์ 3 เฟส P = √3 V I PF η และพลังงาน kWh",
      "เข้าใจโหลดมอเตอร์ที่เปลี่ยนตาม flow/head และอาการ overload",
      "รู้จักการป้องกัน: overload, phase loss, overheat, vibration เชิงแนวคิด",
    ],
    topics: [
      "Induction motor", "Synchronous motor", "Motor power", "Torque", "Speed", "Slip", "Efficiency",
      "Power factor", "Starting current", "Motor load", "Overload", "Phase loss", "Overheat", "Vibration",
    ],
    simIds: ["motor-load", "motor-starting"],
  },
  {
    id: "ch19",
    number: 19,
    title: "ไดร์ฟควบคุมรอบปั๊ม (VFD)",
    titleEn: "Variable Frequency Drive",
    level: "pumpstation",
    icon: "🎛️",
    summary: "VFD ปรับความถี่เพื่อคุมรอบมอเตอร์/ปั๊ม · ประหยัดพลังงานตาม affinity laws และคุมแรงดันด้วย PID",
    objectives: [
      "เข้าใจการคุมความเร็วด้วยความถี่และผลต่อ flow/head/power",
      "เห็นว่าทำไม VFD ประหยัดพลังงาน (P ∝ N³) เทียบกับการหรี่วาล์ว",
      "เข้าใจการคุมแรงดันปลายทางแบบ PID เบื้องต้น (ramp, overshoot)",
      "รู้จักการป้องกัน: dry-run, overcurrent, over/undervoltage เชิงแนวคิด",
    ],
    topics: [
      "Frequency control", "Motor speed control", "Affinity laws", "Energy saving", "PID pressure control",
      "Ramp up/down", "Min/Max speed", "Dry-run protection", "Overcurrent", "Over/Undervoltage", "Harmonics",
    ],
    simIds: ["vfd-speed", "pid-pressure"],
  },
  {
    id: "ch20",
    number: 20,
    title: "ประสิทธิภาพพลังงานสถานีสูบน้ำ",
    titleEn: "Pump Station Energy Efficiency",
    level: "pumpstation",
    icon: "⚡",
    summary: "วิเคราะห์พลังงาน kWh/m³ · ประสิทธิภาพรวม wire-to-water · การประหยัดด้วย VFD, ท่อ และการเดินปั๊มหลายตัว",
    objectives: [
      "คำนวณ kWh/m³ และค่าไฟจากกำลัง อัตราการไหล และค่าไฟต่อหน่วย",
      "เข้าใจประสิทธิภาพรวม η_total = η_pump × η_motor × η_drive",
      "เปรียบเทียบการประหยัดพลังงาน VFD เทียบกับการหรี่วาล์ว",
      "วางแผนเดินปั๊มหลายตัว (duty/standby) ให้ใกล้ BEP",
    ],
    topics: [
      "kWh", "kWh/m³", "Pump/Motor/Drive efficiency", "Overall efficiency", "Specific energy",
      "Energy cost", "Peak demand", "Duty/standby", "Multi-pump operation", "Energy saving",
    ],
    simIds: ["energy-cost", "multi-pump", "vfd-vs-throttle"],
  },
  {
    id: "ch21",
    number: 21,
    title: "วาล์ว ค้อนน้ำ และการป้องกัน",
    titleEn: "Valves, Water Hammer & Protection",
    level: "pumpstation",
    icon: "🛡️",
    summary: "ชนิดวาล์ว · ค้อนน้ำ (water hammer) จากการปิดวาล์ว/ปั๊มหยุดเร็ว และวิธีป้องกัน",
    objectives: [
      "รู้จักวาล์วชนิดต่าง ๆ และหน้าที่ (gate, butterfly, check, control, PRV, air release)",
      "เข้าใจค้อนน้ำ: ΔP = ρaΔV และ ΔH = aΔV/g (Joukowsky)",
      "เห็นผลของเวลาปิดวาล์วต่อความรุนแรงของแรงดันกระชาก",
      "รู้แนวทางป้องกัน: surge tank, ปิดวาล์วช้าลง, check valve ที่เหมาะสม",
    ],
    topics: [
      "Gate/Butterfly/Check valve", "Control valve", "Air release valve", "Pressure reducing valve",
      "Surge tank", "Water hammer", "Transient pressure", "Valve closing time", "Check valve slam", "Pipe burst risk",
    ],
    simIds: ["water-hammer", "check-valve-slam"],
  },
  {
    id: "ch22",
    number: 22,
    title: "เครื่องมือวัดและระบบติดตาม (SCADA)",
    titleEn: "Sensors, SCADA & Monitoring",
    level: "pumpstation",
    icon: "📡",
    summary: "เครื่องมือวัดและ SCADA ที่ใช้ติดตามสถานีสูบน้ำ · dashboard, alarm, trend และการบำรุงรักษา",
    objectives: [
      "รู้จัก sensor หลัก: pressure, flow, level, power, vibration, temperature",
      "เข้าใจบทบาทของ SCADA: monitoring, alarm, trend graph, data logging",
      "อ่านอาการผิดปกติจากค่าที่วัดได้ (เชิงแนวคิด)",
      "เข้าใจการบำรุงรักษาเชิงป้องกันและเชิงทำนาย (preventive/predictive)",
    ],
    topics: [
      "Pressure transmitter", "Flow meter", "Level sensor", "Power meter", "Vibration sensor",
      "Temperature sensor", "SCADA", "Alarm", "Trend graph", "Data logging", "Preventive/Predictive maintenance",
    ],
    simIds: [],
  },
  {
    id: "ch23",
    number: 23,
    title: "การวิเคราะห์ปัญหาสถานีสูบน้ำ",
    titleEn: "Troubleshooting Pump Station",
    level: "pumpstation",
    icon: "🔎",
    summary:
      "วินิจฉัยปัญหาเบื้องต้นเชิงแนวคิด: flow/pressure ต่ำ กระแสสูง สั่น เสียงดัง cavitation ฯลฯ · ⚠️ ห้ามเปิดตู้ไฟหรือซ่อมไฟฟ้าเอง การตรวจระบบไฟฟ้าต้องทำโดยช่าง/วิศวกรที่ได้รับอนุญาต",
    objectives: [
      "เชื่อมโยงอาการกับสาเหตุที่เป็นไปได้ (suction, air, valve, impeller, cavitation, overload ฯลฯ)",
      "รู้ลำดับการตรวจสอบเบื้องต้นอย่างปลอดภัย (ค่า pressure/flow, สถานะวาล์ว, alarm จาก VFD, trend)",
      "เข้าใจว่า flow ต่ำอาจมาจากปั๊ม วาล์ว หรือการสูญเสียในท่อ",
      "ตระหนักว่างานไฟฟ้า/เครื่องจักรหมุนต้องให้ผู้ชำนาญดำเนินการ",
    ],
    topics: [
      "No/low flow", "Low/high pressure", "High/low current", "Vibration", "Noise", "Cavitation",
      "Air lock", "Clogged strainer", "Closed valve", "Wrong rotation", "Impeller wear", "Bearing/Seal problem",
      "Pipe leakage", "Sensor error", "VFD fault",
    ],
    simIds: ["troubleshooting"],
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
  {
    id: "pumpstation",
    title: "สถานีสูบจ่ายน้ำ",
    titleEn: "Pump Station",
    icon: "🏭",
    blurb: "ปั๊ม มอเตอร์ VFD วาล์ว พลังงาน SCADA และการวิเคราะห์ปัญหา (เชิงการเรียนรู้)",
    chapterIds: ["ch16", "ch17", "ch18", "ch19", "ch20", "ch21", "ch22", "ch23"],
  },
];

export const getChapter = (id: string): Chapter | undefined =>
  CHAPTERS.find((c) => c.id === id);

/** Chapter that contains a given simulation id. */
export const chapterOfSim = (simId: string): Chapter | undefined =>
  CHAPTERS.find((c) => c.simIds.includes(simId));
