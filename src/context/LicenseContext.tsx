import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { licenseService } from '../../services/licenseService';
import { cloudService } from '../../services/cloudService';
import { License } from '../../types';

// Periyodik kontrol aralığı (milisaniye) - 24 saat (günde 1 kere)
const LICENSE_CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 saat
// Açılışta beklenecek süre (API'ye bağlanma denemesi için)
const STARTUP_CHECK_TIMEOUT = 10000; // 10 saniye

interface LicenseContextType {
  license: License | null;
  isLicensed: boolean;
  isLoading: boolean;
  isExpired: boolean;
  isRevoked: boolean;
  daysUntilExpiry: number | null;
  error: string | null;
  activateLicense: (apiBaseUrl: string, licenseKey: string) => Promise<boolean>;
  checkLicense: () => Promise<boolean>;
  validateOnline: () => Promise<boolean>;
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
  const [isLoading, setIsLoading] = useState(true); // Açılışta loading true
  const [error, setError] = useState<string | null>(null);

  const [isLicensed, setIsLicensed] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const [isRevoked, setIsRevoked] = useState(false);
  const [daysUntilExpiry, setDaysUntilExpiry] = useState<number | null>(null);

  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);



  // Online lisans doğrulama - API'den kontrol eder
  const validateOnline = useCallback(async (): Promise<boolean> => {
    try {
      const localLicense = await licenseService.getLicenseStatus();
      if (!localLicense || !localLicense.apiBaseUrl || !localLicense.licenseKey) {
        return false;
      }

      const response = await licenseService.validateLicense(
        localLicense.apiBaseUrl,
        localLicense.licenseKey
      );

      if (!response.valid) {
        // Lisans iptal edilmiş veya geçersiz
        setIsRevoked(true);
        setIsLicensed(false);
        setError('Lisans iptal edilmiş veya geçersiz. Lütfen yöneticinizle iletişime geçin.');
        return false;
      }

      setIsRevoked(false);
      return true;
    } catch (err) {
      // API'ye ulaşılamıyorsa offline modda devam et (son kontrol 24 saatten yeniyse)
      console.warn('Online lisans kontrolü başarısız, offline devam ediliyor:', err);
      return true; // Offline modda izin ver
    }
  }, []);

  const checkLicense = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    setIsRevoked(false);

    try {
      // WEB MODE BYPASS: If we are not in Tauri, skip the license check
      const isWeb = typeof window !== 'undefined' && !('__TAURI__' in window);

      if (isWeb) {
        // Web mode: license bypass
        setLicense({
          licenseKey: 'WEB-MODE-LICENSE',
          dealerId: 'web-dealer',
          dealerName: 'Web Mode (No License)',
          macAddress: 'WEB-MAC',
          activatedAt: new Date().toISOString(),
          isActive: true,
          apiBaseUrl: ''
        });
        setIsLicensed(true);
        setIsExpired(false);
        setIsLoading(false);
        return true;
      }

      // İlk olarak yerel lisansı kontrol et
      const localLicense = await licenseService.getLicenseStatus();

      if (!localLicense) {
        setLicense(null);
        setIsLicensed(false);
        setIsLoading(false);
        return false;
      }

      // Yerel geçerlilik kontrolü (expiry vs)
      const isLocalValid = await licenseService.checkLicenseValidity();
      const days = licenseService.getDaysUntilExpiry(localLicense);
      setDaysUntilExpiry(days);

      if (!isLocalValid) {
        setLicense(null);
        setIsLicensed(false);
        setIsExpired(true);
        setError('Lisans süresi dolmuş');
        setIsLoading(false);
        return false;
      }

      // Online doğrulama - API'den lisansın aktif olup olmadığını kontrol et
      const isOnlineValid = await validateOnline();

      if (!isOnlineValid) {
        // Lisans iptal edilmiş - önce verileri yedekle
        console.log('[License] Lisans geçersiz, acil yedekleme yapılıyor...');
        try {
          await cloudService.backup();
          console.log('[License] Acil yedekleme tamamlandı.');
          setError('Lisans iptal edilmiş. Verileriniz yedeklendi.');
        } catch (backupError) {
          console.error('[License] Acil yedekleme başarısız:', backupError);
          setError('Lisans iptal edilmiş. Yedekleme başarısız oldu!');
        }

        setLicense(null);
        setIsLicensed(false);
        setIsLoading(false);
        return false;
      }

      setLicense(localLicense);
      setIsLicensed(true);
      setIsExpired(false);
      setIsLoading(false);
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Lisans kontrolu sirasinda hata olustu';
      setError(errorMessage);
      setLicense(null);
      setIsLicensed(false);
      setIsLoading(false);
      return false;
    }
  }, [validateOnline]);

  const activateLicense = useCallback(async (apiBaseUrl: string, licenseKey: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await licenseService.activateLicense(apiBaseUrl, licenseKey);

      if (response.success) {
        // Fetch the saved license
        const savedLicense = await licenseService.getLicenseStatus();
        setLicense(savedLicense);
        setIsLicensed(true);
        setIsExpired(false);
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

  // Açılışta ve periyodik olarak lisans kontrolü
  useEffect(() => {
    // Açılışta kontrol
    checkLicense();

    // Periyodik kontrol başlat (sadece Tauri'de)
    const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;

    if (isTauri) {
      checkIntervalRef.current = setInterval(async () => {
        console.log('[License] Günlük lisans kontrolü yapılıyor...');
        const isValid = await validateOnline();

        if (!isValid) {
          console.log('[License] Lisans geçersiz! Acil yedekleme yapılıyor...');

          // Önce kullanıcının verilerini yedekle
          try {
            await cloudService.backup();
            console.log('[License] Acil yedekleme tamamlandı.');
          } catch (backupError) {
            console.error('[License] Acil yedekleme başarısız:', backupError);
          }

          setIsLicensed(false);
          setIsRevoked(true);
          setError('Lisans iptal edilmiş. Verileriniz yedeklendi. Uygulama kilitlenecek.');

          // 10 saniye sonra lisans ekranına yönlendir (kullanıcı mesajı okusun)
          setTimeout(() => {
            window.location.reload();
          }, 10000);
        }
      }, LICENSE_CHECK_INTERVAL);
    }

    // Cleanup
    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [checkLicense, validateOnline]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value: LicenseContextType = {
    license,
    isLicensed,
    isLoading,
    isExpired,
    isRevoked,
    daysUntilExpiry,
    error,
    activateLicense,
    checkLicense,
    validateOnline,
    deactivateLicense,
    clearError,
  };

  return (
    <LicenseContext.Provider value={value}>
      {children}
    </LicenseContext.Provider>
  );
};
