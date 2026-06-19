import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <p className="text-6xl">🌊</p>
      <h1 className="mt-4 text-2xl font-bold text-ink">404 — ไหลออกนอกเส้นทาง</h1>
      <p className="mt-2 text-sm text-ink-soft">ไม่พบหน้านี้ ลองกลับไปที่ห้องทดลอง</p>
      <Link to="/" className="lab-btn-primary mt-6">
        ← กลับหน้าแรก
      </Link>
    </div>
  );
}
