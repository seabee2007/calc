/** Pure CSS auth background — no image dependency, identical on first paint and refresh. */
export default function AuthPageBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#111827]" aria-hidden>
      <div className="absolute inset-0 bg-[linear-gradient(135deg,#0b1220_0%,#111827_42%,#0f172a_100%)]" />

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_76%_45%,rgba(34,211,238,0.20),transparent_30%),radial-gradient(circle_at_18%_24%,rgba(14,165,233,0.10),transparent_34%)]" />

      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_78%_50%,rgba(8,47,73,0.42),transparent_42%)]" />

      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/5 via-slate-950/10 to-slate-950/35" />
    </div>
  );
}
