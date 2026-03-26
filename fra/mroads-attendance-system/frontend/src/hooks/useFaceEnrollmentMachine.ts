/**
 * Face Enrollment State Machine
 * Finite state machine for enrollment flow
 * Separates detection, capture, and UI concerns
 */

import { useRef, useCallback, useEffect, useState } from 'react';
import { FaceMesh, Results } from '@mediapipe/face_mesh';
import { calculateFaceAngles, getAngleMatchPercentage, FaceAngles } from '../utils/faceAngleDetector';

export type EnrollmentState = 
  | 'idle'
  | 'starting'
  | 'detecting'
  | 'capturing'
  | 'completed'
  | 'error';

export interface EnrollmentStep {
  id: number;
  name: string;
  instruction: string;
  targetAngles: { yaw: number; pitch: number };
}

export const ENROLLMENT_STEPS: EnrollmentStep[] = [
  { id: 0, name: 'front', instruction: 'Look straight ahead', targetAngles: { yaw: 0, pitch: 0 } },
  { id: 1, name: 'left', instruction: 'Turn your head left', targetAngles: { yaw: -20, pitch: 0 } },
  { id: 2, name: 'right', instruction: 'Turn your head right', targetAngles: { yaw: 20, pitch: 0 } },
  { id: 3, name: 'up', instruction: 'Look up slightly', targetAngles: { yaw: 0, pitch: -15 } },
  { id: 4, name: 'down', instruction: 'Look down slightly', targetAngles: { yaw: 0, pitch: 15 } },
];

export interface CapturedImage {
  dataUrl: string;
  file: File;
  step: number;
  timestamp: number;
}

export interface EnrollmentMachineState {
  state: EnrollmentState;
  currentStep: number;
  capturedImages: CapturedImage[];
  isFaceDetected: boolean;
  faceAngles: FaceAngles;
  angleMatchPercentage: number;
  error: string | null;
}

export interface EnrollmentMachineActions {
  start: () => Promise<void>;
  stop: () => void;
  captureManual: () => void;
  reset: () => void;
  getFiles: () => File[];
}

const DETECTION_FPS = 12; // 12 FPS = ~83ms interval
const DETECTION_INTERVAL = 1000 / DETECTION_FPS;
const CAPTURE_DEBOUNCE = 700; // ms
const ANGLE_MATCH_THRESHOLD = 80; // percentage
const STABLE_FRAMES_REQUIRED = 6; // frames

export function useFaceEnrollmentMachine(
  videoRef: React.RefObject<HTMLVideoElement>,
  canvasRef: React.RefObject<HTMLCanvasElement>
): [EnrollmentMachineState, EnrollmentMachineActions] {
  // React state for UI updates (triggers re-renders)
  const [state, setState] = useState<EnrollmentMachineState>({
    state: 'idle',
    currentStep: 0,
    capturedImages: [],
    isFaceDetected: false,
    faceAngles: { yaw: 0, pitch: 0, roll: 0 },
    angleMatchPercentage: 0,
    error: null,
  });

  // Refs for non-UI state (detection loop doesn't trigger re-renders)
  const stateRef = useRef<EnrollmentState>('idle');
  const currentStepRef = useRef<number>(0);
  const capturedImagesRef = useRef<CapturedImage[]>([]);
  const isFaceDetectedRef = useRef<boolean>(false);
  const faceAnglesRef = useRef<FaceAngles>({ yaw: 0, pitch: 0, roll: 0 });
  const angleMatchPercentageRef = useRef<number>(0);
  const errorRef = useRef<string | null>(null);

  // Detection refs
  const faceMeshRef = useRef<FaceMesh | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectionIntervalRef = useRef<number | null>(null);
  const lastCaptureTimeRef = useRef<number>(0);
  const stableFrameCountRef = useRef<number>(0);
  const isCapturingRef = useRef<boolean>(false);
  const isAutoModeRef = useRef<boolean>(true);

  // Update React state (triggers re-render)
  const updateState = useCallback(() => {
    setState({
      state: stateRef.current,
      currentStep: currentStepRef.current,
      capturedImages: [...capturedImagesRef.current],
      isFaceDetected: isFaceDetectedRef.current,
      faceAngles: { ...faceAnglesRef.current },
      angleMatchPercentage: angleMatchPercentageRef.current,
      error: errorRef.current,
    });
  }, []);

  // Capture image (async, non-blocking)
  const captureImage = useCallback(async (): Promise<CapturedImage | null> => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== 4) return null;

    return new Promise((resolve) => {
      // Use requestIdleCallback or setTimeout to avoid blocking
      const capture = () => {
        try {
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(null);
            return;
          }

          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.save();
          ctx.scale(-1, 1);
          ctx.drawImage(video, -canvas.width, 0);
          ctx.restore();

          const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
          
          // Convert to File (async)
          const byteString = atob(dataUrl.split(',')[1]);
          const ab = new ArrayBuffer(byteString.length);
          const ia = new Uint8Array(ab);
          for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
          }
          const blob = new Blob([ab], { type: 'image/jpeg' });
          const file = new File([blob], `face-${Date.now()}-step${currentStepRef.current}.jpg`, {
            type: 'image/jpeg',
          });

          resolve({
            dataUrl,
            file,
            step: currentStepRef.current,
            timestamp: Date.now(),
          });
        } catch (err) {
          console.error('Capture error:', err);
          resolve(null);
        }
      };

      // Use setTimeout to yield to UI thread
      if ('requestIdleCallback' in window) {
        requestIdleCallback(capture, { timeout: 100 });
      } else {
        setTimeout(capture, 0);
      }
    });
  }, [videoRef, canvasRef]);

  // Process capture
  const processCapture = useCallback(async () => {
    if (isCapturingRef.current || stateRef.current === 'completed') return;
    if (capturedImagesRef.current.length >= 5) return;

    isCapturingRef.current = true;
    stateRef.current = 'capturing';
    updateState();

    const image = await captureImage();
    
    if (image) {
      capturedImagesRef.current.push(image);
      lastCaptureTimeRef.current = Date.now();
      stableFrameCountRef.current = 0;

      if (capturedImagesRef.current.length >= 5) {
        stateRef.current = 'completed';
      } else {
        currentStepRef.current++;
        stateRef.current = 'detecting';
      }
    }

    // Release capture lock after delay
    setTimeout(() => {
      isCapturingRef.current = false;
      if (stateRef.current === 'capturing') {
        stateRef.current = 'detecting';
      }
      updateState();
    }, 300);
  }, [captureImage, updateState]);

  // Face detection handler
  const onFaceMeshResults = useCallback((results: Results) => {
    if (stateRef.current !== 'detecting' && stateRef.current !== 'capturing') return;

    if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
      isFaceDetectedRef.current = false;
      stableFrameCountRef.current = 0;
      updateState();
      return;
    }

    isFaceDetectedRef.current = true;
    const landmarks = results.multiFaceLandmarks[0];
    const angles = calculateFaceAngles(landmarks);
    faceAnglesRef.current = angles;

    const matchPercentage = getAngleMatchPercentage(angles, currentStepRef.current);
    angleMatchPercentageRef.current = matchPercentage;

    // Auto capture logic
    if (
      isAutoModeRef.current &&
      stateRef.current === 'detecting' &&
      !isCapturingRef.current &&
      capturedImagesRef.current.length < 5
    ) {
      const now = Date.now();
      const timeSinceLastCapture = now - lastCaptureTimeRef.current;

      if (matchPercentage >= ANGLE_MATCH_THRESHOLD && timeSinceLastCapture > CAPTURE_DEBOUNCE) {
        stableFrameCountRef.current++;
        if (stableFrameCountRef.current >= STABLE_FRAMES_REQUIRED) {
          processCapture();
        }
      } else {
        stableFrameCountRef.current = Math.max(0, stableFrameCountRef.current - 1);
      }
    }

    updateState();
  }, [processCapture, updateState]);

  // Initialize FaceMesh
  const initializeFaceMesh = useCallback(async () => {
    if (faceMeshRef.current) return;

    const faceMesh = new FaceMesh({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
    });

    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    faceMesh.onResults(onFaceMeshResults);
    
    try {
      await faceMesh.initialize();
    } catch (e) {
      console.log('FaceMesh initialize not available');
    }
    
    faceMeshRef.current = faceMesh;
  }, [onFaceMeshResults]);

  // Start detection loop (throttled with setInterval)
  const startDetectionLoop = useCallback(() => {
    if (detectionIntervalRef.current) return;

    detectionIntervalRef.current = window.setInterval(() => {
      const video = videoRef.current;
      const faceMesh = faceMeshRef.current;
      
      if (!video || !faceMesh || stateRef.current === 'idle' || stateRef.current === 'error') {
        return;
      }

      if (video.readyState === 4) {
        faceMesh.send({ image: video }).catch(() => {
          // Ignore send errors
        });
      }
    }, DETECTION_INTERVAL);
  }, [videoRef]);

  // Stop detection loop
  const stopDetectionLoop = useCallback(() => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
  }, []);

  // Start enrollment
  const start = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      stateRef.current = 'starting';
      updateState();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });

      streamRef.current = stream;
      video.srcObject = stream;
      
      console.log('Stream attached to video element, stream active:', stream.active);

      // Wait for video to be ready - more robust handling
      await new Promise<void>((resolve) => {
        let resolved = false;
        const timeout = setTimeout(() => {
          if (!resolved) {
            console.warn('Video load timeout, but continuing anyway');
            resolved = true;
            resolve();
          }
        }, 5000);

        const tryPlay = async () => {
          if (resolved) return;
          try {
            await video.play();
            console.log('Video playing successfully, readyState:', video.readyState);
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              resolve();
            }
          } catch (err) {
            console.warn('Video play error (non-fatal):', err);
            // Don't fail, video might still work
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              resolve();
            }
          }
        };

        const onLoadedMetadata = () => {
          console.log('Video metadata loaded, readyState:', video.readyState);
          video.removeEventListener('loadedmetadata', onLoadedMetadata);
          video.removeEventListener('canplay', onCanPlay);
          tryPlay();
        };

        const onCanPlay = () => {
          console.log('Video can play, readyState:', video.readyState);
          video.removeEventListener('loadedmetadata', onLoadedMetadata);
          video.removeEventListener('canplay', onCanPlay);
          tryPlay();
        };

        video.addEventListener('loadedmetadata', onLoadedMetadata);
        video.addEventListener('canplay', onCanPlay);
        
        // Also check if already loaded
        if (video.readyState >= 2) {
          console.log('Video already ready, readyState:', video.readyState);
          video.removeEventListener('loadedmetadata', onLoadedMetadata);
          video.removeEventListener('canplay', onCanPlay);
          tryPlay();
        }
      });

      await initializeFaceMesh();

      stateRef.current = 'detecting';
      startDetectionLoop();
      updateState();
    } catch (err) {
      console.error('Error starting camera:', err);
      errorRef.current = 'Unable to access camera. Please check permissions.';
      stateRef.current = 'error';
      updateState();
    }
  }, [videoRef, initializeFaceMesh, startDetectionLoop, updateState]);

  // Stop enrollment
  const stop = useCallback(() => {
    stopDetectionLoop();
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    stateRef.current = 'idle';
    updateState();
  }, [stopDetectionLoop, videoRef, updateState]);

  // Manual capture
  const captureManual = useCallback(() => {
    if (!isFaceDetectedRef.current) {
      errorRef.current = 'No face detected. Please position your face in the frame.';
      updateState();
      setTimeout(() => {
        errorRef.current = null;
        updateState();
      }, 3000);
      return;
    }
    processCapture();
  }, [processCapture, updateState]);

  // Reset
  const reset = useCallback(() => {
    capturedImagesRef.current = [];
    currentStepRef.current = 0;
    stateRef.current = 'detecting';
    stableFrameCountRef.current = 0;
    lastCaptureTimeRef.current = 0;
    errorRef.current = null;
    updateState();
  }, [updateState]);

  // Get files
  const getFiles = useCallback((): File[] => {
    return capturedImagesRef.current.map((img) => img.file);
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      stop();
      if (faceMeshRef.current) {
        faceMeshRef.current.close();
        faceMeshRef.current = null;
      }
    };
  }, [stop]);

  return [state, { start, stop, captureManual, reset, getFiles }];
}

