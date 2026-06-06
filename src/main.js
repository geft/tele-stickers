/**
 * Tele-Stickers Main Application Script
 */
import './style.css';
import heic2any from 'heic2any';
import { initEditor, drawSticker, state } from './editor.js';
import {
  loadStickers,
  saveStickers,
  addSticker,
  deleteSticker,
  renderStickersGrid,
  exportPackAsZip,
  stickersList
} from './preview.js';

// DOM Elements
const canvas = document.getElementById('sticker-canvas');
const placeholder = document.getElementById('canvas-placeholder');
const fileInput = document.getElementById('file-input');
const dropZone = document.getElementById('drop-zone');
const loader = document.getElementById('uploader-loader');
const loaderStatus = document.getElementById('loader-status');
const btnAddSticker = document.getElementById('btn-add-sticker');
const chatStickerImg = document.getElementById('chat-sticker-img');
const chatStickerPlaceholder = document.getElementById('chat-sticker-placeholder');

// Pack info elements
const packNameInput = document.getElementById('pack-name-input');
const packIdInput = document.getElementById('pack-id-input');
const showcasePackTitle = document.getElementById('showcase-pack-title');
const showcasePackId = document.getElementById('showcase-pack-id');

// Tabs elements
const tabButtons = document.querySelectorAll('.nav-tab');
const tabContents = document.querySelectorAll('.tab-content');

// Theme Switcher elements
const themeButtons = document.querySelectorAll('.theme-btn');
const chatPreviewContainer = document.getElementById('chat-preview-container');

// Navigation buttons inside templates
const btnGotoGuide = document.getElementById('btn-goto-guide');
const btnEmptyGotoBuilder = document.getElementById('btn-empty-goto-builder');
const btnGuideGotoBuilder = document.getElementById('btn-guide-goto-builder');
const btnExportZip = document.getElementById('btn-export-zip');

/**
 * Handle redraw and sync preview image in chat bubble
 */
function handleCanvasRedraw() {
  drawSticker(canvas);
  
  if (state.sourceImage) {
    const dataUrl = canvas.toDataURL('image/png');
    chatStickerImg.src = dataUrl;
    chatStickerImg.style.display = 'block';
    chatStickerPlaceholder.style.display = 'none';
  } else {
    chatStickerImg.style.display = 'none';
    chatStickerPlaceholder.style.display = 'flex';
  }
}

/**
 * Setup Tab Navigation
 */
function initNavigation() {
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.dataset.tab;
      
      // Toggle button active states
      tabButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      
      // Toggle tab display
      tabContents.forEach(content => {
        if (content.id === `tab-${tabName}`) {
          content.classList.add('active');
        } else {
          content.classList.remove('active');
        }
      });
      
      // Re-render grid if switching to showcase
      if (tabName === 'showcase') {
        renderStickersGrid(onEditSticker, onDeleteSticker);
      }
    });
  });
  
  // Navigation shortcuts inside templates
  btnGotoGuide.addEventListener('click', () => {
    document.getElementById('tab-btn-guide').click();
  });
  
  btnEmptyGotoBuilder.addEventListener('click', () => {
    document.getElementById('tab-btn-generator').click();
  });
  
  btnGuideGotoBuilder.addEventListener('click', () => {
    document.getElementById('tab-btn-generator').click();
  });
}

/**
 * Initialize Telegram Chat Preview Themes
 */
function initThemeSwitcher() {
  themeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      themeButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const theme = btn.dataset.chatTheme;
      chatPreviewContainer.className = `chat-container ${theme}`;
    });
  });
}

/**
 * Setup Pack Metadata Sync
 */
function initPackMetadata() {
  // Load saved metadata from localStorage if exists
  const savedName = localStorage.getItem('tele_stickers_pack_name') || 'My Cat Stickers';
  const savedId = localStorage.getItem('tele_stickers_pack_id') || 'my_cat_stickers';
  
  packNameInput.value = savedName;
  packIdInput.value = savedId;
  
  showcasePackTitle.textContent = savedName;
  showcasePackId.textContent = savedId;
  
  packNameInput.addEventListener('input', (e) => {
    const val = e.target.value || 'My Cat Stickers';
    showcasePackTitle.textContent = val;
    localStorage.setItem('tele_stickers_pack_name', val);
  });
  
  packIdInput.addEventListener('input', (e) => {
    // Sanitize pack ID: letters, numbers, underscores only
    const val = e.target.value.replace(/[^a-zA-Z0-9_]/g, '') || 'my_cat_stickers';
    e.target.value = val;
    showcasePackId.textContent = val;
    localStorage.setItem('tele_stickers_pack_id', val);
  });
}

/**
 * Handle File Import (HEIC and Standard formats)
 */
async function processUploadedFile(file) {
  if (!file) return;
  
  // Show spinner, hide uploader text
  dropZone.style.display = 'none';
  loader.style.display = 'flex';
  btnAddSticker.disabled = true;
  
  try {
    let imageBlob = file;
    
    // HEIC Conversion check
    const isHEIC = file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif') || file.type === 'image/heic' || file.type === 'image/heif';
    
    if (isHEIC) {
      loaderStatus.textContent = 'Converting HEIC format locally...';
      // Convert HEIC file to standard PNG blob locally
      const conversionResult = await heic2any({
        blob: file,
        toType: 'image/png'
      });
      // heic2any can return an array or a single blob
      imageBlob = Array.isArray(conversionResult) ? conversionResult[0] : conversionResult;
    }
    
    loaderStatus.textContent = 'Loading image...';
    
    // Load blob into Image element
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        state.sourceImage = img;
        
        // Hide loader, show canvas
        loader.style.display = 'none';
        dropZone.style.display = 'flex';
        canvas.style.display = 'block';
        placeholder.style.display = 'none';
        btnAddSticker.disabled = false;
        
        // Redraw sticker canvas & chat preview
        handleCanvasRedraw();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(imageBlob);
    
  } catch (error) {
    console.error('Error processing image file:', error);
    alert('Failed to process image. Make sure it is a valid HEIC, PNG, or JPEG file.');
    loader.style.display = 'none';
    dropZone.style.display = 'flex';
  }
}

/**
 * Setup File Drag & Drop
 */
function initFileUploader() {
  // Click drop zone triggers file input
  dropZone.addEventListener('click', () => fileInput.click());
  
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      processUploadedFile(e.target.files[0]);
    }
  });
  
  // Drag over handlers
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });
  
  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
  });
  
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    if (e.dataTransfer.files.length > 0) {
      processUploadedFile(e.dataTransfer.files[0]);
    }
  });
}

/**
 * Edit Callback from Showcase
 */
function onEditSticker(sticker) {
  // Load sticker info into editor state
  state.captionText = sticker.text || '';
  state.emojis = sticker.emojis || '🐱';
  
  // Set UI inputs
  document.getElementById('caption-input').value = state.captionText;
  document.getElementById('emoji-input').value = state.emojis;
  
  // Set sourceImage to sticker's data URL
  loader.style.display = 'flex';
  loaderStatus.textContent = 'Loading sticker...';
  
  const img = new Image();
  img.onload = () => {
    state.sourceImage = img;
    loader.style.display = 'none';
    canvas.style.display = 'block';
    placeholder.style.display = 'none';
    btnAddSticker.disabled = false;
    
    // Switch to Builder tab
    document.getElementById('tab-btn-generator').click();
    
    // Update emojis picker active styling
    const picker = document.getElementById('emoji-picker');
    const btns = picker.querySelectorAll('.emoji-btn');
    btns.forEach(btn => {
      if (state.emojis.includes(btn.textContent)) {
        btn.classList.add('selected');
      } else {
        btn.classList.remove('selected');
      }
    });
    
    handleCanvasRedraw();
  };
  img.src = sticker.dataUrl;
}

/**
 * Delete Callback from Showcase
 */
function onDeleteSticker(id) {
  if (confirm('Are you sure you want to delete this sticker?')) {
    deleteSticker(id, () => {
      renderStickersGrid(onEditSticker, onDeleteSticker);
    });
  }
}

/**
 * Programmatically fetch and load sample assets into pack on first run
 */
async function loadSampleStickers() {
  const samples = [
    { url: '/sample-cat-1.png', emojis: '😻', text: 'HAPPY' },
    { url: '/sample-cat-2.png', emojis: '🙀', text: 'WHAT?!' },
    { url: '/sample-cat-3.png', emojis: '😡', text: 'GRUMPY' }
  ];
  
  for (const sample of samples) {
    try {
      const response = await fetch(sample.url);
      if (!response.ok) continue;
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        addSticker(reader.result, sample.emojis, sample.text, () => {
          renderStickersGrid(onEditSticker, onDeleteSticker);
        });
      };
      reader.readAsDataURL(blob);
    } catch (e) {
      console.error('Failed to load sample sticker:', sample.url, e);
    }
  }
}

/**
 * Application Entry Point
 */
function main() {
  // 1. Navigation
  initNavigation();
  
  // 2. Chat Preview switcher
  initThemeSwitcher();
  
  // 3. Metadata sync
  initPackMetadata();
  
  // 4. File uploader
  initFileUploader();
  
  // 5. Initialize canvas editor bindings
  initEditor(canvas, handleCanvasRedraw);
  
  // 6. Load stickers from local storage
  loadStickers((loaded) => {
    // If pack is brand new and empty, load the sample stickers
    if (loaded.length === 0) {
      loadSampleStickers();
    } else {
      renderStickersGrid(onEditSticker, onDeleteSticker);
    }
  });
  
  // 7. Add to Pack button
  btnAddSticker.addEventListener('click', () => {
    if (!state.sourceImage) return;
    
    // Draw and capture canvas as DataURL
    drawSticker(canvas);
    const dataUrl = canvas.toDataURL('image/png');
    
    // Save sticker to pack list
    addSticker(dataUrl, state.emojis, state.captionText, () => {
      renderStickersGrid(onEditSticker, onDeleteSticker);
      
      // Smooth animation transition to Showcase Tab
      setTimeout(() => {
        document.getElementById('tab-btn-showcase').click();
      }, 300);
    });
  });
  
  // 8. ZIP export button
  btnExportZip.addEventListener('click', () => {
    const packName = packNameInput.value || 'My Cat Stickers';
    const packId = packIdInput.value || 'my_cat_stickers';
    exportPackAsZip(packName, packId);
  });
}

// Start application
main();
