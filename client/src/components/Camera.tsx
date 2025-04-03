import { useState } from "react";
import { uploadMediaToS3 } from "@/lib/s3";
import { saveMediaToLocalBuffer } from "@/lib/storage";
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
    reader.onload = () => setLastThumbnail(reader.result as string);
    reader.readAsDataURL(file);

    const now = new Date();
    const filename = `${cameraMode}_${now.getTime()}.${file.type.split("/")[1]}`;
    const mediaItem: MediaItem = {
      key: filename,
      type: file.type,
      size: file.size,
      date: now.toISOString(),
      url: URL.createObjectURL(file),
      blob: file,
    };

    // Upload if connected, otherwise store locally
    if (isConnected && s3Config.bucket) {
      try {
        await uploadMediaToS3(mediaItem, s3Config);
      } catch (error) {
        console.error("Failed to upload to S3:", error);
        saveMediaToLocalBuffer(mediaItem);
        onAddPendingUpload(mediaItem);
        showErrorToast("Media will be uploaded when connection is available");
      }
    } else {
      saveMediaToLocalBuffer(mediaItem);
      onAddPendingUpload(mediaItem);
      showErrorToast("Media saved locally. Will upload when connected.");
    }
  };

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
