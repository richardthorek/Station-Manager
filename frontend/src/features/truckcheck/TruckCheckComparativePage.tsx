/**
 * Truck Check Comparative Report (MASTER_PLAN Q5)
 *
 * Compares truck check outcomes for the same vehicle type across stations,
 * grouped by the checklist's stable itemCode (TC-D1) so results line up even
 * when brigades word an item differently.
 */

import { useState, useCallback } from 'react';
import { subDays } from 'date-fns';
import { useStation } from '../../contexts/StationContext';
import { MultiStationSelector } from '../../components/MultiStationSelector';
import { PageHeader } from '../../components/PageHeader';
import { api } from '../../services/api';
import './AdminDashboard.css';
import './TruckCheckComparativePage.css';

type VehicleTypeComparison = Awaited<ReturnType<typeof api.getTruckCheckComparative>>['vehicleTypes'][number];

export function TruckCheckComparativePage() {
  const { stations } = useStation();
  const [selectedStationIds, setSelectedStationIds] = useState<string[]>([]);
  const [vehicleTypes, setVehicleTypes] = useState<VehicleTypeComparison[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  const fetchComparison = useCallback(async () => {
    if (selectedStationIds.length === 0) return;

    try {
      setLoading(true);
      setError(null);
      const endDate = new Date();
      const startDate = subDays(endDate, 90);
      const result = await api.getTruckCheckComparative(
        selectedStationIds,
        startDate.toISOString(),
        endDate.toISOString()
      );
      setVehicleTypes(result.vehicleTypes);
      setHasLoaded(true);
    } catch (err) {
      console.error('Error fetching truck check comparative report:', err);
      setError('Failed to load the comparative report. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [selectedStationIds]);

  return (
    <div className="admin-dashboard truckcheck-comparative-page">
      <PageHeader
        title="Compare Vehicle Checks Across Stations"
        subtitle="Outcomes for the same vehicle type, matched by checklist item — last 90 days."
        backTo="/truckcheck/admin"
        backLabel="Admin Dashboard"
      />

      <main className="dashboard-main" id="main-content" tabIndex={-1}>
        <div className="station-selection">
          <label htmlFor="comparative-station-selector">
            <strong>Select Stations to Compare:</strong>
          </label>
          <MultiStationSelector
            stations={stations}
            selectedStationIds={selectedStationIds}
            onSelectionChange={setSelectedStationIds}
          />
          <button
            className="compare-button"
            onClick={fetchComparison}
            disabled={selectedStationIds.length === 0 || loading}
          >
            {loading ? 'Loading…' : 'Compare'}
          </button>
        </div>

        {error && (
          <div className="error-state">
            <p>{error}</p>
            <button onClick={fetchComparison}>Retry</button>
          </div>
        )}

        {!error && hasLoaded && vehicleTypes.length === 0 && (
          <div className="empty-state">
            <p>No comparable checks found for these stations in the last 90 days.</p>
          </div>
        )}

        {!error && vehicleTypes.map(vt => (
          <section key={vt.vehicleTypeCode} className="comparative-vehicle-type-section">
            <h2>{vt.vehicleTypeName}</h2>
            {vt.items.map(item => (
              <div key={item.itemCode} className="comparative-item-card">
                <h3>{item.itemName}</h3>
                <table className="comparative-table">
                  <thead>
                    <tr>
                      <th>Station</th>
                      <th>Checks</th>
                      <th>Pass rate</th>
                      <th>Issues</th>
                      <th>Skipped</th>
                    </tr>
                  </thead>
                  <tbody>
                    {item.stations.map(s => (
                      <tr key={s.stationId}>
                        <td>{s.stationName}</td>
                        <td>{s.totalChecks}</td>
                        <td className={s.passRate < 80 ? 'pass-rate-low' : 'pass-rate-ok'}>{s.passRate}%</td>
                        <td>{s.issueCount}</td>
                        <td>{s.skippedCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </section>
        ))}

        {!error && !hasLoaded && selectedStationIds.length === 0 && (
          <div className="empty-state">
            <p>Select two or more stations, then click Compare.</p>
          </div>
        )}
      </main>
    </div>
  );
}
