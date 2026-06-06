/**
 * Tele-Stickers Preview Gallery & ZIP Exporter
 * Manages the Fullyst-style showcase, PNG downloads, and local JSZip packaging.
 */
import JSZip from 'jszip';

// Sticker Pack State (List of created stickers)
// Each sticker: { id: string, dataUrl: string, emojis: string, text: string }
export let stickersList = [];

// LocalStorage key
const STORAGE_KEY = 'tele_stickers_pack';

/**
 * Load stickers from LocalStorage
 */
export function loadStickers(onLoad) {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      stickersList = JSON.parse(saved);
    } else {
      stickersList = [];
    }
  } catch (e) {
    console.error('Failed to load stickers from localStorage:', e);
    stickersList = [];
  }
  if (onLoad) onLoad(stickersList);
}

/**
 * Save stickers to LocalStorage
 */
export function saveStickers() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stickersList));
    return true;
  } catch (e) {
    console.error('Failed to save stickers to localStorage:', e);
    // Revert the in-memory stickersList to what is actually in storage
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        stickersList = JSON.parse(saved);
      } else {
        stickersList = [];
      }
    } catch (reloadErr) {
      stickersList = [];
    }
    // Dispatch a custom event so main.js can display an error toast
    window.dispatchEvent(new CustomEvent('sticker-storage-error', { detail: e }));
    return false;
  }
}

/**
 * Add a sticker to the pack
 */
export function addSticker(dataUrl, text, onUpdate) {
  loadStickers();
  const newSticker = {
    id: 'sticker_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
    dataUrl,
    text
  };
  stickersList.push(newSticker);
  saveStickers();
  if (onUpdate) onUpdate(stickersList);
}

/**
 * Delete a sticker from the pack
 */
export function deleteSticker(id, onUpdate) {
  loadStickers();
  stickersList = stickersList.filter(s => s.id !== id);
  saveStickers();
  if (onUpdate) onUpdate(stickersList);
}

/**
 * Update an existing sticker in the pack
 */
export function updateSticker(id, dataUrl, text, onUpdate) {
  loadStickers();
  const index = stickersList.findIndex(s => s.id === id);
  if (index !== -1) {
    stickersList[index] = {
      ...stickersList[index],
      dataUrl,
      text
    };
    saveStickers();
    if (onUpdate) onUpdate(stickersList);
  }
}

/**
 * Render the Fullyst-style stickers grid
 */
export function renderStickersGrid(onEditSticker, onDeleteSticker) {
  const grid = document.getElementById('stickers-grid');
  const emptyView = document.getElementById('empty-grid-view');
  const countDisplay = document.getElementById('showcase-sticker-count');
  const badge = document.getElementById('pack-count-badge');
  const btnExport = document.getElementById('btn-export-zip');
  
  // Update badge and stats
  countDisplay.textContent = stickersList.length;
  badge.textContent = stickersList.length;
  
  if (stickersList.length === 0) {
    grid.style.display = 'none';
    emptyView.style.display = 'flex';
    btnExport.disabled = true;
    return;
  }
  
  grid.style.display = 'grid';
  emptyView.style.display = 'none';
  btnExport.disabled = false;
  
  grid.innerHTML = '';
  
  stickersList.forEach((sticker, index) => {
    const card = document.createElement('div');
    card.className = 'sticker-card';
    card.dataset.id = sticker.id;
    
    // Image wrapper
    const imgWrapper = document.createElement('div');
    imgWrapper.className = 'sticker-card-img-wrapper';
    const img = document.createElement('img');
    img.src = sticker.dataUrl;
    img.alt = `Sticker ${sticker.text || ''}`;
    img.loading = 'lazy';
    imgWrapper.appendChild(img);
    card.appendChild(imgWrapper);
    
    // Actions row
    const actions = document.createElement('div');
    actions.className = 'sticker-card-actions';
    
    // Download Single PNG Button
    const btnDownload = document.createElement('button');
    btnDownload.className = 'sticker-btn';
    btnDownload.title = 'Download transparent PNG';
    btnDownload.innerHTML = '<i class="fa-solid fa-download"></i>';
    btnDownload.addEventListener('click', (e) => {
      e.stopPropagation();
      downloadSingleSticker(sticker, index + 1);
    });
    
    // Edit Button
    const btnEdit = document.createElement('button');
    btnEdit.className = 'sticker-btn';
    btnEdit.title = 'Edit sticker';
    btnEdit.innerHTML = '<i class="fa-solid fa-pen-to-square"></i>';
    btnEdit.addEventListener('click', (e) => {
      e.stopPropagation();
      onEditSticker(sticker);
    });
    
    // Delete Button
    const btnDelete = document.createElement('button');
    btnDelete.className = 'sticker-btn delete-btn';
    btnDelete.title = 'Delete sticker';
    btnDelete.innerHTML = '<i class="fa-solid fa-trash"></i>';
    btnDelete.addEventListener('click', (e) => {
      e.stopPropagation();
      onDeleteSticker(sticker.id);
    });
    
    actions.appendChild(btnDownload);
    actions.appendChild(btnEdit);
    actions.appendChild(btnDelete);
    card.appendChild(actions);
    
    // Clicking card does same as Edit
    card.addEventListener('click', () => {
      onEditSticker(sticker);
    });
    
    grid.appendChild(card);
  });
}

/**
 * Downloads a single sticker
 */
function downloadSingleSticker(sticker, index) {
  const link = document.createElement('a');
  
  // Detect file format extension from dataUrl (default to png)
  const isWebp = sticker.dataUrl && sticker.dataUrl.startsWith('data:image/webp');
  const ext = isWebp ? 'webp' : 'png';
  
  link.download = `sticker_${index}.${ext}`;
  link.href = sticker.dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Pack all stickers into a single ZIP file locally in-browser and download it
 */
export async function exportPackAsZip() {
  if (stickersList.length === 0) return;
  
  const zip = new JSZip();
  const folder = zip.folder('tele-stickers');
  
  // Convert Data URLs to PNG or WEBP Blobs and add them to zip
  for (let i = 0; i < stickersList.length; i++) {
    const sticker = stickersList[i];
    
    // Detect file format extension from dataUrl (default to png)
    const isWebp = sticker.dataUrl && sticker.dataUrl.startsWith('data:image/webp');
    const ext = isWebp ? 'webp' : 'png';
    const filename = `${i + 1}.${ext}`;
    
    // Extract base64 binary from dataUrl
    const base64Data = sticker.dataUrl.split(',')[1];
    folder.file(filename, base64Data, { base64: true });
  }
  
  // Generate a README guide inside the ZIP
  const readmeContent = `Telegram Sticker Pack Guide
==================================================

How to Upload to Telegram:
1. Extract this ZIP folder (tele-stickers.zip).
2. Open Telegram and search for the official "@Stickers" bot (https://t.me/Stickers).
3. Send the "/newpack" command.
4. Choose a name for your sticker pack when prompted (e.g. "My Cat Stickers").
5. Send each PNG or WEBP image file as an UNCOMPRESSED DOCUMENT (not a photo) one by one.
6. The bot will ask for an emoji after each image file. Match the emoji from the filename!
7. Send "/publish" when done.
8. Set a unique shortname/link for your pack.

Created locally using Tele-Stickers.
`;
  zip.file('README_TELEGRAM.txt', readmeContent);
  
  // Compile ZIP and trigger browser download
  try {
    const blob = await zip.generateAsync({ type: 'blob' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'tele-stickers.zip';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    console.error('Error generating zip file:', err);
    alert('Failed to generate ZIP archive locally.');
  }
}
