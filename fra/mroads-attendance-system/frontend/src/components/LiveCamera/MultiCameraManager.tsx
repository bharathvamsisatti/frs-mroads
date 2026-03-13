import React, { useRef, useCallback, useEffect, useMemo } from 'react';
import { CAMERAS, getCameraById } from '../../config/cameras';
import LiveCamera, { LiveCameraRef } from './LiveCamera';
import ErrorBoundary from './ErrorBoundary';
import MJPEGViewer from './MJPEGViewer';

interface MultiCameraManagerProps {
  selectedCameraId: string;
  onMatchResult?: (result: { matched: boolean; confidence?: number; identity?: string; person?: any; cameraId?: string }) => void;
  autoStart?: boolean;
  mode?: 'verify' | 'recognize';
}

/**
 * MultiCameraManager handles switching between different camera sources
 * - Local camera (uses getUserMedia)
 * - IP cameras (uses server-side MJPEG proxy)
 */
export const MultiCameraManager: React.FC<MultiCameraManagerProps> = ({
  selectedCameraId,
  onMatchResult,
  autoStart = true,
  mode = 'recognize'
}) => {
  const cameraRef = useRef<LiveCameraRef>(null);

  // If "all" is selected, default to first enabled local camera for streaming
  const cameraIdToUse = useMemo(() => {
    if (selectedCameraId === "all") {
      const firstLocalCamera = CAMERAS.find(c => c.enabled && c.type === 'local');
      return firstLocalCamera?.id || CAMERAS.find(c => c.enabled)?.id || selectedCameraId;
    }
    return selectedCameraId;
  }, [selectedCameraId]);

  // Wrap match result to include camera ID
  const handleMatchResult = useCallback((result: any) => {
    if (onMatchResult) {
      onMatchResult({
        ...result,
        cameraId: cameraIdToUse !== "all" ? cameraIdToUse : selectedCameraId
      });
    }
  }, [cameraIdToUse, selectedCameraId, onMatchResult]);

  // Handle camera changes
  useEffect(() => {
    // When camera changes, reset the error state
  }, [selectedCameraId]);

  const selectedCamera = getCameraById(cameraIdToUse);

  if (!selectedCamera) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100 rounded-lg">
        <p className="text-bodydark">Select a camera to continue</p>
      </div>
    );
  }

  // For local cameras, use the standard LiveCamera component
  if (selectedCamera.type === 'local') {
    return (
      <ErrorBoundary>
        <LiveCamera
          ref={cameraRef}
          mode={mode}
          autoStart={autoStart}
          onMatchResult={handleMatchResult}
          cameraId={cameraIdToUse !== "all" ? cameraIdToUse : selectedCameraId}
        />
      </ErrorBoundary>
    );
  }

  // For RTSP cameras, display MJPEG stream from backend proxy using proper viewer
  if (selectedCamera.type === 'rtsp') {
    // Get backend URL
    const backendHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'localhost'
      : window.location.host.split(':')[0];
    const streamUrl = `http://${backendHost}:8000/api/stream/mjpeg/${selectedCamera.id}`;

    return (
      <ErrorBoundary>
        <MJPEGViewer
          streamUrl={streamUrl}
          cameraName={selectedCamera.name}
          cameraIp={selectedCamera.ip || 'N/A'}
          cameraPort={selectedCamera.port || 554}
          onError={() => console.error("Error occurred")}
        />
      </ErrorBoundary>
    );
  }

  return (
    <div className="flex items-center justify-center h-full bg-gray-100 rounded-lg">
      <p className="text-bodydark">Unknown camera type</p>
    </div>
  );
};

export default MultiCameraManager;
