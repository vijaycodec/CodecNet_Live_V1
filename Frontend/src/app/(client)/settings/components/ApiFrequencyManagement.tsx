'use client';

import { useState } from 'react';
import {
  ClockIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { clsx } from 'clsx';
import { ApiEndpoint } from '../types';

interface ApiFrequencyManagementProps {
  apiEndpoints: ApiEndpoint[];
  onEndpointsChange: (endpoints: ApiEndpoint[]) => void;
}

export default function ApiFrequencyManagement({ 
  apiEndpoints, 
  onEndpointsChange 
}: ApiFrequencyManagementProps) {
  const [showAddEndpointModal, setShowAddEndpointModal] = useState(false);

  const toggleEndpoint = (id: number) => {
    const updatedEndpoints = apiEndpoints.map(endpoint =>
      endpoint.id === id
        ? { ...endpoint, enabled: !endpoint.enabled }
        : endpoint
    );
    onEndpointsChange(updatedEndpoints);
  };

  const removeEndpoint = (id: number) => {
    const updatedEndpoints = apiEndpoints.filter(endpoint => endpoint.id !== id);
    onEndpointsChange(updatedEndpoints);
  };

  const addEndpoint = (newEndpoint: Omit<ApiEndpoint, 'id' | 'enabled' | 'lastCall' | 'nextCall' | 'responseTime' | 'status'>) => {
    const endpoint: ApiEndpoint = {
      id: Math.max(...apiEndpoints.map(e => e.id), 0) + 1,
      ...newEndpoint,
      enabled: true,
      lastCall: 'Never',
      nextCall: `in ${newEndpoint.frequency} minutes`,
      responseTime: 0,
      status: 'warning'
    };
    onEndpointsChange([...apiEndpoints, endpoint]);
    setShowAddEndpointModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
            API Frequency Management
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Configure how often external APIs are called for data updates
          </p>
        </div>
        <button
          onClick={() => setShowAddEndpointModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          <PlusIcon className="h-4 w-4" />
          Add Endpoint
        </button>
      </div>

      {/* Endpoints List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Endpoint
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Method
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Frequency
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Last Call
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Next Call
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {apiEndpoints.map((endpoint) => (
                <tr key={endpoint.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4">
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {endpoint.name}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">
                        {endpoint.url}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={clsx(
                      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                      endpoint.method === 'GET' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                      endpoint.method === 'POST' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                      endpoint.method === 'PUT' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                      'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                    )}>
                      {endpoint.method}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    <div className="flex items-center gap-1">
                      <ClockIcon className="h-4 w-4 text-gray-400" />
                      {endpoint.frequency}m
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className={clsx(
                        'h-2 w-2 rounded-full',
                        endpoint.enabled ? (
                          endpoint.status === 'active' ? 'bg-green-400' :
                          endpoint.status === 'warning' ? 'bg-yellow-400' :
                          'bg-red-400'
                        ) : 'bg-gray-400'
                      )} />
                      <span className="text-sm text-gray-900 dark:text-white capitalize">
                        {endpoint.enabled ? endpoint.status : 'disabled'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {endpoint.lastCall}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {endpoint.nextCall}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => toggleEndpoint(endpoint.id)}
                        className={clsx(
                          'px-3 py-1 rounded-md text-sm font-medium transition-colors',
                          endpoint.enabled
                            ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900 dark:text-red-200'
                            : 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900 dark:text-green-200'
                        )}
                      >
                        {endpoint.enabled ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        onClick={() => removeEndpoint(endpoint.id)}
                        className="p-1 text-red-600 hover:text-red-900 dark:text-red-400"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Endpoint Modal */}
      <AddEndpointModal
        isOpen={showAddEndpointModal}
        onClose={() => setShowAddEndpointModal(false)}
        onAdd={addEndpoint}
      />
    </div>
  );
}

interface AddEndpointModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (endpoint: Omit<ApiEndpoint, 'id' | 'enabled' | 'lastCall' | 'nextCall' | 'responseTime' | 'status'>) => void;
}

function AddEndpointModal({ isOpen, onClose, onAdd }: AddEndpointModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    method: 'GET' as ApiEndpoint['method'],
    frequency: 15
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd(formData);
    setFormData({ name: '', url: '', method: 'GET', frequency: 15 });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Add API Endpoint</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Endpoint Name
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., Threat Intelligence Feed"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              API URL
            </label>
            <input
              type="url"
              required
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="https://api.example.com/endpoint"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              HTTP Method
            </label>
            <select
              value={formData.method}
              onChange={(e) => setFormData({ ...formData, method: e.target.value as ApiEndpoint['method'] })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="DELETE">DELETE</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Call Frequency (minutes)
            </label>
            <input
              type="number"
              min="1"
              max="1440"
              required
              value={formData.frequency}
              onChange={(e) => setFormData({ ...formData, frequency: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Add Endpoint
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}