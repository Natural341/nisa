import React, { createContext, useContext, useState, ReactNode } from 'react';
import { tauriInvoke, isTauri } from '../../services/tauriService';
import { User } from '../../types';

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    isAdmin: boolean;
    isLoading: boolean;
    login: (username: string, password: string) => Promise<boolean>;
    logout: () => void;
    updateCurrentUser: (user: User) => void;
    error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

interface AuthProviderProps {
    children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const login = async (username: string, password: string): Promise<boolean> => {
        setError(null);
        setIsLoading(true);

        // Check if Tauri is available
        if (!isTauri()) {
            setError('Uygulama Tauri modunda çalışmıyor');
            setIsLoading(false);
            return false;
        }

        try {
            const loggedInUser = await tauriInvoke<User>('login', { username, password });
            setUser(loggedInUser);
            return true;
        } catch (err) {
            const errorMsg = typeof err === 'string' ? err : (err as Error).message || 'Giriş başarısız';
            setError(errorMsg);
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const logout = () => {
        setUser(null);
    };

    const updateCurrentUser = (updatedUser: User) => {
        setUser(updatedUser);
    };

    const value: AuthContextType = {
        user,
        isAuthenticated: !!user,
        isAdmin: user?.role === 'admin',
        isLoading,
        login,
        logout,
        updateCurrentUser,
        error,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
