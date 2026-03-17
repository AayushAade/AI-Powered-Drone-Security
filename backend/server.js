require('dotenv').config();
const express = require('express');
const http = require('http');
const https = require('https');
const { Server } = require('socket.io');
const cors = require('cors');
const { spawn } = require('child_process');
const { generateReport } = require('./ai_report');

const fs = require('fs');
const path = require('path');
const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Serve static files (broadcast page for phone browser)
app.use(express.static(path.join(__dirname, 'public')));

// Set up multer for handling file uploads
const multer = require('multer');
const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir)
    },
    filename: function (req, file, cb) {
        cb(null, 'drone_vid_' + Date.now() + '.mp4')
    }
});
const upload = multer({ storage: storage });

const server = http.createServer(app);

// HTTPS server for mobile browser camera access
let httpsServer;
try {
    const sslOptions = {
        key: fs.readFileSync(path.join(__dirname, 'key.pem')),
        cert: fs.readFileSync(path.join(__dirname, 'cert.pem')),
    };
    httpsServer = https.createServer(sslOptions, app);
    console.log('🔒 SSL certificates loaded');
} catch (e) {
    console.log('⚠️  No SSL certs found, HTTPS disabled. Run: openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365 -nodes');
}

// Socket.IO attached to BOTH servers
const io = new Server({
    cors: { origin: '*', methods: ['GET', 'POST'] }
});
io.attach(server);
if (httpsServer) io.attach(httpsServer);

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
let latestDroneFrame = null; // Store latest drone video frame for AI analysis

// Base stations for drones (simulated police/drone stations across Pune)
const DRONE_BASES = {
    'D-Alpha': { lat: 18.4590, lng: 73.8577 },  // Kothrud Station
    'D-Bravo': { lat: 18.5350, lng: 73.8800 },  // Shivajinagar Station
    'D-Charlie': { lat: 18.4850, lng: 73.8200 }, // Hinjawadi Station
};

let drones = [
    { id: 'D-Alpha', status: 'IDLE', lat: 18.4590, lng: 73.8577, battery: 100, target: null, eta: null, sceneTimer: null },
    { id: 'D-Bravo', status: 'IDLE', lat: 18.5350, lng: 73.8800, battery: 100, target: null, eta: null, sceneTimer: null },
    { id: 'D-Charlie', status: 'IDLE', lat: 18.4850, lng: 73.8200, battery: 100, target: null, eta: null, sceneTimer: null },
];

const DRONE_SPEED_MPS = 20; // Simulated speed (meters per second)
const TICK_RATE_MS = 500;   // Update physics every 500ms
const BATTERY_DRAIN_PER_TICK = 0.05;
const MIN_DISPATCH_BATTERY = 20; // Don't dispatch drones below this %
const SCENE_DURATION_SEC = 30;    // Time on scene before returning to base
const BATTERY_RECHARGE_PER_TICK = 0.15; // Recharge rate when idle at base

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

    // Smart Dispatch: Find closest IDLE drone with sufficient battery
    let closestDrone = null;
    let minDistance = Infinity;

    drones.forEach(drone => {
        if (drone.status === 'IDLE' && drone.battery >= MIN_DISPATCH_BATTERY) {
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
        closestDrone.sceneTimer = null;
        console.log(`🚁 Dispatching ${closestDrone.id} (Battery: ${Math.round(closestDrone.battery)}%) to incident. Distance: ${Math.round(minDistance)}m`);

        // Auto-launch drone camera (phone) if not already running
        if (!droneProcess) {
            console.log('📹 Auto-launching drone camera (phone)...');
            droneProcess = spawn('python', ['../drones/drone_stream_mobile.py'], { cwd: __dirname });
            droneProcess.stdout.on('data', (d) => console.log(`[DRONE CAM]: ${d}`));
            droneProcess.stderr.on('data', (d) => console.error(`[DRONE CAM ERROR]: ${d}`));
            droneProcess.on('close', (code) => { console.log(`❌ Drone camera exited (code ${code})`); droneProcess = null; });
        }
    } else {
        console.log("⚠️ No idle drones with sufficient battery available for dispatch!");
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
        { id: 'D-Alpha', status: 'IDLE', lat: 18.4590, lng: 73.8577, battery: 100, target: null, eta: null, sceneTimer: null },
        { id: 'D-Bravo', status: 'IDLE', lat: 18.5350, lng: 73.8800, battery: 100, target: null, eta: null, sceneTimer: null },
        { id: 'D-Charlie', status: 'IDLE', lat: 18.4850, lng: 73.8200, battery: 100, target: null, eta: null, sceneTimer: null },
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
    console.log('🔄 System reset requested. All 3 drones returned to base.');
    res.json({ success: true, message: 'System reset. Fleet restored.' });
});

app.post('/api/start-drone', (req, res) => {
    if (droneProcess) {
        console.log('🔄 Terminating existing drone process...');
        droneProcess.kill();
    }

    console.log('🚁 Launching Python Drone Video Streamer...');
    droneProcess = spawn('/opt/anaconda3/bin/python', ['drones/drone_stream_mobile.py'], {
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

app.post('/api/upload-video', upload.single('video'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No video file uploaded.' });
    }

    if (cctvProcess) {
        console.log('🔄 Terminating existing CCTV process for new video upload...');
        cctvProcess.kill('SIGINT');
        cctvProcess = null;
    }

    const videoPath = require('path').resolve(__dirname, req.file.path);
    console.log(`📹 Launching Python CCTV Video Analyzer on uploaded file: ${videoPath}...`);

    cctvProcess = spawn('/opt/anaconda3/bin/python', ['cameras/cctv_video_analyzer.py', videoPath], {
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

    res.json({ success: true, message: 'CCTV Video upload received and inference started.' });
});

app.post('/api/start-cctv', (req, res) => {
    if (cctvProcess) {
        console.log('🔄 Terminating existing CCTV process...');
        cctvProcess.kill();
    }

    console.log('📹 Launching Python CCTV Streamer...');
    cctvProcess = spawn('/opt/anaconda3/bin/python', ['cameras/cctv_monitor_invert.py'], {
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

app.post('/api/stop-cctv', (req, res) => {
    if (cctvProcess) {
        console.log('🛑 Stopping CCTV process on user request...');
        cctvProcess.kill('SIGINT');
        cctvProcess = null;
        res.json({ success: true, message: 'CCTV camera process stopped.' });
    } else {
        res.json({ success: false, message: 'No CCTV process is currently running.' });
    }
});

// ─── SIMULATION ENDPOINTS ────────────────────────────────────────────────────

// Manual incident trigger from the dashboard (click-to-place or button)
app.post('/api/simulate', (req, res) => {
    const { type, lat, lng, severity } = req.body;

    const newAlert = {
        id: `SIM-${Date.now()}`,
        type: type || 'Simulated Incident',
        lat: lat || 18.5204,
        lng: lng || 73.8567,
        severity: severity || 'High',
        camera_id: 'Simulation Engine',
        timestamp: new Date().toISOString()
    };

    alerts.push(newAlert);
    console.log(`\n🎮 SIMULATED INCIDENT: ${newAlert.type} at [${newAlert.lat.toFixed(4)}, ${newAlert.lng.toFixed(4)}]`);

    // Smart Dispatch
    let closestDrone = null;
    let minDistance = Infinity;
    drones.forEach(drone => {
        if (drone.status === 'IDLE' && drone.battery >= MIN_DISPATCH_BATTERY) {
            const dist = calculateDistance(drone.lat, drone.lng, newAlert.lat, newAlert.lng);
            if (dist < minDistance) { minDistance = dist; closestDrone = drone; }
        }
    });

    if (closestDrone) {
        closestDrone.status = 'DISPATCHED';
        closestDrone.target = { lat: newAlert.lat, lng: newAlert.lng, alertId: newAlert.id };
        closestDrone.sceneTimer = null;
        console.log(`🚁 Dispatching ${closestDrone.id} (${Math.round(closestDrone.battery)}%) | Distance: ${Math.round(minDistance)}m`);

        // Auto-launch drone camera (phone) if not already running
        if (!droneProcess) {
            console.log('📹 Auto-launching drone camera (phone) for Simulation...');
            droneProcess = spawn('python', ['../drones/drone_stream_mobile.py'], { cwd: __dirname });
            droneProcess.stdout.on('data', (d) => console.log(`[DRONE CAM]: ${d}`));
            droneProcess.stderr.on('data', (d) => console.error(`[DRONE CAM ERROR]: ${d}`));
            droneProcess.on('close', (code) => { console.log(`❌ Drone camera exited (code ${code})`); droneProcess = null; });
        }
    }

    io.emit('new_alert', newAlert);
    res.json({ success: true, alert: newAlert, dispatched: closestDrone ? closestDrone.id : null });
});

// Auto-simulation mode — generates random incidents on a timer
let autoSimInterval = null;
const INCIDENT_TYPES = [
    { type: 'Fallen Person Detected', severity: 'CRITICAL' },
    { type: 'Crowd Gathering Detected', severity: 'High' },
    { type: 'Abandoned Bag Detected', severity: 'High' },
    { type: 'SOS - Hands Raised', severity: 'CRITICAL' },
    { type: 'Suspicious Vehicle Stop', severity: 'Medium' },
    { type: 'Unauthorized Zone Entry', severity: 'High' },
    { type: 'Traffic Violation', severity: 'Medium' },
];

// Pune area bounding box for random location generation
const PUNE_BOUNDS = { latMin: 18.44, latMax: 18.56, lngMin: 73.82, lngMax: 73.90 };

app.post('/api/auto-simulate', (req, res) => {
    const { enabled } = req.body;

    if (enabled && !autoSimInterval) {
        console.log('🎮 Auto-Simulation STARTED — generating random incidents...');
        autoSimInterval = setInterval(() => {
            const incident = INCIDENT_TYPES[Math.floor(Math.random() * INCIDENT_TYPES.length)];
            const lat = PUNE_BOUNDS.latMin + Math.random() * (PUNE_BOUNDS.latMax - PUNE_BOUNDS.latMin);
            const lng = PUNE_BOUNDS.lngMin + Math.random() * (PUNE_BOUNDS.lngMax - PUNE_BOUNDS.lngMin);

            const newAlert = {
                id: `AUTO-${Date.now()}`,
                type: incident.type,
                lat, lng,
                severity: incident.severity,
                camera_id: 'Auto-Simulation',
                timestamp: new Date().toISOString()
            };

            alerts.push(newAlert);
            console.log(`🎮 AUTO: ${newAlert.type} at [${lat.toFixed(4)}, ${lng.toFixed(4)}]`);

            // Dispatch closest idle drone
            let closestDrone = null;
            let minDistance = Infinity;
            drones.forEach(drone => {
                if (drone.status === 'IDLE' && drone.battery >= MIN_DISPATCH_BATTERY) {
                    const dist = calculateDistance(drone.lat, drone.lng, lat, lng);
                    if (dist < minDistance) { minDistance = dist; closestDrone = drone; }
                }
            });

            if (closestDrone) {
                closestDrone.status = 'DISPATCHED';
                closestDrone.target = { lat, lng, alertId: newAlert.id };
                closestDrone.sceneTimer = null;
                console.log(`🚁 Auto-dispatching ${closestDrone.id}`);

                // Auto-launch drone camera (phone) if not already running
                if (!droneProcess) {
                    console.log('📹 Auto-launching drone camera (phone) for Auto-Simulation...');
                    droneProcess = spawn('python', ['../drones/drone_stream_mobile.py'], { cwd: __dirname });
                    droneProcess.stdout.on('data', (d) => console.log(`[DRONE CAM]: ${d}`));
                    droneProcess.stderr.on('data', (d) => console.error(`[DRONE CAM ERROR]: ${d}`));
                    droneProcess.on('close', (code) => { console.log(`❌ Drone camera exited (code ${code})`); droneProcess = null; });
                }
            }

            io.emit('new_alert', newAlert);
        }, 8000 + Math.random() * 7000); // Random interval: 8-15 seconds

        res.json({ success: true, message: 'Auto-simulation started.' });
    } else if (!enabled && autoSimInterval) {
        clearInterval(autoSimInterval);
        autoSimInterval = null;
        console.log('🎮 Auto-Simulation STOPPED.');
        res.json({ success: true, message: 'Auto-simulation stopped.' });
    } else {
        res.json({ success: true, message: enabled ? 'Already running.' : 'Not running.' });
    }
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
        // ─── DISPATCHED: Move towards incident ───────────────────────────
        if (drone.status === 'DISPATCHED' && drone.target) {
            const targetLat = drone.target.lat;
            const targetLng = drone.target.lng;

            const dist = calculateDistance(drone.lat, drone.lng, targetLat, targetLng);

            if (dist < 10) {
                // Drone arrived!
                drone.status = 'ON_SCENE';
                drone.eta = 0;
                drone.sceneTimer = Date.now(); // Start the on-scene clock
                console.log(`🎯 ${drone.id} has arrived on scene!`);
                stateChanged = true;

                // ─── TRIGGER GEMINI AI REPORT ─────────────────────────────
                const alertForDrone = alerts.find(a => a.id === drone.target?.alertId);
                const incidentType = alertForDrone ? alertForDrone.type : 'Unknown Incident';

                if (latestDroneFrame) {
                    console.log(`🤖 Generating AI situational report for ${drone.id}...`);
                    generateReport(latestDroneFrame, incidentType).then(report => {
                        const reportData = {
                            droneId: drone.id,
                            alertId: drone.target?.alertId,
                            incidentType,
                            timestamp: new Date().toISOString(),
                            report,
                            frameImage: latestDroneFrame,
                        };
                        io.emit('ai_report', reportData);
                        console.log(`📋 AI Report generated and sent to dashboard.`);
                    }).catch(err => {
                        console.error('❌ AI Report failed:', err);
                    });
                } else {
                    console.log('⚠️ No drone frame available for AI report. Sending placeholder.');
                    io.emit('ai_report', {
                        droneId: drone.id,
                        alertId: drone.target?.alertId,
                        incidentType,
                        timestamp: new Date().toISOString(),
                        report: `**Drone ${drone.id} is on scene.**\n\nIncident: ${incidentType}\n\n⚠️ No video frame available for AI analysis. The drone camera may not be active.\n\n**Recommendation:** Start the drone camera feed to enable AI-powered situational analysis.`,
                        frameImage: null,
                    });
                }
            } else {
                // Move drone programmatically
                const speedPerTick = DRONE_SPEED_MPS * (TICK_RATE_MS / 1000);
                const toRad = angle => angle * Math.PI / 180;

                const yTarget = Math.sin(toRad(targetLng - drone.lng)) * Math.cos(toRad(targetLat));
                const xTarget = Math.cos(toRad(drone.lat)) * Math.sin(toRad(targetLat)) -
                    Math.sin(toRad(drone.lat)) * Math.cos(toRad(targetLat)) * Math.cos(toRad(targetLng - drone.lng));
                let bearing = Math.atan2(yTarget, xTarget);

                // No-Fly Zone Circumference Routing
                const NO_FLY_LAT = 18.5200;
                const NO_FLY_LNG = 73.8550;
                const NO_FLY_RADIUS_M = 300;
                const AVOID_RADIUS_M = 320;

                const distToNoFly = calculateDistance(drone.lat, drone.lng, NO_FLY_LAT, NO_FLY_LNG);

                if (distToNoFly <= AVOID_RADIUS_M) {
                    const yCenter = Math.sin(toRad(NO_FLY_LNG - drone.lng)) * Math.cos(toRad(NO_FLY_LAT));
                    const xCenter = Math.cos(toRad(drone.lat)) * Math.sin(toRad(NO_FLY_LAT)) -
                        Math.sin(toRad(drone.lat)) * Math.cos(toRad(NO_FLY_LAT)) * Math.cos(toRad(NO_FLY_LNG - drone.lng));
                    const bearingToCenter = Math.atan2(yCenter, xCenter);

                    let angleDiff = bearing - bearingToCenter;
                    angleDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));

                    let angularRadius = Math.PI / 2;
                    if (distToNoFly > NO_FLY_RADIUS_M) {
                        angularRadius = Math.asin(NO_FLY_RADIUS_M / distToNoFly);
                    }

                    if (Math.abs(angleDiff) < angularRadius) {
                        const orbitDir = angleDiff >= 0 ? 1 : -1;
                        let tangentBearing = bearingToCenter + (orbitDir * Math.PI / 2);
                        if (distToNoFly < AVOID_RADIUS_M) {
                            const pushOutAngle = ((AVOID_RADIUS_M - distToNoFly) / AVOID_RADIUS_M) * (Math.PI / 4);
                            tangentBearing -= orbitDir * pushOutAngle;
                        }
                        bearing = tangentBearing;
                    }
                }

                const latMovement = Math.cos(bearing) * (speedPerTick / 111320);
                const lngMovement = Math.sin(bearing) * (speedPerTick / (111320 * Math.cos(toRad(drone.lat))));

                drone.lat += latMovement;
                drone.lng += lngMovement;
                drone.battery = Math.max(0, drone.battery - BATTERY_DRAIN_PER_TICK);
                drone.eta = Math.round(dist / DRONE_SPEED_MPS);
                stateChanged = true;
            }
        }

        // ─── ON_SCENE: Wait, then auto-return to base ───────────────────
        if (drone.status === 'ON_SCENE' && drone.sceneTimer) {
            const elapsed = (Date.now() - drone.sceneTimer) / 1000;
            if (elapsed >= SCENE_DURATION_SEC) {
                const base = DRONE_BASES[drone.id];
                drone.status = 'RETURNING';
                drone.target = { lat: base.lat, lng: base.lng, alertId: null };
                drone.sceneTimer = null;
                console.log(`🔄 ${drone.id} mission complete. Returning to base.`);
                stateChanged = true;
            }
        }

        // ─── RETURNING: Fly back to base station ────────────────────────
        if (drone.status === 'RETURNING' && drone.target) {
            const base = DRONE_BASES[drone.id];
            const dist = calculateDistance(drone.lat, drone.lng, base.lat, base.lng);

            if (dist < 10) {
                drone.status = 'IDLE';
                drone.lat = base.lat;
                drone.lng = base.lng;
                drone.target = null;
                drone.eta = null;
                console.log(`🏠 ${drone.id} has returned to base and is now IDLE.`);
                stateChanged = true;
            } else {
                const toRad = angle => angle * Math.PI / 180;
                const speedPerTick = DRONE_SPEED_MPS * (TICK_RATE_MS / 1000);

                const yTarget = Math.sin(toRad(base.lng - drone.lng)) * Math.cos(toRad(base.lat));
                const xTarget = Math.cos(toRad(drone.lat)) * Math.sin(toRad(base.lat)) -
                    Math.sin(toRad(drone.lat)) * Math.cos(toRad(base.lat)) * Math.cos(toRad(base.lng - drone.lng));
                const bearing = Math.atan2(yTarget, xTarget);

                drone.lat += Math.cos(bearing) * (speedPerTick / 111320);
                drone.lng += Math.sin(bearing) * (speedPerTick / (111320 * Math.cos(toRad(drone.lat))));
                drone.battery = Math.max(0, drone.battery - BATTERY_DRAIN_PER_TICK);
                drone.eta = Math.round(dist / DRONE_SPEED_MPS);
                stateChanged = true;
            }
        }

        // ─── IDLE at base: Slowly recharge battery ──────────────────────
        if (drone.status === 'IDLE' && drone.battery < 100) {
            drone.battery = Math.min(100, drone.battery + BATTERY_RECHARGE_PER_TICK);
            stateChanged = true;
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
        latestDroneFrame = data.image; // Store for AI report
        socket.broadcast.emit('video_frame', data); // THIS IS the critical line that sends it to the frontend!
    });

    // Accept mobile app gps telemetry over the socket (faster than REST polling)
    socket.on('telemetry_update', (telemetryData) => {
        const { drone_id, lat, lng } = telemetryData;
        const drone = drones.find(d => d.id === drone_id);
        if (drone) {
            drone.lat = lat;
            drone.lng = lng;
            // Instantly sync this override out to the dashboard frontend
            io.emit('telemetry_update', drones);
        }
    });

    // Broadcast video frames from the Python CCTV trigger (Stationary Camera)
    socket.on('cctv_frame', (data) => {
        socket.broadcast.emit('cctv_frame', data);
    });

    // Receive triggered alerts directly from Edge AI testers or CCTV via websockets
    socket.on('incident_alert', (incidentData) => {
        const newAlert = {
            id: incidentData.id || `ALT-${Date.now()}`,
            type: incidentData.type || 'Unknown Incident',
            lat: incidentData.lat || 18.5204,
            lng: incidentData.lng || 73.8567,
            severity: incidentData.severity || 'High',
            camera_id: incidentData.camera_id || 'Edge/CCTV Sensor',
            timestamp: new Date().toISOString()
        };

        alerts.push(newAlert);
        console.log(`\n🚨 NEW WEBSOCKET ALERT RECEIVED: ${newAlert.type}`);

        // Smart Dispatch: Find closest IDLE drone with sufficient battery
        let closestDrone = null;
        let minDistance = Infinity;

        drones.forEach(drone => {
            if (drone.status === 'IDLE' && drone.battery >= MIN_DISPATCH_BATTERY) {
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
            closestDrone.sceneTimer = null;
            console.log(`🚁 Dispatching ${closestDrone.id} (Battery: ${Math.round(closestDrone.battery)}%) to incident. Distance: ${Math.round(minDistance)}m`);
        } else {
            console.log("⚠️ No idle drones with sufficient battery available for dispatch!");
        }

        // Notify all clients (dashboards)
        io.emit('new_alert', newAlert);
    });

    // --- WebRTC Signaling ---
    socket.on('webrtc_offer', (data) => {
        console.log(`[WebRTC] Offer from ${socket.id} (broadcaster) -> relaying to others`);
        socket.broadcast.emit('webrtc_offer', data);
    });

    socket.on('webrtc_answer', (data) => {
        console.log(`[WebRTC] Answer from ${socket.id} (viewer) -> relaying to others`);
        socket.broadcast.emit('webrtc_answer', data);
    });

    socket.on('webrtc_ice_candidate', (data) => {
        // console.log(`[WebRTC] ICE Candidate from ${socket.id}`);
        socket.broadcast.emit('webrtc_ice_candidate', data);
    });

    socket.on('viewer_joined', () => {
        console.log(`[WebRTC] Viewer ${socket.id} joined, notifying broadcaster`);
        socket.broadcast.emit('viewer_joined');
    });

    socket.on('disconnect', () => {
        console.log('💻 Command Center Disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
const HTTPS_PORT = 3443;

// Get local network IP for display
const os = require('os');
const getLocalIP = () => {
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if (net.family === 'IPv4' && !net.internal) return net.address;
        }
    }
    return 'localhost';
};

server.listen(PORT, '0.0.0.0', () => {
    const ip = getLocalIP();
    console.log(`🚀 HTTP server running on http://${ip}:${PORT}`);
});
if (httpsServer) {
    httpsServer.listen(HTTPS_PORT, '0.0.0.0', () => {
        const ip = getLocalIP();
        console.log(`🔒 HTTPS server running on https://${ip}:${HTTPS_PORT}`);
        console.log(`📱 Open on phone Chrome: https://${ip}:${HTTPS_PORT}/broadcast.html`);
    });
}
