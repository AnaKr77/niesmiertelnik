import React from "react";

export default function BeaconDetail({ data, onBack }) {
  const isOnline = data.status === "active";

  const getBatteryColor = (level) => {
    if (level > 60) return "#2ecc71";
    if (level > 30) return "#f39c12";
    return "#e74c3c";
  };

  const batteryColor = getBatteryColor(data.battery_percent);

  return (
    <div className="beacon-detail-view">
      {/* Przycisk powrotu */}
      <button className="btn-back" onClick={onBack}>
        ← Powrót
      </button>

      <div className={`beacon-card detail ${!isOnline ? "offline" : ""}`}>
        {/* NAGŁÓWEK */}
        <div className="beacon-header">
          <div className="beacon-identity">
            <span className="beacon-type">{data.type === 'entry' ? '🚪 WEJŚCIE' : '📍 PUNKT'}</span>
            <h3 className="beacon-name">{data.name}</h3>
            <span className="beacon-id">{data.id}</span>
          </div>
          
          <div className="beacon-status-container">
            <div className={`status-indicator ${data.status}`}>
              <span className="status-dot"></span>
              {isOnline ? "ONLINE" : "OFFLINE"}
            </div>
          </div>
        </div>

        {/* INFO BATERIA */}
        <div className="beacon-info-row">
          <span className="info-label">Bateria:</span>
          <span className="info-value" style={{ color: batteryColor, fontWeight: "bold" }}>
            {data.battery_percent}% <span style={{color: '#7f8c8d', fontWeight: 'normal'}}>({data.battery_voltage_mv}mV)</span>
          </span>
        </div>

        {/* SIATKA PARAMETRÓW */}
        <div className="beacon-stats-grid">
          <div className="stat-box">
            <span className="stat-label">Pozycja</span>
            <span className="stat-value">
              Piętro {data.floor} <small>(X:{data.position.x}, Y:{data.position.y})</small>
            </span>
          </div>
          <div className="stat-box">
            <span className="stat-label">Temperatura</span>
            <span className="stat-value">{data.temperature_c}°C</span>
          </div>
          <div className="stat-box">
            <span className="stat-label">Ostatni Ping</span>
            <span className="stat-value">{data.last_ping_ms} ms</span>
          </div>
          <div className="stat-box">
            <span className="stat-label">Sygnał</span>
            <span className="stat-value" style={{textTransform: 'capitalize'}}>{data.signal_quality}</span>
          </div>
        </div>

        {/* LISTA TAGÓW */}
        <div className="beacon-tags-section">
          <div className="section-title">
            W ZASIĘGU ({data.detected_tags.length})
          </div>
          {data.detected_tags.length > 0 ? (
            <div className="tags-list">
              {data.detected_tags.map((tag) => (
                <div key={tag.tag_id} className="tag-chip">
                  <span className="tag-icon">👨‍🚒</span>
                  <div className="tag-info">
                    <span className="tag-name">{tag.firefighter_name}</span>
                    <span className="tag-dist">{tag.range_m}m • {tag.rssi_dbm}dBm</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="no-tags">Brak wykrytych obiektów</div>
          )}
        </div>

        {/* STOPKA */}
        <div className="beacon-footer">
          FW: {data.firmware_version} • HW: {data.hardware_version} • Err: {data.error_count}
        </div>
      </div>
    </div>
  );
}