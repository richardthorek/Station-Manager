import { Link } from 'react-router-dom';
import './PlaceholderPage.css';

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
