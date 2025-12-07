import React, { useEffect, useState } from "react";
import "../../styles.css";
import MetricBig from "./MetricBig";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

const MAP = {
  motion: {
    walking: "Chód",
    running: "Bieg",
    stationary: "Bezruch",
    crawling: "Czołganie",
    climbing: "Wspinaczka",
    fallen: "Upadek",
    unknown: "Nieznany"
  },
  pass: {
    active: "Aktywny",
    alarm: "ALARM",
    pre_alarm: "Pre-Alarm",
    off: "Wyłączony"
  },
  connection: {
    connected: "Połączony",
    disconnected: "Rozłączony",
    lora: "LoRa WAN",
    ble: "Bluetooth",
    lte: "LTE / 4G"
  },
  hr_zone: {
    rest: "Spoczynek",
    light: "Lekka",
    moderate: "Umiarkowana",
    hard: "Wysoka",
    max: "Maksymalna"
  }
};

const t = (category, key) => (MAP[category] && MAP[category][key]) ? MAP[category][key] : (key || "-");

const CollapsibleSection = ({ title, isOpen, onToggle, badges = [], children, hasCritical = false }) => {
  return (
    <div className="collapsible-wrapper">
      <div className={`section-header ${hasCritical ? 'has-critical' : ''}`} onClick={onToggle}>
        <div className="section-title-wrapper">
          <h4 className="section-title">{title}</h4>
          <div className="header-badges">
            {badges.map((b, i) => (
              <span key={i} className={`badge ${b.type}`}>{b.text}</span>
            ))}
          </div>
        </div>
        <div className={`section-toggle-icon ${isOpen ? "open" : ""}`}>▼</div>
      </div>
      <div className={`section-content ${isOpen ? "" : "collapsed"}`}>
        {children}
      </div>
    </div>
  );
};

export default function FirefighterDetail({ data, onBack }) {
  const f = data.firefighter || {};
  const v = data.vitals || {};
  const s = data.scba || {};
  const d = data.device || {};
  const pos = data.position || {};
  const imu = data.imu || {};
  const baro = data.barometer || {};
  const pass = data.pass_status || {};
  const recco = data.recco || {};
  const box = data.black_box || {};
  const letter = f.name ? f.name.charAt(0).toUpperCase() : "?";

  const [sections, setSections] = useState({
    vitals: true,   // Parametry życiowe na górze - otwarte
    alerts: true,   // Alerty pod spodem - otwarte
    chart: true,
    position: true,
    sensors: false,
    device: false,
  });

  const toggleSection = (key) => setSections((prev) => ({ ...prev, [key]: !prev[key] }));

  // --- Logika Alertów ---
  const [alertHistory, setAlertHistory] = useState([]);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    const now = new Date().toLocaleTimeString();
    const alerts = [];

    if (s.alarms?.very_low_pressure) alerts.push({ level: "critical", text: "Krytyczne ciśnienie SCBA!", time: now });
    else if (s.alarms?.low_pressure) alerts.push({ level: "warning", text: "Niskie ciśnienie SCBA", time: now });
    
    if (pass.alarm_active) alerts.push({ level: "critical", text: "PASS: Wykryto bezruch (ALARM)", time: now });
    if (v.stress_level === "critical") alerts.push({ level: "critical", text: "Krytyczny poziom stresu", time: now });
    if (d.sos_button_pressed) alerts.push({ level: "critical", text: "Wezwano SOS!", time: now });
    if (d.battery_percent < 20) alerts.push({ level: "warning", text: "Niski poziom baterii", time: now });

    if (alerts.length > 0) {
      setAlertHistory((prev) => [...alerts, ...prev].slice(0, 15));
    }
  }, [s.alarms, pass.alarm_active, v.stress_level, d.sos_button_pressed, d.battery_percent]);

  // --- Wykres HR ---
  const [hrHistory, setHrHistory] = useState([]);
  useEffect(() => {
    if (v.heart_rate_bpm != null) setHrHistory((prev) => [...prev, v.heart_rate_bpm].slice(-20));
  }, [v.heart_rate_bpm]);

  const hrData = {
    labels: hrHistory.map((_, i) => i),
    datasets: [
      {
        label: "BPM",
        data: hrHistory,
        borderColor: "#37f58c", // Jaskrawy zielony medyczny
        backgroundColor: "rgba(55, 245, 140, 0.1)", // Lekkie wypełnienie pod wykresem
        borderWidth: 2,
        pointRadius: 0, // Ukrywamy punkty, żeby była ciągła linia
        pointHoverRadius: 4,
        tension: 0.2, // Lekko kanciasta linia (bardziej techniczny wygląd)
        fill: true,   // Wypełnienie obszaru pod wykresem (opcjonalne)
      },
    ],
  };

  const hrOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 0 // Wyłączamy animację wchodzenia, aby wyglądało na "real-time"
    },
    interaction: {
      mode: 'index',
      intersect: false,
    },
    scales: {
      x: {
        display: false,
      },
      y: {
        min: 40,
        max: 200,
        grid: {
          color: "rgba(55, 245, 140, 0.15)",
          lineWidth: 1,
        },
        border: { display: false },
        ticks: {
          color: "#37f58c", // Zielone cyfry
          font: { family: "monospace", size: 10 },
          stepSize: 40,
          callback: function(value) { return value + ' ❤'; } // Dodatek serduszka przy osi
        },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: true,
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        titleColor: "#37f58c",
        bodyColor: "#eee",
        borderColor: "#37f58c",
        borderWidth: 1,
        displayColors: false,
        callbacks: {
            label: (context) => `Tętno: ${context.raw} BPM`
        }
      },
    },
  };

  // --- Kolory i Klasy (Logika podświetlania) ---
  const getScbaStatus = () => {
    if (s.alarms?.very_low_pressure) return "metric-critical";
    if (s.alarms?.low_pressure) return "metric-warning";
    return ""; // Domyślny
  };

  const getPassClass = () => {
    if (pass.alarm_active) return "metric-critical";
    if (pass.status === "pre_alarm") return "metric-warning";
    return "metric-normal";
  };
  
  const getStressClass = () => {
      if (v.stress_level === "critical") return "metric-critical";
      if (v.stress_level === "high") return "metric-warning";
      return "";
  };

  const filteredAlerts = filter === "all" ? alertHistory : alertHistory.filter(a => filter === "critical" ? a.level === "critical" : a.level === "warning");
  const hasCriticalAlerts = alertHistory.some(a => a.level === "critical");

  return (
    <div className="ff-detail">
      <button className="btn-back" onClick={onBack}>← Powrót</button>

      {/* HEADER */}
      <div className="ff-header">
        <div className={`ff-avatar large ${d.sos_button_pressed ? 'pulse sos' : ''}`}>{letter}</div>
        <div className="ff-info">
          <h3>{f.name}</h3>
          <p>{f.rank} · {f.role}</p>
        </div>
        <div className="ff-team">
          {f.team} 
          <span style={{marginLeft: 8, fontSize: '0.8em', color: '#aaa'}}>
             ● {t('connection', d.connection_primary)}
          </span>
        </div>
      </div>

      {/* --- SEKCJA 1: PARAMETRY ŻYCIOWE i SCBA (Teraz na górze) --- */}
      <CollapsibleSection 
        title="Parametry"
        isOpen={sections.vitals} 
        onToggle={() => toggleSection('vitals')}
        badges={v.stress_level === 'critical' ? [{text: 'STRES!', type: 'critical'}] : []}
      >
        <div className="ff-stats-grid">
          {/* Tętno - kolorowanie tekstu przez klasę CSS metric-critical/warning */}
          <MetricBig 
            label="Tętno" 
            value={`${v.heart_rate_bpm ?? "?"} bpm`} 
            customClass={getStressClass()} 
          />
          
          <MetricBig label="Strefa HR" value={t('hr_zone', v.hr_zone)} />
          
          <MetricBig 
            label="Stres" 
            value={v.stress_level === 'critical' ? 'KRYTYCZNY' : (v.stress_level === 'high' ? 'WYSOKI' : 'Norma')} 
            customClass={getStressClass()} 
          />

          {/* SCBA - Klasa zmienia kolor ramki I tekstu */}
          <MetricBig 
            label="Ciśnienie SCBA" 
            value={`${s.cylinder_pressure_bar ?? "?"} bar`} 
            customClass={getScbaStatus()} 
          />
          
          <MetricBig 
            label="Czas pracy" 
            value={`${s.remaining_time_min ?? "?"} min`}
            customClass={s.remaining_time_min < 10 ? (s.remaining_time_min < 5 ? 'metric-critical' : 'metric-warning') : ''}
          />
          
          <MetricBig label="Zużycie" value={`${s.consumption_rate_lpm ?? "?"} L/min`} />

          <MetricBig 
            label="PASS Status" 
            value={t('pass', pass.status)} 
            customClass={getPassClass()} 
          />
          
          <MetricBig label="Ruch" value={t('motion', v.motion_state)} />
          <MetricBig label="Temp. skóry" value={`${v.skin_temperature_c ?? "?"}°C`} />
        </div>
      </CollapsibleSection>

      {/* --- SEKCJA 2: CENTRUM POWIADOMIEŃ (Teraz jako drugie) --- */}
      <CollapsibleSection 
        title="Centrum Powiadomień" 
        isOpen={sections.alerts} 
        onToggle={() => toggleSection('alerts')}
        hasCritical={hasCriticalAlerts}
        badges={[{ text: `${alertHistory.length}`, type: hasCriticalAlerts ? 'critical' : 'neutral' }]}
      >
        <div className="alert-filters">
           <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>Wszystkie</button>
           <button className={filter === "warning" ? "active" : ""} onClick={() => setFilter("warning")}>Ostrzeżenia</button>
           <button className={filter === "critical" ? "active" : ""} onClick={() => setFilter("critical")}>Krytyczne</button>
        </div>
        <div className="ff-alert-list">
          {filteredAlerts.length === 0 ? <p className="no-alerts">Brak nowych alertów</p> : 
            filteredAlerts.map((a, i) => (
              <div key={i} className={`alert-item alert-${a.level}`}>
                <span className="alert-time">{a.time}</span>
                <span className="alert-text">{a.text}</span>
              </div>
            ))
          }
        </div>
      </CollapsibleSection>

      {/* --- SEKCJA 3: WYKRES --- */}
      <CollapsibleSection title="Monitoring Pracy Serca" isOpen={sections.chart} onToggle={() => toggleSection('chart')}>
        <div className="medical-chart-wrapper">
          <div className="medical-background"></div>
          {/* <div className="scan-line"></div>  <-- Opcjonalnie: odkomentuj dla efektu skanera */}
          <div className="medical-chart-canvas" style={{ height: '120px' }}>
            <Line data={hrData} options={hrOptions} />
          </div>
          <div style={{
              position: 'absolute', top: 10, right: 15, 
              color: '#37f58c', fontFamily: 'monospace', fontSize: '0.7rem',
              opacity: 0.7
          }}>
              Tętno // 25mm/s
          </div>
        </div>
      </CollapsibleSection>

      {/* --- SEKCJA 4: POZYCJA --- */}
      <CollapsibleSection 
        title="Lokalizacja" 
        isOpen={sections.position} 
        onToggle={() => toggleSection('position')}
        badges={[{text: `Piętro: ${pos.floor ?? 0}`, type: 'neutral'}]}
      >
        <div className="ff-stats-grid">
          <MetricBig label="Piętro (Est)" value={pos.floor ?? "0"} />
          <MetricBig label="Dokładność" value={`±${pos.accuracy_m ?? "?"}m`} />
          <MetricBig label="Źródło" value={pos.source === 'uwb_fusion' ? 'UWB+IMU' : pos.source} />
          
          <MetricBig label="GPS Sat" value={pos.gps?.satellites ?? 0} />
          <MetricBig label="Kierunek" value={`${data.heading_deg ?? 0}°`} />
          <MetricBig label="Dryf" value={`${pos.drift?.drift_total_m ?? 0} m`} />
        </div>
        
        {/* Szczegóły UWB */}
        <div className="ff-extra" style={{marginTop: 10, padding: 10, background: '#222', borderRadius: 8}}>
            <small style={{color: '#888', display: 'block', marginBottom: 5}}>Widoczne kotwice UWB:</small>
            <div style={{display: 'flex', flexWrap: 'wrap', gap: 6}}>
                {data.uwb_measurements?.map((m, i) => (
                    <span key={i} style={{fontSize: '0.8rem', background: '#333', padding: '3px 8px', borderRadius: 4, color: '#aaa'}}>
                        {m.beacon_name || m.beacon_id} <span style={{color: '#37f58c'}}>({m.range_m}m)</span>
                    </span>
                ))}
            </div>
        </div>
      </CollapsibleSection>

      {/* --- SEKCJA 5: SENSORY FIZYCZNE --- */}
      <CollapsibleSection title="Środowisko i Sensory" isOpen={sections.sensors} onToggle={() => toggleSection('sensors')}>
        <div className="ff-stats-grid">
          <MetricBig label="Ciśnienie Atm." value={`${(baro.pressure_pa / 100).toFixed(1)} hPa`} />
          <MetricBig label="Temp. Otoczenia" value={`${baro.temperature_c ?? "?"}°C`} />
          <MetricBig label="Wysokość Rel." value={`${baro.altitude_rel_m ?? "?"} m`} />
          <MetricBig label="Pochył (Pitch)" value={`${imu.orientation?.pitch ?? 0}°`} />
          <MetricBig label="Przechył (Roll)" value={`${imu.orientation?.roll ?? 0}°`} />
          <MetricBig label="Prędkość Pion." value={`${baro.vertical_speed_mps ?? 0} m/s`} />
        </div>
      </CollapsibleSection>

       {/* --- SEKCJA 6: DIAGNOSTYKA --- */}
       <CollapsibleSection title="Urządzenie" isOpen={sections.device} onToggle={() => toggleSection('device')}>
        <div className="ff-stats-grid">
          <MetricBig 
            label="Bateria Tag" 
            value={`${d.battery_percent ?? "?"}%`} 
            customClass={d.battery_percent < 20 ? 'metric-warning' : ''} 
          />
          <MetricBig label="Bateria SCBA" value={`${s.battery_percent ?? "?"}%`} />
          <MetricBig label="LoRa RSSI" value={`${d.lora_rssi_dbm ?? "?"} dBm`} />
          <MetricBig label="Czarna Skrzynia" value={box.recording ? "Nagrywa" : "Stop"} />
          <MetricBig label="Pamięć BB" value={`${box.storage_used_percent ?? 0}%`} />
          <MetricBig label="Firmware" value={d.firmware_version ?? "?"} />
        </div>
      </CollapsibleSection>

      {/* RECCO Status */}
      {recco.detected && (
        <div style={{
            marginTop: 16, padding: 12, borderRadius: 6, 
            background: 'rgba(55, 245, 140, 0.2)', border: '1px solid #37f58c',
            textAlign: 'center', fontSize: '1rem', fontWeight: 'bold', color: '#37f58c'
        }}>
            ⚠️ RECCO: Wykryto sygnał [{recco.location}]
        </div>
      )}

    </div>
  );
}