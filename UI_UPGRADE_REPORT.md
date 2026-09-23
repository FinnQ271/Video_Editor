# Báo cáo nâng cấp UI/UX Video Editor

## Kết quả

Giao diện dark ba cột: thư viện bên trái, Preview ở giữa, Inspector riêng bên phải; timeline phía dưới. Inspector có thể thu gọn. Đã kiểm tra 1366×768, 1920×1080 và 1024×768.

- Theme tập trung trong `src/studio.css`: màu nền phân cấp, accent tím, border, typography, spacing 4/8/12/16/20/24, radius 6/8/12, trạng thái hover/selected/disabled/focus và reduced motion.
- Header có Undo/Redo, tên mặc định Untitled project, trạng thái chưa lưu ra đĩa, New project và Export làm hành động chính.
- Sáu tab Media, Audio, Text, Visual, Effects, Transitions. Chức năng gọi lại các action có sẵn trong editor.
- Text/Visual tách phần thêm nội dung ở thư viện và phần chỉnh sửa ở Inspector. Canvas ratio dạng lưới 2 cột; cài đặt timing/track của text nằm trong nhóm mở rộng.
- Icon SVG thống nhất cho các tab, playback, timeline, track và header; tooltip/aria-label cho các điều khiển icon.
- Playback toolbar, form controls, sliders, media cards, text presets, effect/transition cards và empty states được chuẩn hóa.
- Timeline có màu riêng cho video/audio/text/visual, trim handles rõ khi hover/selected, playhead mảnh và nằm trên clip. Không thêm transition CSS cho vị trí clip/playhead.
- Modal Export, Import URL, New project và History diagnostics dùng cơ chế focus chung: Tab/Shift+Tab, Escape, khôi phục focus; không đóng Export khi đang render.
- Không thêm dependency runtime. Package.json và package-lock.json giữ nguyên; công cụ Playwright đặt riêng trong `tools/ui-check` (được gitignore).

## File đã thay đổi

| File | Thay đổi |
| --- | --- |
| `src/index.css` | Reset global, loại bỏ theme starter không dùng |
| `src/App.css` | Giữ CSS cấu trúc hiện có, bỏ token/theme refresh trùng lặp |
| `src/studio.css` | Theme và styling UI thống nhất, responsive |
| `src/components/VideoEditor/VideoEditor.tsx` | Bố cục ba cột, header/history, Inspector, New project modal, keyboard guards |
| `src/components/VideoEditor/MediaPanel.tsx` | Sáu tab, URL modal, empty state và truy cập import |
| `src/components/VideoEditor/PropertiesPanel.tsx` | Nhóm Inspector, canvas-only/hide-canvas, đồng bộ draft UI |
| `src/components/VideoEditor/TextPanel.tsx` | Library/Inspector riêng, bỏ state text đồng bộ thừa |
| `src/components/VideoEditor/VisualPanel.tsx` | Library/Inspector riêng, selected mask và nhãn UI |
| `src/components/VideoEditor/Controls.tsx` | Icon SVG, nhãn truy cập, giữ các action playback |
| `src/components/VideoEditor/Timeline.tsx` | Icon và nhãn toolbar, Delete dùng action Cut/Remove hiện có |
| `src/components/VideoEditor/Track.tsx` | Icon track thống nhất |
| `src/components/VideoEditor/VisualTimelineTrack.tsx` | Icon visual track/clip |
| `src/components/VideoEditor/StudioIcon.tsx` | Mở rộng hệ SVG hiện có |
| `src/components/VideoEditor/ExportModal.tsx` | Modal chung, nhãn form, thông báo tiến trình |
| `src/components/VideoEditor/KeyframeEditor.tsx` | Heading và aria-label |
| `src/components/VideoEditor/VideoPreview.tsx` | Chỉ thêm aria-label cho tay nắm Resize/Rotate |
| `src/components/VideoEditor/HistoryTester.tsx` | Dùng modal chung và nhãn truy cập |
| `src/store/EditorContext.tsx` | Bổ sung trạng thái hiện tại vào 13 snapshot thiếu visualElements đang gây lỗi TypeScript; đổi một biến không gán lại sang const |
| `.gitignore` | Bỏ qua ảnh/video/kết quả kiểm thử UI sinh ra |

File mới:

- `src/components/VideoEditor/EditorDialog.tsx`: modal tái sử dụng với quản lý focus/bàn phím.
- `src/components/VideoEditor/LibraryTools.tsx`: Audio, Chroma Key và Transition cards gọi action sẵn có.
- `scripts/ui-regression.cjs`: regression trình duyệt với video/ảnh tự tạo.
- `UI_UPGRADE_REPORT.md`: báo cáo này.

## Logic được giữ nguyên

Không thay video source, vòng đời object URL, clock/currentTime, thuật toán move/trim/split, tính canvas aspect ratio, keyframe interpolation, cấu trúc clip, FFmpeg và export engine.

Ngoại lệ cần thiết để build: 13 chỗ trong EditorContext tạo snapshot thiếu `visualElements`. Thêm `...history.state` để giữ đầy đủ các field hiện có. Không thay thuật toán history/undo/redo.

Các chức năng chưa có được giữ đúng phạm vi: không tạo upload audio, fade audio, filter mới hay trạng thái Saved giả. Audio tab điều chỉnh âm lượng/mute/speed của clip hiện tại; Effects dùng Chroma Key hiện có. Không thêm preview zoom hay đổi resolution để mô phỏng zoom.

## Kiểm chứng

- `npm ci`: khôi phục dependencies đúng lockfile trước kiểm tra cuối.
- `npm run build`: **PASS**, gồm TypeScript `tsc -b` và Vite **8.0.1** production build.
- `node --test playback-regression.test.cjs export-regression.test.cjs`: **11/11 PASS**. Export unit tests dùng FFmpeg mock; kiểm thử trình duyệt bên dưới dùng FFmpeg thật.
- Bộ UI chạy trên Edge headless, trỏ vào bản production `http://127.0.0.1:4173`: **17 nhóm PASS**.
  - Layout 1366/1920/1024; nút Import nhìn thấy không cần cuộn ở 1366×768.
  - Import video, kiểm tra pixel video không đen, Play/Pause/Seek.
  - Split, Duplicate, Undo/Redo; Audio mute, Chroma Key, transition cards, zoom/fit timeline.
  - 16:9, 9:16, 1:1, 4:5: đúng hình học và Preview tiếp tục có hình.
  - Import ảnh, overlay, Original/Square/Circle/Triangle.
  - Resize ảnh trên timeline kèm Undo/Redo; thêm keyframe.
  - Thêm/chỉnh text, collapse/expand Inspector, Cancel New project.
  - Modal URL/Export, lựa chọn export, ước tính dung lượng.
  - Xuất và tải MP4 thật: giải mã được, **854×480**, dài khoảng **6 giây**, pixel không đen.
  - History diagnostics: **15/15 bước PASS**; focus trap và Escape trong modal.
  - **0 lỗi console/pageerror** trong các kịch bản đã chạy.
- Lint riêng 15 component UI đã chỉnh: **PASS**.
- `npm run lint` toàn dự án: **chưa pass**, còn **16 errors / 23 warnings** trong VideoPreview/EditorContext, chủ yếu React Compiler memoization, set-state-in-effect và dependencies của hooks hiện có. Không tắt luật lint hay refactor engine để che các lỗi này.

Kết quả/ảnh local:

- `ui-test-results/report.json`
- `ui-test-results/export-metadata.json`
- `ui-test-results/empty-1366.png`
- `ui-test-results/editing-1366.png`
- `ui-test-results/editing-1920.png`
- `ui-test-results/export-dialog.png`
- `ui-test-results/export.mp4`

Giới hạn kiểm thử: URL modal được kiểm tra tương tác/keyboard; chưa kiểm thử tải từ dịch vụ URL bên ngoài. Video export end-to-end kiểm tra MP4 480p/24fps với fixture nhỏ, không đại diện cho mọi codec, video dài hoặc mọi preset export. Mobile editor đầy đủ không thuộc phạm vi.

## Chạy lại

```powershell
npm ci
npm run build
node --test playback-regression.test.cjs export-regression.test.cjs
npm install --prefix tools/ui-check --no-save --package-lock=false playwright
npm run preview -- --host 127.0.0.1
```

Trong terminal khác (Edge đã được cài):

```powershell
$env:PLAYWRIGHT_MODULE=(Resolve-Path 'tools/ui-check/node_modules/playwright').Path
$env:UI_TEST_URL='http://127.0.0.1:4173'
$env:UI_TEST_EXPORT='1'
node scripts/ui-regression.cjs
```
