import { defineConfig, minimal2023Preset as preset } from '@vite-pwa/assets-generator/config';

// icon.svg already has a full light-brown background, so no extra padding is needed.
const bg = { background: '#C49A6C' };

export default defineConfig({
  preset: {
    ...preset,
    maskable: { ...preset.maskable, padding: 0, resizeOptions: bg },
    apple: { ...preset.apple, padding: 0, resizeOptions: bg },
  },
  images: ['public/icon.svg'],
});
