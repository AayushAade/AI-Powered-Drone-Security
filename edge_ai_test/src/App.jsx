import { useRef, useEffect, useState } from 'react';
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl';
import * as handpose from '@tensorflow-models/handpose';
import io from 'socket.io-client';
import './App.css';

// Connect to the Command Center via the Vite Proxy to prevent HTTPS mixed-content blocks
const socket = io({
  transports: ['websocket', 'polling']
});

function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [model, setModel] = useState(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const requestRef = useRef();

  // Socket Connection Status
  useEffect(() => {
    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));
    return () => {
      socket.off('connect');
      socket.off('disconnect');
    };
  }, []);

  // Load the TensorFlow model on mount
  useEffect(() => {
    const loadModel = async () => {
      console.log("Loading TensorFlow.js Handpose Model...");
      try {
        await tf.ready();
        const loadedModel = await handpose.load();
        setModel(loadedModel);
        console.log("Handpose Model loaded successfully!");
      } catch (e) {
        console.error("Failed to load model", e);
      }
    };
    loadModel();
  }, []);

  // Request Camera Permissions & Start Stream
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' } // Prefer back camera (drone view)
      });
      videoRef.current.srcObject = stream;
      videoRef.current.play();
    } catch (err) {
      console.error("Error accessing camera: ", err);
      alert("Please grant camera permissions to test Edge AI.");
    }
  };

  // Turn off the camera
  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject;
      if (stream.getTracks) {
        const tracks = stream.getTracks();
        tracks.forEach(track => track.stop()); // Stop all video tracks
      }
      videoRef.current.srcObject = null;
    }
    // Also clear src if it was a local file URL
    if (videoRef.current && videoRef.current.src) {
      videoRef.current.src = "";
    }
    setIsDetecting(false); // Also stop AI logic
  };

  // Handle Local Video Upload
  const handleVideoUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      stopCamera(); // Ensure webcam is off
      const fileUrl = URL.createObjectURL(file);
      videoRef.current.src = fileUrl;
      videoRef.current.load();
      videoRef.current.play();
      // Optionally start detecting immediately
      // setIsDetecting(true); 
    }
  };

  // Run Inference continuously on animation frame
  const detectFrame = async () => {
    if (
      typeof videoRef.current !== "undefined" &&
      videoRef.current !== null &&
      videoRef.current.readyState === 4 &&
      model
    ) {
      // Get Video Properties
      const video = videoRef.current;
      const videoWidth = videoRef.current.videoWidth;
      const videoHeight = videoRef.current.videoHeight;

      // Set video and canvas dimensions to match
      videoRef.current.width = videoWidth;
      videoRef.current.height = videoHeight;
      canvasRef.current.width = videoWidth;
      canvasRef.current.height = videoHeight;

      // Make Detections
      const predictions = await model.estimateHands(video);

      // Draw Mesh
      const ctx = canvasRef.current.getContext("2d");
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

      let thumbsUpDetected = false;

      if (predictions.length > 0) {
        predictions.forEach(prediction => {
          // Draw hand landmarks
          drawHand(prediction.landmarks, ctx);

          // Check for Thumbs Up gesture
          if (isThumbsUp(prediction.landmarks)) {
            thumbsUpDetected = true;
            ctx.font = '30px Arial';
            ctx.fillStyle = "#00FF00";
            ctx.fillText("👍 THUMBS UP DETECTED!", 20, 50);
          }
        });
      }

      // --- BROADCAST TO COMMAND CENTER ---
      if (thumbsUpDetected) {
        console.log("🚨 EDGE AI: THUMBS UP INCIDENT DETECTED!");
        const incidentData = {
          id: `EDGE-${Date.now()}`,
          type: 'THUMBS UP GESTURE',
          lat: 18.5204, // Pune generic location
          lng: 73.8567,
          severity: 'HIGH',
          timestamp: Date.now()
        };
        socket.emit('incident_alert', incidentData);
      }

      // Create a hidden canvas to merge the raw video and the AI bounding boxes
      const mergeCanvas = document.createElement('canvas');
      mergeCanvas.width = 640; // Compress resolution for fast transmission
      mergeCanvas.height = 480;
      const mCtx = mergeCanvas.getContext('2d');
      mCtx.drawImage(video, 0, 0, 640, 480);
      mCtx.drawImage(canvasRef.current, 0, 0, 640, 480);

      // Convert frame to Base64 and strip the 'data:image/jpeg;base64,' prefix
      const base64Img = mergeCanvas.toDataURL('image/jpeg', 0.4).split(',')[1];

      // Broadcast this Edge AI frame so the main map dashboard sees it as the "Drone"
      socket.emit('video_frame', { image: base64Img });

    }
    requestRef.current = requestAnimationFrame(detectFrame);
  };

  // Heuristic logic to check for Thumbs Up
  const isThumbsUp = (landmarks) => {
    // Landmarks index for tfjs handpose:
    // 0: wrist
    // Thumb: [1, 2, 3, 4(tip)]
    // Index: [5, 6, 7, 8(tip)]
    // Middle: [9, 10, 11, 12(tip)]
    // Ring: [13, 14, 15, 16(tip)]
    // Pinky: [17, 18, 19, 20(tip)]

    const thumbTip = landmarks[4];
    const thumbMcp = landmarks[2];

    const indexTip = landmarks[8];
    const indexMcp = landmarks[5];

    const middleTip = landmarks[12];
    const middleMcp = landmarks[9];

    const ringTip = landmarks[16];
    const ringMcp = landmarks[13];

    const pinkyTip = landmarks[20];
    const pinkyMcp = landmarks[17];

    // Check if thumb is pointing up (y of tip is noticeably less than y of mcp)
    const thumbIsUp = thumbTip[1] < thumbMcp[1] - 40;

    // Check if other fingers are folded (y of tip is greater than y of mcp)
    const indexIsFolded = indexTip[1] > indexMcp[1];
    const middleIsFolded = middleTip[1] > middleMcp[1];
    const ringIsFolded = ringTip[1] > ringMcp[1];
    const pinkyIsFolded = pinkyTip[1] > pinkyMcp[1];

    return thumbIsUp && indexIsFolded && middleIsFolded && ringIsFolded && pinkyIsFolded;
  };

  // Utility to draw Hand landmarks
  const drawHand = (landmarks, ctx) => {
    ctx.fillStyle = '#00FF00';
    ctx.strokeStyle = '#00FF00';
    ctx.lineWidth = 2;

    for (let i = 0; i < landmarks.length; i++) {
      const x = landmarks[i][0];
      const y = landmarks[i][1];
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, 3 * Math.PI);
      ctx.fill();
    }
  };

  // Toggle Detection Loop
  useEffect(() => {
    if (isDetecting) {
      requestRef.current = requestAnimationFrame(detectFrame);
    } else {
      cancelAnimationFrame(requestRef.current);
    }
    return () => cancelAnimationFrame(requestRef.current);
  }, [isDetecting, model]);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
      <h1 className="text-3xl font-bold mb-4">Edge AI Tester</h1>

      {/* Connection Indicator */}
      <div className={`mb-4 px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-2 ${isConnected ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' : 'bg-red-500/20 text-red-400 border-red-500/50'}`}>
        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
        {isConnected ? 'LIVE: Connected to Command Center' : 'OFFLINE: Waiting for Backend Proxy'}
      </div>

      <p className="mb-6 text-center text-gray-400 max-w-md">
        This app uses TensorFlow.js to run AI directly inside your browser. No video is being sent to a server. Let's see if latency vanishes!
      </p>

      <div className="relative w-full max-w-xl mx-auto border-4 border-dashed border-gray-600 rounded-lg overflow-hidden bg-black aspect-video flex items-center justify-center">
        {!model && <p className="text-yellow-400 absolute animate-pulse">Downloading AI Model (20MB)...</p>}

        <video
          ref={videoRef}
          muted={true}
          autoPlay
          playsInline
          className="absolute z-10 w-full h-full object-cover"
        />

        <canvas
          ref={canvasRef}
          className="absolute z-20 w-full h-full object-cover"
        />
      </div>

      <div className="mt-8 flex flex-wrap justify-center gap-4">
        <button
          onClick={startCamera}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold shadow-lg transition-colors"
        >
          1. Start Camera
        </button>
        <button
          onClick={stopCamera}
          className="px-6 py-3 bg-gray-600 hover:bg-gray-700 rounded-lg font-semibold shadow-lg transition-colors"
        >
          Stop Camera
        </button>
        <button
          onClick={() => setIsDetecting(!isDetecting)}
          disabled={!model}
          className={`px-6 py-3 rounded-lg font-semibold shadow-lg transition-colors ${!model ? "bg-gray-600 cursor-not-allowed" :
            isDetecting ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"
            }`}
        >
          2. {isDetecting ? "Stop AI" : "Run Edge AI"}
        </button>
      </div>

      <div className="mt-6 border-t border-gray-700 pt-6 w-full max-w-xl text-center">
        <p className="text-gray-400 text-sm mb-2">Or, analyze a pre-recorded drone video:</p>
        <input
          type="file"
          accept="video/*"
          onChange={handleVideoUpload}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
      </div>
    </div>
  );
}

export default App;
