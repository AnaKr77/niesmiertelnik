// utils/metrics.js

// Definicje kolorów
const COLORS = {
  NORMAL: "#37f58c", // Zielony
  WARNING: "#f5c637", // Żółty
  CRITICAL: "#ff4d4d", // Czerwony
  DEFAULT: "#aaa", // Szary/Domyślny dla null/nieznanych
  BACKGROUND: "#2b2f36", // Domyślny kolor tła kafelka
};

// Definicje klas CSS dla tła kafelków
const CLASSES = {
  NORMAL: "metric-normal",
  WARNING: "metric-warning",
  CRITICAL: "metric-critical",
};

/**
 * Określa status i kolory na podstawie typu czujnika i jego wartości.
 * Tabela wartości granicznych:
 * Czujnik | Jednostka | Norma (Zielony) | Ostrzeżenie (Żółty) | Alarm Krytyczny (Czerwony)
 * --------|-----------|-----------------|---------------------|---------------------------
 * CO      | ppm       | 0 - 35          | 50 - 100            | > 100
 * CO2     | ppm       | 400 - 1000      | 1000 - 2000         | > 5000
 * O2      | %         | 19.5 - 23.5     | 18 - 19.5           | < 18
 * LEL     | %         | 0 - 10          | 10 - 25             | > 25
 * Temp    | °C        | 0 - 40          | 40 - 60             | > 60
 *
 * @param {string} param Klucz identyfikujący czujnik (np. 'co_ppm').
 * @param {number|null|undefined} value Aktualna wartość czujnika.
 * @returns {{color: string, background: string, cssClass: string, isAlert: boolean}}
 */
export function getMetricStatus(param, value) {
  if (value == null) {
    return {
      color: COLORS.DEFAULT,
      background: COLORS.BACKGROUND,
      cssClass: "",
      isAlert: false,
    };
  }

  let status = COLORS.NORMAL; // Domyślnie zielony
  let isAlert = false;

  switch (param) {
    case "co_ppm":
      // Krytyczny: > 100
      if (value > 100) {
        status = COLORS.CRITICAL;
        isAlert = true;
      }
      // Ostrzeżenie: 50 - 100
      else if (value >= 50) {
        status = COLORS.WARNING;
        isAlert = true;
      }
      break;

    case "co2_ppm":
      // Krytyczny: > 5000
      if (value > 5000) {
        status = COLORS.CRITICAL;
        isAlert = true;
      }
      // Ostrzeżenie: 1000 - 2000
      else if (value >= 1000) {
        status = COLORS.WARNING;
        isAlert = true;
      }
      break;

    case "o2_percent":
      // Krytyczny: < 18
      if (value < 18) {
        status = COLORS.CRITICAL;
        isAlert = true;
      }
      // Ostrzeżenie: 18 - 19.5
      else if (value < 19.5) {
        status = COLORS.WARNING;
        isAlert = true;
      }
      break;

    case "lel_percent":
      // Krytyczny: > 25
      if (value > 25) {
        status = COLORS.CRITICAL;
        isAlert = true;
      }
      // Ostrzeżenie: 10 - 25
      else if (value > 10) {
        status = COLORS.WARNING;
        isAlert = true;
      }
      break;

    case "temperature_c":
      // Krytyczny: > 60
      if (value > 60) {
        status = COLORS.CRITICAL;
        isAlert = true;
      }
      // Ostrzeżenie: 40 - 60
      else if (value > 40) {
        status = COLORS.WARNING;
        isAlert = true;
      }
      break;

    // Domyślna dla nieznanych/innych, które zawsze są zielone
    default:
      // Nie zmieniaj statusu (pozostaje NORMAL)
      break;
  }

  let cssClass = "";
  if (status === COLORS.CRITICAL) {
    cssClass = CLASSES.CRITICAL;
  } else if (status === COLORS.WARNING) {
    cssClass = CLASSES.WARNING;
  } else if (status === COLORS.NORMAL) {
    cssClass = CLASSES.NORMAL;
  }

  return {
    color: status,
    background: isAlert ? status : COLORS.BACKGROUND, // Tło zmieniamy tylko przy alertach (Warning/Critical)
    cssClass: cssClass,
    isAlert: isAlert
  };
}

/**
 * Uproszczona funkcja do pobierania tylko koloru tekstu dla wstecznej kompatybilności.
 * @param {string} param
 * @param {number|null|undefined} value
 * @returns {string}
 */
export function getEnvValueColor(param, value) {
  return getMetricStatus(param, value).color;
}