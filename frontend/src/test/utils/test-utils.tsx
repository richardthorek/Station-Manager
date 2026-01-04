/**
 * Test Utilities
 * 
 * Custom render function and utilities for testing React components
 * with necessary providers (Router, etc.).
 */

import { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'

/**
 * Custom render function that wraps components with necessary providers
 */
export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <BrowserRouter>{children}</BrowserRouter>
  }

  return render(ui, { wrapper: Wrapper, ...options })
}

// Re-export everything from React Testing Library
export * from '@testing-library/react'
export { renderWithProviders as render }
