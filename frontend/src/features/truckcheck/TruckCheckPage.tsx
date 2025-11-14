import { Link } from 'react-router-dom';
import './TruckCheckPage.css';

export function TruckCheckPage() {
  return (
    <div className="truckcheck-page">
      <header className="truckcheck-header">
        <Link to="/" className="back-link">← Back to Home</Link>
        <h1>Truck Check</h1>
      </header>

      <main className="truckcheck-main">
        <div className="placeholder-content">
          <div className="icon">🚛</div>
          <h2>Coming Soon</h2>
          <p>
            The Truck Check feature is currently under development. 
            This module will provide vehicle maintenance tracking and inspection checklist capabilities.
          </p>
          
          <div className="planned-features">
            <h3>Planned Features</h3>
            <ul>
              <li>Vehicle inspection checklists</li>
              <li>Maintenance tracking and scheduling</li>
              <li>Equipment inventory management</li>
              <li>Service history logs</li>
              <li>Multi-vehicle support</li>
            </ul>
          </div>

          <Link to="/" className="btn-primary">Return to Home</Link>
        </div>
      </main>
    </div>
  );
}
