import { useState, useEffect, useRef } from "react";
import { MediaItem } from "@/lib/types";

interface GalleryProps {
  mediaItems: MediaItem[];
  isLoading: boolean;
  isConnected: boolean;
  onSelectMedia: (media: MediaItem) => void;
  onRefresh: () => void;
}

export default function Gallery({ mediaItems, isLoading, isConnected, onSelectMedia, onRefresh }: GalleryProps) {
  const [sortedItems, setSortedItems] = useState<MediaItem[]>([]);
  
  // Sort items by date (newest first) whenever mediaItems changes
  useEffect(() => {
    const sorted = [...mediaItems].sort((a, b) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
    setSortedItems(sorted);
  }, [mediaItems]);

  return (
    <div className="h-full flex flex-col">
      <header className="px-4 py-3 bg-white dark:bg-ios-darkgray border-b border-gray-200 dark:border-gray-800">
        <h1 className="text-lg font-semibold text-center">Photos & Videos</h1>
      </header>
      
      <div className="flex-grow overflow-y-auto">
        {isLoading ? (
          <LoadingState />
        ) : !isConnected ? (
          <ErrorState onRetry={onRefresh} />
        ) : sortedItems.length === 0 ? (
          <EmptyState />
        ) : (
          <MediaGrid items={sortedItems} onSelectMedia={onSelectMedia} />
        )}
      </div>
    </div>
  );
}

function MediaGrid({ items, onSelectMedia }: { items: MediaItem[], onSelectMedia: (media: MediaItem) => void }) {
  // Using intersection observer for lazy loading
  const observerRef = useRef<IntersectionObserver | null>(null);
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const key = entry.target.getAttribute('data-key');
            if (key) {
              // Stop observing this element
              observerRef.current?.unobserve(entry.target);
              // It's now visible, we can load the real image/thumbnail
              entry.target.classList.add('loaded');
            }
          }
        });
      },
      { rootMargin: '100px' }
    );
    
    // Observe all current items
    itemRefs.current.forEach((ref) => {
      observerRef.current?.observe(ref);
    });
    
    return () => {
      observerRef.current?.disconnect();
    };
  }, [items]);
  
  return (
    <div className="p-1 grid grid-cols-3 gap-1">
      {items.map(item => (
        <div 
          key={item.key}
          ref={ref => {
            if (ref) {
              itemRefs.current.set(item.key, ref);
              observerRef.current?.observe(ref);
            }
          }}
          data-key={item.key}
          className="aspect-square bg-gray-200 dark:bg-gray-800 relative"
          onClick={() => onSelectMedia(item)}
        >
          <div 
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${item.thumbnail || item.url})` }}
          />
          
          {/* Show video indicator for video media */}
          {item.type.startsWith('video/') && (
            <div className="absolute bottom-1 right-1">
              <i className="fas fa-play text-white text-xs w-4 h-4 flex items-center justify-center bg-black/50 rounded-full"></i>
            </div>
          )}
          
          {/* Hover overlay */}
          <div className="opacity-0 hover:opacity-100 absolute inset-0 bg-black/20 flex items-center justify-center transition-opacity">
            <button className="text-white">
              <i className="fas fa-expand text-lg"></i>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="h-full flex flex-col items-center justify-center p-8">
      <div className="text-6xl text-ios-gray mb-4">
        <i className="fas fa-cloud-upload-alt"></i>
      </div>
      <h3 className="text-xl font-medium text-ios-gray mb-2">No Photos or Videos</h3>
      <p className="text-center text-ios-gray">Capture moments with the camera tab and they'll appear here!</p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="h-full flex flex-col items-center justify-center p-8">
      <div className="text-6xl text-ios-blue mb-4">
        <i className="fas fa-spinner fa-spin"></i>
      </div>
      <h3 className="text-xl font-medium mb-2">Loading media...</h3>
      <p className="text-center text-ios-gray">Fetching your photos and videos from S3</p>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="h-full flex flex-col items-center justify-center p-8">
      <div className="text-6xl text-ios-red mb-4">
        <i className="fas fa-exclamation-circle"></i>
      </div>
      <h3 className="text-xl font-medium mb-2">Connection Error</h3>
      <p className="text-center text-ios-gray mb-4">Unable to connect to your S3 bucket</p>
      <button 
        className="bg-ios-blue text-white px-4 py-2 rounded-md"
        onClick={onRetry}
      >
        Retry Connection
      </button>
    </div>
  );
}
