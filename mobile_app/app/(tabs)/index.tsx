import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView } from 'react-native';
import { Camera, CameraView } from 'expo-camera';
import * as Location from 'expo-location';
import { io, Socket } from 'socket.io-client';
import { RTCPeerConnection, RTCIceCandidate, RTCSessionDescription, mediaDevices, RTCView, MediaStream } from 'react-native-webrtc';

const SERVER_URL = process.env.EXPO_PUBLIC_SERVER_IP
  ? `http://${process.env.EXPO_PUBLIC_SERVER_IP}:3000`
  : 'http://10.141.237.138:3000';

const DRONE_ID = 'D-Alpha';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export default function App() {
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [hasLocationPermission, setHasLocationPermission] = useState<boolean | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [latestAiAlert, setLatestAiAlert] = useState<string | null>(null);
  const [liveInsights, setLiveInsights] = useState<string>('Awaiting mission start...');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

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
    if (!isActive) return;

    let locationSub: Location.LocationSubscription | null = null;
    let isCancelled = false;

    const run = async () => {
      setLiveInsights('Acquiring camera stream...');

      // ── Step 1: Get camera stream FIRST (silent, no shutter) ──
      let stream: MediaStream | null = null;
      try {
        const isFront = false;
        const devices = (await mediaDevices.enumerateDevices()) as any[];
        let videoSourceId: string | undefined;
        for (const d of devices) {
          if (d.kind === 'videoinput' && d.facing === (isFront ? 'front' : 'environment')) {
            videoSourceId = d.deviceId;
          }
        }
        stream = await mediaDevices.getUserMedia({
          audio: false,
          video: {
            width: 1280,
            height: 720,
            frameRate: 30,
            facingMode: isFront ? 'user' : 'environment',
            deviceId: videoSourceId,
          },
        });
        console.log('[WebRTC] ✅ Camera stream acquired:', stream.getTracks().length, 'tracks');
      } catch (e) {
        console.error('[WebRTC] ❌ Failed to get camera stream:', e);
        setLiveInsights('Error: Could not access camera for WebRTC.');
        return;
      }

      if (isCancelled) { stream.getTracks().forEach((t: any) => t.stop()); return; }

      localStreamRef.current = stream;
      setLocalStream(stream);
      setLiveInsights('Camera ready. Connecting to Command Center...');

      // ── Step 2: Connect to backend ──
      const socket = io(SERVER_URL, { transports: ['websocket'] });
      socketRef.current = socket;

      socket.on('connect', () => {
        console.log('[Socket] ✅ Connected:', socket.id);
        setIsConnected(true);
        setLiveInsights('Connected. Broadcasting live video feed...');
        // As soon as we connect, create an offer and send it
        createAndSendOffer(socket, stream!);
      });

      socket.on('disconnect', () => {
        console.log('[Socket] ❌ Disconnected');
        setIsConnected(false);
        setLiveInsights('Connection to Command Center lost.');
      });

      // ── Step 3: WebRTC signaling ──
      socket.on('webrtc_answer', async (data: any) => {
        console.log('[WebRTC] Answer received from viewer');
        try {
          if (peerConnectionRef.current) {
            await peerConnectionRef.current.setRemoteDescription(
              new RTCSessionDescription(data.answer)
            );
            console.log('[WebRTC] ✅ Remote description set successfully');
          }
        } catch (e) {
          console.error('[WebRTC] ❌ Error setting answer:', e);
        }
      });

      socket.on('webrtc_ice_candidate', async (data: any) => {
        try {
          if (peerConnectionRef.current && data.candidate) {
            await peerConnectionRef.current.addIceCandidate(
              new RTCIceCandidate(data.candidate)
            );
          }
        } catch (e) {
          console.error('[WebRTC] ❌ Error adding ICE candidate:', e);
        }
      });

      // When a new viewer joins (e.g. dashboard page refreshed), re-send offer
      socket.on('viewer_joined', () => {
        console.log('[WebRTC] 👁️ New viewer joined — re-creating offer');
        createAndSendOffer(socket, stream!);
      });

      // ── Step 4: Location tracking ──
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
    };

    run();

    // ── Cleanup ──
    return () => {
      isCancelled = true;
      setLiveInsights('Drone Idle.');
      setIsConnected(false);
      setLocation(null);

      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t: any) => t.stop());
        localStreamRef.current = null;
        setLocalStream(null);
      }
      if (locationSub) {
        locationSub.remove();
      }
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [isActive, hasLocationPermission]);

  // ───────────── Create PeerConnection + Offer ─────────────
  const createAndSendOffer = async (socket: Socket, stream: MediaStream) => {
    // Close old connection if any
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionRef.current = pc;

    // Add all tracks from the camera stream
    stream.getTracks().forEach((track: any) => {
      pc.addTrack(track, stream);
    });
    console.log('[WebRTC] Added', stream.getTracks().length, 'tracks to peer connection');

    // Send ICE candidates to the viewer via signaling server
    (pc as any).onicecandidate = (event: any) => {
      if (event.candidate && socket.connected) {
        socket.emit('webrtc_ice_candidate', {
          candidate: event.candidate,
          target: 'viewer',
        });
      }
    };

    (pc as any).oniceconnectionstatechange = () => {
      console.log('[WebRTC] ICE state:', (pc as any).iceConnectionState);
      if ((pc as any).iceConnectionState === 'connected') {
        setLiveInsights('🎥 LIVE: Video stream connected to Command Center!');
      }
    };

    // Create and send the offer
    try {
      const offer = await pc.createOffer({});
      await pc.setLocalDescription(offer);
      socket.emit('webrtc_offer', { senderId: 'broadcaster', offer });
      console.log('[WebRTC] ✅ Offer created and sent to signaling server');
    } catch (e) {
      console.error('[WebRTC] ❌ Error creating offer:', e);
    }
  };

  // ───────────── Render ─────────────
  if (hasCameraPermission === null || hasLocationPermission === null) return <View style={styles.container} />;
  if (hasCameraPermission === false || hasLocationPermission === false)
    return <Text style={{ marginTop: 50 }}>No access to camera or location</Text>;

  return (
    <View style={styles.container}>
      {/* WebRTC local camera preview – this is the LIVE video feed, no shutter sounds */}
      {localStream ? (
        <RTCView
          streamURL={localStream.toURL()}
          style={StyleSheet.absoluteFillObject}
          objectFit="cover"
        />
      ) : (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }]}>
          <Text style={{ color: '#555', fontSize: 14, fontFamily: 'Courier' }}>
            {isActive ? 'Acquiring camera...' : 'Camera inactive'}
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
          {isActive && localStream && (
            <Text style={{ color: '#ff4444', fontSize: 12, fontFamily: 'Courier', marginTop: 3 }}>
              ● BROADCASTING LIVE VIDEO
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

        {/* Alerts */}
        <View style={{ alignItems: 'center' }}>
          {latestAiAlert && (
            <View style={styles.alertBox}>
              <Text style={styles.alertText}>🚨 THREAT DETECTED: {latestAiAlert}</Text>
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
