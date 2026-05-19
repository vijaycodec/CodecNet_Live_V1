'use client';

import React, { useEffect, useState } from 'react';
import {
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  EyeIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import api from '@/lib/api';

interface Organisation {
  _id: string;
  organisation_name: string;
}

interface EmailLog {
  _id: string;
  organisation_id?: string | null;
  email_type: 'critical_alert' | 'manual_test' | 'other';
  from: string;
  to: string[];
  cc: string[];
  subject: string;
  alert_id?: string | null;
  alert_title?: string | null;
  alert_severity?: number | null;
  alert_source?: string | null;
  alert_time?: string | null;
  alert_description?: string | null;
  status: 'queued' | 'sent' | 'failed';
  smtp_message_id?: string | null;
  smtp_response?: string | null;
  error_message?: string | null;
  attempts: number;
  sent_at?: string | null;
  createdAt: string;
  updatedAt: string;
}

const statusBadge = (status: EmailLog['status']) => {
  const base = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium';
  switch (status) {
    case 'sent':
      return (
        <span className={`${base} bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300`}>
          <CheckCircleIcon className="h-3.5 w-3.5" /> Sent
        </span>
      );
    case 'failed':
      return (
        <span className={`${base} bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300`}>
          <XCircleIcon className="h-3.5 w-3.5" /> Failed
        </span>
      );
    default:
      return (
        <span className={`${base} bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300`}>
          <ClockIcon className="h-3.5 w-3.5" /> Queued
        </span>
      );
  }
};

const formatDate = (s?: string | null) => {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleString();
  } catch {
    return s;
  }
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="text-sm">
    <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</div>
    <div className="text-gray-800 dark:text-gray-200 mt-0.5">{children}</div>
  </div>
);

export default function EmailLogsView() {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [orgs, setOrgs] = useState<Organisation[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [filterStatus, setFilterStatus] = useState<'' | 'sent' | 'failed' | 'queued'>('');
  const [filterOrg, setFilterOrg] = useState('');
  const [filterAlertId, setFilterAlertId] = useState('');
  const [selectedLog, setSelectedLog] = useState<EmailLog | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrgs = async () => {
      try {
        const resp = await api.organisations.getOrganisations();
        const list: Organisation[] = (resp?.data || []).filter((o: any) => o && !o.is_deleted);
        setOrgs(list);
      } catch {
        // Non-fatal - filter just won't be populated
      }
    };
    fetchOrgs();
  }, []);

  const fetchLogs = async (pageOverride?: number) => {
    try {
      setLoading(true);
      setError(null);
      const p = pageOverride ?? page;
      const resp = await api.alertNotifications.getLogs({
        page: p,
        limit,
        status: filterStatus || undefined,
        organisationId: filterOrg || undefined,
        alert_id: filterAlertId || undefined,
      });
      const data = resp?.data || {};
      setLogs(data.logs || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
      setPage(data.page || 1);
    } catch (err: any) {
      setError(err.message || 'Failed to load logs');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus, filterOrg, filterAlertId]);

  useEffect(() => {
    fetchLogs(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClearFilters = () => {
    setFilterStatus('');
    setFilterOrg('');
    setFilterAlertId('');
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Audit trail of every critical-alert email triggered by the system. Showing newest first.
        </p>
        <button
          type="button"
          onClick={() => fetchLogs(page)}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:bg-blue-300"
        >
          <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
        <div className="grid sm:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
              Status
            </label>
            <select
              className="w-full px-3 py-2 rounded-md bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-200"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
            >
              <option value="">All</option>
              <option value="sent">Sent</option>
              <option value="failed">Failed</option>
              <option value="queued">Queued</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
              Organisation
            </label>
            <select
              className="w-full px-3 py-2 rounded-md bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-200"
              value={filterOrg}
              onChange={(e) => setFilterOrg(e.target.value)}
            >
              <option value="">All</option>
              {orgs.map((o) => (
                <option key={o._id} value={o._id}>
                  {o.organisation_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
              Alert ID
            </label>
            <input
              type="text"
              placeholder="exact alert_id"
              value={filterAlertId}
              onChange={(e) => setFilterAlertId(e.target.value)}
              className="w-full px-3 py-2 rounded-md bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-200"
            />
          </div>
          <div>
            <button
              type="button"
              onClick={handleClearFilters}
              className="w-full px-3 py-2 rounded-md text-sm border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Clear filters
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-lg border bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700/50 text-red-800 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800 text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Subject</th>
              <th className="px-4 py-3 text-left">To / CC</th>
              <th className="px-4 py-3 text-left">Severity</th>
              <th className="px-4 py-3 text-left">Source</th>
              <th className="px-4 py-3 text-left">Time</th>
              <th className="px-4 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800 text-gray-800 dark:text-gray-200">
            {loading && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && logs.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                  No email logs match your filters.
                </td>
              </tr>
            )}
            {!loading &&
              logs.map((log) => (
                <tr key={log._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <td className="px-4 py-3 align-top">{statusBadge(log.status)}</td>
                  <td className="px-4 py-3 align-top max-w-xs">
                    <div className="font-medium truncate" title={log.subject}>
                      {log.subject}
                    </div>
                    {log.alert_id && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate" title={log.alert_id}>
                        {log.alert_id}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="text-xs text-gray-500 dark:text-gray-400">TO</div>
                    <div className="truncate max-w-[16rem]" title={(log.to || []).join(', ')}>
                      {(log.to || []).join(', ') || '—'}
                    </div>
                    {log.cc && log.cc.length > 0 && (
                      <>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">CC</div>
                        <div className="truncate max-w-[16rem]" title={log.cc.join(', ')}>
                          {log.cc.join(', ')}
                        </div>
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top">
                    {log.alert_severity ?? '—'}
                  </td>
                  <td className="px-4 py-3 align-top truncate max-w-[12rem]" title={log.alert_source || ''}>
                    {log.alert_source || '—'}
                  </td>
                  <td className="px-4 py-3 align-top whitespace-nowrap text-xs">
                    {formatDate(log.sent_at || log.createdAt)}
                  </td>
                  <td className="px-4 py-3 align-top text-center">
                    <button
                      type="button"
                      onClick={() => setSelectedLog(log)}
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-800"
                      title="View details"
                    >
                      <EyeIcon className="h-5 w-5 mx-auto" />
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm text-gray-600 dark:text-gray-400">
        <div>
          Showing page <span className="font-semibold">{page}</span> of{' '}
          <span className="font-semibold">{pages}</span> · {total} total
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => fetchLogs(page - 1)}
            className="px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-700 disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={page >= pages || loading}
            onClick={() => fetchLogs(page + 1)}
            className="px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-700 disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Next
          </button>
        </div>
      </div>

      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-2xl shadow-2xl border border-gray-200 dark:border-gray-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Email Log Details</h3>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-sm">
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Status">{statusBadge(selectedLog.status)}</Field>
                <Field label="Email type">{selectedLog.email_type}</Field>
                <Field label="From">{selectedLog.from}</Field>
                <Field label="Attempts">{selectedLog.attempts}</Field>
                <Field label="Sent at">{formatDate(selectedLog.sent_at)}</Field>
                <Field label="Created at">{formatDate(selectedLog.createdAt)}</Field>
              </div>

              <Field label="Subject"><span className="break-all">{selectedLog.subject}</span></Field>
              <Field label="To">{(selectedLog.to || []).join(', ') || '—'}</Field>
              <Field label="CC">{(selectedLog.cc || []).join(', ') || '—'}</Field>

              <div className="pt-2 border-t border-gray-200 dark:border-gray-800">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
                  Alert Metadata
                </h4>
                <div className="grid sm:grid-cols-2 gap-3">
                  <Field label="Alert ID">
                    <span className="break-all">{selectedLog.alert_id || '—'}</span>
                  </Field>
                  <Field label="Severity">{selectedLog.alert_severity ?? '—'}</Field>
                  <Field label="Source">{selectedLog.alert_source || '—'}</Field>
                  <Field label="Time">{formatDate(selectedLog.alert_time)}</Field>
                </div>
                <Field label="Title">{selectedLog.alert_title || '—'}</Field>
                <Field label="Description">
                  <span className="whitespace-pre-wrap">{selectedLog.alert_description || '—'}</span>
                </Field>
              </div>

              <div className="pt-2 border-t border-gray-200 dark:border-gray-800">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
                  SMTP
                </h4>
                <Field label="Message ID">
                  <span className="font-mono text-xs break-all">{selectedLog.smtp_message_id || '—'}</span>
                </Field>
                <Field label="Response">
                  <span className="font-mono text-xs break-all">{selectedLog.smtp_response || '—'}</span>
                </Field>
                {selectedLog.error_message && (
                  <Field label="Error">
                    <span className="text-red-700 dark:text-red-300 whitespace-pre-wrap">
                      {selectedLog.error_message}
                    </span>
                  </Field>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
