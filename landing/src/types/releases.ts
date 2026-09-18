export type OSKey = 'windows' | 'mac' | 'linux';

export interface PlatformConfig {
  name: string;
  osKey: OSKey;
  architecture: string;
  packageType: string;
  dpiAware: string;
  assetPattern: RegExp;
  fallbackDownloadUrl: string;
  steps: { title: string; desc: string }[];
}

export interface PlatformReleaseState {
  name: string;
  osKey: OSKey;
  architecture: string;
  packageType: string;
  dpiAware: string;
  binaryName: string;
  fileSize: string;
  status: string;
  downloadUrl: string;
  isReady: boolean;
  steps: { title: string; desc: string }[];
}

export interface ReleaseHighlight {
  title: string;
  tag: string;
  description: string;
}

export interface NormalizedRelease {
  id: number | string;
  version: string;
  tagName: string;
  name: string;
  publishedAt: string;
  publishedDateFormatted: string;
  htmlUrl: string;
  body: string;
  highlights: ReleaseHighlight[];
  technicalNotes: string[];
  assets: {
    name: string;
    size: number;
    sizeFormatted: string;
    downloadUrl: string;
  }[];
}
