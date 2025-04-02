import { useState, useEffect } from "react";
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
import { getMediaList } from "@/lib/s3";
import { MediaItem, S3Config } from "@/lib/types";

function App() {
  // App state
  const [activeTab, setActiveTab] = useState<string>("camera");
  const [isConnected, setIsConnected] = useState<boolean>(navigator.onLine);
  const [pendingUploads, setPendingUploads] = useState<MediaItem[]>([]);
  const [s3Config, setS3Config] = useState<S3Config>({
    endpoint: "",
    bucket: "",
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
  
  const { toast } = useToast();

  // Load S3 config on mount
  useEffect(() => {
    const config = loadS3Config();
    if (config) {
      setS3Config(config);
      refreshMediaItems(config);
    }
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
        !config.accessKey.trim() || 
        !config.secretKey.trim()) return;
    
    setIsLoading(true);
    try {
      const items = await getMediaList(config);
      setMediaItems(items);
      setS3Connected(true);
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
    
    // Refresh media items when switching to gallery
    if (tab === "view" && s3Config.bucket) {
      refreshMediaItems();
    }
  };

  // Function to handle saving S3 configuration
  const handleSaveS3Config = async (config: S3Config) => {
    // Validate the configuration
    if (!config.endpoint.trim() || 
        !config.bucket.trim() || 
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
      accessKey: s3Config.accessKey,
      secretKey: s3Config.secretKey ? "***" : "" // Don't log actual secret
    });

    // Check for empty values (with trimming to remove whitespace)
    if (!s3Config.endpoint.trim() || 
        !s3Config.bucket.trim() || 
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

  // Function to handle deleting media
  const handleDeleteMedia = (media: MediaItem) => {
    setConfirmMessage("Are you sure you want to delete this item? This action cannot be undone.");
    setConfirmAction(() => async () => {
      // TODO: Implement delete logic using S3 client
      setMediaItems(mediaItems.filter(item => item.key !== media.key));
      setSelectedMedia(null);
      toast({
        title: "Deleted",
        description: "Media item has been deleted",
      });
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
          {activeTab === "camera" && (
            <Camera 
              isConnected={isConnected}
              s3Config={s3Config}
              onAddPendingUpload={(media) => setPendingUploads([...pendingUploads, media])}
              showErrorToast={showErrorToast}
            />
          )}
          
          {activeTab === "view" && (
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
            media={selectedMedia} 
            mediaItems={mediaItems}
            onClose={() => setSelectedMedia(null)}
            onDelete={handleDeleteMedia}
            onNext={(current) => {
              const index = mediaItems.findIndex(item => item.key === current.key);
              if (index > 0) {
                setSelectedMedia(mediaItems[index - 1]);
              }
            }}
            onPrev={(current) => {
              const index = mediaItems.findIndex(item => item.key === current.key);
              if (index < mediaItems.length - 1) {
                setSelectedMedia(mediaItems[index + 1]);
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
