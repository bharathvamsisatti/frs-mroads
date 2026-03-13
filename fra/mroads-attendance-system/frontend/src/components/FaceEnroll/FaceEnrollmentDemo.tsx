/**
 * Face Enrollment Demo
 * Demonstrates the enrollment animation with simulated progress
 */

import { useState } from 'react';
import FaceEnrollment from './FaceEnrollment';

const FaceEnrollmentDemo: React.FC = () => {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<'first' | 'second' | 'done'>('first');
  const [isEnrolling, setIsEnrolling] = useState(false);

  const simulateEnrollment = () => {
    setProgress(0);
    setPhase('first');
    setIsEnrolling(true);

    let current = 0;
    const interval = setInterval(() => {
      current += 1.25; // Slower for better visibility of segments
      setProgress(Math.min(current, 100));
      
      if (current >= 50 && current < 100) {
        setPhase('second');
      } else if (current >= 100) {
        setPhase('done');
        setIsEnrolling(false);
        clearInterval(interval);
      }
    }, 100);
  };

  const handleCompleted = () => {
    console.log('✅ Face enrollment complete!');
    setTimeout(() => {
      alert('Face ID enrollment successful! In your app, navigate to success screen.');
    }, 500);
  };

  const reset = () => {
    setProgress(0);
    setPhase('first');
    setIsEnrolling(false);
  };

  return (
    <div style={{ position: 'relative' }}>
      <FaceEnrollment 
        progress={progress}
        phase={phase}
        onCompleted={handleCompleted}
      />
      
      {/* Demo Controls */}
      <div style={{
        position: 'fixed',
        bottom: 40,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: 12,
        zIndex: 1000
      }}>
        <button
          onClick={simulateEnrollment}
          disabled={isEnrolling}
          style={{
            padding: '16px 32px',
            borderRadius: 14,
            border: 'none',
            background: isEnrolling 
              ? 'rgba(142, 142, 147, 0.3)' 
              : 'linear-gradient(135deg, #0A84FF 0%, #64D2FF 100%)',
            color: 'white',
            fontSize: 17,
            fontWeight: 600,
            cursor: isEnrolling ? 'not-allowed' : 'pointer',
            boxShadow: isEnrolling ? 'none' : '0 8px 24px rgba(10, 132, 255, 0.4)',
            fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
            transition: 'all 0.2s ease'
          }}
        >
          {isEnrolling ? 'Scanning Face...' : 'Start Face Scan'}
        </button>
        
        <button
          onClick={reset}
          style={{
            padding: '16px 32px',
            borderRadius: 14,
            border: '2px solid rgba(142, 142, 147, 0.3)',
            background: 'rgba(28, 28, 30, 0.6)',
            backdropFilter: 'blur(20px)',
            color: 'white',
            fontSize: 17,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
            transition: 'all 0.2s ease'
          }}
        >
          Reset
        </button>
      </div>

      {/* Progress Indicator */}
      <div style={{
        position: 'fixed',
        top: 30,
        right: 30,
        background: 'rgba(28, 28, 30, 0.9)',
        backdropFilter: 'blur(20px)',
        borderRadius: 16,
        padding: '20px 24px',
        minWidth: 220,
        border: '1px solid rgba(142, 142, 147, 0.2)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif'
        }}>
          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>
            Face Scan
          </span>
          <span style={{ 
            color: progress === 100 ? '#30D158' : '#64D2FF',
            fontSize: 20,
            fontWeight: 700
          }}>
            {Math.round(progress)}%
          </span>
        </div>
        
        <div style={{
          height: 5,
          background: 'rgba(142, 142, 147, 0.2)',
          borderRadius: 3,
          overflow: 'hidden'
        }}>
          <div style={{
            height: '100%',
            width: `${progress}%`,
            background: progress === 100 
              ? '#30D158'
              : 'linear-gradient(90deg, #0A84FF 0%, #64D2FF 100%)',
            borderRadius: 3,
            transition: 'width 0.3s ease'
          }} />
        </div>

        <div style={{
          marginTop: 16,
          paddingTop: 16,
          borderTop: '1px solid rgba(142, 142, 147, 0.2)',
          color: 'rgba(255,255,255,0.7)',
          fontSize: 13,
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span>Phase:</span>
            <span style={{ 
              color: '#64D2FF', 
              fontWeight: 600,
              textTransform: 'capitalize'
            }}>
              {phase}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Status:</span>
            <span style={{ 
              color: progress === 100 ? '#30D158' : isEnrolling ? '#FF9F0A' : '#8E8E93',
              fontWeight: 600
            }}>
              {progress === 100 ? 'Complete' : isEnrolling ? 'Active' : 'Ready'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FaceEnrollmentDemo;

