# FTP Puller Service

This service monitors an FTP server for new face detection images and automatically processes them through your face recognition backend.

## Setup

1. **Install dependencies:**
   ```bash
   cd ftp-puller
   npm install
   ```

2. **Configure environment variables:**
   Edit `.env` file with your settings:
   ```
   FTP_HOST=172.16.2.64
   FTP_PORT=2121
   FTP_USERNAME=admin
   FTP_PASSWORD=admin
   FTP_REMOTE_DIR=/Picture/Face Detection/
   BACKEND_API_URL=https://dev-fra.mroads.com
   POLL_INTERVAL=30000
   ```

3. **Run the service:**
   ```bash
   npm start
   ```

## How it works

1. **Connects** to your FTP server using the provided credentials
2. **Monitors** the `/Picture/Face Detection/` directory for new image files
3. **Downloads** new images (JPG, JPEG, PNG only)
4. **Sends** each image to your backend's `/recognize` endpoint
5. **Tracks** processed files to avoid duplicates
6. **Repeats** every 30 seconds (configurable)

## Features

- **Automatic reconnection** if FTP connection fails
- **File deduplication** using timestamps and filenames
- **Error handling** with detailed logging
- **Graceful shutdown** on SIGINT/SIGTERM
- **Temporary file cleanup** after processing

## Output

- Successfully processed images will automatically create attendance records
- These records appear in your frontend:
  - **Attendance page** (live updates)
  - **Reports page** (detailed view)
  - **Dashboard** (statistics)

## Logs

The service provides detailed console logs:
- FTP connection status
- New file detection
- Download progress
- Backend API responses
- Error messages

## Troubleshooting

1. **Connection issues:** Verify FTP credentials and network access
2. **No new files:** Check if images are being added to the FTP directory
3. **Backend errors:** Ensure your `/recognize` endpoint is accessible
4. **Permission errors:** Make sure the service can write to its directory

## Integration

This service works independently of your frontend. Once running, it will:
- Continuously process new FTP images
- Update attendance records in your backend
- Your frontend will automatically show the updates via existing API polling
