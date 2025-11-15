import { Link } from 'react-router-dom';
import './PlaceholderPage.css';

export function CheckSummaryPage() {
  return (
    <div className="placeholder-page">
      <header className="placeholder-header">
        <Link to="/truckcheck" className="back-link">← Back to Truck Checks</Link>
        <h1>Check Summary</h1>
      </header>
      <main className="placeholder-main">
        <p>Summary page - Coming soon</p>
      </main>
    </div>
  );
}

export function AdminDashboardPage() {
  return (
    <div className="placeholder-page">
      <header className="placeholder-header">
        <Link to="/truckcheck" className="back-link">← Back to Truck Checks</Link>
        <h1>Admin Dashboard</h1>
      </header>
      <main className="placeholder-main">
        <p>Admin dashboard - Coming soon</p>
      </main>
    </div>
  );
}

export function TemplateEditorPage() {
  return (
    <div className="placeholder-page">
      <header className="placeholder-header">
        <Link to="/truckcheck" className="back-link">← Back to Truck Checks</Link>
        <h1>Template Editor</h1>
      </header>
      <main className="placeholder-main">
        <p>Template editor - Coming soon</p>
      </main>
    </div>
  );
}
