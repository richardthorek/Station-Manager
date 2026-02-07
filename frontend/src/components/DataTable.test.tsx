/**
 * DataTable Component Tests
 *
 * Tests for the enhanced data table with:
 * - Sorting
 * - Filtering
 * - Pagination
 * - Search
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DataTable, type Column } from './DataTable';

interface TestData {
  id: number;
  name: string;
  count: number;
  date: string;
}

const testData: TestData[] = [
  { id: 1, name: 'Alice', count: 10, date: '2024-01-01' },
  { id: 2, name: 'Bob', count: 5, date: '2024-01-02' },
  { id: 3, name: 'Charlie', count: 15, date: '2024-01-03' },
  { id: 4, name: 'David', count: 8, date: '2024-01-04' },
  { id: 5, name: 'Eve', count: 12, date: '2024-01-05' },
];

const columns: Column<TestData>[] = [
  { key: 'name', header: 'Name', sortable: true },
  { key: 'count', header: 'Count', sortable: true },
  { key: 'date', header: 'Date', sortable: true },
];

describe('DataTable', () => {
  it('renders table with data', () => {
    render(<DataTable data={testData} columns={columns} />);

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Charlie')).toBeInTheDocument();
  });

  it('renders column headers', () => {
    render(<DataTable data={testData} columns={columns} />);

    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Count')).toBeInTheDocument();
    expect(screen.getByText('Date')).toBeInTheDocument();
  });

  it('shows search input when showSearch is true', () => {
    render(<DataTable data={testData} columns={columns} showSearch={true} />);

    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
  });

  it('hides search input when showSearch is false', () => {
    render(<DataTable data={testData} columns={columns} showSearch={false} />);

    expect(screen.queryByPlaceholderText('Search...')).not.toBeInTheDocument();
  });

  it('filters data based on search term', async () => {
    render(<DataTable data={testData} columns={columns} showSearch={true} />);

    const searchInput = screen.getByPlaceholderText('Search...');
    fireEvent.change(searchInput, { target: { value: 'Alice' } });

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.queryByText('Bob')).not.toBeInTheDocument();
    });
  });

  it('sorts data when clicking sortable column header', async () => {
    render(<DataTable data={testData} columns={columns} />);

    const countHeader = screen.getByText('Count');
    fireEvent.click(countHeader);

    await waitFor(() => {
      const rows = screen.getAllByRole('row');
      // First row is header, second row should be Bob (count: 5)
      expect(rows[1]).toHaveTextContent('Bob');
    });
  });

  it('cycles through sort directions (asc -> desc -> none)', async () => {
    render(<DataTable data={testData} columns={columns} />);

    const countHeader = screen.getByText('Count');

    // First click: ascending
    fireEvent.click(countHeader);
    await waitFor(() => {
      expect(screen.getByText('↑')).toBeInTheDocument();
    });

    // Second click: descending
    fireEvent.click(countHeader);
    await waitFor(() => {
      expect(screen.getByText('↓')).toBeInTheDocument();
    });

    // Third click: no sort
    fireEvent.click(countHeader);
    await waitFor(() => {
      expect(screen.queryByText('↑')).not.toBeInTheDocument();
      expect(screen.queryByText('↓')).not.toBeInTheDocument();
    });
  });

  it('displays pagination controls', () => {
    render(<DataTable data={testData} columns={columns} pageSize={2} />);

    expect(screen.getByLabelText('First page')).toBeInTheDocument();
    expect(screen.getByLabelText('Previous page')).toBeInTheDocument();
    expect(screen.getByLabelText('Next page')).toBeInTheDocument();
    expect(screen.getByLabelText('Last page')).toBeInTheDocument();
  });

  it('paginates data correctly', () => {
    render(<DataTable data={testData} columns={columns} pageSize={2} />);

    // First page should show Alice and Bob
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.queryByText('Charlie')).not.toBeInTheDocument();

    // Click next page
    const nextButton = screen.getByLabelText('Next page');
    fireEvent.click(nextButton);

    // Second page should show Charlie and David
    expect(screen.queryByText('Alice')).not.toBeInTheDocument();
    expect(screen.getByText('Charlie')).toBeInTheDocument();
    expect(screen.getByText('David')).toBeInTheDocument();
  });

  it('shows page size selector', () => {
    render(<DataTable data={testData} columns={columns} />);

    const pageSelect = screen.getByLabelText('Show:');
    expect(pageSelect).toBeInTheDocument();
  });

  it('changes page size when selector changed', async () => {
    render(<DataTable data={testData} columns={columns} pageSize={2} />);

    const pageSelect = screen.getByLabelText('Show:') as HTMLSelectElement;
    fireEvent.change(pageSelect, { target: { value: '10' } });

    await waitFor(() => {
      // All 5 items should be visible now
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Eve')).toBeInTheDocument();
    });
  });

  it('displays pagination info', () => {
    render(<DataTable data={testData} columns={columns} pageSize={2} />);

    expect(screen.getByText(/Showing 1 to 2 of 5 entries/)).toBeInTheDocument();
  });

  it('shows "No data available" when data is empty', () => {
    render(<DataTable data={[]} columns={columns} />);

    expect(screen.getByText('No data available')).toBeInTheDocument();
  });

  it('calls onRowClick when row is clicked', () => {
    const onRowClick = vi.fn();
    render(<DataTable data={testData} columns={columns} onRowClick={onRowClick} />);

    const aliceRow = screen.getByText('Alice').closest('tr');
    if (aliceRow) {
      fireEvent.click(aliceRow);
      expect(onRowClick).toHaveBeenCalledWith(testData[0]);
    }
  });

  it('renders custom cell content when render function provided', () => {
    const customColumns: Column<TestData>[] = [
      {
        key: 'name',
        header: 'Name',
        render: (row) => <strong data-testid="custom-name">{row.name}</strong>,
      },
    ];

    render(<DataTable data={testData} columns={customColumns} />);

    expect(screen.getAllByTestId('custom-name')).toHaveLength(5);
  });

  it('applies custom column width', () => {
    const customColumns: Column<TestData>[] = [
      { key: 'name', header: 'Name', width: '200px' },
    ];

    const { container } = render(<DataTable data={testData} columns={customColumns} />);

    const th = container.querySelector('th');
    expect(th).toHaveStyle({ width: '200px' });
  });
});
