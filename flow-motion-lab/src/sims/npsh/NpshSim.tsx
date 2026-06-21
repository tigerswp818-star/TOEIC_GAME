import { useEffect, useRef, useState } from "react";
import ParticleFlowCanvas, { type DrawContext } from "@/components/canvas/ParticleFlowCanvas";
import SimulationLayout from "@/components/sim/SimulationLayout";
import SimStage from "@/components/sim/SimStage";
import SimulationControls from "@/components/sim/SimulationControls";
import ControlSlider from "@/components/sim/ControlSlider";
import ResultStat from "@/components/sim/ResultStat";
import FormulaCard from "@/components/sim/FormulaCard";
import ExplanationPanel from "@/components/sim/ExplanationPanel";
import GraphPanel, { BarChart } from "@/components/sim/GraphPanel";
import ModeTabs from "@/components/sim/ModeTabs";
import GuidedSteps from "@/components/sim/GuidedSteps";
import ChallengePanel from "@/components/sim/ChallengePanel";
import MiniQuiz from "@/components/sim/MiniQuiz";
import { useSimControls } from "@/hooks/useSimControls";
import { useTheme } from "@/hooks/useTheme";
import { clamp, formatNumber } from "@/lib/math";
import { velocityRampRGB } from "@/lib/colors";
import { drawLabel, drawFlowParticle, roundRect } from "@/lib/render/draw";
import type { Challenge, GuidedStep, LearningMode, QuizItem } from "@/types/simulation";
import { cavitationSeverity, computeNpsh } from "./npshModel";

const PARTICLE_COUNT = 90;
const MAX_BUBBLES = 70;
const AVAIL_COLOR = "#06b6d4"; // cyan — NPSH available
const REQ_COLOR = "#f59e0b"; // amber — NPSH required

interface Params {
  pSuction: number; // suction gauge pressure (kPa)
  tempC: number; // fluid temperature (°C)
  zSuction: number; // suction lift (m)
  hLoss: number; // suction head loss (m)
}
const DEFAULTS: Params = { pSuction: 0, tempC: 25, zSuction: 2, hLoss: 1 };

/** A vapour bubble that grows then pops near the impeller eye. */
interface Bubble {
  xf: number; // normalised x around the inlet
  yf: number; // normalised y around the inlet
  age: number; // seconds since birth
  life: number; // total lifetime before popping
  maxR: number; // peak radius (px)
  popped: number; // pop-flash timer (s) once collapsed
}

/** A water particle drawn rising up the suction pipe into the pump. */
interface FlowParticle {
  t: number; // 0 (reservoir) → 1 (pump inlet) along the suction path
  off: number; // lateral offset fraction within the pipe
}

function seedFlow(count: number): FlowParticle[] {
  return Array.from({ length: count }, () => ({
    t: Math.random(),
    off: (Math.random() * 2 - 1) * 0.7,
  }));
}

const guidedSteps: GuidedStep[] = [
  {
    title: "เริ่มจากสภาพปลอดภัย",
    body: "ตั้งอุณหภูมิน้ำต่ำ (25°C) ยกปั๊มไม่สูง (z = 2 m) และแรงเสียดทานน้อย สังเกตว่า NPSH_avail สูงกว่า NPSH_req น้ำไหลขึ้นปั๊มเรียบ ๆ แทบไม่มีฟอง",
    apply: { pSuction: 0, tempC: 25, zSuction: 2, hLoss: 1 },
  },
  {
    title: "อุ่นน้ำให้ร้อนขึ้น",
    body: "เพิ่มอุณหภูมิเป็น 85°C ความดันไอ Pv พุ่งสูงขึ้นมาก NPSH_avail ลดลงทันที เริ่มเห็นฟองไอก่อตัวที่ทางเข้าปั๊มและยุบตัว — นี่คือจุดเริ่มของ cavitation",
    apply: { pSuction: 0, tempC: 85, zSuction: 2, hLoss: 1 },
  },
  {
    title: "ยกปั๊มสูงขึ้น + เพิ่มแรงเสียดทาน",
    body: "ยกปั๊มขึ้นเป็น z = 6 m และเพิ่ม h_loss เป็น 3 m ทั้งสองค่าหักออกจาก NPSH_avail โดยตรง ทำให้ margin ติดลบมากขึ้น ฟองเกิดถี่และยุบตัวรุนแรงขึ้น",
    apply: { pSuction: 0, tempC: 85, zSuction: 6, hLoss: 3 },
  },
  {
    title: "แก้ไขให้ปลอดภัยอีกครั้ง",
    body: "ลดความสูงปั๊มลง ลดอุณหภูมิ หรือเพิ่มความดันด้านดูด เพื่อยก NPSH_avail ให้กลับมามากกว่า NPSH_req (margin > 0) ฟองจะหายไปและการไหลกลับมาเรียบ",
    apply: { pSuction: 30, tempC: 25, zSuction: 1, hLoss: 0.5 },
  },
];

const challenges: Challenge[] = [
  {
    id: "safe",
    title: "ทำให้ปลอดภัยจาก cavitation (margin > 0)",
    hint: "ยก NPSH_avail ให้มากกว่า NPSH_req โดยลดอุณหภูมิ ลดความสูงปั๊ม ลดแรงเสียดทาน หรือเพิ่มความดันด้านดูด",
    isSolved: (r) => r.margin > 0,
    success: "สำเร็จ! NPSH_avail มากกว่า NPSH_req ปั๊มทำงานปลอดภัยไม่เกิดฟองไอ",
  },
  {
    id: "force",
    title: "บังคับให้เกิด cavitation (margin < 0)",
    hint: "กด NPSH_avail ลงให้ต่ำกว่า NPSH_req เช่น เพิ่มอุณหภูมิให้สูง ยกปั๊มขึ้นสูง หรือลดความดันด้านดูดให้เป็นลบ",
    isSolved: (r) => r.margin < 0,
    success: "เกิด cavitation แล้ว! ความดันด้านดูดต่ำกว่าความดันไอ น้ำกลายเป็นฟองไอที่ยุบตัวรุนแรง",
  },
  {
    id: "recover",
    title: "เริ่มจากเสี่ยงแล้วกู้คืนด้วยการลดปั๊มให้ z ≤ 1 m และ margin > 0",
    hint: "ลดความสูงของปั๊ม (suction lift) ลงเหลือไม่เกิน 1 m เพื่อคืน NPSH_avail ให้บวก",
    isSolved: (r) => r.zSuction <= 1 && r.margin > 0,
    success: "ยอดเยี่ยม! ลดปั๊มให้ต่ำลงทำให้ z น้อย NPSH_avail กลับมาบวก ปลอดภัยจาก cavitation",
  },
];

const quiz: QuizItem[] = [
  {
    question: "Cavitation (โพรงอากาศ/ฟองไอ) ในปั๊มเกิดจากสาเหตุใด?",
    choices: [
      "ความดันด้านดูดตกลงต่ำกว่าความดันไอของของเหลว",
      "ความเร็วรอบปั๊มต่ำเกินไป",
      "ของเหลวเย็นเกินไป",
      "ท่อด้านส่งมีขนาดเล็ก",
    ],
    answer: 0,
    explain:
      "เมื่อความดันเฉพาะที่ด้านดูดต่ำกว่าความดันไอ ของเหลวจะเดือดกลายเป็นไอเกิดเป็นฟอง พอไหลไปยังบริเวณความดันสูงขึ้นฟองจะยุบตัวอย่างรุนแรงทำลายใบพัด นี่คือ cavitation",
  },
  {
    question: "เมื่ออุณหภูมิของของเหลวสูงขึ้น โอกาสเกิด cavitation เป็นอย่างไร?",
    choices: [
      "เพิ่มขึ้น เพราะความดันไอ Pv สูงขึ้น ทำให้ NPSH_avail ลดลง",
      "ลดลง เพราะของเหลวไหลคล่องขึ้น",
      "ไม่เปลี่ยน เพราะอุณหภูมิไม่เกี่ยว",
      "ลดลง เพราะความหนาแน่นเพิ่ม",
    ],
    answer: 0,
    explain:
      "ความดันไอ Pv เพิ่มตามอุณหภูมิอย่างรวดเร็ว เทอม (P_atm + P_s − Pv) จึงเล็กลง NPSH_avail ลดลง โอกาสเกิด cavitation จึงมากขึ้นเมื่อน้ำร้อน",
  },
  {
    question: "NPSH ใช้เปรียบเทียบสิ่งใดเพื่อตัดสินว่าจะเกิด cavitation หรือไม่?",
    choices: [
      "NPSH ที่มีอยู่ (available) กับ NPSH ที่ปั๊มต้องการ (required)",
      "ความดันด้านส่งกับความดันด้านดูด",
      "อัตราการไหลกับเฮดของปั๊ม",
      "กำลังไฟฟ้ากับประสิทธิภาพ",
    ],
    answer: 0,
    explain:
      "เกณฑ์คือ NPSH_available ≥ NPSH_required จึงปลอดภัย ถ้า NPSH_avail < NPSH_req (margin ติดลบ) ความดันที่ทางเข้าปั๊มจะต่ำเกินจนของเหลวกลายเป็นไอ เกิด cavitation",
  },
];

export default function NpshSim() {
  const { theme } = useTheme();
  const controls = useSimControls({ streamlines: false, vectors: false, pressure: false });
  const [params, setParams] = useState<Params>(DEFAULTS);
  const [mode, setMode] = useState<LearningMode>("explore");

  const flowRef = useRef<FlowParticle[]>(seedFlow(PARTICLE_COUNT));
  const bubblesRef = useRef<Bubble[]>([]);
  const spawnRef = useRef(0); // bubble spawn accumulator (s)

  const npsh = computeNpsh({
    pSuctionKPa: params.pSuction,
    tempC: params.tempC,
    zSuction: params.zSuction,
    hLoss: params.hLoss,
  });
  const severity = cavitationSeverity(npsh.margin);

  // Latest physics for the per-frame draw closure (avoids stale captures).
  const physicsRef = useRef({ severity });
  physicsRef.current = { severity };

  useEffect(() => {
    flowRef.current = seedFlow(PARTICLE_COUNT);
    bubblesRef.current = [];
    spawnRef.current = 0;
  }, [controls.resetNonce]);

  const set = (key: keyof Params) => (v: number) =>
    setParams((p) => ({ ...p, [key]: v }));
  const applyPreset = (vals: Record<string, number>) =>
    setParams((p) => ({ ...p, ...vals }));

  const draw = ({ ctx, width, height, dt, time, theme: t }: DrawContext) => {
    const dark = t === "dark";
    const sev = physicsRef.current.severity;

    // --- geometry: reservoir bottom-left, pump upper-right, suction pipe up ---
    const surfaceY = height * 0.72; // reservoir water surface
    const reservoirRight = width * 0.36;
    const pumpX = width * 0.7;
    const pumpY = height * 0.3;
    const pumpR = height * 0.12;
    const inletX = pumpX - pumpR; // impeller eye / suction port
    const inletY = pumpY;
    const pipeW = Math.max(14, height * 0.075);
    // suction path: from reservoir up to pipe top, then across to pump inlet
    const riserX = width * 0.22;
    const pipeTopY = pumpY; // horizontal run height

    // --- reservoir water body ---
    const wg = ctx.createLinearGradient(0, surfaceY, 0, height);
    wg.addColorStop(0, dark ? "rgba(56,189,248,0.30)" : "rgba(125,211,252,0.55)");
    wg.addColorStop(1, dark ? "rgba(12,41,84,0.55)" : "rgba(59,130,246,0.42)");
    ctx.fillStyle = wg;
    ctx.fillRect(0, surfaceY, reservoirRight, height - surfaceY);
    // wavy surface line
    ctx.beginPath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = dark ? "rgba(125,211,252,0.85)" : "rgba(37,99,235,0.7)";
    for (let i = 0; i <= 40; i++) {
      const xf = i / 40;
      const x = xf * reservoirRight;
      const y = surfaceY + Math.sin(time * 1.6 + xf * 9) * 2.4;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
    drawLabel(ctx, "แหล่งน้ำ Source", reservoirRight * 0.5, surfaceY + 22, {
      align: "center",
      color: dark ? "#bae6fd" : "#0369a1",
      bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.85)",
    });

    // --- suction pipe (riser up from reservoir, then across to pump) ---
    const pipeFill = dark ? "rgba(14,116,144,0.22)" : "rgba(165,243,252,0.45)";
    const pipeStroke = dark ? "#1e3a5f" : "#94a3b8";
    ctx.fillStyle = pipeFill;
    // vertical riser
    ctx.fillRect(riserX - pipeW / 2, pipeTopY - pipeW / 2, pipeW, surfaceY - (pipeTopY - pipeW / 2));
    // horizontal run to the pump inlet
    ctx.fillRect(riserX - pipeW / 2, pipeTopY - pipeW / 2, inletX - riserX + pipeW / 2, pipeW);
    ctx.lineWidth = 3;
    ctx.strokeStyle = pipeStroke;
    // outline (riser left/right + horizontal top/bottom, open ends)
    ctx.beginPath();
    ctx.moveTo(riserX - pipeW / 2, surfaceY);
    ctx.lineTo(riserX - pipeW / 2, pipeTopY - pipeW / 2);
    ctx.lineTo(inletX, pipeTopY - pipeW / 2);
    ctx.moveTo(riserX + pipeW / 2, surfaceY);
    ctx.lineTo(riserX + pipeW / 2, pipeTopY + pipeW / 2);
    ctx.lineTo(inletX, pipeTopY + pipeW / 2);
    ctx.stroke();

    // suction-lift dimension (z) annotation
    drawLabel(ctx, `ยกปั๊มสูง z`, riserX, (surfaceY + pipeTopY) / 2, {
      align: "center",
      color: dark ? "#e2e8f0" : "#0f172a",
      bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.85)",
    });

    // --- the pump (volute circle with spinning impeller) ---
    ctx.save();
    ctx.beginPath();
    ctx.arc(pumpX, pumpY, pumpR, 0, Math.PI * 2);
    const pg = ctx.createRadialGradient(pumpX, pumpY, pumpR * 0.2, pumpX, pumpY, pumpR);
    pg.addColorStop(0, dark ? "rgba(56,189,248,0.5)" : "rgba(125,211,252,0.7)");
    pg.addColorStop(1, dark ? "rgba(14,116,144,0.35)" : "rgba(8,145,178,0.35)");
    ctx.fillStyle = pg;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = dark ? "#1e3a5f" : "#0e7490";
    ctx.stroke();
    const spin = dt > 0 ? time * 4 : 0;
    ctx.translate(pumpX, pumpY);
    ctx.rotate(spin);
    ctx.strokeStyle = dark ? "#bae6fd" : "#0369a1";
    ctx.lineWidth = 2.5;
    for (let i = 0; i < 5; i++) {
      ctx.rotate((Math.PI * 2) / 5);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(pumpR * 0.7, pumpR * 0.22);
      ctx.stroke();
    }
    ctx.restore();
    drawLabel(ctx, "ปั๊ม Pump", pumpX, pumpY - pumpR - 12, {
      align: "center",
      color: dark ? "#bae6fd" : "#0369a1",
      bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.85)",
    });

    // --- flow particles: travel reservoir → riser → across → inlet ---
    // Speed eases down as cavitation worsens (flow becomes choppy / starved).
    const flowSpeed = 0.32 * (1 - 0.45 * sev);
    const tNorm = clamp(1 - sev, 0.15, 1);
    for (const p of flowRef.current) {
      p.t += flowSpeed * dt;
      if (p.t > 1) {
        p.t -= 1;
        p.off = (Math.random() * 2 - 1) * 0.7;
      }
      if (!controls.toggles.particles) continue;
      // Map t to a point along the L-shaped suction path.
      // 0..0.6 climbs the riser; 0.6..1 runs across to the inlet.
      let x: number;
      let y: number;
      if (p.t < 0.6) {
        const f = p.t / 0.6;
        x = riserX + p.off * (pipeW * 0.34);
        y = surfaceY - f * (surfaceY - pipeTopY);
      } else {
        const f = (p.t - 0.6) / 0.4;
        x = riserX + f * (inletX - riserX);
        y = pipeTopY + p.off * (pipeW * 0.34);
      }
      const trail = clamp(tNorm * pipeW * 0.9, 0, 16);
      drawFlowParticle(ctx, x, y, 1, 0, velocityRampRGB(tNorm), {
        radius: 2.2 + tNorm * 0.8,
        trail,
        alpha: 0.88,
        glow: tNorm > 0.6,
      });
    }

    // --- vapour bubbles: spawn near the inlet/impeller, grow then pop ---
    // Spawn rate & violence scale with cavitation severity (0 when safe).
    const bubbles = bubblesRef.current;
    if (sev > 0 && dt > 0) {
      spawnRef.current += dt * (4 + sev * 40); // bubbles per second
      while (spawnRef.current >= 1 && bubbles.length < MAX_BUBBLES) {
        spawnRef.current -= 1;
        bubbles.push({
          xf: (Math.random() * 2 - 1) * 0.5,
          yf: (Math.random() * 2 - 1) * 0.5,
          age: 0,
          life: 0.5 + Math.random() * (1.1 - 0.7 * sev), // shorter life = more violent
          maxR: (2 + Math.random() * 4) * (0.6 + sev * 0.9),
          popped: 0,
        });
      }
    }
    // advance + render bubbles (all motion via dt)
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i];
      b.age += dt;
      const cx = inletX + b.xf * pumpR * 0.9;
      const cy = inletY + b.yf * pumpR * 0.9;
      if (b.popped > 0) {
        // collapse flash: a quick ring that fades out
        b.popped -= dt;
        const flash = clamp(b.popped / 0.18, 0, 1);
        ctx.beginPath();
        ctx.arc(cx, cy, b.maxR * (1.4 - flash) + 1, 0, Math.PI * 2);
        ctx.strokeStyle = dark
          ? `rgba(253,164,175,${0.7 * flash})`
          : `rgba(225,29,72,${0.7 * flash})`;
        ctx.lineWidth = 2;
        ctx.stroke();
        if (b.popped <= 0) bubbles.splice(i, 1);
        continue;
      }
      if (b.age >= b.life) {
        b.popped = 0.18; // begin collapse flash
        continue;
      }
      // grow: radius follows a rise toward maxR, drifting slightly upward
      const grow = b.age / b.life;
      const r = b.maxR * (0.3 + 0.7 * grow);
      const driftY = cy - grow * pumpR * 0.25;
      ctx.beginPath();
      ctx.arc(cx, driftY, r, 0, Math.PI * 2);
      ctx.fillStyle = dark ? "rgba(248,250,252,0.55)" : "rgba(255,255,255,0.7)";
      ctx.fill();
      ctx.strokeStyle = dark ? "rgba(186,230,253,0.7)" : "rgba(8,145,178,0.5)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // --- on-canvas cavitation risk badge ---
    if (sev > 0) {
      const bw = 190;
      const bh = 30;
      const bx = width / 2 - bw / 2;
      const by = height * 0.06;
      ctx.save();
      roundRect(ctx, bx, by, bw, bh, 8);
      const pulse = 0.55 + 0.25 * Math.sin(time * 6);
      ctx.fillStyle = dark ? `rgba(190,18,60,${pulse})` : `rgba(225,29,72,${pulse})`;
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 14px 'IBM Plex Sans Thai', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("⚠ เสี่ยง Cavitation", width / 2, by + bh / 2);
      ctx.restore();
    }
  };

  // --- adaptive explanation (cyan when safe, rose when cavitating) ---
  const hotterDefault = params.tempC > DEFAULTS.tempC + 1;
  const explanation = npsh.cavitationRisk
    ? `ความดันด้านดูดต่ำกว่าความดันไอ (Pv = ${formatNumber(npsh.pvKPa, 1)} kPa ที่ ${formatNumber(
        params.tempC,
        0,
      )}°C) ของเหลวจึงกลายเป็นไอเกิดฟอง (cavitation) ที่ยุบตัวรุนแรงทำลายใบพัด — ยกปั๊มสูง/อุณหภูมิสูง/แรงเสียดทานมาก ทำให้ NPSH_avail (${formatNumber(
        npsh.npshAvailable,
        2,
      )} m) ต่ำกว่า NPSH_req (${formatNumber(npsh.npshRequired, 1)} m) จึงเสี่ยง (margin = ${formatNumber(
        npsh.margin,
        2,
      )} m)`
    : `ปลอดภัย: NPSH_avail (${formatNumber(npsh.npshAvailable, 2)} m) มากกว่า NPSH_req (${formatNumber(
        npsh.npshRequired,
        1,
      )} m) margin = ${formatNumber(npsh.margin, 2)} m ความดันด้านดูดยังสูงกว่าความดันไอ (Pv = ${formatNumber(
        npsh.pvKPa,
        1,
      )} kPa) จึงไม่เกิดฟองไอ${
        hotterDefault ? " — แต่ถ้าอุ่นน้ำให้ร้อนขึ้นอีก Pv จะสูงขึ้นและเข้าใกล้จุดเสี่ยง" : ""
      }`;

  const availableToggles = ["particles", "graph", "formula"] as const;

  const results = (
    <>
      <ModeTabs mode={mode} onChange={setMode} />

      {mode === "guided" && <GuidedSteps steps={guidedSteps} onApply={applyPreset} />}
      {mode === "challenge" && (
        <ChallengePanel
          challenges={challenges}
          result={{
            npshAvail: npsh.npshAvailable,
            margin: npsh.margin,
            zSuction: params.zSuction,
          }}
        />
      )}

      <div className="grid grid-cols-2 gap-2">
        <ResultStat
          label="NPSH available"
          value={npsh.npshAvailable}
          unit="m"
          big
          accentClass={
            npsh.cavitationRisk
              ? "text-rose-600 dark:text-rose-300"
              : "text-flow-600 dark:text-flow-300"
          }
        />
        <ResultStat label="NPSH required" value={npsh.npshRequired} unit="m" decimals={1} />
        <ResultStat
          label="margin (avail − req)"
          value={npsh.margin}
          unit="m"
          accentClass={
            npsh.cavitationRisk
              ? "text-rose-600 dark:text-rose-300"
              : "text-emerald-600 dark:text-emerald-300"
          }
        />
        <ResultStat label="ความดันไอ Pv" value={npsh.pvKPa} unit="kPa" decimals={1} />
      </div>

      <ExplanationPanel
        text={explanation}
        badge={{
          label: npsh.cavitationRisk ? "⚠ เสี่ยง Cavitation" : "ปลอดภัย Safe",
          tone: npsh.cavitationRisk ? "rose" : "cyan",
        }}
      />

      {controls.toggles.formula && (
        <FormulaCard
          formula="NPSH_a = (P_atm + P_s − P_v)/ρg − z − h_loss"
          substituted={`NPSH_a = (101.3 + ${formatNumber(params.pSuction, 0)} − ${formatNumber(
            npsh.pvKPa,
            1,
          )}) kPa /(ρg) − ${formatNumber(params.zSuction, 1)} − ${formatNumber(
            params.hLoss,
            1,
          )} = ${formatNumber(npsh.npshAvailable, 2)} m   (NPSH_req = ${formatNumber(
            npsh.npshRequired,
            1,
          )} m)`}
          variables={[
            { symbol: "NPSH_a", meaning: "เฮดดูดสุทธิที่มีอยู่ Available", unit: "m" },
            { symbol: "NPSH_req", meaning: "เฮดดูดสุทธิที่ปั๊มต้องการ Required", unit: "m" },
            { symbol: "P_atm", meaning: "ความดันบรรยากาศ Atmospheric", unit: "Pa" },
            { symbol: "P_s", meaning: "ความดันเกจด้านดูด Suction gauge", unit: "Pa" },
            { symbol: "P_v", meaning: "ความดันไอ Vapour pressure (ขึ้นกับ T)", unit: "Pa" },
            { symbol: "ρ", meaning: "ความหนาแน่นของไหล Density", unit: "kg/m³" },
            { symbol: "g", meaning: "ความเร่งโน้มถ่วง Gravity = 9.81", unit: "m/s²" },
            { symbol: "z", meaning: "ความสูงปั๊มเหนือแหล่งน้ำ Suction lift", unit: "m" },
            { symbol: "h_loss", meaning: "การสูญเสียเฮดด้านดูด Suction loss", unit: "m" },
          ]}
        />
      )}

      {controls.toggles.graph && (
        <GraphPanel title="NPSH available เทียบกับ NPSH required (m)">
          <BarChart
            bars={[
              { label: "NPSH_a", value: Math.max(0, npsh.npshAvailable), color: AVAIL_COLOR },
              { label: "NPSH_req", value: npsh.npshRequired, color: REQ_COLOR },
            ]}
            unit="m"
          />
          <p className="mt-1 text-center text-[11px] text-ink-faint">
            🟦 NPSH available · 🟧 NPSH required — margin = {formatNumber(npsh.margin, 2)} m{" "}
            {npsh.cavitationRisk ? "(ติดลบ → เสี่ยง cavitation)" : "(บวก → ปลอดภัย)"}
          </p>
        </GraphPanel>
      )}
    </>
  );

  return (
    <SimulationLayout
      title="Cavitation & NPSH"
      titleEn="Cavitation & NPSH"
      icon="🫧"
      controls={
        <div className="lab-card space-y-4 p-4">
          <h2 className="text-sm font-bold text-ink">แผงควบคุม Controls</h2>
          <ControlSlider
            label="ความดันเกจด้านดูด"
            symbol="P_s"
            value={params.pSuction}
            min={-90}
            max={100}
            step={1}
            unit="kPa"
            decimals={0}
            onChange={set("pSuction")}
          />
          <ControlSlider
            label="อุณหภูมิของไหล"
            symbol="T"
            value={params.tempC}
            min={10}
            max={95}
            step={1}
            unit="°C"
            decimals={0}
            onChange={set("tempC")}
          />
          <ControlSlider
            label="ความสูงปั๊มเหนือแหล่งน้ำ"
            symbol="z"
            value={params.zSuction}
            min={0}
            max={8}
            step={0.1}
            unit="m"
            decimals={1}
            onChange={set("zSuction")}
          />
          <ControlSlider
            label="การสูญเสียเฮดด้านดูด"
            symbol="h_loss"
            value={params.hLoss}
            min={0}
            max={5}
            step={0.1}
            unit="m"
            decimals={1}
            onChange={set("hLoss")}
          />
          <div className="rounded-lg border border-line bg-surface-soft px-3 py-2 text-xs text-ink-soft">
            ความดันไอที่ {formatNumber(params.tempC, 0)}°C: Pv = {formatNumber(npsh.pvKPa, 1)} kPa
          </div>
          <div className="border-t border-line pt-3">
            <SimulationControls controls={controls} availableToggles={[...availableToggles]} />
          </div>
        </div>
      }
      stage={
        <SimStage controls={controls} explanationId="explain-npsh">
          <ParticleFlowCanvas
            draw={draw}
            playing={controls.playing}
            speed={controls.speed}
            theme={theme}
            className="block h-full w-full"
            ariaLabel="ปั๊มดูดน้ำจากแหล่งน้ำผ่านท่อด้านดูด เมื่อ NPSH ที่มีอยู่ต่ำกว่าที่ต้องการจะเกิดฟองไอ cavitation ที่ทางเข้าปั๊ม"
          />
        </SimStage>
      }
      results={<div id="explain-npsh">{results}</div>}
      bottom={<MiniQuiz items={quiz} />}
    />
  );
}
