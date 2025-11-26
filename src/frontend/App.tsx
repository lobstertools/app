/*
 * =================================================================
 * Project:   Lobster Lock - Self-Bondage Session Manager
 * File:      App.tsx
 *
 * SPDX-License-Identifier: Apache-2.0
 *
 * Description:
 * Main React application component. Defines the entire frontend UI,
 * state management (`SessionProvider`), and all components. This app
 * communicates with the Node.js backend proxy, not the lock directly.
 *
 * This version supports device discovery, provisioning, and forgetting.
 * =================================================================
 */

import { useEffect, useState } from 'react';

import { ConfigProvider, theme as antdTheme, App as AntdApp } from 'antd';
import { AppContent } from './components/layout/AppContent';
import { SessionProvider } from './context/SessionProvider.tsx';
import { AppRuntimeProvider } from './context/AppRuntimeProvider.tsx';
import { DeviceManagerProvider } from './context/DeviceManagerProvider.tsx';

const globalStyles = `
  body {
    /* Standard syntax */
    user-select: none;
    
    /* Vendor prefixes for older browser compatibility */
    -webkit-user-select: none; /* Safari */
    -moz-user-select: none;    /* Firefox */
    -ms-user-select: none;     /* Internet Explorer/Edge */    
  }
  .selectable-text {
    user-select: all;
    -webkit-user-select: all;
    -moz-user-select: all;
    -ms-user-select: all;
  }    
`;

/**
 * Root component for the entire React application.
 * Sets up the Ant Design theme and the global SessionProvider.
 */
function App() {
    // State for managing light/dark theme
    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        const savedTheme = localStorage.getItem('app-theme');
        return savedTheme === 'dark' || savedTheme === 'light' ? savedTheme : 'dark';
    });

    // Function to toggle theme
    const toggleTheme = () => {
        setTheme((currentTheme) => (currentTheme === 'light' ? 'dark' : 'light'));
    };

    // Save theme changes to localStorage
    useEffect(() => {
        localStorage.setItem('app-theme', theme);
    }, [theme]);

    // Select the correct Ant Design theme algorithm
    const antdAlgorithm = theme === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm;

    return (
        <>
            <style>{globalStyles}</style>
            <ConfigProvider theme={{ algorithm: antdAlgorithm }}>
                <AntdApp>
                    <AppRuntimeProvider>
                        <DeviceManagerProvider>
                            <SessionProvider>
                                <AppContent theme={theme} toggleTheme={toggleTheme} />
                            </SessionProvider>
                        </DeviceManagerProvider>
                    </AppRuntimeProvider>
                </AntdApp>
            </ConfigProvider>
        </>
    );
}

export default App;
