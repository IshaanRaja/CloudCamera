// S3 Configuration
export interface S3Config {
  endpoint: string;
  bucket: string;
  region: string;
  accessKey: string;
  secretKey: string;
}

// Media Item
export interface MediaItem {
  key: string;
  type: string;
  size: number;
  date: string;
  url: string;
  blob?: Blob;
  thumbnail?: string;
  duration?: number;
}
