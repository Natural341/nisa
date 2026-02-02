import React, { createContext, useContext, useState, useCallback } from 'react';

type RefreshContextType = {
    lastUpdated: number;
    triggerRefresh: () => void;
};

const RefreshContext = createContext<RefreshContextType>({
    lastUpdated: 0,
    triggerRefresh: () => { },
});

export const RefreshProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [lastUpdated, setLastUpdated] = useState(Date.now());

    const triggerRefresh = useCallback(() => {
        const newValue = Date.now();
        console.log('[RefreshContext] triggerRefresh called, setting lastUpdated to:', newValue);
        setLastUpdated(newValue);
    }, []);

    return (
        <RefreshContext.Provider value={{ lastUpdated, triggerRefresh }}>
            {children}
        </RefreshContext.Provider>
    );
};

export const useRefresh = () => useContext(RefreshContext);
