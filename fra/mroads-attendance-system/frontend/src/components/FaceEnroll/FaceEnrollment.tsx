/**
 * Face ID Enrollment Animation
 * Mimics Apple's Face ID enrollment with segmented circular progress and head rotation tracking
 */

import { useEffect, useState } from 'react';
import styles from './FaceEnrollment.module.css';

interface FaceEnrollmentProps {
  progress: number; // 0-100
  phase?: 'first' | 'second' | 'done' | 'capturing';
  theme?: 'dark' | 'light';
  className?: string;
  onCompleted?: () => void;
  onClose?: () => void;
  videoRef?: React.RefObject<HTMLVideoElement>;
  instructionText?: string;
}

const FaceEnrollment: React.FC<FaceEnrollmentProps> = ({
  progress,
  phase = 'first',
  theme = 'dark',
  className = '',
  onCompleted,
  videoRef,
  instructionText,
}) => {
  const [showCheckmark, setShowCheckmark] = useState(false);
  const [checkAnimStep, setCheckAnimStep] = useState(0);

  // Handle completion animation
  useEffect(() => {
    if (progress >= 100 && !showCheckmark) {
      setShowCheckmark(true);
      
      // Animate checkmark in steps
      setTimeout(() => setCheckAnimStep(1), 100);
      setTimeout(() => setCheckAnimStep(2), 300);
      setTimeout(() => onCompleted?.(), 1000);
    }
  }, [progress, showCheckmark, onCompleted]);

  // Calculate which quadrants should be visible based on progress
  const getQuadrantVisibility = () => {
    return {
      topLeft: progress >= 12.5,
      topRight: progress >= 25,
      bottomRight: progress >= 37.5,
      bottomLeft: progress >= 50,
      topLeft2: progress >= 62.5,
      topRight2: progress >= 75,
      bottomRight2: progress >= 87.5,
      bottomLeft2: progress >= 100
    };
  };

  const quadrants = getQuadrantVisibility();
  
  // Calculate face icon opacity (fades out as enrollment progresses)
  const faceOpacity = progress < 5 ? 1 : progress < 15 ? 0.5 : 0;
  
  // Calculate blur intensity for rings
  const getBlurIntensity = () => {
    if (progress < 25) return 0;
    if (progress < 50) return Math.min(7, (progress - 25) / 5);
    if (progress < 75) return Math.min(7, (progress - 50) / 5);
    return 7;
  };

  const blurIntensity = getBlurIntensity();

  // Get instruction text
  const getInstructionText = () => {
    // Use custom instruction text if provided
    if (instructionText) {
      return instructionText;
    }
    
    if (phase === 'done' || progress >= 100) {
      return 'Face enrollment complete';
    }
    if (phase === 'second' || (progress >= 50 && progress < 100)) {
      return 'Move your head slowly to complete the circle a second time';
    }
    if (phase === 'capturing') {
      return 'Move your head slowly in any direction';
    }
    return 'Move your head slowly to complete the circle';
  };

  const isDone = progress >= 100;

  return (
    <div className={`${styles.container} ${isDone ? styles.done : ''} ${className}`} data-theme={theme}>
      {/* Face ID Circle Area */}
      <div className={styles.faceIdCircle}>
        {/* Video preview with camera feed */}
        <div className={styles.videoMask}>
          {videoRef?.current ? (
            <video
              ref={videoRef}
              className={styles.videoFeed}
              autoPlay
              playsInline
              muted
            />
          ) : (
            <div className={styles.videoPlaceholder}>
              {/* Camera feed will be rendered here */}
            </div>
          )}
        </div>

        {/* SVG Overlay with segmented progress ring and guides */}
        <svg
          className={styles.svg}
          viewBox="0 0 280 280"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Blue ring gradient */}
            <linearGradient id="blueGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0A84FF" />
              <stop offset="100%" stopColor="#1E9BFF" />
            </linearGradient>
            
            {/* Cyan ring gradient */}
            <linearGradient id="cyanGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#64D2FF" />
              <stop offset="100%" stopColor="#00D4FF" />
            </linearGradient>

            {/* Glow filters */}
            <filter id="glow-blue">
              <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>

            <filter id="glow-cyan">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          {/* Base gray ring (always visible) */}
          <circle
            cx="140"
            cy="140"
            r="120"
            fill="none"
            stroke="rgba(142, 142, 147, 0.3)"
            strokeWidth="3"
          />

          {/* Crosshair Guide Lines */}
          {progress < 10 && (
            <g opacity={1 - (progress / 10)}>
              <line x1="110" y1="140" x2="170" y2="140" stroke="rgba(255,255,255,0.4)" strokeWidth="2" />
              <line x1="140" y1="110" x2="140" y2="170" stroke="rgba(255,255,255,0.4)" strokeWidth="2" />
            </g>
          )}

          {/* Face Icon (shows at start, fades out) */}
          {faceOpacity > 0 && (
            <g opacity={faceOpacity} transform="translate(140, 140)">
              <ellipse cx="0" cy="0" rx="14" ry="16" stroke="white" strokeWidth="3" opacity="0.6" fill="none"/>
              <ellipse cx="-5" cy="-4" rx="2" ry="3" fill="white" opacity="0.6"/>
              <ellipse cx="5" cy="-4" rx="2" ry="3" fill="white" opacity="0.6"/>
              <path d="M -6 8 Q 0 12 6 8" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.6"/>
              <path d="M 0 0 Q -1 4 0 6" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.6"/>
            </g>
          )}

          {/* First Pass - Blue Ring Segments */}
          {progress > 0 && progress < 50 && (
            <>
              {/* Top-Left Quadrant */}
              {quadrants.topLeft && (
                <path
                  d="M 140 20 A 120 120 0 0 1 260 140"
                  fill="none"
                  stroke="url(#blueGrad)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  filter={blurIntensity > 0 ? "url(#glow-blue)" : "none"}
                  className={styles.segmentAppear}
                />
              )}

              {/* Top-Right Quadrant */}
              {quadrants.topRight && (
                <path
                  d="M 260 140 A 120 120 0 0 1 140 260"
                  fill="none"
                  stroke="url(#blueGrad)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  filter={blurIntensity > 0 ? "url(#glow-blue)" : "none"}
                  className={styles.segmentAppear}
                />
              )}

              {/* Bottom-Right Quadrant */}
              {quadrants.bottomRight && (
                <path
                  d="M 140 260 A 120 120 0 0 1 20 140"
                  fill="none"
                  stroke="url(#blueGrad)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  filter={blurIntensity > 0 ? "url(#glow-blue)" : "none"}
                  className={styles.segmentAppear}
                />
              )}

              {/* Bottom-Left Quadrant */}
              {quadrants.bottomLeft && (
                <path
                  d="M 20 140 A 120 120 0 0 1 140 20"
                  fill="none"
                  stroke="url(#blueGrad)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  filter={blurIntensity > 0 ? "url(#glow-blue)" : "none"}
                  className={styles.segmentAppear}
                />
              )}
            </>
          )}

          {/* Second Pass - Cyan Ring Segments (outer glow effect) */}
          {progress >= 50 && (
            <>
              {/* Outer cyan glow rings */}
              {quadrants.topLeft2 && (
                <>
                  <path
                    d="M 140 15 A 125 125 0 0 1 265 140"
                    fill="none"
                    stroke="url(#cyanGrad)"
                    strokeWidth="4"
                    strokeLinecap="round"
                    filter="url(#glow-cyan)"
                    opacity="0.8"
                    className={styles.segmentAppear}
                  />
                  <path
                    d="M 140 20 A 120 120 0 0 1 260 140"
                    fill="none"
                    stroke="url(#cyanGrad)"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    className={styles.segmentAppear}
                  />
                </>
              )}

              {quadrants.topRight2 && (
                <>
                  <path
                    d="M 265 140 A 125 125 0 0 1 140 265"
                    fill="none"
                    stroke="url(#cyanGrad)"
                    strokeWidth="4"
                    strokeLinecap="round"
                    filter="url(#glow-cyan)"
                    opacity="0.8"
                    className={styles.segmentAppear}
                  />
                  <path
                    d="M 260 140 A 120 120 0 0 1 140 260"
                    fill="none"
                    stroke="url(#cyanGrad)"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    className={styles.segmentAppear}
                  />
                </>
              )}

              {quadrants.bottomRight2 && (
                <>
                  <path
                    d="M 140 265 A 125 125 0 0 1 15 140"
                    fill="none"
                    stroke="url(#cyanGrad)"
                    strokeWidth="4"
                    strokeLinecap="round"
                    filter="url(#glow-cyan)"
                    opacity="0.8"
                    className={styles.segmentAppear}
                  />
                  <path
                    d="M 140 260 A 120 120 0 0 1 20 140"
                    fill="none"
                    stroke="url(#cyanGrad)"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    className={styles.segmentAppear}
                  />
                </>
              )}

              {quadrants.bottomLeft2 && (
                <>
                  <path
                    d="M 15 140 A 125 125 0 0 1 140 15"
                    fill="none"
                    stroke="url(#cyanGrad)"
                    strokeWidth="4"
                    strokeLinecap="round"
                    filter="url(#glow-cyan)"
                    opacity="0.8"
                    className={styles.segmentAppear}
                  />
                  <path
                    d="M 20 140 A 120 120 0 0 1 140 20"
                    fill="none"
                    stroke="url(#cyanGrad)"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    className={styles.segmentAppear}
                  />
                </>
              )}
            </>
          )}

          {/* Completion: Full bright ring */}
          {progress >= 100 && (
            <circle
              cx="140"
              cy="140"
              r="120"
              fill="none"
              stroke="url(#cyanGrad)"
              strokeWidth="4"
              filter="url(#glow-cyan)"
              className={styles.ringComplete}
            />
          )}

          {/* Checkmark Animation */}
          {showCheckmark && (
            <g transform="translate(140, 140)">
              {/* Background circle */}
              <circle
                cx="0"
                cy="0"
                r="32"
                fill="#0A84FF"
                className={styles.checkBgScale}
              />
              
              {/* Checkmark paths */}
              <g transform="translate(-12, -8)">
                {/* Left part of check */}
                {checkAnimStep >= 1 && (
                  <rect
                    x="0"
                    y="10"
                    width="3.5"
                    height="17"
                    fill="white"
                    rx="2"
                    transform="rotate(-37.5 1.75 18.5)"
                    className={styles.checkLeftDraw}
                  />
                )}
                
                {/* Right part of check */}
                {checkAnimStep >= 2 && (
                  <rect
                    x="8"
                    y="0"
                    width="3.5"
                    height="28"
                    fill="white"
                    rx="2"
                    transform="rotate(33.6 9.75 14)"
                    className={styles.checkRightDraw}
                  />
                )}
              </g>
            </g>
          )}
        </svg>
      </div>

      {/* Instruction text */}
      <div className={styles.instructionContainer}>
        <p className={styles.instructionText}>
          {getInstructionText()}
        </p>
      </div>

      {/* Progress indicator */}
      {!isDone && (
        <div className={styles.progressIndicator}>
          <div className={styles.progressBar}>
            <div 
              className={styles.progressBarFill} 
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className={styles.progressText}>{Math.round(progress)}%</p>
        </div>
      )}
    </div>
  );
};

export default FaceEnrollment;

