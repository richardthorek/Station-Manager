/**
 * Mock for index.ts to avoid starting the server in tests
 */

// Mock Socket.io instance for testing
interface MockSocketIO {
  emit: jest.Mock;
  on: jest.Mock;
  to: jest.Mock;
  in: jest.Mock;
}

const mockIo: MockSocketIO = {
  emit: jest.fn(),
  on: jest.fn(),
  to: jest.fn(function() { return mockIo; }),
  in: jest.fn(function() { return mockIo; }),
};

export const io = mockIo;
