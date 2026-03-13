/**
 * Camera Feed Component
 * Isolated video rendering - no logic, just display
 */

import { forwardRef } from 'react';

interface CameraFeedProps {
  className?: string;
  onLoadedData?: () => void;
}

const CameraFeed = forwardRef<HTMLVideoElement, CameraFeedProps>(
  ({ className = '', onLoadedData }, ref) => {
    return (
      <video
        ref={ref}
        className={`w-full h-full object-cover transform scale-x-[-1] ${className}`}
        autoPlay
        playsInline
        muted
        onLoadedData={onLoadedData}
        onLoadedMetadata={onLoadedData}
        onCanPlay={onLoadedData}
        style={{ minHeight: '300px', display: 'block', backgroundColor: '#000' }}
      />
    );
  }
);

CameraFeed.displayName = 'CameraFeed';

export default CameraFeed;

