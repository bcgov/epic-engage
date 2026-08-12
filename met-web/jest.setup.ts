import '@testing-library/jest-dom';
import { TextDecoder, TextEncoder } from 'util';
import { randomUUID } from 'crypto';
import React from 'react';

// Make React available globally for components that use JSX without importing React
global.React = React;

global.TextDecoder = TextDecoder as any;
global.TextEncoder = TextEncoder as any;

class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

global.ResizeObserver = ResizeObserver;

// jsdom has no canvas for charts. Return null so they fall back to their own estimate quietly.
HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;

// Polyfill crypto.randomUUID for jsdom test environment
if (!global.crypto) {
  global.crypto = {} as Crypto;
}
if (!global.crypto.randomUUID) {
  global.crypto.randomUUID = randomUUID;
}
