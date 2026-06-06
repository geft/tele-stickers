/**
 * Tests for editor.js – state defaults, crop/zoom math, and cartoon shader.
 *
 * computeCropRect and applyCartoonShader are pure functions with no DOM or
 * canvas dependency, making them fully testable in Node/jsdom.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { state, computeCropRect, syncUIFromState, initEditor } from '../editor.js';

// ── Helpers ────────────────────────────────────────────────────────────────

/** Build a minimal ImageData-like object for testing. */
function makeImageData(pixels, width = 1, height = 1) {
  const data = new Uint8ClampedArray(pixels.flat());
  return { data, width, height };
}

/** Return pixel [R, G, B, A] at (x, y) from an ImageData-like object. */
function px(imgData, x = 0, y = 0) {
  const i = (y * imgData.width + x) * 4;
  return [imgData.data[i], imgData.data[i + 1], imgData.data[i + 2], imgData.data[i + 3]];
}

// ═══════════════════════════════════════════════════════════════════════════
describe('editor state – default values', () => {
  it('has outline disabled by default', () => {
    expect(state.outlineEnabled).toBe(false);
  });

  it('has shadow disabled by default', () => {
    expect(state.shadowEnabled).toBe(false);
  });

  it('defaults to empty caption text', () => {
    expect(state.captionText).toBe('');
  });

  it('has no source image loaded', () => {
    expect(state.sourceImage).toBeNull();
  });

  it('has valid numeric defaults for all sliders', () => {
    expect(state.outlineThickness).toBeGreaterThan(0);
    expect(state.shadowBlur).toBeGreaterThan(0);
    expect(state.captionSize).toBeGreaterThan(0);
  });

  it('defaults crop offset to centre (0.5) on both axes', () => {
    expect(state.cropOffsetX).toBe(0.5);
    expect(state.cropOffsetY).toBe(0.5);
  });

  it('defaults crop zoom to 1.0 (no zoom / fit)', () => {
    expect(state.cropZoom).toBe(1.0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('computeCropRect – square image (512×512)', () => {
  it('returns the full image at zoom 1 with centre offset', () => {
    const r = computeCropRect(512, 512, 0.5, 0.5, 1.0);
    expect(r).toEqual({ srcX: 0, srcY: 0, srcWidth: 512, srcHeight: 512 });
  });

  it('always returns a square crop region', () => {
    const r = computeCropRect(512, 512, 0.5, 0.5, 1.0);
    expect(r.srcWidth).toBe(r.srcHeight);
  });

  it('zoom 2 halves the crop size', () => {
    const r = computeCropRect(512, 512, 0.5, 0.5, 2.0);
    expect(r.srcWidth).toBe(256);   // round(512 / 2)
    expect(r.srcHeight).toBe(256);
  });

  it('centre offset at zoom 2 positions crop in the middle', () => {
    // slack = 512 - 256 = 256;  srcX = round(256 × 0.5) = 128
    const r = computeCropRect(512, 512, 0.5, 0.5, 2.0);
    expect(r.srcX).toBe(128);
    expect(r.srcY).toBe(128);
  });

  it('higher zoom always reduces the crop size', () => {
    const r1 = computeCropRect(512, 512, 0.5, 0.5, 1.0);
    const r2 = computeCropRect(512, 512, 0.5, 0.5, 2.0);
    const r3 = computeCropRect(512, 512, 0.5, 0.5, 4.0);
    expect(r2.srcWidth).toBeLessThan(r1.srcWidth);
    expect(r3.srcWidth).toBeLessThan(r2.srcWidth);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('computeCropRect – landscape image (4000×3000, 4:3)', () => {
  const W = 4000, H = 3000;

  it('at zoom 1 the crop size equals the short side (height)', () => {
    const r = computeCropRect(W, H, 0.5, 0.5, 1.0);
    expect(r.srcWidth).toBe(H);   // minDim = 3000
    expect(r.srcHeight).toBe(H);
  });

  it('at zoom 1 and centre offset, Y is zero (no vertical slack)', () => {
    // ySlack = 3000 - 3000 = 0
    const r = computeCropRect(W, H, 0.5, 0.5, 1.0);
    expect(r.srcY).toBe(0);
  });

  it('at zoom 1 and centre offset, X is centred in the extra width', () => {
    // xSlack = 4000 - 3000 = 1000;  srcX = round(1000 × 0.5) = 500
    const r = computeCropRect(W, H, 0.5, 0.5, 1.0);
    expect(r.srcX).toBe(500);
  });

  it('offset X=0 (left edge) gives srcX = 0', () => {
    const r = computeCropRect(W, H, 0, 0.5, 1.0);
    expect(r.srcX).toBe(0);
  });

  it('offset X=1 (right edge) gives srcX = xSlack (1000)', () => {
    const r = computeCropRect(W, H, 1, 0.5, 1.0);
    expect(r.srcX).toBe(1000);
  });

  it('at zoom 2, both axes have slack – can pan in both directions', () => {
    // cropSz = round(3000/2) = 1500
    // xSlack = 4000 - 1500 = 2500;  srcX = round(2500 × 0.5) = 1250
    // ySlack = 3000 - 1500 = 1500;  srcY = round(1500 × 0.5) = 750
    const r = computeCropRect(W, H, 0.5, 0.5, 2.0);
    expect(r.srcWidth).toBe(1500);
    expect(r.srcHeight).toBe(1500);
    expect(r.srcX).toBe(1250);
    expect(r.srcY).toBe(750);
  });

  it('crop is square regardless of zoom level', () => {
    [1.0, 1.5, 2.0, 3.0, 4.0].forEach(zoom => {
      const r = computeCropRect(W, H, 0.5, 0.5, zoom);
      expect(r.srcWidth).toBe(r.srcHeight);
    });
  });

  it('higher zoom always gives a smaller source region', () => {
    const r1 = computeCropRect(W, H, 0.5, 0.5, 1.0);
    const r2 = computeCropRect(W, H, 0.5, 0.5, 2.0);
    const r3 = computeCropRect(W, H, 0.5, 0.5, 4.0);
    expect(r2.srcWidth).toBeLessThan(r1.srcWidth);
    expect(r3.srcWidth).toBeLessThan(r2.srcWidth);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('computeCropRect – portrait image (1080×1920, 9:16)', () => {
  const W = 1080, H = 1920;

  it('at zoom 1 the crop size equals the short side (width)', () => {
    const r = computeCropRect(W, H, 0.5, 0.5, 1.0);
    expect(r.srcWidth).toBe(W);   // minDim = 1080
    expect(r.srcHeight).toBe(W);
  });

  it('at zoom 1 and centre offset, X is zero (no horizontal slack)', () => {
    const r = computeCropRect(W, H, 0.5, 0.5, 1.0);
    expect(r.srcX).toBe(0);
  });

  it('at zoom 1 and centre offset, Y is centred in the extra height', () => {
    // ySlack = 1920 - 1080 = 840;  srcY = round(840 × 0.5) = 420
    const r = computeCropRect(W, H, 0.5, 0.5, 1.0);
    expect(r.srcY).toBe(420);
  });

  it('offset Y=0 (top) gives srcY = 0', () => {
    const r = computeCropRect(W, H, 0.5, 0, 1.0);
    expect(r.srcY).toBe(0);
  });

  it('offset Y=1 (bottom) gives srcY = ySlack (840)', () => {
    const r = computeCropRect(W, H, 0.5, 1, 1.0);
    expect(r.srcY).toBe(840);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('computeCropRect – boundary & safety invariants', () => {
  it('returns correct rect for a 1×1 image', () => {
    const r = computeCropRect(1, 1, 0.5, 0.5, 1.0);
    expect(r).toEqual({ srcX: 0, srcY: 0, srcWidth: 1, srcHeight: 1 });
  });

  it('never returns a negative srcX', () => {
    const r = computeCropRect(1000, 500, 0, 0, 1.0);
    expect(r.srcX).toBeGreaterThanOrEqual(0);
  });

  it('never returns a negative srcY', () => {
    const r = computeCropRect(500, 1000, 0, 0, 1.0);
    expect(r.srcY).toBeGreaterThanOrEqual(0);
  });

  it('srcX + srcWidth never exceeds imgWidth', () => {
    const r = computeCropRect(1000, 500, 1, 1, 1.0);
    expect(r.srcX + r.srcWidth).toBeLessThanOrEqual(1000);
  });

  it('srcY + srcHeight never exceeds imgHeight', () => {
    const r = computeCropRect(500, 1000, 1, 1, 1.0);
    expect(r.srcY + r.srcHeight).toBeLessThanOrEqual(1000);
  });

  it('zoom 1 + offset 0.5 matches the legacy centre-crop formula', () => {
    // Legacy: srcX = (imgWidth - minDim) / 2
    const W = 3840, H = 2160;
    const minDim = Math.min(W, H);
    const r = computeCropRect(W, H, 0.5, 0.5, 1.0);
    expect(r.srcX).toBe(Math.round((W - minDim) / 2));
    expect(r.srcY).toBe(Math.round((H - minDim) / 2));
    expect(r.srcWidth).toBe(minDim);
  });

  it('is deterministic – identical inputs always produce identical output', () => {
    const a = computeCropRect(1920, 1080, 0.3, 0.7, 1.8);
    const b = computeCropRect(1920, 1080, 0.3, 0.7, 1.8);
    expect(a).toEqual(b);
  });
});



// ═══════════════════════════════════════════════════════════════════════════
describe('syncUIFromState – DOM synchronization', () => {
  let elements = {};

  beforeEach(() => {
    // Setup temporary elements in JSDOM body
    const createInput = (id, type) => {
      const el = document.createElement('input');
      el.id = id;
      el.type = type;
      document.body.appendChild(el);
      return el;
    };

    const createDiv = (id) => {
      const el = document.createElement('div');
      el.id = id;
      document.body.appendChild(el);
      return el;
    };

    const createSpan = (id) => {
      const el = document.createElement('span');
      el.id = id;
      document.body.appendChild(el);
      return el;
    };

    elements.toggleBorder = createInput('toggle-border', 'checkbox');
    elements.borderSize = createInput('border-size', 'range');
    elements.borderSizeVal = createSpan('border-size-val');
    elements.borderSizeContainer = createDiv('border-size-container');

    elements.toggleShadow = createInput('toggle-shadow', 'checkbox');
    elements.shadowBlur = createInput('shadow-blur', 'range');
    elements.shadowBlurVal = createSpan('shadow-blur-val');
    elements.shadowBlurContainer = createDiv('shadow-size-container');

    elements.captionInput = createInput('caption-input', 'text');
    elements.captionSize = createInput('caption-size', 'range');
    elements.captionSizeVal = createSpan('caption-size-val');

    // Radios
    const r1 = document.createElement('input');
    r1.type = 'radio';
    r1.name = 'caption-pos';
    r1.value = 'top';
    const r2 = document.createElement('input');
    r2.type = 'radio';
    r2.name = 'caption-pos';
    r2.value = 'center';
    const r3 = document.createElement('input');
    r3.type = 'radio';
    r3.name = 'caption-pos';
    r3.value = 'bottom';
    document.body.appendChild(r1);
    document.body.appendChild(r2);
    document.body.appendChild(r3);
    elements.captionPosRadios = [r1, r2, r3];
  });

  afterEach(() => {
    // Clean up JSDOM body
    document.body.innerHTML = '';
  });

  it('updates checkboxes and slider visibility based on state values', () => {
    // Set state variables
    state.outlineEnabled = false;
    state.shadowEnabled = true;
    state.captionText = 'COOL CAT';
    
    syncUIFromState();

    expect(elements.toggleBorder.checked).toBe(false);
    expect(elements.borderSizeContainer.style.display).toBe('none');

    expect(elements.toggleShadow.checked).toBe(true);
    expect(elements.shadowBlurContainer.style.display).toBe('flex');

    expect(elements.captionInput.value).toBe('COOL CAT');
  });

});
