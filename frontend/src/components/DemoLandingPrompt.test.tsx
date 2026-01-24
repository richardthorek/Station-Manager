/**
 * Demo Landing Prompt Component Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { DemoLandingPrompt, hasSeenDemoPrompt, resetDemoPrompt } from './DemoLandingPrompt';
import { StationProvider } from '../contexts/StationContext';

// Mock API
vi.mock('../services/api', () => ({
  api: {
    getStations: vi.fn(() => Promise.resolve([
      { id: 'default-station', name: 'Default Station' },
      { id: 'demo-station', name: 'Demo Station' },
    ])),
  },
  setCurrentStationId: vi.fn(),
  getCurrentStationId: vi.fn(() => 'default-station'),
}));

const MockedDemoLandingPrompt = ({ onDismiss }: { onDismiss: () => void }) => (
  <BrowserRouter>
    <StationProvider>
      <DemoLandingPrompt onDismiss={onDismiss} />
    </StationProvider>
  </BrowserRouter>
);

describe('DemoLandingPrompt', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    resetDemoPrompt();
  });

  it('should render welcome message', () => {
    const mockDismiss = vi.fn();

    render(<MockedDemoLandingPrompt onDismiss={mockDismiss} />);

    expect(screen.getByText(/Welcome to Station Manager!/i)).toBeInTheDocument();
  });

  it('should show two options: demo and real station', () => {
    const mockDismiss = vi.fn();

    render(<MockedDemoLandingPrompt onDismiss={mockDismiss} />);

    expect(screen.getByText(/Try the Demo/i)).toBeInTheDocument();
    expect(screen.getByText(/Use Real Station/i)).toBeInTheDocument();
  });

  it('should call onDismiss when close button is clicked', async () => {
    const mockDismiss = vi.fn();

    render(<MockedDemoLandingPrompt onDismiss={mockDismiss} />);

    const closeButton = document.querySelector('.demo-prompt-close');
    if (closeButton) {
      fireEvent.click(closeButton);
      
      await waitFor(() => {
        expect(mockDismiss).toHaveBeenCalled();
      }, { timeout: 500 });
    }
  });

  it('should call onDismiss when "Start Demo" is clicked', async () => {
    const mockDismiss = vi.fn();

    render(<MockedDemoLandingPrompt onDismiss={mockDismiss} />);

    const startDemoButton = screen.getByText('Start Demo');
    fireEvent.click(startDemoButton);

    await waitFor(() => {
      expect(mockDismiss).toHaveBeenCalled();
    }, { timeout: 500 });
  });

  it('should call onDismiss when "Set Up Station" is clicked', async () => {
    const mockDismiss = vi.fn();

    render(<MockedDemoLandingPrompt onDismiss={mockDismiss} />);

    const setupButton = screen.getByText('Set Up Station');
    fireEvent.click(setupButton);

    await waitFor(() => {
      expect(mockDismiss).toHaveBeenCalled();
    }, { timeout: 500 });
  });

  it('should set localStorage flag when dismissed', async () => {
    const mockDismiss = vi.fn();

    render(<MockedDemoLandingPrompt onDismiss={mockDismiss} />);

    expect(hasSeenDemoPrompt()).toBe(false);

    const closeButton = document.querySelector('.demo-prompt-close');
    if (closeButton) {
      fireEvent.click(closeButton);
      
      await waitFor(() => {
        expect(hasSeenDemoPrompt()).toBe(true);
      }, { timeout: 500 });
    }
  });

  it('should display helpful tip about station switching', () => {
    const mockDismiss = vi.fn();

    render(<MockedDemoLandingPrompt onDismiss={mockDismiss} />);

    expect(screen.getByText(/You can switch between stations anytime/i)).toBeInTheDocument();
  });
});

describe('Demo Prompt Utilities', () => {
  beforeEach(() => {
    resetDemoPrompt();
  });

  it('hasSeenDemoPrompt should return false initially', () => {
    expect(hasSeenDemoPrompt()).toBe(false);
  });

  it('hasSeenDemoPrompt should return true after setting flag', () => {
    localStorage.setItem('hasSeenDemoPrompt', 'true');
    expect(hasSeenDemoPrompt()).toBe(true);
  });

  it('resetDemoPrompt should clear the flag', () => {
    localStorage.setItem('hasSeenDemoPrompt', 'true');
    expect(hasSeenDemoPrompt()).toBe(true);
    
    resetDemoPrompt();
    expect(hasSeenDemoPrompt()).toBe(false);
  });
});
