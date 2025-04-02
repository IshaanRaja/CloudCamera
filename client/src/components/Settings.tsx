import { useState } from "react";
import { MediaItem, S3Config } from "@/lib/types";

interface SettingsProps {
  s3Config: S3Config;
  isConnected: boolean;
  pendingUploads: MediaItem[];
  onSaveConfig: (config: S3Config) => void;
  onTestConnection: () => void;
}

export default function Settings({ 
  s3Config, 
  isConnected, 
  pendingUploads, 
  onSaveConfig, 
  onTestConnection 
}: SettingsProps) {
  const [config, setConfig] = useState<S3Config>(s3Config);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setConfig(prev => ({ ...prev, [name]: value }));
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form fields
    if (!config.endpoint.trim() || 
        !config.bucket.trim() || 
        !config.accessKey.trim() || 
        !config.secretKey.trim()) {
      alert("Please fill all S3 configuration fields");
      return;
    }
    
    onSaveConfig(config);
  };
  
  return (
    <div className="h-full flex flex-col">
      <header className="px-4 py-3 bg-white dark:bg-ios-darkgray border-b border-gray-200 dark:border-gray-800">
        <h1 className="text-lg font-semibold text-center">Settings</h1>
      </header>
      
      <div className="flex-grow overflow-y-auto">
        <form className="p-4 space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1">
            <label className="text-sm font-medium">S3 Endpoint</label>
            <input 
              type="text" 
              name="endpoint"
              placeholder="https://s3.example.com" 
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 dark:bg-gray-800"
              value={config.endpoint}
              onChange={handleChange}
            />
          </div>
          
          <div className="space-y-1">
            <label className="text-sm font-medium">Bucket Name</label>
            <input 
              type="text" 
              name="bucket"
              placeholder="my-cloud-camera-bucket" 
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 dark:bg-gray-800"
              value={config.bucket}
              onChange={handleChange}
            />
          </div>
          
          <div className="space-y-1">
            <label className="text-sm font-medium">Access Key</label>
            <input 
              type="text" 
              name="accessKey"
              placeholder="Access Key" 
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 dark:bg-gray-800"
              value={config.accessKey}
              onChange={handleChange}
            />
          </div>
          
          <div className="space-y-1">
            <label className="text-sm font-medium">Secret Key</label>
            <input 
              type="password" 
              name="secretKey"
              placeholder="Secret Key" 
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 dark:bg-gray-800"
              value={config.secretKey}
              onChange={handleChange}
            />
          </div>
          
          <div className="pt-4 flex gap-2">
            <button 
              type="submit" 
              className="bg-ios-blue text-white rounded-lg px-4 py-2 font-medium flex-grow"
            >
              Save Configuration
            </button>
            
            <button 
              type="button" 
              className="bg-ios-gray/20 text-ios-blue rounded-lg px-4 py-2 font-medium"
              onClick={onTestConnection}
            >
              Test Connection
            </button>
          </div>
        </form>
        
        <div className="px-4 pt-4 pb-8">
          <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <h3 className="font-medium mb-2">Connection Status</h3>
            
            {isConnected ? (
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-ios-green mr-2"></div>
                <span>Connected to S3 bucket</span>
              </div>
            ) : (
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-ios-red mr-2"></div>
                <span>Not connected</span>
              </div>
            )}
            
            {pendingUploads.length > 0 && (
              <div className="mt-2">
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-ios-blue animate-pulse mr-2"></div>
                  <span>{pendingUploads.length} items waiting to upload</span>
                </div>
              </div>
            )}
          </div>
          
          <div className="mt-6">
            <h3 className="font-medium mb-2">About Cloud Camera</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Version 1.0.0</p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              A progressive web app for securely storing photos and videos in your S3 bucket.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
