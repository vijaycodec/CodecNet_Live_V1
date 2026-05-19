'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  EnvelopeIcon,
  PlusIcon,
  TrashIcon,
  CheckCircleIcon,
  XCircleIcon,
  PaperAirplaneIcon,
  BellIcon,
  BellSlashIcon,
} from '@heroicons/react/24/outline';
import api from '@/lib/api';

interface Organisation {
  _id: string;
  organisation_name: string;
  client_name?: string;
  emails?: string[];
  cc_emails?: string[];
  alert_email_notifications_enabled?: boolean;
}

interface CcSettings {
  organisation_name: string;
  emails: string[];
  cc_emails: string[];
  alert_email_notifications_enabled: boolean;
  default_cc: string;
  sender_email: string;
}

const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

const Banner: React.FC<{ kind: 'success' | 'error'; text: string; onClose: () => void }> = ({ kind, text, onClose }) => (
  <div
    className={`flex items-start gap-3 px-4 py-3 rounded-lg border text-sm ${
      kind === 'success'
        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700/50 text-green-800 dark:text-green-300'
        : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700/50 text-red-800 dark:text-red-300'
    }`}
  >
    {kind === 'success' ? (
      <CheckCircleIcon className="h-5 w-5 mt-0.5 flex-shrink-0" />
    ) : (
      <XCircleIcon className="h-5 w-5 mt-0.5 flex-shrink-0" />
    )}
    <p className="flex-1">{text}</p>
    <button onClick={onClose} className="text-xs opacity-70 hover:opacity-100">✕</button>
  </div>
);

const Pill: React.FC<{ children: React.ReactNode; onRemove?: () => void; tone?: 'default' | 'locked' }> = ({
  children,
  onRemove,
  tone = 'default',
}) => (
  <span
    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
      tone === 'locked'
        ? 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-dashed border-gray-300 dark:border-gray-700'
        : 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700/40'
    }`}
  >
    {children}
    {onRemove && (
      <button
        type="button"
        onClick={onRemove}
        className="text-blue-500 hover:text-red-500 dark:text-blue-300 dark:hover:text-red-400"
        title="Remove"
      >
        <TrashIcon className="h-3.5 w-3.5" />
      </button>
    )}
  </span>
);

export default function CcManagementView() {
  const [orgs, setOrgs] = useState<Organisation[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [settings, setSettings] = useState<CcSettings | null>(null);
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [newCcEmail, setNewCcEmail] = useState('');
  const [banner, setBanner] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const [ccEmails, setCcEmails] = useState<string[]>([]);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  useEffect(() => {
    const fetchOrgs = async () => {
      try {
        setLoadingOrgs(true);
        const resp = await api.organisations.getOrganisations();
        const list: Organisation[] = (resp?.data || []).filter(
          (o: any) => o && !o.is_deleted
        );
        setOrgs(list);
        if (list.length > 0) {
          setSelectedOrgId(list[0]._id);
        }
      } catch (err: any) {
        setBanner({ kind: 'error', text: `Failed to load organisations: ${err.message}` });
      } finally {
        setLoadingOrgs(false);
      }
    };
    fetchOrgs();
  }, []);

  useEffect(() => {
    if (!selectedOrgId) return;
    const fetchSettings = async () => {
      try {
        setLoadingSettings(true);
        const resp = await api.alertNotifications.getOrgCc(selectedOrgId);
        const data: CcSettings = resp?.data || {
          organisation_name: '',
          emails: [],
          cc_emails: [],
          alert_email_notifications_enabled: true,
          default_cc: '',
          sender_email: '',
        };
        setSettings(data);
        setCcEmails(data.cc_emails || []);
        setNotificationsEnabled(data.alert_email_notifications_enabled !== false);
      } catch (err: any) {
        setBanner({ kind: 'error', text: `Failed to load settings: ${err.message}` });
      } finally {
        setLoadingSettings(false);
      }
    };
    fetchSettings();
  }, [selectedOrgId]);

  const hasChanges = useMemo(() => {
    if (!settings) return false;
    const sameLen = ccEmails.length === (settings.cc_emails || []).length;
    const sameItems =
      sameLen &&
      ccEmails.every((e) => (settings.cc_emails || []).includes(e));
    const sameToggle = notificationsEnabled === settings.alert_email_notifications_enabled;
    return !sameItems || !sameToggle;
  }, [ccEmails, notificationsEnabled, settings]);

  const handleAddCc = () => {
    const trimmed = newCcEmail.trim().toLowerCase();
    if (!trimmed) return;
    if (!EMAIL_REGEX.test(trimmed)) {
      setBanner({ kind: 'error', text: `"${trimmed}" is not a valid email address.` });
      return;
    }
    if (ccEmails.includes(trimmed)) {
      setBanner({ kind: 'error', text: 'This CC is already on the list.' });
      return;
    }
    if (settings?.default_cc && trimmed === settings.default_cc.toLowerCase()) {
      setBanner({ kind: 'error', text: `${settings.default_cc} is the system default CC and is always included automatically.` });
      return;
    }
    setCcEmails((prev) => [...prev, trimmed]);
    setNewCcEmail('');
    setBanner(null);
  };

  const handleRemoveCc = (email: string) => {
    setCcEmails((prev) => prev.filter((e) => e !== email));
  };

  const handleSave = async () => {
    if (!selectedOrgId) return;
    try {
      setSaving(true);
      setBanner(null);
      await api.alertNotifications.updateOrgCc(selectedOrgId, {
        cc_emails: ccEmails,
        alert_email_notifications_enabled: notificationsEnabled,
      });
      setBanner({ kind: 'success', text: 'Alert notification settings saved.' });
      const resp = await api.alertNotifications.getOrgCc(selectedOrgId);
      setSettings(resp?.data || null);
    } catch (err: any) {
      setBanner({ kind: 'error', text: `Save failed: ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  const handleSendTest = async () => {
    if (!selectedOrgId) return;
    try {
      setSendingTest(true);
      setBanner(null);
      const resp = await api.alertNotifications.sendTest({ organisationId: selectedOrgId });
      if (resp?.statusCode === 200 && resp?.data?.logId) {
        setBanner({ kind: 'success', text: 'Test critical-alert email sent. Check the recipient inboxes and the Email Logs page.' });
      } else {
        setBanner({ kind: 'success', text: resp?.message || 'Test email request processed.' });
      }
    } catch (err: any) {
      setBanner({ kind: 'error', text: `Test send failed: ${err.message}` });
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Manage TO recipients (Contact Information) and dynamic CC list per organisation. Critical alerts
        (Wazuh <code className="text-xs">rule.level &gt;= 12</code>) email automatically; this page only manages who receives them.
      </p>

      {banner && <Banner kind={banner.kind} text={banner.text} onClose={() => setBanner(null)} />}

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="flex-1">
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">
              Organisation
            </label>
            <select
              className="w-full px-3 py-2 rounded-md bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={selectedOrgId}
              onChange={(e) => setSelectedOrgId(e.target.value)}
              disabled={loadingOrgs}
            >
              {loadingOrgs && <option>Loading…</option>}
              {!loadingOrgs && orgs.length === 0 && <option>No organisations found</option>}
              {orgs.map((o) => (
                <option key={o._id} value={o._id}>
                  {o.organisation_name} {o.client_name ? `— ${o.client_name}` : ''}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={handleSendTest}
            disabled={!selectedOrgId || sendingTest}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 dark:disabled:bg-amber-900/40 text-white text-sm font-medium"
          >
            <PaperAirplaneIcon className="h-4 w-4" />
            {sendingTest ? 'Sending…' : 'Send test email'}
          </button>
        </div>
      </div>

      {loadingSettings && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading settings…</div>
      )}

      {!loadingSettings && settings && (
        <>
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
              System (read-only)
            </h2>
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Sender (FROM)</div>
                <div className="font-mono text-gray-800 dark:text-gray-200">{settings.sender_email || '—'}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Default CC (always included)</div>
                <div className="font-mono text-gray-800 dark:text-gray-200">{settings.default_cc || '—'}</div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
              TO Recipients (Contact Information)
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Pulled from the organisation's Contact Information. Edit on the organisation page to change.
            </p>
            <div className="flex flex-wrap gap-2 min-h-[2rem]">
              {(settings.emails || []).length === 0 && (
                <span className="text-sm text-gray-400 italic">No TO recipients configured</span>
              )}
              {(settings.emails || []).map((email) => (
                <Pill key={email} tone="locked">{email}</Pill>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  CC Recipients
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {settings.default_cc ? (
                    <>Add unlimited stakeholders. The system default <span className="font-mono">{settings.default_cc}</span> is always included automatically.</>
                  ) : (
                    <>Add unlimited stakeholders. No system-wide default CC is configured.</>
                  )}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 min-h-[2rem]">
              {ccEmails.length === 0 && (
                <span className="text-sm text-gray-400 italic">No additional CCs configured</span>
              )}
              {ccEmails.map((email) => (
                <Pill key={email} onRemove={() => handleRemoveCc(email)}>{email}</Pill>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                value={newCcEmail}
                onChange={(e) => setNewCcEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCc();
                  }
                }}
                placeholder="add-another@example.com"
                className="flex-1 px-3 py-2 rounded-md bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleAddCc}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
              >
                <PlusIcon className="h-4 w-4" /> Add CC
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Notifications
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Master switch for this organisation. When off, no critical-alert emails are sent.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setNotificationsEnabled((v) => !v)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium border ${
                  notificationsEnabled
                    ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700/40'
                    : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700/40'
                }`}
              >
                {notificationsEnabled ? (
                  <>
                    <BellIcon className="h-4 w-4" /> Enabled
                  </>
                ) : (
                  <>
                    <BellSlashIcon className="h-4 w-4" /> Disabled
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                if (settings) {
                  setCcEmails(settings.cc_emails || []);
                  setNotificationsEnabled(settings.alert_email_notifications_enabled !== false);
                }
              }}
              disabled={!hasChanges || saving}
              className="px-4 py-2 rounded-md text-sm font-medium border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
            >
              Revert
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!hasChanges || saving}
              className="px-4 py-2 rounded-md text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white disabled:bg-blue-300 dark:disabled:bg-blue-900/40"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
