// Mock for uuid module to work with Jest
export const v4 = jest.fn(() => 'test-uuid-' + Math.random().toString(36).substring(7));
export default { v4 };
