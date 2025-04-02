import React from "react";

interface ConfirmationDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmationDialog({ 
  isOpen, 
  title, 
  message, 
  onConfirm, 
  onCancel 
}: ConfirmationDialogProps) {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-ios-darkgray rounded-xl w-4/5 max-w-sm overflow-hidden">
        <div className="p-4 text-center">
          <h3 className="text-lg font-semibold mb-2">{title}</h3>
          <p className="text-gray-600 dark:text-gray-400">{message}</p>
        </div>
        <div className="flex border-t border-gray-200 dark:border-gray-700">
          <button 
            className="flex-1 p-3 text-ios-blue font-medium border-r border-gray-200 dark:border-gray-700"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button 
            className="flex-1 p-3 text-ios-red font-medium"
            onClick={onConfirm}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
