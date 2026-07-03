/* ============================================================
   Water KM Dashboard — ตัว render หลัก
   อ่านทุกอย่างจาก KM_DATA (js/data.js) → สร้างหน้าจอ
   ============================================================ */
(function () {
  "use strict";
  const D = KM_DATA;
  const $ = (sel) => document.querySelector(sel);
  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const numFmt = (n) => (n == null || n === "" ? "—" : Number(n).toLocaleString("th-TH"));

  const C = {
    blue: "#2a78d6", blue550: "#1c5cab", blue250: "#86b6ef", blue100: "#cde2fb",
    aqua: "#1baf7a", yellow: "#eda100", violet: "#4a3aa7", red: "#e34948",
    ink: "#0b0b0b", ink2: "#52514e", muted: "#898781", grid: "#e1e0d9",
    surface: "#fcfcfb",
  };

  /* ---------------- header ---------------- */
  $("#app-title").textContent = "💧 " + D.meta.title;
  $("#app-subtitle").textContent = D.meta.subtitle;
  $("#app-docref").textContent = D.meta.docRef;

  /* ---------------- KPI ---------------- */
  $("#kpi-grid").innerHTML = D.kpi
    .map(
      (k) => `<div class="kpi">
        <div class="label">${esc(k.label)} <span class="badge ${k.source}">${k.source === "pdf" ? "จากเอกสาร" : "ตัวอย่าง"}</span></div>
        <div class="value">${numFmt(k.value)}<small>${esc(k.unit)}</small></div>
        <div class="note">${esc(k.note)}</div>
      </div>`
    )
    .join("");

  /* ---------------- Flow diagram (SVG) ---------------- */
  function flowDiagram() {
    const W = 960, H = 430;
    const plants = D.plants;
    const trs = D.network.trs;
    const info = {};
    let nodes = "", pipes = "";

    // โรงงานผลิต (ซ้าย)
    const px = 20, pw = 190, ph = 66, pgap = 34;
    plants.forEach((p, i) => {
      const y = 20 + i * (ph + pgap);
      info["plant-" + p.id] = `<b>${esc(p.name)}</b> — ${esc(p.nickname)}<br>กำลังผลิต ${esc(p.capacity)}<br>${esc(p.desc)}`;
      nodes += `
        <g class="flow-node" data-key="plant-${p.id}">
          <rect x="${px}" y="${y}" width="${pw}" height="${ph}" rx="10" fill="${C.blue100}" stroke="${C.blue250}"/>
          <text x="${px + pw / 2}" y="${y + 26}" text-anchor="middle" font-size="13.5" font-weight="700" fill="${C.blue550}">${esc(p.name.replace("โรงงานผลิตน้ำ", "รง. "))}</text>
          <text x="${px + pw / 2}" y="${y + 47}" text-anchor="middle" font-size="11.5" fill="${C.ink2}">${esc(p.capacity)}</text>
        </g>`;
      pipes += `<path class="flow-pipe" d="M ${px + pw} ${y + ph / 2} C ${px + pw + 60} ${y + ph / 2}, ${330} ${H / 2 - 40}, ${370} ${H / 2}" fill="none" stroke="${C.blue}" stroke-width="${4 + p.share * 2.2}" opacity="0.8"/>`;
    });

    // อุโมงค์รวม (กลาง)
    info["tunnel"] = `<b>อุโมงค์ส่งน้ำ (สูบส่ง)</b><br>ท่อใหญ่ใต้ดินลึก Ø ถึง 3,200 มม. — คุมแรงดันปลายทาง ~15 ม.<br>ขนน้ำหลักหมื่น ลบ.ม./ชม. จากโรงงานผลิตไปยังสถานีสูบจ่าย`;
    nodes += `
      <g class="flow-node" data-key="tunnel">
        <rect x="370" y="${H / 2 - 34}" width="150" height="68" rx="34" fill="${C.blue}" />
        <text x="445" y="${H / 2 - 5}" text-anchor="middle" font-size="13.5" font-weight="800" fill="#fff">อุโมงค์ส่งน้ำ</text>
        <text x="445" y="${H / 2 + 15}" text-anchor="middle" font-size="11" fill="#dcebfc">Ø ≤ 3,200 มม.</text>
      </g>`;

    // TR (ถัดจากอุโมงค์)
    const tx = 585, tw = 165, th = 52, tgap = 22;
    const tTotalH = trs.length * th + (trs.length - 1) * tgap;
    trs.forEach((t, i) => {
      const y = H / 2 - tTotalH / 2 + i * (th + tgap);
      const flowTxt = t.flowOut ? numFmt(t.flowOut) + " " + t.flowUnit : "รอข้อมูลจริง";
      info["tr-" + i] = `<b>${esc(t.name)}</b> <span class="badge example">ตัวอย่าง</span><br>Flow ขาออก: ${esc(flowTxt)}<br>${esc(t.note)}`;
      nodes += `
        <g class="flow-node" data-key="tr-${i}">
          <rect x="${tx}" y="${y}" width="${tw}" height="${th}" rx="9" fill="#fff" stroke="${C.blue}" stroke-width="2"/>
          <text x="${tx + tw / 2}" y="${y + 22}" text-anchor="middle" font-size="12.5" font-weight="700" fill="${C.blue550}">${esc(t.name)}</text>
          <text x="${tx + tw / 2}" y="${y + 40}" text-anchor="middle" font-size="10.5" fill="${C.ink2}">${esc(flowTxt)}</text>
        </g>`;
      pipes += `<path class="flow-pipe" d="M 520 ${H / 2} C 550 ${H / 2}, 555 ${y + th / 2}, ${tx} ${y + th / 2}" fill="none" stroke="${C.blue}" stroke-width="5" opacity="0.8"/>`;
      pipes += `<path class="flow-pipe" d="M ${tx + tw} ${y + th / 2} C ${tx + tw + 40} ${y + th / 2}, ${800} ${H / 2 - 30}, 815 ${H / 2}" fill="none" stroke="${C.aqua}" stroke-width="5" opacity="0.85"/>`;
    });

    // สถานีสูบจ่าย + DMA (ขวา)
    info["sj"] = `<b>สถานีสูบจ่ายน้ำ (สจ.) 10 แห่ง</b><br>รับน้ำจากสายส่งทั้ง 4 line แล้วเพิ่มแรงดัน ~15 → ~20 ม. จ่ายเข้าท่อประธาน (ดูรายชื่อ/ข้อมูลจริงที่หัวข้อ 10)`;
    info["dma"] = `<b>DMA &amp; ผู้ใช้น้ำ</b><br>สาขาแบ่งพื้นที่ย่อยละ ~1,000 มาตร คุมแรงดันปลายทางและตามหาน้ำสูญเสีย`;
    nodes += `
      <g class="flow-node" data-key="sj">
        <rect x="815" y="${H / 2 - 52}" width="130" height="52" rx="9" fill="#e2f6ee" stroke="${C.aqua}" stroke-width="2"/>
        <text x="880" y="${H / 2 - 30}" text-anchor="middle" font-size="12.5" font-weight="800" fill="#0e7a55">สจ. 10 แห่ง</text>
        <text x="880" y="${H / 2 - 12}" text-anchor="middle" font-size="10.5" fill="${C.ink2}">อัดแรงดัน 15→20 ม.</text>
      </g>
      <g class="flow-node" data-key="dma">
        <rect x="815" y="${H / 2 + 14}" width="130" height="52" rx="9" fill="#fff" stroke="${C.aqua}" stroke-width="2" stroke-dasharray="5 4"/>
        <text x="880" y="${H / 2 + 36}" text-anchor="middle" font-size="12.5" font-weight="800" fill="#0e7a55">DMA / บ้าน</text>
        <text x="880" y="${H / 2 + 54}" text-anchor="middle" font-size="10.5" fill="${C.ink2}">~1,000 มาตร/โซน</text>
      </g>
      <path class="flow-pipe" d="M 880 ${H / 2} L 880 ${H / 2 + 14}" fill="none" stroke="${C.aqua}" stroke-width="5"/>`;

    $("#flow-diagram").innerHTML =
      `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="แผนภาพเส้นทางน้ำจากโรงงานผลิตถึงผู้ใช้">
        ${pipes}${nodes}
        <text x="105" y="${H - 8}" text-anchor="middle" font-size="11" font-weight="700" fill="${C.muted}">ระบบผลิต</text>
        <text x="470" y="${H - 8}" text-anchor="middle" font-size="11" font-weight="700" fill="${C.muted}">สูบส่ง (Transmission)</text>
        <text x="875" y="${H - 8}" text-anchor="middle" font-size="11" font-weight="700" fill="${C.muted}">สูบจ่าย (Distribution)</text>
      </svg>`;

    document.querySelectorAll(".flow-node").forEach((n) => {
      n.addEventListener("click", () => {
        $("#flow-detail").innerHTML = info[n.dataset.key] || "";
      });
    });
  }
  flowDiagram();

  /* ---------------- Tiers ---------------- */
  const tierColors = [C.blue550, C.blue, C.aqua, "#0e7a55", C.yellow];
  $("#tier-list").innerHTML = D.tiers
    .map(
      (t, i) => `<div class="tier">
        <div class="no" style="background:${tierColors[i]}">${t.no}</div>
        <div><h3>${esc(t.name)}</h3><p>${esc(t.detail)}</p></div>
      </div>`
    )
    .join("");

  /* ---------------- Compare ---------------- */
  const mkCompare = (c, cls) =>
    `<div class="card ${cls}"><h3>${esc(c.title)}</h3><dl>${c.rows
      .map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`)
      .join("")}</dl></div>`;
  $("#compare-duo").innerHTML =
    mkCompare(D.compare.transmission, "trans") + mkCompare(D.compare.distribution, "dist");

  /* ---------------- Station anatomy ---------------- */
  $("#comp-list").innerHTML = D.station.components
    .map((c) => `<div class="comp"><b>${esc(c.name)}</b><span>${esc(c.detail)}</span></div>`)
    .join("");

  function drawGauge(canvas, val, max, color, unit) {
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const w = 150, h = 105;
    canvas.width = w * dpr; canvas.height = h * dpr;
    canvas.style.width = w + "px"; canvas.style.height = h + "px";
    ctx.scale(dpr, dpr);
    const cx = w / 2, cy = h - 14, r = 56;
    ctx.lineWidth = 13; ctx.lineCap = "round";
    ctx.strokeStyle = C.grid;
    ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI, 2 * Math.PI); ctx.stroke();
    ctx.strokeStyle = color;
    ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI, Math.PI + (val / max) * Math.PI); ctx.stroke();
    ctx.fillStyle = C.ink; ctx.textAlign = "center";
    ctx.font = "800 22px system-ui, sans-serif";
    ctx.fillText(val, cx, cy - 12);
    ctx.font = "600 11px system-ui, sans-serif"; ctx.fillStyle = C.ink2;
    ctx.fillText(unit, cx, cy + 2);
  }
  const st = D.station;
  drawGauge($("#gauge-in"), st.inletPressure, 30, C.blue250, "เมตร");

  function updateStation(rpm) {
    // สาธิต: แรงดันขาออกแปรตามรอบปั๊มเชิงเส้นในช่วง 17–23 ม. (ค่าอ้างอิงจริง ~20 ม.)
    const frac = (rpm - st.rpmMin) / (st.rpmMax - st.rpmMin);
    const out = 17 + frac * 6;
    drawGauge($("#gauge-out"), out.toFixed(1), 30, C.blue, "เมตร");
    $("#rpm-out").innerHTML =
      `รอบปั๊มปัจจุบัน <b>${rpm} RPM</b> (ช่วงใช้งานจริง ${st.rpmMin}–${st.rpmMax} RPM) → แรงดันจ่ายออกโดยประมาณ <b>${out.toFixed(1)} ม.</b>` +
      (out > 21.5 ? ` <span style="color:${C.red};font-weight:700">— ระวังเกินเป้า อาจกระแทกท่อ!</span>`
        : out < 18 ? ` <span style="color:${C.yellow};font-weight:700">— ต่ำกว่าเป้า น้ำอาจไปไม่ถึงปลายสาย</span>`
        : ` <span style="color:${C.aqua};font-weight:700">— อยู่ในกรอบเป้าหมาย ✓</span>`);
  }
  const rpmInput = $("#rpm");
  rpmInput.addEventListener("input", () => updateStation(+rpmInput.value));
  updateStation(+rpmInput.value);

  $("#pump-row").innerHTML =
    Array.from({ length: st.pumpsActive }, (_, i) =>
      `<div class="pump on"><span class="ic">⚙️</span>ปั๊ม ${i + 1}<br>เดิน</div>`).join("") +
    Array.from({ length: st.pumpsStandby }, (_, i) =>
      `<div class="pump standby"><span class="ic">⚙️</span>ปั๊ม ${st.pumpsActive + i + 1}<br>Standby</div>`).join("");

  /* ---------------- RTU / SCADA ---------------- */
  $("#rtu-lead").textContent =
    `ทั่วโครงข่ายมี RTU ${D.rtu.total} คอยแปลงแรงดัน/การไหลของน้ำจริง ให้กลายเป็นตัวเลขบนจอ SCADA แบบ real-time`;
  $("#rtu-codes").innerHTML = D.rtu.naming
    .map((n) => `<tr><td class="code">${esc(n.code)}</td><td>${esc(n.meaning)}</td></tr>`)
    .join("");
  $("#rtu-ps").textContent = D.rtu.primarySecondary;
  $("#scada-loop").innerHTML = D.rtu.loop
    .map((s) => `<div class="stepbox"><span class="n">${s.no}</span><b>${esc(s.name)}</b>${esc(s.detail)}</div>`)
    .join("");

  /* ---------------- PTC chart ---------------- */
  function ptcChart() {
    const canvas = $("#ptc-chart");
    const tip = $("#ptc-tip");
    const pts = D.ptc.points;
    const tolBar = 0.05; // ±0.5 ม. ≈ ±0.05 บาร์ — วาดขยายให้เห็น (สเกลสาธิต ±0.4 บาร์)
    const bandVis = 0.45;

    let hoverIdx = -1;

    function draw() {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth || canvas.parentElement.clientWidth;
      const h = 380;
      canvas.width = w * dpr; canvas.height = h * dpr;
      const ctx = canvas.getContext("2d");
      ctx.scale(dpr, dpr);

      const padL = 44, padR = 18, padT = 26, padB = 40;
      const plotW = w - padL - padR, plotH = h - padT - padB;
      const xmax = 24, ymax = 12;
      const X = (hh) => padL + (hh / xmax) * plotW;
      const Y = (p) => padT + (1 - p / ymax) * plotH;

      ctx.clearRect(0, 0, w, h);

      // grid
      ctx.strokeStyle = C.grid; ctx.lineWidth = 1;
      ctx.fillStyle = C.muted; ctx.font = "500 11px system-ui, sans-serif";
      for (let p = 0; p <= ymax; p += 2) {
        ctx.beginPath(); ctx.moveTo(padL, Y(p)); ctx.lineTo(w - padR, Y(p)); ctx.stroke();
        ctx.textAlign = "right"; ctx.fillText(p, padL - 8, Y(p) + 4);
      }
      ctx.textAlign = "center";
      for (let hh = 0; hh <= 24; hh += 4) {
        ctx.fillText(String(hh).padStart(2, "0") + ":00", X(hh), h - padB + 18);
      }
      // แกน
      ctx.strokeStyle = "#c3c2b7";
      ctx.beginPath(); ctx.moveTo(padL, padT); ctx.lineTo(padL, h - padB); ctx.lineTo(w - padR, h - padB); ctx.stroke();
      ctx.save();
      ctx.translate(12, padT + plotH / 2); ctx.rotate(-Math.PI / 2);
      ctx.textAlign = "center"; ctx.fillText("แรงดัน (บาร์)", 0, 0);
      ctx.restore();

      // แถบช่วง peak เช้า 5-9
      ctx.fillStyle = "rgba(237,161,0,0.08)";
      ctx.fillRect(X(5), padT, X(9) - X(5), plotH);
      ctx.fillStyle = "#8a5c00"; ctx.font = "700 11px system-ui, sans-serif";
      ctx.fillText("Peak เช้า 05–09 น.", (X(5) + X(9)) / 2, padT + 14);

      // tolerance band
      ctx.beginPath();
      pts.forEach((p, i) => { const x = X(p.h), y = Y(p.p + bandVis); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(X(pts[i].h), Y(pts[i].p - bandVis));
      ctx.closePath();
      ctx.fillStyle = "rgba(42,120,214,0.13)";
      ctx.fill();

      // เส้นหลัก
      ctx.beginPath();
      pts.forEach((p, i) => { const x = X(p.h), y = Y(p.p); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.strokeStyle = C.blue; ctx.lineWidth = 2.5; ctx.lineJoin = "round"; ctx.stroke();

      // direct labels จุดสำคัญ
      ctx.font = "700 11.5px system-ui, sans-serif"; ctx.fillStyle = C.blue550;
      ctx.fillText("เป้า PTC", X(14), Y(pts[14].p) - 12);
      ctx.fillStyle = "#5b7ba6"; ctx.font = "600 10.5px system-ui, sans-serif";
      ctx.fillText("กรอบ tolerance (±0.5 ม. — วาดขยายเพื่อให้เห็น)", X(14), Y(pts[14].p) + 24);

      // hover crosshair
      if (hoverIdx >= 0) {
        const p = pts[hoverIdx];
        const x = X(p.h), y = Y(p.p);
        ctx.strokeStyle = "rgba(11,11,11,0.25)"; ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, h - padB); ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath(); ctx.arc(x, y, 5.5, 0, 7); ctx.fillStyle = "#fff"; ctx.fill();
        ctx.lineWidth = 2.5; ctx.strokeStyle = C.blue; ctx.stroke();
        tip.style.display = "block";
        tip.style.left = (x / w) * 100 + "%";
        tip.style.top = y + "px";
        tip.textContent = `${String(p.h).padStart(2, "0")}:00 น. — เป้า ${p.p.toFixed(1)} บาร์`;
      } else {
        tip.style.display = "none";
      }
      return { X, padL, plotW };
    }

    let geo = draw();
    canvas.addEventListener("pointermove", (e) => {
      const rect = canvas.getBoundingClientRect();
      const xr = e.clientX - rect.left;
      const hh = Math.round(((xr - geo.padL) / geo.plotW) * 24);
      hoverIdx = hh >= 0 && hh <= 24 ? hh : -1;
      geo = draw();
    });
    canvas.addEventListener("pointerleave", () => { hoverIdx = -1; geo = draw(); });
    window.addEventListener("resize", () => { geo = draw(); });
  }
  ptcChart();
  $("#ptc-notes").innerHTML = D.ptc.notes.map((n) => `<li>• ${esc(n)}</li>`).join("");

  /* ---------------- Triad ---------------- */
  $("#triad-grid").innerHTML = D.triad
    .map(
      (t) => `<div class="card">
        <div class="abbr">${esc(t.abbr)}</div>
        <div class="rolename">${esc(t.role)}</div>
        <p><b>${esc(t.full)}</b></p>
        <p><b>มุมมอง:</b> ${esc(t.scope)}</p>
        <p><b>หน้าที่:</b> ${esc(t.duty)}</p>
      </div>`
    )
    .join("");

  /* ---------------- Emergency ---------------- */
  const em = D.emergency;
  $("#divert-title").textContent = em.diversion.title;
  $("#divert-trigger").innerHTML = "<b>จุดเริ่มเหตุ:</b> " + esc(em.diversion.trigger);
  $("#divert-how").innerHTML = "<b>วิธีรับมือ:</b> " + esc(em.diversion.how);
  $("#crisis-title").textContent = em.crisis.title;
  $("#crisis-scenario").innerHTML = "<b>โจทย์:</b> " + esc(em.crisis.scenario);
  $("#crisis-actions").innerHTML = em.crisis.actions
    .map((a) => `<li><b>${esc(a.name)}</b> — ${esc(a.detail)}</li>`)
    .join("");

  function divertSVG(active) {
    const on = active;
    return `<svg viewBox="0 0 460 190" role="img" aria-label="แผนภาพจำลองการผันน้ำ">
      <rect x="15" y="20" width="120" height="46" rx="8" fill="#cde2fb" stroke="#86b6ef"/>
      <text x="75" y="48" text-anchor="middle" font-size="13" font-weight="700" fill="#1c5cab">โรงงาน A</text>
      <rect x="15" y="124" width="120" height="46" rx="8" fill="${on ? "#fbe3e3" : "#cde2fb"}" stroke="${on ? "#e34948" : "#86b6ef"}"/>
      <text x="75" y="146" text-anchor="middle" font-size="13" font-weight="700" fill="${on ? "#d03b3b" : "#1c5cab"}">โรงงาน B</text>
      <text x="75" y="162" text-anchor="middle" font-size="10.5" fill="${on ? "#d03b3b" : "#52514e"}">${on ? "⚡ ไฟดับ!" : "ปกติ"}</text>
      <path class="flow-pipe" d="M135 43 H 320" stroke="#2a78d6" stroke-width="6" fill="none"/>
      <path d="M135 147 H 320" stroke="${on ? "#e1e0d9" : "#2a78d6"}" stroke-width="6" fill="none" class="${on ? "" : "flow-pipe"}"/>
      <rect x="320" y="20" width="120" height="46" rx="8" fill="#e2f6ee" stroke="#1baf7a"/>
      <text x="380" y="48" text-anchor="middle" font-size="12.5" font-weight="700" fill="#0e7a55">โซนเหนือ ✓</text>
      <rect x="320" y="124" width="120" height="46" rx="8" fill="${on ? "#e2f6ee" : "#e2f6ee"}" stroke="#1baf7a"/>
      <text x="380" y="146" text-anchor="middle" font-size="12.5" font-weight="700" fill="#0e7a55">โซนใต้ ${on ? "✓ (ผันน้ำช่วย)" : "✓"}</text>
      <!-- RCV -->
      <line x1="228" y1="43" x2="228" y2="147" stroke="${on ? "#e34948" : "#c3c2b7"}" stroke-width="6" stroke-dasharray="${on ? "none" : "6 6"}" class="${on ? "flow-pipe" : ""}"/>
      <circle cx="228" cy="95" r="15" fill="${on ? "#e34948" : "#fff"}" stroke="${on ? "#e34948" : "#898781"}" stroke-width="2.5"/>
      <text x="228" y="100" text-anchor="middle" font-size="11" font-weight="800" fill="${on ? "#fff" : "#898781"}">${on ? "✕→✓" : "✕"}</text>
      <text x="255" y="99" font-size="11" font-weight="700" fill="${on ? "#d03b3b" : "#898781"}">RCV ${on ? "เปิด" : "ปิด"}</text>
    </svg>`;
  }
  const divertBtn = $("#divert-btn");
  let divertOn = false;
  $("#divert-svg").innerHTML = divertSVG(false);
  divertBtn.addEventListener("click", () => {
    divertOn = !divertOn;
    divertBtn.classList.toggle("active", divertOn);
    divertBtn.textContent = divertOn ? "🔄 กลับสู่สภาวะปกติ" : "⚡ จำลองเหตุ: ไฟดับที่โรงงาน B";
    $("#divert-svg").innerHTML = divertSVG(divertOn);
  });

  /* ---------------- DMA ---------------- */
  $("#dma-lead").textContent =
    `สาขาแบ่งโครงข่ายเป็นพื้นที่ย่อย (DMA) ${D.dma.size} — ${D.dma.waterBalance}`;
  $("#pressure-chain").innerHTML = D.dma.pressureChain
    .map((p) => `<div class="pchain-item"><div class="pv">${p.val}<small style="font-size:0.85rem"> ${esc(p.unit)}</small></div><div class="pt">${esc(p.point)}</div></div>`)
    .join('<div class="pchain-arrow">➜</div>');

  // Step-test simulator
  const stt = D.dma.stepTest;
  $("#steptest-title").textContent = "🔦 " + stt.title;
  $("#steptest-logic").textContent = stt.logic;
  $("#step-controls").innerHTML = stt.steps
    .map((s, i) => `<button data-i="${i}" class="${i === 0 ? "active" : ""}">${esc(s.step)}</button>`)
    .join("");
  function setStep(i) {
    const s = stt.steps[i];
    document.querySelectorAll("#step-controls button").forEach((b, j) =>
      b.classList.toggle("active", j === i));
    $("#step-flow").textContent = s.flow;
    const isLeak = i === 1;
    const v = $("#step-verdict");
    v.textContent = s.note;
    v.className = "verdict " + (isLeak ? "leak" : i === 2 ? "ok" : "");
  }
  document.querySelectorAll("#step-controls button").forEach((b) =>
    b.addEventListener("click", () => setStep(+b.dataset.i)));
  setStep(0);

  $("#gis-text").textContent = D.dma.assets.gis;
  $("#cp-text").textContent = D.dma.assets.cp;

  /* ---------------- Network (แก้ไขได้ + localStorage) ---------------- */
  // v2: โครงสายส่งเปลี่ยนเป็น 4 line (MH/TR1/TR2/TR3) — เปลี่ยน key เพื่อไม่ให้ข้อมูลโครงเก่ามาทับ
  const NET_KEY = "waterkm.network.v2";
  let net = JSON.parse(JSON.stringify(D.network));
  try {
    const saved = localStorage.getItem(NET_KEY);
    if (saved) net = JSON.parse(saved);
  } catch (e) { /* ใช้ค่าตั้งต้น */ }

  let editing = false;
  const TR_COLS = [
    ["name", "ชื่อสายส่ง (Line)"], ["flowOut", "Flow ขาออก (ลบ.ม./ชม.)", "num"],
    ["rtu", "รหัส RTU"], ["note", "หมายเหตุ"],
  ];
  const SJ_COLS = [
    ["name", "ชื่อสถานี (สจ.)"], ["fromTR", "รับน้ำจาก TR"],
    ["flowIn", "Flow เข้า (ลบ.ม./ชม.)", "num"], ["pressureIn", "แรงดันเข้า (ม.)", "num"],
    ["pressureOut", "แรงดันออก (ม.)", "num"], ["rtu", "รหัส RTU"],
    ["pumps", "ปั๊ม (เดิน/สำรอง)"], ["note", "หมายเหตุ"],
  ];

  function renderTable(el, rows, cols) {
    el.innerHTML =
      `<thead><tr>${cols.map(([, h]) => `<th>${esc(h)}</th>`).join("")}</tr></thead>` +
      `<tbody>${rows
        .map((r, ri) =>
          `<tr>${cols
            .map(([k, , t]) =>
              `<td class="${t === "num" ? "num" : ""}" data-ri="${ri}" data-k="${k}" ${editing ? 'contenteditable="true"' : ""}>${t === "num" ? numFmt(r[k]) : esc(r[k] || (editing ? "" : "—"))}</td>`)
            .join("")}</tr>`)
        .join("")}</tbody>`;
  }
  function renderNetwork() {
    renderTable($("#tr-table"), net.trs, TR_COLS);
    renderTable($("#sj-table"), net.stations, SJ_COLS);
    if (editing) {
      document.querySelectorAll("table.net td[contenteditable]").forEach((td) => {
        td.addEventListener("blur", () => {
          const list = td.closest("#tr-table") ? net.trs : net.stations;
          const row = list[+td.dataset.ri];
          const raw = td.textContent.trim();
          const isNum = td.classList.contains("num");
          row[td.dataset.k] = isNum ? (raw === "" || raw === "—" ? null : Number(raw.replace(/[^\d.]/g, "")) || null) : raw;
          localStorage.setItem(NET_KEY, JSON.stringify(net));
        });
      });
    }
  }
  renderNetwork();

  $("#net-edit").addEventListener("click", () => {
    editing = !editing;
    $("#net-edit").textContent = "✏️ โหมดแก้ไข: " + (editing ? "เปิด" : "ปิด");
    renderNetwork();
  });
  $("#net-export").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(net, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "water-network-data.json";
    a.click();
    URL.revokeObjectURL(a.href);
  });
  $("#net-reset").addEventListener("click", () => {
    if (!confirm("ล้างข้อมูลที่แก้ไขทั้งหมด แล้วกลับไปใช้ค่าตั้งต้นในไฟล์ data.js ?")) return;
    localStorage.removeItem(NET_KEY);
    net = JSON.parse(JSON.stringify(D.network));
    renderNetwork();
  });

  /* ---------------- Handover (รับ-ส่งเวร) ---------------- */
  const HO_KEY = "waterkm.handover.v1";
  let hoLog = [];
  try { hoLog = JSON.parse(localStorage.getItem(HO_KEY) || "[]"); } catch (e) { hoLog = []; }

  $("#ho-shift").innerHTML = D.handover.shifts
    .map((s) => `<option>${esc(s)}</option>`).join("");
  $("#ho-checklist").innerHTML = D.handover.checklist
    .map((c) => `<li>${esc(c)}</li>`).join("");
  $("#ho-date").value = new Date().toISOString().slice(0, 10);

  function renderHoLog() {
    if (!hoLog.length) {
      $("#ho-log").innerHTML = `<p class="ho-empty">ยังไม่มีบันทึกเวร — กรอกฟอร์มด้านซ้ายแล้วกดบันทึก</p>`;
      return;
    }
    $("#ho-log").innerHTML = hoLog
      .map(
        (r, i) => `<div class="ho-log-item">
          <div class="top">
            <b>${esc(r.date)} · ${esc(r.shift)}</b>
            <button class="del" data-i="${i}">ลบ</button>
          </div>
          <p><b>ส่ง:</b> ${esc(r.from || "—")} → <b>รับ:</b> ${esc(r.to || "—")}
          · <b>แรงดันออก:</b> ${esc(r.pressure || "—")} ม. · <b>ปั๊ม:</b> ${esc(r.pumps || "—")}</p>
          ${r.note ? `<p>${esc(r.note)}</p>` : ""}
        </div>`
      )
      .join("");
    document.querySelectorAll("#ho-log .del").forEach((b) =>
      b.addEventListener("click", () => {
        if (!confirm("ลบบันทึกรายการนี้?")) return;
        hoLog.splice(+b.dataset.i, 1);
        localStorage.setItem(HO_KEY, JSON.stringify(hoLog));
        renderHoLog();
      }));
  }
  renderHoLog();

  $("#ho-save").addEventListener("click", () => {
    const rec = {
      date: $("#ho-date").value,
      shift: $("#ho-shift").value,
      from: $("#ho-from").value.trim(),
      to: $("#ho-to").value.trim(),
      pressure: $("#ho-pressure").value,
      pumps: $("#ho-pumps").value.trim(),
      note: $("#ho-note").value.trim(),
    };
    if (!rec.date || (!rec.from && !rec.to && !rec.note)) {
      alert("กรอกอย่างน้อย วันที่ + ผู้ส่ง/ผู้รับ หรือเหตุการณ์ในเวร");
      return;
    }
    hoLog.unshift(rec);
    localStorage.setItem(HO_KEY, JSON.stringify(hoLog));
    $("#ho-from").value = ""; $("#ho-to").value = "";
    $("#ho-pressure").value = ""; $("#ho-pumps").value = ""; $("#ho-note").value = "";
    renderHoLog();
  });

  $("#ho-export").addEventListener("click", () => {
    const head = ["วันที่", "เวร", "ผู้ส่ง", "ผู้รับ", "แรงดันออก(ม.)", "ปั๊ม", "เหตุการณ์/งานค้าง"];
    const lines = [head.join(",")].concat(
      hoLog.map((r) =>
        [r.date, r.shift, r.from, r.to, r.pressure, r.pumps, (r.note || "").replace(/\n/g, " ")]
          .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
          .join(","))
    );
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "handover-log.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  });

  /* ---------------- Addons ---------------- */
  $("#addon-grid").innerHTML = D.addons
    .map(
      (a) => `<div class="card addon-card">
        <h3>${esc(a.topic)}</h3>
        <p>${esc(a.body)}</p>
        <div class="who">${esc(a.by || "")}${a.date ? " · " + esc(a.date) : ""}</div>
      </div>`
    )
    .join("");

  /* ---------------- nav active state ---------------- */
  const sections = [...document.querySelectorAll("section.panel")];
  const navLinks = [...document.querySelectorAll("nav.topnav a")];
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          navLinks.forEach((a) =>
            a.classList.toggle("active", a.getAttribute("href") === "#" + en.target.id));
        }
      });
    },
    { rootMargin: "-40% 0px -55% 0px" }
  );
  sections.forEach((s) => io.observe(s));
})();
