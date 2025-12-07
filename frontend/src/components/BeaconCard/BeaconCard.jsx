import React from "react";

export default function BeaconCard({ data, onClick }) {
  const isOnline = data.status === "active";
  const tagCount = data.detected_tags ? data.detected_tags.length : 0;

  return (
    <div className={`beacon-card compact ${!isOnline ? "offline" : ""}`} onClick={onClick}>
      <div className="compact-left">
        <div className="compact-info">
          <div className="compact-name">{data.name}</div>
          <div className="compact-id">{data.id}</div>
        </div>
      </div>

      <div className="compact-right">
        {/* Przywrócony wskaźnik statusu */}
        <div className={`status-indicator list-ver ${data.status}`}>
          <span className="status-dot"></span>
          {isOnline ? "ONLINE" : "OFFLINE"}
        </div>

        {tagCount > 0 && (
          <div className="tag-badge">
            <span>{tagCount}</span>
          </div>
        )}
        <div className="arrow-icon">›</div>
      </div>
    </div>
  );
}