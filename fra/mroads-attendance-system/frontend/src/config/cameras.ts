// Camera configuration for multi-camera surveillance system
export interface CameraConfig {
  id: string;
  name: string;
  type: 'local' | 'rtsp' | 'http';
  url?: string; // For RTSP/HTTP streams
  username?: string;
  password?: string;
  ip?: string;
  port?: number;
  enabled: boolean;
}

export const CAMERAS: CameraConfig[] = [
  {
    id: 'phone-entry',
    name: 'Phone 1 (Entry)',
    type: 'http',
    url: 'http://172.16.3.185:8080/video',
    enabled: true,
  },
  {
    id: 'phone-exit',
    name: 'Phone 2 (Exit)',
    type: 'http',
    url: 'http://172.16.3.199:8080/video',
    enabled: true,
  },
];

export const getCameraDisplayName = (cameraId: string): string => {
  const camera = CAMERAS.find(c => c.id === cameraId);
  return camera?.name || cameraId;
};

export const getCameraById = (cameraId: string): CameraConfig | undefined => {
  return CAMERAS.find(c => c.id === cameraId);
};

// Worker pool for parallel face recognition
export class FaceRecognitionWorkerPool {
  private workers: Worker[] = [];
  private taskQueue: Array<{ faceId: string; base64: string; resolve: (result: any) => void; reject: (err: Error) => void }> = [];
  private activeWorkers: number = 0;
  private maxWorkers: number = 3; // Max parallel recognitions

  constructor() {
    this.initWorkers();
  }

  private initWorkers() {
    // In production, create actual web workers for parallel processing
    // For now, we'll use async processing
  }

  async recognizeAsync(faceId: string, base64Image: string, cameraId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.taskQueue.push({ faceId, base64: base64Image, resolve, reject });
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.activeWorkers >= this.maxWorkers || this.taskQueue.length === 0) {
      return;
    }

    this.activeWorkers++;
    const task = this.taskQueue.shift();

    if (!task) {
      this.activeWorkers--;
      return;
    }

    try {
      const response = await fetch('http://localhost:8000/recognize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: task.base64 }),
      });

      const result = await response.json();
      task.resolve(result);
    } catch (err) {
      task.reject(err instanceof Error ? err : new Error(String(err)));
    } finally {
      this.activeWorkers--;
      this.processQueue();
    }
  }

  shutdown() {
    // Cleanup workers if needed
    this.workers.forEach(w => w.terminate());
    this.workers = [];
  }
}
