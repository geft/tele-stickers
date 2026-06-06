/**
 * Tests for preview.js – sticker CRUD, localStorage persistence, and ZIP export.
 *
 * Vitest runs in a jsdom environment so localStorage is available.
 * JSZip is mocked to isolate ZIP generation logic from the file system.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── JSZip mock (must be hoisted before the module that imports it) ──────────
const { fileMock, folderMock } = vi.hoisted(() => {
  const file = vi.fn();
  const folder = vi.fn(() => ({ file }));
  return { fileMock: file, folderMock: folder };
});

vi.mock('jszip', () => {
  const generateAsyncMock = vi.fn(async () => new Blob(['zip-content'], { type: 'application/zip' }));
  return {
    default: function JSZipMock() {
      return {
        folder: folderMock,
        file: vi.fn(),
        generateAsync: generateAsyncMock,
      };
    }
  };
});

// ── Import module under test (after the mock) ──────────────────────────────
import * as preview from '../preview.js';

// ── Helpers ────────────────────────────────────────────────────────────────
/** Reset module-level state between tests by clearing storage and reloading. */
function resetPack() {
  localStorage.clear();
  preview.loadStickers(() => {});
}

/** Build a minimal sticker data URL for testing (just a valid data URI). */
const FAKE_DATA_URL = 'data:image/png;base64,iVBORw0KGgo=';

// ═══════════════════════════════════════════════════════════════════════════
describe('loadStickers', () => {
  beforeEach(resetPack);

  it('initialises to an empty array when localStorage is empty', () => {
    expect(preview.stickersList).toHaveLength(0);
  });

  it('restores previously saved stickers from localStorage', () => {
    const stored = [{ id: 'abc', dataUrl: FAKE_DATA_URL, text: 'HI' }];
    localStorage.setItem('tele_stickers_pack', JSON.stringify(stored));

    preview.loadStickers(() => {});
    expect(preview.stickersList).toHaveLength(1);
    expect(preview.stickersList[0].id).toBe('abc');
  });

  it('recovers gracefully from corrupted localStorage data', () => {
    localStorage.setItem('tele_stickers_pack', '{bad json[[[');
    preview.loadStickers(() => {});
    expect(preview.stickersList).toHaveLength(0);
  });

  it('invokes the onLoad callback with the loaded list', () => {
    const cb = vi.fn();
    preview.loadStickers(cb);
    expect(cb).toHaveBeenCalledOnce();
    expect(cb).toHaveBeenCalledWith(preview.stickersList);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('addSticker', () => {
  beforeEach(resetPack);

  it('adds one sticker to the list', () => {
    preview.addSticker(FAKE_DATA_URL, 'HAPPY', () => {});
    expect(preview.stickersList).toHaveLength(1);
  });

  it('stores the correct dataUrl and text', () => {
    preview.addSticker(FAKE_DATA_URL, 'SHOCK', () => {});
    const s = preview.stickersList[0];
    expect(s.dataUrl).toBe(FAKE_DATA_URL);
    expect(s.text).toBe('SHOCK');
  });

  it('assigns a unique id to each sticker', () => {
    preview.addSticker(FAKE_DATA_URL, 'A', () => {});
    preview.addSticker(FAKE_DATA_URL, 'B', () => {});
    const ids = preview.stickersList.map(s => s.id);
    expect(new Set(ids).size).toBe(2);
  });

  it('persists to localStorage immediately', () => {
    preview.addSticker(FAKE_DATA_URL, 'SAVE TEST', () => {});
    const raw = JSON.parse(localStorage.getItem('tele_stickers_pack'));
    expect(raw).toHaveLength(1);
    expect(raw[0].text).toBe('SAVE TEST');
  });

  it('invokes the onUpdate callback after adding', () => {
    const cb = vi.fn();
    preview.addSticker(FAKE_DATA_URL, 'CB', cb);
    expect(cb).toHaveBeenCalledOnce();
  });

  it('accumulates multiple stickers in order', () => {
    preview.addSticker(FAKE_DATA_URL, 'FIRST', () => {});
    preview.addSticker(FAKE_DATA_URL, 'SECOND', () => {});
    preview.addSticker(FAKE_DATA_URL, 'THIRD', () => {});
    expect(preview.stickersList).toHaveLength(3);
    expect(preview.stickersList.map(s => s.text)).toEqual(['FIRST', 'SECOND', 'THIRD']);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('deleteSticker', () => {
  beforeEach(resetPack);

  it('removes the sticker with the matching id', () => {
    preview.addSticker(FAKE_DATA_URL, 'KEEP', () => {});
    preview.addSticker(FAKE_DATA_URL, 'REMOVE', () => {});
    const idToDelete = preview.stickersList[1].id;

    preview.deleteSticker(idToDelete, () => {});
    expect(preview.stickersList).toHaveLength(1);
    expect(preview.stickersList[0].text).toBe('KEEP');
  });

  it('does nothing when the id does not exist', () => {
    preview.addSticker(FAKE_DATA_URL, 'SOLO', () => {});
    preview.deleteSticker('nonexistent-id', () => {});
    expect(preview.stickersList).toHaveLength(1);
  });

  it('updates localStorage after deletion', () => {
    preview.addSticker(FAKE_DATA_URL, 'TEMP', () => {});
    const id = preview.stickersList[0].id;
    preview.deleteSticker(id, () => {});

    const raw = JSON.parse(localStorage.getItem('tele_stickers_pack'));
    expect(raw).toHaveLength(0);
  });

  it('invokes the onUpdate callback', () => {
    preview.addSticker(FAKE_DATA_URL, 'CB', () => {});
    const id = preview.stickersList[0].id;
    const cb = vi.fn();
    preview.deleteSticker(id, cb);
    expect(cb).toHaveBeenCalledOnce();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('updateSticker', () => {
  beforeEach(resetPack);

  it('updates the dataUrl and text for the matching id', () => {
    preview.addSticker(FAKE_DATA_URL, 'OLD', () => {});
    const id = preview.stickersList[0].id;

    const newUrl = 'data:image/png;base64,NEWDATA';
    preview.updateSticker(id, newUrl, 'NEW', () => {});

    expect(preview.stickersList[0].dataUrl).toBe(newUrl);
    expect(preview.stickersList[0].text).toBe('NEW');
  });

  it('preserves the id and does not create a new sticker', () => {
    preview.addSticker(FAKE_DATA_URL, 'ORIGINAL', () => {});
    const id = preview.stickersList[0].id;

    preview.updateSticker(id, FAKE_DATA_URL, 'CHANGED', () => {});
    expect(preview.stickersList).toHaveLength(1);
    expect(preview.stickersList[0].id).toBe(id);
  });

  it('persists updated data to localStorage', () => {
    preview.addSticker(FAKE_DATA_URL, 'OLD', () => {});
    const id = preview.stickersList[0].id;
    preview.updateSticker(id, FAKE_DATA_URL, 'UPDATED', () => {});

    const raw = JSON.parse(localStorage.getItem('tele_stickers_pack'));
    expect(raw[0].text).toBe('UPDATED');
  });

  it('does nothing when the id does not exist', () => {
    preview.addSticker(FAKE_DATA_URL, 'SAFE', () => {});
    preview.updateSticker('ghost-id', FAKE_DATA_URL, 'GHOST', () => {});
    expect(preview.stickersList[0].text).toBe('SAFE');
  });

  it('invokes the onUpdate callback', () => {
    preview.addSticker(FAKE_DATA_URL, 'Y', () => {});
    const id = preview.stickersList[0].id;
    const cb = vi.fn();
    preview.updateSticker(id, FAKE_DATA_URL, 'Y', cb);
    expect(cb).toHaveBeenCalledOnce();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('saveStickers / localStorage round-trip', () => {
  beforeEach(resetPack);

  it('survives a full save → clear → reload cycle', () => {
    preview.addSticker(FAKE_DATA_URL, 'PERSIST', () => {});
    // Simulate a fresh page load: wipe in-memory state then restore from storage
    preview.loadStickers(() => {});
    expect(preview.stickersList[0].text).toBe('PERSIST');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('exportPackAsZip', () => {
  beforeEach(() => {
    resetPack();
    // Mock URL.createObjectURL and DOM link click so no browser download fires
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();

    // Stub document.body.appendChild / removeChild to avoid JSDOM download errors
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => {});
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => {});
  });

  it('does nothing and resolves without error when the pack is empty', async () => {
    await expect(preview.exportPackAsZip()).resolves.toBeUndefined();
  });

  it('resolves without throwing when the pack has stickers', async () => {
    preview.addSticker(FAKE_DATA_URL, 'ZIP ME', () => {});
    await expect(preview.exportPackAsZip()).resolves.not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('multi-tab synchronization and pre-CRUD reloading', () => {
  beforeEach(resetPack);

  it('addSticker reloads latest from localStorage before saving', () => {
    // 1. Simulate another tab adding a sticker
    const otherSticker = { id: 'other_123', dataUrl: FAKE_DATA_URL, text: 'OTHER' };
    localStorage.setItem('tele_stickers_pack', JSON.stringify([otherSticker]));

    // 2. Add a sticker in the current context
    preview.addSticker(FAKE_DATA_URL, 'CURRENT', () => {});

    // 3. The current list should have BOTH stickers
    expect(preview.stickersList).toHaveLength(2);
    expect(preview.stickersList[0].text).toBe('OTHER');
    expect(preview.stickersList[1].text).toBe('CURRENT');

    // 4. Verify localStorage has both too
    const stored = JSON.parse(localStorage.getItem('tele_stickers_pack'));
    expect(stored).toHaveLength(2);
  });

  it('deleteSticker reloads latest from localStorage before deleting', () => {
    // 1. Create a sticker
    preview.addSticker(FAKE_DATA_URL, 'CURRENT', () => {});
    const id = preview.stickersList[0].id;

    // 2. Simulate another tab adding a sticker
    const otherSticker = { id: 'other_123', dataUrl: FAKE_DATA_URL, text: 'OTHER' };
    localStorage.setItem('tele_stickers_pack', JSON.stringify([
      preview.stickersList[0],
      otherSticker
    ]));

    // 3. Delete the current sticker
    preview.deleteSticker(id, () => {});

    // 4. The list should still contain the other sticker
    expect(preview.stickersList).toHaveLength(1);
    expect(preview.stickersList[0].text).toBe('OTHER');
  });

  it('updateSticker reloads latest from localStorage before updating', () => {
    // 1. Create a sticker
    preview.addSticker(FAKE_DATA_URL, 'CURRENT', () => {});
    const id = preview.stickersList[0].id;

    // 2. Simulate another tab adding a sticker
    const otherSticker = { id: 'other_123', dataUrl: FAKE_DATA_URL, text: 'OTHER' };
    localStorage.setItem('tele_stickers_pack', JSON.stringify([
      preview.stickersList[0],
      otherSticker
    ]));

    // 3. Update the current sticker
    preview.updateSticker(id, FAKE_DATA_URL, 'UPDATED', () => {});

    // 4. The list should contain both the updated sticker and the other sticker
    expect(preview.stickersList).toHaveLength(2);
    expect(preview.stickersList.find(s => s.id === id).text).toBe('UPDATED');
    expect(preview.stickersList.find(s => s.id === 'other_123').text).toBe('OTHER');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('saveStickers – quota exceeded / storage failure', () => {
  beforeEach(resetPack);

  it('dispatches sticker-storage-error event when localStorage throws', () => {
    const handler = vi.fn();
    window.addEventListener('sticker-storage-error', handler);

    // Force localStorage.setItem to throw (simulates quota exceeded)
    const origSetItem = localStorage.setItem.bind(localStorage);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new DOMException('QuotaExceededError');
    });

    preview.addSticker(FAKE_DATA_URL, 'OVERFLOW', () => {});
    expect(handler).toHaveBeenCalledOnce();

    window.removeEventListener('sticker-storage-error', handler);
  });

  it('reverts stickersList to last saved state when save fails', () => {
    // Seed one sticker successfully
    preview.addSticker(FAKE_DATA_URL, 'SAVED', () => {});
    expect(preview.stickersList).toHaveLength(1);

    // Force the next setItem to fail
    vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new DOMException('QuotaExceededError');
    });

    // Attempt to add a second sticker – save will fail
    let callbackList;
    preview.addSticker(FAKE_DATA_URL, 'FAILED', (list) => { callbackList = list; });

    // In-memory list should be reverted to what localStorage actually holds (1 sticker)
    expect(preview.stickersList).toHaveLength(1);
    expect(preview.stickersList[0].text).toBe('SAVED');

    // onUpdate is called with the reverted list so the UI can sync correctly
    expect(callbackList).toHaveLength(1);
    expect(callbackList[0].text).toBe('SAVED');
  });

  it('returns false from saveStickers when write throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new DOMException('QuotaExceededError');
    });
    const result = preview.saveStickers();
    expect(result).toBe(false);
  });

  it('returns true from saveStickers when write succeeds', () => {
    const result = preview.saveStickers();
    expect(result).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('loadStickers – edge cases', () => {
  beforeEach(resetPack);

  it('does not throw when called without a callback', () => {
    expect(() => preview.loadStickers()).not.toThrow();
  });

  it('does not throw when callback is null', () => {
    expect(() => preview.loadStickers(null)).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('exportPackAsZip – content assertions', () => {
  beforeEach(() => {
    resetPack();
    fileMock.mockClear();
    folderMock.mockClear();
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => {});
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => {});
  });

  it('creates a folder named tele-stickers', async () => {
    preview.addSticker(FAKE_DATA_URL, 'X', () => {});
    await preview.exportPackAsZip();
    expect(folderMock).toHaveBeenCalledWith('tele-stickers');
  });

  it('adds each sticker as a numbered file inside the folder', async () => {
    preview.addSticker(FAKE_DATA_URL, 'ONE', () => {});
    preview.addSticker(FAKE_DATA_URL, 'TWO', () => {});
    await preview.exportPackAsZip();

    const folderInstance = folderMock.mock.results[0].value;
    const calls = folderInstance.file.mock.calls.map(c => c[0]);
    expect(calls).toContain('1.png');
    expect(calls).toContain('2.png');
  });

  it('names webp stickers with .webp extension', async () => {
    const WEBP_URL = 'data:image/webp;base64,FAKE';
    preview.addSticker(WEBP_URL, 'WEBP', () => {});
    await preview.exportPackAsZip();

    const folderInstance = folderMock.mock.results[0].value;
    const calls = folderInstance.file.mock.calls.map(c => c[0]);
    expect(calls).toContain('1.webp');
  });
});
