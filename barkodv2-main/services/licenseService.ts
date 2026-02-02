import { tauriInvoke, isTauri } from './tauriService';
import { License, LicenseValidateResponse, LicenseActivateResponse } from '../types';

class LicenseService {
  /**
   * Get the device MAC address
   */
  async getMacAddress(): Promise<string> {
    if (!isTauri()) {
      return 'DEV-MAC-ADDRESS';
    }
    return tauriInvoke<string>('get_mac_address');
  }

  /**
   * Get current license status from local database
   */
  async getLicenseStatus(): Promise<License | null> {
    if (!isTauri()) {
      // Return mock license for development
      return {
        licenseKey: 'DEV-LICENSE',
        dealerId: 'dev-dealer',
        dealerName: 'Development Dealer',
        macAddress: 'DEV-MAC',
        activatedAt: new Date().toISOString(),
        isActive: true,
        apiBaseUrl: 'http://localhost:3000',
      };
    }
    return tauriInvoke<License | null>('get_license_status');
  }

  /**
   * Validate license with API server
   */
  async validateLicense(apiBaseUrl: string, licenseKey: string): Promise<LicenseValidateResponse> {
    if (!isTauri()) {
      return {
        valid: true,
        dealer_id: 'dev-dealer',
        dealer_name: 'Development Dealer',
      };
    }
    return tauriInvoke<LicenseValidateResponse>('validate_license', {
      apiBaseUrl,
      licenseKey,
    });
  }

  /**
   * Activate license and save to local database
   */
  async activateLicense(apiBaseUrl: string, licenseKey: string): Promise<LicenseActivateResponse> {
    if (!isTauri()) {
      return {
        success: true,
        dealer_id: 'dev-dealer',
        dealer_name: 'Development Dealer',
        activated_at: new Date().toISOString(),
      };
    }
    return tauriInvoke<LicenseActivateResponse>('activate_license', {
      apiBaseUrl,
      licenseKey,
    });
  }

  /**
   * Check if current license is valid (includes expiry and revalidation check)
   */
  async checkLicenseValidity(): Promise<boolean> {
    if (!isTauri()) {
      return true; // Always valid in dev mode
    }
    return tauriInvoke<boolean>('check_license_validity');
  }

  /**
   * Deactivate/remove license from local database
   */
  async deactivateLicense(): Promise<void> {
    if (!isTauri()) {
      return;
    }
    return tauriInvoke<void>('deactivate_license');
  }

  /**
   * Check if license is expired based on expires_at date
   */
  isLicenseExpired(license: License): boolean {
    if (!license.expiresAt) return false;
    return new Date() > new Date(license.expiresAt);
  }

  /**
   * Get days until license expiry
   */
  getDaysUntilExpiry(license: License): number | null {
    if (!license.expiresAt) return null;
    const expiryDate = new Date(license.expiresAt);
    const now = new Date();
    const diff = expiryDate.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  /**
   * Format expiry date for display
   */
  formatExpiryDate(license: License): string {
    if (!license.expiresAt) return 'Süresiz';
    return new Date(license.expiresAt).toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }
}

export const licenseService = new LicenseService();
