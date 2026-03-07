import '@testing-library/jest-dom';
import { TextDecoder, TextEncoder } from 'util';
import { randomUUID } from 'crypto';

global.TextDecoder = TextDecoder as any;
global.TextEncoder = TextEncoder as any;

class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

global.ResizeObserver = ResizeObserver;

// Polyfill crypto.randomUUID for jsdom test environment
if (!global.crypto) {
  global.crypto = {} as Crypto;
}
if (!global.crypto.randomUUID) {
  global.crypto.randomUUID = randomUUID;
}
