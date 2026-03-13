import { useRef, useEffect, useState, useImperativeHandle, forwardRef, useCallback } from 'react';
import { Play, Pause } from 'lucide-react';
import { FaceMesh, Results } from '@mediapipe/face_mesh';

export interface LiveCameraRef {
  startCamera: () => void;
  stopCamera: () => void;
  captureFrame: () => string | null;
}

interface TrackedFace {
  id: string;
  persistentId: string; // Persistent ID that survives when face leaves frame
  bbox: { x: number; y: number; width: number; height: number };
  centerX: number;
  centerY: number;
  name?: string;
  status: 'detecting' | 'recognizing' | 'recognized' | 'not-found' | 'unauthorized';
  confidence?: number;
  lastSeen: number;
  recognitionAttempts: number;
  createdAt: number; // When face was first detected
  lastRecognitionTime?: number; // When recognition was last attempted
  attendanceMarked?: boolean; // Whether attendance has been marked today
  attendanceMarkedTime?: number; // When attendance was marked
}

interface LiveCameraProps {
  onFaceDetected?: (hasFace: boolean) => void;
  onMatchResult?: (result: { matched: boolean; confidence?: number; identity?: string; person?: any }) => void;
  autoStart?: boolean;
  mode?: 'verify' | 'recognize';
  cameraId?: string; // Camera identifier for multi-camera support
  compact?: boolean; // If true, hide controls and minimize UI for grid view
  onStartRequest?: () => void; // Callback when start is requested externally
}

const LiveCamera = forwardRef<LiveCameraRef, LiveCameraProps>(
  ({ onFaceDetected, onMatchResult, autoStart = true, mode = 'recognize', cameraId = 'laptop-camera', compact = false, onStartRequest }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const faceMeshRef = useRef<FaceMesh | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const faceDetectionInitialized = useRef<boolean>(false);
    
    const [isStreaming, setIsStreaming] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [faceDetected, setFaceDetected] = useState(false);
    const [trackedFaces, setTrackedFaces] = useState<Map<string, TrackedFace>>(new Map());
    const [error, setError] = useState<string>('');
    const [faceDetectionError, setFaceDetectionError] = useState<string>('');

    // Track active API calls to prevent duplicates
    const activeRecognitionCalls = useRef<Set<string>>(new Set());
    
    // Persistent face registry - survives when faces leave frame
    const persistentFacesRef = useRef<Map<string, { name?: string; status: 'detecting' | 'recognizing' | 'recognized' | 'not-found' | 'unauthorized'; confidence?: number; createdAt: number; attendanceMarked?: boolean }>>(new Map());
    
    // Frame counter for periodic operations
    // const frameCountRef = useRef(0);

    // Process detected faces with improved motion tracking
    const processDetections = useCallback(async (detections: Array<{ box: { xMin: number; yMin: number; width: number; height: number } }>) => {
      if (!videoRef.current || !overlayCanvasRef.current || isPaused) return;

      const video = videoRef.current;
      const overlayCanvas = overlayCanvasRef.current;
      const ctx = overlayCanvas.getContext('2d');
      if (!ctx) return;

      overlayCanvas.width = video.videoWidth;
      overlayCanvas.height = video.videoHeight;

      // Clear overlay
      ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

      const now = Date.now();
      const newTrackedFaces = new Map(trackedFaces);
      const detectedFaceIds = new Set<string>();

      // Process detected faces
      if (detections && detections.length > 0) {
        setFaceDetected(true);
        if (onFaceDetected) {
          onFaceDetected(true);
        }

        for (const detection of detections) {
          const box = detection.box;
          const x = box.xMin * overlayCanvas.width;
          const y = box.yMin * overlayCanvas.height;
          const width = box.width * overlayCanvas.width;
          const height = box.height * overlayCanvas.height;
          const centerX = x + width / 2;
          const centerY = y + height / 2;

          // Match to existing tracked face or create new
          let faceId = matchFaceToTracked({ x, y, width, height }, newTrackedFaces);
          if (!faceId) {
            faceId = generateFaceId(centerX, centerY);
          }

          detectedFaceIds.add(faceId);

          let trackedFace = newTrackedFaces.get(faceId);
          const persistentFaces = persistentFacesRef.current;
          
          if (!trackedFace) {
            // New face detected - check persistent registry
            const persistentData = persistentFaces.get(faceId);
            
            trackedFace = {
              id: faceId,
              persistentId: faceId,
              bbox: { x, y, width, height },
              centerX,
              centerY,
              name: persistentData?.name,
              status: persistentData?.status || 'detecting' as const,
              confidence: persistentData?.confidence,
              lastSeen: now,
              recognitionAttempts: 0,
              createdAt: now,
              attendanceMarked: persistentData?.attendanceMarked,
              attendanceMarkedTime: persistentData?.createdAt,
            };
            newTrackedFaces.set(faceId, trackedFace);
            console.log(`[Face Detected] ID: ${faceId}, Status: ${trackedFace.status}, Attendance Marked: ${trackedFace.attendanceMarked}`);
            
            // Start recognition if not already recognized AND not already marked present today
            if (!persistentData?.name && trackedFace.status === 'detecting') {
              recognizeFace(faceId, { x, y, width, height });
            }
          } else {
            // Update existing tracked face with smooth motion interpolation
            const prevBbox = trackedFace.bbox;
            
            // Apply motion smoothing (lerp)
            const smoothingFactor = 0.7; // Higher = more responsive, lower = smoother
            trackedFace.bbox = {
              x: prevBbox.x + (x - prevBbox.x) * smoothingFactor,
              y: prevBbox.y + (y - prevBbox.y) * smoothingFactor,
              width: prevBbox.width + (width - prevBbox.width) * smoothingFactor,
              height: prevBbox.height + (height - prevBbox.height) * smoothingFactor,
            };
            
            trackedFace.centerX = trackedFace.bbox.x + trackedFace.bbox.width / 2;
            trackedFace.centerY = trackedFace.bbox.y + trackedFace.bbox.height / 2;
            trackedFace.lastSeen = now;
            
            // If recognition is still pending, try again
            if ((trackedFace.status === 'detecting' || trackedFace.status === 'recognizing') && 
                !activeRecognitionCalls.current.has(faceId) &&
                (!trackedFace.lastRecognitionTime || now - trackedFace.lastRecognitionTime > 2000)) {
              recognizeFace(faceId, trackedFace.bbox);
            }
            
            // If recognition failed and face is still visible, retry periodically
            if ((trackedFace.status === 'not-found' || trackedFace.status === 'unauthorized') && 
                trackedFace.recognitionAttempts < 3) {
              // Retry after 3 seconds
              if (now - trackedFace.lastSeen > 3000) {
                trackedFace.status = 'detecting';
                trackedFace.recognitionAttempts++;
                recognizeFace(faceId, trackedFace.bbox);
              }
            }
          }

          // Draw bounding box with current bbox values
          if (trackedFace) {
            drawBoundingBox(ctx, trackedFace, trackedFace.bbox.x, trackedFace.bbox.y, trackedFace.bbox.width, trackedFace.bbox.height);
          }
        }
      } else {
        setFaceDetected(false);
        if (onFaceDetected) {
          onFaceDetected(false);
        }
      }

      // Keep faces longer but persist them if they have a status
      for (const [id, face] of newTrackedFaces.entries()) {
        if (!detectedFaceIds.has(id) && now - face.lastSeen > 5000) { // 5 second timeout
          // Save to persistent registry before removing
          if (face.name || face.status === 'recognized') {
            persistentFacesRef.current.set(id, {
              name: face.name,
              status: face.status,
              confidence: face.confidence,
              createdAt: face.createdAt,
              attendanceMarked: face.attendanceMarked,
            });
            console.log(`[Persistent Save] ID: ${id}, Name: ${face.name}, Status: ${face.status}, Attendance: ${face.attendanceMarked}`);
          }
          newTrackedFaces.delete(id);
          activeRecognitionCalls.current.delete(id);
        }
      }

      setTrackedFaces(newTrackedFaces);
    }, [trackedFaces, isPaused, onFaceDetected]);

    // Handle face mesh results and extract bounding boxes
    const onFaceMeshResults = useCallback((results: Results) => {
      if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
        setFaceDetected(false);
        if (onFaceDetected) {
          onFaceDetected(false);
        }
        return;
      }

      // Convert landmarks to bounding boxes
      const detections = results.multiFaceLandmarks.map((landmarks) => {
        const xs = landmarks.map(l => l.x);
        const ys = landmarks.map(l => l.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        
        return {
          box: {
            xMin: minX,
            yMin: minY,
            width: maxX - minX,
            height: maxY - minY,
          }
        };
      });

      processDetections(detections);
    }, [onFaceDetected, processDetections]);

    // Initialize Face Mesh for detection
    useEffect(() => {
      const initializeFaceMesh = async () => {
        if (faceDetectionInitialized.current) return;
        
        try {
          const faceMesh = new FaceMesh({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
          });

          faceMesh.setOptions({
            maxNumFaces: 5,
            refineLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5,
          });

          faceMesh.onResults(onFaceMeshResults);
          faceMeshRef.current = faceMesh;
          faceDetectionInitialized.current = true;
          setFaceDetectionError('');
        } catch (err: any) {
          console.error('Error initializing face detection:', err);
          setFaceDetectionError('Face detection unavailable. Camera will work without face tracking.');
          faceDetectionInitialized.current = true;
        }
      };

      initializeFaceMesh();

      return () => {
        if (faceMeshRef.current) {
          try {
            faceMeshRef.current.close();
          } catch (err) {
            // Ignore disposal errors
          }
        }
      };
    }, [onFaceMeshResults]);

    const startCamera = async () => {
      try {
        // Safety check: LiveCamera should ONLY be used for local cameras
        // If cameraId suggests RTSP camera, reject it
        const rtspCameraIds = ['reception-area', 'workstation-exit'];
        if (rtspCameraIds.includes(cameraId)) {
          console.error(`LiveCamera component should not be used for RTSP camera: ${cameraId}`);
          setError(`This camera (${cameraId}) requires RTSP streaming and cannot use local camera access.`);
          setIsStreaming(false);
          return;
        }

        stopCamera();
        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        };

        const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = mediaStream;
        setIsStreaming(true);
        setIsPaused(false);
        setError('');

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
            processVideo();
          };
        }
      } catch (err) {
        console.error('Error accessing camera:', err);
        setError('Unable to access camera. Please check permissions.');
        setIsStreaming(false);
      }
    };

    const stopCamera = () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      const currentStream = streamRef.current;
      if (currentStream) {
        currentStream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      setIsStreaming(false);
      setFaceDetected(false);
      setTrackedFaces(new Map());
      activeRecognitionCalls.current.clear();

      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };

    const captureFrame = (): string | null => {
      if (!videoRef.current || !canvasRef.current || !isStreaming || isPaused) {
        return null;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (!context) return null;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      return canvas.toDataURL('image/jpeg', 0.9);
    };

    // Calculate distance between two points
    const calculateDistance = (x1: number, y1: number, x2: number, y2: number): number => {
      return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    };

    // Generate face ID based on position
    const generateFaceId = (centerX: number, centerY: number): string => {
      // Round to nearest grid cell to group nearby faces
      const gridSize = 50;
      const gridX = Math.round(centerX / gridSize);
      const gridY = Math.round(centerY / gridSize);
      return `face_${gridX}_${gridY}`;
    };

    // Match detected face to tracked face
    const matchFaceToTracked = (bbox: { x: number; y: number; width: number; height: number }, trackedMap: Map<string, TrackedFace>): string | null => {
      const centerX = bbox.x + bbox.width / 2;
      const centerY = bbox.y + bbox.height / 2;

      // Check if we have a tracked face nearby
      for (const [id, tracked] of trackedMap.entries()) {
        const distance = calculateDistance(centerX, centerY, tracked.centerX, tracked.centerY);
        const threshold = Math.max(bbox.width, bbox.height) * 0.6; // 60% of face size
        
        if (distance < threshold) {
          return id;
        }
      }

      return null;
    };


    // Draw bounding box with name and status
    const drawBoundingBox = (
      ctx: CanvasRenderingContext2D,
      face: TrackedFace,
      x: number,
      y: number,
      width: number,
      height: number
    ) => {
      const isRecognized = face.status === 'recognized';
      const isNotFound = face.status === 'not-found' || face.status === 'unauthorized';

      // Box color based on status
      let boxColor = '#3B82F6'; // Blue for detecting
      if (face.status === 'recognizing') boxColor = '#F59E0B'; // Amber for recognizing
      if (isRecognized) boxColor = '#10B981'; // Green for recognized
      if (isNotFound) boxColor = '#EF4444'; // Red for not found
      if (face.status === 'unauthorized') boxColor = '#DC2626'; // Dark red for unauthorized

      // Draw bounding box with animation for recognizing state
      ctx.strokeStyle = boxColor;
      ctx.lineWidth = 3;
      if (face.status === 'recognizing') {
        // Add dashed effect for recognizing state
        ctx.setLineDash([5, 5]);
      } else {
        ctx.setLineDash([]);
      }
      ctx.strokeRect(x, y, width, height);
      ctx.setLineDash([]);

      // Determine label text
      let labelText = '';
      if (face.status === 'detecting') {
        labelText = 'Detecting...';
      } else if (face.status === 'recognizing') {
        labelText = 'Recognizing...';
      } else if (face.status === 'recognized' && face.name) {
        labelText = face.name;
      } else if (face.status === 'unauthorized') {
        labelText = 'Unauthorized';
      } else if (face.status === 'not-found') {
        labelText = 'Not Found';
      } else {
        labelText = 'Unknown';
      }
      
      ctx.font = 'bold 16px Arial';
      const textMetrics = ctx.measureText(labelText);
      const labelWidth = textMetrics.width + 16;
      const labelHeight = 28;

      ctx.fillStyle = boxColor;
      ctx.globalAlpha = 0.9;
      ctx.fillRect(x, y - labelHeight, labelWidth, labelHeight);
      ctx.globalAlpha = 1.0;

      // Draw label text
      ctx.fillStyle = '#FFFFFF';
      ctx.textBaseline = 'middle';
      ctx.fillText(labelText, x + 8, y - labelHeight / 2);

      // Draw confidence if recognized
      if (isRecognized && face.confidence !== undefined) {
        const confidenceText = `${(face.confidence * 100).toFixed(1)}%`;
        ctx.font = '12px Arial';
        const confMetrics = ctx.measureText(confidenceText);
        const confWidth = confMetrics.width + 8;
        const confHeight = 20;

        ctx.fillStyle = boxColor;
        ctx.globalAlpha = 0.9;
        ctx.fillRect(x + width - confWidth, y + height, confWidth, confHeight);
        ctx.globalAlpha = 1.0;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(confidenceText, x + width - confWidth + 4, y + height + confHeight / 2);
      }
    };

    // Log transaction/attendance - only once per person per day
    const logTransaction = async (
      faceId: string,
      personName: string | undefined,
      status: 'recognized' | 'not-found',
      confidence: number | undefined,
      trackedFace?: TrackedFace
    ) => {
      try {
        // Check if attendance already marked today for this person
        if (trackedFace && status === 'recognized' && personName) {
          const today = new Date().toDateString();
          const attendanceMarkedToday = sessionStorage.getItem(`attendance_${personName}_${today}`);
          
          if (attendanceMarkedToday === 'true') {
            console.log(`[Attendance Skip] ${personName} already marked present today`);
            return null; // Skip logging
          }
        }
        
        const transactionId = `${faceId}_${Date.now()}`;
        const timestamp = new Date().toISOString();
        
        // Determine transaction status
        let transactionStatus = 'not-found';
        if (status === 'recognized' && personName) {
          transactionStatus = 'present'; // Marked as "present"
        }
        
        const transactionData = {
          transaction_id: transactionId,
          person_id: personName || 'unknown',
          user_name: personName || 'User Not Found',
          camera_id: 'main-camera',
          camera_name: 'Main Camera',
          timestamp: timestamp,
          status: transactionStatus,
          confidence: confidence || 0,
          matching_mode: '1:N',
          captured_photo_url: '',
          processing_time: Date.now() - (recognitionStartTimeRef.current || Date.now())
        };
        
        const response = await fetch('http://localhost:8000/api/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(transactionData),
        });
        
        const result = await response.json();
        console.log(`[Transaction Logged] ID: ${transactionId}, Name: ${personName}, Status: ${transactionStatus}`, result);
        
        // Mark attendance as completed for today
        if (status === 'recognized' && personName) {
          const today = new Date().toDateString();
          sessionStorage.setItem(`attendance_${personName}_${today}`, 'true');
          console.log(`[Attendance Marked] ${personName} marked present on ${today}`);
          
          // Also update tracked face
          if (trackedFace) {
            trackedFace.attendanceMarked = true;
            trackedFace.attendanceMarkedTime = Date.now();
          }
        }
        
        return result;
      } catch (err) {
        console.error('Error logging transaction:', err);
      }
    };
    
    const recognitionStartTimeRef = useRef<number>(0);
    
    const recognizeFace = async (
      faceId: string,
      bbox: { x: number; y: number; width: number; height: number }
    ) => {
      // Prevent duplicate calls for the same face
      if (activeRecognitionCalls.current.has(faceId)) {
        return;
      }

      if (!videoRef.current || !canvasRef.current) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Update status to recognizing
      const recognitionStartTime = Date.now();
      recognitionStartTimeRef.current = recognitionStartTime;
      setTrackedFaces(prev => {
        const newMap = new Map(prev);
        const trackedFace = newMap.get(faceId);
        if (trackedFace) {
          trackedFace.status = 'recognizing';
          trackedFace.lastRecognitionTime = recognitionStartTime;
          newMap.set(faceId, trackedFace);
        }
        return newMap;
      });

      activeRecognitionCalls.current.add(faceId);
      console.log(`[Recognition Start] Face ID: ${faceId}`);

      try {
        // Capture face region
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Crop face region with padding
        const padding = 20;
        const cropX = Math.max(0, bbox.x - padding);
        const cropY = Math.max(0, bbox.y - padding);
        const cropWidth = Math.min(canvas.width - cropX, bbox.width + padding * 2);
        const cropHeight = Math.min(canvas.height - cropY, bbox.height + padding * 2);

        const faceCanvas = document.createElement('canvas');
        faceCanvas.width = cropWidth;
        faceCanvas.height = cropHeight;
        const faceCtx = faceCanvas.getContext('2d');
        if (!faceCtx) return;

        faceCtx.drawImage(
          canvas,
          cropX, cropY, cropWidth, cropHeight,
          0, 0, cropWidth, cropHeight
        );

        const base64String = faceCanvas.toDataURL('image/jpeg', 0.9).split(',')[1];
        console.log(`[Sending to API] Face ID: ${faceId}, Size: ${base64String.length} bytes`);

        // Call recognition or verification API based on mode
        const endpoint = mode === 'verify' ? '/verify' : '/recognize';
        const result = await fetch(`http://localhost:8000${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: base64String }),
        }).then((res) => res.json());
        
        console.log(`[API Response] Face ID: ${faceId}, Result:`, result);

        // Update tracked face with result - IMMEDIATELY update status
        setTrackedFaces(prev => {
          const newMap = new Map(prev);
          const face = newMap.get(faceId);
          if (face) {
            if (result.person && result.person.name) {
              // Recognition successful - LOG ATTENDANCE
              face.name = result.person.name;
              face.status = 'recognized';
              face.confidence = result.confidence || 0.95;
              face.recognitionAttempts = 0;
              
              // Log to transactions (only once per day)
              logTransaction(faceId, result.person.name, 'recognized', face.confidence, face);
              
              if (onMatchResult) {
                onMatchResult({
                  matched: true,
                  identity: result.person.name,
                  person: result.person,
                  confidence: face.confidence,
                });
              }
            } else {
              // Recognition failed - determine why and LOG as NOT FOUND
              const errorMsg = result.error ? result.error.toLowerCase() : '';
              
              if (errorMsg.includes('unauthorized')) {
                face.status = 'unauthorized';
              } else if (errorMsg.includes('no face') || errorMsg.includes('no match') || result.code === 201) {
                face.status = 'not-found';
              } else {
                face.status = 'not-found';
              }
              
              face.recognitionAttempts++;
              
              // Log as not found
              logTransaction(faceId, undefined, 'not-found', 0, face);
              
              if (onMatchResult) {
                onMatchResult({ matched: false });
              }
            }
            newMap.set(faceId, face);
          }
          return newMap;
        });
      } catch (err) {
        console.error('Error recognizing face:', err);
        // Update status to indicate error
        setTrackedFaces(prev => {
          const newMap = new Map(prev);
          const face = newMap.get(faceId);
          if (face) {
            face.status = 'not-found';
            face.recognitionAttempts++;
          }
          return newMap;
        });
      } finally {
        activeRecognitionCalls.current.delete(faceId);
      }
    };

    // Process video frames
    const processVideo = useCallback(async () => {
      if (!videoRef.current || !isStreaming || isPaused) {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        return;
      }

      // If face mesh is not ready, just continue the loop (video will still work)
      if (!faceMeshRef.current || !faceDetectionInitialized.current) {
        if (isStreaming && !isPaused) {
          animationFrameRef.current = requestAnimationFrame(processVideo);
        }
        return;
      }

      const video = videoRef.current;
      if (video.readyState === video.HAVE_ENOUGH_DATA && faceMeshRef.current) {
        try {
          await faceMeshRef.current.send({ image: video });
        } catch (err: any) {
          // Silently handle errors - don't break the video loop
          console.error('Face detection error:', err);
        }
      }

      if (isStreaming && !isPaused) {
        animationFrameRef.current = requestAnimationFrame(processVideo);
      }
    }, [isStreaming, isPaused]);

    useEffect(() => {
      if (isStreaming && !isPaused) {
        processVideo();
      }
      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };
    }, [isStreaming, isPaused, processVideo]);

    useImperativeHandle(ref, () => ({
      startCamera,
      stopCamera,
      captureFrame,
    }));

    useEffect(() => {
      if (autoStart) {
        startCamera();
      }
      return () => {
        stopCamera();
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoStart]);

    const togglePause = () => {
      if (isPaused) {
        setIsPaused(false);
        processVideo();
      } else {
        setIsPaused(true);
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      }
    };

    return (
      <div className={`relative w-full ${compact ? '' : 'rounded-lg border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark'} overflow-hidden`}>
        {/* Video Container */}
        <div className="relative bg-black aspect-video">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          
          {/* Overlay Canvas for bounding boxes */}
          <canvas
            ref={overlayCanvasRef}
            className="absolute top-0 left-0 w-full h-full pointer-events-none"
            style={{ imageRendering: 'pixelated' }}
          />
          
          {/* Overlay Status - Only show in compact mode if there's an important status */}
          {!compact && (
            <div className="absolute top-4 left-4 flex flex-col gap-2">
              {isStreaming && !isPaused && (
                <>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-sm">
                    <div className={`w-2 h-2 rounded-full ${faceDetected ? 'bg-meta-3 animate-pulse' : 'bg-bodydark'}`}></div>
                    <span className="text-xs text-white font-medium">
                      {faceDetected ? `${trackedFaces.size} Face(s) Detected` : 'Looking for face...'}
                    </span>
                  </div>
                  {faceDetectionError && (
                    <div className="px-3 py-1.5 rounded-full bg-yellow-500/80 backdrop-blur-sm">
                      <span className="text-xs text-white font-medium">{faceDetectionError}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Compact mode status indicator */}
          {compact && isStreaming && !isPaused && faceDetected && (
            <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-full bg-black/50 backdrop-blur-sm">
              <div className="w-1.5 h-1.5 rounded-full bg-meta-3 animate-pulse"></div>
              <span className="text-xs text-white font-medium">{trackedFaces.size}</span>
            </div>
          )}

          {/* Controls - Hide in compact mode */}
          {!compact && (
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
              <button
                onClick={togglePause}
                disabled={!isStreaming}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                  isPaused
                    ? 'bg-meta-3 text-white'
                    : 'bg-black/50 backdrop-blur-sm text-white'
                } transition hover:opacity-90 disabled:opacity-50`}
              >
                {isPaused ? (
                  <>
                    <Play className="h-4 w-4" />
                    <span>Resume</span>
                  </>
                ) : (
                  <>
                    <Pause className="h-4 w-4" />
                    <span>Pause</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80">
              <div className="text-center text-white p-4">
                <p className="text-red-400 mb-2">{error}</p>
                <button
                  onClick={startCamera}
                  className="px-4 py-2 bg-primary rounded-lg hover:bg-opacity-90"
                >
                  Retry
                </button>
              </div>
            </div>
          )}

          {/* No Camera State - Compact mode */}
          {compact && !isStreaming && !error && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900/90">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (onStartRequest) {
                    onStartRequest();
                  }
                  startCamera();
                }}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-opacity-90 transition text-sm font-medium"
              >
                Start Camera
              </button>
            </div>
          )}

          {/* No Camera State - Full UI mode */}
          {!compact && !isStreaming && !error && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
              <div className="text-center text-white">
                <p className="mb-4">Camera is off</p>
                <button
                  onClick={() => {
                    if (onStartRequest) {
                      onStartRequest();
                    }
                    startCamera();
                  }}
                  className="px-6 py-3 bg-primary rounded-lg hover:bg-opacity-90 transition"
                >
                  Start Camera
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Hidden Canvas for frame capture */}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    );
  }
);

LiveCamera.displayName = 'LiveCamera';

export default LiveCamera;
