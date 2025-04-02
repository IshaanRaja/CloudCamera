import React, { useState, useEffect } from "react";

interface ToastMessageProps {
  message: string;
  type?: "error" | "success" | "info";
  duration?: number;
  onDismiss: () => void;
}

export default function ToastMessage({ 
  message, 
  type = "error", 
  duration = 3000, 
  onDismiss 
}: ToastMessageProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onDismiss, 300); // Allow time for animation
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onDismiss]);

  // Determine background color based on type
  const getBgColor = () => {
    switch (type) {
      case "error": return "bg-ios-red";
      case "success": return "bg-ios-green";
      case "info": return "bg-ios-blue";
      default: return "bg-ios-red";
    }
  };

  // Determine icon based on type
  const getIcon = () => {
    switch (type) {
      case "error": return "fa-exclamation-circle";
      case "success": return "fa-check-circle";
      case "info": return "fa-info-circle";
      default: return "fa-exclamation-circle";
    }
  };

  return (
    <div 
      className={`fixed bottom-20 left-1/2 transform -translate-x-1/2 ${getBgColor()} text-white px-4 py-2 rounded-lg shadow-lg flex items-center z-50 transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
    >
      <i className={`fas ${getIcon()} mr-2`}></i>
      <span>{message}</span>
      <button className="ml-3" onClick={() => {
        setIsVisible(false);
        setTimeout(onDismiss, 300);
      }}>
        <i className="fas fa-times"></i>
      </button>
    </div>
  );
}
