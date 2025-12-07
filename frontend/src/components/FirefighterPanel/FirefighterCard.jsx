import React from "react";
import {
  MdOpacity,
  MdAccessTime,
  MdDirectionsRun,
  MdLayers,
  MdPerson,
} from "react-icons/md";
import { FaBatteryHalf } from "react-icons/fa6";
import { FaRegHeart } from "react-icons/fa";
import { IoLocateOutline, IoWarning } from "react-icons/io5"; 
import "../style.css";

// Dodajemy prop 'activeAlerts'
export default function FirefighterCard({ data, onSelect, isSelected, activeAlerts = [] }) {
  const f = data.firefighter;
  const v = data.vitals || {};
  const s = data.scba || {};
  const d = data.device || {};
  const pos = data.position || {};

  const heartRate = v.heart_rate_bpm ?? "?";
  const timeLeft = s.remaining_time_min ?? "?";

  // Kolory dynamiczne
  const hrColor = heartRate > 180 ? "var(--color-critical)" : heartRate > 120 ? "var(--color-warning)" : "var(--color-ok)";
  const timeClass = timeLeft < 10 ? "critical" : timeLeft < 20 ? "warning" : "";

  const moveMap = {
    stationary: "Stop",
    walking: "Chód",
    running: "Bieg",
    fallen: "Upadek",
    climbing: "Wspina"
  };

  /** * 🔥 STATUS KARTY
   * Karta jest "czerwona" (alert-active), jeśli:
   * 1. Są aktywne alerty z bazy (SOS, Bezruch) - przekazane w activeAlerts
   * 2. LUB parametry telemetryczne są krytyczne (tętno, bateria, ciśnienie)
   */
  const hasDbAlerts = activeAlerts.length > 0;
  
  const hasTelemetryAlarm =
    s.alarms?.very_low_pressure ||
    v.stress_level === "critical" ||
    timeLeft < 10 ||
    heartRate > 180 ||
    d.battery_percent < 10;

  const isAlertState = hasDbAlerts || hasTelemetryAlarm;

  const handleLocateClick = (e) => {
    e.stopPropagation(); 
    onSelect(); 
  };

  return (
    <div
      className={`ff-mini-card ${isSelected ? "selected" : ""} ${isAlertState ? "alert-active" : ""}`}
      onClick={onSelect}
    >
      {/* Nagłówek */}
      <div className="ff-mini-head">
        <div className="avatar">
          <MdPerson size={24} />
        </div>
        
        <div className="info">
          <div className="name">{f.name}</div>
          <div className="sub">{f.rank} · {f.role}</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="team">{f.team}</div>
            <button className="locate-btn" onClick={handleLocateClick} title="Pokaż na mapie">
                <IoLocateOutline />
            </button>
        </div>
      </div>

      {/* --- SEKCJA ALERTÓW Z BAZY (Widoczna tylko gdy są alerty) --- */}
      {hasDbAlerts && (
        <div className="card-alerts-list">
          {activeAlerts.map(alert => (
            <div key={alert.id} className="mini-alert-badge">
              <IoWarning className="alert-icon-small" /> 
              <span>{alert.type} ({new Date(alert.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})})</span>
            </div>
          ))}
        </div>
      )}

      {/* Siatka metryk */}
      <div className="ff-mini-grid">
        <MiniTile icon={<FaRegHeart />} color={hrColor} label="BPM" value={heartRate} />
        <MiniTile icon={<MdLayers />} color="var(--color-blue)" label="Piętro" value={pos.floor ?? "?"} />
        <MiniTile
          icon={<FaBatteryHalf />}
          color="var(--color-ok)"
          label="Bateria"
          value={`${d.battery_percent ?? "?"}%`}
        />
        <MiniTile
          icon={<MdDirectionsRun />}
          color="var(--color-ok)"
          label="Ruch"
          value={moveMap[v.motion_state] ?? "-"}
        />
        <MiniTile
          icon={<MdOpacity />}
          color={timeClass === "critical" ? "var(--color-critical)" : timeClass === "warning" ? "var(--color-warning)" : "var(--color-blue)"}
          label="Powietrze"
          value={`${s.cylinder_pressure_bar ?? "?"} bar`}
        />
        <MiniTile
          icon={<MdAccessTime />}
          color={timeClass === "critical" ? "var(--color-critical)" : timeClass === "warning" ? "var(--color-warning)" : "var(--color-ok)"}
          label="Czas"
          value={`${timeLeft} min`}
        />
      </div>
    </div>
  );
}

function MiniTile({ icon, label, value, color }) {
  return (
    <div className="mini-tile">
      <div className="tile-value" style={{ color }}>
        {icon} {value}
      </div>
      <div className="tile-label">{label}</div>
    </div>
  );
}