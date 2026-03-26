/**
 * iOS Face Verification/Recognition Component
 * Shows iOS-style animations while processing face verification/recognition in the background
 * No "Get Started" button - automatically starts processing
 */

import { useRef, useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { FaceMesh, Results } from '@mediapipe/face_mesh';
import { calculateFaceAngles2D, FaceAngles } from '../../utils/faceAngleUtils';
import styles from './FaceEnrollmentController.module.css';

interface FaceVerificationProps {
  onComplete?: (result: { matched: boolean; confidence?: number; identity?: string; person?: any }) => void;
  onClose?: () => void;
  mode?: 'verify' | 'recognize';
  className?: string;
}

export interface FaceVerificationRef {
  startVerification: () => void;
  stopVerification: () => void;
  reset: () => void;
}

const FaceVerification = forwardRef<FaceVerificationRef, FaceVerificationProps>(
  (props, ref) => {
    const { onComplete, mode = 'verify', className = '' } = props;

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const faceMeshRef = useRef<FaceMesh | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const lastCaptureTimeRef = useRef(0);
    const phaseRef = useRef<'capturing' | 'processing' | 'success' | 'failure'>('capturing');
    const goodAngleStartTimeRef = useRef(0);
    const lastAnglesRef = useRef<FaceAngles | null>(null);

    // State management
    const [isStarted, setIsStarted] = useState(false);
    const [isCameraReady, setIsCameraReady] = useState(false);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [phase, setPhase] = useState<'capturing' | 'processing' | 'success' | 'failure'>('capturing');
    const [result, setResult] = useState<{ matched: boolean; confidence?: number; identity?: string; person?: any } | null>(null);
    const [capturedImageUrl, setCapturedImageUrl] = useState<string | null>(null);
    const [faceAngleStatus, setFaceAngleStatus] = useState<string>('Position your face in the frame');

    const CAPTURE_INTERVAL = 2000; // Minimum time between capture attempts
    const GOOD_ANGLE_DURATION = 1500; // Must maintain good angle for 1.5 seconds
    const MAX_YAW = 15; // Maximum yaw angle (left/right) in degrees
    const MAX_PITCH = 15; // Maximum pitch angle (up/down) in degrees
    const MAX_ROLL = 10; // Maximum roll angle (tilt) in degrees

    // Expose methods to parent
    useImperativeHandle(ref, () => ({
      startVerification: handleStartVerification,
      stopVerification: handleStopVerification,
      reset: handleReset,
    }));

    // Initialize Face Mesh
    useEffect(() => {
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
      faceMeshRef.current = faceMesh;

      return () => {
        if (faceMeshRef.current) {
          faceMeshRef.current.close();
        }
      };
    }, []);

    // Check if face angle is good for capture
    const isGoodFaceAngle = useCallback((angles: FaceAngles): boolean => {
      return (
        Math.abs(angles.yaw) <= MAX_YAW &&
        Math.abs(angles.pitch) <= MAX_PITCH &&
        Math.abs(angles.roll) <= MAX_ROLL
      );
    }, []);

    // Capture frame and send for verification/recognition
    const captureFrame = useCallback(async () => {
      if (phaseRef.current !== 'capturing') return; // Don't capture if already processing
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Draw mirrored video
      ctx.save();
      ctx.scale(-1, 1);
      ctx.drawImage(video, -canvas.width, 0);
      ctx.restore();

      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      
      // Store captured image URL to show instead of stream
      setCapturedImageUrl(dataUrl);

      // Update phase to processing
      setPhase('processing');
      
      // Stop video stream when processing
      if (videoRef.current) {
        videoRef.current.pause();
      }

      try {
        // Convert to blob
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        const file = new File([blob], 'frame.jpg', { type: 'image/jpeg' });

        let apiResult: any;
        if (mode === 'verify') {
          const formData = new FormData();
          formData.append('file', file);
          const res = await fetch('http://localhost:9090/verify', {
            method: 'POST',
            body: formData,
          });
          apiResult = await res.json();

          if (apiResult.identity && apiResult.identity !== 'Unknown') {
            setResult({
              matched: true,
              confidence: apiResult.average_score,
              identity: apiResult.identity,
            });
            setPhase('success');
            setTimeout(() => {
              if (onComplete) {
                onComplete({
                  matched: true,
                  confidence: apiResult.average_score,
                  identity: apiResult.identity,
                });
              }
            }, 1500);
          } else {
            setResult({ matched: false });
            setPhase('failure');
            setTimeout(() => {
              if (onComplete) {
                onComplete({ matched: false });
              }
            }, 1500);
          }
        } else {
          // Recognize mode
          const base64String = dataUrl.split(',')[1];
          const res = await fetch('http://localhost:9090/recognize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: base64String }),
          });
          apiResult = await res.json();

          if (apiResult.person) {
            setResult({
              matched: true,
              identity: apiResult.person.name,
              person: apiResult.person,
            });
            setPhase('success');
            setTimeout(() => {
              if (onComplete) {
                onComplete({
                  matched: true,
                  identity: apiResult.person.name,
                  person: apiResult.person,
                });
              }
            }, 1500);
          } else {
            setResult({ matched: false });
            setPhase('failure');
            setTimeout(() => {
              if (onComplete) {
                onComplete({ matched: false });
              }
            }, 1500);
          }
        }
      } catch (error) {
        console.error('Error processing frame:', error);
        setResult({ matched: false });
        setPhase('failure');
        if (onComplete) {
          onComplete({ matched: false });
        }
      }
    }, [mode, onComplete]);

    // Handle face mesh results and check angles
    const onFaceMeshResults = useCallback((results: Results) => {
      if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
        setFaceAngleStatus('No face detected. Please look at the camera.');
        goodAngleStartTimeRef.current = 0;
        return;
      }

      if (phaseRef.current !== 'capturing') return;

      const landmarks = results.multiFaceLandmarks[0];
      const angles = calculateFaceAngles2D(landmarks);
      lastAnglesRef.current = angles;

      // Check if face angle is good
      if (isGoodFaceAngle(angles)) {
        const now = Date.now();
        if (goodAngleStartTimeRef.current === 0) {
          // Start tracking good angle time
          goodAngleStartTimeRef.current = now;
          setFaceAngleStatus('Good position! Hold still...');
        } else {
          const goodAngleDuration = now - goodAngleStartTimeRef.current;
          if (goodAngleDuration >= GOOD_ANGLE_DURATION) {
            // Good angle maintained long enough - ready to capture
            setFaceAngleStatus('Perfect! Capturing...');
            // Trigger capture if enough time has passed since last capture
            if (now - lastCaptureTimeRef.current >= CAPTURE_INTERVAL) {
              lastCaptureTimeRef.current = now;
              goodAngleStartTimeRef.current = 0; // Reset
              captureFrame();
            }
          } else {
            // Still building up good angle time
            const remaining = Math.ceil((GOOD_ANGLE_DURATION - goodAngleDuration) / 1000);
            setFaceAngleStatus(`Good position! Hold still for ${remaining}s...`);
          }
        }
      } else {
        // Face angle not good - reset timer
        goodAngleStartTimeRef.current = 0;
        let message = 'Position your face in the frame';
        if (Math.abs(angles.yaw) > MAX_YAW) {
          message = angles.yaw > 0 ? 'Turn your head slightly left' : 'Turn your head slightly right';
        } else if (Math.abs(angles.pitch) > MAX_PITCH) {
          message = angles.pitch > 0 ? 'Look up slightly' : 'Look down slightly';
        } else if (Math.abs(angles.roll) > MAX_ROLL) {
          message = 'Straighten your head';
        }
        setFaceAngleStatus(message);
      }
    }, [isGoodFaceAngle, captureFrame]);
    
    // Update phase ref when phase state changes
    useEffect(() => {
      phaseRef.current = phase;
    }, [phase]);

    // Process video frames
    const processVideo = useCallback(async () => {
      if (!videoRef.current || !faceMeshRef.current || phaseRef.current !== 'capturing') {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        return;
      }

      const video = videoRef.current;
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        await faceMeshRef.current.send({ image: video });
        // Capture decision is now made in onFaceMeshResults based on face angle
      }

      animationFrameRef.current = requestAnimationFrame(processVideo);
    }, []);

    const handleStartVerification = async () => {
      try {
        setCameraError(null);
        setIsStarted(true);
        setPhase('capturing');

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
        setIsCameraReady(true);
        setCapturedImageUrl(null); // Reset captured image when starting

        // Wait for video element to be created by FaceEnrollment
        const waitForVideo = () => {
          if (videoRef.current) {
            videoRef.current.srcObject = mediaStream;
            videoRef.current.onloadedmetadata = () => {
              videoRef.current?.play();
              processVideo();
            };
          } else {
            // Retry after a short delay if video element not ready yet
            setTimeout(waitForVideo, 100);
          }
        };
        waitForVideo();
      } catch (err) {
        console.error('Error accessing camera:', err);
        setCameraError('Unable to access camera. Please check permissions.');
        setIsStarted(false);
      }
    };

    const handleStopVerification = () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      const currentStream = streamRef.current;
      if (currentStream) {
        currentStream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      setIsStarted(false);
      setIsCameraReady(false);
      setPhase('capturing');
      setResult(null);
      setCapturedImageUrl(null);
      setFaceAngleStatus('Position your face in the frame');
      goodAngleStartTimeRef.current = 0;
      lastAnglesRef.current = null;

      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };

    const handleReset = () => {
      handleStopVerification();
      setTimeout(() => {
        handleStartVerification();
      }, 100);
    };

    const getInstructionText = () => {
      if (phase === 'success') {
        return result?.matched ? 'Verification Successful' : '';
      }
      if (phase === 'failure') {
        return 'Verification Failed';
      }
      if (phase === 'processing') {
        return 'Processing...';
      }
      return faceAngleStatus;
    };

    return (
      <div className={`${styles.container} ${className}`}>
        {/* Hidden canvas for capture */}
        <canvas 
          ref={canvasRef} 
          style={{
            position: 'absolute',
            top: '-9999px',
            left: '-9999px',
            width: '1px',
            height: '1px'
          }}
        />

        {/* Error screen */}
        {cameraError && (
          <div className={styles.errorContainer}>
            <div className={styles.errorCard}>
              <div className={styles.errorIcon}>⚠️</div>
              <h3 className={styles.errorTitle}>Camera Error</h3>
              <p className={styles.errorMessage}>{cameraError}</p>
              <button onClick={handleReset} className={styles.errorButton}>
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Main verification UI */}
        {!cameraError && (
          <>
            {/* Loading state */}
            {!isCameraReady && !isStarted && (
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center',
                padding: '3rem',
                color: 'white',
                textAlign: 'center'
              }}>
                <div style={{ 
                  width: '60px', 
                  height: '60px', 
                  border: '4px solid rgba(255,255,255,0.3)',
                  borderTopColor: '#0A84FF',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  marginBottom: '1rem'
                }}></div>
                <p style={{ fontSize: '1rem', opacity: 0.8 }}>Initializing camera...</p>
                <style>{`
                  @keyframes spin {
                    to { transform: rotate(360deg); }
                  }
                  @keyframes glow {
                    0%, 100% {
                      opacity: 0.3;
                      box-shadow: 0 0 10px rgba(10, 132, 255, 0.4), 0 0 20px rgba(10, 132, 255, 0.3), 0 0 30px rgba(10, 132, 255, 0.2);
                    }
                    50% {
                      opacity: 1;
                      box-shadow: 0 0 30px rgba(10, 132, 255, 1), 0 0 60px rgba(10, 132, 255, 0.8), 0 0 90px rgba(10, 132, 255, 0.6);
                    }
                  }
                `}</style>
              </div>
            )}
            
            {/* Face ID Scanning Animation (Figma Style) */}
            {(isCameraReady || isStarted) && phase !== 'success' && phase !== 'failure' && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '2rem',
                minHeight: '400px'
              }}>
                {/* Circular Face Frame */}
                <div style={{
                  position: 'relative',
                  width: '280px',
                  height: '280px',
                  marginBottom: '2rem'
                }}>
                  {/* Video feed or captured image in circular mask */}
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: '50%',
                    overflow: 'hidden',
                    background: 'rgba(0, 0, 0, 0.8)',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 0 60px rgba(0, 0, 0, 0.3)',
                    border: phase === 'processing' ? '4px solid transparent' : 'none',
                    animation: phase === 'processing' ? 'glow 2s ease-in-out infinite' : 'none'
                  }}>
                    {capturedImageUrl && phase === 'processing' ? (
                      <img
                        src={capturedImageUrl}
                        alt="Captured face"
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          transform: 'scaleX(-1)'
                        }}
                      />
                    ) : (
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          transform: 'scaleX(-1)'
                        }}
                      />
                    )}
                  </div>
                  
                  {/* Glowing border animation for processing */}
                  {phase === 'processing' && (
                    <div style={{
                      position: 'absolute',
                      inset: '-8px',
                      borderRadius: '50%',
                      border: '4px solid #0A84FF',
                      animation: 'glow 1.5s ease-in-out infinite',
                      pointerEvents: 'none'
                    }} />
                  )}
                </div>

                {/* Instruction Text */}
                <p style={{
                  color: 'rgba(255, 255, 255, 0.9)',
                  fontSize: '1.125rem',
                  fontWeight: 500,
                  textAlign: 'center',
                  marginBottom: '1rem'
                }}>
                  {getInstructionText()}
                </p>

                {/* Progress */}
                {phase === 'processing' && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    color: 'rgba(255, 255, 255, 0.7)',
                    fontSize: '0.9rem'
                  }}>
                    <div style={{
                      width: '16px',
                      height: '16px',
                      border: '2px solid rgba(255,255,255,0.3)',
                      borderTopColor: '#0A84FF',
                      borderRadius: '50%',
                      animation: 'spin 0.8s linear infinite'
                    }}></div>
                    Processing...
                  </div>
                )}
              </div>
            )}

            {/* Success Animation (Figma Style) */}
            {phase === 'success' && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '3rem',
                minHeight: '400px',
                animation: 'fadeIn 0.3s ease'
              }}>
                <div style={{
                  width: '120px',
                  height: '120px',
                  borderRadius: '50%',
                  background: '#34C759',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '2rem',
                  boxShadow: '0 8px 24px rgba(52, 199, 89, 0.4)',
                  animation: 'scaleIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)'
                }}>
                  <svg width="60" height="60" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M20 30 L27 37 L40 24"
                      stroke="white"
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                      style={{
                        strokeDasharray: 30,
                        strokeDashoffset: 30,
                        animation: 'drawCheck 0.5s ease forwards 0.2s'
                      }}
                    />
                  </svg>
                </div>
                <h2 style={{
                  color: '#34C759',
                  fontSize: '1.75rem',
                  fontWeight: 700,
                  marginBottom: '1rem',
                  textAlign: 'center'
                }}>
                  Success
                </h2>
                {result?.identity && (
                  <p style={{
                    color: 'rgba(255, 255, 255, 0.9)',
                    fontSize: '1.125rem',
                    fontWeight: 600,
                    marginBottom: '0.5rem'
                  }}>
                    {result.identity}
                  </p>
                )}
                {result?.confidence !== undefined && (
                  <p style={{
                    color: 'rgba(255, 255, 255, 0.6)',
                    fontSize: '0.9375rem'
                  }}>
                    Confidence: {(result.confidence * 100).toFixed(1)}%
                  </p>
                )}
                <style>{`
                  @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                  }
                  @keyframes scaleIn {
                    from { transform: scale(0); opacity: 0; }
                    50% { transform: scale(1.2); }
                    to { transform: scale(1); opacity: 1; }
                  }
                  @keyframes drawCheck {
                    to { stroke-dashoffset: 0; }
                  }
                `}</style>
              </div>
            )}

            {/* Failure Animation (Figma Style) */}
            {phase === 'failure' && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '3rem',
                minHeight: '400px',
                animation: 'fadeIn 0.3s ease'
              }}>
                <div style={{
                  width: '120px',
                  height: '120px',
                  borderRadius: '50%',
                  background: '#FF3B30',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '2rem',
                  boxShadow: '0 8px 24px rgba(255, 59, 48, 0.4)',
                  animation: 'scaleIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)'
                }}>
                  <svg width="60" height="60" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M20 20 L40 40 M40 20 L20 40"
                      stroke="white"
                      strokeWidth="4"
                      strokeLinecap="round"
                      style={{
                        strokeDasharray: 40,
                        strokeDashoffset: 40,
                        animation: 'drawX 0.5s ease forwards 0.2s'
                      }}
                    />
                  </svg>
                </div>
                <h2 style={{
                  color: '#FF3B30',
                  fontSize: '1.75rem',
                  fontWeight: 700,
                  marginBottom: '1rem',
                  textAlign: 'center'
                }}>
                  Failed
                </h2>
                <p style={{
                  color: 'rgba(255, 255, 255, 0.9)',
                  fontSize: '1.125rem',
                  fontWeight: 600
                }}>
                  Face not recognized
                </p>
                <style>{`
                  @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                  }
                  @keyframes scaleIn {
                    from { transform: scale(0); opacity: 0; }
                    50% { transform: scale(1.2); }
                    to { transform: scale(1); opacity: 1; }
                  }
                  @keyframes drawX {
                    to { stroke-dashoffset: 0; }
                  }
                `}</style>
              </div>
            )}
          </>
        )}
      </div>
    );
  }
);

FaceVerification.displayName = 'FaceVerification';

export default FaceVerification;

