import asyncio
import json
import requests
import numpy as np
import websockets
import time
import csv
import os
from filterpy.kalman import KalmanFilter
from collections import deque
from datetime import datetime

# ===========================================
# KONFIGURACJA
# ===========================================
WS_URL = "wss://niesmiertelnik.replit.app/ws"
API_URL = "https://niesmiertelnik.replit.app/api/v1"
CSV_DIR = "trajectory_logs"

PING_INTERVAL = 20
PING_TIMEOUT = 10
RECONNECT_DELAY = 5

# Tworzenie folderu na logi
os.makedirs(CSV_DIR, exist_ok=True)

# ===========================================
# SYSTEM ASYNCHRONICZNEGO ZAPISU DO CSV
# ===========================================
class AsyncCSVWriter:
    """Asynchroniczny writer CSV - tworzy nowy plik tylko na początku, potem kontynuuje"""
    
    def __init__(self, ff_id, ff_name, create_new=False):
        self.ff_id = ff_id
        self.ff_name = ff_name
        
        if create_new:
            # Tryb: ZAWSZE TWÓRZ NOWY PLIK (na początku programu)
            self.filename = os.path.join(CSV_DIR, f"blackbox_{ff_id}.csv")
            
            # Otwórz nowy plik do zapisu
            self.file = open(self.filename, 'w', newline='', encoding='utf-8')
            self.writer = csv.writer(self.file)
            
            # NAGŁÓWEK DOPASOWANY DO KODU ANIMACJI: timestamp, x, y, z
            self.writer.writerow(['timestamp', 'x', 'y', 'z'])
            
            self.start_time = time.time()
            self.write_count = 0
            self.session_start_time = time.time()
            self.last_timestamp = 0.0
            
            print(f"📁  UTWORZONO NOWY PLIK: {os.path.basename(self.filename)}")
        else:
            # Tryb: KONTYNUUJ ISTNIEJĄCY PLIK (po rozłączeniu)
            # Znajdź najnowszy plik dla tego strażaka (blackbox_FF-001.csv)
            existing_files = [f for f in os.listdir(CSV_DIR) 
                            if f.startswith(f'blackbox_{ff_id}.') and f.endswith('.csv')]
            
            if existing_files:
                # Weź najnowszy plik
                existing_files.sort(reverse=True)
                self.filename = os.path.join(CSV_DIR, existing_files[0])
                
                # Otwórz istniejący plik w trybie dopisywania
                self.file = open(self.filename, 'a', newline='', encoding='utf-8')
                self.writer = csv.writer(self.file)
                
                # Sprawdź ile już ma punktów
                with open(self.filename, 'r') as f:
                    lines = f.readlines()
                    self.write_count = len(lines) - 1
                
                # Znajdź ostatni timestamp z pliku
                self.last_timestamp = 0.0
                if self.write_count > 0:
                    last_line = lines[-1].strip().split(',')
                    try:
                        # Spróbuj parsować timestamp z ostatniej linii
                        last_time_str = last_line[0]  # timestamp
                        self.last_timestamp = float(last_time_str)
                    except:
                        self.last_timestamp = 0.0
                
                # Ustaw czas początku sesji
                self.session_start_time = time.time()
                self.start_time = time.time()
                
                print(f"📂  KONTYNUUJĘ PLIK: {os.path.basename(self.filename)}")
                print(f"     Już zawiera: {self.write_count} punktów")
                print(f"     Ostatni timestamp: {self.last_timestamp:.1f}s")
            else:
                # Jeśli nie ma istniejącego pliku, utwórz nowy
                self.filename = os.path.join(CSV_DIR, f"blackbox_{ff_id}.csv")
                
                self.file = open(self.filename, 'w', newline='', encoding='utf-8')
                self.writer = csv.writer(self.file)
                # NAGŁÓWEK DOPASOWANY DO KODU ANIMACJI
                self.writer.writerow(['timestamp', 'x', 'y', 'z'])
                
                self.write_count = 0
                self.last_timestamp = 0.0
                self.session_start_time = time.time()
                self.start_time = time.time()
                
                print(f"📁  UTWORZONO NOWY PLIK (brak poprzedniego): {os.path.basename(self.filename)}")
        
        # Kolejka dla asynchronicznego zapisu
        self.write_queue = deque()
        self.is_writing = False
        
        # Ostatnie koordynaty do wyświetlania
        self.last_coords = None
        self.last_timestamp_value = None
    
    def add_point(self, timestamp, x, y, z):
        """Dodaj punkt do kolejki zapisu i zapamiętaj ostatnie koordynaty"""
        # Kontynuuj timestamp od ostatniego zapisu w pliku
        actual_timestamp = self.last_timestamp + timestamp
        
        self.write_queue.append((actual_timestamp, x, y, z))
        self.write_count += 1
        
        # Aktualizuj ostatni timestamp
        self.last_timestamp = actual_timestamp
        
        # Zapamiętaj ostatnie koordynaty do wyświetlania
        self.last_coords = (x, y, z)
        self.last_timestamp_value = actual_timestamp
        
        # Jeśli kolejka jest długa, zapisz od razu
        if len(self.write_queue) >= 10:
            self._flush_queue()
    
    def _flush_queue(self):
        """Zapisz wszystko z kolejki do pliku"""
        if not self.write_queue or self.is_writing:
            return
            
        self.is_writing = True
        try:
            while self.write_queue:
                point = self.write_queue.popleft()
                self.writer.writerow(point)
            self.file.flush()
        finally:
            self.is_writing = False
    
    def get_last_coords(self):
        """Zwróć ostatnie koordynaty i timestamp"""
        return self.last_coords, self.last_timestamp_value
    
    def close(self):
        """Zamknij plik (tylko przy wyjściu z programu)"""
        self._flush_queue()
        self.file.close()
        print(f"💾  {self.ff_id}: Zapisano {self.write_count} punktów")

# Słownik writerów
csv_writers = {}

# ===========================================
# FUNKCJE WSPOMAGAJĄCE
# ===========================================
def get_beacon_positions():
    """Pobierz mapę beaconów z API"""
    try:
        res = requests.get(f"{API_URL}/beacons", timeout=5).json()
        beacons = {}
        for b in res.get("beacons", []):
            pid = b["id"]
            pos = b.get("position", {})
            beacons[pid] = (
                pos.get("x", 0.0),
                pos.get("y", 0.0),
                pos.get("z", 0.0),
            )
        print(f"📡 Załadowano {len(beacons)} beaconów")
        return beacons
    except Exception as e:
        print(f"⚠️  Błąd pobierania beaconów: {e}")
        return {}

# ===========================================
# ALGORYTM LOKALIZACJI
# ===========================================
def weighted_trilateration(beacons, ranges, rssi, los, nlos_prob, quality,
                           max_iter=20, converge_eps=1e-3):
    """ważony algorytm UWB odporny na NLOS"""
    q_map = {"excellent": 1.0, "good": 0.8, "fair": 0.5, "poor": 0.2}
    qf = np.array([q_map.get(q.lower(), 0.5) for q in quality])
    los_factor = np.where(np.array(los), 1.0, 0.4)
    rssi_factor = 1 / (1 + np.exp((np.array(rssi) + 70) / 10))
    w = qf * los_factor * (1 - np.array(nlos_prob)) * rssi_factor
    w = np.clip(w, 1e-3, 1.0)

    if np.sum(w) == 0 or not np.isfinite(np.sum(w)):
        P = np.mean(beacons, axis=0)
    else:
        P = np.average(beacons, axis=0, weights=w)

    for _ in range(max_iter):
        diff = beacons - P
        dist = np.linalg.norm(diff, axis=1)
        valid = dist > 1e-6
        J = -(diff[valid] / dist[valid][:, None]) * w[valid][:, None]
        r = (dist[valid] - ranges[valid]) * w[valid]
        try:
            dp, *_ = np.linalg.lstsq(J, r, rcond=None)
        except np.linalg.LinAlgError:
            break
        P_new = P - dp
        if np.linalg.norm(P_new - P) < converge_eps:
            break
        P = P_new
    return P

def baro_update(est_pos, baro_data, alpha=0.3):
    altitude = (baro_data.get("altitude_rel_m")
                or baro_data.get("altitude")
                or est_pos[2])
    est_pos[2] = (1 - alpha) * est_pos[2] + alpha * altitude
    return est_pos

# ===========================================
# FILTR KALMANA
# ===========================================
def create_kalman():
    """Prosty filtr Kalmana (pozycja + prędkość)"""
    f = KalmanFilter(dim_x=6, dim_z=3)
    dt = 0.1
    f.F = np.array([
        [1, 0, 0, dt, 0, 0],
        [0, 1, 0, 0, dt, 0],
        [0, 0, 1, 0, 0, dt],
        [0, 0, 0, 1, 0, 0],
        [0, 0, 0, 0, 1, 0],
        [0, 0, 0, 0, 0, 1],
    ])
    f.H = np.array([
        [1, 0, 0, 0, 0, 0],
        [0, 1, 0, 0, 0, 0],
        [0, 0, 1, 0, 0, 0],
    ])
    f.P *= 5.0
    f.R *= 0.3
    f.Q *= 0.05
    return f

# ===========================================
# FUNKCJE DO WYŚWIETLANIA KOORDYNATÓW
# ===========================================
def format_coordinates(x, y, z):
    """Formatuj koordynaty do ładnego wyświetlania"""
    return f"x={x:7.2f}m, y={y:7.2f}m, z={z:7.2f}m"

def display_coordinates():
    """Wyświetl aktualne koordynaty wszystkich strażaków"""
    print("\n" + "=" * 70)
    print("🎯 AKTUALNE KOORDYNATY STRAŻAKÓW")
    print("=" * 70)
    
    if not csv_writers:
        print("   Brak aktywnych strażaków")
        print("=" * 70)
        return
    
    # Zbierz dane wszystkich strażaków
    firefighters_data = []
    
    for ff_id, writer in csv_writers.items():
        coords, timestamp = writer.get_last_coords()
        if coords:
            x, y, z = coords
            hours = int(timestamp // 3600)
            minutes = int((timestamp % 3600) // 60)
            seconds = int(timestamp % 60)
            time_str = f"{hours:02d}:{minutes:02d}:{seconds:02d}"
            
            firefighters_data.append({
                'id': ff_id,
                'coords': coords,
                'timestamp': timestamp,
                'time_str': time_str,
                'count': writer.write_count
            })
    
    # Sortuj po ID strażaka
    firefighters_data.sort(key=lambda x: x['id'])
    
    # Wyświetl koordynaty
    for data in firefighters_data:
        ff_id = data['id']
        x, y, z = data['coords']
        time_str = data['time_str']
        count = data['count']
        
        print(f"\n  🔥 Strażak {ff_id}:")
        print(f"     Czas: {time_str} (timestamp: {data['timestamp']:.1f}s)")
        print(f"     Koordynaty: {format_coordinates(x, y, z)}")
        print(f"     Łącznie zapisano: {count} punktów")
    
    print("\n" + "=" * 70)
    print(f"  Format plików: timestamp, x, y, z (gotowe do animacji)")
    print("=" * 70)

# ===========================================
# GŁÓWNA PĘTLA
# ===========================================
async def telemetry_loop():
    kalman_filters = {}
    beacon_map = get_beacon_positions()
    
    # Czas początku całego programu (nie resetowany przy rozłączeniu)
    program_start_time = time.time()
    
    # Flaga czy to pierwsze uruchomienie programu
    first_run = True
    
    # Statystyki
    stats_start = time.time()
    points_per_ff = {}
    connection_number = 0
    
    # Licznik wyświetlania koordynatów
    display_counter = 0
    last_display_time = time.time()
    
    # Licznik zapisów do pliku
    last_file_notify = time.time()

    while True:
        connection_number += 1
        print(f"\n🔄 Próba połączenia #{connection_number}...")
        
        try:
            async with websockets.connect(
                WS_URL, ping_interval=PING_INTERVAL, ping_timeout=PING_TIMEOUT
            ) as ws:
                print(f"✅ Połączono z serwerem")
                
                if first_run:
                    print(f"📁 URUCHOMIENIE PROGRAMU - tworzenie nowych plików")
                    print(f"💾 Format: blackbox_FF-XXX.csv")
                    print(f"💾 Kolumny: timestamp, x, y, z")
                    print(f"💾 Gotowe do animacji!")
                    first_run = False
                else:
                    print(f"📂 PONOWNE POŁĄCZENIE - kontynuacja zapisu do istniejących plików")
                
                await ws.send(json.dumps({"client": "trajectory-collector-continuous"}))

                last_flush_time = time.time()
                last_status_time = time.time()
                reconnect_attempts = 0
                
                while True:
                    try:
                        msg = await asyncio.wait_for(ws.recv(), timeout=30)
                    except asyncio.TimeoutError:
                        # Czasowe wygaśnięcie, ale połączenie nadal działa
                        continue
                        
                    try:
                        data = json.loads(msg)
                    except json.JSONDecodeError:
                        continue
                        
                    if data.get("type") != "tag_telemetry":
                        continue

                    ff = data.get("firefighter", {})
                    ff_id = ff.get("id", "UNKNOWN")
                    ff_name = ff.get("name", "nieznany")

                    uwb = data.get("uwb_measurements") or []
                    if len(uwb) < 3:
                        continue

                    # Przygotuj dane do trilateracji
                    beacons, ranges, rssi, los, nlos, qual = [], [], [], [], [], []
                    for b in uwb:
                        posb = b.get("position")
                        if not posb:
                            bx, by, bz = beacon_map.get(b["beacon_id"], (0, 0, 0))
                            posb = {"x": bx, "y": by, "z": bz}
                        beacons.append([posb["x"], posb["y"], posb["z"]])
                        ranges.append(b.get("range_m", 0))
                        rssi.append(b.get("rssi_dbm", -70))
                        los.append(b.get("los", True))
                        nlos.append(b.get("nlos_probability", 0.0))
                        qual.append(b.get("quality", "good"))

                    beacons = np.array(beacons)
                    ranges = np.array(ranges)
                    rssi = np.array(rssi)
                    los = np.array(los)
                    nlos = np.array(nlos)

                    # Oblicz pozycję
                    pos = weighted_trilateration(beacons, ranges, rssi, los, nlos, qual)
                    baro = data.get("barometer", {})
                    if baro:
                        pos = baro_update(pos, baro)

                    # Filtracja Kalmana
                    if ff_id not in kalman_filters:
                        kalman_filters[ff_id] = create_kalman()
                        kalman_filters[ff_id].x[:3, 0] = pos
                    
                    kf = kalman_filters[ff_id]
                    kf.predict()
                    kf.update(pos)
                    pos_fused = kf.x[:3, 0]

                    # Zapis do CSV
                    current_time = time.time()
                    rel_time = current_time - program_start_time  # Czas od początku programu
                    
                    # Jeśli to pierwszy raz widzimy tego strażaka w TEJ instancji programu
                    if ff_id not in csv_writers and ff_id != "UNKNOWN":
                        # Sprawdź czy to pierwsze uruchomienie programu
                        create_new = (connection_number == 1)  # Tylko przy pierwszym połączeniu tworzymy nowe pliki
                        csv_writers[ff_id] = AsyncCSVWriter(ff_id, ff_name, create_new)
                        points_per_ff[ff_id] = 0
                    
                    if ff_id in csv_writers:
                        # ZAPIS W FORMACIE DLA ANIMACJI: timestamp, x, y, z
                        csv_writers[ff_id].add_point(
                            float(rel_time),  # timestamp - czas od początku programu
                            float(pos_fused[0]),  # x
                            float(pos_fused[1]),  # y
                            float(pos_fused[2])   # z
                        )
                        points_per_ff[ff_id] = points_per_ff.get(ff_id, 0) + 1
                        
                        # Wyświetl pojedyncze koordynaty w czasie rzeczywistym
                        display_counter += 1
                        current_display_time = time.time()
                        
                        # Wyświetlaj co 3 punkty lub co 1.5 sekundy
                        if display_counter % 3 == 0 or current_display_time - last_display_time >= 1.5:
                            print(f"\n📊 Nowy punkt - Strażak {ff_id}:")
                            print(f"   Timestamp: {rel_time:.1f}s")
                            print(f"   Pozycja: {format_coordinates(pos_fused[0], pos_fused[1], pos_fused[2])}")
                            last_display_time = current_display_time
                        
                        # Powiadomienie o zapisie co 30 punktów
                        if csv_writers[ff_id].write_count % 30 == 0 and csv_writers[ff_id].write_count > 0:
                            if current_time - last_file_notify > 5:  # Nie spamuj
                                print(f"\n💾 {ff_id}: Zapisałem {csv_writers[ff_id].write_count} punktów do {csv_writers[ff_id].filename}")
                                last_file_notify = current_time

                    # Wyświetlanie pełnego statusu co 2 sekundy
                    if current_time - last_status_time >= 2:
                        display_coordinates()
                        last_status_time = current_time
                        reconnect_attempts = 0
                    
                    # Okresowe czyszczenie kolejek
                    if current_time - last_flush_time > 5:
                        for writer in csv_writers.values():
                            writer._flush_queue()
                        last_flush_time = current_time
                        
        except (websockets.ConnectionClosed, ConnectionError, OSError) as e:
            print(f"\n🔌 Utracono połączenie: {e}")
            
            # Wyświetl ostatnie koordynaty przed rozłączeniem
            if csv_writers:
                print("\n⏸️  OSTATNIE KOORDYNATY PRZED ROZŁĄCZENIEM:")
                for ff_id, writer in csv_writers.items():
                    coords, timestamp = writer.get_last_coords()
                    if coords:
                        x, y, z = coords
                        hours = int(timestamp // 3600)
                        minutes = int((timestamp % 3600) // 60)
                        seconds = int(timestamp % 60)
                        print(f"   {ff_id}: {format_coordinates(x, y, z)} [czas: {hours:02d}:{minutes:02d}:{seconds:02d}]")
            
            # WAŻNE: NIE zamykamy writerów! Tylko zapisujemy buforowane dane
            for writer in csv_writers.values():
                writer._flush_queue()
            
            # NIE czyścimy csv_writers! Pozostają aktywne dla kontynuacji
            # NIE czyścimy kalman_filters! Zachowujemy stan filtrów
            # NIE czyścimy points_per_ff! Zachowujemy statystyki sesji
            
            reconnect_attempts += 1
            wait_time = RECONNECT_DELAY * min(reconnect_attempts, 3)
            
            print(f"\n♻️  Próba ponownego połączenia za {wait_time}s...")
            print(f"    (Zapis będzie kontynuowany w tych samych plikach)")
            await asyncio.sleep(wait_time)
            
        except Exception as e:
            print(f"\n❌ Nieoczekiwany błąd: {e}")
            import traceback
            traceback.print_exc()
            
            # Zapisz buforowane dane, ale nie zamykaj writerów
            for writer in csv_writers.values():
                writer._flush_queue()
            
            print(f"♻️  Próba ponownego połączenia za {RECONNECT_DELAY}s...")
            await asyncio.sleep(RECONNECT_DELAY)

# ===========================================
# URUCHOMIENIE
# ===========================================
async def main():
    print("=" * 70)
    print("🚒 SYSTEM ZBIERANIA TRAJEKTORII STRAŻAKÓW")
    print("   (ZAPIS W FORMACIE DLA ANIMACJI 3D)")
    print("=" * 70)
    print("📊 Każdy nowy punkt jest wyświetlany w czasie rzeczywistym")
    print("📈 Co 20 sekund - pełny przegląd wszystkich strażaków")
    print("💾 DANE ZAPISYWANE W FORMACIE DLA ANIMACJI:")
    print("   • Pliki: blackbox_FF-XXX.csv")
    print("   • Kolumny: timestamp, x, y, z")
    print("   • Gotowe do użycia z trajectory_replay.py")
    print("♻️  Po rozłączeniu - kontynuacja zapisu do tych samych plików")
    print("=" * 70)
    print("📋 FORMAT WYJŚCIA:")
    print("   x=[wartość]m, y=[wartość]m, z=[wartość]m")
    print("   timestamp: czas od początku pomiarów [s]")
    print("=" * 70)
    
    # Wyświetl istniejące pliki dla informacji
    existing_files = [f for f in os.listdir(CSV_DIR) if f.startswith('blackbox_FF') and f.endswith('.csv')]
    if existing_files:
        print(f"\n📂 Znaleziono {len(existing_files)} istniejących plików:")
        print("(Będą kontynuowane, nowi strażacy dostaną nowe pliki)")
        
        # Grupuj pliki po strażakach
        files_by_ff = {}
        for file in existing_files:
            try:
                # Parsuj ID strażaka z nazwy pliku: blackbox_FF-001.csv
                # Usuń 'blackbox_' i '.csv'
                ff_id = file.replace('blackbox_', '').replace('.csv', '')
                files_by_ff[ff_id] = file
            except:
                pass
        
        # Wyświetl po strażakach
        for ff_id, file in files_by_ff.items():
            # Sprawdź ile punktów ma plik
            try:
                filepath = os.path.join(CSV_DIR, file)
                with open(filepath, 'r') as f:
                    lines = f.readlines()
                    point_count = len(lines) - 1
                
                if point_count > 0:
                    last_line = lines[-1].strip().split(',')
                    if len(last_line) >= 1:
                        last_time = float(last_line[0])
                        hours = int(last_time // 3600)
                        minutes = int((last_time % 3600) // 60)
                        seconds = int(last_time % 60)
                        print(f"   {ff_id}: {point_count} punktów, czas: {hours:02d}:{minutes:02d}:{seconds:02d}")
                    else:
                        print(f"   {ff_id}: {point_count} punktów")
                else:
                    print(f"   {ff_id}: pusty plik")
            except:
                print(f"   {ff_id}: {file}")
        
        print("\n" + "=" * 70)
    
    print("\n🟢 ROZPOCZYNAM MONITOROWANIE...")
    print("   Naciśnij Ctrl+C aby zatrzymać\n")
    
    await telemetry_loop()

# ===========================================
# GŁÓWNY PROGRAM
# ===========================================
if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n" + "=" * 70)
        print("🛑 ZATRZYMANO PROGRAM PRZEZ UŻYTKOWNIKA")
        print("=" * 70)
        
        # Wyświetl ostatnie koordynaty przed zamknięciem
        if csv_writers:
            print("\n📋 OSTATNIE KOORDYNATY PRZED ZAMKNIĘCIEM:")
            print("-" * 70)
            
            for ff_id, writer in csv_writers.items():
                coords, timestamp = writer.get_last_coords()
                if coords:
                    x, y, z = coords
                    hours = int(timestamp // 3600)
                    minutes = int((timestamp % 3600) // 60)
                    seconds = int(timestamp % 60)
                    print(f"  {ff_id}: {format_coordinates(x, y, z)}")
                    print(f"       Czas: {hours:02d}:{minutes:02d}:{seconds:02d} (timestamp: {timestamp:.1f}s)")
                    print(f"       Łącznie zapisano: {writer.write_count} punktów")
                    print()
        
        # TYLKO TERAZ zamykamy wszystkie writery
        for ff_id in list(csv_writers.keys()):
            csv_writers[ff_id].close()
        
        # Podsumowanie końcowe
        csv_files = [f for f in os.listdir(CSV_DIR) if f.startswith('blackbox_FF') and f.endswith('.csv')]
        
        if csv_files:
            print("\n📁 PODSUMOWANIE PLIKÓW (gotowe do animacji):")
            print("-" * 70)
            
            total_points = 0
            
            for csv_file in sorted(csv_files):
                try:
                    filepath = os.path.join(CSV_DIR, csv_file)
                    with open(filepath, 'r') as f:
                        lines = f.readlines()
                        point_count = len(lines) - 1
                    
                    total_points += point_count
                    print(f"  {csv_file}: {point_count} punktów")
                except:
                    print(f"  {csv_file}")
            
            print("-" * 70)
            print(f"ŁĄCZNA STATYSTYKA:")
            print(f"  • {len(csv_files)} plików")
            print(f"  • {total_points} punktów")
            print(f"  • Format: timestamp, x, y, z")
        else:
            print("\n⚠️ Nie utworzono żadnych plików")
        
        print("\n🎬 Aby uruchomić animację 3D:")
        print("   Uruchom plik: trajectory_replay.py")
        print("=" * 70)
    except Exception as e:
        print(f"\n❌ Krytyczny błąd: {e}")
        import traceback
        traceback.print_exc()
