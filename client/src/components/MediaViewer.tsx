import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { PhotoSlider } from "react-photo-view";
import "react-photo-view/dist/react-photo-view.css";
import { MediaItem } from "@/lib/types";

interface MediaViewerProps {
  media: MediaItem;
  mediaItems: MediaItem[];
  currentIndex: number;
  onSelectMedia: (media: MediaItem) => void;
  onClose: () => void;
  onDelete: (media: MediaItem) => void;
  onNext: () => void;
  onPrev: () => void;
}

export default function MediaViewer({
  media,
  mediaItems,
  currentIndex,
  onSelectMedia,
  onClose,
  onDelete,
  onNext,
  onPrev,
}: MediaViewerProps) {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isVideoReady, setIsVideoReady] = useState<boolean>(false);
  const [loadedImageUrls, setLoadedImageUrls] = useState<Record<string, boolean>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const formattedDate = media.date
    ? format(new Date(media.date), "MMMM d, yyyy hh:mmaaaaa'm'")
    : "";

  const hasNewer = currentIndex > 0;
  const hasOlder = currentIndex < mediaItems.length - 1;

  const imageItems = useMemo(
    () => mediaItems.filter((item) => item.type.startsWith("image/")),
    [mediaItems],
  );

  const imageIndex = useMemo(
    () => imageItems.findIndex((item) => item.key === media.key),
    [imageItems, media.key],
  );

  const sliderImages = useMemo(
    () => imageItems.map((item) => ({ key: item.key, src: item.url })),
    [imageItems],
  );

  useEffect(() => {
    setIsPlaying(false);
    setIsVideoReady(false);
  }, [media]);

  useEffect(() => {
    if (!media.type.startsWith("image/")) return;

    let isCancelled = false;
    const image = new Image();
    image.onload = () => {
      if (!isCancelled) {
        setLoadedImageUrls((current) => ({ ...current, [media.url]: true }));
      }
    };
    image.src = media.url;

    return () => {
      isCancelled = true;
    };
  }, [media]);

  useEffect(() => {
    const adjacentItems = [mediaItems[currentIndex - 1], mediaItems[currentIndex + 1]].filter(
      (item): item is MediaItem => Boolean(item && item.type.startsWith("image/")),
    );

    adjacentItems.forEach((item) => {
      const image = new Image();
      image.src = item.url;
    });
  }, [currentIndex, mediaItems]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") {
        onPrev();
      } else if (event.key === "ArrowLeft") {
        onNext();
      } else if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, onNext, onPrev]);

  useEffect(() => {
    if (!containerRef.current || media.type.startsWith("image/")) return;

    const container = containerRef.current;
    let startX = 0;
    let startTime = 0;

    const handleTouchStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX;
      startTime = Date.now();
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const endX = e.changedTouches[0].clientX;
      const diffX = endX - startX;
      const diffTime = Date.now() - startTime;

      if (diffTime < 300 && Math.abs(diffX) > 50) {
        if (diffX > 0) {
          onNext();
        } else {
          onPrev();
        }
      }
    };

    container.addEventListener("touchstart", handleTouchStart);
    container.addEventListener("touchend", handleTouchEnd);

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchend", handleTouchEnd);
    };
  }, [media.type, onNext, onPrev]);

  const togglePlayback = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        void videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  if (media.type.startsWith("image/")) {
    return (
      <div className="fixed inset-0 z-50">
        {!loadedImageUrls[media.url] && (
          <div className="pointer-events-none absolute inset-0 z-[2100] flex flex-col items-center justify-center gap-4 bg-black text-white/80">
            <i className="fas fa-spinner fa-spin text-3xl"></i>
            <span className="text-sm">Loading photo...</span>
          </div>
        )}
        <PhotoSlider
          images={sliderImages}
          index={imageIndex}
          visible
          onClose={onClose}
          onIndexChange={(index) => {
            const nextImage = imageItems[index];
            if (nextImage) {
              onSelectMedia(nextImage);
            }
          }}
          bannerVisible={false}
          maskClosable
          photoClosable={false}
          pullClosable
          speed={() => 220}
          easing={() => "cubic-bezier(0.22, 1, 0.36, 1)"}
          toolbarRender={() => null}
          overlayRender={() => (
            <>
              <header className="pointer-events-none absolute inset-x-0 top-0 z-20 px-4 py-3 flex justify-between items-center">
                <button className="pointer-events-auto text-white" onClick={onClose}>
                  <i className="fas fa-chevron-left"></i>
                  <span className="ml-2">Back</span>
                </button>
                <span className="text-white text-sm">{formattedDate}</span>
                <div className="w-11"></div>
              </header>

              {hasNewer && (
                <button
                  className="absolute left-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/40 px-3 py-2 text-white"
                  onClick={onNext}
                >
                  <i className="fas fa-chevron-left"></i>
                </button>
              )}

              {hasOlder && (
                <button
                  className="absolute right-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/40 px-3 py-2 text-white"
                  onClick={onPrev}
                >
                  <i className="fas fa-chevron-right"></i>
                </button>
              )}

              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-4 py-5">
                <button
                  className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-white shadow-lg ring-1 ring-white/15"
                  aria-label="Delete photo"
                  onClick={() => onDelete(media)}
                >
                  <i className="fas fa-trash text-lg"></i>
                </button>
              </div>
            </>
          )}
        />
      </div>
    );
  }

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
      >
        <div className="relative w-full h-full flex items-center justify-center">
          {!isVideoReady && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black text-white/80">
              <i className="fas fa-spinner fa-spin text-3xl"></i>
              <span className="text-sm">Loading video...</span>
            </div>
          )}
          <video
            ref={videoRef}
            src={media.url}
            preload="metadata"
            controls={isPlaying}
            className={`max-h-full max-w-full ${isVideoReady ? "opacity-100" : "opacity-0"}`}
            onLoadedMetadata={() => setIsVideoReady(true)}
            onLoadedData={() => setIsVideoReady(true)}
            onCanPlay={() => setIsVideoReady(true)}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            height="1920px"
            width="1080px"
          />
          {hasNewer && (
            <button
              className="absolute left-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/40 px-3 py-2 text-white"
              onClick={onNext}
            >
              <i className="fas fa-chevron-left"></i>
            </button>
          )}
          {hasOlder && (
            <button
              className="absolute right-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/40 px-3 py-2 text-white"
              onClick={onPrev}
            >
              <i className="fas fa-chevron-right"></i>
            </button>
          )}
          {isVideoReady && !isPlaying && (
            <div
              className="absolute inset-0 flex items-center justify-center"
              onClick={togglePlayback}
            >
              <button className="w-16 h-16 rounded-full bg-black/50 flex items-center justify-center text-white">
                <i className="fas fa-play"></i>
              </button>
            </div>
          )}
        </div>
      </div>

      <footer className="px-4 py-3 flex justify-between items-center" style={{ color: "white" }}>
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
