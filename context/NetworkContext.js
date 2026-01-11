// context/NetworkContext.js
// Network state context for offline mode detection and handling

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NetworkContext = createContext({
    isConnected: true,
    isInternetReachable: true,
    connectionType: 'unknown',
    showOfflineDialog: false,
    dismissOfflineDialog: () => { },
});

const OFFLINE_DIALOG_DISMISSED_KEY = '@memry_offline_dialog_dismissed';

export const useNetwork = () => {
    const context = useContext(NetworkContext);
    if (!context) {
        throw new Error('useNetwork must be used within a NetworkProvider');
    }
    return context;
};

export const NetworkProvider = ({ children }) => {
    const [networkState, setNetworkState] = useState({
        isConnected: true,
        isInternetReachable: true,
        connectionType: 'unknown',
    });
    const [showOfflineDialog, setShowOfflineDialog] = useState(false);
    const [dialogDismissedThisSession, setDialogDismissedThisSession] = useState(false);

    useEffect(() => {
        // Subscribe to network state changes
        const unsubscribe = NetInfo.addEventListener(state => {
            const isOnline = state.isConnected && state.isInternetReachable !== false;

            setNetworkState({
                isConnected: state.isConnected ?? false,
                isInternetReachable: state.isInternetReachable ?? true,
                connectionType: state.type || 'unknown',
            });

            // Show offline dialog when going offline (once per session)
            if (!isOnline && !dialogDismissedThisSession) {
                setShowOfflineDialog(true);
            } else if (isOnline) {
                // Hide dialog when back online
                setShowOfflineDialog(false);
                // Reset the dismissed flag when we come back online
                setDialogDismissedThisSession(false);
            }
        });

        // Initial check
        NetInfo.fetch().then(state => {
            const isOnline = state.isConnected && state.isInternetReachable !== false;
            setNetworkState({
                isConnected: state.isConnected ?? false,
                isInternetReachable: state.isInternetReachable ?? true,
                connectionType: state.type || 'unknown',
            });

            if (!isOnline && !dialogDismissedThisSession) {
                setShowOfflineDialog(true);
            }
        });

        return () => {
            unsubscribe();
        };
    }, [dialogDismissedThisSession]);

    const dismissOfflineDialog = useCallback(() => {
        setShowOfflineDialog(false);
        setDialogDismissedThisSession(true);
    }, []);

    const value = {
        isConnected: networkState.isConnected,
        isInternetReachable: networkState.isInternetReachable,
        connectionType: networkState.connectionType,
        isOffline: !networkState.isConnected || networkState.isInternetReachable === false,
        showOfflineDialog,
        dismissOfflineDialog,
    };

    return (
        <NetworkContext.Provider value={value}>
            {children}
        </NetworkContext.Provider>
    );
};

export default NetworkContext;
