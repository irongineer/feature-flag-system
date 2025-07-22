import '@testing-library/jest-dom';
import { vi } from 'vitest';

// React Query Provider Mock
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Create a test query client
export const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

// Test wrapper for React Query
export const TestQueryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = createTestQueryClient();
  return React.createElement(QueryClientProvider, { client: queryClient }, children);
};

// Mock fetch for API calls
global.fetch = vi.fn();

// Mock window.getComputedStyle for Ant Design compatibility
Object.defineProperty(window, 'getComputedStyle', {
  value: () => ({
    getPropertyValue: () => '0px',
    width: '0px',
    height: '0px',
  }),
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock matchMedia for Ant Design responsive components
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock requestAnimationFrame
global.requestAnimationFrame = vi.fn().mockImplementation(cb => setTimeout(cb, 0));
global.cancelAnimationFrame = vi.fn();

// Mock console methods to reduce test noise
const originalConsoleError = console.error;
console.error = (...args: any[]) => {
  if (typeof args[0] === 'string' && args[0].includes('Warning:')) {
    return; // Suppress React warnings in tests
  }
  originalConsoleError(...args);
};