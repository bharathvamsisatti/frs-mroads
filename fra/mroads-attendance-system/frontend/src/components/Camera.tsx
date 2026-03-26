import { useRef, useState, useEffect, useImperativeHandle, forwardRef } from 'react';

interface CameraProps {
  onCapture: (file: File) => void;
  onClose?: () => void;
  multiple?: boolean;
  maxFiles?: number;
  className?: string;
  autoStart?: boolean; // Whether to start camera automatically
}

export interface CameraRef {
  stopCamera: () => void;
  startCamera: () => void;
}

const Camera = forwardRef<CameraRef, CameraProps>(({
  onCapture,
  onClose,
  multiple = false,
  maxFiles = 5,
  className = '',
  autoStart = false, // Default: don't start automatically
}, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [cameraStarted, setCameraStarted] = useState(false);
  const [error, setError] = useState<string>('');
  const [capturedImages, setCapturedImages] = useState<File[]>([]);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  useEffect(() => {
    // Only start if autoStart is true or camera was manually started
    if (autoStart || cameraStarted) {
      startCamera();
    }
    return () => {
      stopCamera();
    };
  }, [facingMode, autoStart, cameraStarted]);

  const startCamera = async () => {
    try {
      stopCamera(); // Stop any existing stream

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = mediaStream;
      setIsStreaming(true);
      setCameraStarted(true);
      setError('');

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      setError('Unable to access camera. Please check permissions.');
      setIsStreaming(false);
    }
  };

  const handleStartCamera = () => {
    setCameraStarted(true);
  };

  const stopCamera = () => {
    // Use ref to ensure we get the current stream value
    const currentStream = streamRef.current;
    if (currentStream) {
      currentStream.getTracks().forEach((track) => {
        track.stop();
      });
      streamRef.current = null;
      setIsStreaming(false);
      setCameraStarted(false);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // Expose stopCamera and startCamera methods to parent component
  useImperativeHandle(ref, () => ({
    stopCamera,
    startCamera: handleStartCamera,
  }));

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw the current video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert canvas to blob and create File
    canvas.toBlob(
      (blob) => {
        if (blob) {
          const timestamp = new Date().getTime();
          const file = new File([blob], `camera-capture-${timestamp}.jpg`, {
            type: 'image/jpeg',
          });

          if (multiple) {
            if (capturedImages.length < maxFiles) {
              const newImages = [...capturedImages, file];
              setCapturedImages(newImages);
              onCapture(file);
            } else {
              setError(`Maximum ${maxFiles} images allowed`);
            }
          } else {
            onCapture(file);
          }
        }
      },
      'image/jpeg',
      0.95
    );
  };

  const switchCamera = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  const removeCapturedImage = (index: number) => {
    const newImages = capturedImages.filter((_, i) => i !== index);
    setCapturedImages(newImages);
  };

  const handleClose = () => {
    stopCamera();
    if (onClose) {
      onClose();
    }
  };

  return (
    <div className={`relative ${className}`}>
      <div className="rounded-lg border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark p-4">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-black dark:text-white">
            Camera Capture
          </h3>
          <button
            onClick={handleClose}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-meta-4"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Video Preview */}
        <div className="relative mb-4 overflow-hidden rounded-lg bg-black" style={{ minHeight: '200px' }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="h-auto w-full"
          />
          {!isStreaming && !cameraStarted && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
              <div className="text-center text-white">
                <button
                  onClick={handleStartCamera}
                  className="flex flex-col items-center justify-center p-4 rounded-lg hover:bg-gray-800 transition"
                >
                  <svg
                    className="h-16 w-16 mb-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                  <p className="text-lg font-medium">Click to Start Camera</p>
                  <p className="text-sm text-gray-400 mt-1">Camera is off</p>
                </button>
              </div>
            </div>
          )}
          {!isStreaming && cameraStarted && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
              <div className="text-center text-white">
                <svg
                  className="mx-auto h-12 w-12 animate-pulse"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
                <p className="mt-2">Initializing camera...</p>
              </div>
            </div>
          )}
        </div>

        {/* Hidden Canvas */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Captured Images Preview (for multiple mode) */}
        {multiple && capturedImages.length > 0 && (
          <div className="mb-4">
            <p className="mb-2 text-sm text-bodydark2">
              Captured Images ({capturedImages.length}/{maxFiles})
            </p>
            <div className="flex flex-wrap gap-2">
              {capturedImages.map((img, index) => (
                <div key={index} className="relative">
                  <img
                    src={URL.createObjectURL(img)}
                    alt={`Capture ${index + 1}`}
                    className="h-20 w-20 rounded-lg object-cover"
                  />
                  <button
                    onClick={() => removeCapturedImage(index)}
                    className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white hover:bg-red-600"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={switchCamera}
            disabled={!isStreaming}
            className="rounded-lg border border-stroke bg-transparent px-4 py-2 text-sm font-medium text-black transition hover:bg-gray-50 disabled:opacity-50 dark:border-strokedark dark:text-white dark:hover:bg-meta-4"
            title="Switch Camera"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>

          <button
            onClick={capturePhoto}
            disabled={!isStreaming}
            className="flex h-14 w-14 items-center justify-center rounded-full border-4 border-white bg-primary shadow-lg transition hover:bg-opacity-90 disabled:opacity-50"
            title="Capture Photo"
          >
            <div className="h-12 w-12 rounded-full bg-primary"></div>
          </button>

          {multiple && (
            <button
              onClick={handleClose}
              disabled={capturedImages.length < 1}
              className="rounded-lg border border-primary bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-opacity-90 disabled:opacity-50"
            >
              Done ({capturedImages.length})
            </button>
          )}
        </div>

        {/* Instructions */}
        <p className="mt-4 text-center text-xs text-bodydark2">
          {multiple
            ? `Capture ${maxFiles} images. Click the camera button to capture each image.`
            : 'Click the camera button to capture a photo.'}
        </p>
      </div>
    </div>
  );
});

Camera.displayName = 'Camera';

export default Camera;

