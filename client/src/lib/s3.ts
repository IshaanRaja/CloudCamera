import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  GetObjectCommand
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { MediaItem, S3Config } from "./types";
import { clearLocalBuffer } from "./storage";

// Create an S3 client
const createS3Client = (config: S3Config): S3Client => {
  return new S3Client({
    endpoint: config.endpoint,
    region: config.region, 
    requestChecksumCalculation: "WHEN_REQUIRED",
    credentials: {
      accessKeyId: config.accessKey,
      secretAccessKey: config.secretKey,
    },
    forcePathStyle: true, // Required for non-AWS S3 compatible services
  });
};

// Upload a single media item to S3
export const uploadMediaToS3 = async (
  media: MediaItem,
  config: S3Config,
): Promise<void> => {
  if (
    !config.endpoint.trim() ||
    !config.bucket.trim() ||
    !config.region.trim() ||
    !config.accessKey.trim() ||
    !config.secretKey.trim()
  ) {
    throw new Error("S3 configuration is incomplete");
  }

  const s3Client = createS3Client(config);

  // If it's a video, we also need to upload the thumbnail
  if (media.type.startsWith("video/") && media.thumbnail) {
    const thumbnailBlob = await fetch(media.thumbnail).then((r) => r.blob());
    const thumbnailKey = `${media.key.split(".")[0]}_thumbnail.jpg`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: thumbnailKey,
        Body: thumbnailBlob,
        ContentType: "image/jpeg",
        Metadata: {
          "original-media-key": media.key,
          "media-date": media.date,
          "media-type": "thumbnail",
        },
      }),
    );
  }

  // Upload the actual media file
  await s3Client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: media.key,
      Body: media.blob,
      ContentType: media.type,
      Metadata: {
        "media-date": media.date,
        "media-type": media.type.startsWith("video/") ? "video" : "image",
        ...(media.duration
          ? { "video-duration": media.duration.toString() }
          : {}),
      },
    }),
  );
};

// Upload buffered media to S3 and clear the buffer
export const uploadBufferedMediaToS3 = async (
  mediaItems: MediaItem[],
  config: S3Config,
): Promise<void> => {
  if (
    !config.endpoint.trim() ||
    !config.bucket.trim() ||
    !config.region.trim() ||
    !config.accessKey.trim() ||
    !config.secretKey.trim()
  ) {
    throw new Error("S3 configuration is incomplete");
  }

  // Upload each media item
  for (const media of mediaItems) {
    await uploadMediaToS3(media, config);
  }

  // Clear the local buffer after successful upload
  await clearLocalBuffer();
};

// Get a list of media items from S3
export const getMediaList = async (config: S3Config): Promise<MediaItem[]> => {
  if (
    !config.endpoint.trim() ||
    !config.bucket.trim() ||
    !config.region.trim() ||
    !config.accessKey.trim() ||
    !config.secretKey.trim()
  ) {
    throw new Error("S3 configuration is incomplete");
  }

  const s3Client = createS3Client(config);

  const response = await s3Client.send(
    new ListObjectsV2Command({
      Bucket: config.bucket,
    }),
  );

  if (!response.Contents) {
    return [];
  }

  // Filter out thumbnails
  const mainObjects = response.Contents.filter(
    (obj) => !obj.Key?.includes("_thumbnail"),
  );

  // Create a map of thumbnails
  const thumbnails = response.Contents.filter((obj) =>
    obj.Key?.includes("_thumbnail"),
  ).reduce(
    (acc, obj) => {
      if (obj.Key) {
        const originalKey = obj.Key.replace("_thumbnail.jpg", "");
        acc[originalKey] = obj.Key;
      }
      return acc;
    },
    {} as Record<string, string>,
  );

  // Convert S3 objects to MediaItems
  const mediaItems: MediaItem[] = await Promise.all(
    mainObjects.map(async (obj) => {
      if (!obj.Key) return null;

      const command = new GetObjectCommand({
            Bucket: config.bucket,
            Key: obj.Key
       });
      const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
      let thumbnail = url;
      // Check if there's a thumbnail for videos
      const keyWithoutExt = obj.Key.split(".")[0];
      if (thumbnails[keyWithoutExt]) {
        thumbnail = `${config.endpoint}/${config.bucket}/${thumbnails[keyWithoutExt]}`;
      }

      const isVideo = obj.Key.startsWith("video");

      return {
        key: obj.Key,
        type: isVideo ? "video/webm" : "image/jpeg",
        size: obj.Size || 0,
        date: obj.LastModified?.toISOString() || new Date().toISOString(),
        url: url,
        thumbnail: isVideo ? thumbnail: undefined,
      };
    }),
  );

  // Filter out any null items
  return mediaItems.filter(Boolean) as MediaItem[];
};

// Delete a media item from S3
export const deleteMediaFromS3 = async (
  media: MediaItem,
  config: S3Config,
): Promise<void> => {
  if (
    !config.endpoint.trim() ||
    !config.bucket.trim() ||
    !config.region.trim() ||
    !config.accessKey.trim() ||
    !config.secretKey.trim()
  ) {
    throw new Error("S3 configuration is incomplete");
  }

  const s3Client = createS3Client(config);

  // Delete the media file
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: config.bucket,
      Key: media.key,
    }),
  );

  // If it's a video, also delete the thumbnail
  if (media.type.startsWith("video/")) {
    const thumbnailKey = `${media.key.split(".")[0]}_thumbnail.jpg`;

    try {
      await s3Client.send(
        new DeleteObjectCommand({
          Bucket: config.bucket,
          Key: thumbnailKey,
        }),
      );
    } catch (error) {
      // Ignore errors if thumbnail doesn't exist
      console.warn("Could not delete thumbnail, it might not exist:", error);
    }
  }
};
