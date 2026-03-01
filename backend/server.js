require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { spawn } = require('child_process');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
});

// --- Haversine Distance Helper ---
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth radius in meters
    const toRad = angle => angle * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// --- Global State ---
let alerts = [];
let droneProcess = null; // Track the running python script
let cctvProcess = null; // Track the CCTV python script

// Base locations for drones (e.g., simulated police/drone stations in Pune)
let drones = [
    { id: 'D-Alpha', status: 'IDLE', lat: 18.4590, lng: 73.8577, battery: 100, target: null, eta: null }
];

const DRONE_SPEED_MPS = 20; // Simulated speed (meters per second)
const TICK_RATE_MS = 500;   // Update physics every 500ms
const BATTERY_DRAIN_PER_TICK = 0.05;

// --- API Endpoints ---

// 1. Python AI hits this endpoint when an incident is detected
app.post('/api/alert', (req, res) => {
    const { type, lat, lng, severity, camera_id } = req.body;

    const newAlert = {
        id: `ALT-${Date.now()}`,
        type: type || 'Unknown Incident',
        lat: lat || 18.5204, // Default incident location if none provided
        lng: lng || 73.8567,
        severity: severity || 'High',
        camera_id: camera_id || 'Unknown Sensor',
        timestamp: new Date().toISOString()
    };

    alerts.push(newAlert);
    console.log(`\n🚨 NEW ALERT RECEIVED: ${newAlert.type} at [${newAlert.lat}, ${newAlert.lng}]`);

    // Dispatch logic: Find closest IDLE drone
    let closestDrone = null;
    let minDistance = Infinity;

    drones.forEach(drone => {
        if (drone.status === 'IDLE') {
            const dist = calculateDistance(drone.lat, drone.lng, newAlert.lat, newAlert.lng);
            if (dist < minDistance) {
                minDistance = dist;
                closestDrone = drone;
            }
        }
    });

    if (closestDrone) {
        closestDrone.status = 'DISPATCHED';
        closestDrone.target = { lat: newAlert.lat, lng: newAlert.lng, alertId: newAlert.id };
        console.log(`🚁 Dispatching ${closestDrone.id} to incident. Distance: ${Math.round(minDistance)}m`);
    } else {
        console.log("⚠️ No idle drones available for dispatch!");
    }

    // Instantly notify connected frontend clients about the new alert
    io.emit('new_alert', newAlert);

    res.status(200).json({ success: true, alert: newAlert, dispatched: closestDrone ? closestDrone.id : null });
});

app.get('/api/state', (req, res) => {
    res.json({ drones, alerts });
});

app.post('/api/reset', (req, res) => {
    drones = [
        { id: 'D-Alpha', status: 'IDLE', lat: 18.4590, lng: 73.8577, battery: 100, target: null, eta: null }
    ];
    alerts = [];

    // Stop active camera streams on hard reset
    if (droneProcess) {
        console.log('🔄 Fast Reset: Terminating drone camera stream...');
        droneProcess.kill();
    }
    if (cctvProcess) {
        console.log('🔄 Fast Reset: Terminating CCTV camera stream...');
        cctvProcess.kill();
    }

    io.emit('telemetry_update', drones);
    io.emit('initial_state', { drones, alerts });
    console.log('🔄 System reset requested. Drones returned to base.');
    res.json({ success: true, message: 'System reset perfectly.' });
});

app.post('/api/start-drone', (req, res) => {
    if (droneProcess) {
        console.log('🔄 Terminating existing drone process...');
        droneProcess.kill();
    }

    console.log('🚁 Launching Python Drone Video Streamer...');
    droneProcess = spawn('python3', ['drones/drone_stream_mobile.py'], {
        cwd: require('path').resolve(__dirname, '..'), // Run from root HACKATHON directory
    });

    droneProcess.stdout.on('data', (data) => {
        console.log(`[DRONE CHAT]: ${data}`);
    });

    droneProcess.stderr.on('data', (data) => {
        console.error(`[DRONE ERROR]: ${data}`);
    });

    droneProcess.on('close', (code) => {
        console.log(`❌ Drone child process exited with code ${code}`);
        droneProcess = null;
    });

    res.json({ success: true, message: 'Drone camera process launched.' });
});

app.post('/api/start-cctv', (req, res) => {
    if (cctvProcess) {
        console.log('🔄 Terminating existing CCTV process...');
        cctvProcess.kill();
    }

    console.log('📹 Launching Python CCTV Streamer...');
    cctvProcess = spawn('python3', ['cameras/cctv_monitor_invert.py'], {
        cwd: require('path').resolve(__dirname, '..'), // Run from root HACKATHON directory
    });

    cctvProcess.stdout.on('data', (data) => {
        console.log(`[CCTV CHAT]: ${data}`);
    });

    cctvProcess.stderr.on('data', (data) => {
        console.error(`[CCTV ERROR]: ${data}`);
    });

    cctvProcess.on('close', (code) => {
        console.log(`❌ CCTV child process exited with code ${code}`);
        cctvProcess = null;
    });

    res.json({ success: true, message: 'CCTV camera process launched.' });
});

// 4. Override GPS Coordinates (From Mobile iPhone/Android App)
app.post('/api/telemetry', (req, res) => {
    const { drone_id, lat, lng } = req.body;

    // Find drone in memory and update its raw position
    const drone = drones.find(d => d.id === drone_id);
    if (drone) {
        drone.lat = lat;
        drone.lng = lng;

        // Push instant updates to React UI
        io.emit('telemetry_update', drones);
        res.status(200).json({ success: true, message: `Drone ${drone_id} warped to [${lat}, ${lng}]` });
    } else {
        res.status(404).json({ success: false, message: 'Drone not found.' });
    }
});

// --- Telemetry Simulator Loop ---
setInterval(() => {
    let stateChanged = false;

    drones.forEach(drone => {
        if (drone.status === 'DISPATCHED' && drone.target) {
            const targetLat = drone.target.lat;
            const targetLng = drone.target.lng;

            const dist = calculateDistance(drone.lat, drone.lng, targetLat, targetLng);

            if (dist < 10) {
                // Drone arrived!
                drone.status = 'ON_SCENE';
                drone.eta = 0;
                console.log(`🎯 ${drone.id} has arrived on scene!`);
                stateChanged = true;
            } else {
                // Move drone programmatically
                const speedPerTick = DRONE_SPEED_MPS * (TICK_RATE_MS / 1000); // 10m per tick

                // Calculate bearing/angle
                const toRad = angle => angle * Math.PI / 180;
                const toDeg = angle => angle * 180 / Math.PI;

                // 1. Calculate attractive force towards target
                const yTarget = Math.sin(toRad(targetLng - drone.lng)) * Math.cos(toRad(targetLat));
                const xTarget = Math.cos(toRad(drone.lat)) * Math.sin(toRad(targetLat)) -
                    Math.sin(toRad(drone.lat)) * Math.cos(toRad(targetLat)) * Math.cos(toRad(targetLng - drone.lng));
                let bearing = Math.atan2(yTarget, xTarget);

                // 2. Strict No-Fly Zone Circumference Routing
                const NO_FLY_LAT = 18.5200;
                const NO_FLY_LNG = 73.8550;
                const NO_FLY_RADIUS_M = 300;
                const AVOID_RADIUS_M = 320; // 20m buffer so it doesn't cross the visual red line

                const distToNoFly = calculateDistance(drone.lat, drone.lng, NO_FLY_LAT, NO_FLY_LNG);

                if (distToNoFly <= AVOID_RADIUS_M) {
                    // Calculate bearing FROM drone TO the no-fly center
                    const yCenter = Math.sin(toRad(NO_FLY_LNG - drone.lng)) * Math.cos(toRad(NO_FLY_LAT));
                    const xCenter = Math.cos(toRad(drone.lat)) * Math.sin(toRad(NO_FLY_LAT)) -
                        Math.sin(toRad(drone.lat)) * Math.cos(toRad(NO_FLY_LAT)) * Math.cos(toRad(NO_FLY_LNG - drone.lng));
                    const bearingToCenter = Math.atan2(yCenter, xCenter);

                    // Check if target is blocked by the circle
                    let angleDiff = bearing - bearingToCenter;

                    // Normalize angle difference to [-PI, PI]
                    angleDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));

                    // Angular radius of the obstacle from current position
                    // If we are deep inside the circle, assume 90 degrees to immediately exit
                    let angularRadius = Math.PI / 2;
                    if (distToNoFly > NO_FLY_RADIUS_M) {
                        angularRadius = Math.asin(NO_FLY_RADIUS_M / distToNoFly);
                    }

                    // If the straight line to target goes through the circle, we must ride the circumference
                    if (Math.abs(angleDiff) < angularRadius) {
                        // Target is blocked! Fly tangentially along the circumference
                        // Determine which way is shorter to go around
                        const orbitDir = angleDiff >= 0 ? 1 : -1; // 1 for CW (right), -1 for CCW (left)

                        // Tangent is 90 degrees from the bearing to the center
                        let tangentBearing = bearingToCenter + (orbitDir * Math.PI / 2);

                        // If we drifted inside the avoidance radius, gently adjust outward
                        if (distToNoFly < AVOID_RADIUS_M) {
                            const pushOutAngle = ((AVOID_RADIUS_M - distToNoFly) / AVOID_RADIUS_M) * (Math.PI / 4);
                            tangentBearing -= orbitDir * pushOutAngle; // steer away from center
                        }

                        bearing = tangentBearing;
                    }
                }

                // Very simplified movement math for short distances
                const latMovement = Math.cos(bearing) * (speedPerTick / 111320);
                const lngMovement = Math.sin(bearing) * (speedPerTick / (111320 * Math.cos(toRad(drone.lat))));

                drone.lat += latMovement;
                drone.lng += lngMovement;
                drone.battery = Math.max(0, drone.battery - BATTERY_DRAIN_PER_TICK);
                drone.eta = Math.round(dist / DRONE_SPEED_MPS); // Seconds remaining
                stateChanged = true;
            }
        }
    });

    // Blast the live telemetry to the React dashboard 2 times a second
    if (stateChanged || io.engine.clientsCount > 0) {
        io.emit('telemetry_update', drones);
    }

}, TICK_RATE_MS);

// --- WebSocket Connections ---
io.on('connection', (socket) => {
    console.log('💻 Frontend Command Center Connected:', socket.id);
    // Send initial state upon connection
    socket.emit('initial_state', { drones, alerts });

    // Broadcast video frames from the Python YOLO script (Drone)
    socket.on('video_frame', (data) => {
        socket.broadcast.emit('video_frame', data);
    });

    // Broadcast video frames from the Python CCTV trigger (Stationary Camera)
    socket.on('cctv_frame', (data) => {
        socket.broadcast.emit('cctv_frame', data);
    });

    socket.on('disconnect', () => {
        console.log('💻 Command Center Disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Drone Response Backend running on http://localhost:${PORT}`);
});
