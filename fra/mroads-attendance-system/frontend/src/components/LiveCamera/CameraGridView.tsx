import React, { useState, useRef, useCallback, useEffect } from 'react';
import { X } from 'lucide-react';
import { CAMERAS } from '../../config/cameras';
import LiveCamera, { LiveCameraRef } from './LiveCamera';
import ErrorBoundary from './ErrorBoundary';
import { MJPEGViewer } from './MJPEGViewer';

// Wrapper component to handle camera start/stop for grid view
interface LiveCameraWrapperProps {
  cameraId: string;
  mode: 'verify' | 'recognize';
  onMatchResult: (result: any) => void;
  onStartClick: (cameraId: string) => void;
  setCameraRef: (cameraId: string, ref: LiveCameraRef | null) => void;
}

const LiveCameraWrapper: React.FC<LiveCameraWrapperProps> = ({
  cameraId,
  mode,
  onMatchResult,
  onStartClick,
  setCameraRef
}) => {
  const cameraRef = useRef<LiveCameraRef>(null);
  
  // Safety check: Only allow local cameras to use LiveCameraWrapper
  const camera = CAMERAS.find(c => c.id === cameraId);
  if (!camera || camera.type !== 'local') {
    console.error(`LiveCameraWrapper should only be used for local cameras, not ${camera?.type || 'unknown'} camera: ${cameraId}`);
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 text-white p-4">
        <div className="text-center">
          <p className="text-sm text-red-400">Error: Invalid camera type for LiveCameraWrapper</p>
          <p className="text-xs text-bodydark2 mt-2">Camera ID: {cameraId}</p>
        </div>
      </div>
    );
  }

  return (
    <LiveCamera
      ref={(ref) => {
        // Fixed read-only property assignment
        cameraRef.current = ref as unknown as LiveCameraRef;
        setCameraRef(cameraId, ref);
      }}
      mode={mode}
      autoStart={false}
      onMatchResult={onMatchResult}
      cameraId={cameraId}
      compact={true}
      onStartRequest={() => onStartClick(cameraId)}
    />
  );
};

interface CameraGridViewProps {
  onMatchResult?: (result: { matched: boolean; confidence?: number; identity?: string; person?: any; cameraId?: string }) => void;
  autoStart?: boolean;
  mode?: 'verify' | 'recognize';
  isPaused?: boolean; // Add pause state prop
}

/**
 * CameraGridView displays all enabled cameras in a grid layout.
 * - Double-click on any camera stream to view it fullscreen
 * - Click back arrow in fullscreen to return to grid view
 */
export const CameraGridView: React.FC<CameraGridViewProps> = ({
  onMatchResult,
  autoStart = true,
  mode = 'recognize',
  isPaused = false
}) => {
  const [fullscreenCameraId, setFullscreenCameraId] = useState<string | null>(null);
  const cameraRefs = useRef<Map<string, LiveCameraRef>>(new Map());
  const [streamRefreshKey, setStreamRefreshKey] = useState<number>(0);
  
  // Generate MJPEG stream URL for continuous streaming (not frame polling)
  const getMJPEGStreamUrl = useCallback((cameraId: string) => {
    if (isPaused) {
      return ''; // Empty string pauses the stream
    }
    // Use hostname from window.location to support different environments
    const hostname = window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname;
    return `http://${hostname}:8000/api/stream/mjpeg/${cameraId}`;
  }, [isPaused]);
  
  // Force refresh streams when resuming
  useEffect(() => {
    if (!isPaused && autoStart) {
      // Increment refresh key to force all RTSP streams to reload
      setStreamRefreshKey(prev => prev + 1);
    }
  }, [isPaused, autoStart]);

  // Get all enabled cameras for grid display
  const enabledCameras = CAMERAS.filter(camera => camera.enabled);
  
  // Get local cameras - only one can be active at a time
  const localCameras = enabledCameras.filter(c => c.type === 'local');

  // Handle camera ref assignment
  const setCameraRef = useCallback((cameraId: string, ref: LiveCameraRef | null) => {
    if (ref) {
      cameraRefs.current.set(cameraId, ref);
    } else {
      cameraRefs.current.delete(cameraId);
    }
  }, []);

  // Handle camera start - only allow one local camera at a time
  const handleStartCamera = useCallback((cameraId: string) => {
    // If starting a local camera, stop other local cameras first
    const camera = enabledCameras.find(c => c.id === cameraId);
    if (camera?.type === 'local') {
      // Stop all other local cameras
      localCameras.forEach(localCam => {
        if (localCam.id !== cameraId) {
          const otherRef = cameraRefs.current.get(localCam.id);
          if (otherRef) {
            try {
              otherRef.stopCamera();
            } catch (err) {
              console.warn(`Error stopping camera ${localCam.id}:`, err);
            }
          }
        }
      });
    }
    
    // Start the selected camera
    const cameraRef = cameraRefs.current.get(cameraId);
    if (cameraRef) {
      cameraRef.startCamera();
    }
  }, [enabledCameras, localCameras]);

  // Auto-start all cameras when component mounts and autoStart is true
  useEffect(() => {
    if (autoStart && !isPaused) {
      // Start all cameras after a short delay to allow refs to be set
      const startTimer = setTimeout(() => {
        enabledCameras.forEach((camera) => {
          if (camera.type === 'local') {
            const cameraRef = cameraRefs.current.get(camera.id);
            if (cameraRef) {
              try {
                cameraRef.startCamera();
              } catch (err) {
                console.warn(`Error starting camera ${camera.id}:`, err);
              }
            }
          }
          // RTSP cameras start automatically via img src when not paused
        });
      }, 500);
      
      return () => clearTimeout(startTimer);
    } else if (isPaused) {
      // Stop all local cameras when paused
      enabledCameras.forEach((camera) => {
        if (camera.type === 'local') {
          const cameraRef = cameraRefs.current.get(camera.id);
          if (cameraRef) {
            try {
              cameraRef.stopCamera();
            } catch (err) {
              console.warn(`Error stopping camera ${camera.id}:`, err);
            }
          }
        }
      });
    }
  }, [autoStart, enabledCameras, isPaused]);

  // Stop all cameras when component unmounts or when switching cameras
  useEffect(() => {
    return () => {
      cameraRefs.current.forEach((ref) => {
        try {
          ref.stopCamera();
        } catch (err) {
          // Ignore errors during cleanup
        }
      });
    };
  }, []);

  // Handle double-click to enter fullscreen
  const handleDoubleClick = useCallback((cameraId: string) => {
    setFullscreenCameraId(cameraId);
  }, []);

  // Handle back button to exit fullscreen
  const handleBack = useCallback(() => {
    setFullscreenCameraId(null);
  }, []);

  // Handle ESC key to close modal
  useEffect(() => {
    if (fullscreenCameraId) {
      const handleEsc = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          handleBack();
        }
      };
      window.addEventListener('keydown', handleEsc);
      return () => window.removeEventListener('keydown', handleEsc);
    }
  }, [fullscreenCameraId, handleBack]);

  // Wrap match result to include camera ID
  const handleMatchResult = useCallback((cameraId: string) => (result: any) => {
    if (onMatchResult) {
      onMatchResult({
        ...result,
        cameraId
      });
    }
  }, [onMatchResult]);

  // If in fullscreen mode, show single camera as modal popup
  if (fullscreenCameraId) {
    const fullscreenCamera = enabledCameras.find(c => c.id === fullscreenCameraId);
    
    if (fullscreenCamera) {
      return (
        <>
          {/* Backdrop overlay */}
          <div 
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
            onClick={handleBack}
          />
          
          {/* Modal popup */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="relative w-full max-w-7xl h-full max-h-[90vh] bg-black rounded-lg shadow-2xl overflow-hidden">
              {/* Close Button - Top Right */}
              <button
                onClick={handleBack}
                className="absolute top-4 right-4 z-10 flex items-center justify-center w-10 h-10 bg-black/70 hover:bg-black/90 backdrop-blur-sm text-white rounded-full transition-all"
                aria-label="Close"
              >
                <X className="w-6 h-6" />
              </button>

              {/* Camera Name Header */}
              <div className="absolute top-4 left-4 z-10 px-4 py-2 bg-black/70 backdrop-blur-sm text-white rounded-lg">
                <p className="font-semibold text-lg">{fullscreenCamera.name}</p>
                {fullscreenCamera.type === 'rtsp' && (
                  <p className="text-xs text-bodydark2">RTSP: {fullscreenCamera.ip}:{fullscreenCamera.port}</p>
                )}
              </div>

              {/* Fullscreen Camera View */}
              <div className="w-full h-full flex items-center justify-center">
                <ErrorBoundary>
                  {fullscreenCamera.type === 'local' ? (
                    <div className="w-full h-full">
                      <LiveCamera
                        ref={(ref) => setCameraRef(fullscreenCameraId, ref)}
                        mode={mode}
                        autoStart={autoStart}
                        onMatchResult={handleMatchResult(fullscreenCameraId)}
                        cameraId={fullscreenCameraId}
                        compact={false}
                      />
                    </div>
                  ) : fullscreenCamera.type === 'rtsp' ? (
                <div className="w-full h-full flex items-center justify-center bg-gray-900">
                  {isPaused ? (
                    <div className="flex flex-col items-center justify-center h-full text-white">
                      <div className="text-center space-y-4">
                        <h3 className="text-2xl font-semibold">{fullscreenCamera.name}</h3>
                        <p className="text-bodydark">RTSP Camera: {fullscreenCamera.ip}:{fullscreenCamera.port}</p>
                        <p className="text-sm text-yellow-400">Stream paused</p>
                      </div>
                    </div>
                  ) : (
                    <MJPEGViewer
                      key={`fullscreen-${fullscreenCameraId}-${streamRefreshKey}`}
                      streamUrl={getMJPEGStreamUrl(fullscreenCameraId)}
                      cameraName={fullscreenCamera.name}
                      cameraIp={fullscreenCamera.ip || ''}
                      cameraPort={fullscreenCamera.port || 554}
                    />
                  )}
                </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full bg-gray-900 text-white">
                      <div className="text-center space-y-4">
                        <h3 className="text-2xl font-semibold">{fullscreenCamera.name}</h3>
                        <p className="text-bodydark">Camera Type: {fullscreenCamera.type}</p>
                        <p className="text-sm text-bodydark2 max-w-md">This camera type is not yet supported for live streaming.</p>
                      </div>
                    </div>
                  )}
                </ErrorBoundary>
              </div>
            </div>
          </div>
        </>
      );
    }
  }

  // Grid view - show all enabled cameras
  return (
    <div className="w-full">
      {enabledCameras.length === 0 ? (
        <div className="flex items-center justify-center h-64 bg-gray-100 rounded-lg">
          <p className="text-bodydark">No cameras enabled</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {enabledCameras.map((camera) => (
            <div
              key={camera.id}
              className="relative rounded-lg border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark overflow-hidden cursor-pointer hover:shadow-lg transition-shadow group"
              onDoubleClick={() => handleDoubleClick(camera.id)}
              title="Double-click to view fullscreen"
            >
              {/* Camera Label Overlay */}
              <div className="absolute top-2 left-2 z-10 px-2 py-1 bg-black/70 backdrop-blur-sm text-white text-xs font-medium rounded">
                {camera.name}
              </div>

              {/* Double-click hint */}
              <div className="absolute bottom-2 right-2 z-10 px-2 py-1 bg-black/50 backdrop-blur-sm text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity">
                Double-click for fullscreen
              </div>

              {/* Camera Stream */}
              <div className="relative bg-black aspect-video" onClick={(e) => e.stopPropagation()}>
                {/* Only use LiveCameraWrapper for local cameras - NEVER for RTSP */}
                {camera.type === 'local' ? (
                  <ErrorBoundary>
                    <LiveCameraWrapper
                      cameraId={camera.id}
                      mode={mode}
                      onMatchResult={handleMatchResult(camera.id)}
                      onStartClick={handleStartCamera}
                      setCameraRef={setCameraRef}
                    />
                  </ErrorBoundary>
                ) : camera.type === 'rtsp' ? (
                  <div className="relative w-full h-full">
                    {/* Continuous MJPEG Stream from backend - ONE connection, not polling */}
                    {isPaused ? (
                      <div className="flex flex-col items-center justify-center h-full bg-gray-900 text-white p-4">
                        <div className="text-center space-y-2">
                          <h4 className="font-semibold">{camera.name}</h4>
                          <p className="text-xs text-bodydark2">RTSP: {camera.ip}:{camera.port}</p>
                          <p className="text-xs text-yellow-400">Stream paused</p>
                        </div>
                      </div>
                    ) : (
                      <MJPEGViewer
                        key={`${camera.id}-${streamRefreshKey}`}
                        streamUrl={getMJPEGStreamUrl(camera.id)}
                        cameraName={camera.name}
                        cameraIp={camera.ip || ''}
                        cameraPort={camera.port || 554}
                      />
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full bg-gray-900 text-white p-4">
                    <div className="text-center space-y-2">
                      <h4 className="font-semibold">{camera.name}</h4>
                      <p className="text-xs text-bodydark2">Not supported for live streaming</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CameraGridView;
