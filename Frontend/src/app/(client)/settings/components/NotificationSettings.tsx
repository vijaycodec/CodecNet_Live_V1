'use client';

import { useState } from 'react';
import { BellIcon } from '@heroicons/react/24/outline';
import { clsx } from 'clsx';
import { NotificationSettings as NotificationSettingsType } from '../types';

interface NotificationSettingsProps {
  settings: NotificationSettingsType;
  onSettingsChange: (settings: NotificationSettingsType) => void;
}

export default function NotificationSettings({
  settings,
  onSettingsChange
}: NotificationSettingsProps) {
  const updateSettings = (updates: Partial<NotificationSettingsType>) => {
    onSettingsChange({ ...settings, ...updates });
  };

  const updateNestedSettings = <T extends 'alertThresholds' | 'channels'>(
    section: T,
    updates: Partial<NotificationSettingsType[T]>
  ) => {
    onSettingsChange({
      ...settings,
      [section]: { ...(settings[section] as object), ...updates }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
          Notification Settings
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Configure how you receive alerts and notifications
        </p>
      </div>

      <div className="space-y-6">
        {/* Alert Methods */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Alert Methods
          </h4>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-900 dark:text-white">
                  Email Alerts
                </label>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Receive notifications via email
                </p>
              </div>
              <ToggleSwitch
                enabled={settings.emailAlerts}
                onChange={(enabled) => updateSettings({ emailAlerts: enabled })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-900 dark:text-white">
                  SMS Alerts
                </label>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Receive notifications via SMS
                </p>
              </div>
              <ToggleSwitch
                enabled={settings.smsAlerts}
                onChange={(enabled) => updateSettings({ smsAlerts: enabled })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-900 dark:text-white">
                  Push Notifications
                </label>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Receive browser push notifications
                </p>
              </div>
              <ToggleSwitch
                enabled={settings.pushNotifications}
                onChange={(enabled) => updateSettings({ pushNotifications: enabled })}
              />
            </div>
          </div>
        </div>

        {/* Alert Thresholds */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Alert Thresholds
          </h4>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Choose which severity levels trigger notifications
          </p>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  Critical
                </span>
              </div>
              <ToggleSwitch
                enabled={settings.alertThresholds.critical}
                onChange={(enabled) => 
                  updateNestedSettings('alertThresholds', { critical: enabled })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  High
                </span>
              </div>
              <ToggleSwitch
                enabled={settings.alertThresholds.high}
                onChange={(enabled) => 
                  updateNestedSettings('alertThresholds', { high: enabled })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  Medium
                </span>
              </div>
              <ToggleSwitch
                enabled={settings.alertThresholds.medium}
                onChange={(enabled) => 
                  updateNestedSettings('alertThresholds', { medium: enabled })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  Low
                </span>
              </div>
              <ToggleSwitch
                enabled={settings.alertThresholds.low}
                onChange={(enabled) => 
                  updateNestedSettings('alertThresholds', { low: enabled })
                }
              />
            </div>
          </div>
        </div>

        {/* Notification Channels */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Notification Channels
          </h4>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-900 dark:text-white">
                  Slack Integration
                </label>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Send notifications to Slack channels
                </p>
              </div>
              <ToggleSwitch
                enabled={settings.channels.slack}
                onChange={(enabled) => 
                  updateNestedSettings('channels', { slack: enabled })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-900 dark:text-white">
                  Microsoft Teams
                </label>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Send notifications to Teams channels
                </p>
              </div>
              <ToggleSwitch
                enabled={settings.channels.teams}
                onChange={(enabled) => 
                  updateNestedSettings('channels', { teams: enabled })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-900 dark:text-white">
                  Webhook
                </label>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Send notifications to custom webhook endpoints
                </p>
              </div>
              <ToggleSwitch
                enabled={settings.channels.webhook}
                onChange={(enabled) => 
                  updateNestedSettings('channels', { webhook: enabled })
                }
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={() => {
              // Here you would typically save to backend
              console.log('Saving notification settings:', settings);
            }}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

// Toggle Switch Component
interface ToggleSwitchProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}

function ToggleSwitch({ enabled, onChange }: ToggleSwitchProps) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={clsx(
        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
        enabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
      )}
    >
      <span
        className={clsx(
          'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
          enabled ? 'translate-x-6' : 'translate-x-1'
        )}
      />
    </button>
  );
}