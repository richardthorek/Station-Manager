/**
 * Azure Table Storage Admin User Database Service
 * 
 * Provides persistent admin user management for production.
 * Uses Azure Table Storage to persist admin accounts across server restarts.
 */

import { TableClient, TableEntity, odata } from '@azure/data-tables';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import { logger } from './logger';
import type { AdminUser } from '../types';

const SALT_ROUNDS = 10;

// Build table name with optional prefix/suffix
function buildTableName(baseName: string): string {
  const sanitize = (value: string) => value.replace(/[^A-Za-z0-9]/g, '');
  const prefix = sanitize(process.env.TABLE_STORAGE_TABLE_PREFIX || '');
  
  let suffix = '';
  let defaultSuffix = '';
  if (process.env.NODE_ENV === 'test') {
    defaultSuffix = 'Test';
  } else if (process.env.NODE_ENV === 'development') {
    defaultSuffix = 'Dev';
  }
  suffix = sanitize(process.env.TABLE_STORAGE_TABLE_SUFFIX || defaultSuffix);
  
  const name = `${prefix}${baseName}${suffix}`;
  return name || baseName;
}

// Table entity type for Azure Table Storage
interface AdminUserEntity extends TableEntity {
  username: string;
  passwordHash: string;
  role: 'admin' | 'viewer';
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  isActive: boolean;
}

/**
 * Azure Table Storage implementation for admin users
 * Partition Strategy: PartitionKey = 'AdminUser', RowKey = user.id
 */
export class TableStorageAdminUserDatabase {
  private connectionString: string;
  private adminUsersTable!: TableClient;
  private isConnected = false;

  constructor(connectionString: string) {
    this.connectionString = connectionString;
  }

  /**
   * Connect to Azure Table Storage
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    try {
      const tableName = buildTableName('AdminUsers');
      this.adminUsersTable = TableClient.fromConnectionString(this.connectionString, tableName);
      
      // Create table if it doesn't exist
      try {
        await this.adminUsersTable.createTable();
        logger.info('Admin Users table created or already exists', { tableName });
      } catch (createError: any) {
        // Table creation errors are acceptable if table already exists (409 conflict)
        if (createError.statusCode !== 409) {
          logger.error('Failed to create Admin Users table', { 
            error: createError, 
            tableName,
            message: createError.message 
          });
          throw createError;
        }
      }
      
      this.isConnected = true;
      logger.info('Connected to Azure Table Storage for Admin Users', { tableName });
    } catch (error) {
      logger.error('Failed to connect to Azure Table Storage for Admin Users', { 
        error,
        message: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Convert AdminUser to Table Entity
   */
  private toEntity(user: AdminUser): AdminUserEntity {
    return {
      partitionKey: 'AdminUser',
      rowKey: user.id,
      username: user.username,
      passwordHash: user.passwordHash,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      lastLoginAt: user.lastLoginAt?.toISOString(),
      isActive: user.isActive,
    };
  }

  /**
   * Convert Table Entity to AdminUser
   */
  private fromEntity(entity: AdminUserEntity): AdminUser {
    return {
      id: entity.rowKey as string,
      username: entity.username,
      passwordHash: entity.passwordHash,
      role: entity.role,
      createdAt: new Date(entity.createdAt),
      updatedAt: new Date(entity.updatedAt),
      lastLoginAt: entity.lastLoginAt ? new Date(entity.lastLoginAt) : undefined,
      isActive: entity.isActive,
    };
  }

  /**
   * Initialize with a default admin user if none exists
   */
  async initialize(defaultUsername?: string, defaultPassword?: string): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }

    // Check if any users exist
    const users = await this.getAllUsers();
    
    if (users.length === 0 && defaultUsername && defaultPassword) {
      await this.createAdminUser(defaultUsername, defaultPassword, 'admin');
      logger.info('Created default admin user in Table Storage', { username: defaultUsername });
    }
  }

  /**
   * Create a new admin user
   */
  async createAdminUser(
    username: string,
    password: string,
    role: 'admin' | 'viewer' = 'admin'
  ): Promise<AdminUser> {
    if (!this.isConnected) {
      await this.connect();
    }

    // Check if username already exists
    const existingUser = await this.getUserByUsername(username);
    if (existingUser) {
      throw new Error('Username already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const user: AdminUser = {
      id: uuidv4(),
      username,
      passwordHash,
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
    };

    const entity = this.toEntity(user);
    await this.adminUsersTable.createEntity(entity);

    return user;
  }

  /**
   * Verify user credentials
   */
  async verifyCredentials(username: string, password: string): Promise<AdminUser | null> {
    if (!this.isConnected) {
      await this.connect();
    }

    const user = await this.getUserByUsername(username);
    
    if (!user || !user.isActive) {
      return null;
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    
    if (!isValid) {
      return null;
    }

    // Update last login time
    user.lastLoginAt = new Date();
    user.updatedAt = new Date();
    
    const entity = this.toEntity(user);
    await this.adminUsersTable.updateEntity(entity, 'Merge');

    return user;
  }

  /**
   * Get user by ID
   */
  async getUserById(id: string): Promise<AdminUser | null> {
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      const entity = await this.adminUsersTable.getEntity<AdminUserEntity>('AdminUser', id);
      return this.fromEntity(entity);
    } catch (error: any) {
      if (error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Get user by username
   */
  async getUserByUsername(username: string): Promise<AdminUser | null> {
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      const queryFilter = odata`PartitionKey eq 'AdminUser' and username eq ${username}`;
      const entities = this.adminUsersTable.listEntities<AdminUserEntity>({ queryOptions: { filter: queryFilter } });
      
      for await (const entity of entities) {
        return this.fromEntity(entity);
      }
      
      return null;
    } catch (error) {
      logger.error('Error querying user by username', { error, username });
      throw error;
    }
  }

  /**
   * Get all users
   */
  async getAllUsers(): Promise<AdminUser[]> {
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      const queryFilter = odata`PartitionKey eq 'AdminUser'`;
      const entities = this.adminUsersTable.listEntities<AdminUserEntity>({ queryOptions: { filter: queryFilter } });
      
      const users: AdminUser[] = [];
      for await (const entity of entities) {
        users.push(this.fromEntity(entity));
      }
      
      return users;
    } catch (error) {
      logger.error('Error getting all users', { error });
      throw error;
    }
  }

  /**
   * Update user
   */
  async updateUser(
    id: string,
    updates: Partial<Omit<AdminUser, 'id' | 'passwordHash'>>
  ): Promise<AdminUser | null> {
    if (!this.isConnected) {
      await this.connect();
    }

    const user = await this.getUserById(id);
    
    if (!user) {
      return null;
    }

    const updatedUser = {
      ...user,
      ...updates,
      updatedAt: new Date(),
    };

    const entity = this.toEntity(updatedUser);
    await this.adminUsersTable.updateEntity(entity, 'Replace');

    return updatedUser;
  }

  /**
   * Update user password
   */
  async updatePassword(id: string, newPassword: string): Promise<boolean> {
    if (!this.isConnected) {
      await this.connect();
    }

    const user = await this.getUserById(id);
    
    if (!user) {
      return false;
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    
    user.passwordHash = passwordHash;
    user.updatedAt = new Date();

    const entity = this.toEntity(user);
    await this.adminUsersTable.updateEntity(entity, 'Replace');

    return true;
  }

  /**
   * Deactivate user (soft delete)
   */
  async deactivateUser(id: string): Promise<boolean> {
    if (!this.isConnected) {
      await this.connect();
    }

    const user = await this.getUserById(id);
    
    if (!user) {
      return false;
    }

    user.isActive = false;
    user.updatedAt = new Date();

    const entity = this.toEntity(user);
    await this.adminUsersTable.updateEntity(entity, 'Replace');

    return true;
  }

  /**
   * Delete user (hard delete)
   */
  async deleteUser(id: string): Promise<boolean> {
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      await this.adminUsersTable.deleteEntity('AdminUser', id);
      return true;
    } catch (error: any) {
      if (error.statusCode === 404) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Clear all data (for testing)
   */
  async clear(): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }

    const users = await this.getAllUsers();
    
    for (const user of users) {
      await this.deleteUser(user.id);
    }
  }
}
