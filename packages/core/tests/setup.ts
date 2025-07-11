// Vitest setup file for core package tests
import { beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';

// Global test setup
beforeAll(() => {
  // Setup global test environment
});

afterAll(() => {
  // Cleanup global test environment
});

// Mock console.error to avoid noise in tests
const originalError = console.error;
beforeEach(() => {
  console.error = vi.fn();
});

afterEach(() => {
  console.error = originalError;
});