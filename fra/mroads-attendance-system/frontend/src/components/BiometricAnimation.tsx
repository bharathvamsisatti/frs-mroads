import React, { useEffect, useRef } from 'react';
import useColorMode from '../hooks/useColorMode';

interface BiometricAnimationProps {
  className?: string;
  type?: 'faceId' | 'scanning' | 'success' | 'error';
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
  color: string;
}

interface Blob {
  x: number;
  y: number;
  radius: number;
  vx: number;
  vy: number;
  targetRadius: number;
}

const BiometricAnimation: React.FC<BiometricAnimationProps> = ({ 
  className = '', 
  type = 'scanning' 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [colorMode] = useColorMode();
  const isDark = colorMode === 'dark';

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
    let animationId: number;

    // Theme-aware colors matching your Tailwind theme
    const getColors = () => {
      if (isDark) {
        return {
          bg: '#24303F',
          bgGradientStart: '#1A222C',
          bgGradientEnd: '#24303F',
          primary: '#3C50E0', // Your primary color
          primaryLight: '#5B6FE8',
          secondary: '#80CAEE', // Your secondary color
          accent: '#2563EB',
          text: '#E5E7EB',
          textSecondary: '#AEB7C0',
          glow: 'rgba(60, 80, 224, 0.3)',
          particle: 'rgba(128, 202, 238, 0.6)',
        };
      } else {
        return {
          bg: '#FFFFFF',
          bgGradientStart: '#F7F9FC',
          bgGradientEnd: '#EFF4FB',
          primary: '#3C50E0',
          primaryLight: '#5B6FE8',
          secondary: '#80CAEE',
          accent: '#2563EB',
          text: '#243C5A',
          textSecondary: '#64748B',
          glow: 'rgba(60, 80, 224, 0.2)',
          particle: 'rgba(128, 202, 238, 0.5)',
        };
      }
    };

    // Initialize floating particles
    const particles: Particle[] = [];
    const particleCount = 20;
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        radius: Math.random() * 3 + 1,
        opacity: Math.random() * 0.5 + 0.2,
        color: '',
      });
    }

    // Initialize morphing blobs
    const blobs: Blob[] = [];
    const blobCount = 3;
    for (let i = 0; i < blobCount; i++) {
      const angle = (i / blobCount) * Math.PI * 2;
      blobs.push({
        x: centerX + Math.cos(angle) * 60,
        y: centerY + Math.sin(angle) * 60,
        radius: 30 + Math.random() * 20,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        targetRadius: 30 + Math.random() * 20,
      });
    }

    const draw = () => {
      frame++;
      const colors = getColors();
      ctx.clearRect(0, 0, width, height);

      // Background gradient
      const bgGradient = ctx.createLinearGradient(0, 0, width, height);
      bgGradient.addColorStop(0, colors.bgGradientStart);
      bgGradient.addColorStop(1, colors.bgGradientEnd);
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, width, height);

      // Update and draw morphing blobs
      blobs.forEach((blob, i) => {
        // Smooth radius morphing
        blob.radius += (blob.targetRadius - blob.radius) * 0.05;
        if (Math.abs(blob.targetRadius - blob.radius) < 1) {
          blob.targetRadius = 30 + Math.random() * 20;
        }

        // Gentle floating movement
        blob.x += blob.vx;
        blob.y += blob.vy;

        // Boundary bounce
        if (blob.x < blob.radius || blob.x > width - blob.radius) blob.vx *= -1;
        if (blob.y < blob.radius || blob.y > height - blob.radius) blob.vy *= -1;

        // Keep blobs near center
        const dx = centerX - blob.x;
        const dy = centerY - blob.y;
        blob.vx += dx * 0.0005;
        blob.vy += dy * 0.0005;
        blob.vx *= 0.98;
        blob.vy *= 0.98;

        // Draw blob with gradient
        const blobGradient = ctx.createRadialGradient(
          blob.x,
          blob.y,
          0,
          blob.x,
          blob.y,
          blob.radius,
        );
        const alpha = type === 'success' ? 0.4 : type === 'error' ? 0.3 : 0.35;
        blobGradient.addColorStop(0, i === 0 ? colors.primary : colors.secondary);
        blobGradient.addColorStop(1, 'transparent');
        
        ctx.fillStyle = blobGradient;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(blob.x, blob.y, blob.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      });

      // Update and draw floating particles
      particles.forEach((particle) => {
        particle.x += particle.vx;
        particle.y += particle.vy;

        // Wrap around edges
        if (particle.x < 0) particle.x = width;
        if (particle.x > width) particle.x = 0;
        if (particle.y < 0) particle.y = height;
        if (particle.y > height) particle.y = 0;

        // Pulsing opacity
        particle.opacity = 0.2 + Math.sin(frame * 0.05 + particle.x * 0.01) * 0.3;

        ctx.fillStyle = colors.particle;
        ctx.globalAlpha = particle.opacity;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      });

      // Central animated circle with pulsing effect
      const pulse = Math.sin(frame * 0.03) * 0.2 + 0.8;
      const circleRadius = 50 + Math.sin(frame * 0.04) * 8;
      
      // Outer glow
      const glowGradient = ctx.createRadialGradient(
        centerX,
        centerY,
        circleRadius * 0.7,
        centerX,
        centerY,
        circleRadius * 1.5,
      );
      glowGradient.addColorStop(0, colors.primary);
      glowGradient.addColorStop(0.5, colors.secondary);
      glowGradient.addColorStop(1, 'transparent');
      
      ctx.fillStyle = glowGradient;
      ctx.globalAlpha = pulse * 0.4;
      ctx.beginPath();
      ctx.arc(centerX, centerY, circleRadius * 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Main circle
      const circleGradient = ctx.createRadialGradient(
        centerX,
        centerY,
        0,
        centerX,
        centerY,
        circleRadius,
      );
      circleGradient.addColorStop(0, colors.primaryLight);
      circleGradient.addColorStop(0.7, colors.primary);
      circleGradient.addColorStop(1, colors.secondary);
      
      ctx.fillStyle = circleGradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, circleRadius, 0, Math.PI * 2);
      ctx.fill();

      // Inner highlight
      ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.3)';
      ctx.beginPath();
      ctx.arc(centerX - circleRadius * 0.3, centerY - circleRadius * 0.3, circleRadius * 0.4, 0, Math.PI * 2);
      ctx.fill();

      // Rotating ring segments
      const rotationSpeed = 0.015;
      const ringRadius = circleRadius + 25;
      const segments = 12;
      
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(frame * rotationSpeed);
      
      for (let i = 0; i < segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        const startAngle = angle;
        const endAngle = angle + (Math.PI * 2 / segments) * 0.6;
        
        const segmentGradient = ctx.createLinearGradient(
          Math.cos(startAngle) * ringRadius,
          Math.sin(startAngle) * ringRadius,
          Math.cos(endAngle) * ringRadius,
          Math.sin(endAngle) * ringRadius,
        );
        segmentGradient.addColorStop(0, colors.primary);
        segmentGradient.addColorStop(1, colors.secondary);
        
        ctx.strokeStyle = segmentGradient;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(0, 0, ringRadius, startAngle, endAngle);
        ctx.stroke();
      }
      ctx.restore();

      // Scanning wave effect (for scanning type)
      if (type === 'scanning') {
        const waveOffset = (frame * 2) % (circleRadius * 3);
        const waveGradient = ctx.createLinearGradient(
          centerX - circleRadius * 1.5,
          centerY - circleRadius * 1.5 + waveOffset,
          centerX + circleRadius * 1.5,
          centerY - circleRadius * 1.5 + waveOffset + 30,
        );
        waveGradient.addColorStop(0, 'transparent');
        waveGradient.addColorStop(0.5, colors.secondary);
        waveGradient.addColorStop(1, 'transparent');
        
        ctx.fillStyle = waveGradient;
        ctx.globalAlpha = 0.4;
        ctx.fillRect(
          centerX - circleRadius * 1.5,
          centerY - circleRadius * 1.5,
          circleRadius * 3,
          circleRadius * 3,
        );
        ctx.globalAlpha = 1;
      }

      // Success checkmark animation
      if (type === 'success') {
        const checkProgress = Math.min(1, frame / 60);
        const checkSize = 30;
        const checkX = centerX;
        const checkY = centerY;
        
        ctx.strokeStyle = '#10B981';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        ctx.beginPath();
        ctx.moveTo(checkX - checkSize * 0.4, checkY);
        ctx.lineTo(
          checkX - checkSize * 0.1,
          checkY + checkSize * 0.3,
        );
        ctx.lineTo(
          checkX + checkSize * 0.4,
          checkY - checkSize * 0.2,
        );
        ctx.globalAlpha = checkProgress;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Error X animation
      if (type === 'error') {
        const errorProgress = Math.min(1, frame / 60);
        const errorSize = 25;
        const errorX = centerX;
        const errorY = centerY;
        
        ctx.strokeStyle = '#EF4444';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        
        ctx.globalAlpha = errorProgress;
        ctx.beginPath();
        ctx.moveTo(errorX - errorSize, errorY - errorSize);
        ctx.lineTo(errorX + errorSize, errorY + errorSize);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(errorX + errorSize, errorY - errorSize);
        ctx.lineTo(errorX - errorSize, errorY + errorSize);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      animationId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [isDark, type]);

  return (
    <div className={`relative ${className}`}>
      <canvas
        ref={canvasRef}
        width={400}
        height={400}
        className="w-full h-full rounded-xl transition-all duration-300"
        style={{ 
          background: 'transparent'
        }}
      />
    </div>
  );
};

export default BiometricAnimation;

