/**
 * Face Angle Detection Utilities
 * Uses MediaPipe Face Mesh landmarks to calculate head pose angles
 */

// MediaPipe Face Mesh landmark indices
export const FACE_LANDMARKS = {
  NOSE_TIP: 1,
  NOSE_BRIDGE: 6,
  LEFT_EYE_OUTER: 33,
  RIGHT_EYE_OUTER: 263,
  LEFT_EYE_INNER: 133,
  RIGHT_EYE_INNER: 362,
  LEFT_MOUTH_CORNER: 61,
  RIGHT_MOUTH_CORNER: 291,
  CHIN: 152,
  FOREHEAD: 10,
  LEFT_CHEEK: 234,
  RIGHT_CHEEK: 454,
};

export interface FaceAngles {
  yaw: number;   // Left/Right rotation (-90 to +90)
  pitch: number; // Up/Down rotation (-90 to +90)
  roll: number;  // Tilt (-90 to +90)
}

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface EnrollmentStep {
  id: number;
  name: string;
  instruction: string;
  checkAngle: (angles: FaceAngles) => boolean;
}

// Enrollment steps configuration
export const ENROLLMENT_STEPS: EnrollmentStep[] = [
  {
    id: 0,
    name: 'front',
    instruction: 'Look straight ahead',
    checkAngle: (angles) => Math.abs(angles.yaw) < 12 && Math.abs(angles.pitch) < 10,
  },
  {
    id: 1,
    name: 'left',
    instruction: 'Turn your head left',
    checkAngle: (angles) => angles.yaw < -15 && angles.yaw > -45,
  },
  {
    id: 2,
    name: 'right',
    instruction: 'Turn your head right',
    checkAngle: (angles) => angles.yaw > 15 && angles.yaw < 45,
  },
  {
    id: 3,
    name: 'up',
    instruction: 'Look up slightly',
    checkAngle: (angles) => angles.pitch < -10 && angles.pitch > -35,
  },
  {
    id: 4,
    name: 'down',
    instruction: 'Look down slightly',
    checkAngle: (angles) => angles.pitch > 10 && angles.pitch < 35,
  },
];

/**
 * Calculate face angles from MediaPipe Face Mesh landmarks
 */
export function calculateFaceAngles(landmarks: Point3D[]): FaceAngles {
  if (!landmarks || landmarks.length < 468) {
    return { yaw: 0, pitch: 0, roll: 0 };
  }

  const noseTip = landmarks[FACE_LANDMARKS.NOSE_TIP];
  const leftEye = landmarks[FACE_LANDMARKS.LEFT_EYE_OUTER];
  const rightEye = landmarks[FACE_LANDMARKS.RIGHT_EYE_OUTER];
  const chin = landmarks[FACE_LANDMARKS.CHIN];
  const forehead = landmarks[FACE_LANDMARKS.FOREHEAD];

  // Calculate yaw (left/right rotation)
  // Using the horizontal position difference between eyes and nose
  const eyeCenter = {
    x: (leftEye.x + rightEye.x) / 2,
    y: (leftEye.y + rightEye.y) / 2,
    z: (leftEye.z + rightEye.z) / 2,
  };
  
  const eyeWidth = Math.abs(rightEye.x - leftEye.x);
  const noseOffset = noseTip.x - eyeCenter.x;
  const yaw = (noseOffset / eyeWidth) * 90; // Approximate yaw in degrees

  // Calculate pitch (up/down rotation)
  // Using vertical position of nose relative to face center
  const faceHeight = Math.abs(forehead.y - chin.y);
  const faceCenter = (forehead.y + chin.y) / 2;
  const noseVerticalOffset = noseTip.y - faceCenter;
  const pitch = (noseVerticalOffset / faceHeight) * 60; // Approximate pitch

  // Calculate roll (tilt)
  // Using the angle between eyes
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
 * Calculate face angles using simple 2D landmark analysis
 * Fallback for when 3D data is not available
 */
export function calculateFaceAngles2D(landmarks: { x: number; y: number }[]): FaceAngles {
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
 * Check if face is centered in frame
 */
export function isFaceCentered(landmarks: { x: number; y: number }[], tolerance = 0.2): boolean {
  if (!landmarks || landmarks.length === 0) return false;
  
  const noseTip = landmarks[FACE_LANDMARKS.NOSE_TIP];
  
  // Check if nose tip is within center region
  const centerX = 0.5;
  const centerY = 0.5;
  
  return (
    Math.abs(noseTip.x - centerX) < tolerance &&
    Math.abs(noseTip.y - centerY) < tolerance
  );
}

/**
 * Calculate face detection confidence based on landmark quality
 */
export function calculateFaceConfidence(landmarks: { x: number; y: number }[]): number {
  if (!landmarks || landmarks.length < 468) return 0;
  
  // Check if key landmarks are present and valid
  const keyPoints = [
    FACE_LANDMARKS.NOSE_TIP,
    FACE_LANDMARKS.LEFT_EYE_OUTER,
    FACE_LANDMARKS.RIGHT_EYE_OUTER,
    FACE_LANDMARKS.CHIN,
    FACE_LANDMARKS.FOREHEAD,
  ];
  
  let validPoints = 0;
  for (const idx of keyPoints) {
    const point = landmarks[idx];
    if (point && point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1) {
      validPoints++;
    }
  }
  
  return validPoints / keyPoints.length;
}

/**
 * Get angle match percentage for current step
 */
export function getAngleMatchPercentage(angles: FaceAngles, step: EnrollmentStep): number {
  switch (step.id) {
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

