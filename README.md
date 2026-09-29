# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

## Browser Export Engine (FFmpeg.wasm)

Architecture:
- `src/services/ffmpeg.ts`: owns the single FFmpeg.wasm instance, core loading and native progress events.
- `src/services/export.ts`: `exportProject(project, options, onProgress)` compiles editor state into an FFmpeg filter graph.
- `src/components/VideoEditor/ExportModal.tsx`: UI only; it never imports FFmpeg directly.

Implemented export path: sequential video clips, source trim, speed, canvas fit/pad, FPS/resolution, MP4/WebM, separate audio tracks with timeline delay/volume, and supported transitions (Fade/Dissolve via xfade fade, Slide, Wipe). Transform flip/scale has a basic mapping. Progress is driven by FFmpeg.wasm's `progress` event rather than a fake timer.

Deliberately not faked: Text font rendering, VisualElement compositing, keyframed transform expressions, Chroma Key, and Filter/Effect stacks that are not persisted in the current `EditorProject` model. The export service reports these limitations after export and keeps the project snapshot available for future compiler stages.

### Manual smoke tests
1. Single video: add one video -> Export -> 720p / 30 / MP4.
2. Video + audio: add an audio track/clip in project state -> verify timeline delay and volume in output.
3. Video + text: export completes but reports text as unsupported (no fake burn-in).
4. Video + filter: current model has no persisted filter stack; export reports this limitation.
5. Video + transition: place two video clips with Fade/Slide/Wipe transition -> export uses FFmpeg `xfade` when supported by the loaded core.
6. Video + keyframe: preview keyframes remain realtime; export reports keyframe expression compilation as not implemented rather than baking an incorrect result.

Note: the first export downloads the FFmpeg core/WASM from jsDelivr. For production/offline deployment, self-host `@ffmpeg/core` and change `CORE_BASE` in `services/ffmpeg.ts`.

## Import video from URL / TikTok

In Media, paste a direct MP4/WebM/MOV URL or the text copied with TikTok's Share → Copy link.
Click **Nhập video từ link**. The video is downloaded into the media library; **Thêm vào timeline**
also appends a clip ready for editing. Cancel is available during download. Maximum size: 256 MB.

Run `npm run setup:downloader` once to install the official yt-dlp release in `tools/`
(SHA-256 is checked). Run it again to update TikTok support. Alternatively set `YTDLP_PATH`
to your own yt-dlp executable. Source: https://github.com/yt-dlp/yt-dlp#installation

Restart `npm run dev` after this update. The local URL import endpoint is also available
with `npm run preview` after building and only accepts loopback connections.

### Deploy on Vercel

Set the Vercel project Root Directory to this folder (containing `package.json`, `api/`
and `vercel.json`), then redeploy. `/api/media/import` is a Node.js Function;
uploading only `dist/` to a static host does not provide this endpoint.
The build command in `vercel.json` installs the verified Linux yt-dlp binary and builds
the frontend. The binary is included in the function bundle, with a 180-second timeout.
Remove any dashboard Build Command override so this command runs. The build requires
access to GitHub releases. Downloads use temporary storage and stream to the browser.
TikTok may still reject requests from hosting-provider IP addresses; this is separate
from a missing API route. Concurrency is limited per function instance, not globally.

Only individual public TikTok videos and direct video files are supported. Private, login-required,
region-restricted or unavailable videos may fail. The importer does not request account cookies.
The original source media is downloaded; editing/export behavior is the same as a local file.
