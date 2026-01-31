import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { MockService } from '../services/api';
import toast from 'react-hot-toast';

export interface LicenseInfo {
    key: string;
    dealerName: string;
    expiryDate: string;
    status: string;
    daysRemaining: number;
}

interface LicenseContextType {
    isLicensed: boolean;
    licenseInfo: LicenseInfo | null;
    loading: boolean;
    checkLicense: () => Promise<boolean>;
}

const LicenseContext = createContext<LicenseContextType | undefined>(undefined);

// Simple pseudo-random ID generator for browser/demo
// In a real Tauri app, you'd use tauri's getMachineId or similar
const getMachineId = () => {
    let id = localStorage.getItem('nexus_device_id');
    if (!id) {
        id = 'dev-' + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('nexus_device_id', id);
    }
    return id;
};

export const LicenseProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [isLicensed, setIsLicensed] = useState(false);
    const [licenseInfo, setLicenseInfo] = useState<LicenseInfo | null>(null);
    const [loading, setLoading] = useState(true);

    const checkLicense = async () => {
        setLoading(true);
        const key = localStorage.getItem('nexus_license_key');
        const deviceId = getMachineId();

        if (!key) {
            setIsLicensed(false);
            setLicenseInfo(null);
            setLoading(false);
            return false;
        }

        const result = await MockService.validateLicense(key, deviceId);

        if (result.valid) {
            setIsLicensed(true);

            // Calculate days remaining
            const expiry = new Date(result.expires_at || Date.now());
            const now = new Date();
            const diffTime = Math.abs(expiry.getTime() - now.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            setLicenseInfo({
                key: key,
                dealerName: result.dealer_name || 'Direct',
                expiryDate: result.expires_at || new Date().toISOString(),
                status: 'Active',
                daysRemaining: diffDays
            });

        } else {
            setIsLicensed(false);
            setLicenseInfo(null);

            // CRITICAL: If validation fails (invalid key, expired, etc), clear it so we don't get stuck
            // But we must distinguish "Connection Error" from "Invalid Key".
            // MockService returns { valid: false, message: ... }

            if (result.message === 'Connection failed') {
                // Keep the key if it's just a network error, maybe show a "Offline" mode or block?
                // For now, blocking is safer for security.
                // Optional: toast.error('License check failed: Server unreachable');
            } else {
                // Explicit invalid key -> Remove it
                localStorage.removeItem('nexus_license_key');
            }
        }
        setLoading(false);
        return result.valid;
    };

    useEffect(() => {
        checkLicense();
    }, []);

    return (
        <LicenseContext.Provider value={{ isLicensed, licenseInfo, loading, checkLicense }}>
            {children}
        </LicenseContext.Provider>
    );
};

export const useLicense = () => {
    const context = useContext(LicenseContext);
    if (!context) {
        throw new Error('useLicense must be used within a LicenseProvider');
    }
    return context;
};
