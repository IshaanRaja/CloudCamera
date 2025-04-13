import { useState, useEffect } from "react";
import { uploadMediaToS3, uploadBufferedMediaToS3 } from "@/lib/s3";
import { saveMediaToLocalBuffer, getBufferedMedia } from "@/lib/storage";
import { MediaItem, S3Config } from "@/lib/types";

interface CameraProps {
  isConnected: boolean;
  s3Config: S3Config;
  onAddPendingUpload: (media: MediaItem) => void;
  showErrorToast: (message: string) => void;
}

export default function Camera({ isConnected, s3Config, onAddPendingUpload, showErrorToast }: CameraProps) {
  const [lastThumbnail, setLastThumbnail] = useState<string | null>(null);
  const [cameraMode, setCameraMode] = useState<"photo" | "video">("photo");

  // Handle media capture from input
  const handleCapture = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.readAsDataURL(file);
    
    const base64String: string = await new Promise((resolve) => {
      reader.onloadend = () => resolve(reader.result as string);
    });
    
    setLastThumbnail(base64String);
    
    const now = new Date();
    const filename = `${cameraMode}_${now.getTime()}.${file.type.split("/")[1]}`;
    const mediaItem: MediaItem = {
      key: filename,
      type: file.type,
      size: file.size,
      date: now.toISOString(),
      blob: file,
    };

    // Upload if connected, otherwise store locally
    if (isConnected && s3Config.bucket) {
      try {
        await uploadMediaToS3(mediaItem, s3Config);
      } catch (error) {
        console.error("Failed to upload to S3:", error);
        await saveMediaToLocalBuffer(mediaItem);
        onAddPendingUpload(mediaItem);
        showErrorToast("Media will be uploaded when connection is available");
      }
    } else {
      await saveMediaToLocalBuffer(mediaItem);
      onAddPendingUpload(mediaItem);
      showErrorToast("Media saved locally. Will upload when connected.");
    }
  };

   // Upload any media that was saved when offline
   const uploadBufferedMedia = async () => {
     if (!isConnected || !s3Config.bucket) return;

     try {
       const bufferedMedia = await getBufferedMedia();
       if (bufferedMedia.length > 0) {
         await uploadBufferedMediaToS3(bufferedMedia, s3Config);
       }
     } catch (error) {
       console.error("Failed to upload buffered media:", error);
       showErrorToast("Failed to upload some media items");
     }
   };

   useEffect(() => {
     if (isConnected) {
       uploadBufferedMedia();
     }
   }, [isConnected, s3Config]);

  return (
    <div className="h-full flex flex-col items-center justify-center p-4">
      <input
        type="file"
        accept={cameraMode === "photo" ? "image/*" : "video/*"}
        capture={cameraMode === "photo" ? "environment" : "user"}
        className="hidden"
        id="cameraInput"
        onChange={handleCapture}
      />
      
      <label htmlFor="cameraInput" className="cursor-pointer w-20 h-20 rounded-full border-4 border-white flex items-center justify-center mb-4 bg-gray-200">
        {cameraMode === "photo" ? "📷" : "🎥"}
      </label>

      {lastThumbnail && <img src={lastThumbnail} alt="Last Capture" className="w-24 h-24 rounded-md border" />}

      <div className="flex gap-3 mt-4">
        <button className={`px-4 py-2 rounded ${cameraMode === "photo" ? "bg-blue-500 text-white" : "bg-gray-300"}`} onClick={() => setCameraMode("photo")}>
          Photo
        </button>
        <button className={`px-4 py-2 rounded ${cameraMode === "video" ? "bg-blue-500 text-white" : "bg-gray-300"}`} onClick={() => setCameraMode("video")}>
          Video
        </button>
      </div>
    </div>
  );
}
