import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { licenseService } from '../../services/licenseService';
import { License } from '../../types';

interface LicenseContextType {
  license: License | null;
  isLicensed: boolean;
  isLoading: boolean;
  isExpired: boolean;
  daysUntilExpiry: number | null;
  error: string | null;
  activateLicense: (apiBaseUrl: string, licenseKey: string) => Promise<boolean>;
  checkLicense: () => Promise<boolean>;
  deactivateLicense: () => Promise<void>;
  clearError: () => void;
}

const LicenseContext = createContext<LicenseContextType | undefined>(undefined);

export const useLicense = () => {
  const context = useContext(LicenseContext);
  if (context === undefined) {
    throw new Error('useLicense must be used within a LicenseProvider');
  }
  return context;
};

interface LicenseProviderProps {
  children: ReactNode;
}

export const LicenseProvider: React.FC<LicenseProviderProps> = ({ children }) => {
  const [license, setLicense] = useState<License | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isLicensed = license !== null && license.isActive;
  const isExpired = license ? licenseService.isLicenseExpired(license) : false;
  const daysUntilExpiry = license ? licenseService.getDaysUntilExpiry(license) : null;

  // Check license on mount
  useEffect(() => {
    checkLicense();
  }, []);

  const checkLicense = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      // First check local license
      const localLicense = await licenseService.getLicenseStatus();

      if (!localLicense) {
        setLicense(null);
        setIsLoading(false);
        return false;
      }

      // Check if license is valid (includes expiry and revalidation)
      const isValid = await licenseService.checkLicenseValidity();

      if (isValid) {
        setLicense(localLicense);
        setIsLoading(false);
        return true;
      } else {
        setLicense(null);
        setError('Lisans gecersiz veya suresi dolmus');
        setIsLoading(false);
        return false;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Lisans kontrolu sirasinda hata olustu';
      setError(errorMessage);
      setLicense(null);
      setIsLoading(false);
      return false;
    }
  }, []);

  const activateLicense = useCallback(async (apiBaseUrl: string, licenseKey: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await licenseService.activateLicense(apiBaseUrl, licenseKey);

      if (response.success) {
        // Fetch the saved license
        const savedLicense = await licenseService.getLicenseStatus();
        setLicense(savedLicense);
        setIsLoading(false);
        return true;
      } else {
        setError(response.message || response.error || 'Lisans aktivasyonu basarisiz');
        setIsLoading(false);
        return false;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Lisans aktivasyonu sirasinda hata olustu';
      setError(errorMessage);
      setIsLoading(false);
      return false;
    }
  }, []);

  const deactivateLicense = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      await licenseService.deactivateLicense();
      setLicense(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Lisans deaktivasyonu sirasinda hata olustu';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value: LicenseContextType = {
    license,
    isLicensed,
    isLoading,
    isExpired,
    daysUntilExpiry,
    error,
    activateLicense,
    checkLicense,
    deactivateLicense,
    clearError,
  };

  return (
    <LicenseContext.Provider value={value}>
      {children}
    </LicenseContext.Provider>
  );
};
