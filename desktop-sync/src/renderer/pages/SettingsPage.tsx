import React, { useState, useEffect } from 'react';

interface SettingsPageProps {
  onBack: () => void;
  onLogout: () => void;
}

interface ExclusionRule {
  id: string;
  rule_type: 'extension' | 'size' | 'pattern';
  value: string;
  action: 'skip' | 'include';
  description: string;
  is_default: boolean;
  priority: number;
}

interface UserInfo {
  name: string;
  email: string;
  organization: { name: string };
}

export default function SettingsPage({ onBack, onLogout }: SettingsPageProps) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [syncFolder, setSyncFolder] = useState<string | null>(null);
  const [exclusionRules, setExclusionRules] = useState<ExclusionRule[]>([]);
  const [userOverrides, setUserOverrides] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const [userInfo, folder, rules] = await Promise.all([
        window.electronAPI.auth.getUser(),
        window.electronAPI.files.getSyncFolder(),
        window.electronAPI.sync.getExclusions(),
      ]);

      setUser(userInfo);
      setSyncFolder(folder);
      setExclusionRules(rules);

      // Build user overrides map
      const overrides: Record<string, boolean> = {};
      rules.forEach((rule) => {
        if (!rule.is_default) {
          overrides[`${rule.rule_type}:${rule.value}`] = rule.action === 'include';
        }
      });
      setUserOverrides(overrides);
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleExclusion = async (rule: ExclusionRule) => {
    const key = `${rule.rule_type}:${rule.value}`;
    const currentlyIncluded = userOverrides[key] ?? (rule.action === 'include');
    const newValue = !currentlyIncluded;

    setUserOverrides((prev) => ({
      ...prev,
      [key]: newValue,
    }));

    setIsSaving(true);
    try {
      // Build updated rules list
      const updatedRules = exclusionRules.map((r) => {
        if (r.id === rule.id) {
          return { ...r, action: newValue ? 'include' : 'skip' };
        }
        return r;
      });

      await window.electronAPI.sync.updateExclusions(updatedRules);
    } catch (error) {
      console.error('Failed to save exclusion:', error);
      // Revert on error
      setUserOverrides((prev) => ({
        ...prev,
        [key]: !newValue,
      }));
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangeSyncFolder = async () => {
    // This would open a folder picker dialog
    // For now, just show an alert
    alert('Folder picker not implemented yet');
  };

  const handleLogout = async () => {
    if (confirm('Are you sure you want to sign out?')) {
      onLogout();
    }
  };

  const groupedRules = {
    extensions: exclusionRules.filter((r) => r.rule_type === 'extension'),
    patterns: exclusionRules.filter((r) => r.rule_type === 'pattern'),
    sizes: exclusionRules.filter((r) => r.rule_type === 'size'),
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <h1 className="text-lg font-medium text-gray-900 dark:text-white">
            Settings
          </h1>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Account section */}
        <div className="px-4 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
            Account
          </h2>
          {user && (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {user.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {user.email}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {user.organization.name}
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>

        {/* Sync folder section */}
        <div className="px-4 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
            Sync Location
          </h2>
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-900 dark:text-white truncate">
                {syncFolder || 'Not set'}
              </p>
            </div>
            <button
              onClick={handleChangeSyncFolder}
              className="ml-3 px-3 py-1.5 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
            >
              Change
            </button>
          </div>
        </div>

        {/* File type exclusions */}
        <div className="px-4 py-4">
          <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
            File Types to Sync
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Enable file types you want to sync. Disabled types will show as placeholders only.
          </p>

          {/* Extension rules */}
          {groupedRules.extensions.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                File Extensions
              </h3>
              <div className="space-y-2">
                {groupedRules.extensions.map((rule) => {
                  const key = `${rule.rule_type}:${rule.value}`;
                  const isEnabled = userOverrides[key] ?? (rule.action === 'include');

                  return (
                    <label
                      key={rule.id}
                      className="flex items-center justify-between py-2 px-3 bg-white dark:bg-gray-800 rounded-lg"
                    >
                      <div>
                        <span className="text-sm text-gray-900 dark:text-white">
                          {rule.description}
                        </span>
                        <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                          ({rule.value})
                        </span>
                      </div>
                      <button
                        onClick={() => handleToggleExclusion(rule)}
                        disabled={isSaving}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          isEnabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'
                        }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            isEnabled ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Size rules */}
          {groupedRules.sizes.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                File Size Limits
              </h3>
              <div className="space-y-2">
                {groupedRules.sizes.map((rule) => {
                  const key = `${rule.rule_type}:${rule.value}`;
                  const isEnabled = userOverrides[key] ?? (rule.action === 'include');

                  return (
                    <label
                      key={rule.id}
                      className="flex items-center justify-between py-2 px-3 bg-white dark:bg-gray-800 rounded-lg"
                    >
                      <div>
                        <span className="text-sm text-gray-900 dark:text-white">
                          {rule.description}
                        </span>
                      </div>
                      <button
                        onClick={() => handleToggleExclusion(rule)}
                        disabled={isSaving}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          isEnabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'
                        }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            isEnabled ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Pattern rules - typically system files, always skipped */}
          {groupedRules.patterns.length > 0 && (
            <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
              <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Always Excluded (System Files)
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {groupedRules.patterns.map((r) => r.value).join(', ')}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 text-center">
        <p className="text-xs text-gray-400">
          TEEEM Sync v0.1.0
        </p>
      </div>
    </div>
  );
}
