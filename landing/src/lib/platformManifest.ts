import type { OSKey, PlatformConfig, PlatformReleaseState, NormalizedRelease } from '../types/releases';

export const PLATFORM_CONFIGS: Record<OSKey, PlatformConfig> = {
  windows: {
    name: 'Windows',
    osKey: 'windows',
    architecture: 'x64 (64-bit Windows 10/11)',
    packageType: 'NSIS Installer (.exe)',
    dpiAware: 'Per-Monitor V2 (True High-DPI)',
    assetPattern: /\.exe$/i,
    fallbackDownloadUrl: 'https://github.com/badalsahani20/notesify/releases',
    steps: [
      {
        title: 'Open the installer',
        desc: 'Locate the downloaded Notesify setup (.exe) in your browser downloads or folder.',
      },
      {
        title: 'Run Windows setup',
        desc: 'If SmartScreen displays a warning, click "More info" → "Run anyway". The DPI-aware installer handles the rest.',
      },
      {
        title: 'Launch & start studying',
        desc: 'Open Notesify from your Desktop shortcut or Start Menu. Sign in and experience offline AI notes.',
      },
    ],
  },
  mac: {
    name: 'macOS',
    osKey: 'mac',
    architecture: 'Universal (Apple Silicon M-Series & Intel)',
    packageType: 'Apple Disk Image (.dmg)',
    dpiAware: 'Native Retina Resolution',
    assetPattern: /\.dmg$/i,
    fallbackDownloadUrl: 'https://github.com/badalsahani20/notesify/releases',
    steps: [
      {
        title: 'Mount the disk image',
        desc: 'Open the downloaded .dmg file to mount the Notesify installer volume.',
      },
      {
        title: 'Drag to Applications',
        desc: 'Drag the Notesify icon into your macOS Applications folder.',
      },
      {
        title: 'Launch & authorize',
        desc: 'Open Notesify from Spotlight or Launchpad. You can also run the full experience in your browser right now.',
      },
    ],
  },
  linux: {
    name: 'Linux',
    osKey: 'linux',
    architecture: 'x86_64 (64-bit)',
    packageType: 'AppImage / Standalone',
    dpiAware: 'Wayland & X11 Compatible',
    assetPattern: /\.AppImage$/i,
    fallbackDownloadUrl: 'https://github.com/badalsahani20/notesify/releases',
    steps: [
      {
        title: 'Download AppImage',
        desc: 'Save the Notesify .AppImage to your preferred directory (e.g., ~/Applications).',
      },
      {
        title: 'Grant execution permissions',
        desc: 'Run `chmod +x <filename>.AppImage` in your terminal or right-click → Properties → Allow executing.',
      },
      {
        title: 'Run Notesify',
        desc: 'Execute `./<filename>.AppImage` directly or pin it to your desktop launcher.',
      },
    ],
  },
};

/**
 * Derives dynamic platform state by matching release assets against the platform manifest
 */
export function resolvePlatformState(
  osKey: OSKey,
  release?: NormalizedRelease
): PlatformReleaseState {
  const config = PLATFORM_CONFIGS[osKey] || PLATFORM_CONFIGS.windows;

  // Search release assets for matching binary
  const matchingAsset = release?.assets.find((a) => config.assetPattern.test(a.name));

  if (matchingAsset) {
    return {
      name: config.name,
      osKey: config.osKey,
      architecture: config.architecture,
      packageType: config.packageType,
      dpiAware: config.dpiAware,
      binaryName: matchingAsset.name,
      fileSize: matchingAsset.sizeFormatted,
      status: 'Official Release Ready',
      downloadUrl: matchingAsset.downloadUrl,
      isReady: true,
      steps: config.steps,
    };
  }

  // Preview or unreleased platform state
  const cleanVersion = release?.version.replace(/^v/, '') || '1.2.0';
  const fallbackBinary =
    osKey === 'mac'
      ? `Notesify-${cleanVersion}-universal.dmg`
      : osKey === 'linux'
      ? `Notesify-${cleanVersion}.AppImage`
      : `Notesify.Setup.${cleanVersion}.exe`;

  return {
    name: config.name,
    osKey: config.osKey,
    architecture: config.architecture,
    packageType: config.packageType,
    dpiAware: config.dpiAware,
    binaryName: fallbackBinary,
    fileSize: 'Preview Build',
    status: 'Desktop Preview / Web App Ready',
    downloadUrl: release?.htmlUrl || config.fallbackDownloadUrl,
    isReady: false,
    steps: config.steps,
  };
}
