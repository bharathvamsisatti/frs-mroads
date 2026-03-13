/**
 * iOS Face Enrollment Controller - Continuous Capture Mode
 * Captures images continuously as user moves their head in any direction
 * No pose requirements - just needs head movement for angle diversity
 */

import { useRef, useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { FaceMesh, Results } from '@mediapipe/face_mesh';
import { calculateFaceAngles2D } from '../../utils/faceAngleUtils';
import FaceEnrollment from './FaceEnrollment';
import styles from './FaceEnrollmentController.module.css';

interface FaceEnrollmentControllerProps {
  onComplete?: (files: File[]) => void;
  onClose?: () => void;
  className?: string;
  requiredImages?: number;
}

export interface FaceEnrollmentControllerRef {
  startEnrollment: () => void;
  stopEnrollment: () => void;
  reset: () => void;
}

const FaceEnrollmentController = forwardRef<FaceEnrollmentControllerRef, FaceEnrollmentControllerProps>(
  (props, ref) => {
    const { onComplete, onClose, className = '', requiredImages = 5 } = props;

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const faceMeshRef = useRef<FaceMesh | null>(null);
    const animationFrameRef = useRef<number | null>(null);

    // State management
    const [isStarted, setIsStarted] = useState(false);
    const [isCameraReady, setIsCameraReady] = useState(false);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [capturedFiles, setCapturedFiles] = useState<File[]>([]);
    const [lastCaptureTime, setLastCaptureTime] = useState(0);
    const [lastCaptureAngles, setLastCaptureAngles] = useState({ yaw: 0, pitch: 0 });

    const CAPTURE_INTERVAL = 1200; // ms between captures (increased to give user time to move head)
    const MIN_ANGLE_DIFF = 25; // minimum angle difference from last capture (ensures some diversity without being too strict)

    // Calculate progress
    const progress = (capturedFiles.length / requiredImages) * 100;
    const phase = progress < 100 ? 'capturing' : 'done';

    // Expose methods to parent
    useImperativeHandle(ref, () => ({
      startEnrollment: handleStartEnrollment,
      stopEnrollment: handleStopEnrollment,
      reset: handleReset,
    }));

    // Check if enough angle diversity for capture
    const shouldCaptureFrame = (yaw: number, pitch: number): boolean => {
      const now = Date.now();
      
      // Check time interval
      if (now - lastCaptureTime < CAPTURE_INTERVAL) {
        return false;
      }

      // Check angle diversity
      const yawDiff = Math.abs(yaw - lastCaptureAngles.yaw);
      const pitchDiff = Math.abs(pitch - lastCaptureAngles.pitch);
      const totalAngleDiff = Math.sqrt(yawDiff * yawDiff + pitchDiff * pitchDiff);

      return totalAngleDiff >= MIN_ANGLE_DIFF;
    };

    // Capture frame from video
    const captureFrame = useCallback(
      async (yaw: number, pitch: number) => {
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

        // Convert to File
        const byteString = atob(dataUrl.split(',')[1]);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
        }
        const blob = new Blob([ab], { type: 'image/jpeg' });
        const imageNum = capturedFiles.length + 1;
        const file = new File(
          [blob],
          `enrollment-${imageNum}-y${yaw.toFixed(0)}-p${pitch.toFixed(0)}.jpg`,
          { type: 'image/jpeg' }
        );

        // Update state
        const newFiles = [...capturedFiles, file];
        setCapturedFiles(newFiles);
        setLastCaptureTime(Date.now());
        setLastCaptureAngles({ yaw, pitch });

        console.log(
          `📸 Captured image ${newFiles.length}/${requiredImages} | Yaw: ${yaw.toFixed(1)}° | Pitch: ${pitch.toFixed(1)}°`
        );

        // Check if enrollment complete
        if (newFiles.length >= requiredImages) {
          console.log(`✅ Enrollment complete! Captured ${newFiles.length} images.`);
          setTimeout(() => {
            handleStopEnrollment();
            onComplete?.(newFiles);
          }, 1000);
        }
      },
      [capturedFiles, requiredImages, onComplete]
    );

    // FaceMesh results handler
    const onFaceMeshResults = useCallback(
      (results: Results) => {
        if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
          return;
        }

        if (!isStarted || capturedFiles.length >= requiredImages) {
          return;
        }

        const landmarks = results.multiFaceLandmarks[0];
        const angles = calculateFaceAngles2D(landmarks);

        // Check if we should capture
        if (shouldCaptureFrame(angles.yaw, angles.pitch)) {
          captureFrame(angles.yaw, angles.pitch);
        }
      },
      [isStarted, capturedFiles.length, requiredImages, shouldCaptureFrame, captureFrame]
    );

    // Update FaceMesh callback when needed
    useEffect(() => {
      if (faceMeshRef.current) {
        faceMeshRef.current.onResults(onFaceMeshResults);
      }
    }, [onFaceMeshResults]);

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

    // Start camera stream
    const startCameraStream = useCallback(async () => {
      const video = videoRef.current;
      if (!video) return;

      try {
        setCameraError(null);
        console.log('Starting camera...');

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });

        streamRef.current = stream;
        video.srcObject = stream;

        await new Promise<void>((resolve) => {
          video.onloadedmetadata = () => {
            video.play().then(() => {
              console.log('Camera ready');
              setIsCameraReady(true);
              resolve();
            });
          };
        });

        await initializeFaceMesh();

        // Process frames
        const processFrame = async () => {
          if (!faceMeshRef.current || !streamRef.current || !video) return;
          if (video.readyState === 4) {
            try {
              await faceMeshRef.current.send({ image: video });
            } catch (e) {
              // Silently handle errors
            }
          }
          if (streamRef.current && isStarted) {
            animationFrameRef.current = requestAnimationFrame(processFrame);
          }
        };

        setTimeout(() => {
          if (faceMeshRef.current && streamRef.current) {
            animationFrameRef.current = requestAnimationFrame(processFrame);
          }
        }, 500);
      } catch (err: any) {
        console.error('Camera error:', err);
        setCameraError('Unable to access camera. Please check permissions.');
        setIsStarted(false);
      }
    }, [initializeFaceMesh, isStarted]);

    // Start enrollment
    const handleStartEnrollment = useCallback(() => {
      console.log('Starting enrollment');
      setIsStarted(true);
      setCapturedFiles([]);
      setLastCaptureTime(0);
      setLastCaptureAngles({ yaw: 0, pitch: 0 });
    }, []);

    // Stop enrollment
    const handleStopEnrollment = useCallback(() => {
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
      setIsStarted(false);
      setIsCameraReady(false);
    }, []);

    // Reset
    const handleReset = useCallback(() => {
      handleStopEnrollment();
      setCapturedFiles([]);
      setLastCaptureTime(0);
      setLastCaptureAngles({ yaw: 0, pitch: 0 });
      setCameraError(null);
    }, [handleStopEnrollment]);

    // Start camera when enrollment starts
    useEffect(() => {
      if (isStarted && !isCameraReady && videoRef.current) {
        startCameraStream();
      }
    }, [isStarted, isCameraReady, startCameraStream]);

    // Cleanup on unmount
    useEffect(() => {
      return () => handleStopEnrollment();
    }, [handleStopEnrollment]);

    return (
      <div className={`${styles.container} ${className}`}>
        {/* Hidden video and canvas */}
        <video
          ref={videoRef}
          className={styles.hiddenVideo}
          autoPlay
          playsInline
          muted
        />
        <canvas ref={canvasRef} className={styles.hiddenCanvas} />

        {/* Error state */}
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

        {/* Idle/Start screen */}
        {!isStarted && !cameraError && phase !== 'done' && (
          <div className={styles.startContainer}>
            <div className={styles.startCard}>
              <div className={styles.startIcon}>
                <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" clipRule="evenodd" d="M3.25 17.5625V10.375C3.25 6.44625 6.44631 3.25 10.375 3.25H17.5625C18.4599 3.25 19.1875 2.52244 19.1875 1.625C19.1875 0.727562 18.4599 0 17.5625 0H10.375C4.65425 0 0 4.65419 0 10.375V17.5625C0 18.4599 0.727562 19.1875 1.625 19.1875C2.52244 19.1875 3.25 18.4599 3.25 17.5625ZM17.5625 60.75C18.4599 60.75 19.1875 61.4776 19.1875 62.375C19.1875 63.2724 18.4599 64 17.5625 64H10.375C4.65425 64 0 59.3457 0 53.625V46.4375C0 45.5401 0.727562 44.8125 1.625 44.8125C2.52244 44.8125 3.25 45.5401 3.25 46.4375V53.625C3.25 57.5537 6.44631 60.75 10.375 60.75H17.5625ZM64 46.4375V53.625C64 59.3457 59.3457 64 53.625 64H46.4375C45.5401 64 44.8125 63.2724 44.8125 62.375C44.8125 61.4776 45.5401 60.75 46.4375 60.75H53.625C57.5537 60.75 60.75 57.5537 60.75 53.625V46.4375C60.75 45.5401 61.4776 44.8125 62.375 44.8125C63.2724 44.8125 64 45.5401 64 46.4375ZM64 10.375V17.5625C64 18.4599 63.2724 19.1875 62.375 19.1875C61.4776 19.1875 60.75 18.4599 60.75 17.5625V10.375C60.75 6.44625 57.5537 3.25 53.625 3.25H46.4375C45.5401 3.25 44.8125 2.52244 44.8125 1.625C44.8125 0.727562 45.5401 0 46.4375 0H53.625C59.3457 0 64 4.65419 64 10.375ZM43.2142 47.3021C43.8988 46.6698 43.9411 45.6021 43.3087 44.9175C42.6763 44.2329 41.6087 44.1906 40.9241 44.8229C38.488 47.0731 35.3187 48.3124 31.9999 48.3124C28.681 48.3124 25.5117 47.0731 23.0756 44.8229C22.3909 44.1906 21.3234 44.2329 20.691 44.9175C20.0586 45.6021 20.1009 46.6698 20.7855 47.3021C23.8471 50.13 27.8297 51.6874 31.9999 51.6874C36.17 51.6874 40.1526 50.13 43.2142 47.3021ZM35.375 24.125V36.125C35.375 38.5029 33.4404 40.4375 31.0625 40.4375H29.6875C28.7555 40.4375 28 39.682 28 38.75C28 37.818 28.7555 37.0625 29.6875 37.0625H31.0625C31.5794 37.0625 32 36.6419 32 36.125V24.125C32 23.193 32.7555 22.4375 33.6875 22.4375C34.6195 22.4375 35.375 23.193 35.375 24.125ZM47 28.8438V24.0312C47 23.1511 46.2864 22.4375 45.4062 22.4375C44.5261 22.4375 43.8125 23.1511 43.8125 24.0312V28.8438C43.8125 29.7239 44.5261 30.4375 45.4062 30.4375C46.2864 30.4375 47 29.7239 47 28.8438ZM17.375 28.8438C17.375 29.7239 18.0886 30.4375 18.9688 30.4375C19.8489 30.4375 20.5625 29.7239 20.5625 28.8438V24.0312C20.5625 23.1511 19.8489 22.4375 18.9688 22.4375C18.0886 22.4375 17.375 23.1511 17.375 24.0312V28.8438Z" fill="currentColor"/>
                </svg>
              </div>
              <h2>Set Up Face ID</h2>
              <p>Position your face in the frame and slowly move your head in any direction</p>
              <button onClick={handleStartEnrollment} className={styles.startButton}>
                Get Started
              </button>
              <button onClick={onClose} className={styles.cancelButton}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Enrollment UI */}
        {isStarted && phase !== 'done' && (
          <FaceEnrollment
            videoRef={videoRef}
            progress={progress}
            phase={phase}
            instructionText={`Move your head slowly in any direction\n${capturedFiles.length}/${requiredImages} images captured`}
            onClose={handleStopEnrollment}
          />
        )}

        {/* Completion screen - only show after enrollment done */}
        {phase === 'done' && (
          <div className={styles.completeContainer}>
            <div className={styles.completeCard}>
              <div className={styles.completeIcon}>✅</div>
              <h2>Face Enrollment Complete!</h2>
              <p>{capturedFiles.length} images captured. Click "Enroll" to save.</p>
            </div>
          </div>
        )}
      </div>
    );
  }
);

FaceEnrollmentController.displayName = 'FaceEnrollmentController';

export default FaceEnrollmentController;
