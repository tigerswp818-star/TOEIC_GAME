/**
 * Unit-conversion engine.
 *
 * Strategy: every quantity has one SI base unit and a table of factors that map
 * each supported unit *to* the base unit. Converting A → B is therefore just
 * `value * factor[A] / factor[B]`. This keeps the converter trivial to extend —
 * add a row to a table and it works everywhere.
 */

export interface UnitDef {
  /** Symbol shown in the UI, e.g. "kPa". */
  id: string;
  /** Human label, e.g. "กิโลพาสคัล". */
  label: string;
  /** Multiplier that converts this unit's value to the base SI unit. */
  toBase: number;
}

export interface UnitCategory {
  id: string;
  name: string;
  nameEn: string;
  /** The SI base unit id for this category (one of the units below). */
  baseUnit: string;
  units: UnitDef[];
}

export const UNIT_CATEGORIES: UnitCategory[] = [
  {
    id: "pressure",
    name: "ความดัน",
    nameEn: "Pressure",
    baseUnit: "Pa",
    units: [
      { id: "Pa", label: "ปาสคาล (Pa)", toBase: 1 },
      { id: "kPa", label: "กิโลปาสคาล (kPa)", toBase: 1000 },
      { id: "bar", label: "บาร์ (bar)", toBase: 100000 },
      { id: "atm", label: "บรรยากาศ (atm)", toBase: 101325 },
      { id: "psi", label: "ปอนด์ต่อตารางนิ้ว (psi)", toBase: 6894.757293168 },
    ],
  },
  {
    id: "length",
    name: "ความยาว",
    nameEn: "Length",
    baseUnit: "m",
    units: [
      { id: "m", label: "เมตร (m)", toBase: 1 },
      { id: "cm", label: "เซนติเมตร (cm)", toBase: 0.01 },
      { id: "mm", label: "มิลลิเมตร (mm)", toBase: 0.001 },
      { id: "ft", label: "ฟุต (ft)", toBase: 0.3048 },
    ],
  },
  {
    id: "flow",
    name: "อัตราการไหล",
    nameEn: "Flow rate",
    baseUnit: "m3s",
    units: [
      { id: "m3s", label: "ลูกบาศก์เมตรต่อวินาที (m³/s)", toBase: 1 },
      { id: "Ls", label: "ลิตรต่อวินาที (L/s)", toBase: 0.001 },
      { id: "Lmin", label: "ลิตรต่อนาที (L/min)", toBase: 0.001 / 60 },
      { id: "gpm", label: "แกลลอนต่อนาที (US gpm)", toBase: 0.003785411784 / 60 },
    ],
  },
  {
    id: "density",
    name: "ความหนาแน่น",
    nameEn: "Density",
    baseUnit: "kgm3",
    units: [
      { id: "kgm3", label: "กิโลกรัมต่อลูกบาศก์เมตร (kg/m³)", toBase: 1 },
      { id: "gcm3", label: "กรัมต่อลูกบาศก์เซนติเมตร (g/cm³)", toBase: 1000 },
    ],
  },
  {
    id: "viscosity",
    name: "ความหนืด",
    nameEn: "Dynamic viscosity",
    baseUnit: "Pas",
    units: [
      { id: "Pas", label: "ปาสคาล·วินาที (Pa·s)", toBase: 1 },
      { id: "cP", label: "เซนติพอยส์ (cP)", toBase: 0.001 },
    ],
  },
  {
    id: "velocity",
    name: "ความเร็ว",
    nameEn: "Velocity",
    baseUnit: "ms",
    units: [
      { id: "ms", label: "เมตรต่อวินาที (m/s)", toBase: 1 },
      { id: "fts", label: "ฟุตต่อวินาที (ft/s)", toBase: 0.3048 },
    ],
  },
];

/** Convert `value` from unit `fromId` to unit `toId` within one category. */
export function convertUnit(
  value: number,
  fromId: string,
  toId: string,
  category: UnitCategory,
): number {
  const from = category.units.find((u) => u.id === fromId);
  const to = category.units.find((u) => u.id === toId);
  if (!from || !to) return NaN;
  // value (from) → base → to
  return (value * from.toBase) / to.toBase;
}
