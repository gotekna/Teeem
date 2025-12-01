"use client";

import * as React from "react";
import { Cloud } from "lucide-react";
import { cn } from "@/lib/utils";

interface FolderCardProps {
  id: string;
  name: string;
  fileCount: number;
  onClick?: () => void;
  isOneDriveConnected?: boolean;
  className?: string;
}

export function FolderCard({
  name,
  fileCount,
  onClick,
  isOneDriveConnected = false,
  className,
}: FolderCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "folder-card group relative flex flex-col items-center p-4 transition-all",
        "hover:scale-[1.02] active:scale-[0.98]",
        className
      )}
    >
      {/* 3D Folder visual */}
      <div className="folder-card-icon relative w-full aspect-[4/3] mb-3">
        {/* Back flap of folder */}
        <div className="folder-card-back absolute inset-0 bg-[#5a5a5a] dark:bg-[#4a4a4a] rounded-lg" />

        {/* Folder tab */}
        <div className="folder-card-tab absolute -top-2 left-3 w-8 h-3 bg-[#6b6b6b] dark:bg-[#5a5a5a] rounded-t-md" />

        {/* Front of folder */}
        <div className="folder-card-front absolute inset-0 top-1 bg-[#6b6b6b] dark:bg-[#5a5a5a] rounded-lg shadow-sm">
          {/* Papers inside - stacked effect */}
          <div className="absolute top-2 left-3 right-3 bottom-4 flex flex-col gap-1">
            <div className="folder-card-paper h-full bg-white dark:bg-gray-200 rounded-sm shadow-sm relative overflow-hidden">
              {/* PDF icon indicator */}
              <div className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-sm flex items-center justify-center">
                <span className="text-[6px] font-bold text-white">PDF</span>
              </div>
              {/* Paper lines */}
              <div className="absolute top-3 left-1.5 right-1.5 space-y-1">
                <div className="h-0.5 bg-gray-200 dark:bg-gray-300 rounded w-3/4" />
                <div className="h-0.5 bg-gray-200 dark:bg-gray-300 rounded w-1/2" />
              </div>
            </div>
          </div>
        </div>

        {/* Integration badges at bottom */}
        {isOneDriveConnected && (
          <div className="absolute -bottom-1 left-2 flex items-center gap-1">
            <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center shadow-sm">
              <Cloud className="h-3 w-3 text-white" />
            </div>
          </div>
        )}
      </div>

      {/* Folder name and count */}
      <div className="text-center w-full">
        <p className="font-medium text-sm truncate">{name}</p>
        <p className="text-xs text-muted-foreground">{fileCount} Files</p>
      </div>
    </button>
  );
}
