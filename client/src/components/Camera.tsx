import { useState, useRef, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { capturePicture, startRecording, stopRecording } from "@/lib/cameraUtils";
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
  const [cameraFacing, setCameraFacing] = useState<string>("back");
  const [isCameraReady, setIsCameraReady] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingTime, setRecordingTime] = useState<number>(0);
  const [lastThumbnail, setLastThumbnail] = useState<string | null>(null);
  const [cameraMode, setCameraMode] = useState<"photo" | "video">("photo");
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Initialize camera on component mount
  useEffect(() => {
    initCamera();
    return () => {
      // Clean up camera resources
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Try to upload buffered media whenever connection is established
  useEffect(() => {
    if (isConnected) {
      uploadBufferedMedia();
    }
  }, [isConnected, s3Config]);

  // Initialize camera with current facing mode
  const initCamera = async () => {
    try {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }

      const constraints = {
        video: {
          facingMode: cameraFacing === "front" ? "user" : "environment",
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: true
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      mediaStreamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          setIsCameraReady(true);
        };
      }
    } catch (error) {
      console.error("Error initializing camera:", error);
      showErrorToast("Could not access camera. Please check permissions.");
      setIsCameraReady(false);
    }
  };

  // Toggle camera between front and back
  const handleToggleCamera = () => {
    setCameraFacing(prev => prev === "front" ? "back" : "front");
    initCamera();
  };

  // Toggle between photo and video mode
  const handleToggleMode = (mode: "photo" | "video") => {
    setCameraMode(mode);
  };

  // Handle taking a photo
  const handleTakePhoto = async () => {
    if (!isCameraReady || !videoRef.current) return;
    
    try {
      const { blob, dataUrl } = await capturePicture(videoRef.current);
      setLastThumbnail(dataUrl);
      
      const now = new Date();
      const filename = `photo_${now.getTime()}.jpg`;
      
      const mediaItem: MediaItem = {
        key: filename,
        type: "image/jpeg",
        size: blob.size,
        date: now.toISOString(),
        url: dataUrl,
        blob: blob
      };
      
      // If connected to internet, upload to S3
      if (isConnected && s3Config.bucket) {
        try {
          await uploadMediaToS3(mediaItem, s3Config);
        } catch (error) {
          console.error("Failed to upload to S3:", error);
          saveMediaToLocalBuffer(mediaItem);
          onAddPendingUpload(mediaItem);
          showErrorToast("Photo will be uploaded when connection is available");
        }
      } else {
        // Save to local buffer for later upload
        saveMediaToLocalBuffer(mediaItem);
        onAddPendingUpload(mediaItem);
        showErrorToast("Photo saved locally. Will upload when connected.");
      }
    } catch (error) {
      console.error("Error taking photo:", error);
      showErrorToast("Failed to take photo");
    }
  };

  // Handle starting/stopping video recording
  const handleToggleRecording = async () => {
    if (!isCameraReady || !videoRef.current || !mediaStreamRef.current) return;
    
    if (!isRecording) {
      // Start recording
      try {
        recordingChunksRef.current = [];
        const recorder = await startRecording(
          mediaStreamRef.current,
          (chunk) => recordingChunksRef.current.push(chunk)
        );
        
        mediaRecorderRef.current = recorder;
        setIsRecording(true);
        setRecordingTime(0);
        
        // Start timer
        timerRef.current = setInterval(() => {
          setRecordingTime(prev => prev + 1);
        }, 1000);
      } catch (error) {
        console.error("Error starting recording:", error);
        showErrorToast("Failed to start recording");
      }
    } else {
      // Stop recording
      try {
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
        
        if (mediaRecorderRef.current) {
          const blob = await stopRecording(mediaRecorderRef.current);
          
          // Create a thumbnail from the video
          const videoThumbnail = await generateVideoThumbnail(blob);
          setLastThumbnail(videoThumbnail);
          
          const now = new Date();
          const filename = `video_${now.getTime()}.webm`;
          
          const mediaItem: MediaItem = {
            key: filename,
            type: "video/webm",
            size: blob.size,
            date: now.toISOString(),
            url: URL.createObjectURL(blob),
            blob: blob,
            thumbnail: videoThumbnail,
            duration: recordingTime
          };
          
          // If connected to internet, upload to S3
          if (isConnected && s3Config.bucket) {
            try {
              await uploadMediaToS3(mediaItem, s3Config);
            } catch (error) {
              console.error("Failed to upload to S3:", error);
              saveMediaToLocalBuffer(mediaItem);
              onAddPendingUpload(mediaItem);
              showErrorToast("Video will be uploaded when connection is available");
            }
          } else {
            // Save to local buffer for later upload
            saveMediaToLocalBuffer(mediaItem);
            onAddPendingUpload(mediaItem);
            showErrorToast("Video saved locally. Will upload when connected.");
          }
        }
      } catch (error) {
        console.error("Error stopping recording:", error);
        showErrorToast("Failed to save recording");
      } finally {
        setIsRecording(false);
        mediaRecorderRef.current = null;
      }
    }
  };

  // Generate a thumbnail from video blob
  const generateVideoThumbnail = (videoBlob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.autoplay = false;
      video.muted = true;
      video.src = URL.createObjectURL(videoBlob);
      video.currentTime = 0.1; // Seek to 0.1 seconds to get the first frame
      
      video.onloadeddata = () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        URL.revokeObjectURL(video.src);
        resolve(dataUrl);
      };
      
      video.onerror = () => {
        URL.revokeObjectURL(video.src);
        reject(new Error("Failed to generate thumbnail"));
      };
    });
  };

  // Upload any media that was saved when offline
  const uploadBufferedMedia = async () => {
    if (!isConnected || !s3Config.bucket) return;
    
    try {
      const bufferedMedia = getBufferedMedia();
      if (bufferedMedia.length > 0) {
        await uploadBufferedMediaToS3(bufferedMedia, s3Config);
      }
    } catch (error) {
      console.error("Failed to upload buffered media:", error);
      showErrorToast("Failed to upload some media items");
    }
  };

  // Format recording time to MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  return (
    <div className="h-full relative">
      {/* Camera View */}
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        className="absolute inset-0 h-full w-full object-cover"
      />
      
      {/* Camera Controls Overlay */}
      <div className="absolute inset-0 flex flex-col justify-between">
        {/* Top Camera Controls */}
        <div className="p-4 flex justify-between items-center">
          <button className="w-10 h-10 rounded-full bg-black/30 flex items-center justify-center text-white">
            <i className="fas fa-bolt"></i>
          </button>
          
          <div className="flex gap-2">
            <button className="px-3 py-1 rounded-full bg-black/30 text-white text-sm">
              1x
            </button>
          </div>
          
          <button 
            className="w-10 h-10 rounded-full bg-black/30 flex items-center justify-center text-white"
            onClick={handleToggleCamera}
          >
            <i className="fas fa-sync-alt"></i>
          </button>
        </div>
        
        {/* Bottom Camera Controls */}
        <div className="p-4 pb-8 flex justify-between items-center">
          <div className="w-16 flex justify-center">
            {/* Last photo thumbnail */}
            {lastThumbnail && (
              <div className="w-10 h-10 rounded-md bg-black/40 border border-white/30 overflow-hidden">
                <div 
                  className="w-full h-full bg-cover bg-center" 
                  style={{ backgroundImage: `url(${lastThumbnail})` }}
                ></div>
              </div>
            )}
          </div>
          
          <div className="flex flex-col items-center">
            {/* Shutter Button (for photo mode) */}
            {cameraMode === "photo" && !isRecording && (
              <button 
                className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center mb-2"
                onClick={handleTakePhoto}
              >
                <div className="w-16 h-16 rounded-full bg-white"></div>
              </button>
            )}
            
            {/* Record Button (for video mode) */}
            {cameraMode === "video" && !isRecording && (
              <button 
                className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center mb-2"
                onClick={handleToggleRecording}
              >
                <div className="w-16 h-16 rounded-full bg-ios-red"></div>
              </button>
            )}
            
            {/* Stop Recording Button */}
            {isRecording && (
              <button 
                className="w-20 h-20 rounded-full border-4 border-ios-red flex items-center justify-center mb-2"
                onClick={handleToggleRecording}
              >
                <div className="w-8 h-8 rounded bg-ios-red"></div>
              </button>
            )}
            
            <div className="flex gap-3">
              <button 
                className={`px-3 py-1 rounded-full ${cameraMode === "photo" ? "bg-white/20 text-white" : "bg-black/30 text-white"} text-xs uppercase tracking-wider font-semibold`}
                onClick={() => handleToggleMode("photo")}
              >
                Photo
              </button>
              <button 
                className={`px-3 py-1 rounded-full ${cameraMode === "video" ? "bg-white/20 text-white" : "bg-black/30 text-white"} text-xs uppercase tracking-wider font-semibold`}
                onClick={() => handleToggleMode("video")}
              >
                Video
              </button>
            </div>
          </div>
          
          <div className="w-16 flex justify-center">
            {/* Camera settings */}
            <button className="w-10 h-10 rounded-full bg-black/30 flex items-center justify-center text-white">
              <i className="fas fa-sliders-h"></i>
            </button>
          </div>
        </div>
      </div>
      
      {/* Recording Indicator */}
      {isRecording && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-ios-red text-white px-3 py-1 rounded-full text-sm font-semibold flex items-center">
          <div className="w-2 h-2 rounded-full bg-white mr-2 animate-pulse"></div>
          <span>REC</span>
          <span className="ml-2">{formatTime(recordingTime)}</span>
        </div>
      )}
      
      {/* Offline Indicator */}
      {!isConnected && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-ios-gray text-white px-3 py-1 rounded-full text-sm font-semibold">
          Offline Mode
        </div>
      )}
    </div>
  );
}
