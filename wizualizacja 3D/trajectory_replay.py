import glob
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d import Axes3D
from matplotlib.animation import FuncAnimation

# ===========================================
# KONFIGURACJA BUDYNKU
# ===========================================
BUILDING = {
    'width': 40,
    'length': 25,
    'height': 12,
    'floors': [-3, 0, 4, 8, 12],
    
    # Elementy budynku
    'entrances': [
        {'name': '', 'x': 0, 'y': 5, 'z': 0, 'color': '#00FF00', 'size': 60},
        {'name': '', 'x': 40, 'y': 20, 'z': 0, 'color': '#0000FF', 'size': 60},
        {'name': '', 'x': 20, 'y': 25, 'z': -1.5, 'color': '#FF8800', 'size': 50}
    ],
    
    'danger_zones': [
        {'name': 'KOTŁOWNIA', 'x': 12.5, 'y': 7.5, 'z': -1.5, 'color': '#FF0000'},
        {'name': 'CHEMIKALIA', 'x': 32.5, 'y': 2.5, 'z': 2, 'color': '#FFFF00'}
    ],
    
    'stairs': {'x': 35, 'y': 20, 'z_range': (-3, 12), 'color': '#8B4513', 'radius': 1.5}
}

# ===========================================
# KONFIGURACJA ANIMACJI
# ===========================================
LOG_PATTERN = "trajectory_logs/blackbox_FF-*.csv"
INTERVAL_MS = 50
COLORS = ["#FF0000", "#0000FF", "#00AA00", "#FF8800", "#AA00AA", "#00AAAA"]
MARKER_SIZE = 10
TRAIL_WIDTH = 2.5

# ID → Imię
FIREFIGHTER_NAMES = {
    "FF-001": "J. Kowalski",
    "FF-002": "P. Nowak", 
    "FF-003": "A. Wiśniewska",
    "FF-004": "T. Zieliński",
    "FF-005": "M. Kamiński",
    "FF-006": "K. Dąbrowska",
}

# ===========================================
# WCZYTANIE DANYCH
# ===========================================
print("📊 Ładowanie trajektorii...")
print("=" * 50)

files = sorted(glob.glob(LOG_PATTERN))
if not files:
    LOG_PATTERN = "blackbox_FF-*.csv"
    files = sorted(glob.glob(LOG_PATTERN))
    if not files:
        print(f"❌ Brak plików: blackbox_FF-*.csv")
        exit()

trajectories = []
for idx, file in enumerate(files):
    try:
        df = pd.read_csv(file)
        if {"x", "y", "z", "timestamp"}.issubset(df.columns):
            ff_id = file.split("_")[-1].replace(".csv", "")
            name = FIREFIGHTER_NAMES.get(ff_id, ff_id)
            
            df = df.dropna(subset=["x", "y", "z"])
            df = df.sort_values(by="timestamp")
            
            if len(df) > 0:
                t0 = df["timestamp"].iloc[0]
                df["t"] = df["timestamp"] - t0
                
                trajectories.append({
                    "id": ff_id,
                    "name": name,
                    "data": df,
                    "color": COLORS[idx % len(COLORS)],
                    "points": len(df)
                })
                print(f"✓ {ff_id}: {name} - {len(df)} pkt")
    except Exception as e:
        print(f"✗ {file}: {e}")

if not trajectories:
    print("❌ Brak danych")
    exit()

print(f"\n✅ Załadowano {len(trajectories)} trajektorii")

# ===========================================
# PRZYGOTOWANIE DANYCH
# ===========================================
FRAME_COUNT = min(400, max(len(t["data"]) for t in trajectories))

for t in trajectories:
    df = t["data"]
    
    if len(df) > 1:
        t_original = df["t"].values
        interp_time = np.linspace(t_original[0], t_original[-1], FRAME_COUNT)
        
        t["anim_x"] = np.interp(interp_time, t_original, df["x"].values)
        t["anim_y"] = np.interp(interp_time, t_original, df["y"].values)
        t["anim_z"] = np.interp(interp_time, t_original, df["z"].values)
        t["anim_t"] = interp_time
    else:
        t["anim_x"] = np.array([df["x"].iloc[0]])
        t["anim_y"] = np.array([df["y"].iloc[0]])
        t["anim_z"] = np.array([df["z"].iloc[0]])
        t["anim_t"] = np.array([df["t"].iloc[0]])

# ===========================================
# RYSOWANIE BUDYNKU
# ===========================================
def draw_building():
    """Rysuje uproszczony budynek"""
    
    # Kontur budynku
    x = [0, BUILDING['width'], BUILDING['width'], 0, 0]
    y = [0, 0, BUILDING['length'], BUILDING['length'], 0]
    
    # Podłoga
    ax.plot(x, y, [0]*5, 'k-', alpha=0.15, linewidth=0.8)
    
    # Ściany (tylko narożniki)
    corners = [(0,0), (BUILDING['width'],0), 
               (BUILDING['width'],BUILDING['length']), (0,BUILDING['length'])]
    
    for cx, cy in corners:
        ax.plot([cx, cx], [cy, cy], [-3, 12], 'k-', alpha=0.1, linewidth=0.5)
    
    # Piętra - tylko oznaczenia
    floor_labels = {
        -3: ("PIWNICA", 0.3),
        0: ("PARTER", 0.4),
        4: ("1. PIĘTRO", 0.5),
        8: ("2. PIĘTRO", 0.6),
        12: ("", 0.7)
    }
    
    for z, (label, alpha) in floor_labels.items():
        if label:
            ax.text(38, 24, z + 0.2, label, fontsize=8, 
                   ha='right', va='bottom', alpha=alpha, color='gray')
    
    # WEJŚCIA - tylko kwadraty
    for entrance in BUILDING['entrances']:
        ax.scatter(entrance['x'], entrance['y'], entrance['z'], 
                  color=entrance['color'], s=entrance['size'], 
                  marker='s', edgecolor='black', linewidth=1.2, zorder=5, alpha=0.7)
    
    # STREFY NIEBEZPIECZNE - tylko napisy
    for zone in BUILDING['danger_zones']:
        ax.text(zone['x'], zone['y'], zone['z'], zone['name'], 
               fontsize=10, ha='center', va='center', weight='bold',
               color=zone['color'],
               bbox=dict(boxstyle="round,pad=0.3", facecolor='white', alpha=0.9))
    
    # KLATKA SCHODOWA - GRAFICZNIE
    stairs = BUILDING['stairs']
    
    # Cylinder schodów
    theta = np.linspace(0, 2*np.pi, 30)
    stairs_x = stairs['x'] + stairs['radius'] * np.cos(theta)
    stairs_y = stairs['y'] + stairs['radius'] * np.sin(theta)
    
    # Poziome okręgi na różnych wysokościach
    for z in np.linspace(stairs['z_range'][0], stairs['z_range'][1], 8):
        ax.plot(stairs_x, stairs_y, [z]*len(stairs_x), 
               color=stairs['color'], linewidth=1.5, alpha=0.6)
    
    # Centralna oś
    ax.plot([stairs['x']]*2, [stairs['y']]*2, stairs['z_range'], 
           color=stairs['color'], linewidth=2, alpha=0.7)
    
    # Oznaczenie
    ax.text(stairs['x'], stairs['y'], stairs['z_range'][1] + 0.5,
           "SCHODY", fontsize=9, ha='center', va='bottom', weight='bold',
           bbox=dict(boxstyle="round,pad=0.2", facecolor='white', alpha=0.8))

# ===========================================
# TWORZENIE ANIMACJI
# ===========================================
fig = plt.figure(figsize=(12, 7))
ax = fig.add_subplot(111, projection='3d')

# Ustawienia osi
ax.set_xlim(-2, BUILDING['width'] + 2)
ax.set_ylim(-2, BUILDING['length'] + 2)
ax.set_zlim(-4, 13)

ax.set_xlabel("X [m]", fontsize=9)
ax.set_ylabel("Y [m]", fontsize=9)
ax.set_zlabel("Z [m]", fontsize=9)

ax.grid(True, alpha=0.15)
ax.view_init(elev=25, azim=225)

# Przezroczyste tło
ax.xaxis.pane.fill = False
ax.yaxis.pane.fill = False
ax.zaxis.pane.fill = False

# Rysuj budynek
draw_building()

# Elementy animacji
trail_lines = []
current_dots = []

for t in trajectories:
    line, = ax.plot([], [], [], color=t["color"], lw=TRAIL_WIDTH, alpha=0.7)
    trail_lines.append(line)
    
    dot, = ax.plot([], [], [], 'o', color=t["color"], 
                  markersize=MARKER_SIZE, markeredgecolor='white', 
                  markeredgewidth=2, zorder=10)
    current_dots.append(dot)

# ===========================================
# PANEL STRAŻAKÓW (lewy górny róg)
# ===========================================
firefighter_count = len(trajectories)
firefighter_text = fig.text(0.02, 0.98, "", fontsize=11, 
                           bbox=dict(boxstyle="round,pad=0.6", 
                                    facecolor='#FF4444', 
                                    edgecolor='darkred',
                                    alpha=0.9),
                           verticalalignment='top',
                           horizontalalignment='left',
                           color='white',
                           weight='bold')

# ===========================================
# LEGENDA KOLORÓW (prawy górny róg)
# ===========================================
legend_box = fig.add_axes([0.75, 0.75, 0.2, 0.2])  # Prawy górny róg
legend_box.axis('off')  # Wyłącz osie

# Tworzenie legendy
legend_elements = []
for t in trajectories:
    legend_elements.append(plt.Line2D([0], [0], color=t["color"], lw=3, 
                                     label=f"{t['name']}"))

# Tworzenie legendy w osobnym axes
legend = legend_box.legend(handles=legend_elements, 
                          loc='center left',
                          fontsize=9,
                          frameon=True,
                          framealpha=0.95,
                          edgecolor='gray')

# Ramka wokół legendy
legend.get_frame().set_facecolor('white')
legend.get_frame().set_linewidth(1)

# ===========================================
# PANEL STATUSU (prawy górny róg pod legendą)
# ===========================================
status_text = fig.text(0.98, 0.15, "", fontsize=9, 
                      bbox=dict(boxstyle="round,pad=0.4", 
                               facecolor='white', 
                               edgecolor='gray',
                               alpha=0.9),
                      verticalalignment='bottom',
                      horizontalalignment='right')

# ===========================================
# ANIMACJA
# ===========================================
current_frame = 0
is_paused = False

def update_animation(frame):
    global current_frame
    
    if not is_paused:
        current_frame = (current_frame + 1) % FRAME_COUNT
    
    # Aktualizuj trajektorie
    for i, t in enumerate(trajectories):
        idx = min(current_frame, len(t["anim_x"]) - 1)
        
        if idx >= 0:
            # Ślad
            trail_lines[i].set_data(t["anim_x"][:idx+1], t["anim_y"][:idx+1])
            trail_lines[i].set_3d_properties(t["anim_z"][:idx+1])
            
            # Punkt
            x, y, z = t["anim_x"][idx], t["anim_y"][idx], t["anim_z"][idx]
            current_dots[i].set_data([x], [y])
            current_dots[i].set_3d_properties([z])
    
    # Aktualizuj panel strażaków (lewy górny róg)
    firefighter_text.set_text(f"STRAŻAKÓW\n{firefighter_count}")
    
    # Aktualizuj panel statusu (prawy dolny róg)
    progress = (current_frame + 1) / FRAME_COUNT * 100
    
    status_info = f"Klatka: {current_frame+1}/{FRAME_COUNT}\n"
    status_info += f"Postęp: {progress:.1f}%\n"
    status_info += f"Status: {'PAUZA' if is_paused else 'ODTWARZANIE'}"
    
    status_text.set_text(status_info)
    
    return trail_lines + current_dots + [firefighter_text, status_text]

def init_animation():
    for line in trail_lines:
        line.set_data([], [])
        line.set_3d_properties([])
    
    for dot in current_dots:
        dot.set_data([], [])
        dot.set_3d_properties([])
    
    firefighter_text.set_text(f"STRAŻAKÓW\n{firefighter_count}")
    status_text.set_text("Ładowanie...")
    
    return trail_lines + current_dots + [firefighter_text, status_text]

# ===========================================
# STEROWANIE
# ===========================================
def on_key_press(event):
    global current_frame, is_paused
    
    if event.key == ' ':
        is_paused = not is_paused
    
    elif event.key == 'right':
        current_frame = min(current_frame + 1, FRAME_COUNT - 1)
        is_paused = True
    
    elif event.key == 'left':
        current_frame = max(current_frame - 1, 0)
        is_paused = True
    
    elif event.key == 'r':
        current_frame = 0
        is_paused = False
    
    elif event.key == 'q':
        plt.close()

fig.canvas.mpl_connect('key_press_event', on_key_press)

# ===========================================
# URUCHOMIENIE
# ===========================================
print("\n🎬 Uruchamianie animacji...")
print("=" * 50)
print("Sterowanie:")
print("  Spacja - pauza/wznowienie")
print("  →/← - następna/poprzednia klatka")
print("  R - reset")
print("  Q - zamknij")
print("=" * 50)

ani = FuncAnimation(fig, update_animation, frames=None,
                    init_func=init_animation, interval=INTERVAL_MS,
                    blit=False, cache_frame_data=False)

plt.tight_layout()
plt.show()

# ===========================================
# PODSUMOWANIE
# ===========================================
print("\n" + "=" * 50)
print("📊 PODSUMOWANIE")
print("=" * 50)

print(f"Łącznie strażaków: {len(trajectories)}")

for t in trajectories:
    df = t["data"]
    
    if len(df) > 1:
        total_dist = 0
        
        for i in range(1, len(df)):
            dx = df["x"].iloc[i] - df["x"].iloc[i-1]
            dy = df["y"].iloc[i] - df["y"].iloc[i-1]
            dz = df["z"].iloc[i] - df["z"].iloc[i-1]
            
            dist = np.sqrt(dx**2 + dy**2 + dz**2)
            total_dist += dist
        
        print(f"• {t['name']}: {total_dist:.1f}m | {t['points']} pkt")

print("=" * 50)
print("✅ Koniec")
