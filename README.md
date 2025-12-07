# 🚒 **NIEŚMIERTELNIK - Lokalizacja strażaków bez GPS**

## 🎯 **CO TO JEST?**
**GPS wewnątrz budynków dla strażaków** - system lokalizujący strażaków z dokładnością 30 cm, zapisujący ich trasy i pokazujący w animacji 3D.

---

## 📁 **3 PLIKI SYSTEMU**

### **1. `robust_uwb_fusion.py`** - *Lokalizacja*
```python
# UWB (Ultra-Wideband): 4+ beaconów, dokładność 30cm
# Barometr: wysokość (które piętro)
# IMU: ruch, kierunek

weighted_trilateration()  # Oblicza pozycję 3D
baro_update()            # Korekta wysokości
imu_predict()            # Przewiduje ruch
```

### **2. `nieśmiertelnik_client.py`** - *Zbieranie danych*
```bash
python nieśmiertelnik_client.py
```
- Łączy z serwerem strażaków
- Zapisuje pozycje do CSV (`blackbox_FF-001.csv`)
- Pokazuje na żywo gdzie są strażacy
- **Nie gubi danych** po rozłączeniu

### **3. `trajectory_replay.py`** - *Animacja 3D*
```bash
python trajectory_replay.py
```
- Ładuje zapisane trasy
- Pokazuje budynek 3D z piętrami, schodami, strefami
- Animuje ruch wszystkich strażaków
- **Sterowanie**: Spacja (pauza), →/← (klatki), R (reset)

---

## 🚀 **JAK URUCHOMIĆ?**
```bash
# 1. Instaluj biblioteki
pip install numpy pandas matplotlib websockets requests filterpy

# 2. Zbieraj dane (podczas akcji)
python nieśmiertelnik_client.py

# 3. Odtwarzaj animację (po akcji)
python trajectory_replay.py
```

---

## 🏗️ **KONFIGURACJA BUDYNKU**
Edytuj w `trajectory_replay.py`:
```python
BUILDING = {
    'width': 40,          # Szerokość budynku [m]
    'length': 25,         # Długość [m]
    'height': 12,         # Wysokość [m]
    'floors': [-3, 0, 4, 8, 12]  # Poziomy pięter
}
```

---

## 📊 **CO POTRAFIMY?**
✅ **Lokalizacja 3D** - 30 cm dokładności, piętra  
✅ **Zapis tras** - "czarna skrzynka" każdego strażaka  
✅ **Animacja 3D** - odtworzenie całej akcji  
✅ **Analiza** - dystans, prędkości, czas  
✅ **Odporność** - działa po rozłączeniu  

---

## 🎬 **PRZYKŁAD UŻYCIA**
```bash
# Podczas akcji:
python nieśmiertelnik_client.py
# (zapisuje: blackbox_FF-001.csv, blackbox_FF-002.csv...)

# Po akcji - analiza:
python trajectory_replay.py
# (pokazuje animację 3D)

# Eksport do Excel:
# Otwórz CSV w Excelu
```

---

## 🔧 **DLA KOGO?**
- **Straż pożarna** - analiza akcji, szkolenia
- **Architekci** - testy ewakuacji
- **Badacze** - analiza zachowań w stresie
- **Szkolenia** - realistyczne symulacje

---

## 📞 **PROBLEMY?**
1. **Brak połączenia** - sprawdź `wss://niesmiertelnik.replit.app/ws`
2. **Brak animacji** - sprawdź czy są pliki w `trajectory_logs/`
3. **Format** - CSV musi mieć: `timestamp,x,y,z`

---

**🚒 System ratujący życie - bo pokazuje gdzie jest strażak gdy GPS nie działa!**
