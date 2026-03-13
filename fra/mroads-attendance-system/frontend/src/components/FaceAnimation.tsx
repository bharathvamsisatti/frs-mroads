import React, { useEffect, useRef } from 'react';

interface FaceAnimationProps {
  className?: string;
}

const FaceAnimation: React.FC<FaceAnimationProps> = ({ className = '' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;

    let frame = 0;
    let scanY = 0;
    let scanDirection = 1;
    let animationId: number;

    const draw = () => {
      frame++;
      ctx.clearRect(0, 0, width, height);

      // Background - white with subtle blue gradient
      const bgGradient = ctx.createLinearGradient(0, 0, width, height);
      bgGradient.addColorStop(0, '#f0f7ff');
      bgGradient.addColorStop(1, '#e8f4fc');
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, width, height);

      // Face ID icon dimensions
      const iconSize = 140;
      const iconX = centerX - iconSize / 2;
      const iconY = centerY - iconSize / 2 - 10;
      const cornerRadius = 25;
      const cornerLength = 40;
      const lineWidth = 6;

      // Animated glow/pulse effect
      const pulseIntensity = Math.sin(frame * 0.04) * 0.2 + 0.8;
      
      // Main color - blue
      const mainColor = `rgba(59, 130, 246, ${pulseIntensity})`;
      const secondaryColor = `rgba(37, 99, 235, ${pulseIntensity})`;

      ctx.strokeStyle = mainColor;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // ============ CORNER BRACKETS (iOS Face ID style) ============
      
      // Top-left corner
      ctx.beginPath();
      ctx.moveTo(iconX, iconY + cornerLength);
      ctx.lineTo(iconX, iconY + cornerRadius);
      ctx.arcTo(iconX, iconY, iconX + cornerRadius, iconY, cornerRadius);
      ctx.lineTo(iconX + cornerLength, iconY);
      ctx.stroke();

      // Top-right corner
      ctx.beginPath();
      ctx.moveTo(iconX + iconSize - cornerLength, iconY);
      ctx.lineTo(iconX + iconSize - cornerRadius, iconY);
      ctx.arcTo(iconX + iconSize, iconY, iconX + iconSize, iconY + cornerRadius, cornerRadius);
      ctx.lineTo(iconX + iconSize, iconY + cornerLength);
      ctx.stroke();

      // Bottom-left corner
      ctx.beginPath();
      ctx.moveTo(iconX, iconY + iconSize - cornerLength);
      ctx.lineTo(iconX, iconY + iconSize - cornerRadius);
      ctx.arcTo(iconX, iconY + iconSize, iconX + cornerRadius, iconY + iconSize, cornerRadius);
      ctx.lineTo(iconX + cornerLength, iconY + iconSize);
      ctx.stroke();

      // Bottom-right corner
      ctx.beginPath();
      ctx.moveTo(iconX + iconSize - cornerLength, iconY + iconSize);
      ctx.lineTo(iconX + iconSize - cornerRadius, iconY + iconSize);
      ctx.arcTo(iconX + iconSize, iconY + iconSize, iconX + iconSize, iconY + iconSize - cornerRadius, cornerRadius);
      ctx.lineTo(iconX + iconSize, iconY + iconSize - cornerLength);
      ctx.stroke();

      // ============ FACE FEATURES (iOS style - simple and clean) ============
      
      ctx.strokeStyle = secondaryColor;
      ctx.fillStyle = secondaryColor;
      ctx.lineWidth = 5;

      // Eyes - simple vertical lines with dots
      const eyeY = iconY + 45;
      const leftEyeX = centerX - 28;
      const rightEyeX = centerX + 28;
      const eyeHeight = 20;

      // Left eye (vertical line with rounded ends)
      ctx.beginPath();
      ctx.moveTo(leftEyeX, eyeY);
      ctx.lineTo(leftEyeX, eyeY + eyeHeight);
      ctx.stroke();
      
      // Left eye dot
      ctx.beginPath();
      ctx.arc(leftEyeX - 8, eyeY + 5, 3, 0, Math.PI * 2);
      ctx.fill();

      // Right eye (vertical line with rounded ends)
      ctx.beginPath();
      ctx.moveTo(rightEyeX, eyeY);
      ctx.lineTo(rightEyeX, eyeY + eyeHeight);
      ctx.stroke();
      
      // Right eye dot
      ctx.beginPath();
      ctx.arc(rightEyeX + 8, eyeY + 5, 3, 0, Math.PI * 2);
      ctx.fill();

      // Nose - curved line
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(centerX, eyeY + 15);
      ctx.quadraticCurveTo(centerX + 8, eyeY + 35, centerX, eyeY + 50);
      ctx.stroke();

      // Mouth - smile curve
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(centerX, iconY + 85, 25, 0.15 * Math.PI, 0.85 * Math.PI, false);
      ctx.stroke();

      // ============ SCANNING ANIMATION ============
      scanY += scanDirection * 1.2;
      if (scanY > iconSize - 20 || scanY < 20) {
        scanDirection *= -1;
      }

      // Scanning line with gradient
      const scanGradient = ctx.createLinearGradient(iconX, iconY + scanY - 8, iconX, iconY + scanY + 8);
      scanGradient.addColorStop(0, 'rgba(59, 130, 246, 0)');
      scanGradient.addColorStop(0.5, 'rgba(59, 130, 246, 0.3)');
      scanGradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
      ctx.fillStyle = scanGradient;
      ctx.fillRect(iconX + 10, iconY + scanY - 8, iconSize - 20, 16);

      // ============ TEXT LABEL ============
      ctx.font = '600 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#3B82F6';
      ctx.fillText('Face ID', centerX, iconY + iconSize + 30);

      // Subtitle
      ctx.font = '400 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = '#6B7280';
      ctx.fillText('Secure Authentication', centerX, iconY + iconSize + 50);

      animationId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <div className={`relative ${className}`}>
      <canvas
        ref={canvasRef}
        width={280}
        height={280}
        className="w-full h-full rounded-xl"
        style={{ background: 'linear-gradient(135deg, #f0f7ff 0%, #e8f4fc 100%)' }}
      />
    </div>
  );
};

export default FaceAnimation;
