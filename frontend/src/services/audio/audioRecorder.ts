/**
 * Reusable AudioRecorder utility for browser MediaRecorder.
 * Handles microphone acquisition, MIME negotiation, recording lifecycle,
 * and media track cleanup.
 */

export interface AudioRecorderOptions {
  maxDurationSeconds?: number;
  onMaxDurationReached?: () => void;
  onError?: (error: Error) => void;
}

export class AudioRecorder {
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private chosenMimeType: string = "audio/webm";
  private maxDurationTimer: ReturnType<typeof setTimeout> | null = null;
  private startTime: number = 0;

  /**
   * Determine the best supported audio MIME type across browsers (Chrome, Safari, Firefox, Edge).
   */
  public static getSupportedMimeType(): string {
    if (typeof window === "undefined" || typeof MediaRecorder === "undefined") {
      return "audio/webm";
    }

    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/ogg;codecs=opus",
      "audio/wav",
    ];

    for (const type of candidates) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return "";
  }

  public static isSupported(): boolean {
    return (
      typeof window !== "undefined" &&
      navigator?.mediaDevices !== undefined &&
      typeof navigator.mediaDevices.getUserMedia === "function" &&
      typeof MediaRecorder !== "undefined"
    );
  }

  /**
   * Start microphone recording.
   */
  public async start(options: AudioRecorderOptions = {}): Promise<void> {
    if (!AudioRecorder.isSupported()) {
      throw new Error("Microphone recording is not supported in this browser");
    }

    if (this.mediaRecorder && this.mediaRecorder.state === "recording") {
      return;
    }

    this.recordedChunks = [];
    this.chosenMimeType = AudioRecorder.getSupportedMimeType();

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (err: any) {
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        throw new Error("Microphone permission was denied. Please enable mic access in your browser.");
      }
      throw new Error(`Failed to access microphone: ${err.message || err.name}`);
    }

    try {
      const recorderOptions: MediaRecorderOptions = this.chosenMimeType
        ? { mimeType: this.chosenMimeType }
        : {};
      this.mediaRecorder = new MediaRecorder(this.mediaStream, recorderOptions);
    } catch (err: any) {
      // Fallback without explicit mimeType
      this.mediaRecorder = new MediaRecorder(this.mediaStream);
    }

    this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
      if (event.data && event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };

    this.startTime = Date.now();
    this.mediaRecorder.start(250); // Emit chunks every 250ms

    // Auto-stop at max duration if specified (default: 60 seconds)
    const maxDurationSeconds = options.maxDurationSeconds ?? 60;
    if (maxDurationSeconds > 0) {
      this.maxDurationTimer = setTimeout(() => {
        options.onMaxDurationReached?.();
      }, maxDurationSeconds * 1000);
    }
  }

  /**
   * Stop recording and return the accumulated audio Blob.
   * Returns null if duration is under 400ms (accidental click/empty tap).
   */
  public async stop(): Promise<Blob | null> {
    this.clearMaxDurationTimer();

    if (!this.mediaRecorder || this.mediaRecorder.state === "inactive") {
      this.cleanupTracks();
      return null;
    }

    const duration = Date.now() - this.startTime;

    return new Promise<Blob | null>((resolve) => {
      if (!this.mediaRecorder) {
        this.cleanupTracks();
        resolve(null);
        return;
      }

      this.mediaRecorder.onstop = () => {
        try {
          if (duration < 400 || this.recordedChunks.length === 0) {
            resolve(null);
            return;
          }

          const mimeType = this.mediaRecorder?.mimeType || this.chosenMimeType || "audio/webm";
          const finalBlob = new Blob(this.recordedChunks, { type: mimeType });
          resolve(finalBlob);
        } finally {
          this.cleanupTracks();
        }
      };

      try {
        this.mediaRecorder.stop();
      } catch {
        this.cleanupTracks();
        resolve(null);
      }
    });
  }

  /**
   * Cancel and discard current recording.
   */
  public cancel(): void {
    this.clearMaxDurationTimer();
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      try {
        this.mediaRecorder.stop();
      } catch {
        // ignore
      }
    }
    this.cleanupTracks();
    this.recordedChunks = [];
  }

  public isRecording(): boolean {
    return this.mediaRecorder?.state === "recording";
  }

  private clearMaxDurationTimer(): void {
    if (this.maxDurationTimer) {
      clearTimeout(this.maxDurationTimer);
      this.maxDurationTimer = null;
    }
  }

  private cleanupTracks(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      this.mediaStream = null;
    }
    this.mediaRecorder = null;
  }
}
