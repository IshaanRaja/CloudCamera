import { useState, useEffect, useRef } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import Camera from "@/components/Camera";
import Gallery from "@/components/Gallery";
import Settings from "@/components/Settings";
import Navigation from "@/components/Navigation";
import MediaViewer from "@/components/MediaViewer";
import ConfirmationDialog from "@/components/ConfirmationDialog";
import ToastMessage from "@/components/ToastMessage";
import { loadS3Config, saveS3Config } from "@/lib/storage";
import { getMediaList, deleteMediaFromS3 } from "@/lib/s3";
import { MediaItem, S3Config } from "@/lib/types";

function App() {
  const GALLERY_REFRESH_INTERVAL_MS = 60_000;

  // App state
  const [activeTab, setActiveTab] = useState<string>("camera");
  const [isConnected, setIsConnected] = useState<boolean>(navigator.onLine);
  const [pendingUploads, setPendingUploads] = useState<MediaItem[]>([]);
  const [s3Config, setS3Config] = useState<S3Config>({
    endpoint: "",
    bucket: "",
    region: "",
    accessKey: "",
    secretKey: ""
  });
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState<boolean>(false);
  const [confirmAction, setConfirmAction] = useState<() => void>(() => {});
  const [confirmMessage, setConfirmMessage] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [s3Connected, setS3Connected] = useState<boolean>(false);
  const lastMediaRefreshRef = useRef<number>(0);
  const [hasOpenedGallery, setHasOpenedGallery] = useState<boolean>(false);
  const objectUrlMapRef = useRef<Map<string, string>>(new Map());
  
  const { toast } = useToast();

  const revokeMediaObjectUrl = (mediaKey: string) => {
    const objectUrl = objectUrlMapRef.current.get(mediaKey);
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrlMapRef.current.delete(mediaKey);
    }
  };

  const upsertMediaItem = (item: MediaItem) => {
    setMediaItems((currentItems) => {
      const nextItems = [item, ...currentItems.filter((currentItem) => currentItem.key !== item.key)];
      return nextItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    });
  };

  const handleMediaSaved = (media: MediaItem) => {
    const normalizedMedia: MediaItem = { ...media };

    if (!normalizedMedia.url && normalizedMedia.blob) {
      revokeMediaObjectUrl(normalizedMedia.key);
      const objectUrl = URL.createObjectURL(normalizedMedia.blob);
      objectUrlMapRef.current.set(normalizedMedia.key, objectUrl);
      normalizedMedia.url = objectUrl;
    }

    upsertMediaItem(normalizedMedia);
    setSelectedMedia((currentSelectedMedia) =>
      currentSelectedMedia?.key === normalizedMedia.key ? normalizedMedia : currentSelectedMedia,
    );
    setHasOpenedGallery(true);
  };

  // Load S3 config on mount
  useEffect(() => {
    const config = loadS3Config();
    if (config) {
      setS3Config(config);
      refreshMediaItems(config);
    }

    return () => {
      objectUrlMapRef.current.forEach((objectUrl) => URL.revokeObjectURL(objectUrl));
      objectUrlMapRef.current.clear();
    };
  }, []);

  // Handle online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsConnected(true);
      syncPendingUploads();
    };
    
    const handleOffline = () => {
      setIsConnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [pendingUploads, s3Config]);

  // Function to refresh media items from S3
  const refreshMediaItems = async (config = s3Config) => {
    // Check for empty values (with trimming to remove whitespace)
    if (!config.endpoint.trim() || 
        !config.bucket.trim() || 
        !config.region.trim() || 
        !config.accessKey.trim() || 
        !config.secretKey.trim()) return;
    
    setIsLoading(true);
    try {
      const items = await getMediaList(config);
      items.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setMediaItems((currentItems) => {
        const currentItemsByKey = new Map(currentItems.map((item) => [item.key, item]));

        return items.map((item) => {
          const existingItem = currentItemsByKey.get(item.key);
          if (!existingItem) return item;

          return {
            ...item,
            url: existingItem.url || item.url,
            thumbnail: existingItem.thumbnail || item.thumbnail,
            blob: existingItem.blob ?? item.blob,
          };
        });
      });
      setS3Connected(true);
      lastMediaRefreshRef.current = Date.now();
    } catch (error) {
      console.error("Failed to load media items:", error);
      setS3Connected(false);
      showErrorToast("Could not connect to S3 bucket. Please check your settings.");
    } finally {
      setIsLoading(false);
    }
  };

  // Function to synchronize pending uploads when online
  const syncPendingUploads = async () => {
    if (!isConnected || pendingUploads.length === 0) return;
    
    // TODO: Implement the background sync logic using the S3 client
    // This will be handled by the service worker
  };

  // Function to handle tab changes
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    
    // Show the current gallery immediately and refresh only when stale.
    if (tab === "view" && s3Config.bucket) {
      setHasOpenedGallery(true);
      const isStale = Date.now() - lastMediaRefreshRef.current > GALLERY_REFRESH_INTERVAL_MS;
      if (mediaItems.length === 0 || isStale) {
        void refreshMediaItems();
      }
    }
  };

  // Function to handle saving S3 configuration
  const handleSaveS3Config = async (config: S3Config) => {
    // Validate the configuration
    if (!config.endpoint.trim() || 
        !config.bucket.trim() || 
        !config.region.trim() ||
        !config.accessKey.trim() || 
        !config.secretKey.trim()) {
      showErrorToast("Please fill all S3 configuration fields");
      return;
    }
    
    setS3Config(config);
    saveS3Config(config);
    toast({
      title: "Settings Saved",
      description: "Your S3 configuration has been saved successfully",
    });
    refreshMediaItems(config);
  };

  // Function to handle testing S3 connection
  const handleTestConnection = async () => {
    // Debug config values
    console.log("S3 Config:", {
      endpoint: s3Config.endpoint,
      bucket: s3Config.bucket,
      region: s3Config.region,
      accessKey: s3Config.accessKey,
      secretKey: s3Config.secretKey ? "***" : "" // Don't log actual secret
    });

    // Check for empty values (with trimming to remove whitespace)
    if (!s3Config.endpoint.trim() || 
        !s3Config.bucket.trim() || 
        !s3Config.region.trim() ||
        !s3Config.accessKey.trim() || 
        !s3Config.secretKey.trim()) {
      showErrorToast("Please fill all S3 configuration fields");
      return;
    }

    setIsLoading(true);
    try {
      await getMediaList(s3Config);
      setS3Connected(true);
      toast({
        title: "Success",
        description: "Successfully connected to S3 bucket",
      });
    } catch (error) {
      setS3Connected(false);
      showErrorToast("Failed to connect to S3 bucket. Please check your settings.");
    } finally {
      setIsLoading(false);
    }
  };

  // Function to handle selecting media
  const handleSelectMedia = (media: MediaItem) => {
    setSelectedMedia(media);
  };

  const selectedMediaIndex = selectedMedia
    ? mediaItems.findIndex((item) => item.key === selectedMedia.key)
    : -1;

  useEffect(() => {
    if (!selectedMedia) return;

    const updatedSelectedMedia = mediaItems.find((item) => item.key === selectedMedia.key);
    if (!updatedSelectedMedia) {
      setSelectedMedia(null);
      return;
    }

    if (updatedSelectedMedia !== selectedMedia) {
      setSelectedMedia(updatedSelectedMedia);
    }
  }, [mediaItems, selectedMedia]);

  // Function to handle deleting media
  const handleDeleteMedia = (media: MediaItem) => {
    setConfirmMessage("Are you sure you want to delete this item? This action cannot be undone.");
    setConfirmAction(() => async () => {
      const deletedMediaIndex = mediaItems.findIndex((item) => item.key === media.key);
      const deletedPendingUpload = pendingUploads.find((item) => item.key === media.key) ?? null;
      const replacementMedia =
        deletedMediaIndex > 0
          ? mediaItems[deletedMediaIndex - 1]
          : mediaItems[deletedMediaIndex + 1] ?? null;

      setSelectedMedia(replacementMedia);

      setMediaItems((currentItems) => currentItems.filter((item) => item.key !== media.key));
      setPendingUploads((currentItems) => currentItems.filter((item) => item.key !== media.key));

      try {
        await deleteMediaFromS3(media, s3Config);
        revokeMediaObjectUrl(media.key);
        toast({
          title: "Deleted",
          description: "Media item has been deleted",
        });
      } catch (error) {
        setMediaItems((currentItems) => {
          if (currentItems.some((item) => item.key === media.key)) {
            return currentItems;
          }

          const nextItems = [...currentItems];
          const insertionIndex =
            deletedMediaIndex >= 0 && deletedMediaIndex <= nextItems.length
              ? deletedMediaIndex
              : nextItems.length;

          nextItems.splice(insertionIndex, 0, media);
          return nextItems;
        });

        if (deletedPendingUpload) {
          setPendingUploads((currentItems) => {
            if (currentItems.some((item) => item.key === deletedPendingUpload.key)) {
              return currentItems;
            }

            return [deletedPendingUpload, ...currentItems];
          });
        }

        setSelectedMedia(media);
        showErrorToast("Failed to delete media item. It has been restored.");
        console.error("Failed to delete media item:", error);
      }
    });
    setShowConfirmDialog(true);
  };

  // Function to show error toast
  const showErrorToast = (message: string) => {
    toast({
      variant: "destructive",
      title: "Error",
      description: message,
    });
  };

  return (
    <QueryClientProvider client={queryClient}>
      <div className="h-screen w-full flex flex-col bg-ios-lightgray dark:bg-ios-darkgray text-black dark:text-white overflow-hidden">
        {/* Active Screen */}
        <div className="flex-grow overflow-hidden relative">
          {hasOpenedGallery && (
            <div
              className={`absolute inset-0 ${
                activeTab === "view" ? "z-10" : "pointer-events-none z-0"
              }`}
              style={{ visibility: activeTab === "view" ? "visible" : "hidden" }}
              aria-hidden={activeTab !== "view"}
            >
              <Gallery 
                mediaItems={mediaItems}
                isLoading={isLoading}
                isConnected={s3Connected}
                onSelectMedia={handleSelectMedia}
                onRefresh={refreshMediaItems}
              />
            </div>
          )}

          {activeTab === "camera" && (
            <Camera 
              isConnected={isConnected}
              s3Config={s3Config}
              onAddPendingUpload={(media) => setPendingUploads([...pendingUploads, media])}
              onMediaSaved={handleMediaSaved}
              showErrorToast={showErrorToast}
            />
          )}
          
          {!hasOpenedGallery && activeTab === "view" && (
            <Gallery 
              mediaItems={mediaItems}
              isLoading={isLoading}
              isConnected={s3Connected}
              onSelectMedia={handleSelectMedia}
              onRefresh={refreshMediaItems}
            />
          )}

          {activeTab === "settings" && (
            <Settings 
              s3Config={s3Config}
              isConnected={s3Connected}
              pendingUploads={pendingUploads}
              onSaveConfig={handleSaveS3Config}
              onTestConnection={handleTestConnection}
            />
          )}
        </div>
        
        {/* Navigation Bar */}
        <Navigation activeTab={activeTab} onTabChange={handleTabChange} />
        
        {/* Media Viewer */}
        {selectedMedia && (
          <MediaViewer 
            key={selectedMedia.key}
            media={selectedMedia} 
            mediaItems={mediaItems}
            currentIndex={selectedMediaIndex}
            onSelectMedia={setSelectedMedia}
            onClose={() => setSelectedMedia(null)}
            onDelete={handleDeleteMedia}
            onNext={() => {
              if (selectedMediaIndex > 0) {
                setSelectedMedia(mediaItems[selectedMediaIndex - 1]);
              }
            }}
            onPrev={() => {
              if (selectedMediaIndex >= 0 && selectedMediaIndex < mediaItems.length - 1) {
                setSelectedMedia(mediaItems[selectedMediaIndex + 1]);
              }
            }}
          />
        )}

        {/* Confirmation Dialog */}
        <ConfirmationDialog 
          isOpen={showConfirmDialog}
          title="Delete Item"
          message={confirmMessage}
          onConfirm={() => {
            confirmAction();
            setShowConfirmDialog(false);
          }}
          onCancel={() => setShowConfirmDialog(false)}
        />

        <Toaster />
      </div>
    </QueryClientProvider>
  );
}

export default App;
