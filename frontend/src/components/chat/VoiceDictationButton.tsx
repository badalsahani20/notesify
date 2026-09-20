import React from "react";
import { Mic, Loader2, X } from "lucide-react";
import { useSTT } from "@/hooks/useSTT";
import { cn } from "@/lib/utils";

interface VoiceDictationButtonProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  className?: string;
}

export const VoiceDictationButton: React.FC<VoiceDictationButtonProps> = ({
  onTranscript,
  disabled = false,
  className,
}) => {
  const {
    isRecording,
    isTranscribing,
    recordingDuration,
    startRecording,
    stopRecording,
    cancelRecording,
    isSupported,
  } = useSTT({
    onTranscriptionComplete: (result) => {
      if (result.text) {
        onTranscript(result.text);
      }
    },
  });

  if (!isSupported) {
    return null;
  }

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleMicClick = async () => {
    if (disabled || isTranscribing) return;

    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  };

  return (
    <div className={cn("inline-flex items-center gap-1 shrink-0", className)}>
      {/* While recording: show live timer and cancel button */}
      {isRecording && (
        <div className="flex items-center gap-1.5 bg-red-500/15 border border-red-500/30 text-red-400 px-2 h-8 rounded-lg text-xs font-mono animate-pulse">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
          <span>{formatTimer(recordingDuration)}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              cancelRecording();
            }}
            className="p-0.5 rounded hover:bg-red-500/20 text-red-400 transition-colors"
            title="Cancel recording"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* Main Mic Action Button - styled with white background matching Send button */}
      <button
        type="button"
        onClick={handleMicClick}
        disabled={disabled || isTranscribing}
        className={cn(
          "w-8 h-8 rounded-lg transition-all flex items-center justify-center cursor-pointer shrink-0",
          isRecording
            ? "bg-red-600 text-white shadow-md shadow-red-500/30 hover:bg-red-700 animate-pulse"
            : isTranscribing
            ? "bg-white text-black shadow-md cursor-wait"
            : disabled
            ? "bg-white/5 text-white/30 cursor-not-allowed"
            : "bg-white text-black shadow-md hover:bg-white/90 active:scale-95"
        )}
        title={
          isRecording
            ? "Click to finish recording"
            : isTranscribing
            ? "Transcribing voice..."
            : "Voice dictation"
        }
      >
        {isTranscribing ? (
          <Loader2 className="w-4 h-4 animate-spin text-black" />
        ) : isRecording ? (
          <Mic className="w-4 h-4 text-white animate-bounce" />
        ) : (
          <Mic className={cn("w-4 h-4", disabled ? "text-white/30" : "text-black")} />
        )}
      </button>
    </div>
  );
};
