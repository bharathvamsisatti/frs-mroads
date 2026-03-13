import React, { useEffect, useRef, useState } from 'react';

interface MJPEGViewerProps {
  streamUrl: string;
  cameraName: string;
  cameraIp: string;
  cameraPort: number;
  onError?: (error: string) => void;
}

/**
 * MJPEG Viewer component that properly handles MJPEG multipart streams
 * Fetches the MJPEG stream and renders frames to a canvas
 */
export const MJPEGViewer: React.FC<MJPEGViewerProps> = ({
  streamUrl,
  cameraName,
  cameraIp,
  cameraPort,
  onError
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const abortControllerRef = useRef<AbortController | null>(null);

  // Helper function to find byte sequence in buffer
  const findSequence = (buffer: Uint8Array, sequence: Uint8Array, startIndex: number = 0): number => {
    for (let i = startIndex; i <= buffer.length - sequence.length; i++) {
      let match = true;
      for (let j = 0; j < sequence.length; j++) {
        if (buffer[i + j] !== sequence[j]) {
          match = false;
          break;
        }
      }
      if (match) return i;
    }
    return -1;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      const errMsg = 'Failed to get canvas context';
      setError(errMsg);
      onError?.(errMsg);
      return;
    }

    // Create abort controller for cleanup
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    const startStream = async () => {
      try {
        setIsLoading(true);
        setError('');

        console.log(`[MJPEG] Connecting to: ${streamUrl}`);

        const response = await fetch(streamUrl, { signal });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        if (!response.body) {
          throw new Error('No response body');
        }

        const reader = response.body.getReader();
        let buffer = new Uint8Array(0);
        let frameCount = 0;

        // Boundary marker for MJPEG frames (as bytes)
        const boundaryMarker = new TextEncoder().encode('--frame');
        const jpegStartMarker = new Uint8Array([0xFF, 0xD8]); // JPEG start
        const jpegEndMarker = new Uint8Array([0xFF, 0xD9]); // JPEG end

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // Append new data to buffer
          const newBuffer = new Uint8Array(buffer.length + value.length);
          newBuffer.set(buffer);
          newBuffer.set(value, buffer.length);
          buffer = newBuffer;

          // Look for frame boundaries
          let boundaryIndex = findSequence(buffer, boundaryMarker);
          while (boundaryIndex !== -1) {
            // Find JPEG start after boundary
            const jpegStartIndex = findSequence(buffer, jpegStartMarker, boundaryIndex);
            if (jpegStartIndex === -1) {
              buffer = buffer.slice(boundaryIndex + boundaryMarker.length);
              boundaryIndex = findSequence(buffer, boundaryMarker);
              continue;
            }

            // Find JPEG end
            const jpegEndIndex = findSequence(buffer, jpegEndMarker, jpegStartIndex);
            if (jpegEndIndex === -1) {
              // Need more data
              break;
            }

            // Extract JPEG data (including end marker)
            const jpegData = buffer.slice(jpegStartIndex, jpegEndIndex + 2);
            buffer = buffer.slice(jpegEndIndex + 2);

            // Create blob and render
            try {
              const blob = new Blob([jpegData], { type: 'image/jpeg' });
              const url = URL.createObjectURL(blob);

              const img = new Image();
              img.onload = () => {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                URL.revokeObjectURL(url);
                frameCount++;
                if (frameCount === 1) {
                  setIsLoading(false);
                }
              };
              img.onerror = () => {
                URL.revokeObjectURL(url);
              };
              img.src = url;
            } catch (e) {
              console.error('[MJPEG] Error processing JPEG frame:', e);
            }

            boundaryIndex = findSequence(buffer, boundaryMarker);
          }
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          const errMsg = `Stream error: ${(err as Error).message}`;
          console.error('[MJPEG]', errMsg);
          setError(errMsg);
          onError?.(errMsg);
          setIsLoading(false);
        }
      }
    };

    startStream();

    // Cleanup on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [streamUrl, onError]);

  return (
    <div className="relative w-full h-full bg-gray-900 rounded-lg overflow-hidden flex flex-col items-center justify-center">
      {/* Canvas for MJPEG rendering */}
      <canvas
        ref={canvasRef}
        className="w-full h-full object-contain"
        style={{ backgroundColor: '#111827' }}
      />

      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-75">
          <div className="text-center text-white">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-3"></div>
            <p className="text-sm">Connecting to {cameraName}...</p>
          </div>
        </div>
      )}

      {/* Error overlay */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 bg-opacity-90 text-white">
          <div className="text-center space-y-4">
            <p className="text-red-400 text-lg font-semibold">⚠️ Stream Error</p>
            <p className="text-sm text-bodydark2 max-w-md">{error}</p>
            <p className="text-xs text-bodydark2">
              {cameraName} ({cameraIp}:{cameraPort})
            </p>
          </div>
        </div>
      )}

      {/* Camera info overlay (bottom-left) */}
      {!error && (
        <div className="absolute bottom-4 left-4 bg-gray-900 bg-opacity-75 text-white px-3 py-2 rounded text-sm pointer-events-none">
          <p className="font-semibold">{cameraName}</p>
          <p className="text-xs text-bodydark2">RTSP: {cameraIp}:{cameraPort}</p>
        </div>
      )}

      {/* Live indicator */}
      {!error && !isLoading && (
        <div className="absolute top-4 right-4 flex items-center space-x-2 bg-green-500 bg-opacity-80 text-white px-3 py-1 rounded text-xs font-semibold">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
          <span>LIVE</span>
        </div>
      )}
    </div>
  );
};

export default MJPEGViewer;
