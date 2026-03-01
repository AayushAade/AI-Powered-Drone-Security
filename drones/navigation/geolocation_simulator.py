import time
import math

class DroneSimulator:
    def __init__(self):
        self.drone_lat = 40.7128
        self.drone_lng = -74.0060
        
    def haversine_distance(self, lat1, lon1, lat2, lon2):
        """Calculates distance between two GPS coordinates in meters"""
        R = 6371000 # Earth radius in meters
        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        delta_phi = math.radians(lat2 - lat1)
        delta_lambda = math.radians(lon2 - lon1)
        
        a = math.sin(delta_phi/2.0)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda/2.0)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        return R * c

    def method_1_predefined_paths(self):
        print("\n--- Method 1: Predefined Paths ---")
        print("Moving drone along a hardcoded array of coordinates...")
        
        # We just manually typed out a path for the drone to follow
        path = [
            (40.7128, -74.0060),
            (40.7130, -74.0062),
            (40.7132, -74.0065),
            (40.7135, -74.0068),
            (40.7138, -74.0070)
        ]
        
        for i, coord in enumerate(path):
            self.drone_lat, self.drone_lng = coord
            print(f"Tick {i+1}: Drone is at {self.drone_lat:.4f}, {self.drone_lng:.4f}")
            time.sleep(1) # Simulate real-time 1 second updates
            
        print("✅ Drone reached destination via Predefined Path.")

    def method_2_programmatic_telemetry(self, target_lat, target_lng):
        print(f"\n--- Method 2: Programmatic Telemetry ---")
        print(f"Calculating dynamic route to Incident at {target_lat}, {target_lng}...")
        
        speed_meters_per_sec = 15 # Simulated Drone Speed
        
        while True:
            # 1. Calculate how far away we are
            dist = self.haversine_distance(self.drone_lat, self.drone_lng, target_lat, target_lng)
            
            if dist < 5: # If we are within 5 meters, we arrived!
                print(f"🎯 ARRIVED AT INCIDENT! Distance: {dist:.1f}m")
                break
                
            # 2. Calculate the ETA
            eta_seconds = dist / speed_meters_per_sec
            
            # 3. Move the drone programmatically (fake physics)
            # We calculate the angle to the target and move slightly in that direction
            angle = math.atan2(target_lng - self.drone_lng, target_lat - self.drone_lat)
            
            # Move lat/lng based on speed (very simplified math for demo)
            lat_movement = math.cos(angle) * (speed_meters_per_sec / 111320) # 1 deg lat is ~111km
            lng_movement = math.sin(angle) * (speed_meters_per_sec / (111320 * math.cos(math.radians(self.drone_lat))))
            
            self.drone_lat += lat_movement
            self.drone_lng += lng_movement
            
            print(f"🛰️ Moving... Dist: {dist:.1f}m | ETA: {eta_seconds:.1f}s | Pos: {self.drone_lat:.5f}, {self.drone_lng:.5f}")
            time.sleep(0.5)

    def method_3_mobile_gps(self):
        print("\n--- Method 3: Mobile GPS ---")
        print("This requires your phone to actively ping a server with its GPS.")
        print("Simulating receiving a payload from an Android GPS App...")
        
        # Imagine your phone is sending this JSON payload to your server every second
        mock_phone_payloads = [
            {"device": "iphone", "lat": 40.7140, "lng": -74.0080, "accuracy": 5.0},
            {"device": "iphone", "lat": 40.7142, "lng": -74.0082, "accuracy": 4.5},
            {"device": "iphone", "lat": 40.7145, "lng": -74.0085, "accuracy": 4.0}
        ]
        
        for payload in mock_phone_payloads:
            self.drone_lat = payload["lat"]
            self.drone_lng = payload["lng"]
            print(f"📱 Received GPS update from phone: {self.drone_lat}, {self.drone_lng}")
            time.sleep(1)

if __name__ == "__main__":
    sim = DroneSimulator()
    sim.method_1_predefined_paths()
    
    # Reset position for demo
    sim.drone_lat = 40.7128
    sim.drone_lng = -74.0060
    
    # Simulate an incident randomly far away
    sim.method_2_programmatic_telemetry(40.7140, -74.0100)
    
    sim.method_3_mobile_gps()
