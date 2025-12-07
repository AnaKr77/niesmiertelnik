import numpy as np

# ---------------------------------------------------
#  Weighted Robust Trilateration
# ---------------------------------------------------
def weighted_trilateration(beacons, ranges, rssi, los, nlos_prob, quality,
                           max_iter=20, converge_eps=1e-3):
    q_map = {'excellent': 1.0, 'good': 0.8, 'fair': 0.5, 'poor': 0.2}
    qf = np.array([q_map.get(q, 0.5) for q in quality])
    los_factor = np.where(np.array(los), 1.0, 0.7)
    rssi_factor = 1 / (1 + np.exp((np.array(rssi) + 70)/10))
    w = qf * los_factor * (1 - np.array(nlos_prob)) * rssi_factor
    w = np.clip(w, 1e-3, 1.0)

    P = np.average(beacons, axis=0, weights=w)
    for _ in range(max_iter):
        diff = beacons - P
        dist = np.linalg.norm(diff, axis=1)
        valid = dist > 1e-6
        J = -(diff[valid] / dist[valid][:, None]) * w[valid][:, None]
        r = (dist[valid] - ranges[valid]) * w[valid]
        dp, *_ = np.linalg.lstsq(J, r, rcond=None)
        P_new = P - dp
        if np.linalg.norm(P_new - P) < converge_eps:
            break
        P = P_new
    return P

def baro_update(est_pos, baro_height, alpha=0.3):
    est_pos[2] = (1-alpha)*est_pos[2] + alpha*baro_height
    return est_pos

def imu_predict(pos, vel, acc, heading_deg, dt=0.1):
    heading_rad = np.deg2rad(heading_deg)
    vel[0] += acc * np.cos(heading_rad) * dt
    vel[1] += acc * np.sin(heading_rad) * dt
    pos += vel * dt
    return pos, vel


# ---------------------------------------------------
#  Test lokalny (uruchamiaj samodzielnie)
# ---------------------------------------------------
if __name__ == "__main__":
    beacons = np.array([[0,0,0],[10,0,0],[0,10,0],[10,10,3]])
    uwb = [
        {"position": {"x":0,"y":0,"z":0},"range_m":6.2,"rssi_dbm":-65,"los":True,"nlos_probability":0.1,"quality":"good"},
        {"position": {"x":10,"y":0,"z":0},"range_m":5.9,"rssi_dbm":-67,"los":True,"nlos_probability":0.2,"quality":"excellent"},
        {"position": {"x":0,"y":10,"z":0},"range_m":7.1,"rssi_dbm":-72,"los":False,"nlos_probability":0.7,"quality":"fair"},
        {"position": {"x":10,"y":10,"z":3},"range_m":8.2,"rssi_dbm":-64,"los":True,"nlos_probability":0.1,"quality":"excellent"},
    ]

    ranges = np.array([b["range_m"] for b in uwb])
    rssi = np.array([b["rssi_dbm"] for b in uwb])
    los = np.array([b["los"] for b in uwb])
    nlos = np.array([b["nlos_probability"] for b in uwb])
    qual = [b["quality"] for b in uwb]

    pos = weighted_trilateration(beacons, ranges, rssi, los, nlos, qual)
    pos = baro_update(pos, 2.0)
    pos, vel = imu_predict(pos, np.zeros(3), acc=0.3, heading_deg=45)
    print(f"Szacowana pozycja 3D: {pos.round(3)}")
