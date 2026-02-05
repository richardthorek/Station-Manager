/**
 * Demo Landing Prompt Component
 * 
 * First-visit prompt that introduces users to the demo station feature.
 * Appears as a modal overlay when user first visits the application.
 * Offers choice between trying demo mode or using a real station.
 * 
 * Stores user's preference in localStorage to avoid showing again.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStation } from '../contexts/StationContext';
import { DEMO_STATION_ID } from '../contexts/StationContext';
import { markDemoPromptAsSeen } from '../utils/demoPromptUtils';
import './DemoLandingPrompt.css';

interface DemoLandingPromptProps {
  onDismiss: () => void;
}

export function DemoLandingPrompt({ onDismiss }: DemoLandingPromptProps) {
  const navigate = useNavigate();
  const { selectStation, stations } = useStation();
  const [isClosing, setIsClosing] = useState(false);

  const handleTryDemo = () => {
    // Select demo station
    selectStation(DEMO_STATION_ID);
    
    // Mark as seen
    markDemoPromptAsSeen();
    
    // Close prompt
    setIsClosing(true);
    setTimeout(() => {
      onDismiss();
    }, 300);
  };

  const handleUseRealStation = () => {
    // Mark as seen
    markDemoPromptAsSeen();
    
    // Close prompt - user can select their station from the dropdown
    setIsClosing(true);
    setTimeout(() => {
      onDismiss();
      // Navigate to station management if no real stations exist
      const realStations = stations.filter(s => s.id !== DEMO_STATION_ID);
      if (realStations.length === 0) {
        navigate('/admin/stations');
      }
    }, 300);
  };

  const handleClose = () => {
    markDemoPromptAsSeen();
    setIsClosing(true);
    setTimeout(() => {
      onDismiss();
    }, 300);
  };

  return (
    <div 
      className={`demo-prompt-overlay ${isClosing ? 'closing' : ''}`}
      onClick={handleClose}
    >
      <div 
        className={`demo-prompt-dialog ${isClosing ? 'closing' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          className="demo-prompt-close"
          onClick={handleClose}
          aria-label="Close"
        >
          ×
        </button>

        <div className="demo-prompt-header">
          <div className="demo-prompt-icon">🎭</div>
          <h1>Welcome to Station Manager!</h1>
        </div>

        <div className="demo-prompt-content">
          <p className="demo-prompt-intro">
            Explore the system with our interactive demo station, or set up your own brigade's station.
          </p>

          <div className="demo-prompt-options">
            <div className="demo-option-card demo-option">
              <div className="option-icon">🎭</div>
              <h3>Try the Demo</h3>
              <p>
                Explore all features with pre-populated sample data. Perfect for:
              </p>
              <ul>
                <li>First-time users learning the system</li>
                <li>Evaluating features before deployment</li>
                <li>Testing workflows and capabilities</li>
              </ul>
              <button 
                className="option-btn demo-btn"
                onClick={handleTryDemo}
              >
                Start Demo
              </button>
            </div>

            <div className="demo-option-card real-option">
              <div className="option-icon">🚒</div>
              <h3>Use Real Station</h3>
              <p>
                Set up and manage your actual brigade station with:
              </p>
              <ul>
                <li>Real member tracking and attendance</li>
                <li>Actual vehicle maintenance logs</li>
                <li>Production-ready data management</li>
              </ul>
              <button 
                className="option-btn real-btn"
                onClick={handleUseRealStation}
              >
                Set Up Station
              </button>
            </div>
          </div>

          <div className="demo-prompt-footer">
            <p>
              💡 <strong>Tip:</strong> You can switch between stations anytime using the dropdown in the header.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
