/**
 * Tele-Stickers Canvas Editor Engine
 * Handles image processing, cartoon shaders, borders, text, and emoji mappings.
 */

/**
 * Compute the source rectangle to crop from an image for a square sticker.
 *
 * @param {number} imgWidth   - Natural width of the source image (px)
 * @param {number} imgHeight  - Natural height of the source image (px)
 * @param {number} offsetX    - Horizontal pan offset [0, 1] (0=left, 0.5=centre, 1=right)
 * @param {number} offsetY    - Vertical pan offset   [0, 1]
 * @param {number} zoom       - Zoom level ≥1.0 (1=fit, 2=2× zoomed in)
 * @returns {{ srcX, srcY, srcWidth, srcHeight }}
 */
export function computeCropRect(imgWidth, imgHeight, offsetX, offsetY, zoom) {
  const minDim = Math.min(imgWidth, imgHeight);
  const cropSz = Math.round(minDim / zoom);
  const xSlack = imgWidth  - cropSz;
  const ySlack = imgHeight - cropSz;
  return {
    srcX:      Math.round(xSlack * offsetX),
    srcY:      Math.round(ySlack * offsetY),
    srcWidth:  cropSz,
    srcHeight: cropSz,
  };
}

// Global editor state
export const state = {
  sourceImage: null,
  originalBlob: null,
  editingStickerId: null,
  outlineEnabled: false,
  outlineThickness: 8,
  shadowEnabled: false,
  shadowBlur: 6,
  captionText: '',
  captionSize: 48,
  captionPos: 'bottom',
  // Crop: offset 0=start edge, 1=far edge, 0.5=center; zoom >1 = zoomed in
  cropOffsetX: 0.5,
  cropOffsetY: 0.5,
  cropZoom: 1.0,
};

/**
 * Initialize editor DOM listeners and sync with state
 */
export function initEditor(canvas, onStateChange) {
  const ctx = canvas.getContext('2d');
  
  // Grab controls from DOM
  const toggleBorder = document.getElementById('toggle-border');
  const borderSize = document.getElementById('border-size');
  const borderSizeVal = document.getElementById('border-size-val');
  const borderSizeContainer = document.getElementById('border-size-container');
  
  const toggleShadow = document.getElementById('toggle-shadow');
  const shadowBlur = document.getElementById('shadow-blur');
  const shadowBlurVal = document.getElementById('shadow-blur-val');
  const shadowBlurContainer = document.getElementById('shadow-size-container');
  
  const captionInput = document.getElementById('caption-input');
  const captionSize = document.getElementById('caption-size');
  const captionSizeVal = document.getElementById('caption-size-val');
  const captionPosRadios = document.getElementsByName('caption-pos');
  
  const btnAddSticker = document.getElementById('btn-add-sticker');
  
  // Set initial UI values from state
  toggleBorder.checked = state.outlineEnabled;
  borderSize.value = state.outlineThickness;
  borderSizeVal.textContent = state.outlineThickness;
  
  toggleShadow.checked = state.shadowEnabled;
  shadowBlur.value = state.shadowBlur;
  shadowBlurVal.textContent = state.shadowBlur;
  
  captionInput.value = state.captionText;
  captionSize.value = state.captionSize;
  captionSizeVal.textContent = state.captionSize;
  
  // Event Listeners
  toggleBorder.addEventListener('change', (e) => {
    state.outlineEnabled = e.target.checked;
    borderSizeContainer.style.display = state.outlineEnabled ? 'flex' : 'none';
    onStateChange();
  });
  
  borderSize.addEventListener('input', (e) => {
    state.outlineThickness = parseInt(e.target.value);
    borderSizeVal.textContent = state.outlineThickness;
    onStateChange();
  });
  
  toggleShadow.addEventListener('change', (e) => {
    state.shadowEnabled = e.target.checked;
    shadowBlurContainer.style.display = state.shadowEnabled ? 'flex' : 'none';
    onStateChange();
  });
  
  shadowBlur.addEventListener('input', (e) => {
    state.shadowBlur = parseInt(e.target.value);
    shadowBlurVal.textContent = state.shadowBlur;
    onStateChange();
  });
  
  captionInput.addEventListener('input', (e) => {
    state.captionText = e.target.value;
    onStateChange();
  });
  
  captionSize.addEventListener('input', (e) => {
    state.captionSize = parseInt(e.target.value);
    captionSizeVal.textContent = state.captionSize;
    onStateChange();
  });
  
  captionPosRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      state.captionPos = e.target.value;
      onStateChange();
    });
  });
}

/**
 * Renders the state image to the canvas applying all filters, outlines, shadows, and text overlays.
 */
export function drawSticker(canvas) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 512, 512);
  
  if (!state.sourceImage) {
    return;
  }
  
  // Create offscreen canvas for source image operations (512x512px)
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = 512;
  tempCanvas.height = 512;
  const tempCtx = tempCanvas.getContext('2d');
  
  // 1. Scale & center crop sourceImage to fit 512x512 with safe padding (to avoid clipping outlines)
  const padding = state.outlineEnabled ? state.outlineThickness + 10 : 10;
  const targetSize = 512 - (padding * 2);
  
  const imgWidth = state.sourceImage.width;
  const imgHeight = state.sourceImage.height;
  
  // Crop with user offset + zoom (delegates to the exported pure function).
  const { srcX, srcY, srcWidth, srcHeight } = computeCropRect(
    imgWidth, imgHeight,
    state.cropOffsetX, state.cropOffsetY,
    state.cropZoom
  );
  
  // Draw center-cropped into temp canvas
  tempCtx.drawImage(
    state.sourceImage,
    srcX, srcY, srcWidth, srcHeight,
    padding, padding, targetSize, targetSize
  );

  
  // 3. Compose Final Drawing on the visible Canvas
  
  // Drop Shadow
  if (state.shadowEnabled) {
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = state.shadowBlur;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 4;
    
    // The shadow should wrap the white outline (if enabled), or the image itself
    if (state.outlineEnabled) {
      drawOutlineSilhouette(ctx, tempCanvas, state.outlineThickness, 'white');
    } else {
      ctx.drawImage(tempCanvas, 0, 0);
    }
    ctx.restore();
  }
  
  // White Outline Sticker Border
  if (state.outlineEnabled) {
    drawOutlineSilhouette(ctx, tempCanvas, state.outlineThickness, 'white');
  }
  
  // Draw the actual image on top
  ctx.drawImage(tempCanvas, 0, 0);
  
  // Draw Meme Caption overlay
  if (state.captionText.trim() !== '') {
    ctx.save();
    const size = state.captionSize;
    ctx.font = `900 ${size}px Impact, "Arial Black", sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = size / 6;
    ctx.lineJoin = 'round';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    let x = 256;
    let y = 256;
    
    if (state.captionPos === 'top') {
      y = padding + size/2 + 20;
    } else if (state.captionPos === 'bottom') {
      y = 512 - padding - size/2 - 20;
    }
    
    // Stroke (black border) first, then fill (white text)
    ctx.strokeText(state.captionText.toUpperCase(), x, y);
    ctx.fillText(state.captionText.toUpperCase(), x, y);
    ctx.restore();
  }
}

/**
 * Helper: Draws a silhouette/outline around transparent/non-transparent boundaries of an offscreen canvas
 */
function drawOutlineSilhouette(ctx, srcCanvas, thickness, color) {
  // Create an offscreen silhouette canvas
  const sCanvas = document.createElement('canvas');
  sCanvas.width = 512;
  sCanvas.height = 512;
  const sCtx = sCanvas.getContext('2d');
  
  sCtx.drawImage(srcCanvas, 0, 0);
  sCtx.globalCompositeOperation = 'source-in';
  sCtx.fillStyle = color;
  sCtx.fillRect(0, 0, 512, 512);
  
  // Draw silhouette translated in 16 directions to create a smooth outline circle
  const steps = 16;
  for (let i = 0; i < steps; i++) {
    const angle = (i / steps) * Math.PI * 2;
    const dx = Math.cos(angle) * thickness;
    const dy = Math.sin(angle) * thickness;
    ctx.drawImage(sCanvas, dx, dy);
  }
}



/**
 * Mounts an interactive drag-to-reposition crop picker.
 * Shows the full source image scaled to fit inside a fixed square window;
 * the user pans the image to choose which region gets cropped.
 *
 * Call whenever a new image is loaded. Pass null to hide the widget.
 *
 * @param {HTMLImageElement|null} sourceImage
 * @param {Function} onUpdate  Called after each drag movement to redraw the canvas.
 */
export function setupCropPicker(sourceImage, onUpdate) {
  const section    = document.getElementById('crop-picker-section');
  const viewport   = document.getElementById('crop-viewport');
  const imgEl      = document.getElementById('crop-img');
  const hint       = document.getElementById('crop-hint');
  const zoomSlider = document.getElementById('crop-zoom');
  const zoomVal    = document.getElementById('crop-zoom-val');

  // Guard: hide if no image provided
  if (!sourceImage) {
    if (section) section.style.display = 'none';
    return;
  }

  const imgW = sourceImage.naturalWidth;
  const imgH = sourceImage.naturalHeight;

  // Wait for the browser to fully decode the image if needed
  if (imgW === 0 || imgH === 0) {
    console.warn('[CropPicker] naturalWidth/Height not ready, waiting for decode...');
    sourceImage.decode()
      .then(() => setupCropPicker(sourceImage, onUpdate))
      .catch(() => console.error('[CropPicker] Image decode failed.'));
    return;
  }

  console.log(`[CropPicker] Image dimensions: ${imgW}\u00d7${imgH}`);
  section.style.display = 'block';
  imgEl.src = sourceImage.src;

  const VIEWPORT_PX = 220; // matches CSS .crop-viewport width/height
  const MIN_ZOOM    = 1.0;
  const MAX_ZOOM    = 4.0;

  // Mutable dims shared between refresh() and event handlers via closure
  const dims = { xRange: 0, yRange: 0 };

  /** Recalculate display size & position from current state.cropZoom / offsets */
  const refresh = () => {
    const scale = (VIEWPORT_PX * state.cropZoom) / Math.min(imgW, imgH);
    const dispW = Math.round(imgW * scale);
    const dispH = Math.round(imgH * scale);
    dims.xRange = Math.max(0, dispW - VIEWPORT_PX);
    dims.yRange = Math.max(0, dispH - VIEWPORT_PX);

    imgEl.style.width  = dispW + 'px';
    imgEl.style.height = dispH + 'px';

    // Clamp offsets then reposition
    state.cropOffsetX = Math.max(0, Math.min(1, state.cropOffsetX));
    state.cropOffsetY = Math.max(0, Math.min(1, state.cropOffsetY));
    imgEl.style.left = -(dims.xRange * state.cropOffsetX) + 'px';
    imgEl.style.top  = -(dims.yRange * state.cropOffsetY) + 'px';
  };

  const syncZoomUI = () => {
    zoomSlider.value    = Math.round(state.cropZoom * 100);
    zoomVal.textContent = state.cropZoom.toFixed(1) + '\u00d7';
    const canPan = dims.xRange > 0 || dims.yRange > 0;
    hint.textContent = canPan
      ? 'Drag to reposition \u00b7 scroll to zoom'
      : 'Scroll or use slider to zoom in';
  };

  // Initial render
  refresh();
  syncZoomUI();

  // Zoom slider
  zoomSlider.oninput = (e) => {
    state.cropZoom = parseInt(e.target.value) / 100;
    refresh();
    syncZoomUI();
    onUpdate();
  };

  // ── Event listeners (cleaned up on next call via AbortController) ─────────
  if (viewport._cropAbort) viewport._cropAbort.abort();
  const ac = new AbortController();
  const { signal } = ac;
  viewport._cropAbort = ac;

  // ── Drag to pan ───────────────────────────────────────────────────────────
  let dragging = false;
  let startX, startY, startLeft, startTop;

  const onPointerDown = (clientX, clientY) => {
    if (dims.xRange === 0 && dims.yRange === 0) return;
    dragging  = true;
    startX    = clientX;
    startY    = clientY;
    startLeft = parseFloat(imgEl.style.left) || 0;
    startTop  = parseFloat(imgEl.style.top)  || 0;
    viewport.style.cursor = 'grabbing';
  };

  const onPointerMove = (clientX, clientY) => {
    if (!dragging) return;
    const newLeft = Math.max(-dims.xRange, Math.min(0, startLeft + (clientX - startX)));
    const newTop  = Math.max(-dims.yRange, Math.min(0, startTop  + (clientY - startY)));
    imgEl.style.left = newLeft + 'px';
    imgEl.style.top  = newTop  + 'px';
    state.cropOffsetX = dims.xRange > 0 ? (-newLeft / dims.xRange) : 0.5;
    state.cropOffsetY = dims.yRange > 0 ? (-newTop  / dims.yRange) : 0.5;
    onUpdate();
  };

  const onPointerUp = () => {
    dragging = false;
    viewport.style.cursor = 'grab';
  };

  // ── Scroll-wheel zoom ─────────────────────────────────────────────────────
  viewport.addEventListener('wheel', (e) => {
    e.preventDefault();
    // Pinch-zoom on trackpads uses ctrlKey; regular scroll also works
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    state.cropZoom = parseFloat(
      Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, state.cropZoom + delta)).toFixed(1)
    );
    refresh();
    syncZoomUI();
    onUpdate();
  }, { signal, passive: false });

  // Mouse
  viewport.addEventListener('mousedown',  (e) => { e.preventDefault(); onPointerDown(e.clientX, e.clientY); }, { signal });
  window.addEventListener ('mousemove',   (e) => onPointerMove(e.clientX, e.clientY), { signal });
  window.addEventListener ('mouseup',     onPointerUp, { signal });

  // Touch
  viewport.addEventListener('touchstart', (e) => { const t = e.touches[0]; onPointerDown(t.clientX, t.clientY); }, { signal, passive: true });
  window.addEventListener ('touchmove',   (e) => { const t = e.touches[0]; onPointerMove(t.clientX, t.clientY); }, { signal, passive: true });
  window.addEventListener ('touchend',    onPointerUp, { signal });
}

/**
 * Synchronize all UI controls (checkboxes, sliders, range labels, radio buttons)
 * to match the values currently stored in the global `state` object.
 */
export function syncUIFromState() {
  const toggleBorder = document.getElementById('toggle-border');
  const borderSize = document.getElementById('border-size');
  const borderSizeVal = document.getElementById('border-size-val');
  const borderSizeContainer = document.getElementById('border-size-container');
  
  const toggleShadow = document.getElementById('toggle-shadow');
  const shadowBlur = document.getElementById('shadow-blur');
  const shadowBlurVal = document.getElementById('shadow-blur-val');
  const shadowBlurContainer = document.getElementById('shadow-size-container');
  
  const captionInput = document.getElementById('caption-input');
  const captionSize = document.getElementById('caption-size');
  const captionSizeVal = document.getElementById('caption-size-val');
  const captionPosRadios = document.getElementsByName('caption-pos');
  
  if (toggleBorder) {
    toggleBorder.checked = state.outlineEnabled;
    if (borderSizeContainer) borderSizeContainer.style.display = state.outlineEnabled ? 'flex' : 'none';
  }
  if (borderSize) {
    borderSize.value = state.outlineThickness;
    if (borderSizeVal) borderSizeVal.textContent = state.outlineThickness;
  }
  
  if (toggleShadow) {
    toggleShadow.checked = state.shadowEnabled;
    if (shadowBlurContainer) shadowBlurContainer.style.display = state.shadowEnabled ? 'flex' : 'none';
  }
  if (shadowBlur) {
    shadowBlur.value = state.shadowBlur;
    if (shadowBlurVal) shadowBlurVal.textContent = state.shadowBlur;
  }
  
  if (captionInput) captionInput.value = state.captionText;
  if (captionSize) {
    captionSize.value = state.captionSize;
    if (captionSizeVal) captionSizeVal.textContent = state.captionSize;
  }
  if (captionPosRadios) {
    captionPosRadios.forEach(radio => {
      radio.checked = (radio.value === state.captionPos);
    });
  }

  // Sync zoom UI if the slider exists
  const zoomSlider = document.getElementById('crop-zoom');
  const zoomVal = document.getElementById('crop-zoom-val');
  if (zoomSlider) {
    zoomSlider.value = Math.round(state.cropZoom * 100);
    if (zoomVal) zoomVal.textContent = state.cropZoom.toFixed(1) + '×';
  }
}

