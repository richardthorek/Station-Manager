import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Moon, Sun, Download } from 'lucide-react';
import { PageHeader } from './PageHeader';

function renderHeader(props: Partial<React.ComponentProps<typeof PageHeader>> = {}) {
  return render(
    <MemoryRouter>
      <PageHeader title="Vehicle Checks" {...props} />
    </MemoryRouter>,
  );
}

describe('PageHeader', () => {
  it('renders a back arrow linking to the app picker by default', () => {
    renderHeader();
    expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute('href', '/');
  });

  it('links the back arrow to a custom backTo route with a custom label', () => {
    renderHeader({ backTo: '/truckcheck', backLabel: 'Back to Vehicle Checks' });
    expect(screen.getByRole('link', { name: 'Back to Vehicle Checks' })).toHaveAttribute('href', '/truckcheck');
  });

  it('renders the title', () => {
    renderHeader();
    expect(screen.getByRole('heading', { name: 'Vehicle Checks' })).toBeInTheDocument();
  });

  it('shows up to two actions inline without an overflow menu', () => {
    const onClickA = vi.fn();
    const onClickB = vi.fn();
    renderHeader({
      actions: [
        { key: 'theme', label: 'Toggle theme', icon: <Moon size={20} />, onClick: onClickA },
        { key: 'export', label: 'Export', icon: <Sun size={20} />, onClick: onClickB },
      ],
    });
    expect(screen.getByRole('button', { name: 'Toggle theme' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'More actions' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Toggle theme' }));
    expect(onClickA).toHaveBeenCalled();
  });

  it('collapses a third action into a "More actions" overflow menu', () => {
    const onClickC = vi.fn();
    renderHeader({
      actions: [
        { key: 'theme', label: 'Toggle theme', icon: <Moon size={20} />, onClick: vi.fn() },
        { key: 'export', label: 'Export', icon: <Sun size={20} />, onClick: vi.fn() },
        { key: 'download', label: 'Download report', icon: <Download size={20} />, onClick: onClickC },
      ],
    });

    expect(screen.queryByRole('button', { name: 'Download report' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    const menuItem = screen.getByRole('menuitem', { name: /download report/i });
    expect(menuItem).toBeInTheDocument();

    fireEvent.click(menuItem);
    expect(onClickC).toHaveBeenCalled();
  });

  it('renders page-specific children below the back/title row', () => {
    renderHeader({ children: <div>Tabs go here</div> });
    expect(screen.getByText('Tabs go here')).toBeInTheDocument();
  });

  it('renders an optional subtitle alongside children', () => {
    renderHeader({ subtitle: 'Weekly vehicle inspections', children: <div>Tabs go here</div> });
    expect(screen.getByText('Weekly vehicle inspections')).toBeInTheDocument();
    expect(screen.getByText('Tabs go here')).toBeInTheDocument();
  });
});
