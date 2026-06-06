/**
 * Tele-Stickers Canvas Editor Engine
 * Handles image processing, cartoon shaders, borders, text, and emoji mappings.
 */

// Global editor state
export const state = {
  sourceImage: null, // HTMLImageElement or null
  originalBlob: null, // File/Blob of the original uploaded image
  cartoonEnabled: false,
  cartoonColors: 5,
  cartoonEdges: 3,
  outlineEnabled: true,
  outlineThickness: 8,
  shadowEnabled: true,
  shadowBlur: 6,
  captionText: '',
  captionSize: 48,
  captionPos: 'bottom',
  emojis: '🐱',
};

/**
 * Initialize editor DOM listeners and sync with state
 */
export function initEditor(canvas, onStateChange) {
  const ctx = canvas.getContext('2d');
  
  // Grab controls from DOM
  const toggleCartoon = document.getElementById('toggle-cartoon');
  const cartoonColors = document.getElementById('cartoon-colors');
  const cartoonEdges = document.getElementById('cartoon-edges');
  const cartoonColorsVal = document.getElementById('cartoon-colors-val');
  const cartoonEdgesVal = document.getElementById('cartoon-edges-val');
  const cartoonColorsContainer = document.getElementById('cartoon-colors-container');
  const cartoonEdgesContainer = document.getElementById('cartoon-edges-container');
  
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
  
  const emojiInput = document.getElementById('emoji-input');
  const emojiPicker = document.getElementById('emoji-picker');
  const btnClearEmojis = document.getElementById('btn-clear-emojis');
  const btnAddSticker = document.getElementById('btn-add-sticker');
  
  // Set initial UI values from state
  toggleCartoon.checked = state.cartoonEnabled;
  cartoonColors.value = state.cartoonColors;
  cartoonColorsVal.textContent = state.cartoonColors;
  cartoonEdges.value = state.cartoonEdges;
  cartoonEdgesVal.textContent = state.cartoonEdges;
  
  toggleBorder.checked = state.outlineEnabled;
  borderSize.value = state.outlineThickness;
  borderSizeVal.textContent = state.outlineThickness;
  
  toggleShadow.checked = state.shadowEnabled;
  shadowBlur.value = state.shadowBlur;
  shadowBlurVal.textContent = state.shadowBlur;
  
  captionInput.value = state.captionText;
  captionSize.value = state.captionSize;
  captionSizeVal.textContent = state.captionSize;
  
  // Popular emojis for Telegram sticker reactions
  const popularEmojis = [
    '🐱', '😻', '😹', '😼', '😿', '🙀', '😡', '😢', 
    '😂', '😎', '😍', '👍', '❤️', '🔥', '🎉', '💩', 
    '🤔', '😱', '😴', '🙄', '😈', '🤡', '👏', '👀'
  ];
  
  // Build Emoji picker
  emojiPicker.innerHTML = '';
  popularEmojis.forEach(emoji => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `emoji-btn ${state.emojis.includes(emoji) ? 'selected' : ''}`;
    btn.textContent = emoji;
    btn.addEventListener('click', () => {
      let current = emojiInput.value;
      if (current.includes(emoji)) {
        // Toggle off
        current = current.replace(emoji, '');
      } else {
        // Add emoji
        current += emoji;
      }
      // Keep at least one emoji or fall back to empty
      emojiInput.value = current || '🐱';
      state.emojis = emojiInput.value;
      
      // Update active styling
      updateEmojiPickerActiveStates();
      onStateChange();
    });
    emojiPicker.appendChild(btn);
  });

  function updateEmojiPickerActiveStates() {
    const btns = emojiPicker.querySelectorAll('.emoji-btn');
    btns.forEach(btn => {
      if (state.emojis.includes(btn.textContent)) {
        btn.classList.add('selected');
      } else {
        btn.classList.remove('selected');
      }
    });
  }
  
  // Event Listeners
  toggleCartoon.addEventListener('change', (e) => {
    state.cartoonEnabled = e.target.checked;
    cartoonColorsContainer.style.display = state.cartoonEnabled ? 'flex' : 'none';
    cartoonEdgesContainer.style.display = state.cartoonEnabled ? 'flex' : 'none';
    onStateChange();
  });
  
  cartoonColors.addEventListener('input', (e) => {
    state.cartoonColors = parseInt(e.target.value);
    cartoonColorsVal.textContent = state.cartoonColors;
    onStateChange();
  });
  
  cartoonEdges.addEventListener('input', (e) => {
    state.cartoonEdges = parseInt(e.target.value);
    cartoonEdgesVal.textContent = state.cartoonEdges;
    onStateChange();
  });
  
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
  
  btnClearEmojis.addEventListener('click', () => {
    emojiInput.value = '';
    state.emojis = '';
    updateEmojiPickerActiveStates();
    onStateChange();
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
  
  let srcX = 0;
  let srcY = 0;
  let srcWidth = imgWidth;
  let srcHeight = imgHeight;
  
  // Determine if transparent (PNG/cutout) or solid.
  // Standard crop behavior (square center crop) is applied for full photos.
  if (imgWidth !== imgHeight) {
    const minDim = Math.min(imgWidth, imgHeight);
    srcX = (imgWidth - minDim) / 2;
    srcY = (imgHeight - minDim) / 2;
    srcWidth = minDim;
    srcHeight = minDim;
  }
  
  // Draw center-cropped into temp canvas
  tempCtx.drawImage(
    state.sourceImage,
    srcX, srcY, srcWidth, srcHeight,
    padding, padding, targetSize, targetSize
  );
  
  // 2. Apply Cartoon Effect locally on the temp canvas if enabled
  if (state.cartoonEnabled) {
    const imgData = tempCtx.getImageData(0, 0, 512, 512);
    applyCartoonShader(imgData, state.cartoonColors, state.cartoonEdges);
    tempCtx.putImageData(imgData, 0, 0);
  }
  
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
 * Pure client-side Cartoon Pixel Shader (Cel shading + Sobel edge outlines)
 */
function applyCartoonShader(imgData, colorSteps, edgeStrength) {
  const data = imgData.data;
  const width = imgData.width;
  const height = imgData.height;
  
  // 1. Color Quantization & Saturation Boost
  const levels = colorSteps; // number of steps per channel
  const saturation = 1.35; // boost saturation slightly
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    
    if (a < 10) continue; // Skip fully transparent pixels
    
    // Saturation adjustment
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    let newR = gray + (r - gray) * saturation;
    let newG = gray + (g - gray) * saturation;
    let newB = gray + (b - gray) * saturation;
    
    // Cel shading: quantize color values into steps
    newR = Math.round(Math.max(0, Math.min(255, newR)) / 255 * levels) / levels * 255;
    newG = Math.round(Math.max(0, Math.min(255, newG)) / 255 * levels) / levels * 255;
    newB = Math.round(Math.max(0, Math.min(255, newB)) / 255 * levels) / levels * 255;
    
    data[i] = newR;
    data[i + 1] = newG;
    data[i + 2] = newB;
  }
  
  // 2. Sobel Edge Detection (Ink outlines overlay)
  if (edgeStrength > 0) {
    const threshold = 110 - (edgeStrength * 8); // dynamic threshold based on slider
    const grays = new Float32Array(width * height);
    
    // Convert current RGB to grayscale array
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        grays[y * width + x] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      }
    }
    
    // Temporary buffer for edge rendering
    const output = new Uint8ClampedArray(data.length);
    output.set(data);
    
    const getPixelGray = (px, py) => {
      const x = Math.max(0, Math.min(width - 1, px));
      const y = Math.max(0, Math.min(height - 1, py));
      return grays[y * width + x];
    };
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        
        // Skip transparent pixel edges
        if (data[idx + 3] < 10) continue;
        
        // Sobel kernels
        const gx = 
          -1 * getPixelGray(x - 1, y - 1) + 1 * getPixelGray(x + 1, y - 1) +
          -2 * getPixelGray(x - 1, y)     + 2 * getPixelGray(x + 1, y) +
          -1 * getPixelGray(x - 1, y + 1) + 1 * getPixelGray(x + 1, y + 1);
          
        const gy = 
          -1 * getPixelGray(x - 1, y - 1) - 2 * getPixelGray(x, y - 1) - 1 * getPixelGray(x + 1, y - 1) +
           1 * getPixelGray(x - 1, y + 1) + 2 * getPixelGray(x, y + 1) + 1 * getPixelGray(x + 1, y + 1);
           
        const mag = Math.sqrt(gx * gx + gy * gy);
        
        if (mag > threshold) {
          // Blend ink edge (draw black outlines)
          const factor = Math.min(1, (mag - threshold) / 35) * (edgeStrength / 10);
          output[idx] = data[idx] * (1 - factor);
          output[idx + 1] = data[idx + 1] * (1 - factor);
          output[idx + 2] = data[idx + 2] * (1 - factor);
        }
      }
    }
    
    // Copy back edge edits
    for (let i = 0; i < data.length; i++) {
      data[i] = output[i];
    }
  }
}
