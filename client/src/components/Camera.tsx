import React, { useEffect, useRef, useState } from "react";
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [cameraMode, setCameraMode] = useState<"photo" | "video">("photo");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [useFrontCamera, setUseFrontCamera] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [photoTaken, setPhotoTaken] = useState(false);

  useEffect(() => {
    initCamera();
    return () => {
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [useFrontCamera, flashOn]);

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
  
  const initCamera = async () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: useFrontCamera ? "user" : "environment",
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          zoom: true,
        },
        audio: true,
      });

      const videoTrack = newStream.getVideoTracks()[0];
      const capabilities = videoTrack.getCapabilities();
      if (capabilities.torch && flashOn) {
        try {
          await videoTrack.applyConstraints({ advanced: [{ torch: true }] });
        } catch (err) {
          console.warn("Torch not supported");
        }
      }

      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
    } catch (error) {
      showErrorToast("Camera access failed");
      console.error(error);
    }
  };

  const handleCapture = async () => {
    if (!videoRef.current) return;

    setPhotoTaken(true);
    setTimeout(() => setPhotoTaken(false), 500);

    const canvas = document.createElement("canvas");
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.drawImage(video, 0, 0);

    canvas.toBlob(async (blob) => {
      if (!blob) return;

      const now = new Date();
      const mediaItem: MediaItem = {
        key: `photo_${now.getTime()}.jpeg`,
        type: "image/jpeg",
        size: blob.size,
        date: now.toISOString(),
        blob,
      };

      await handleMediaSave(mediaItem);
    }, "image/jpeg", 1);
  };

  const handleRecord = () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    } else if (stream) {
      const recorder = new MediaRecorder(stream, {mimeType: 'video/mp4'});
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: "video/mp4" });
        const now = new Date();
        const mediaItem: MediaItem = {
          key: `video_${now.getTime()}.mp4`,
          type: "video/mp4",
          size: blob.size,
          date: now.toISOString(),
          blob,
        };

        await handleMediaSave(mediaItem);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    }
  };

  const handleMediaSave = async (mediaItem: MediaItem) => {
    try {
      if (isConnected && s3Config.bucket) {
        await uploadMediaToS3(mediaItem, s3Config);
      } else {
        throw new Error("Offline or no config");
      }
    } catch {
      await saveMediaToLocalBuffer(mediaItem);
      onAddPendingUpload(mediaItem);
      showErrorToast("Media saved locally. Will upload when connected.");
    }
  };

  const handleZoom = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      const [touch1, touch2] = e.touches;
      const dist = Math.hypot(touch1.pageX - touch2.pageX, touch1.pageY - touch2.pageY);
      const scale = Math.min(Math.max(dist / 200, 1), 3);
      setZoom(scale);

      const videoTrack = stream?.getVideoTracks()[0];
      if (videoTrack?.getCapabilities().zoom) {
        videoTrack.applyConstraints({ advanced: [{ zoom: scale }] });
      }
    }
  };

  return (
    <div
      className="relative w-full h-full bg-black overflow-hidden touch-none"
      onTouchMove={handleZoom}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute w-full h-full object-cover"
        style={{ transform: `scale(${zoom})` }}
      />
      <div className="absolute bottom-0 w-full flex flex-col items-center justify-center p-4 space-y-2 bg-gradient-to-t from-black via-black/30 to-transparent">
        <div className="flex justify-between w-full px-6 text-white text-sm">
          <button onClick={() => setFlashOn(!flashOn)}>
            {flashOn ? "Flash On" : "Flash Off"}
          </button>
          <button onClick={() => setUseFrontCamera(!useFrontCamera)}>
            {useFrontCamera ? "Front Cam" : "Rear Cam"}
          </button>
        </div>

        <div className="flex items-center justify-center space-x-6">
          <button
            className={`w-16 h-16 rounded-full transition duration-500 ${
            cameraMode === "photo" && photoTaken ? "bg-neutral-500 scale-95 brightness-90" : "bg-white"
            }`}
            onClick={cameraMode === "photo" ? handleCapture : handleRecord}
          >
            {cameraMode === "photo" ? "📸" : isRecording ? "⏹️" : "🔴"}
          </button>
        </div>

        <div className="flex space-x-4 mt-2 text-white text-xs">
          <button
            onClick={() => setCameraMode("photo")}
            className={cameraMode === "photo" ? "font-bold underline" : ""}
          >
            PHOTO
          </button>
          <button
            onClick={() => setCameraMode("video")}
            className={cameraMode === "video" ? "font-bold underline" : ""}
          >
            VIDEO
          </button>
        </div>
      </div>
    </div>
  );
}
