/**
 * Mock for @azure/data-tables
 * Used in tests to avoid requiring real Azure Table Storage credentials
 */

// In-memory storage for mock tables
const mockTables = new Map<string, Map<string, any>>();

function getTable(tableName: string): Map<string, any> {
  if (!mockTables.has(tableName)) {
    mockTables.set(tableName, new Map());
  }
  return mockTables.get(tableName)!;
}

function getEntityKey(partitionKey: string, rowKey: string): string {
  return `${partitionKey}|||${rowKey}`;
}

// Mock TableClient
export class TableClient {
  private tableName: string;

  static fromConnectionString = jest.fn((connectionString: string, tableName: string) => {
    return new TableClient(tableName);
  });

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  createTable = jest.fn(() => {
    return Promise.resolve({ tableName: this.tableName });
  });

  createEntity = jest.fn((entity: any) => {
    const table = getTable(this.tableName);
    const key = getEntityKey(entity.partitionKey, entity.rowKey);
    table.set(key, { ...entity, timestamp: new Date() });
    return Promise.resolve({ etag: 'mock-etag' });
  });

  getEntity = jest.fn((partitionKey: string, rowKey: string) => {
    const table = getTable(this.tableName);
    const key = getEntityKey(partitionKey, rowKey);
    const entity = table.get(key);
    if (!entity) {
      const error: any = new Error('Entity not found');
      error.statusCode = 404;
      return Promise.reject(error);
    }
    return Promise.resolve(entity);
  });

  updateEntity = jest.fn((entity: any, mode: string = 'Merge') => {
    const table = getTable(this.tableName);
    const key = getEntityKey(entity.partitionKey, entity.rowKey);
    const existing = table.get(key);
    if (!existing) {
      const error: any = new Error('Entity not found');
      error.statusCode = 404;
      return Promise.reject(error);
    }
    if (mode === 'Replace') {
      table.set(key, { ...entity, timestamp: new Date() });
    } else {
      table.set(key, { ...existing, ...entity, timestamp: new Date() });
    }
    return Promise.resolve({ etag: 'mock-etag-updated' });
  });

  upsertEntity = jest.fn((entity: any, mode: string = 'Merge') => {
    const table = getTable(this.tableName);
    const key = getEntityKey(entity.partitionKey, entity.rowKey);
    const existing = table.get(key);
    if (existing && mode === 'Merge') {
      table.set(key, { ...existing, ...entity, timestamp: new Date() });
    } else {
      table.set(key, { ...entity, timestamp: new Date() });
    }
    return Promise.resolve({ etag: 'mock-etag-upserted' });
  });

  deleteEntity = jest.fn((partitionKey: string, rowKey: string) => {
    const table = getTable(this.tableName);
    const key = getEntityKey(partitionKey, rowKey);
    table.delete(key);
    return Promise.resolve({});
  });

  listEntities = jest.fn((options?: any) => {
    const table = getTable(this.tableName);
    const entities = Array.from(table.values());
    
    // Simple query filter support for testing
    let filtered = entities;
    if (options?.queryOptions?.filter) {
      const filter = options.queryOptions.filter;
      // Very basic filter parsing for testing (PartitionKey eq 'value')
      const partitionMatch = filter.match(/PartitionKey eq '([^']+)'/);
      if (partitionMatch) {
        filtered = entities.filter((e: any) => e.partitionKey === partitionMatch[1]);
      }
    }

    return {
      [Symbol.asyncIterator]: async function* () {
        for (const entity of filtered) {
          yield entity;
        }
      },
      byPage: jest.fn(() => ({
        [Symbol.asyncIterator]: async function* () {
          yield { value: filtered, continuationToken: undefined };
        }
      }))
    };
  });
}

// Mock odata helper
export const odata = jest.fn((strings: TemplateStringsArray, ...values: any[]) => {
  return strings.reduce((result, str, i) => {
    return result + str + (values[i] || '');
  }, '');
});

// Mock TableEntity type
export interface TableEntity {
  partitionKey: string;
  rowKey: string;
  timestamp?: Date;
  etag?: string;
  [key: string]: any;
}

// Utility to clear mock data between tests
export function __clearMockTables() {
  mockTables.clear();
}

// Export for tests to use
export const __mockTables = mockTables;
