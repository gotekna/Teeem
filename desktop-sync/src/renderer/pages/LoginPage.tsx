import React, { useState, useEffect } from 'react';

interface LoginPageProps {
  onSuccess: () => void;
}

interface DeviceCodeState {
  user_code: string;
  verification_url: string;
  expires_at: number;
}

export default function LoginPage({ onSuccess }: LoginPageProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [deviceCode, setDeviceCode] = useState<DeviceCodeState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pollTimer, setPollTimer] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (pollTimer) {
        clearInterval(pollTimer);
      }
    };
  }, [pollTimer]);

  const startLogin = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await window.electronAPI.auth.getDeviceCode();

      setDeviceCode({
        user_code: response.user_code,
        verification_url: response.verification_url,
        expires_at: Date.now() + response.expires_in * 1000,
      });

      // Start polling for authorization
      const interval = (response.interval || 5) * 1000;
      const timer = setInterval(async () => {
        try {
          const pollResponse = await window.electronAPI.auth.pollStatus();

          if (pollResponse.status === 'authorized') {
            clearInterval(timer);
            setPollTimer(null);
            onSuccess();
          } else if (pollResponse.status === 'expired') {
            clearInterval(timer);
            setPollTimer(null);
            setDeviceCode(null);
            setError('Login code expired. Please try again.');
          }
        } catch (err) {
          console.error('Poll error:', err);
        }
      }, interval);

      setPollTimer(timer);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start login');
    } finally {
      setIsLoading(false);
    }
  };

  const cancelLogin = () => {
    if (pollTimer) {
      clearInterval(pollTimer);
      setPollTimer(null);
    }
    setDeviceCode(null);
    setError(null);
  };

  const openVerificationUrl = () => {
    if (deviceCode) {
      // Open URL in default browser
      window.open(deviceCode.verification_url, '_blank');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            TEEEM Sync
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Keep your files in sync
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-sm">
          {!deviceCode ? (
            // Initial state - show login button
            <div className="text-center">
              <div className="mb-6">
                <svg
                  className="mx-auto h-16 w-16 text-blue-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"
                  />
                </svg>
              </div>

              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Sign in to your TEEEM account to start syncing your files.
              </p>

              {error && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <button
                onClick={startLogin}
                disabled={isLoading}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center">
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Starting...
                  </span>
                ) : (
                  'Sign in to TEEEM'
                )}
              </button>
            </div>
          ) : (
            // Device code state - show code and instructions
            <div className="text-center">
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Enter this code on the TEEEM website:
              </p>

              <div className="mb-6">
                <div className="inline-block bg-gray-100 dark:bg-gray-800 rounded-lg px-6 py-4">
                  <span className="text-3xl font-mono font-bold text-gray-900 dark:text-white tracking-widest">
                    {deviceCode.user_code}
                  </span>
                </div>
              </div>

              <button
                onClick={openVerificationUrl}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors mb-3"
              >
                Open TEEEM Login Page
              </button>

              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                Or go to:{' '}
                <span className="font-mono">{deviceCode.verification_url}</span>
              </p>

              <div className="flex items-center justify-center text-sm text-gray-500 dark:text-gray-400 mb-4">
                <svg
                  className="animate-spin h-4 w-4 mr-2"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Waiting for authorization...
              </div>

              <button
                onClick={cancelLogin}
                className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="py-4 text-center text-xs text-gray-400">
        TEEEM Sync v0.1.0
      </div>
    </div>
  );
}
