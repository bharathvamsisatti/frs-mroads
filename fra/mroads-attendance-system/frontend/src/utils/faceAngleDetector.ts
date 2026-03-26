/**
 * Face Angle Detector
 * Pure utility for calculating face angles from MediaPipe landmarks
 * No React dependencies - can run in Web Worker if needed
 */

export interface FaceAngles {
  yaw: number;   // Left/Right rotation (-90 to +90)
  pitch: number; // Up/Down rotation (-90 to +90)
  roll: number;  // Tilt (-90 to +90)
}

export interface Point2D {
  x: number;
  y: number;
}

const FACE_LANDMARKS = {
  NOSE_TIP: 1,
  LEFT_EYE_OUTER: 33,
  RIGHT_EYE_OUTER: 263,
  CHIN: 152,
  FOREHEAD: 10,
};

/**
 * Calculate face angles from 2D landmarks
 */
export function calculateFaceAngles(landmarks: Point2D[]): FaceAngles {
  if (!landmarks || landmarks.length < 468) {
    return { yaw: 0, pitch: 0, roll: 0 };
  }

  const noseTip = landmarks[FACE_LANDMARKS.NOSE_TIP];
  const leftEye = landmarks[FACE_LANDMARKS.LEFT_EYE_OUTER];
  const rightEye = landmarks[FACE_LANDMARKS.RIGHT_EYE_OUTER];
  const chin = landmarks[FACE_LANDMARKS.CHIN];
  const forehead = landmarks[FACE_LANDMARKS.FOREHEAD];

  // Eye center
  const eyeCenterX = (leftEye.x + rightEye.x) / 2;
  
  // Face dimensions
  const eyeWidth = Math.abs(rightEye.x - leftEye.x);
  const faceHeight = Math.abs(forehead.y - chin.y);
  
  // Yaw: horizontal offset of nose from eye center
  const noseOffsetX = noseTip.x - eyeCenterX;
  const yaw = (noseOffsetX / (eyeWidth * 0.5)) * 45;
  
  // Pitch: vertical position of nose tip
  const faceCenterY = (forehead.y + chin.y) / 2;
  const noseOffsetY = noseTip.y - faceCenterY;
  const pitch = (noseOffsetY / (faceHeight * 0.5)) * 30;
  
  // Roll: angle of eye line
  const eyeDeltaY = rightEye.y - leftEye.y;
  const eyeDeltaX = rightEye.x - leftEye.x;
  const roll = Math.atan2(eyeDeltaY, eyeDeltaX) * (180 / Math.PI);

  return {
    yaw: clamp(yaw, -90, 90),
    pitch: clamp(pitch, -90, 90),
    roll: clamp(roll, -90, 90),
  };
}

/**
 * Check if angles match enrollment step requirements
 */
export function checkAngleMatch(angles: FaceAngles, step: number): boolean {
  switch (step) {
    case 0: // Front
      return Math.abs(angles.yaw) < 12 && Math.abs(angles.pitch) < 10;
    case 1: // Left
      return angles.yaw < -15 && angles.yaw > -45;
    case 2: // Right
      return angles.yaw > 15 && angles.yaw < 45;
    case 3: // Up
      return angles.pitch < -10 && angles.pitch > -35;
    case 4: // Down
      return angles.pitch > 10 && angles.pitch < 35;
    default:
      return false;
  }
}

/**
 * Get angle match percentage (0-100)
 */
export function getAngleMatchPercentage(angles: FaceAngles, step: number): number {
  switch (step) {
    case 0: // Front
      return Math.max(0, 100 - (Math.abs(angles.yaw) + Math.abs(angles.pitch)) * 3);
    case 1: // Left
      if (angles.yaw > 0) return 0;
      return Math.min(100, Math.max(0, (-angles.yaw - 5) * 4));
    case 2: // Right
      if (angles.yaw < 0) return 0;
      return Math.min(100, Math.max(0, (angles.yaw - 5) * 4));
    case 3: // Up
      if (angles.pitch > 0) return 0;
      return Math.min(100, Math.max(0, (-angles.pitch - 5) * 5));
    case 4: // Down
      if (angles.pitch < 0) return 0;
      return Math.min(100, Math.max(0, (angles.pitch - 5) * 5));
    default:
      return 0;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

