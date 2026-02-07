import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import type { Appliance } from '../../types';
import './TruckCheckPage.css';

export function TemplateSelectionPage() {
  const navigate = useNavigate();
  const [appliances, setAppliances] = useState<Appliance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAppliances();
  }, []);

  async function loadAppliances() {
    try {
      setLoading(true);
      const data = await api.getAppliances();
      // Defensive check: ensure data is an array
      setAppliances(Array.isArray(data) ? data : []);
    } catch (err) {
      setError('Failed to load appliances');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function handleEditTemplate(applianceId: string) {
    navigate(`/truckcheck/templates/${applianceId}`);
  }

  if (loading) {
    return (
      <div className="truckcheck-page">
        <header className="truckcheck-header">
          <Link to="/truckcheck" className="back-link">← Back to Truck Checks</Link>
          <h1>Manage Checklists</h1>
        </header>
        <main className="truckcheck-main" id="main-content" tabIndex={-1}>
          <div className="loading">Loading appliances...</div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="truckcheck-page">
        <header className="truckcheck-header">
          <Link to="/truckcheck" className="back-link">← Back to Truck Checks</Link>
          <h1>Manage Checklists</h1>
        </header>
        <main className="truckcheck-main" id="main-content" tabIndex={-1}>
          <div className="error">{error}</div>
        </main>
      </div>
    );
  }

  return (
    <div className="truckcheck-page">
      <header className="truckcheck-header">
        <Link to="/truckcheck" className="back-link">← Back to Truck Checks</Link>
        <h1>Manage Checklists</h1>
        <p className="subtitle">Select an appliance to edit its checklist template</p>
      </header>

      <main className="truckcheck-main" id="main-content" tabIndex={-1}>
        <div className="start-view">
          <div className="instructions">
            <h2>Select an Appliance</h2>
            <p>Choose the vehicle whose checklist you want to modify.</p>
          </div>

          <div className="appliance-grid">
            {appliances.map((appliance) => (
              <div key={appliance.id} className="appliance-card">
                <div className="appliance-icon">📋</div>
                <h3>{appliance.name}</h3>
                {appliance.description && (
                  <p className="appliance-description">{appliance.description}</p>
                )}
                <button 
                  className="btn-primary"
                  onClick={() => handleEditTemplate(appliance.id)}
                >
                  Edit Checklist
                </button>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
