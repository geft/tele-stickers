/**
 * Tele-Stickers Main Application Script
 */
import './style.css';
import heic2any from 'heic2any';
import { initEditor, drawSticker, state, setupCropPicker, syncUIFromState } from './editor.js';
import {
  loadStickers,
  saveStickers,
  addSticker,
  updateSticker,
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
const btnResetEditor = document.getElementById('btn-reset-editor');
const chatStickerImg = document.getElementById('chat-sticker-img');
const chatStickerPlaceholder = document.getElementById('chat-sticker-placeholder');


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
    // Generate webp format (high compression) with png fallback to prevent storage limits
    let dataUrl;
    try {
      dataUrl = canvas.toDataURL('image/webp', 0.85);
      if (!dataUrl || !dataUrl.startsWith('data:image/webp')) {
        dataUrl = canvas.toDataURL('image/png');
      }
    } catch (e) {
      dataUrl = canvas.toDataURL('image/png');
    }
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
    const isHEIC = file.name && (file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif') || file.type === 'image/heic' || file.type === 'image/heif');
    
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

    // Save original blob in editor state
    state.originalBlob = imageBlob;
    
    loaderStatus.textContent = 'Loading image...';
    
    // Load blob into Image element
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        try {
          state.sourceImage = img;
          
          // Reset crop position and zoom for each new image
          state.cropOffsetX = 0.5;
          state.cropOffsetY = 0.5;
          state.cropZoom    = 1.0;
          
          // Hide loader, show canvas
          loader.style.display = 'none';
          dropZone.style.display = 'flex';
          canvas.style.display = 'block';
          placeholder.style.display = 'none';
          btnAddSticker.disabled = false;
          
          // Mount the crop picker widget (hidden automatically for square images)
          setupCropPicker(img, handleCanvasRedraw);
          
          // Redraw sticker canvas & chat preview
          handleCanvasRedraw();
        } catch (err) {
          console.error('[img.onload] Error during image setup:', err);
          loader.style.display = 'none';
          dropZone.style.display = 'flex';
        }
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
 * Setup File Drag & Drop (supports both local files and webpage image drag-drops)
 */
function initFileUploader() {
  // Prevent browser default drop action (like opening the image) on the whole window
  window.addEventListener('dragover', (e) => {
    e.preventDefault();
  }, false);
  
  window.addEventListener('drop', (e) => {
    e.preventDefault();
  }, false);

  // Click drop zone triggers file input
  dropZone.addEventListener('click', () => fileInput.click());
  
  fileInput.addEventListener('change', (e) => {
    console.log('File input change detected. Selected files:', e.target.files.length);
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
  
  dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    
    console.log('Drop event on drop-zone. Files count:', e.dataTransfer.files ? e.dataTransfer.files.length : 0);
    
    // 1. Try to get file from e.dataTransfer.files
    let file = null;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      file = e.dataTransfer.files[0];
    } 
    // 2. Try to get file from e.dataTransfer.items as a fallback
    else if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      for (let i = 0; i < e.dataTransfer.items.length; i++) {
        if (e.dataTransfer.items[i].kind === 'file') {
          file = e.dataTransfer.items[i].getAsFile();
          console.log('Found file in dataTransfer.items:', file ? file.name : 'null');
          break;
        }
      }
    }
    
    if (file) {
      console.log('Processing dropped file:', file.name, file.size, file.type);
      processUploadedFile(file);
    } else {
      // Check if they dragged a URL/Image from the webpage itself
      const url = e.dataTransfer.getData('URL') || e.dataTransfer.getData('text/uri-list');
      console.log('No file detected in drop. Extracted URL:', url);
      
      if (url && !url.startsWith('about:') && (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:'))) {
        dropZone.style.display = 'none';
        loader.style.display = 'flex';
        loaderStatus.textContent = 'Fetching dragged image...';
        btnAddSticker.disabled = true;
        
        try {
          const response = await fetch(url);
          const blob = await response.blob();
          
          // Create a File object to mimic local files
          const filename = url.split('/').pop() || 'dragged_image.png';
          const fileObj = new File([blob], filename, { type: blob.type });
          
          await processUploadedFile(fileObj);
        } catch (error) {
          console.error('Failed to fetch dropped image URL:', error);
          alert('Could not load image from that link.');
          loader.style.display = 'none';
          dropZone.style.display = 'flex';
        }
      } else if (url) {
        console.warn('Ignored invalid or blocked drop URL:', url);
      } else {
        console.warn('No valid files or URLs found in dropped data.');
      }
    }
  });
}

/**
 * Edit Callback from Showcase
 */
function onEditSticker(sticker) {
  // Reset crop offsets and zoom
  state.cropOffsetX = 0.5;
  state.cropOffsetY = 0.5;
  state.cropZoom    = 1.0;
  
  // Reset other styling parameters (to prevent double-applying baked filters)
  state.outlineEnabled = false;
  state.shadowEnabled  = false;
  
  // Load sticker info into editor state
  state.captionText = sticker.text || '';
  state.editingStickerId = sticker.id;
  
  // Sync the DOM input elements with the new clean state
  syncUIFromState();
  
  // Hide the crop picker viewport since it's already a square baked sticker image
  setupCropPicker(null, handleCanvasRedraw);
  
  // Update main button label & display cancel
  btnAddSticker.innerHTML = '<i class="fa-solid fa-check"></i> Save Changes';
  document.getElementById('btn-cancel-edit').style.display = 'block';
  
  // Set sourceImage to sticker's data URL
  loader.style.display = 'flex';
  loaderStatus.textContent = 'Loading sticker...';
  
  const img = new Image();
  img.onload = () => {
    state.sourceImage = img;
    state.originalBlob = null; // No original file for existing edited stickers
    loader.style.display = 'none';
    canvas.style.display = 'block';
    placeholder.style.display = 'none';
    btnAddSticker.disabled = false;
    
    // Switch to Builder tab
    document.getElementById('tab-btn-generator').click();
    
    // Sync UI again to ensure emojis picker is correctly highlighted
    syncUIFromState();
    
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
    { url: '/sample-cat-1.png', text: 'HAPPY' },
    { url: '/sample-cat-2.png', text: 'WHAT?!' },
    { url: '/sample-cat-3.png', text: 'GRUMPY' }
  ];
  
  for (const sample of samples) {
    try {
      const response = await fetch(sample.url);
      if (!response.ok) continue;
      const blob = await response.blob();
      
      const reader = new FileReader();
      reader.onloadend = () => {
        addSticker(reader.result, sample.text, () => {
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
  

  // 4. File uploader
  initFileUploader();
  
  // 5. Initialize canvas editor bindings
  initEditor(canvas, handleCanvasRedraw);
  
  // 6. Load stickers from local storage
  loadStickers((loaded) => {
    // If pack is brand new and empty (and never initialized before), load the sample stickers
    const isInitialized = localStorage.getItem('tele_stickers_initialized');
    if (loaded.length === 0 && !isInitialized) {
      localStorage.setItem('tele_stickers_initialized', 'true');
      loadSampleStickers();
    } else {
      renderStickersGrid(onEditSticker, onDeleteSticker);
    }
    
    // Automatically migrate any existing PNG stickers to compressed WEBP to free up storage
    migrateStickersToWebp(loaded);
  });

  // Listen for storage events from other tabs to sync showcase grid automatically
  window.addEventListener('storage', (e) => {
    if (e.key === 'tele_stickers_pack') {
      loadStickers(() => {
        renderStickersGrid(onEditSticker, onDeleteSticker);
      });
    }
  });


  // 7. Add to Pack / Save Changes button
  btnAddSticker.addEventListener('click', () => {
    if (!state.sourceImage) return;
    
    // Draw and capture canvas as DataURL (compress to WEBP with PNG fallback)
    drawSticker(canvas);
    let dataUrl;
    try {
      dataUrl = canvas.toDataURL('image/webp', 0.85);
      if (!dataUrl || !dataUrl.startsWith('data:image/webp')) {
        dataUrl = canvas.toDataURL('image/png');
      }
    } catch (e) {
      dataUrl = canvas.toDataURL('image/png');
    }
    
    if (state.editingStickerId) {
      updateSticker(state.editingStickerId, dataUrl, state.captionText, () => {
        renderStickersGrid(onEditSticker, onDeleteSticker);
        showToast('Sticker updated successfully!');
        
        // Reset edit state
        state.editingStickerId = null;
        btnAddSticker.innerHTML = '<i class="fa-solid fa-plus"></i> Add to Pack';
        document.getElementById('btn-cancel-edit').style.display = 'none';
        
        // Switch to Showcase
        setTimeout(() => {
          document.getElementById('tab-btn-showcase').click();
        }, 300);
      });
    } else {
      addSticker(dataUrl, state.captionText, () => {
        renderStickersGrid(onEditSticker, onDeleteSticker);
        showToast('Sticker added to pack!');
        
        // Reset the builder for next sticker
        btnResetEditor.click();
      });
    }
  });

  // Cancel Edit Button
  const btnCancelEdit = document.getElementById('btn-cancel-edit');
  btnCancelEdit.addEventListener('click', () => {
    state.editingStickerId = null;
    btnCancelEdit.style.display = 'none';
    btnAddSticker.innerHTML = '<i class="fa-solid fa-plus"></i> Add to Pack';
  });

  // Reset Editor / New Sticker Button
  btnResetEditor.addEventListener('click', () => {
    // Reset state
    state.sourceImage = null;
    state.originalBlob = null;
    state.editingStickerId = null;
    state.captionText = '';
    state.cropOffsetX = 0.5;
    state.cropOffsetY = 0.5;
    state.cropZoom    = 1.0;
    state.outlineEnabled = false;
    state.shadowEnabled  = false;

    // Sync all UI inputs to match the reset state
    syncUIFromState();

    // Hide crop picker
    setupCropPicker(null, handleCanvasRedraw);
    
    // Reset buttons
    btnAddSticker.innerHTML = '<i class="fa-solid fa-plus"></i> Add to Pack';
    btnAddSticker.disabled = true;
    btnCancelEdit.style.display = 'none';

    // Clear Canvas and show placeholder
    canvas.style.display = 'none';
    placeholder.style.display = 'flex';
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 512, 512);

    handleCanvasRedraw();
  });
  
  // 8. ZIP export button
  btnExportZip.addEventListener('click', () => {
    exportPackAsZip();
  });

  // 9. Crop "Reset to Center" button
  document.getElementById('btn-crop-center').addEventListener('click', () => {
    state.cropOffsetX = 0.5;
    state.cropOffsetY = 0.5;
    state.cropZoom    = 1.0;
    setupCropPicker(state.sourceImage, handleCanvasRedraw);
    handleCanvasRedraw();
  });

  // 10. Listen for storage quota errors from preview.js
  window.addEventListener('sticker-storage-error', () => {
    showToast('Storage full! Please delete some stickers or export your ZIP pack.', 'error');
  });
}

// Start application
main();

/**
 * Display a floating success or error toast notification
 */
function showToast(message, type = 'success') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  
  const toast = document.createElement('div');
  toast.className = `toast-notification ${type}`;
  
  const icon = type === 'success' 
    ? '<i class="fa-solid fa-circle-check"></i>' 
    : '<i class="fa-solid fa-circle-exclamation"></i>';
    
  toast.innerHTML = `${icon}<span>${message}</span>`;
  
  container.appendChild(toast);
  
  // Remove toast after animation ends (3 seconds total: 2.7s delay + 0.3s transition)
  setTimeout(() => {
    toast.remove();
    if (container.children.length === 0) {
      container.remove();
    }
  }, 3000);
}

/**
 * Automatically migrate any legacy base64 PNG stickers to base64 WEBP in the background
 */
async function migrateStickersToWebp(loaded) {
  if (!loaded || loaded.length === 0) return;
  
  let needsSave = false;
  for (let i = 0; i < loaded.length; i++) {
    const sticker = loaded[i];
    if (sticker.dataUrl && sticker.dataUrl.startsWith('data:image/png')) {
      try {
        const compressedUrl = await convertPngDataUrlToWebp(sticker.dataUrl);
        if (compressedUrl) {
          sticker.dataUrl = compressedUrl;
          needsSave = true;
        }
      } catch (e) {
        console.error('Failed to compress sticker during background migration:', sticker.id, e);
      }
    }
  }
  
  if (needsSave) {
    console.log('Background migration complete: Compacting stickers list and saving.');
    saveStickers();
    renderStickersGrid(onEditSticker, onDeleteSticker);
  }
}

/**
 * Helper to convert a PNG Data URL to a WEBP Data URL via canvas
 */
function convertPngDataUrlToWebp(pngUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = img.naturalWidth || img.width || 512;
        tempCanvas.height = img.naturalHeight || img.height || 512;
        const ctx = tempCanvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        
        const webpUrl = tempCanvas.toDataURL('image/webp', 0.85);
        if (webpUrl && webpUrl.startsWith('data:image/webp')) {
          resolve(webpUrl);
        } else {
          resolve(null);
        }
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = (err) => reject(err);
    img.src = pngUrl;
  });
}
