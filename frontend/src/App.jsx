import React, { useEffect, useState, useRef } from "react";
import { socket } from "./api/socket";
import MapView from "./MapView";
import InfoPanel from "./components/InfoPanel"; 
import StatusBar from "./StatusBar";

export default function App() {
  const [firefighters, setFirefighters] = useState({});
  const [beacons, setBeacons] = useState([]);
  const [alerts, setAlerts] = useState([]); // <--- NOWY STAN DLA ALERTÓW
  const [packetCount, setPacketCount] = useState(0);
  
  const [selectedId, setSelectedId] = useState(null);
  const [selectedBeaconId, setSelectedBeaconId] = useState(null);

  // Funkcje wyboru (zostają bez zmian)
  const handleSelectFirefighter = (id) => {
    setSelectedId(id);
    if (id) setSelectedBeaconId(null);
  };
  const handleSelectBeacon = (id) => {
    setSelectedBeaconId(id);
    if (id) setSelectedId(null);
  };

  const dismissAlert = (alertId) => {
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));
  };

  useEffect(() => {
    // 1. Telemetria
    socket.on("telemetry", (data) => {
      setPacketCount((p) => p + 1);
      const id = data.firefighter.id;
      setFirefighters((prev) => ({ ...prev, [id]: data }));
    });

    // 2. Beacony
    socket.on("beacons_data", (data) => {
      setPacketCount((p) => p + 1);
      if (data.beacons) setBeacons(data.beacons);
    });

    // 3. ALERTY (Nowość)
    socket.on("new_alert", (alert) => {
      // Dodajemy nowy alert na początek listy
      setAlerts((prev) => [alert, ...prev]);
      
      // Opcjonalnie: Automatycznie otwórz zakładkę alertów (jeśli chcesz)
      // Ale wymagałoby to przekazania settera do InfoPanelu lub stanu globalnego
    });

    return () => {
      socket.off("telemetry");
      socket.off("beacons_data");
      socket.off("new_alert");
    };
  }, []);

  // --- MECHANIZM CZYSZCZENIA STARYCH ALERTÓW ---
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const threeMinutes = 3 * 60 * 1000;

      setAlerts((currentAlerts) => {
        // Zostawiamy tylko alerty młodsze niż 3 minuty
        return currentAlerts.filter((alert) => {
          const alertTime = new Date(alert.timestamp).getTime();
          return (now - alertTime) < threeMinutes;
        });
      });
    }, 5000); // Sprawdzaj co 5 sekund

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="app-container">
      {/* Przekazujemy liczbę aktywnych alertów do paska statusu (opcjonalnie) */}
      <StatusBar packetCount={packetCount} firefighters={firefighters} />
      
      <div className="dashboard">
        <div className="left">
          <MapView
            firefighters={firefighters}
            beacons={beacons}
            selectedId={selectedId}
            setSelectedId={handleSelectFirefighter}
            selectedBeaconId={selectedBeaconId}
            setSelectedBeaconId={handleSelectBeacon} 
          />
        </div>
        <div className="right">
          <InfoPanel
            firefighters={firefighters}
            beacons={beacons}
            alerts={alerts}
            onDismissAlert={dismissAlert} // <--- PRZEKAZUJEMY FUNKCJĘ W DÓŁ
            
            selectedId={selectedId}
            setSelectedId={handleSelectFirefighter}
            selectedFirefighter={selectedId ? firefighters[selectedId] : null}
            
            selectedBeaconId={selectedBeaconId}
            setSelectedBeaconId={handleSelectBeacon}
          />
        </div>
      </div>
    </div>
  );
}