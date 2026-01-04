/**
 * Mock for @azure/storage-blob
 * Used in tests to avoid requiring real Azure Storage credentials
 */

// Mock BlobServiceClient
export class BlobServiceClient {
  static fromConnectionString = jest.fn((connectionString: string) => {
    return new BlobServiceClient();
  });

  getContainerClient = jest.fn((containerName: string) => {
    return new ContainerClient(containerName);
  });
}

// Mock ContainerClient
export class ContainerClient {
  constructor(public containerName: string) {}

  createIfNotExists = jest.fn().mockResolvedValue({ succeeded: true });

  getBlockBlobClient = jest.fn((blobName: string) => {
    return new BlockBlobClient(blobName, this.containerName);
  });

  listBlobsFlat = jest.fn().mockReturnValue({
    [Symbol.asyncIterator]: async function* () {
      yield { name: 'test-blob.jpg', properties: { createdOn: new Date() } };
    }
  });
}

// Mock BlockBlobClient
export class BlockBlobClient {
  public url: string;

  constructor(blobName: string, containerName: string) {
    this.url = `https://mock-storage.blob.core.windows.net/${containerName}/${blobName}`;
  }

  upload = jest.fn().mockResolvedValue({
    requestId: 'mock-request-id',
    date: new Date(),
    etag: 'mock-etag'
  });

  uploadData = jest.fn().mockResolvedValue({
    requestId: 'mock-request-id',
    date: new Date(),
    etag: 'mock-etag'
  });

  download = jest.fn().mockResolvedValue({
    readableStreamBody: {
      pipe: jest.fn()
    },
    contentLength: 1024
  });

  delete = jest.fn().mockResolvedValue({
    requestId: 'mock-request-id',
    date: new Date()
  });

  exists = jest.fn().mockResolvedValue(true);
}

// Mock StorageSharedKeyCredential
export class StorageSharedKeyCredential {
  constructor(public accountName: string, public accountKey: string) {}
}

// Mock BlobSASPermissions
export class BlobSASPermissions {
  static parse = jest.fn((permissions: string) => {
    return new BlobSASPermissions();
  });

  read = true;
  write = false;
  delete = false;
  
  toString = jest.fn(() => 'r');
}

// Mock generateBlobSASQueryParameters
export const generateBlobSASQueryParameters = jest.fn((options: any) => {
  return {
    toString: () => 'sv=2023-01-01&sig=mock-signature&se=2025-01-01T00:00:00Z'
  };
});
