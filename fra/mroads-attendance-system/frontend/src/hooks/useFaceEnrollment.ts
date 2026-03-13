/**
 * Face Enrollment Hook
 * Manages face enrollment state, auto-capture logic, and MediaPipe integration
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { FaceMesh, Results } from '@mediapipe/face_mesh';
import {
  FaceAngles,
  EnrollmentStep,
  ENROLLMENT_STEPS,
  calculateFaceAngles2D,
  getAngleMatchPercentage,
} from '../utils/faceAngleUtils';

export interface CapturedImage {
  dataUrl: string;
  file: File;
  step: number;
  timestamp: number;
}

export interface FaceEnrollmentState {
  currentStep: number;
  capturedImages: CapturedImage[];
  isFaceDetected: boolean;
  isAutoMode: boolean;
  isCompleted: boolean;
  isProcessing: boolean;
  instructionText: string;
  faceAngles: FaceAngles;
  angleMatchPercentage: number;
  currentStepInfo: EnrollmentStep;
  error: string | null;
}

export interface FaceEnrollmentActions {
  startCamera: () => void;
  stopCamera: () => void;
  captureManual: () => void;
  toggleAutoMode: () => void;
  reset: () => void;
  getFiles: () => File[];
}

const DEBOUNCE_DELAY = 600; // ms between auto captures
const ANGLE_MATCH_THRESHOLD = 80; // percentage required for auto capture
const FACE_STABLE_FRAMES = 8; // frames face must be stable before capture

export function useFaceEnrollment(
  videoRef: React.RefObject<HTMLVideoElement>,
  canvasRef: React.RefObject<HTMLCanvasElement>
): [FaceEnrollmentState, FaceEnrollmentActions] {
  // State
  const [currentStep, setCurrentStep] = useState(0);
  const [capturedImages, setCapturedImages] = useState<CapturedImage[]>([]);
  const [isFaceDetected, setIsFaceDetected] = useState(false);
  const [isAutoMode, setIsAutoMode] = useState(true);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [instructionText, setInstructionText] = useState(ENROLLMENT_STEPS[0].instruction);
  const [faceAngles, setFaceAngles] = useState<FaceAngles>({ yaw: 0, pitch: 0, roll: 0 });
  const [angleMatchPercentage, setAngleMatchPercentage] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const faceMeshRef = useRef<FaceMesh | null>(null);
  const lastCaptureTimeRef = useRef<number>(0);
  const stableFrameCountRef = useRef<number>(0);
  const isCapturingRef = useRef<boolean>(false);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Get current step info
  const currentStepInfo = ENROLLMENT_STEPS[currentStep] || ENROLLMENT_STEPS[0];

  // Capture image from video
  const captureImage = useCallback((): CapturedImage | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Set canvas dimensions
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame
    ctx.drawImage(video, 0, 0);

    // Get data URL
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);

    // Convert to File
    const byteString = atob(dataUrl.split(',')[1]);
    const mimeType = 'image/jpeg';
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([ab], { type: mimeType });
    const file = new File([blob], `face-capture-${Date.now()}-step${currentStep}.jpg`, {
      type: mimeType,
    });

    return {
      dataUrl,
      file,
      step: currentStep,
      timestamp: Date.now(),
    };
  }, [videoRef, canvasRef, currentStep]);

  // Process capture (used by both auto and manual)
  const processCapture = useCallback(() => {
    if (isCapturingRef.current || isCompleted) return;
    if (capturedImages.length >= 5) return;

    isCapturingRef.current = true;
    setIsProcessing(true);

    const image = captureImage();
    if (image) {
      setCapturedImages((prev) => {
        const newImages = [...prev, image];
        
        // Check if completed
        if (newImages.length >= 5) {
          setIsCompleted(true);
          setInstructionText('Face enrollment completed!');
        } else {
          // Move to next step
          const nextStep = currentStep + 1;
          if (nextStep < ENROLLMENT_STEPS.length) {
            setCurrentStep(nextStep);
            setInstructionText(ENROLLMENT_STEPS[nextStep].instruction);
          }
        }
        
        return newImages;
      });

      lastCaptureTimeRef.current = Date.now();
    }

    setTimeout(() => {
      isCapturingRef.current = false;
      setIsProcessing(false);
    }, 300);
  }, [captureImage, currentStep, isCompleted, capturedImages.length]);

  // Handle face mesh results
  const onFaceMeshResults = useCallback(
    (results: Results) => {
      if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
        setIsFaceDetected(false);
        stableFrameCountRef.current = 0;
        return;
      }

      setIsFaceDetected(true);
      const landmarks = results.multiFaceLandmarks[0];

      // Calculate face angles
      const angles = calculateFaceAngles2D(landmarks);
      setFaceAngles(angles);

      // Calculate match percentage for current step
      const matchPercentage = getAngleMatchPercentage(angles, currentStepInfo);
      setAngleMatchPercentage(matchPercentage);

      // Auto capture logic
      if (isAutoMode && !isCompleted && capturedImages.length < 5) {
        const now = Date.now();
        const timeSinceLastCapture = now - lastCaptureTimeRef.current;

        if (matchPercentage >= ANGLE_MATCH_THRESHOLD && timeSinceLastCapture > DEBOUNCE_DELAY) {
          stableFrameCountRef.current++;

          if (stableFrameCountRef.current >= FACE_STABLE_FRAMES) {
            processCapture();
            stableFrameCountRef.current = 0;
          }
        } else {
          stableFrameCountRef.current = Math.max(0, stableFrameCountRef.current - 1);
        }
      }
    },
    [isAutoMode, isCompleted, capturedImages.length, currentStepInfo, processCapture]
  );

  // Initialize FaceMesh
  const initializeFaceMesh = useCallback(async () => {
    if (faceMeshRef.current) return;

    console.log('Initializing FaceMesh...');
    
    const faceMesh = new FaceMesh({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
      },
    });

    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    faceMesh.onResults(onFaceMeshResults);
    
    // Initialize the model
    try {
      await faceMesh.initialize();
      console.log('FaceMesh initialized successfully');
    } catch (e) {
      console.log('FaceMesh initialize not available, continuing...');
    }
    
    faceMeshRef.current = faceMesh;
  }, [onFaceMeshResults]);

  // Start camera
  const startCamera = useCallback(async () => {
    const video = videoRef.current;
    if (!video) {
      console.error('Video element not found');
      return;
    }

    try {
      setError(null);
      console.log('Starting camera...');

      // Get camera stream first
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      video.srcObject = stream;
      
      // Wait for video to be ready
      await new Promise<void>((resolve) => {
        video.onloadedmetadata = () => {
          video.play().then(() => {
            console.log('Video playing');
            resolve();
          });
        };
      });

      // Initialize FaceMesh after video is ready
      await initializeFaceMesh();

      // Start processing frames
      const processFrame = async () => {
        if (!faceMeshRef.current || !streamRef.current) return;
        
        if (video.readyState === 4) {
          try {
            await faceMeshRef.current.send({ image: video });
          } catch (e) {
            // Ignore send errors
          }
        }
        
        if (streamRef.current) {
          animationFrameRef.current = requestAnimationFrame(processFrame);
        }
      };

      // Small delay to ensure FaceMesh is initialized
      setTimeout(() => {
        if (faceMeshRef.current && streamRef.current) {
          animationFrameRef.current = requestAnimationFrame(processFrame);
        }
      }, 500);

      console.log('Camera started successfully');
    } catch (err) {
      console.error('Error starting camera:', err);
      setError('Unable to access camera. Please check permissions.');
    }
  }, [videoRef, initializeFaceMesh]);

  // Stop camera
  const stopCamera = useCallback(() => {
    // Cancel animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [videoRef]);

  // Manual capture
  const captureManual = useCallback(() => {
    if (!isFaceDetected) {
      setError('No face detected. Please position your face in the frame.');
      setTimeout(() => setError(null), 3000);
      return;
    }
    processCapture();
  }, [isFaceDetected, processCapture]);

  // Toggle auto mode
  const toggleAutoMode = useCallback(() => {
    setIsAutoMode((prev) => !prev);
  }, []);

  // Reset
  const reset = useCallback(() => {
    setCapturedImages([]);
    setCurrentStep(0);
    setIsCompleted(false);
    setInstructionText(ENROLLMENT_STEPS[0].instruction);
    stableFrameCountRef.current = 0;
    lastCaptureTimeRef.current = 0;
  }, []);

  // Get files for upload
  const getFiles = useCallback((): File[] => {
    return capturedImages.map((img) => img.file);
  }, [capturedImages]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
      if (faceMeshRef.current) {
        faceMeshRef.current.close();
        faceMeshRef.current = null;
      }
    };
  }, [stopCamera]);

  // Update instruction text when step changes
  useEffect(() => {
    if (!isCompleted && currentStep < ENROLLMENT_STEPS.length) {
      setInstructionText(ENROLLMENT_STEPS[currentStep].instruction);
    }
  }, [currentStep, isCompleted]);

  const state: FaceEnrollmentState = {
    currentStep,
    capturedImages,
    isFaceDetected,
    isAutoMode,
    isCompleted,
    isProcessing,
    instructionText,
    faceAngles,
    angleMatchPercentage,
    currentStepInfo,
    error,
  };

  const actions: FaceEnrollmentActions = {
    startCamera,
    stopCamera,
    captureManual,
    toggleAutoMode,
    reset,
    getFiles,
  };

  return [state, actions];
}

