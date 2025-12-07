import React, { useEffect, useState } from "react";
import { socket } from "./api/socket";
import "./styles.css";

export default function StatusBar({ packetCount, firefighters }) {
  const [connected, setConnected] = useState(socket.connected);
  const [ping, setPing] = useState(0);

  useEffect(() => {
    function handleConnect() {
      setConnected(true);
    }
    function handleDisconnect() {
      setConnected(false);
    }

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);

    const interval = setInterval(() => {
      setPing(Date.now() - socket.lastPing || 0);
    }, 1000);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      clearInterval(interval);
    };
  }, []);

  const firefighterCount = Object.keys(firefighters).length;

  return (
    <div className="status-bar">
      <div>
        <span
          className={connected ? "status-dot connected" : "status-dot disconnected"}
        ></span>
        {connected ? "Połączony" : "Rozłączony"}
      </div>
      <div className="status-data">
        <span>Ping: {ping} ms</span>
        <span>Pakiety: {packetCount}</span>
        <span>Strażacy: {firefighterCount}</span>
      </div>
    </div>
  );
}