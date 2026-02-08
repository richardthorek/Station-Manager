/**
 * In-Memory Admin User Database Service
 * 
 * Provides admin user management for development and testing.
 * Production should use Table Storage implementation.
 */

import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import type { AdminUser } from '../types';

const SALT_ROUNDS = 10;

class AdminUserDatabase {
  private users: Map<string, AdminUser> = new Map();
  private usersByUsername: Map<string, AdminUser> = new Map();

  /**
   * Initialize with a default admin user if none exists
   */
  async initialize(defaultUsername?: string, defaultPassword?: string): Promise<void> {
    if (this.users.size === 0 && defaultUsername && defaultPassword) {
      await this.createAdminUser(defaultUsername, defaultPassword, 'admin');
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
    // Check if username already exists
    if (this.usersByUsername.has(username)) {
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

    this.users.set(user.id, user);
    this.usersByUsername.set(user.username, user);

    return user;
  }

  /**
   * Verify user credentials
   */
  async verifyCredentials(username: string, password: string): Promise<AdminUser | null> {
    const user = this.usersByUsername.get(username);
    
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

    return user;
  }

  /**
   * Get user by ID
   */
  async getUserById(id: string): Promise<AdminUser | null> {
    return this.users.get(id) || null;
  }

  /**
   * Get user by username
   */
  async getUserByUsername(username: string): Promise<AdminUser | null> {
    return this.usersByUsername.get(username) || null;
  }

  /**
   * Get all users
   */
  async getAllUsers(): Promise<AdminUser[]> {
    return Array.from(this.users.values());
  }

  /**
   * Update user
   */
  async updateUser(
    id: string,
    updates: Partial<Omit<AdminUser, 'id' | 'passwordHash'>>
  ): Promise<AdminUser | null> {
    const user = this.users.get(id);
    
    if (!user) {
      return null;
    }

    const updatedUser = {
      ...user,
      ...updates,
      updatedAt: new Date(),
    };

    this.users.set(id, updatedUser);
    this.usersByUsername.set(updatedUser.username, updatedUser);

    return updatedUser;
  }

  /**
   * Update user password
   */
  async updatePassword(id: string, newPassword: string): Promise<boolean> {
    const user = this.users.get(id);
    
    if (!user) {
      return false;
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    
    user.passwordHash = passwordHash;
    user.updatedAt = new Date();

    return true;
  }

  /**
   * Deactivate user (soft delete)
   */
  async deactivateUser(id: string): Promise<boolean> {
    const user = this.users.get(id);
    
    if (!user) {
      return false;
    }

    user.isActive = false;
    user.updatedAt = new Date();

    return true;
  }

  /**
   * Delete user (hard delete)
   */
  async deleteUser(id: string): Promise<boolean> {
    const user = this.users.get(id);
    
    if (!user) {
      return false;
    }

    this.users.delete(id);
    this.usersByUsername.delete(user.username);

    return true;
  }

  /**
   * Clear all data (for testing)
   */
  async clear(): Promise<void> {
    this.users.clear();
    this.usersByUsername.clear();
  }
}

// Singleton instance
let adminUserDbInstance: AdminUserDatabase | null = null;

export function getAdminUserDatabase(): AdminUserDatabase {
  if (!adminUserDbInstance) {
    adminUserDbInstance = new AdminUserDatabase();
  }
  return adminUserDbInstance;
}
