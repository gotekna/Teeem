import React, { useState, useEffect } from 'react';
import LoginPage from './pages/LoginPage';
import MainPage from './pages/MainPage';
import SettingsPage from './pages/SettingsPage';

type Page = 'login' | 'main' | 'settings';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('login');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in
    const checkAuth = async () => {
      try {
        const isLoggedIn = await window.electronAPI.auth.isLoggedIn();
        setCurrentPage(isLoggedIn ? 'main' : 'login');
      } catch (error) {
        console.error('Auth check failed:', error);
        setCurrentPage('login');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();

    // Listen for navigation events from main process
    window.electronAPI.on('navigate', (path: unknown) => {
      if (path === '/settings') {
        setCurrentPage('settings');
      } else if (path === '/main') {
        setCurrentPage('main');
      }
    });
  }, []);

  const handleLoginSuccess = () => {
    setCurrentPage('main');
  };

  const handleLogout = async () => {
    await window.electronAPI.auth.logout();
    setCurrentPage('login');
  };

  const handleNavigate = (page: Page) => {
    setCurrentPage(page);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  switch (currentPage) {
    case 'login':
      return <LoginPage onSuccess={handleLoginSuccess} />;
    case 'settings':
      return (
        <SettingsPage
          onBack={() => handleNavigate('main')}
          onLogout={handleLogout}
        />
      );
    case 'main':
    default:
      return (
        <MainPage
          onSettings={() => handleNavigate('settings')}
          onLogout={handleLogout}
        />
      );
  }
}

export default App;
