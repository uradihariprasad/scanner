"use client";

interface LoadingOverlayProps {
  message?: string;
}

export default function LoadingOverlay({
  message = "Loading...",
}: LoadingOverlayProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[300px]">
      <div className="relative w-16 h-16 mb-4">
        <div className="absolute inset-0 border-4 border-border rounded-full" />
        <div className="absolute inset-0 border-4 border-accent-blue border-t-transparent rounded-full animate-spin" />
      </div>
      <p className="text-sm text-text-secondary">{message}</p>
    </div>
  );
}
