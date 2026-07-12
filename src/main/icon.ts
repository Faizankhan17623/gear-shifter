import { nativeImage, type NativeImage } from 'electron';

/**
 * Generates a small gear-shifter glyph (a stylized "H" gate with a knob dot)
 * as a PNG data URL, so the app doesn't depend on a bundled binary asset.
 * Rendered at 64x64 and scaled down by the OS for the tray.
 */
function buildIconDataUrl(): string {
  const size = 64;
  const canvasSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
  <rect x="0" y="0" width="64" height="64" rx="14" fill="#1a1a1f"/>
  <g stroke="#e8672c" stroke-width="4" stroke-linecap="round" fill="none">
    <path d="M20 14 L20 50"/>
    <path d="M44 14 L44 50"/>
    <path d="M20 32 L44 32"/>
  </g>
  <circle cx="32" cy="32" r="6" fill="#f4a340"/>
</svg>`.trim();
  const base64 = Buffer.from(canvasSvg, 'utf-8').toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}

export function createAppIcon(): NativeImage {
  return nativeImage.createFromDataURL(buildIconDataUrl());
}

export function createTrayIcon(): NativeImage {
  // Tray icons look best small; nativeImage will downscale as needed.
  const img = nativeImage.createFromDataURL(buildIconDataUrl());
  return img.resize({ width: 32, height: 32 });
}
