# 🐱 Tele-Stickers - Custom Cat Sticker Pack Maker

Tele-Stickers is a premium, 100% local, offline-capable single-page web application designed to prepare, style, and bundle cat stickers for Telegram. It is inspired by the clean aesthetics of the Fullyst sticker showcase pages, built entirely client-side with privacy in mind.

---

## ✨ Features

- **100% Local & Private**: All image conversions, filters, text overlays, and ZIP packaging happen entirely inside your browser. No files are ever uploaded to a server.
- **HEIC Image Support**: Integrates `heic2any` to automatically convert `.heic` and `.heif` images (common on modern mobile phones) to PNGs locally.
- **Sticker Styling Panel**:
  - **Auto-Cropping**: Automatically center-crops any rectangular photo into a perfect 512x512px square (as required by Telegram).
  - **Cartoon Effect**: Custom Sobel-edge pixel shader that quantizes colors (cel-shaded look), boosts saturation, and adds ink borders.
  - **Sticker Outlines**: Renders the classic thick white sticker border outline around transparent silhouettes or square boundaries.
  - **Drop Shadow**: Overlays a soft, blurred drop shadow to emulate the Telegram chat bubble styling.
  - **Meme Text Captioning**: Inserts customizable Impact meme text (white fill with thick black stroke) at the top, center, or bottom of the sticker.
  - **Emoji Mapping**: Easily assign standard reaction emojis to your sticker.
- **Fullyst-Style Showcase**: Preview all created stickers in a neat, dark glassmorphic grid showing mapped emojis. Edit, delete, or download individual files easily.
- **Bulk ZIP Packaging**: Bundles the entire pack into a structured `tele-stickers.zip` containing named transparent PNGs (e.g. `1_😻.png`) alongside a step-by-step upload guide.
- **Telegram Import Guide**: Built-in instructions explaining how to talk to the official `@Stickers` bot in Telegram to create and host your new pack.

---

## 🛠️ Technology Stack

- **Core**: Vanilla HTML5, JavaScript (ES modules)
- **Styling**: Vanilla CSS3 (Obsidian glassmorphic design theme with HSL colors, responsive layouts, and interactive micro-animations)
- **Dependencies**:
  - `jszip` - Dynamic client-side ZIP compilation
  - `heic2any` - Client-side HEIC to PNG conversion
  - `vite` - Local fast development server and build tool

---

## 🚀 Getting Started

### Prerequisites

Make sure you have [Node.js](https://nodejs.org/) installed.

### Setup and Running Locally

1. Clone or download this repository.
2. In the project directory (`tele-stickers/`), install the dependencies:
   ```bash
   npm install
   ```
3. Start the Vite local development server:
   ```bash
   npm run dev
   ```
4. Open your browser and navigate to the address shown in the terminal (usually `http://localhost:5173/`).

### Production Build

To compile a production bundle (HTML, CSS, JS assets ready to host on any static provider):
```bash
npm run build
```

---

## 📂 File Structure

```text
tele-stickers/
├── public/                 # Static assets
│   ├── favicon.svg         # App favicon
│   ├── icons.svg           # UI icons
│   ├── sample-cat-1.png    # Transparent sample sticker assets
│   ├── sample-cat-2.png
│   └── sample-cat-3.png
├── src/
│   ├── assets/             # Sub-assets
│   ├── style.css           # Styling guidelines, tokens, and animations
│   ├── main.js             # Navigation, drop handlers, and main orchestration
│   ├── editor.js           # Canvas operations, cartoon edge shader, and outlines
│   └── preview.js          # Showcase rendering, sync storage, and JSZip export
├── index.html              # Core single-page interface layout
├── package.json            # Configuration and dependencies
├── vite.config.js          # Vite configuration
└── README.md               # Project documentation
```

---

## 🔒 Privacy & Offline Capability

Tele-Stickers operates completely client-side. Once the page is loaded, the application can run fully offline in your browser. All processing data, image canvas buffers, and sticker metadata (synced via `localStorage`) never leave your local machine.
