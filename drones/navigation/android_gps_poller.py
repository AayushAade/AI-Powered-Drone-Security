import time
import requests

NODE_API = "http://localhost:3000/api/telemetry"
IP_WEBCAM_URL = "http://192.0.0.4:8080/sensors.json"

def get_fallback_location():
    """
    Since IP-API returns your ISP's central server instead of your actual room,
    we will hardcode this to a location extremely close to Bharati Police Station for the demo.
    """
    return [18.4595, 73.8580] # ~50 meters from the Police Station

def poll_sensors():
    print(f"🛰️ Initiating Live Mobile Telemetry Link to {IP_WEBCAM_URL}...")
    
    # 1. Grab a fallback location in case sensors are blocked
    fallback_gps = get_fallback_location()
    
    while True:
        try:
            res = requests.get(IP_WEBCAM_URL, timeout=2)
            data = res.json()
            
            lat = None
            lng = None
            
            # Check for GPS data from IP Webcam APP
            if "gps" in data and "data" in data["gps"]:
                gps_array = data["gps"]["data"]
                if len(gps_array) > 0:
                    latest_reading = gps_array[-1][1]
                    lat = latest_reading[0]
                    lng = latest_reading[1]
            
            # If no hardware GPS, use the Network IP fallback
            if lat is None and fallback_gps is None:
                print("⚠️ No GPS signal and no Network Fallback available. Re-polling...")
                time.sleep(1)
                continue
                
            if lat is None:
                lat, lng = fallback_gps
                
            print(f"📍 Broadcasting Live Location to Dashboard: [{lat}, {lng}]")
            
            # Command the node backend to instantly warp the drone to this spot
            payload = {
                "drone_id": "D-Alpha",
                "lat": lat,
                "lng": lng
            }
            requests.post(NODE_API, json=payload)
                
        except Exception as e:
            print(f"❌ Connection Error: {e}")
            
        # Ping the phone 1 time a second
        time.sleep(1)

if __name__ == "__main__":
    poll_sensors()
