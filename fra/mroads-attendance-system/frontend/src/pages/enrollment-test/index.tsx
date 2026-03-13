/**
 * Face ID Enrollment Test Page
 * Test the enrollment animation
 */

import { useRef, useState } from 'react';
import { FaceEnrollmentController, FaceEnrollmentControllerRef } from '../../components/FaceEnroll';

const EnrollmentTest: React.FC = () => {
  const enrollmentRef = useRef<FaceEnrollmentControllerRef>(null);
  const [enrolledFiles, setEnrolledFiles] = useState<File[]>([]);
  const [showResult, setShowResult] = useState(false);

  const handleComplete = (files: File[]) => {
    console.log('✓ Enrollment complete!', files);
    setEnrolledFiles(files);
    setShowResult(true);
  };

  const handleClose = () => {
    enrollmentRef.current?.stopEnrollment();
    window.location.href = '/enroll'; // Go back to main enroll page
  };

  const handleReset = () => {
    setShowResult(false);
    setEnrolledFiles([]);
    enrollmentRef.current?.reset();
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0B0B10 0%, #1a1a24 100%)' }}>
      {!showResult ? (
        <FaceEnrollmentController
          ref={enrollmentRef}
          onComplete={handleComplete}
          onClose={handleClose}
          requiredImages={8}
        />
      ) : (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '2rem',
        }}>
          <div style={{
            background: 'rgba(255,255,255,0.05)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '24px',
            padding: '3rem 2.5rem',
            maxWidth: '600px',
            textAlign: 'center',
          }}>
            <div style={{
              width: '80px',
              height: '80px',
              background: 'linear-gradient(135deg, #0A84FF 0%, #64D2FF 100%)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 2rem auto',
            }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <h1 style={{ color: 'white', fontSize: '2rem', marginBottom: '1rem' }}>
              Enrollment Complete!
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '1.125rem', marginBottom: '2rem' }}>
              Successfully captured {enrolledFiles.length} images at different angles
            </p>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
              gap: '1rem',
              marginBottom: '2rem',
            }}>
              {enrolledFiles.map((file, index) => (
                <div key={index} style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  padding: '1rem',
                  textAlign: 'center',
                }}>
                  <div style={{
                    width: '60px',
                    height: '60px',
                    background: 'linear-gradient(135deg, #0A84FF 0%, #64D2FF 100%)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 0.5rem auto',
                  }}>
                    <span style={{ color: 'white', fontSize: '1.5rem', fontWeight: 'bold' }}>
                      {index + 1}
                    </span>
                  </div>
                  <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', margin: 0 }}>
                    {(file.size / 1024).toFixed(0)} KB
                  </p>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button
                onClick={handleReset}
                style={{
                  padding: '1rem 2rem',
                  background: 'linear-gradient(135deg, #0A84FF 0%, #64D2FF 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.href = '/enroll'}
                style={{
                  padding: '1rem 2rem',
                  background: 'transparent',
                  color: 'rgba(255,255,255,0.7)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '12px',
                  fontSize: '1rem',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                Back to Enroll
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnrollmentTest;

