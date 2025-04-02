import React from "react";

interface NavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function Navigation({ activeTab, onTabChange }: NavigationProps) {
  return (
    <nav className="h-16 bg-white dark:bg-ios-darkgray border-t border-gray-200 dark:border-gray-800 flex justify-around items-center">
      <TabButton 
        icon="fa-camera" 
        label="Camera" 
        isActive={activeTab === "camera"} 
        onClick={() => onTabChange("camera")} 
      />
      
      <TabButton 
        icon="fa-th" 
        label="View" 
        isActive={activeTab === "view"} 
        onClick={() => onTabChange("view")} 
      />
      
      <TabButton 
        icon="fa-cog" 
        label="Settings" 
        isActive={activeTab === "settings"} 
        onClick={() => onTabChange("settings")} 
      />
    </nav>
  );
}

interface TabButtonProps {
  icon: string;
  label: string;
  isActive: boolean;
  onClick: () => void;
}

function TabButton({ icon, label, isActive, onClick }: TabButtonProps) {
  return (
    <button 
      className={`flex flex-col items-center justify-center w-20 h-full ${isActive ? 'text-ios-blue' : 'text-ios-gray'}`}
      onClick={onClick}
    >
      <i className={`fas ${icon} text-xl`}></i>
      <span className="text-xs mt-1">{label}</span>
    </button>
  );
}
