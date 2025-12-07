// Wewnątrz MetricBig.jsx
export default function MetricBig({ label, value, customClass }) {
  return (
    <div className={`metric-big ${customClass}`}> {/* tutaj dodajemy klasę */}
      <div className="metric-big-value">{value}</div>
      <div className="metric-big-label">{label}</div>
    </div>
  );
}