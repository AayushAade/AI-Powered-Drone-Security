import { StyleSheet, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import React, { useState, useEffect, useRef } from 'react';
import { Camera, CameraView } from 'expo-camera';
import * as Location from 'expo-location';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { socketService } from '@/services/socket';
import { IconSymbol } from '@/components/ui/icon-symbol';

const DRONE_ID = 'Mobile-Sensor-1'; // Represents this device as a sensor

export default function CameraScreen() {
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [hasLocationPermission, setHasLocationPermission] = useState<boolean | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);

  const cameraRef = useRef<CameraView | null>(null);
  const streamIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const locationSubRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    (async () => {
      const camStatus = await Camera.requestCameraPermissionsAsync();
      setHasCameraPermission(camStatus.status === 'granted');

      const locStatus = await Location.requestForegroundPermissionsAsync();
      setHasLocationPermission(locStatus.status === 'granted');
    })();

    const unsubConnection = socketService.subscribe('connection_status', (status: boolean) => {
      setIsConnected(status);
    });

    return () => {
      unsubConnection();
      stopStreaming();
    };
  }, []);

  const startStreaming = async () => {
    if (!hasCameraPermission) return alert("Camera permission required");

    setIsStreaming(true);

    if (hasLocationPermission) {
      locationSubRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 5000,
          distanceInterval: 10,
        },
        (loc) => {
          setLocation(loc);
          if (isConnected) {
            socketService.emit('telemetry_update', {
              drone_id: DRONE_ID,
              lat: loc.coords.latitude,
              lng: loc.coords.longitude
            });
          }
        }
      );
    }

    // Capture frames at ~2fps
    streamIntervalRef.current = setInterval(async () => {
      if (cameraRef.current && isConnected) {
        try {
          const photo = await cameraRef.current.takePictureAsync({
            base64: true,
            quality: 0.2, // Low quality for faster WebSockets
            skipProcessing: true,
            shutterSound: false
          });

          if (photo?.base64) {
            socketService.emit('video_frame', {
              camera_id: DRONE_ID,
              image: `data:image/jpeg;base64,${photo.base64}`
            });
          }
        } catch (e) {
          console.log("Frame capture error:", e);
        }
      }
    }, 500);
  };

  const stopStreaming = () => {
    setIsStreaming(false);
    if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);
    if (locationSubRef.current) locationSubRef.current.remove();
    setLocation(null);
  };

  const toggleStream = () => {
    if (isStreaming) stopStreaming();
    else startStreaming();
  };

  if (hasCameraPermission === null) {
    return <ThemedView style={styles.center}><ActivityIndicator size="large" /></ThemedView>;
  }
  if (hasCameraPermission === false) {
    return <ThemedView style={styles.center}><ThemedText>No access to camera</ThemedText></ThemedView>;
  }

  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} facing="back" flash="off" ref={cameraRef}>
        <View style={styles.overlay}>
          {/* Header Status */}
          <View style={styles.header}>
            <View style={styles.badgeRow}>
              <View style={[styles.dot, { backgroundColor: isConnected ? '#34C759' : '#FF3B30' }]} />
              <ThemedText style={styles.statusText}>{isConnected ? 'Server Connected' : 'Disconnected'}</ThemedText>
            </View>
            {isStreaming && (
              <View style={[styles.badgeRow, { backgroundColor: 'rgba(255,59,48,0.2)' }]}>
                <View style={[styles.dot, { backgroundColor: '#FF3B30' }]} />
                <ThemedText style={[styles.statusText, { color: '#FF3B30' }]}>LIVE STREAMING</ThemedText>
              </View>
            )}
          </View>

          {/* Telemetry (Optional) */}
          {isStreaming && location && (
            <View style={styles.telemetryBox}>
              <ThemedText style={styles.telemetryText}>ID: {DRONE_ID}</ThemedText>
              <ThemedText style={styles.telemetryText}>Lat: {location.coords.latitude.toFixed(5)}</ThemedText>
              <ThemedText style={styles.telemetryText}>Lng: {location.coords.longitude.toFixed(5)}</ThemedText>
            </View>
          )}

          {/* Controls */}
          <View style={styles.controls}>
            <TouchableOpacity
              style={[styles.streamBtn, isStreaming && styles.streamBtnActive]}
              onPress={toggleStream}
            >
              <IconSymbol name={isStreaming ? "stop.fill" : "play.fill"} size={24} color="white" />
              <ThemedText style={styles.btnText}>{isStreaming ? 'STOP STREAM' : 'START CAMERA STREAM'}</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, backgroundColor: 'black' },
  camera: { flex: 1 },
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 60, // save area roughly
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  statusText: { fontSize: 12, fontWeight: 'bold', color: 'white' },
  telemetryBox: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 12,
    borderRadius: 8,
    marginTop: 'auto',
    marginBottom: 20,
  },
  telemetryText: { color: '#00ff00', fontFamily: 'Courier', fontSize: 12, marginBottom: 4 },
  controls: {
    paddingBottom: 20,
  },
  streamBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#007AFF', // iOS blue
    paddingVertical: 16,
    borderRadius: 30,
  },
  streamBtnActive: {
    backgroundColor: '#FF3B30', // Red for active/stop
  },
  btnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  }
});
