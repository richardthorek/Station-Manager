import { BlobServiceClient, ContainerClient, BlockBlobClient } from '@azure/storage-blob';
import { v4 as uuidv4 } from 'uuid';

/**
 * Azure Blob Storage Service for handling image uploads
 * Supports reference photos (for checklist templates) and result photos (for check results)
 */
class AzureStorageService {
  private blobServiceClient: BlobServiceClient | null = null;
  private referencePhotosContainer: ContainerClient | null = null;
  private resultPhotosContainer: ContainerClient | null = null;
  private isEnabled: boolean = false;

  constructor() {
    this.initialize();
  }

  /**
   * Initialize Azure Blob Storage clients
   */
  private initialize() {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    
    if (!connectionString) {
      console.warn('Azure Storage not configured. Photo upload features will be disabled.');
      console.warn('Set AZURE_STORAGE_CONNECTION_STRING environment variable to enable photo uploads.');
      return;
    }

    try {
      this.blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
      
      // Container names
      const referenceContainerName = process.env.AZURE_STORAGE_REFERENCE_CONTAINER || 'reference-photos';
      const resultContainerName = process.env.AZURE_STORAGE_RESULT_CONTAINER || 'result-photos';
      
      this.referencePhotosContainer = this.blobServiceClient.getContainerClient(referenceContainerName);
      this.resultPhotosContainer = this.blobServiceClient.getContainerClient(resultContainerName);
      
      this.isEnabled = true;
      console.log('Azure Storage initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Azure Storage:', error);
      this.isEnabled = false;
    }
  }

  /**
   * Ensure containers exist (create if they don't)
   */
  async ensureContainersExist(): Promise<void> {
    if (!this.isEnabled || !this.referencePhotosContainer || !this.resultPhotosContainer) {
      return;
    }

    try {
      // Create reference photos container if it doesn't exist
      await this.referencePhotosContainer.createIfNotExists({
        access: 'blob' // Public read access for reference photos
      });

      // Create result photos container if it doesn't exist
      await this.resultPhotosContainer.createIfNotExists({
        access: 'blob' // Public read access for result photos
      });

      console.log('Storage containers verified/created');
    } catch (error) {
      console.error('Error creating storage containers:', error);
      throw error;
    }
  }

  /**
   * Check if Azure Storage is enabled
   */
  isStorageEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Upload a reference photo (for checklist templates)
   * @param file File buffer
   * @param fileName Original file name
   * @param contentType MIME type
   * @returns Public URL of the uploaded photo
   */
  async uploadReferencePhoto(
    file: Buffer,
    fileName: string,
    contentType: string
  ): Promise<string> {
    if (!this.isEnabled || !this.referencePhotosContainer) {
      throw new Error('Azure Storage is not enabled');
    }

    await this.ensureContainersExist();

    // Generate unique blob name
    const fileExtension = fileName.split('.').pop() || 'jpg';
    const blobName = `${uuidv4()}.${fileExtension}`;

    const blockBlobClient: BlockBlobClient = this.referencePhotosContainer.getBlockBlobClient(blobName);

    try {
      await blockBlobClient.upload(file, file.length, {
        blobHTTPHeaders: {
          blobContentType: contentType
        }
      });

      return blockBlobClient.url;
    } catch (error) {
      console.error('Error uploading reference photo:', error);
      throw error;
    }
  }

  /**
   * Upload a result photo (for check results)
   * @param file File buffer
   * @param fileName Original file name
   * @param contentType MIME type
   * @returns Public URL of the uploaded photo
   */
  async uploadResultPhoto(
    file: Buffer,
    fileName: string,
    contentType: string
  ): Promise<string> {
    if (!this.isEnabled || !this.resultPhotosContainer) {
      throw new Error('Azure Storage is not enabled');
    }

    await this.ensureContainersExist();

    // Generate unique blob name
    const fileExtension = fileName.split('.').pop() || 'jpg';
    const blobName = `${uuidv4()}.${fileExtension}`;

    const blockBlobClient: BlockBlobClient = this.resultPhotosContainer.getBlockBlobClient(blobName);

    try {
      await blockBlobClient.upload(file, file.length, {
        blobHTTPHeaders: {
          blobContentType: contentType
        }
      });

      return blockBlobClient.url;
    } catch (error) {
      console.error('Error uploading result photo:', error);
      throw error;
    }
  }

  /**
   * Delete a reference photo
   * @param photoUrl URL of the photo to delete
   */
  async deleteReferencePhoto(photoUrl: string): Promise<boolean> {
    if (!this.isEnabled || !this.referencePhotosContainer) {
      return false;
    }

    try {
      const blobName = this.extractBlobNameFromUrl(photoUrl);
      if (!blobName) return false;

      const blockBlobClient = this.referencePhotosContainer.getBlockBlobClient(blobName);
      await blockBlobClient.deleteIfExists();
      return true;
    } catch (error) {
      console.error('Error deleting reference photo:', error);
      return false;
    }
  }

  /**
   * Delete a result photo
   * @param photoUrl URL of the photo to delete
   */
  async deleteResultPhoto(photoUrl: string): Promise<boolean> {
    if (!this.isEnabled || !this.resultPhotosContainer) {
      return false;
    }

    try {
      const blobName = this.extractBlobNameFromUrl(photoUrl);
      if (!blobName) return false;

      const blockBlobClient = this.resultPhotosContainer.getBlockBlobClient(blobName);
      await blockBlobClient.deleteIfExists();
      return true;
    } catch (error) {
      console.error('Error deleting result photo:', error);
      return false;
    }
  }

  /**
   * Extract blob name from full URL
   */
  private extractBlobNameFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/');
      // The blob name is the last part of the path
      return pathParts[pathParts.length - 1];
    } catch {
      return null;
    }
  }
}

// Export singleton instance
export const azureStorageService = new AzureStorageService();
