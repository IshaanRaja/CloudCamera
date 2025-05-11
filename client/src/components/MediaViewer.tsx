import { useState, useRef, useEffect } from "react";
import { format } from "date-fns";
import { MediaItem } from "@/lib/types";
import { PhotoProvider, PhotoView } from "react-photo-view";
import "react-photo-view/dist/react-photo-view.css";

interface MediaViewerProps {
  media: MediaItem;
  mediaItems: MediaItem[];
  onClose: () => void;
  onDelete: (media: MediaItem) => void;
  onNext: (media: MediaItem) => void;
  onPrev: (media: MediaItem) => void;
}

export default function MediaViewer({ 
  media, 
  mediaItems, 
  onClose, 
  onDelete, 
  onNext, 
  onPrev 
}: MediaViewerProps) {
  const [scale, setScale] = useState<number>(1);
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Format date for display
  const formattedDate = media.date 
    ? format(new Date(media.date), "MMMM d, yyyy hh:mmaaaaa'm'")
    : "";

  // Reset scale and position when media changes
  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setIsPlaying(false);
  }, [media]);

  // Set up swipe detection
  useEffect(() => {
    if (!containerRef.current) return;
    
    const container = containerRef.current;
    let startX = 0;
    let startTime = 0;
    
    const handleTouchStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX;
      startTime = Date.now();
    };
    
    const handleTouchEnd = (e: TouchEvent) => {
      if (scale > 1) return; // Don't swipe if zoomed in
      
      const endX = e.changedTouches[0].clientX;
      const diffX = endX - startX;
      const diffTime = Date.now() - startTime;
      
      // Check if it's a swipe (fast enough and long enough)
      if (diffTime < 300 && Math.abs(diffX) > 50) {
        if (diffX > 0) {
          onNext(media);
        } else {
          onPrev(media);
        }
      }
    };
    
    container.addEventListener('touchstart', handleTouchStart);
    container.addEventListener('touchend', handleTouchEnd);
    
    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [media, onNext, onPrev, scale]);

  // Handle double tap to zoom
  const handleDoubleTap = () => {
    setScale(scale === 1 ? 2 : 1);
    setPosition({ x: 0, y: 0 });
  };

  // Handle pinch zoom
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // For pinch zoom
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      
      e.currentTarget.dataset.initialDistance = distance.toString();
      e.currentTarget.dataset.initialScale = scale.toString();
    } else if (e.touches.length === 1 && scale > 1) {
      // For panning when zoomed
      setIsPanning(true);
      setStartPos({
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Pinch zoom
      const initialDistance = Number(e.currentTarget.dataset.initialDistance || 0);
      const initialScale = Number(e.currentTarget.dataset.initialScale || 1);
      
      if (initialDistance) {
        const distance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        
        let newScale = initialScale * (distance / initialDistance);
        newScale = Math.max(1, Math.min(4, newScale)); // Limit between 1x and 4x
        
        setScale(newScale);
      }
    } else if (e.touches.length === 1 && isPanning) {
      // Panning when zoomed
      const newX = e.touches[0].clientX - startPos.x;
      const newY = e.touches[0].clientY - startPos.y;
      
      setPosition({ x: newX, y: newY });
    }
  };

  const handleTouchEnd = () => {
    setIsPanning(false);
  };

  // Handle video playback
  const togglePlayback = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <header className="px-4 py-3 flex justify-between items-center">
        <button className="text-white" onClick={onClose}>
          <i className="fas fa-chevron-left"></i>
          <span className="ml-2">Back</span>
        </button>
        <div>
          <span className="text-white">{formattedDate}</span>
        </div>
        <button className="w-8 h-8 text-white opacity-0">
          <i className="fas fa-share-alt"></i>
        </button>
      </header>
      
      <div 
        ref={containerRef}
        className="flex-grow flex items-center justify-center overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onDoubleClick={handleDoubleTap}
      >
        <PhotoProvider>
          {media.type.startsWith("image/") ? (
            <PhotoView src={media.url}>
              <img
                src={media.url}
                alt="Media"
                className="max-h-full max-w-full object-contain cursor-zoom-in"
              />
            </PhotoView>
          ) : (
            <div className="relative">
              <video
                src={media.url}
                controls
                autoPlay
                className="max-h-full max-w-full rounded-md"
              />
            </div>
          )}
        </PhotoProvider> 
      </div>
      
      <footer className="px-4 py-3 flex justify-between items-center" style={{color: 'white'}}>
        <div></div>
        <div className="flex gap-8">
          <button 
            className="text-ios-red text-3xl" 
            onClick={() => onDelete(media)}
          >
            <i className="fas fa-trash"></i>
          </button>
        </div>
        <div></div>
      </footer>
    </div>
  );
}
