import { MediaItem, S3Config } from "./types";

// LocalStorage keys
const S3_CONFIG_KEY = 'cloud-camera-s3-config';
const MEDIA_BUFFER_KEY = 'cloud-camera-media-buffer';

// Save S3 configuration to localStorage
export const saveS3Config = (config: S3Config): void => {
  localStorage.setItem(S3_CONFIG_KEY, JSON.stringify(config));
};

// Load S3 configuration from localStorage
export const loadS3Config = (): S3Config | null => {
  const config = localStorage.getItem(S3_CONFIG_KEY);
  return config ? JSON.parse(config) : null;
};

// Save media item to local buffer for later upload
export const saveMediaToLocalBuffer = (media: MediaItem): void => {
  // Load existing buffer
  const existingBuffer = getBufferedMedia();
    
  // Add new media to buffer
  existingBuffer.push(media);
  
  // Store updated buffer
  localStorage.setItem(MEDIA_BUFFER_KEY, JSON.stringify(existingBuffer));
};

// Get all media items from local buffer
export const getBufferedMedia = (): MediaItem[] => {
  try {
    const buffer = localStorage.getItem(MEDIA_BUFFER_KEY);
    return buffer ? JSON.parse(buffer) : [];
  } catch (error) {
    console.error("Error loading media buffer:", error);
    return [];
  }
};

// Clear the local buffer after successful upload
export const clearLocalBuffer = (): void => {
  localStorage.removeItem(MEDIA_BUFFER_KEY);
};

// Remove a specific media item from the buffer
export const removeFromLocalBuffer = (key: string): void => {
  const buffer = getBufferedMedia();
  const updatedBuffer = buffer.filter(item => item.key !== key);
  localStorage.setItem(MEDIA_BUFFER_KEY, JSON.stringify(updatedBuffer));
};

// Using IndexedDB for larger blob storage
export const storeMediaBlob = async (key: string, blob: Blob): Promise<void> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('CloudCameraDB', 1);
    
    request.onerror = () => reject(new Error('Failed to open IndexedDB'));
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('mediaBlobs')) {
        db.createObjectStore('mediaBlobs', { keyPath: 'id' });
      }
    };
    
    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const transaction = db.transaction(['mediaBlobs'], 'readwrite');
      const store = transaction.objectStore('mediaBlobs');
      
      const storeRequest = store.put({ id: key, blob });
      
      storeRequest.onsuccess = () => resolve();
      storeRequest.onerror = () => reject(new Error('Failed to store blob in IndexedDB'));
    };
  });
};

// Retrieve a media blob from IndexedDB
export const getMediaBlob = async (key: string): Promise<Blob | null> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('CloudCameraDB', 1);
    
    request.onerror = () => reject(new Error('Failed to open IndexedDB'));
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('mediaBlobs')) {
        db.createObjectStore('mediaBlobs', { keyPath: 'id' });
      }
    };
    
    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const transaction = db.transaction(['mediaBlobs'], 'readonly');
      const store = transaction.objectStore('mediaBlobs');
      
      const getRequest = store.get(key);
      
      getRequest.onsuccess = () => {
        const data = getRequest.result;
        resolve(data ? data.blob : null);
      };
      
      getRequest.onerror = () => reject(new Error('Failed to retrieve blob from IndexedDB'));
    };
  });
};
