import { MediaItem, S3Config } from "./types";

// LocalStorage key for S3 config (still safe to store here)
const S3_CONFIG_KEY = 'cloud-camera-s3-config';

// Save/load S3 config in localStorage
export const saveS3Config = (config: S3Config): void => {
  localStorage.setItem(S3_CONFIG_KEY, JSON.stringify(config));
};

export const loadS3Config = (): S3Config | null => {
  const config = localStorage.getItem(S3_CONFIG_KEY);
  return config ? JSON.parse(config) : null;
};

// Open or upgrade IndexedDB
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('CloudCameraDB', 1);
    
    request.onerror = () => reject(new Error('Failed to open IndexedDB'));

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('mediaBlobs')) {
        db.createObjectStore('mediaBlobs', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('mediaBuffer')) {
        db.createObjectStore('mediaBuffer', { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
  });
};

// Save media item to buffer
export const saveMediaToLocalBuffer = async (media: MediaItem): Promise<void> => {
  const db = await openDB();
  const tx = db.transaction('mediaBuffer', 'readwrite');
  const store = tx.objectStore('mediaBuffer');
  store.put(media);
  await tx.complete;
};

// Get all buffered media items
export const getBufferedMedia = async (): Promise<MediaItem[]> => {
  const db = await openDB();
  const tx = db.transaction('mediaBuffer', 'readonly');
  const store = tx.objectStore('mediaBuffer');

  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result as MediaItem[]);
    request.onerror = () => reject(new Error("Failed to read media buffer"));
  });
};

// Remove all items from buffer
export const clearLocalBuffer = async (): Promise<void> => {
  const db = await openDB();
  const tx = db.transaction('mediaBuffer', 'readwrite');
  const store = tx.objectStore('mediaBuffer');
  store.clear();
  await tx.complete;
};

// Remove one item by key
export const removeFromLocalBuffer = async (key: string): Promise<void> => {
  const db = await openDB();
  const tx = db.transaction('mediaBuffer', 'readwrite');
  const store = tx.objectStore('mediaBuffer');
  store.delete(key);
  await tx.complete;
};

// Blob storage
export const storeMediaBlob = async (key: string, blob: Blob): Promise<void> => {
  const db = await openDB();
  const tx = db.transaction('mediaBlobs', 'readwrite');
  const store = tx.objectStore('mediaBlobs');
  store.put({ id: key, blob });
  await tx.complete;
};

export const getMediaBlob = async (key: string): Promise<Blob | null> => {
  const db = await openDB();
  const tx = db.transaction('mediaBlobs', 'readonly');
  const store = tx.objectStore('mediaBlobs');

  return new Promise((resolve, reject) => {
    const request = store.get(key);
    request.onsuccess = () => {
      const data = request.result;
      resolve(data ? data.blob : null);
    };
    request.onerror = () => reject(new Error('Failed to retrieve blob from IndexedDB'));
  });
};

