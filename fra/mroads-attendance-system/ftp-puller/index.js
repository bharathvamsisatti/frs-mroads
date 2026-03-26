const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const fs = require('fs');
const ftp = require('basic-ftp');
const axios = require('axios');
const FormData = require('form-data');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');

// Database path - dedicated attendance database (separate from user enrollment data)
const ATTENDANCE_DB_PATH = path.join(__dirname, '..', 'backend', 'attendance.db');
const CAPTURED_IMAGES_DIR = path.join(__dirname, '..', 'backend', 'captured_images');

// Ensure captured images directory exists
if (!fs.existsSync(CAPTURED_IMAGES_DIR)) {
  fs.mkdirSync(CAPTURED_IMAGES_DIR, { recursive: true });
  console.log('✓ Created captured_images directory');
}

class FTPPuller {
  constructor() {
    this.client = new ftp.Client();
    this.processedFiles = new Set();
    this.processedFilesPath = path.join(__dirname, 'processed_files.json');

    // Load previously processed files
    this.loadProcessedFiles();

    // Initialize attendance database
    this.initializeAttendanceDatabase();
  }

  initializeAttendanceDatabase() {
    const db = new sqlite3.Database(ATTENDANCE_DB_PATH, (err) => {
      if (err) {
        console.error('Error opening attendance database:', err);
        return;
      }

      // Create attendance transactions table if it doesn't exist
      const createTableQuery = `
        CREATE TABLE IF NOT EXISTS attendance_transactions (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          person_id TEXT NOT NULL,
          status TEXT NOT NULL,
          confidence REAL,
          camera_name TEXT,
          matching_mode TEXT,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          image_url TEXT,
          captured_image_url TEXT
        )
      `;

      db.run(createTableQuery, (err) => {
        if (err) {
          console.error('Error creating attendance_transactions table:', err);
        } else {
          console.log('✓ Attendance database initialized');
        }
        // Run migration after table creation
        this.migrateDatabase();
      });
    });
  }

  migrateDatabase() {
    const db = new sqlite3.Database(ATTENDANCE_DB_PATH, (err) => {
      if (err) {
        console.error('Error opening database for migration:', err);
        return;
      }

      // Add captured_image_url column if it doesn't exist
      db.all("PRAGMA table_info(attendance_transactions)", (err, rows) => {
        if (err) {
          console.error('Error checking table schema:', err);
          db.close();
          return;
        }

        const hasColumn = rows.some(row => row.name === 'captured_image_url');
        if (!hasColumn) {
          const addColumnQuery = `ALTER TABLE attendance_transactions ADD COLUMN captured_image_url TEXT`;
          db.run(addColumnQuery, (err) => {
            if (err) {
              console.error('Error adding captured_image_url column:', err);
            } else {
              console.log('✓ Added captured_image_url column to attendance_transactions');
            }
            db.close();
          });
        } else {
          console.log('✓ captured_image_url column already exists');
          db.close();
        }
      });
    });
  }

  async loadProcessedFiles() {
    try {
      if (fs.existsSync(this.processedFilesPath)) {
        const data = fs.readFileSync(this.processedFilesPath, 'utf8');
        const files = JSON.parse(data);
        this.processedFiles = new Set(files);
        console.log(`Loaded ${this.processedFiles.size} processed files from disk`);
      }
    } catch (error) {
      console.error('Error loading processed files:', error);
    }
  }

  saveProcessedFiles() {
    try {
      const filesArray = Array.from(this.processedFiles);
      fs.writeFileSync(this.processedFilesPath, JSON.stringify(filesArray, null, 2));
    } catch (error) {
      console.error('Error saving processed files:', error);
    }
  }

  async connectToFtp() {
    try {
      await this.client.access({
        host: process.env.FTP_HOST,
        port: parseInt(process.env.FTP_PORT) || 2121,
        user: process.env.FTP_USERNAME,
        password: process.env.FTP_PASSWORD
      });
      console.log('Connected to FTP server successfully');
    } catch (error) {
      console.error('FTP connection failed:', error);
      throw error;
    }
  }

  async listRemoteFiles() {
    try {
      // Get today's date in YYYYMMDD format
      const today = new Date();
      const dateStr = today.getFullYear().toString() +
        (today.getMonth() + 1).toString().padStart(2, '0') +
        today.getDate().toString().padStart(2, '0');

      const baseDir = process.env.FTP_REMOTE_DIR || '/Picture/Face Detection/';
      const todayDir = path.posix.join(baseDir, dateStr);

      console.log(`Today's date: ${dateStr}`);
      console.log(`Looking for files in: ${todayDir}`);

      // Navigate to today's date directory
      await this.client.cd(todayDir);
      const files = await this.client.list();

      console.log(`Total files found in directory: ${files.length}`);
      files.forEach(file => {
        console.log(`  - ${file.name} (type: ${file.type === 1 ? 'file' : 'directory'})`);
      });

      // Filter for image files
      const imageFiles = files.filter(file =>
        file.type === 1 && // File (not directory)
        (file.name.toLowerCase().endsWith('.jpg') ||
          file.name.toLowerCase().endsWith('.jpeg') ||
          file.name.toLowerCase().endsWith('.png'))
      );

      console.log(`Found ${imageFiles.length} image files in ${dateStr}`);
      return imageFiles;
    } catch (error) {
      console.log(`Today's directory not found or accessible on FTP: ${error.message}`);
      return [];
    }
  }

  async downloadAndProcessFile(fileInfo) {
    const fileName = fileInfo.name;
    const fileKey = `${fileName}_${fileInfo.modifiedTime}`;

    // Skip if already processed
    if (this.processedFiles.has(fileKey)) {
      return;
    }

    let localPath = null;
    try {
      console.log(`Processing new file: ${fileName}`);

      // Download file to temporary location
      localPath = path.join(__dirname, 'temp', fileName);

      // Ensure temp directory exists
      const tempDir = path.join(__dirname, 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Download the file
      await this.client.downloadTo(localPath, fileName);
      console.log(`Downloaded: ${fileName}`);

      // Send to backend for recognition
      const backendResponse = await this.sendToBackend(localPath, fileName);

      // Only mark as processed if backend call was successful
      if (backendResponse) {
        this.processedFiles.add(fileKey);
        this.saveProcessedFiles();
        console.log(`✅ Marked as processed: ${fileName}`);
      }

    } catch (error) {
      console.error(`❌ Error processing file ${fileName}:`, error.message);
      // Don't mark as processed on error, so it will be retried
    } finally {
      // Clean up temporary file
      if (localPath && fs.existsSync(localPath)) {
        try {
          fs.unlinkSync(localPath);
        } catch (cleanupError) {
          console.error(`Error cleaning up temp file ${localPath}:`, cleanupError.message);
        }
      }
    }
  }

  async sendToBackend(filePath, fileName) {
    try {
      // Read file and convert to base64
      const imageBuffer = fs.readFileSync(filePath);
      const base64Image = imageBuffer.toString('base64');

      // Extract camera info from filename
      const cameraName = fileName.includes('CH1_') ? 'Camera 1' : 'Unknown Camera';
      const matchingMode = '1:N'; // Default to 1:N for face recognition

      const response = await axios.post(
        `${process.env.BACKEND_API_URL}/recognize`,
        {
          content: base64Image,
          camera_name: cameraName,
          matching_mode: matchingMode
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 90000,
        }
      );

      console.log(`Backend response for ${fileName}:`, response.data);

      // Check if recognition was successful and log appropriate message
      if (response.data.message && response.data.message.toLowerCase().includes('found')) {
        console.log(`✅ User recognized in ${fileName}: ${response.data.message}`);
        if (response.data.person) {
          console.log(`   User: ${response.data.person.name || response.data.person.user_id}`);
        }
      } else {
        console.log(`⚠️  Face detected but user not recognized in ${fileName}: ${response.data.message || 'Unknown response'}`);
      }

      // After getting recognition from external API, save attendance to local database
      await this.saveAttendanceLocally(response.data, fileName, cameraName, matchingMode, base64Image);

      return response.data;
    } catch (error) {
      console.error(`❌ Error sending ${fileName} to backend:`, error.response?.data || error.message);
      throw error; // Re-throw to mark processing as failed
    }
  }

  async saveAttendanceLocally(recognitionData, fileName, cameraName, matchingMode, base64Image) {
    try {
      // Decide which matches to process
      const matchesToProcess = recognitionData.matches && recognitionData.matches.length > 0
        ? recognitionData.matches
        : [];

      if (matchesToProcess.length === 0) {
        console.log(`⚠️  No face to record attendance for ${fileName}`);
        return;
      }

      for (const match of matchesToProcess) {
        const isUnknown = !match.identity || match.identity.toLowerCase().includes('unknown');

        // ✅ CRITICAL FIX: Only save attendance for RECOGNIZED users, not unknowns
        if (isUnknown) {
          console.log(`⏭️  Skipping unknown face for attendance recording`);
          continue;
        }

        const status = 'success';
        const userId = match.user_id || null;
        const personId = match.identity;
        const confidence = match.average_score || 0.95;
        const enrolledImageUrl = match.image_url || '';
        const transactionId = uuidv4();

        // Save captured image to disk individually for each detected face
        let capturedImageUrl = '';
        if (base64Image) {
          try {
            const imageBuffer = Buffer.from(base64Image, 'base64');
            const imagePath = path.join(CAPTURED_IMAGES_DIR, `${transactionId}.jpg`);
            fs.writeFileSync(imagePath, imageBuffer);
            capturedImageUrl = `/captured_images/${transactionId}.jpg`;
          } catch (imageError) {
            console.warn(`⚠️  Failed to save captured image:`, imageError.message);
          }
        }

        // Detailed logging
        console.log(`[DB] Processing attendance face - Status: ${status}, Person: ${personId}, Score: ${confidence.toFixed(2)}`);

        // Save directly to database
        await this.saveToDatabase({
          id: transactionId,
          user_id: userId,
          person_id: personId,
          status: status,
          confidence: confidence,
          camera_name: cameraName,
          matching_mode: matchingMode,
          image_url: enrolledImageUrl,
          captured_image_url: capturedImageUrl,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error(`⚠️  Could not save attendance:`, error.message);
      // Don't throw - this is a non-critical operation
    }
  }

  saveToDatabase(transactionData) {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(ATTENDANCE_DB_PATH, (err) => {
        if (err) {
          console.error(`❌ Error opening attendance database:`, err.message);
          reject(err);
          return;
        }

        const query = `
          INSERT INTO attendance_transactions (id, user_id, person_id, status, confidence, camera_name, matching_mode, timestamp, image_url, captured_image_url)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        db.run(query, [
          transactionData.id,
          transactionData.user_id,
          transactionData.person_id,
          transactionData.status,
          transactionData.confidence,
          transactionData.camera_name,
          transactionData.matching_mode,
          transactionData.timestamp,
          transactionData.image_url,
          transactionData.captured_image_url
        ], function (err) {
          db.close();

          if (err) {
            console.error(`❌ Error saving to attendance database:`, err.message);
            reject(err);
          } else {
            const personDisplay = transactionData.person_id !== 'Unknown User' ? transactionData.person_id : 'Unknown User';
            console.log(`✅ Attendance saved to database for ${personDisplay}: ${transactionData.id.substring(0, 8)}...`);
            resolve(transactionData.id);
          }
        });
      });
    });
  }

  async pollAndProcess() {
    try {
      console.log('Checking for new files...');

      // Connect to FTP
      await this.connectToFtp();

      // List remote files
      const files = await this.listRemoteFiles();
      console.log(`Found ${files.length} image files`);

      // Filter for truly new files (not processed before)
      const newFiles = files.filter(file => {
        const fileKey = `${file.name}_${file.modifiedTime}`;
        return !this.processedFiles.has(fileKey);
      });

      console.log(`Found ${newFiles.length} new (unprocessed) files`);

      if (newFiles.length === 0) {
        console.log('No new files to process');
        return;
      }

      // Sort new files by modification time (newest first) and get only the last 2 newly added
      const sortedNewFiles = newFiles.sort((a, b) => new Date(b.modifiedTime) - new Date(a.modifiedTime));
      const maxFiles = parseInt(process.env.MAX_FILES_TO_PROCESS) || 2;
      const filesToProcess = sortedNewFiles.slice(0, maxFiles);

      console.log(`Processing the newest ${filesToProcess.length} newly added files:`);
      filesToProcess.forEach((file, index) => {
        console.log(`  ${index + 1}. ${file.name} (modified: ${file.modifiedTime})`);
      });

      // Process only the newest 2 newly added files
      for (const file of filesToProcess) {
        await this.downloadAndProcessFile(file);
      }

      console.log('Polling cycle completed');
    } catch (error) {
      console.error('Error during polling:', error);
    } finally {
      // Close FTP connection
      try {
        this.client.close();
      } catch (error) {
        console.error('Error closing FTP connection:', error);
      }
    }
  }

  start() {
    console.log('Starting FTP Puller Service...');
    console.log(`FTP Server: ${process.env.FTP_HOST}:${process.env.FTP_PORT}`);
    console.log(`Remote Directory: ${process.env.FTP_REMOTE_DIR}`);
    console.log(`Backend API: ${process.env.BACKEND_API_URL}`);
    console.log(`Poll Interval: ${process.env.POLL_INTERVAL}ms`);
    console.log(`Max Files to Process: ${process.env.MAX_FILES_TO_PROCESS || 2}`);
    console.log('---');

    // Initial run
    this.pollAndProcess();

    // Set up periodic polling
    const interval = parseInt(process.env.POLL_INTERVAL) || 30000;
    setInterval(() => {
      this.pollAndProcess();
    }, interval);
  }
}

// Start the service
const puller = new FTPPuller();
puller.start();

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down FTP Puller...');
  puller.client.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down FTP Puller...');
  puller.client.close();
  process.exit(0);
});
