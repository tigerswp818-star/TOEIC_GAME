/**
 * Typed unit-conversion library for the fluid mechanics lab.
 *
 * Every unit converts to a common SI base for its category via:
 *   base = value * factor + offset
 * and back via:
 *   value = (base - offset) / factor
 *
 * All units here are pure factors (offset = 0), but the offset is supported
 * so the helper stays correct if temperature-style units are ever added.
 */

export interface Unit {
  /** Symbol shown in the UI, e.g. "kPa". */
  symbol: string;
  /** Thai (or descriptive) name to help learners. */
  name: string;
  /** Multiply a value in this unit by `factor` to get the SI base. */
  factor: number;
  /** Additive offset (base = value * factor + offset). Default 0. */
  offset?: number;
}

export interface UnitCategory {
  /** Stable id for selection state. */
  id: string;
  /** Thai + English label, e.g. "ความดัน Pressure". */
  label: string;
  /** Symbol of the SI base unit, e.g. "Pa". */
  base: string;
  units: Unit[];
}

export const UNIT_CATEGORIES: UnitCategory[] = [
  {
    id: "pressure",
    label: "ความดัน Pressure",
    base: "Pa",
    units: [
      { symbol: "Pa", name: "ปาสคาล", factor: 1 },
      { symbol: "kPa", name: "กิโลปาสคาล", factor: 1000 },
      { symbol: "MPa", name: "เมกะปาสคาล", factor: 1e6 },
      { symbol: "bar", name: "บาร์", factor: 100000 },
      { symbol: "atm", name: "บรรยากาศ", factor: 101325 },
      { symbol: "psi", name: "ปอนด์ต่อตารางนิ้ว", factor: 6894.76 },
      { symbol: "mmHg", name: "มิลลิเมตรปรอท", factor: 133.322 },
      { symbol: "mH2O", name: "เมตรน้ำ", factor: 9806.65 },
    ],
  },
  {
    id: "length",
    label: "ความยาว Length",
    base: "m",
    units: [
      { symbol: "mm", name: "มิลลิเมตร", factor: 1e-3 },
      { symbol: "cm", name: "เซนติเมตร", factor: 1e-2 },
      { symbol: "m", name: "เมตร", factor: 1 },
      { symbol: "km", name: "กิโลเมตร", factor: 1000 },
      { symbol: "inch", name: "นิ้ว", factor: 0.0254 },
      { symbol: "ft", name: "ฟุต", factor: 0.3048 },
    ],
  },
  {
    id: "area",
    label: "พื้นที่ Area",
    base: "m²",
    units: [
      { symbol: "m²", name: "ตารางเมตร", factor: 1 },
      { symbol: "cm²", name: "ตารางเซนติเมตร", factor: 1e-4 },
      { symbol: "mm²", name: "ตารางมิลลิเมตร", factor: 1e-6 },
      { symbol: "ft²", name: "ตารางฟุต", factor: 0.092903 },
    ],
  },
  {
    id: "volume",
    label: "ปริมาตร Volume",
    base: "m³",
    units: [
      { symbol: "m³", name: "ลูกบาศก์เมตร", factor: 1 },
      { symbol: "L", name: "ลิตร", factor: 1e-3 },
      { symbol: "mL", name: "มิลลิลิตร", factor: 1e-6 },
      { symbol: "ft³", name: "ลูกบาศก์ฟุต", factor: 0.0283168 },
    ],
  },
  {
    id: "flow",
    label: "อัตราการไหล Flow rate",
    base: "m³/s",
    units: [
      { symbol: "m³/s", name: "ลูกบาศก์เมตรต่อวินาที", factor: 1 },
      { symbol: "L/s", name: "ลิตรต่อวินาที", factor: 1e-3 },
      { symbol: "L/min", name: "ลิตรต่อนาที", factor: 1.66667e-5 },
      { symbol: "m³/hr", name: "ลูกบาศก์เมตรต่อชั่วโมง", factor: 2.77778e-4 },
      { symbol: "gpm", name: "แกลลอนต่อนาที", factor: 6.30902e-5 },
      { symbol: "cfm", name: "ลูกบาศก์ฟุตต่อนาที", factor: 4.71947e-4 },
    ],
  },
  {
    id: "velocity",
    label: "ความเร็ว Velocity",
    base: "m/s",
    units: [
      { symbol: "m/s", name: "เมตรต่อวินาที", factor: 1 },
      { symbol: "km/h", name: "กิโลเมตรต่อชั่วโมง", factor: 0.277778 },
      { symbol: "ft/s", name: "ฟุตต่อวินาที", factor: 0.3048 },
    ],
  },
  {
    id: "density",
    label: "ความหนาแน่น Density",
    base: "kg/m³",
    units: [
      { symbol: "kg/m³", name: "กิโลกรัมต่อลูกบาศก์เมตร", factor: 1 },
      { symbol: "g/cm³", name: "กรัมต่อลูกบาศก์เซนติเมตร", factor: 1000 },
      { symbol: "lb/ft³", name: "ปอนด์ต่อลูกบาศก์ฟุต", factor: 16.0185 },
    ],
  },
  {
    id: "dynamic-viscosity",
    label: "ความหนืดพลวัต Dynamic viscosity",
    base: "Pa·s",
    units: [
      { symbol: "Pa·s", name: "ปาสคาล-วินาที", factor: 1 },
      { symbol: "cP", name: "เซนติพอยส์", factor: 1e-3 },
      { symbol: "N·s/m²", name: "นิวตัน-วินาทีต่อตารางเมตร", factor: 1 },
    ],
  },
  {
    id: "kinematic-viscosity",
    label: "ความหนืดจลน์ Kinematic viscosity",
    base: "m²/s",
    units: [
      { symbol: "m²/s", name: "ตารางเมตรต่อวินาที", factor: 1 },
      { symbol: "cSt", name: "เซนติสโตกส์", factor: 1e-6 },
    ],
  },
  {
    id: "force",
    label: "แรง Force",
    base: "N",
    units: [
      { symbol: "N", name: "นิวตัน", factor: 1 },
      { symbol: "kN", name: "กิโลนิวตัน", factor: 1000 },
      { symbol: "lbf", name: "ปอนด์-แรง", factor: 4.44822 },
    ],
  },
  {
    id: "power",
    label: "กำลัง Power",
    base: "W",
    units: [
      { symbol: "W", name: "วัตต์", factor: 1 },
      { symbol: "kW", name: "กิโลวัตต์", factor: 1000 },
      { symbol: "hp", name: "แรงม้า", factor: 745.7 },
    ],
  },
  {
    id: "head",
    label: "เฮด/พลังงาน Head/Energy",
    base: "m",
    units: [
      { symbol: "m", name: "เมตร", factor: 1 },
      { symbol: "ft", name: "ฟุต", factor: 0.3048 },
    ],
  },
  // ── หมวดสถานีสูบจ่ายน้ำ Pump Station ──
  {
    id: "energy",
    label: "พลังงาน Energy",
    base: "J",
    units: [
      { symbol: "J", name: "จูล", factor: 1 },
      { symbol: "kJ", name: "กิโลจูล", factor: 1000 },
      { symbol: "MJ", name: "เมกะจูล", factor: 1e6 },
      { symbol: "Wh", name: "วัตต์-ชั่วโมง", factor: 3600 },
      { symbol: "kWh", name: "กิโลวัตต์-ชั่วโมง (หน่วยไฟ)", factor: 3.6e6 },
    ],
  },
  {
    id: "specific-energy",
    label: "พลังงานจำเพาะ Specific energy",
    base: "J/m³",
    units: [
      { symbol: "J/m³", name: "จูลต่อลูกบาศก์เมตร", factor: 1 },
      { symbol: "Wh/m³", name: "วัตต์ชั่วโมงต่อลูกบาศก์เมตร", factor: 3600 },
      { symbol: "kWh/m³", name: "กิโลวัตต์ชั่วโมงต่อลูกบาศก์เมตร", factor: 3.6e6 },
    ],
  },
  {
    id: "rotational-speed",
    label: "ความเร็วรอบ Rotational speed",
    base: "rad/s",
    units: [
      { symbol: "rad/s", name: "เรเดียนต่อวินาที", factor: 1 },
      { symbol: "rpm", name: "รอบต่อนาที", factor: 0.1047198 },
      { symbol: "deg/s", name: "องศาต่อวินาที", factor: 0.0174533 },
    ],
  },
  {
    id: "frequency",
    label: "ความถี่ Frequency",
    base: "Hz",
    units: [
      { symbol: "Hz", name: "เฮิรตซ์", factor: 1 },
      { symbol: "kHz", name: "กิโลเฮิรตซ์", factor: 1000 },
      { symbol: "rpm", name: "รอบต่อนาที (เทียบ)", factor: 1 / 60 },
    ],
  },
  {
    id: "current",
    label: "กระแสไฟฟ้า Current",
    base: "A",
    units: [
      { symbol: "A", name: "แอมแปร์", factor: 1 },
      { symbol: "mA", name: "มิลลิแอมแปร์", factor: 1e-3 },
      { symbol: "kA", name: "กิโลแอมแปร์", factor: 1000 },
    ],
  },
  {
    id: "voltage",
    label: "แรงดันไฟฟ้า Voltage",
    base: "V",
    units: [
      { symbol: "V", name: "โวลต์", factor: 1 },
      { symbol: "mV", name: "มิลลิโวลต์", factor: 1e-3 },
      { symbol: "kV", name: "กิโลโวลต์", factor: 1000 },
    ],
  },
  {
    id: "efficiency",
    label: "ประสิทธิภาพ Efficiency",
    base: "—",
    units: [
      { symbol: "—", name: "สัดส่วน (0–1)", factor: 1 },
      { symbol: "%", name: "เปอร์เซ็นต์", factor: 0.01 },
    ],
  },
];

/** Look up a category by id. */
export const findCategory = (id: string): UnitCategory | undefined =>
  UNIT_CATEGORIES.find((c) => c.id === id);

/** Look up a unit by symbol within a category. */
export const findUnit = (
  category: UnitCategory,
  symbol: string,
): Unit | undefined => category.units.find((u) => u.symbol === symbol);

/**
 * Convert `value` from one unit to another within the given category.
 *
 * @param value      numeric value in `fromUnit`
 * @param fromUnit   source unit symbol
 * @param toUnit     target unit symbol
 * @param category   category id the units belong to
 * @returns the converted value, or NaN if a unit/category is unknown
 */
export const convert = (
  value: number,
  fromUnit: string,
  toUnit: string,
  category: string,
): number => {
  const cat = findCategory(category);
  if (!cat) return NaN;
  const from = findUnit(cat, fromUnit);
  const to = findUnit(cat, toUnit);
  if (!from || !to) return NaN;
  const base = value * from.factor + (from.offset ?? 0);
  return (base - (to.offset ?? 0)) / to.factor;
};
