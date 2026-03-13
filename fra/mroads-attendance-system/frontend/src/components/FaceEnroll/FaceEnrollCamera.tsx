/**
 * Face Enrollment Camera Component
 * Multi-image capture for enrollment (3-5 images)
 */

import { useRef, useState, forwardRef, useImperativeHandle } from 'react';
import FaceScanCamera, { FaceScanCameraRef } from './FaceScanCamera';

interface FaceEnrollCameraProps {
  onCapture?: (files: File[]) => void;
  onComplete?: (files: File[]) => void;
  onClose?: () => void;
  maxImages?: number;
  className?: string;
}

export interface FaceEnrollCameraRef {
  startCamera: () => void;
  stopCamera: () => void;
  reset: () => void;
  getFiles: () => File[];
}

const FaceEnrollCamera = forwardRef<FaceEnrollCameraRef, FaceEnrollCameraProps>(
  ({ onCapture, onComplete, onClose, maxImages = 5, className = '' }, ref) => {
    const faceScanRef = useRef<FaceScanCameraRef>(null);
    const [capturedFiles, setCapturedFiles] = useState<File[]>([]);
    const [currentCapture, setCurrentCapture] = useState(0);

    // Expose methods to parent
    useImperativeHandle(ref, () => ({
      startCamera: () => {
        faceScanRef.current?.startCamera();
      },
      stopCamera: () => {
        faceScanRef.current?.stopCamera();
      },
      reset: () => {
        setCapturedFiles([]);
        setCurrentCapture(0);
        faceScanRef.current?.reset();
      },
      getFiles: () => capturedFiles,
    }));

    const handleCapture = (file: File) => {
      const newFiles = [...capturedFiles, file];
      setCapturedFiles(newFiles);
      setCurrentCapture(currentCapture + 1);
      
      onCapture?.(newFiles);

      if (newFiles.length >= maxImages) {
        onComplete?.(newFiles);
      } else {
        // Reset for next capture
        setTimeout(() => {
          faceScanRef.current?.reset();
          faceScanRef.current?.startCamera();
        }, 500);
      }
    };

    const handleClose = () => {
      faceScanRef.current?.stopCamera();
      onClose?.();
    };

    return (
      <div className={`relative ${className}`}>
        <FaceScanCamera
          ref={faceScanRef}
          onCapture={handleCapture}
          onClose={handleClose}
          title={`Face Enrollment (${capturedFiles.length}/${maxImages})`}
        />
        
        {/* Progress indicator */}
        {capturedFiles.length > 0 && capturedFiles.length < maxImages && (
          <div className="absolute bottom-20 left-0 right-0 flex justify-center z-30">
            <div className="bg-black/70 backdrop-blur-md rounded-full px-6 py-3">
              <p className="text-white text-sm font-medium">
                {capturedFiles.length} of {maxImages} images captured
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }
);

FaceEnrollCamera.displayName = 'FaceEnrollCamera';

export default FaceEnrollCamera;

