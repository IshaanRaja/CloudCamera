// Capture a photo from video element
export const capturePicture = (videoElement: HTMLVideoElement): Promise<{ blob: Blob, dataUrl: string }> => {
  return new Promise((resolve, reject) => {
    try {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      // Set canvas size to match video dimensions
      canvas.width = videoElement.videoWidth;
      canvas.height = videoElement.videoHeight;
      
      // Draw the current video frame to the canvas
      if (context) {
        context.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
        
        // Convert canvas to data URL and blob
        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
        
        canvas.toBlob((blob) => {
          if (blob) {
            resolve({ blob, dataUrl });
          } else {
            reject(new Error('Failed to create blob from canvas'));
          }
        }, 'image/jpeg', 0.95);
      } else {
        reject(new Error('Failed to get canvas context'));
      }
    } catch (error) {
      reject(error);
    }
  });
};

// Start video recording
export const startRecording = (stream: MediaStream, onDataAvailable?: (chunk: BlobEvent) => void): Promise<MediaRecorder> => {
  return new Promise((resolve, reject) => {
    try {
      // Create media recorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9,opus'
      });
      
      // Set up event handlers
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && onDataAvailable) {
          onDataAvailable(event);
        }
      };
      
      mediaRecorder.onerror = (event) => {
        reject(new Error('MediaRecorder error: ' + event));
      };
      
      // Start recording with 100ms timeslice for regular ondataavailable events
      mediaRecorder.start(100);
      resolve(mediaRecorder);
    } catch (error) {
      reject(error);
    }
  });
};

// Stop video recording and get the resulting blob
export const stopRecording = (mediaRecorder: MediaRecorder): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    try {
      // Set up event handlers for when recording stops
      mediaRecorder.onstop = () => {
        // Assume chunks are collected externally via onDataAvailable
      };
      
      // If recording isn't active, reject
      if (mediaRecorder.state === 'inactive') {
        reject(new Error('MediaRecorder is not active'));
        return;
      }

      // Collect last chunks before stopping
      const chunks: Blob[] = [];
      
      const originalOnDataAvailable = mediaRecorder.ondataavailable;
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
        
        // Still call the original handler if it exists
        if (originalOnDataAvailable) {
          originalOnDataAvailable.call(mediaRecorder, event);
        }
      };
      
      // Handle stop event to resolve with the blob
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        resolve(blob);
      };
      
      // Stop recording
      mediaRecorder.stop();
    } catch (error) {
      reject(error);
    }
  });
};
