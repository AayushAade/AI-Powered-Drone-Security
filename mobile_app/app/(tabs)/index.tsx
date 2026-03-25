import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView } from 'react-native';
import { Camera, CameraView } from 'expo-camera';
import * as Location from 'expo-location';
import { io, Socket } from 'socket.io-client';

const SERVER_URL = process.env.EXPO_PUBLIC_SERVER_IP
  ? `http://${process.env.EXPO_PUBLIC_SERVER_IP}:3000`
  : 'http://10.141.237.138:3000';

const DRONE_ID = 'D-Alpha';

export default function App() {
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [hasLocationPermission, setHasLocationPermission] = useState<boolean | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [liveInsights, setLiveInsights] = useState<string>('Awaiting mission start...');

  const socketRef = useRef<Socket | null>(null);
  const cameraRef = useRef<CameraView | null>(null);
  const frameIntervalRef = useRef<any>(null);

  // ───────────── Permissions ─────────────
  useEffect(() => {
    (async () => {
      const cam = await Camera.requestCameraPermissionsAsync();
      setHasCameraPermission(cam.status === 'granted');
      const loc = await Location.requestForegroundPermissionsAsync();
      setHasLocationPermission(loc.status === 'granted');
    })();
  }, []);

  // ───────────── Main Drone Session ─────────────
  useEffect(() => {
    if (!isActive) {
      if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
      if (socketRef.current) socketRef.current.disconnect();
      return;
    }

    let locationSub: Location.LocationSubscription | null = null;
    
    const socket = io(SERVER_URL, { transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      setLiveInsights('Uplink active. Streaming vision telemetry...');
      
      // START FRAME CAPTURE LOOP
      frameIntervalRef.current = setInterval(async () => {
        if (cameraRef.current && socket.connected) {
          try {
            const photo = await cameraRef.current.takePictureAsync({
              base64: true,
              quality: 0.2, // Low quality for high-frequency streaming
              shutterSound: false,
            });
            
            if (photo?.base64) {
              socket.emit('video_frame', { 
                image: photo.base64,
                drone_id: DRONE_ID 
              });
            }
          } catch (e) {
            console.log('Frame capture error:', e);
          }
        }
      }, 500); // 2 FPS for stability in Expo Go
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      setLiveInsights('Warning: Connection lost.');
    });

    // ── Location Tracking ──
    (async () => {
      if (hasLocationPermission) {
        locationSub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 1000, distanceInterval: 1 },
          (newLoc) => {
            setLocation(newLoc);
            if (socket.connected) {
              socket.emit('telemetry_update', {
                drone_id: DRONE_ID,
                lat: newLoc.coords.latitude,
                lng: newLoc.coords.longitude,
              });
            }
          }
        );
      }
    })();

    return () => {
      if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
      if (locationSub) locationSub.remove();
      socket.disconnect();
    };
  }, [isActive, hasLocationPermission]);

  // ───────────── Render ─────────────
  if (hasCameraPermission === null || hasLocationPermission === null) return <View style={styles.container} />;
  
  if (!hasCameraPermission) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: 'white' }}>No Camera Access</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        ref={cameraRef}
      />
      
      {!isActive && (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }]}>
          <Text style={{ color: '#555', fontSize: 14, fontFamily: 'Courier' }}>
            Camera inactive
          </Text>
        </View>
      )}

      <View style={styles.overlay}>
        {/* Top Header */}
        <View style={styles.header}>
          <Text style={styles.statusText}>
            Drone Status: {isActive ? 'ACTIVE 🟢' : 'IDLE 🔴'}
          </Text>
          <Text style={styles.connectionText}>
            Server: {isConnected ? 'Connected 📡' : 'Disconnected 🔌'}
          </Text>
          {isActive && (
            <Text style={{ color: '#ff4444', fontSize: 12, fontFamily: 'Courier', marginTop: 3 }}>
              ● STREAMING BASE64 TELEMETRY
            </Text>
          )}
        </View>

        {/* Telemetry + Insights */}
        <View style={styles.dataContainer}>
          <View style={styles.telemetryBox}>
            <Text style={styles.telemetryHeader}>TELEMETRY</Text>
            <Text style={styles.telemetryText}>ID: {DRONE_ID}</Text>
            {location ? (
              <>
                <Text style={styles.telemetryText}>LAT: {location.coords.latitude.toFixed(5)}</Text>
                <Text style={styles.telemetryText}>LNG: {location.coords.longitude.toFixed(5)}</Text>
                <Text style={styles.telemetryText}>SPD: {location.coords.speed?.toFixed(1) || 0} m/s</Text>
              </>
            ) : (
              <Text style={styles.telemetryText}>Acquiring GPS...</Text>
            )}
          </View>

          <View style={styles.insightsBox}>
            <Text style={styles.telemetryHeader}>LIVE EDGE INSIGHTS</Text>
            <ScrollView style={{ maxHeight: 100 }}>
              <Text style={styles.insightsText}>{liveInsights}</Text>
            </ScrollView>
          </View>
        </View>

        {/* Alerts Center (Handled by Command Center) */}
        <View style={{ alignItems: 'center' }}>
          {liveInsights.includes('DETECTION') && (
            <View style={styles.alertBox}>
              <Text style={styles.alertText}>🚨 {liveInsights}</Text>
            </View>
          )}
        </View>

        {/* Controls */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.button, isActive ? styles.buttonStop : styles.buttonStart]}
            onPress={() => setIsActive(!isActive)}
          >
            <Text style={styles.buttonText}>
              {isActive ? 'LAND DRONE (STOP)' : 'LAUNCH DRONE (START)'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'space-between',
    padding: 15,
    paddingTop: 50,
  },
  header: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 15,
    borderRadius: 10,
    alignSelf: 'stretch',
  },
  statusText: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  connectionText: { color: '#00ff00', fontSize: 14, marginTop: 5, fontFamily: 'Courier' },
  dataContainer: { flexDirection: 'column', gap: 15, width: '100%' },
  telemetryBox: {
    backgroundColor: 'rgba(0,20,0,0.7)',
    padding: 15,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#00ff00',
  },
  telemetryHeader: {
    color: '#00ff00',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 5,
    letterSpacing: 1,
  },
  telemetryText: { color: 'white', fontSize: 13, fontFamily: 'Courier', marginBottom: 2 },
  insightsBox: {
    backgroundColor: 'rgba(0,0,40,0.7)',
    padding: 15,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#4d94ff',
  },
  insightsText: {
    color: '#e6f0ff',
    fontSize: 15,
    lineHeight: 22,
    fontFamily: 'Courier',
  },
  alertBox: {
    backgroundColor: 'rgba(255,0,0,0.9)',
    padding: 15,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
    shadowColor: '#ff0000',
    shadowRadius: 10,
    shadowOpacity: 0.8,
  },
  alertText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  footer: { alignItems: 'center', paddingBottom: 20 },
  button: {
    padding: 18,
    borderRadius: 30,
    width: '90%',
    alignItems: 'center',
    elevation: 5,
  },
  buttonStart: { backgroundColor: '#34C759' },
  buttonStop: { backgroundColor: '#FF3B30' },
  buttonText: { fontSize: 18, fontWeight: 'bold', color: 'white', letterSpacing: 1 },
});
