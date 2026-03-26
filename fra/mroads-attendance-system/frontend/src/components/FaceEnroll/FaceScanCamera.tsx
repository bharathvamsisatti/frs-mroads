/**
 * Face Scan Camera Component
 * Simplified version for single image capture (Verify/Recognize)
 * Uses face detection but captures single image when face is properly positioned
 */

import { useRef, useState, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react';
import { FaceMesh, Results } from '@mediapipe/face_mesh';
import { calculateFaceAngles2D } from '../../utils/faceAngleUtils';

interface FaceScanCameraProps {
  onCapture?: (file: File) => void;
  onClose?: () => void;
  className?: string;
  title?: string;
}

export interface FaceScanCameraRef {
  startCamera: () => void;
  stopCamera: () => void;
  reset: () => void;
}

const FaceScanCamera = forwardRef<FaceScanCameraRef, FaceScanCameraProps>(
  ({ onCapture, onClose, className = '', title = 'Face Scan' }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const faceMeshRef = useRef<FaceMesh | null>(null);
    const animationFrameRef = useRef<number | null>(null);

    const [isCameraStarted, setIsCameraStarted] = useState(false);
    const [isVideoReady, setIsVideoReady] = useState(false);
    const [isFaceDetected, setIsFaceDetected] = useState(false);
    const [isFaceAligned, setIsFaceAligned] = useState(false);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [instructionText, setInstructionText] = useState('Position your face in the frame');
    const [scanAngle, setScanAngle] = useState(0);
    const [cameraError, setCameraError] = useState<string | null>(null);

    // Expose methods to parent
    useImperativeHandle(ref, () => ({
      startCamera: handleStartCamera,
      stopCamera: handleStopCamera,
      reset: handleReset,
    }));

    // FaceMesh results handler
    const onFaceMeshResults = useCallback((results: Results) => {
      if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
        setIsFaceDetected(false);
        setIsFaceAligned(false);
        setInstructionText('Position your face in the frame');
        return;
      }

      setIsFaceDetected(true);
      const landmarks = results.multiFaceLandmarks[0];
      const angles = calculateFaceAngles2D(landmarks);

      // Check if face is aligned (looking straight)
      const isAligned = Math.abs(angles.yaw) < 15 && Math.abs(angles.pitch) < 12;
      setIsFaceAligned(isAligned);

      if (isAligned) {
        setInstructionText('Perfect! Click capture or hold still');
      } else if (Math.abs(angles.yaw) >= 15) {
        setInstructionText(angles.yaw > 0 ? 'Turn left slightly' : 'Turn right slightly');
      } else {
        setInstructionText(angles.pitch > 0 ? 'Look up slightly' : 'Look down slightly');
      }
    }, []);

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
      faceMeshRef.current = faceMesh;
    }, [onFaceMeshResults]);

    // Actually start the camera stream
    const startCameraStream = useCallback(async () => {
      const video = videoRef.current;
      if (!video) {
        console.log('Video element not available yet');
        return;
      }

      try {
        setCapturedImage(null);
        setCameraError(null);
        console.log('Starting camera stream...');

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });

        streamRef.current = stream;
        video.srcObject = stream;

        await new Promise<void>((resolve) => {
          video.onloadedmetadata = () => {
            video.play().then(() => {
              console.log('Video playing');
              resolve();
            });
          };
        });

        setIsVideoReady(true);
        await initializeFaceMesh();

        // Process frames
        const processFrame = async () => {
          if (!faceMeshRef.current || !streamRef.current || !video) return;
          if (video.readyState === 4) {
            try {
              await faceMeshRef.current.send({ image: video });
            } catch (e) {}
          }
          if (streamRef.current) {
            animationFrameRef.current = requestAnimationFrame(processFrame);
          }
        };

        setTimeout(() => {
          if (faceMeshRef.current && streamRef.current) {
            animationFrameRef.current = requestAnimationFrame(processFrame);
          }
        }, 500);
        console.log('Camera started successfully');
      } catch (err: any) {
        console.error('Error starting camera:', err);
        let errorMessage = 'Unable to access camera. Please check permissions.';
        
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          errorMessage = 'Camera access denied. Please allow camera permissions in your browser settings.';
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          errorMessage = 'No camera found. Please connect a camera and try again.';
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          errorMessage = 'Camera is already in use by another application.';
        } else if (err.name === 'OverconstrainedError') {
          errorMessage = 'Camera does not meet requirements. Try a different camera.';
        } else if (err.name === 'SecurityError') {
          errorMessage = 'Camera access blocked by security settings. Please use HTTPS or localhost.';
        }
        
        setCameraError(errorMessage);
        setIsCameraStarted(false);
        setIsVideoReady(false);
      }
    }, [initializeFaceMesh]);

    // Effect to start camera when isCameraStarted becomes true
    useEffect(() => {
      if (isCameraStarted && videoRef.current && !isVideoReady && !capturedImage) {
        console.log('Effect triggered: starting camera stream');
        startCameraStream();
      }
    }, [isCameraStarted, isVideoReady, capturedImage, startCameraStream]);

    // Simple handler to trigger camera start
    const handleStartCamera = () => {
      console.log('Start camera clicked');
      setIsCameraStarted(true);
    };

    // Stop camera
    const handleStopCamera = () => {
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
      setIsCameraStarted(false);
      setIsVideoReady(false);
    };

    // Reset
    const handleReset = () => {
      setCapturedImage(null);
      setIsFaceDetected(false);
      setIsFaceAligned(false);
      setCameraError(null);
    };

    // Capture image
    const captureImage = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.save();
      ctx.scale(-1, 1);
      ctx.drawImage(video, -canvas.width, 0);
      ctx.restore();

      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      setCapturedImage(dataUrl);

      // Convert to File
      const byteString = atob(dataUrl.split(',')[1]);
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([ab], { type: 'image/jpeg' });
      const file = new File([blob], `face-scan-${Date.now()}.jpg`, { type: 'image/jpeg' });

      handleStopCamera();
      onCapture?.(file);
    };

    // Animation for scan effect
    useEffect(() => {
      if (!isCameraStarted || capturedImage) return;

      const animate = () => {
        setScanAngle((prev) => (prev + 2) % 360);
        animationFrameRef.current = requestAnimationFrame(animate);
      };
      animate();

      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };
    }, [isCameraStarted, capturedImage]);

    // Draw overlay
    useEffect(() => {
      const canvas = overlayCanvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(width, height) * 0.35;

      ctx.clearRect(0, 0, width, height);

      // Color based on state
      const color = isFaceAligned ? '#22c55e' : isFaceDetected ? '#3b82f6' : '#6b7280';

      // Main ring
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.stroke();

      // Scanning line
      if (isFaceDetected && !isFaceAligned) {
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate((scanAngle * Math.PI) / 180);
        const scanGradient = ctx.createLinearGradient(0, -radius, 0, radius * 0.3);
        scanGradient.addColorStop(0, 'transparent');
        scanGradient.addColorStop(0.5, 'rgba(59, 130, 246, 0.3)');
        scanGradient.addColorStop(1, 'transparent');
        ctx.strokeStyle = scanGradient;
        ctx.lineWidth = 30;
        ctx.beginPath();
        ctx.moveTo(0, -radius + 10);
        ctx.lineTo(0, radius * 0.3);
        ctx.stroke();
        ctx.restore();
      }

      // Corner brackets
      const bracketLength = radius * 0.2;
      const bracketOffset = radius * 0.75;
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';

      // Top-left
      ctx.beginPath();
      ctx.moveTo(centerX - bracketOffset, centerY - bracketOffset + bracketLength);
      ctx.lineTo(centerX - bracketOffset, centerY - bracketOffset);
      ctx.lineTo(centerX - bracketOffset + bracketLength, centerY - bracketOffset);
      ctx.stroke();

      // Top-right
      ctx.beginPath();
      ctx.moveTo(centerX + bracketOffset - bracketLength, centerY - bracketOffset);
      ctx.lineTo(centerX + bracketOffset, centerY - bracketOffset);
      ctx.lineTo(centerX + bracketOffset, centerY - bracketOffset + bracketLength);
      ctx.stroke();

      // Bottom-left
      ctx.beginPath();
      ctx.moveTo(centerX - bracketOffset, centerY + bracketOffset - bracketLength);
      ctx.lineTo(centerX - bracketOffset, centerY + bracketOffset);
      ctx.lineTo(centerX - bracketOffset + bracketLength, centerY + bracketOffset);
      ctx.stroke();

      // Bottom-right
      ctx.beginPath();
      ctx.moveTo(centerX + bracketOffset - bracketLength, centerY + bracketOffset);
      ctx.lineTo(centerX + bracketOffset, centerY + bracketOffset);
      ctx.lineTo(centerX + bracketOffset, centerY + bracketOffset - bracketLength);
      ctx.stroke();

    }, [scanAngle, isFaceDetected, isFaceAligned]);

    // Cleanup
    useEffect(() => {
      return () => handleStopCamera();
    }, []);

    const handleClose = () => {
      handleStopCamera();
      onClose?.();
    };

    return (
      <div className={`relative ${className}`}>
        <div className="rounded-xl overflow-hidden bg-gray-900 shadow-2xl">
          {/* Header */}
          <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-4 bg-gradient-to-b from-black/50 to-transparent">
            <h3 className="text-white font-semibold text-lg">{title}</h3>
            <button
              onClick={handleClose}
              className="p-2 rounded-full bg-black/30 hover:bg-black/50 transition-colors"
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Camera Feed */}
          <div className="relative aspect-[4/3] bg-black">
            {cameraError ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 p-6">
                <div className="max-w-md text-center">
                  <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <h3 className="text-white text-lg font-semibold mb-2">Camera Access Error</h3>
                  <p className="text-red-400 text-sm mb-6">{cameraError}</p>
                  <div className="space-y-3">
                    <button
                      onClick={() => {
                        setCameraError(null);
                        handleStartCamera();
                      }}
                      className="w-full px-6 py-3 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-medium transition-colors"
                    >
                      Try Again
                    </button>
                    <button
                      onClick={handleClose}
                      className="w-full px-6 py-3 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            ) : !isCameraStarted ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900">
                <button
                  onClick={handleStartCamera}
                  className="flex flex-col items-center gap-4 p-8 rounded-2xl bg-gray-800/50 hover:bg-gray-800/70 transition-all hover:scale-105"
                >
                  <div className="w-24 h-24 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <svg className="w-12 h-12 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="text-center">
                    <p className="text-white text-lg font-medium">Start Face Scan</p>
                    <p className="text-gray-400 text-sm mt-1">Position your face in the center</p>
                  </div>
                </button>
              </div>
            ) : capturedImage ? (
              <div className="relative">
                <img src={capturedImage} alt="Captured" className="w-full h-full object-cover" />
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <div className="text-center">
                    <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center mx-auto mb-4">
                      <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="text-white text-lg font-medium">Image Captured!</p>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover transform scale-x-[-1]"
                  autoPlay
                  playsInline
                  muted
                  style={{ minHeight: '300px', display: 'block' }}
                />

                {!isVideoReady && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 z-20">
                    <div className="text-center">
                      <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                      <p className="text-white">Starting camera...</p>
                    </div>
                  </div>
                )}

                {/* Overlay */}
                <canvas
                  ref={overlayCanvasRef}
                  width={640}
                  height={480}
                  className="absolute inset-0 w-full h-full pointer-events-none z-10"
                />

                {/* Instruction */}
                <div className="absolute bottom-8 left-0 right-0 flex justify-center">
                  <div className={`px-6 py-3 rounded-full backdrop-blur-md transition-all duration-300 ${
                    isFaceAligned ? 'bg-green-500/20 border border-green-500/50' :
                    isFaceDetected ? 'bg-blue-500/20 border border-blue-500/50' :
                    'bg-gray-500/20 border border-gray-500/50'
                  }`}>
                    <p className={`text-lg font-medium ${
                      isFaceAligned ? 'text-green-400' :
                      isFaceDetected ? 'text-blue-400' : 'text-gray-400'
                    }`}>
                      {instructionText}
                    </p>
                  </div>
                </div>
              </>
            )}

            <canvas ref={canvasRef} className="hidden" />
          </div>

          {/* Controls */}
          {isCameraStarted && !capturedImage && (
            <div className="p-4 bg-gray-900 border-t border-gray-800 flex justify-center">
              <button
                onClick={captureImage}
                disabled={!isFaceDetected}
                className={`relative flex items-center justify-center w-16 h-16 rounded-full transition-all ${
                  isFaceAligned ? 'bg-green-500 hover:bg-green-600 shadow-lg hover:scale-105' :
                  isFaceDetected ? 'bg-white hover:bg-gray-100 shadow-lg hover:scale-105' :
                  'bg-gray-700 cursor-not-allowed'
                }`}
              >
                <div className={`w-12 h-12 rounded-full border-4 ${
                  isFaceAligned ? 'border-white' :
                  isFaceDetected ? 'border-blue-500' : 'border-gray-600'
                }`} />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }
);

FaceScanCamera.displayName = 'FaceScanCamera';

export default FaceScanCamera;

