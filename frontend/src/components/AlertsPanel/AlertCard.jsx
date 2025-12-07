import React from "react";
// Dodajemy ikonę IoaccessibilityOutline lub IoBodyOutline dla bezruchu
import { IoWarningOutline, IoCheckmarkDoneOutline, IoBodyOutline } from "react-icons/io5";

export default function AlertCard({ alert, onDismiss }) {
  const time = new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  let message = "";
  let CustomIcon = IoWarningOutline; // Domyślna ikona
  
  switch (alert.type) {
    case "SOS":
      message = "WCIŚNIĘTO PRZYCISK SOS!";
      break;
    case "LOW_AIR":
      message = "KRYTYCZNY POZIOM POWIETRZA";
      break;
    case "CRITICAL_VITALS":
      message = "PARAMETRY ŻYCIOWE KRYTYCZNE";
      break;
    case "NO_MOVEMENT": // <--- NOWY TYP
      message = "WYKRYTO BRAK RUCHU (>30s)";
      CustomIcon = IoBodyOutline; // Ikonka człowieka
      break;
    default:
      message = `WYKRYTO ZDARZENIE: ${alert.type}`;
  }

  return (
    <div className="alert-card">
      <div className="alert-icon-wrapper">
        <CustomIcon className="warning-icon" />
      </div>

      <div className="alert-content">
        <div className="alert-header">
          <span className="alert-type">{alert.type}</span>
          <span className="alert-time">{time}</span>
        </div>
        
        <h3 className="alert-name">{alert.firefighter_name}</h3>
        
        <div className="alert-details">
          <p className="alert-message">{message}</p>
          <div className="alert-floor">Piętro: {alert.floor}</div>
        </div>
      </div>

      <button className="dismiss-btn" onClick={onDismiss} title="Zatwierdź / Ukryj">
        <IoCheckmarkDoneOutline />
      </button>
    </div>
  );
}