import React, { useEffect, useRef, useState } from 'react';

interface FramePollerProps {
  src: string;
  alt?: string;
  className?: string;
  streamUrl?: string; // Legacy prop
  cameraName?: string; // Legacy prop
  cameraIp?: string; // Legacy prop
  cameraPort?: number; // Legacy prop
  onError?: (error: string) => void;
  frameInterval?: number;
}

export const FramePoller: React.FC<FramePollerProps> = ({
  src,
  alt = 'Camera feed',
  className = '',
  streamUrl,
  cameraName,
  cameraIp,
  cameraPort,
  onError,
  frameInterval = 50  // Poll every 50ms for smoother streaming (20 FPS)
}) => {
  // Support both new (src) and legacy (streamUrl) props
  const actualStreamUrl = src || streamUrl || '';
  const actualCameraName = alt || cameraName || 'Camera';
  const imgRef = useRef<HTMLImageElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const frameCountRef = useRef(0);
  const intervalRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastUrlRef = useRef<string>('');

  useEffect(() => {
    const img = imgRef.current;
    if (!img || !actualStreamUrl) return;

    // Reset state when URL changes
    setIsLoading(true);
    setError('');
    frameCountRef.current = 0;

    // Cleanup previous polling
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    const pollFrame = async () => {
      try {
        // Add cache-busting timestamp to ensure fresh frames
        const timestamp = Date.now();
        const frameUrl = `${actualStreamUrl}?t=${timestamp}&_=${timestamp}`;
        
        const response = await fetch(frameUrl, {
          signal: abortControllerRef.current?.signal,
          cache: 'no-store', // Prevent browser caching
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        });

        if (!response.ok) {
          if (response.status === 404 || response.status === 503) {
            // Camera not ready yet, don't show error
            return;
          }
          throw new Error(`HTTP ${response.status}`);
        }

        const blob = await response.blob();
        
        // Only update if we got a valid image blob
        if (blob && blob.size > 0 && blob.type.startsWith('image/')) {
          // Always create new URL to force browser to reload image
          const url = URL.createObjectURL(blob);
          
          // Clean up previous URL after a short delay to ensure smooth transition
          if (lastUrlRef.current) {
            // Use setTimeout to revoke after new image loads
            setTimeout(() => {
              if (lastUrlRef.current && lastUrlRef.current !== url) {
                URL.revokeObjectURL(lastUrlRef.current);
              }
            }, 100);
          }
          lastUrlRef.current = url;

          // Force image reload by setting src to empty first, then to new URL
          img.onload = () => {
            frameCountRef.current += 1;
            if (frameCountRef.current === 1) {
              setIsLoading(false);
            }
            // Clear error on successful load
            setError('');
          };
          
          img.onerror = () => {
            URL.revokeObjectURL(url);
            setError('Failed to load frame');
          };
          
          // Force reload by clearing src first
          img.src = '';
          // Use requestAnimationFrame to ensure DOM update
          requestAnimationFrame(() => {
            img.src = url;
          });
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          const errMsg = (err as Error).message;
          setError(errMsg);
          onError?.(errMsg);
          setIsLoading(false);
        }
      }
    };

    // Start polling immediately, then at intervals
    pollFrame();
    intervalRef.current = window.setInterval(pollFrame, frameInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (lastUrlRef.current) {
        URL.revokeObjectURL(lastUrlRef.current);
        lastUrlRef.current = '';
      }
    };
  }, [actualStreamUrl, frameInterval, onError]);

  return (
    <div className={`relative w-full h-full bg-gray-900 rounded-lg overflow-hidden ${className}`}>
      <img
        ref={imgRef}
        alt={actualCameraName}
        className="w-full h-full object-contain"
        style={{ backgroundColor: '#111827' }}
      />

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-75">
          <div className="text-center text-white">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-3"></div>
            <p className="text-sm">Connecting...</p>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 bg-opacity-90 text-white">
          <div className="text-center space-y-2">
            <p className="text-red-400 font-semibold">Error</p>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}

      {!error && (cameraIp && cameraPort) && (
        <div className="absolute bottom-4 left-4 bg-gray-900 bg-opacity-75 text-white px-3 py-2 rounded text-sm pointer-events-none">
          <p className="font-semibold">{actualCameraName}</p>
          <p className="text-xs">RTSP: {cameraIp}:{cameraPort}</p>
        </div>
      )}

      {!error && !isLoading && (
        <div className="absolute top-4 right-4 flex items-center space-x-2 bg-green-500 bg-opacity-80 text-white px-3 py-1 rounded text-xs font-semibold pointer-events-none">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
          <span>LIVE</span>
        </div>
      )}
    </div>
  );
};

export default FramePoller;
