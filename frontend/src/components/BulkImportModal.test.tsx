import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BulkImportModal } from './BulkImportModal';
import type { Member } from '../types';

vi.mock('../utils/announcer', () => ({ announce: vi.fn() }));

const existingMembers: Member[] = [
  { id: 'm1', name: 'Existing Member', qrCode: 'q1', isActive: true, isDeleted: false, createdAt: '', updatedAt: '' },
];

function csvFile(content: string, name = 'members.csv'): File {
  return new File([content], name, { type: 'text/csv' });
}

async function uploadCsv(content: string) {
  const user = userEvent.setup();
  const onImport = vi.fn().mockResolvedValue({
    successCount: 1, failureCount: 0, successful: [], failed: [],
  });
  const utils = render(
    <BulkImportModal
      existingMembers={existingMembers}
      onClose={vi.fn()}
      onImportComplete={vi.fn()}
      onImport={onImport}
    />
  );
  const input = screen.getByLabelText('CSV file input');
  await user.upload(input, csvFile(content));
  return { onImport, ...utils };
}

beforeEach(() => vi.clearAllMocks());

describe('BulkImportModal column detection (found 2026-07-18)', () => {
  it('recognizes the exact canonical headers (regression)', async () => {
    await uploadCsv('First Name,Last Name,Rank\nJohn,Smith,Firefighter\n');
    expect(await screen.findByText(/1 valid, 0 duplicates, 0 invalid/)).toBeInTheDocument();
    expect(screen.getByText('John Smith')).toBeInTheDocument();
  });

  it('fuzzy-matches lowercase/underscored/differently-spaced headers', async () => {
    await uploadCsv('first_name,last name,RANK\nJohn,Smith,Firefighter\n');
    expect(await screen.findByText(/1 valid, 0 duplicates, 0 invalid/)).toBeInTheDocument();
    expect(screen.getByText('John Smith')).toBeInTheDocument();
  });

  it('shows which columns were detected and which raw header they matched', async () => {
    const { container } = await uploadCsv('first_name,last name\nJohn,Smith\n');
    await screen.findByText(/Detected columns:/);
    const detected = container.querySelector('.detected-columns');
    expect(detected?.textContent).toContain('First Name → "first_name"');
    expect(detected?.textContent).toContain('Last Name → "last name"');
  });

  it('accepts a single "Name" column instead of First/Last', async () => {
    await uploadCsv('Full Name,Rank\nRobin Allard,Trainee\n');
    // "Full Name" normalizes to "fullname", an alias for the "name" field.
    expect(await screen.findByText(/1 valid, 0 duplicates, 0 invalid/)).toBeInTheDocument();
    expect(screen.getByText('Robin Allard')).toBeInTheDocument();
  });

  it('warns clearly when no name-bearing column is found, instead of a silent per-row failure', async () => {
    await uploadCsv('Employee ID,Department\n123,Operations\n');
    expect(await screen.findByText(/No name column found/)).toBeInTheDocument();
    expect(screen.getByText(/0 valid, 0 duplicates, 1 invalid/)).toBeInTheDocument();
  });

  it('still flags an existing member as a duplicate with fuzzy headers', async () => {
    await uploadCsv('NAME\nExisting Member\n');
    expect(await screen.findByText(/0 valid, 1 duplicate,/)).toBeInTheDocument();
  });
});
