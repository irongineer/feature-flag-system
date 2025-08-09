import '@testing-library/jest-dom';

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

// Mock console methods to reduce test noise
const originalConsoleError = console.error;
console.error = (...args: any[]) => {
  if (typeof args[0] === 'string' && args[0].includes('Warning:')) {
    return; // Suppress React warnings in tests
  }
  originalConsoleError(...args);
};
