import { io } from "socket.io-client";

// Adres backendu
export const socket = io("http://localhost:8000");