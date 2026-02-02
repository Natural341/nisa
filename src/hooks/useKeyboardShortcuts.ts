import { useEffect, useCallback } from 'react';
import { ViewState } from '../../types';

interface ShortcutHandlers {
    setView?: (view: ViewState) => void;
    onSearch?: () => void;
    onEscape?: () => void;
    onNewItem?: () => void;
}

/**
 * Global keyboard shortcuts hook for desktop app
 * 
 * Shortcuts:
 * - Ctrl+F / Cmd+F: Focus search
 * - F2: Go to POS/Scanner mode
 * - F3: Go to Inventory
 * - F4: Go to Dashboard
 * - Escape: Close modals, clear search
 * - Ctrl+N: New item (in inventory)
 */
export const useKeyboardShortcuts = (handlers: ShortcutHandlers) => {
    const handleKeyDown = useCallback((event: KeyboardEvent) => {
        const { key, ctrlKey, metaKey } = event;
        const isModifier = ctrlKey || metaKey;

        // Ignore shortcuts when typing in input fields
        const target = event.target as HTMLElement;
        const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

        // F2 - POS/Scanner Mode
        if (key === 'F2' && handlers.setView) {
            event.preventDefault();
            handlers.setView(ViewState.POS);
            return;
        }

        // F3 - Inventory
        if (key === 'F3' && handlers.setView) {
            event.preventDefault();
            handlers.setView(ViewState.INVENTORY);
            return;
        }

        // F4 - Dashboard
        if (key === 'F4' && handlers.setView) {
            event.preventDefault();
            handlers.setView(ViewState.DASHBOARD);
            return;
        }

        // F5 - Transactions
        if (key === 'F5' && handlers.setView) {
            event.preventDefault();
            handlers.setView(ViewState.TRANSACTIONS);
            return;
        }

        // Escape - Close/Cancel
        if (key === 'Escape' && handlers.onEscape) {
            handlers.onEscape();
            return;
        }

        // Only process modifier shortcuts when not typing
        if (isTyping && !key.startsWith('F')) return;

        // Ctrl+F - Search
        if (isModifier && key.toLowerCase() === 'f' && handlers.onSearch) {
            event.preventDefault();
            handlers.onSearch();
            return;
        }

        // Ctrl+N - New Item
        if (isModifier && key.toLowerCase() === 'n' && handlers.onNewItem) {
            event.preventDefault();
            handlers.onNewItem();
            return;
        }
    }, [handlers]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);
};

export default useKeyboardShortcuts;
