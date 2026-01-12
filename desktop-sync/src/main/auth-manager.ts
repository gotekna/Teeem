import { v4 as uuidv4 } from 'uuid';
import { LocalDatabase } from './local-database';
import { API_BASE_URL } from './config';

interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_url: string;
  expires_in: number;
  interval: number;
}

interface AuthPollResponse {
  status: 'pending' | 'authorized' | 'expired' | 'error';
  access_token?: string;
  refresh_token?: string;
  user?: UserInfo;
}

interface UserInfo {
  id: number;
  email: string;
  name: string;
  organization: {
    id: number;
    name: string;
  };
}

interface TokenInfo {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

export class AuthManager {
  private db: LocalDatabase;
  private deviceId: string;
  private currentDeviceCode: string | null = null;
  private pollInterval: number = 5;
  private tokenInfo: TokenInfo | null = null;
  private currentUser: UserInfo | null = null;

  constructor(db: LocalDatabase) {
    this.db = db;
    this.deviceId = this.getOrCreateDeviceId();
    this.loadStoredCredentials();
  }

  private getOrCreateDeviceId(): string {
    let deviceId = this.db.getSetting('device_id');
    if (!deviceId) {
      deviceId = uuidv4();
      this.db.setSetting('device_id', deviceId);
    }
    return deviceId;
  }

  private loadStoredCredentials(): void {
    const tokenData = this.db.getSetting('token_info');
    if (tokenData) {
      try {
        this.tokenInfo = JSON.parse(tokenData);
        const userData = this.db.getSetting('user_info');
        if (userData) {
          this.currentUser = JSON.parse(userData);
        }
      } catch {
        // Invalid stored data, clear it
        this.db.deleteSetting('token_info');
        this.db.deleteSetting('user_info');
      }
    }
  }

  private saveCredentials(): void {
    if (this.tokenInfo) {
      this.db.setSetting('token_info', JSON.stringify(this.tokenInfo));
    }
    if (this.currentUser) {
      this.db.setSetting('user_info', JSON.stringify(this.currentUser));
    }
  }

  private clearCredentials(): void {
    this.tokenInfo = null;
    this.currentUser = null;
    this.db.deleteSetting('token_info');
    this.db.deleteSetting('user_info');
  }

  isLoggedIn(): boolean {
    return this.tokenInfo !== null && this.tokenInfo.expires_at > Date.now();
  }

  getCurrentUser(): UserInfo | null {
    return this.currentUser;
  }

  getDeviceId(): string {
    return this.deviceId;
  }

  async getAccessToken(): Promise<string | null> {
    if (!this.tokenInfo) {
      return null;
    }

    // Check if token is about to expire (within 5 minutes)
    if (this.tokenInfo.expires_at - Date.now() < 5 * 60 * 1000) {
      await this.refreshAccessToken();
    }

    return this.tokenInfo?.access_token ?? null;
  }

  async initiateDeviceAuth(): Promise<DeviceCodeResponse> {
    const response = await fetch(`${API_BASE_URL}/api/v1/sync/auth/device_code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        device_id: this.deviceId,
        device_name: this.getDeviceName(),
        platform: process.platform,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to initiate device authentication');
    }

    const data = await response.json();
    this.currentDeviceCode = data.data.device_code;
    this.pollInterval = data.data.interval || 5;

    return data.data;
  }

  async pollAuthStatus(): Promise<AuthPollResponse> {
    if (!this.currentDeviceCode) {
      throw new Error('No active device code');
    }

    const response = await fetch(`${API_BASE_URL}/api/v1/sync/auth/poll`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Device-Code': this.currentDeviceCode,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      return { status: 'error', ...errorData };
    }

    const data = await response.json();

    if (data.data.status === 'authorized') {
      // Store the tokens
      this.tokenInfo = {
        access_token: data.data.access_token,
        refresh_token: data.data.refresh_token,
        expires_at: Date.now() + (data.data.expires_in || 3600) * 1000,
      };
      this.currentUser = data.data.user;
      this.saveCredentials();
      this.currentDeviceCode = null;
    }

    return data.data;
  }

  async refreshAccessToken(): Promise<boolean> {
    if (!this.tokenInfo?.refresh_token) {
      return false;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/sync/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refresh_token: this.tokenInfo.refresh_token,
          device_id: this.deviceId,
        }),
      });

      if (!response.ok) {
        // Refresh failed, clear credentials
        this.clearCredentials();
        return false;
      }

      const data = await response.json();
      this.tokenInfo = {
        access_token: data.data.access_token,
        refresh_token: data.data.refresh_token || this.tokenInfo.refresh_token,
        expires_at: Date.now() + (data.data.expires_in || 3600) * 1000,
      };
      this.saveCredentials();
      return true;
    } catch {
      return false;
    }
  }

  async logout(): Promise<void> {
    if (this.tokenInfo?.access_token) {
      try {
        await fetch(`${API_BASE_URL}/api/v1/sync/auth/logout`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${this.tokenInfo.access_token}`,
            'Content-Type': 'application/json',
          },
        });
      } catch {
        // Ignore errors during logout
      }
    }

    this.clearCredentials();
  }

  private getDeviceName(): string {
    const os = require('os');
    return os.hostname() || 'Unknown Device';
  }

  getPollInterval(): number {
    return this.pollInterval;
  }
}
