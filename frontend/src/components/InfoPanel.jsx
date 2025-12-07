import React, { useState, useEffect, useMemo } from "react";
import FirefighterCard from "./FirefighterPanel/FirefighterCard";
import FirefighterDetail from "./FirefighterPanel/FirefighterDetail";
import BeaconCard from "./BeaconCard/BeaconCard"; 
import BeaconDetail from "./BeaconDetail/BeaconDetail";
import AlertCard from "./AlertsPanel/AlertCard"; 
import { IoSearchOutline } from "react-icons/io5"; 
import "../styles.css"; // Upewnij się, że ścieżka do stylów jest poprawna

export default function InfoPanel({
  firefighters,
  beacons,
  alerts,              // Lista wszystkich alertów
  onDismissAlert,      // Funkcja do usuwania alertów (z App.js)
  selectedId,
  setSelectedId,
  selectedFirefighter,
  selectedBeaconId,
  setSelectedBeaconId
}) {
  const [activeTab, setActiveTab] = useState("strazacy");

  // --- STANY FILTRÓW ---
  const [searchText, setSearchText] = useState("");
  const [filterTeam, setFilterTeam] = useState("all");
  const [sortBy, setSortBy] = useState("id"); 

  // Auto-przełączanie zakładek
  useEffect(() => {
    if (selectedId) setActiveTab("strazacy");
  }, [selectedId]);

  useEffect(() => {
    if (selectedBeaconId) setActiveTab("beacons");
  }, [selectedBeaconId]);

  const listFirefighters = Object.values(firefighters);
  const listBeacons = beacons || [];

  // --- LOGIKA FILTROWANIA I SORTOWANIA ---
  const filteredFirefighters = useMemo(() => {
    let result = listFirefighters;

    // 1. Szukanie po ID lub Imieniu
    if (searchText) {
      const lowerSearch = searchText.toLowerCase();
      result = result.filter(item => 
        item.firefighter.name.toLowerCase().includes(lowerSearch) ||
        item.firefighter.id.toLowerCase().includes(lowerSearch)
      );
    }

    // 2. Filtrowanie po zespole
    if (filterTeam !== "all") {
      result = result.filter(item => item.firefighter.team === filterTeam);
    }

    // 3. Sortowanie
    result.sort((a, b) => {
        if (sortBy === 'battery_asc') return (a.device.battery_level || 0) - (b.device.battery_level || 0);
        if (sortBy === 'battery_desc') return (b.device.battery_level || 0) - (a.device.battery_level || 0);
        if (sortBy === 'name') return a.firefighter.name.localeCompare(b.firefighter.name);
        return a.firefighter.id.localeCompare(b.firefighter.id); 
    });

    return result;
  }, [listFirefighters, searchText, filterTeam, sortBy]);

  // Unikalne zespoły do dropdowna
  const uniqueTeams = [...new Set(listFirefighters.map(f => f.firefighter.team))];

  const renderContent = () => {
    switch (activeTab) {
      // --- ZAKŁADKA: STRAŻACY ---
      case "strazacy":
        if (selectedFirefighter) {
          return <FirefighterDetail data={selectedFirefighter} onBack={() => setSelectedId(null)} />;
        }
        
        return (
          <>
            {/* PASEK FILTRÓW */}
            <div className="filters-container">
              <div className="search-box">
                <IoSearchOutline className="search-icon"/>
                <input 
                  type="text" 
                  placeholder="Szukaj (ID, Imię)..." 
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
              </div>

              <div className="filter-options">
                <select value={filterTeam} onChange={(e) => setFilterTeam(e.target.value)}>
                  <option value="all">Wszystkie zespoły</option>
                  {uniqueTeams.map(team => (
                    <option key={team} value={team}>{team}</option>
                  ))}
                </select>

                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                  <option value="id">Sort: ID</option>
                  <option value="name">Sort: Nazwisko</option>
                  <option value="battery_asc">Bateria: Najsłabsza</option>
                  <option value="battery_desc">Bateria: Najlepsza</option>
                </select>
              </div>
            </div>

            {/* LISTA KART STRAŻAKÓW */}
            {filteredFirefighters.length === 0 ? (
              <p className="empty-state">Brak wyników...</p>
            ) : (
              <div className="cards">
                {filteredFirefighters.map(data => {
                    // WAŻNE: Filtrujemy alerty dla TEGO konkretnego strażaka
                    const firefighterAlerts = alerts ? alerts.filter(a => a.firefighter_id === data.firefighter.id) : [];

                    return (
                      <FirefighterCard 
                        key={data.firefighter.id} 
                        data={data} 
                        // Przekazujemy alerty do karty
                        activeAlerts={firefighterAlerts}
                        isSelected={data.firefighter.id === selectedId} 
                        onSelect={() => setSelectedId(data.firefighter.id)} 
                      />
                    );
                })}
              </div>
            )}
          </>
        );

      // --- ZAKŁADKA: BEACONY ---
      case "beacons":
        const selectedBeacon = listBeacons.find((b) => b.id === selectedBeaconId);
        if (selectedBeacon) {
            return <BeaconDetail data={selectedBeacon} onBack={() => setSelectedBeaconId(null)} />;
        }
        return listBeacons.length === 0 ? (
          <p className="empty-state">Brak beaconów...</p>
        ) : (
          <div className="cards">
            {listBeacons.map(beacon => (
                <BeaconCard 
                  key={beacon.id} 
                  data={beacon} 
                  onClick={() => setSelectedBeaconId(beacon.id)} 
                />
            ))}
          </div>
        );

      case "nib":
        return <div className="placeholder-content">Panel NIB (W budowie)</div>;

      // --- ZAKŁADKA: ALERTY ---
      case "alerty":
         if (!alerts || alerts.length === 0) {
            return (
              <div className="empty-state">
                <span style={{fontSize: "3rem"}}>✅</span>
                <p>Brak aktywnych zagrożeń.</p>
              </div>
            );
         }
         return (
          <div className="alerts-list">
            {alerts.map((alert) => (
              <AlertCard 
                key={alert.id} 
                alert={alert} 
                // Przekazujemy funkcję usuwania alertu
                onDismiss={() => onDismissAlert(alert.id)}
              />
            ))}
          </div>
         );

      default: return null;
    }
  };

  return (
    <div className="panel">
      <div className="tabs-header">
        <button className={`tab-btn ${activeTab === "strazacy" ? "active" : ""}`} onClick={() => setActiveTab("strazacy")}>Strażacy</button>
        <button className={`tab-btn ${activeTab === "beacons" ? "active" : ""}`} onClick={() => setActiveTab("beacons")}>Beacony</button>
        <button className={`tab-btn ${activeTab === "nib" ? "active" : ""}`} onClick={() => setActiveTab("nib")}>NIB</button>
        <button className={`tab-btn ${activeTab === "alerty" ? "active" : ""} ${alerts && alerts.length > 0 ? "alert-active-btn" : ""}`} onClick={() => setActiveTab("alerty")}>
          Alerty {alerts && alerts.length > 0 && <span className="badge">{alerts.length}</span>}
        </button>
      </div>
      <div className="panel-content">
        {renderContent()}
      </div>
    </div>
  );
}