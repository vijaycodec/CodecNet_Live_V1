'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useClient } from '@/contexts/ClientContext'
import { usePermissions } from '@/hooks/usePermissions'
import Cookies from 'js-cookie';
import { wazuhApi } from '@/lib/api';
const BASE_URL = process.env.NEXT_PUBLIC_RBAC_BASE_IP
import {
  ArrowDownTrayIcon,
  ComputerDesktopIcon,
  ArrowPathIcon,
  ServerIcon,
  GlobeAltIcon,
  CpuChipIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ShieldExclamationIcon,
  XMarkIcon,
  InformationCircleIcon,
  ChartBarIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  MinusIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ArrowTopRightOnSquareIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon
} from '@heroicons/react/24/outline'
import { clsx } from 'clsx'

interface Agent {
  id: string
  name: string
  ipAddress: string
  operatingSystem: string
  status: 'active' | 'inactive' | 'warning' | 'quarantined'
  last_keepalive: string
  version: string
  nodename: string
  pass?: number
  fail?: number
  invalid?: number
  score?: number
  cis_checks?: BenchmarkCheck[]
  cis_benchmark_name?: string
  cis_scan_date?: string
  vulnerabilities?: {
    name: string
    id: string
    severity: string
    description?: string
    reference?: string
    cvss?: {
      cvss2?: string
      cvss3?: string
    }
    published?: string
    updated?: string
  }[]
}

interface BenchmarkCheck {
  id: string
  title: string
  target?: string
  command?: string
  result: 'Passed' | 'Failed' | 'Not applicable' | string
  description?: string
  category?: string
  severity?: 'critical' | 'major' | 'minor'
  rationale?: string
  remediation?: string
  compliance?: string[] | Record<string, any>
  condition?: string
  rules?: Array<{
    type?: string
    command?: string
    pattern?: string
    comparison?: string
    [key: string]: any
  }>
}

// CIS Benchmark data for agents
const cisBenchmarkData: BenchmarkCheck[] = []

const mockAgents: Agent[] = []

const getStatusColor = (status: string) => {
  switch (status) {
    case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
    case 'disconnected': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
    case 'warning': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
    case 'quarantined': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400'
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
  }
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'active': return <CheckCircleIcon className="w-5 h-5 text-green-500" />
    case 'disconnected': return <XCircleIcon className="w-5 h-5 text-red-500" />
    case 'warning': return <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500" />
    case 'quarantined': return <ShieldExclamationIcon className="w-5 h-5 text-orange-500" />
    default: return <XCircleIcon className="w-5 h-5 text-gray-500" />
  }
}

const getOSIcon = (os: string) => {
  if (os.toLowerCase().includes('linux') || os.toLowerCase().includes('ubuntu') || os.toLowerCase().includes('centos') || os.toLowerCase().includes('kali') || os.toLowerCase().includes('red hat')) {
    return <ServerIcon className="w-5 h-5 text-blue-500" />
  } else if (os.toLowerCase().includes('windows')) {
    return <ComputerDesktopIcon className="w-5 h-5 text-blue-600" />
  } else if (os.toLowerCase().includes('macos')) {
    return <ComputerDesktopIcon className="w-5 h-5 text-gray-600" />
  }
  return <CpuChipIcon className="w-5 h-5 text-gray-500" />
}

const getResultIcon = (result: string) => {
  switch (result) {
    case 'passed':
      return <CheckCircleIcon className="w-4 h-4 text-green-500" />
    case 'failed':
      return <XCircleIcon className="w-4 h-4 text-red-500" />
    case 'not applicable':
      return <ExclamationTriangleIcon className="w-4 h-4 text-gray-500" />
    default:
      return <InformationCircleIcon className="w-4 h-4 text-gray-500" />
  }
}

const getResultColor = (result: string) => {
  switch (result) {
    case 'passed':
      return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
    case 'failed':
      return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
    case 'not applicable':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
  }
}

export default function AgentsPage() {
  const { hasPermission } = usePermissions()
  const [agents, setAgents] = useState<Agent[]>(mockAgents)
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const [showAgentModal, setShowAgentModal] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const { selectedClient, isClientMode } = useClient()
  const [activeTab, setActiveTab] = useState<'dashboard' | 'cis' | 'vulnerabilities'>('dashboard')
  const [cisSearchTerm, setCisSearchTerm] = useState('')
  const [showQuarantineModal, setShowQuarantineModal] = useState(false)
  const [showUnquarantineModal, setShowUnquarantineModal] = useState(false)
  const [agentToQuarantine, setAgentToQuarantine] = useState<Agent | null>(null)
  const [agentToUnquarantine, setAgentToUnquarantine] = useState<Agent | null>(null)
  const [adminPassword, setAdminPassword] = useState('')
  const [quarantineLoading, setQuarantineLoading] = useState(false)
  const [quarantineError, setQuarantineError] = useState('')
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [isClient, setIsClient] = useState(false);
  const [quarantineStates, setQuarantineStates] = useState<Record<string, string>>({});
  const [whitelistIPs, setWhitelistIPs] = useState<string[]>([]);
  const [expandedVulnerability, setExpandedVulnerability] = useState<string | null>(null);
  const [expandedCisCheck, setExpandedCisCheck] = useState<string | null>(null);
  const [cisCurrentPage, setCisCurrentPage] = useState(1);
  const [vulnCurrentPage, setVulnCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Check if user has quarantine permissions
  const canQuarantineAgents = hasPermission('agents', 'quarantine') || hasPermission('agents', 'manage');

  const toggleAgentStatus = (agentId: string) => {
    setAgents(agents.map(agent =>
      agent.id === agentId ? {
        ...agent,
        status: agent.status === 'active' ? 'inactive' : 'active'
      } : agent
    ))
  }

  const deleteAgent = (agentId: string) => {
    setAgents(agents.filter(agent => agent.id !== agentId))
  }

  const openQuarantineModal = (agent: Agent) => {
    if (agent.status !== 'active' && agent.status !== 'warning') {
      return; // Only allow quarantine for active/warning agents
    }
    setAgentToQuarantine(agent)
    setShowQuarantineModal(true)
    setAdminPassword('')
    setQuarantineError('')
    setWhitelistIPs([]) // Reset to no IP fields
  }

  const openUnquarantineModal = (agent: Agent) => {
    if (agent.status !== 'quarantined') {
      return; // Only allow unquarantine for quarantined agents
    }
    setAgentToUnquarantine(agent)
    setShowUnquarantineModal(true)
    setAdminPassword('')
    setQuarantineError('')
  }

  const confirmQuarantine = async () => {
    if (!agentToQuarantine || !adminPassword) {
      setQuarantineError('Password is required')
      return
    }

    setQuarantineLoading(true)
    setQuarantineError('')

    try {
      const token = Cookies.get('auth_token');
      const response = await fetch(`${BASE_URL}/wazuh/agent/quarantine`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          agentId: agentToQuarantine.id,
          action: 'isolate',
          password: adminPassword,
          agentOS: agentToQuarantine.operatingSystem,
          whitelistIPs: getValidWhitelistIPs()
        })
      })

      const data = await response.json()

      if (response.ok) {
        // Update local state
        setAgents(agents.map(agent =>
          agent.id === agentToQuarantine.id ? {
            ...agent,
            status: 'quarantined' as any
          } : agent
        ))
        setQuarantineStates(prev => ({ ...prev, [agentToQuarantine.id]: 'quarantined' }))
        setShowQuarantineModal(false)
        setAgentToQuarantine(null)
        setAdminPassword('')
      } else {
        // Handle both direct error and ApiResponse format
        setQuarantineError(data.message || data.error || 'Quarantine failed')
      }
    } catch (error) {
      setQuarantineError('Network error occurred')
    } finally {
      setQuarantineLoading(false)
    }
  }

  const confirmUnquarantine = async () => {
    if (!agentToUnquarantine || !adminPassword) {
      setQuarantineError('Password is required')
      return
    }

    setQuarantineLoading(true)
    setQuarantineError('')

    try {
      const token = Cookies.get('auth_token');
      const response = await fetch(`${BASE_URL}/wazuh/agent/quarantine`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          agentId: agentToUnquarantine.id,
          action: 'release',
          password: adminPassword,
          agentOS: agentToUnquarantine.operatingSystem
        })
      })

      const data = await response.json()

      if (response.ok) {
        // Update local state
        setAgents(agents.map(agent =>
          agent.id === agentToUnquarantine.id ? {
            ...agent,
            status: 'active' as any
          } : agent
        ))
        setQuarantineStates(prev => ({ ...prev, [agentToUnquarantine.id]: 'active' }))
        setShowUnquarantineModal(false)
        setAgentToUnquarantine(null)
        setAdminPassword('')
      } else {
        // Handle both direct error and ApiResponse format
        setQuarantineError(data.message || data.error || 'Unquarantine failed')
      }
    } catch (error) {
      setQuarantineError('Network error occurred')
    } finally {
      setQuarantineLoading(false)
    }
  }

  // Whitelist IP management functions
  const addWhitelistIP = () => {
    setWhitelistIPs([...whitelistIPs, ''])
  }

  const removeWhitelistIP = (index: number) => {
    setWhitelistIPs(whitelistIPs.filter((_, i) => i !== index))
  }

  const updateWhitelistIP = (index: number, value: string) => {
    const updatedIPs = whitelistIPs.map((ip, i) => (i === index ? value : ip))
    setWhitelistIPs(updatedIPs)
  }

  const getValidWhitelistIPs = () => {
    return whitelistIPs.filter(ip => ip.trim() !== '')
  }

  const cancelQuarantine = () => {
    setShowQuarantineModal(false)
    setAgentToQuarantine(null)
    setAdminPassword('')
    setQuarantineError('')
    setWhitelistIPs([])
  }

  const cancelUnquarantine = () => {
    setShowUnquarantineModal(false)
    setAgentToUnquarantine(null)
    setAdminPassword('')
    setQuarantineError('')
  }

  const openAgentModal = (agent: Agent) => {
    setSelectedAgent(agent)
    setShowAgentModal(true)
    setActiveTab('dashboard')
  }

  const closeAgentModal = () => {
    setShowAgentModal(false)
    setSelectedAgent(null)
    setActiveTab('dashboard')
    setCisSearchTerm('')
  }

  // CIS Benchmark calculations
  const cisStats = {
    total: cisBenchmarkData.length,
    passed: cisBenchmarkData.filter(check => check.result === 'Passed').length,
    failed: cisBenchmarkData.filter(check => check.result === 'Failed').length,
    notApplicable: cisBenchmarkData.filter(check => check.result === 'Not applicable').length,
    score: 0
  }
  cisStats.score = Math.round((cisStats.passed / cisStats.total) * 100)

  // NIST calculations
  // const nistStats = {
  //   totalControls: nistRequirements.reduce((sum, req) => sum + req.count, 0),
  //   implementedControls: nistRequirements.filter(req => req.count > 0).reduce((sum, req) => sum + req.count, 0),
  //   families: nistRequirements.length,
  //   compliance: 0
  // }
  // nistStats.compliance = nistStats.totalControls > 0 ? Math.round((nistStats.implementedControls / nistStats.totalControls) * 100) : 0

  // Filter functions
  const filteredCisChecks =
    activeTab === 'cis' && selectedAgent && Array.isArray(selectedAgent.cis_checks)
      ? selectedAgent.cis_checks.filter((check: any) =>
        (check.title?.toLowerCase() || '').includes(cisSearchTerm.toLowerCase()) ||
        (String(check.id) || '').toLowerCase().includes(cisSearchTerm.toLowerCase())
      )
      : []

  // Fetch quarantine states for all agents
  const fetchQuarantineStates = async (agentIds: string[]) => {
    const states: Record<string, string> = {}

    // Skip quarantine state fetching if no BASE_URL, no agent IDs, or no permissions
    if (!BASE_URL || agentIds.length === 0 || !canQuarantineAgents) {
      return states;
    }

    const token = Cookies.get('auth_token')
    if (!token) {
      return states;
    }

    await Promise.all(
      agentIds.map(async (agentId) => {
        try {
          const response = await fetch(`${BASE_URL}/wazuh/agent/${agentId}/quarantine-status`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          })
          if (response.ok) {
            const data = await response.json()
            // Handle both direct status and ApiResponse format
            states[agentId] = data.data?.status || data.status || 'active'
          }
        } catch (error) {
          console.warn(`Failed to fetch quarantine status for agent ${agentId}`)
          // Default to active if fetch fails
          states[agentId] = 'active'
        }
      })
    )
    return states
  }

  // Fetch agents function

  const fetchAgents = async () => {
    setLoading(true);
    setFetchError("");

    try {
      // Use Wazuh API with organization ID for client-specific data
      try {
        // First, try to get orgId from context
        let orgId = selectedClient?.id;

        // If not available from context, check localStorage
        if (!orgId && typeof window !== 'undefined') {
          const savedClient = localStorage.getItem('selectedClient');
          if (savedClient) {
            try {
              const parsedClient = JSON.parse(savedClient);
              orgId = parsedClient.id;
              console.log('📦 Using client from localStorage:', parsedClient);
            } catch (error) {
              console.error('Failed to parse saved client from localStorage:', error);
            }
          }
        }

        console.log('🔍 Agents page - isClientMode:', isClientMode);
        console.log('🔍 Agents page - selectedClient:', selectedClient);
        console.log('🔍 Agents page - orgId being sent:', orgId);

        // REAL-TIME STREAMING: Use fetch with streaming response (SSE alternative)
        console.log('📡 Starting streaming for agent data...');
        const token = Cookies.get('auth_token');

        if (!token) {
          throw new Error('No authentication token found');
        }

        const streamUrl = orgId
          ? `${BASE_URL}/wazuh/agents-stream?orgId=${orgId}`
          : `${BASE_URL}/wazuh/agents-stream`;

        const response = await fetch(streamUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'text/event-stream',
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error(`Stream request failed: ${response.statusText}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error('Response body is not readable');
        }

        // Helper function to convert agents object to array
        const convertAgentsToArray = (agentsObj: Record<string, any>): Agent[] => {
          return Object.entries(agentsObj).map(([id, agentData]) => {
            const agent = agentData as Record<string, any>;
            return {
              id,
              name: agent.name || 'Unknown',
              ipAddress: agent.ip || '',
              operatingSystem: agent.os_name + (agent.os_version ? ' ' + agent.os_version : ''),
              status: agent.status || 'disconnected',
              last_keepalive: agent.last_keepalive || 'Unknown',
              version: agent.os_version || '',
              nodename: agent.nodename || 'N/A',
              pass: agent.pass || 0,
              fail: agent.fail || 0,
              invalid: agent.invalid || 0,
              score: agent.score || 0,
              cis_checks: agent.cis_checks || [],
              cis_benchmark_name: agent.cis_benchmark_name,
              cis_scan_date: agent.cis_scan_date,
              vulnerabilities: agent.vulnerabilities || [],
            };
          });
        };

        // Process SSE stream
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            console.log('✅ Stream completed');
            setLastRefresh(new Date());
            break;
          }

          // Decode chunk and add to buffer
          buffer += decoder.decode(value, { stream: true });

          // Process complete SSE messages (delimited by \n\n)
          const messages = buffer.split('\n\n');
          buffer = messages.pop() || ''; // Keep incomplete message in buffer

          for (const message of messages) {
            if (!message.trim()) continue;

            // Parse SSE format: "data: {...}"
            const dataMatch = message.match(/^data: (.+)$/m);
            if (!dataMatch) continue;

            try {
              const data = JSON.parse(dataMatch[1]);
              console.log('📨 Stream Event:', data.type);

              switch (data.type) {
                case 'basic':
                  // Display basic agents immediately
                  console.log('✅ Received basic agent info');
                  const basicAgents = convertAgentsToArray(data.agents);
                  setAgents(basicAgents);
                  setLoading(false);
                  break;

                case 'sca':
                  // Update with SCA scores
                  console.log('✅ Received SCA data for all agents');
                  const agentsWithSCA = convertAgentsToArray(data.agents);
                  setAgents(agentsWithSCA);
                  break;

                case 'cis':
                  // Update single agent with CIS checks
                  console.log(`✅ Received CIS data for agent ${data.agentId}`);
                  setAgents(prev => prev.map(agent =>
                    agent.id === data.agentId
                      ? {
                          ...agent,
                          cis_checks: data.agent.cis_checks || [],
                          cis_benchmark_name: data.agent.cis_benchmark_name,
                          cis_scan_date: data.agent.cis_scan_date,
                          pass: data.agent.pass || 0,
                          fail: data.agent.fail || 0,
                          invalid: data.agent.invalid || 0,
                        }
                      : agent
                  ));
                  break;

                case 'vulnerabilities':
                  // Update single agent with vulnerabilities
                  console.log(`✅ Received vulnerabilities for agent ${data.agentId}`);
                  setAgents(prev => prev.map(agent =>
                    agent.id === data.agentId
                      ? {
                          ...agent,
                          vulnerabilities: data.agent.vulnerabilities || [],
                        }
                      : agent
                  ));
                  break;

                case 'complete':
                  console.log('✅ Stream completed');
                  setLastRefresh(new Date());
                  break;

                case 'error':
                  console.error('❌ Stream error:', data.error);
                  setFetchError(data.error);
                  setLoading(false);
                  break;
              }
            } catch (parseError) {
              console.error('Failed to parse SSE message:', parseError);
            }
          }
        }

      } catch (error: any) {
        console.error('Error in SSE setup:', error);
        throw error;
      }
    } catch (error: any) {
      console.error('❌ Error in fetchAgents:', error);

      // Extract error message
      let errorMessage = 'Failed to fetch agents';
      if (error?.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }

      setFetchError(errorMessage);
      setLoading(false);
    }
  };

  // FALLBACK: Keep old method commented for reference
  const fetchAgentsOld = async () => {
    setLoading(true);
    setFetchError("");

    try {
      // Use Wazuh API with organization ID for client-specific data
      try {
        // First, try to get orgId from context
        let orgId = selectedClient?.id;

        // If not available from context, check localStorage
        if (!orgId && typeof window !== 'undefined') {
          const savedClient = localStorage.getItem('selectedClient');
          if (savedClient) {
            try {
              const parsedClient = JSON.parse(savedClient);
              orgId = parsedClient.id;
              console.log('📦 Using client from localStorage:', parsedClient);
            } catch (error) {
              console.error('Failed to parse saved client from localStorage:', error);
            }
          }
        }

        console.log('🔍 Agents page - isClientMode:', isClientMode);
        console.log('🔍 Agents page - selectedClient:', selectedClient);
        console.log('🔍 Agents page - orgId being sent:', orgId);

        // PROGRESSIVE LOADING: First fetch basic info (fast)
        console.log('⚡ Step 1: Fetching basic agent info...');
        const basicData = await wazuhApi.getAgentsBasic(orgId);
        const basicAgentsData = basicData.data || basicData;

        let agentsArray: Agent[] = [];
        if (basicAgentsData && typeof basicAgentsData.agents === 'object' && basicAgentsData.agents !== null) {
          agentsArray = Object.entries(basicAgentsData.agents).map(([id, agentObj]) => {
            const agent = agentObj as Record<string, any>;
            return {
              id,
              name: agent.name || 'Unknown',
              ipAddress: agent.ip || '',
              operatingSystem: agent.os_name + (agent.os_version ? ' ' + agent.os_version : ''),
              status: agent.status || 'disconnected',
              last_keepalive: agent.last_keepalive || 'Unknown',
              version: agent.os_version || '',
              nodename: agent.nodename || 'N/A',
              cis_checks: [],
              pass: 0,
              fail: 0,
              invalid: 0,
              score: 0,
              vulnerabilities: [],
            };
          });
        }

        // Display basic agents immediately
        setAgents(agentsArray);
        setLoading(false);
        console.log('✅ Basic agents displayed, now fetching full data in background...');

        // BACKGROUND LOADING: Fetch full data (slow)
        const data = await wazuhApi.getAgentsSummary(orgId);
        const agentsData = data.data || data;

        let fullAgentsArray: Agent[] = [];
        if (agentsData && typeof agentsData.agents === 'object' && agentsData.agents !== null) {
          fullAgentsArray = Object.entries(agentsData.agents).map(([id, agentObj]) => {
            const agent = agentObj as Record<string, any>;
            return {
              id,
              name: agent.name || 'Unknown',
              ipAddress: agent.ip || '',
              operatingSystem: agent.os_name + (agent.os_version ? ' ' + agent.os_version : ''),
              status: agent.status || 'disconnected',
              last_keepalive: agent.last_keepalive || 'Unknown',
              version: agent.os_version || '',
              nodename: agent.nodename || 'N/A',
              cis_checks: agent.cis_checks || [],
              cis_benchmark_name: agent.cis_benchmark_name || agent.benchmark_name || 'CIS Benchmark',
              cis_scan_date: agent.cis_scan_date || agent.scan_date || agent.last_scan_date,
              pass: agent.pass ?? 0,
              fail: agent.fail ?? 0,
              invalid: agent.invalid ?? 0,
              score: agent.score ?? 0,
              vulnerabilities: agent.vulnerabilities,
            };
          });
        } else if (Array.isArray(agentsData)) {
          fullAgentsArray = agentsData;
        } else if (agentsData && Array.isArray(agentsData.agents)) {
          fullAgentsArray = agentsData.agents;
        } else {
          fullAgentsArray = agentsArray; // Keep basic data
        }

        // Fetch quarantine states and update agent statuses
        const agentIds = fullAgentsArray.map(agent => agent.id);
        const quarantineStates = await fetchQuarantineStates(agentIds);
        setQuarantineStates(quarantineStates);

        // Update agent statuses based on quarantine states
        const updatedAgents = fullAgentsArray.map(agent => ({
          ...agent,
          status: quarantineStates[agent.id] === 'quarantined' ? 'quarantined' as any : agent.status
        }));

        // Update with full data
        setAgents(updatedAgents);
        setLastRefresh(new Date());
        console.log('✅ Full agent data loaded with SCA, CIS, and vulnerabilities');
        return;
      } catch (wazuhError) {
        // Wazuh API unavailable, falling back to RBAC API
      }

      // Fallback to RBAC API
      const token = Cookies.get('auth_token');
      if (!token) {
        setFetchError("No auth token found in cookies");
        setLoading(false);
        return;
      }
      

      // Build URL with orgId if client is selected
      let url = `${BASE_URL}/wazuh/agents-summary`;
      if (isClientMode && selectedClient?.id) {
        url += `?orgId=${selectedClient.id}`;
      }

      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error(`Agent fetch failed: ${res.status} ${res.statusText}`);
      const response = await res.json();
      
      // Backend returns: { statusCode, data: { agents: {...} }, message, success }
      const data = response.data || response;

      let agentsArray: Agent[] = [];
      if (data && typeof data.agents === 'object' && data.agents !== null) {
        agentsArray = Object.entries(data.agents).map(([id, agentObj]) => {
          const agent = agentObj as Record<string, any>;
          return {
            id,
            name: agent.name || 'Unknown',
            ipAddress: agent.ip || '',
            operatingSystem: agent.os_name + (agent.os_version ? ' ' + agent.os_version : ''),
            status: agent.status || 'disconnected',
            last_keepalive: agent.last_keepalive || 'Unknown',
            version: agent.os_version || '',
            nodename: agent.nodename || 'N/A',
            cis_checks: agent.cis_checks || [],
            cis_benchmark_name: agent.cis_benchmark_name || agent.benchmark_name || 'CIS Benchmark',
            cis_scan_date: agent.cis_scan_date || agent.scan_date || agent.last_scan_date,
            pass: agent.pass ?? 0,
            fail: agent.fail ?? 0,
            invalid: agent.invalid ?? 0,
            score: agent.score ?? 0,
            vulnerabilities: agent.vulnerabilities,
          };
        });
      } else if (Array.isArray(data)) {
        agentsArray = data;
      } else if (data && Array.isArray(data.agents)) {
        agentsArray = data.agents;
      } else {
        agentsArray = [];
      }
      
      // Fetch quarantine states and update agent statuses for fallback API
      const agentIds = agentsArray.map(agent => agent.id);
      const quarantineStates = await fetchQuarantineStates(agentIds);
      setQuarantineStates(quarantineStates);
      
      // Update agent statuses based on quarantine states  
      const updatedAgents = agentsArray.map(agent => ({
        ...agent,
        status: quarantineStates[agent.id] === 'quarantined' ? 'quarantined' as any : agent.status
      }));
      
      setAgents(updatedAgents);
      setLoading(false);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('❌ Error fetching agents:', err);

      // Parse error message from API response
      let errorMessage = 'Failed to fetch agents';

      if (err && typeof err === 'object') {
        // Check if it's an API error with a response
        if ((err as any).response?.data?.error) {
          errorMessage = (err as any).response.data.error;
        } else if ((err as any).message) {
          errorMessage = (err as any).message;
        }
      } else if (typeof err === 'string') {
        errorMessage = err;
      }

      console.error('📝 Error message set to:', errorMessage);
      setFetchError(errorMessage);
      setLoading(false);
    }
  };

  // Export CIS Checks to CSV
  const handleExportCISChecks = (agent: Agent | null) => {
    if (!agent || !agent.cis_checks || agent.cis_checks.length === 0) {
      alert('No CIS benchmark checks available to export');
      return;
    }

    // CSV Header
    const csvHeaders = [
      'Check ID',
      'Title',
      'Result',
      'Description',
      'Rationale',
      'Remediation'
    ];

    // Helper function to escape CSV fields
    const escapeField = (field: any) => {
      if (!field) return '';
      const stringField = String(field);
      if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
        return `"${stringField.replace(/"/g, '""')}"`;
      }
      return stringField;
    };

    // CSV Rows
    const csvRows = agent.cis_checks.map(check => {
      return [
        escapeField(check.id),
        escapeField(check.title),
        escapeField(check.result),
        escapeField(check.description || ''),
        escapeField(check.rationale || ''),
        escapeField(check.remediation || '')
      ].join(',');
    });

    // Combine headers and rows
    const csvContent = [csvHeaders.join(','), ...csvRows].join('\n');

    // Create Blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    const agentName = agent.name.replace(/[^a-z0-9]/gi, '_');
    const benchmarkName = (agent.cis_benchmark_name || 'CIS_Benchmark').replace(/[^a-z0-9]/gi, '_');
    const timestamp = new Date().toISOString().split('T')[0];

    link.setAttribute('href', url);
    link.setAttribute('download', `${agentName}_${benchmarkName}_${timestamp}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up the URL object
    URL.revokeObjectURL(url);
  };

  // Export Vulnerabilities to CSV
  const handleExportVulnerabilities = (agent: Agent | null) => {
    if (!agent || !agent.vulnerabilities || agent.vulnerabilities.length === 0) {
      alert('No vulnerabilities available to export');
      return;
    }

    // CSV Header
    const csvHeaders = [
      'Vulnerability ID',
      'Package Name',
      'Severity',
      'Description',
      'Reference'
    ];

    // Helper function to escape CSV fields
    const escapeField = (field: any) => {
      if (!field) return '';
      const stringField = String(field);
      if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
        return `"${stringField.replace(/"/g, '""')}"`;
      }
      return stringField;
    };

    // CSV Rows
    const csvRows = agent.vulnerabilities.map(vuln => {
      return [
        escapeField(vuln.id || ''),
        escapeField(vuln.name || ''),
        escapeField(vuln.severity || ''),
        escapeField(vuln.description || ''),
        escapeField(vuln.reference || '')
      ].join(',');
    });

    // Combine headers and rows
    const csvContent = [csvHeaders.join(','), ...csvRows].join('\n');

    // Create Blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    const agentName = agent.name.replace(/[^a-z0-9]/gi, '_');
    const timestamp = new Date().toISOString().split('T')[0];

    link.setAttribute('href', url);
    link.setAttribute('download', `${agentName}_Vulnerabilities_${timestamp}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up the URL object
    URL.revokeObjectURL(url);
  };

  // Call fetchAgents on page load
  useEffect(() => {
    setIsClient(true);
    fetchAgents();
  }, [selectedClient?.id, isClientMode]); // Re-fetch when selected client changes

  // if (loading) return <div>Loading agent data...</div>;
  if (fetchError) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            Agents Overview
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Monitor and manage security agents across your infrastructure
          </p>
        </div>

        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
          <div className="flex items-start">
            <InformationCircleIcon className="w-6 h-6 text-yellow-600 dark:text-yellow-400 mr-3 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-yellow-900 dark:text-yellow-200 mb-2">
                No Client Organization Selected
              </h3>
              <p className="text-yellow-800 dark:text-yellow-300 mb-4">
                {fetchError.includes('organization') || fetchError.includes('credentials')
                  ? 'Please select a client organization from the client overview page to view agents, or ensure at least one organization has Wazuh credentials configured.'
                  : fetchError
                }
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={() => window.location.href = '/overview'}
                  className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-medium transition-colors"
                >
                  Go to Client Overview
                </button>
                <button
                  onClick={fetchAgents}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg font-medium transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            Agents Overview
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Monitor and manage security agents across your infrastructure
          </p>
        </div>
        <button
          onClick={fetchAgents}
          className="inline-flex ml-4 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition"
          disabled={loading}
        >
          <ArrowPathIcon className="w-4 h-4 mr-2" />
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>


        {/* <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
        >
          <PlusIcon className="w-4 h-4 mr-2" />
          Add Agent
        </button> */}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Security Agents ({agents.length})
          </h3>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Last updated: {isClient ? lastRefresh.toLocaleTimeString() : ''}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  IP Address
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Operating System
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Last Keep Alive
                </th>
                {canQuarantineAgents && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {(Array.isArray(agents) ? agents : []).map((agent) => (
                <tr
                  key={agent.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                  onClick={() => openAgentModal(agent)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-blue-600 dark:text-blue-400">{agent.id}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="mr-3">{getOSIcon(agent.operatingSystem)}</div>
                      <div>
                        <div className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
                          {agent.name}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">{agent.nodename}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <GlobeAltIcon className="w-4 h-4 text-gray-400 mr-2" />
                      <span className="text-sm font-mono text-gray-900 dark:text-white">{agent.ipAddress}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">{agent.operatingSystem}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Version {agent.version}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {getStatusIcon(agent.status)}
                      <span className={clsx('ml-2 inline-flex px-2 py-1 text-xs font-semibold rounded-full', getStatusColor(agent.status))}>
                        {agent.status.charAt(0).toUpperCase() + agent.status.slice(1)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {agent.last_keepalive && agent.last_keepalive !== 'Unknown'
                      ? new Date(agent.last_keepalive).toLocaleString()
                      : 'Unknown'}
                  </td>
                  {canQuarantineAgents && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2 items-center">
                        {agent.status !== 'quarantined' ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              openQuarantineModal(agent)
                            }}
                            disabled={agent.status !== 'active' && agent.status !== 'warning'}
                            className={clsx(
                              "inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                              agent.status === 'active' || agent.status === 'warning'
                                ? "text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-orange-50 hover:border-orange-300 hover:text-orange-700 dark:hover:bg-orange-900/20 dark:hover:border-orange-600 dark:hover:text-orange-400"
                                : "text-gray-400 dark:text-gray-600 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 cursor-not-allowed"
                            )}
                          >
                            <ShieldExclamationIcon className="w-4 h-4 mr-1" />
                            Quarantine
                          </button>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              openUnquarantineModal(agent)
                            }}
                            className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-900/30 border border-orange-300 dark:border-orange-600 rounded-md hover:bg-orange-100 hover:text-orange-800 dark:hover:bg-orange-900/40 dark:hover:text-orange-200 transition-colors"
                          >
                            <ShieldExclamationIcon className="w-4 h-4 mr-1" />
                            Unquarantine
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Agent Details Modal */}
      {showAgentModal && selectedAgent && typeof window !== 'undefined' && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 w-full max-w-7xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
            {/* Modal Header - Subtle Gradient */}
            <div className="flex-shrink-0 relative overflow-hidden bg-gradient-to-r from-blue-500/10 to-blue-600/5 dark:from-blue-500/20 dark:to-blue-600/10">
              <div className="flex items-center justify-between p-6 border-b border-gray-200/50 dark:border-gray-700/50">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                    {getOSIcon(selectedAgent.operatingSystem)}
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                      {selectedAgent.name}
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {selectedAgent.operatingSystem} • {selectedAgent.ipAddress}
                    </p>
                  </div>
                </div>
                <button
                  onClick={closeAgentModal}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-2.5 hover:bg-gray-100/80 dark:hover:bg-gray-700/80 rounded-xl transition-all duration-200 hover:scale-105"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="px-6 py-3 bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
              <nav className="flex space-x-1">
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className={clsx(
                    'px-4 py-2.5 rounded-lg font-medium text-sm transition-all duration-200',
                    activeTab === 'dashboard'
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-200'
                  )}
                >
                  Dashboard
                </button>
                <button
                  onClick={() => setActiveTab('cis')}
                  className={clsx(
                    'px-4 py-2.5 rounded-lg font-medium text-sm transition-all duration-200',
                    activeTab === 'cis'
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-200'
                  )}
                >
                  CIS Benchmarks
                </button>
                <button
                  onClick={() => setActiveTab('vulnerabilities')}
                  className={clsx(
                    'px-4 py-2.5 rounded-lg font-medium text-sm transition-all duration-200',
                    activeTab === 'vulnerabilities'
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-200'
                  )}
                >
                  Vulnerability Detection
                </button>
              </nav>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-6 bg-gray-50/30 dark:bg-gray-800/30">
              {activeTab === 'dashboard' && (
                <div className="space-y-6">
                  {/* Agent Overview Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                            <ChartBarIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                          </div>
                        </div>
                        <div className="ml-5">
                          <dl>
                            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                              CIS Compliance
                            </dt>
                            <dd className="text-2xl font-bold text-gray-900 dark:text-white">
                              {selectedAgent.score}%
                            </dd>
                          </dl>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                            <ChartBarIcon className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                          </div>
                        </div>
                        <div className="ml-5">
                          <dl>
                            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                              Total Vulnerability
                            </dt>
                            <dd className="text-2xl font-bold text-gray-900 dark:text-white">
                              {(selectedAgent.vulnerabilities && selectedAgent.vulnerabilities.length) || 0}
                            </dd>
                          </dl>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                            <CheckCircleIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
                          </div>
                        </div>
                        <div className="ml-5">
                          <dl>
                            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                              Agent Status
                            </dt>
                            <dd className="text-2xl font-bold text-gray-900 dark:text-white">
                              {selectedAgent.status.charAt(0).toUpperCase() + selectedAgent.status.slice(1)}
                            </dd>
                          </dl>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Agent Details */}
                  <div className="bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 rounded-xl p-6 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Agent Information</h3>
                    <dl className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Agent ID</dt>
                        <dd className="text-sm font-semibold text-gray-900 dark:text-white mt-1">{selectedAgent.id}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Version</dt>
                        <dd className="text-sm font-semibold text-gray-900 dark:text-white mt-1">{selectedAgent.version}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Node</dt>
                        <dd className="text-sm font-semibold text-gray-900 dark:text-white mt-1">{selectedAgent.nodename}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Last Keep Alive</dt>
                        <dd className="text-sm font-semibold text-gray-900 dark:text-white mt-1">{selectedAgent.last_keepalive && selectedAgent.last_keepalive !== 'Unknown'
                          ? new Date(selectedAgent.last_keepalive).toLocaleString()
                          : 'Unknown'}</dd>
                      </div>
                    </dl>
                  </div>
                </div>
              )}

              {activeTab === 'cis' && (
                <div className="space-y-6">
                  {/* CIS Header */}
                  <div className="bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 rounded-xl p-6 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {selectedAgent.cis_benchmark_name || 'CIS Benchmark'}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          {selectedAgent.cis_scan_date ? `End scan: ${new Date(selectedAgent.cis_scan_date).toLocaleString()}` : 'Scan date not available'}
                        </p>
                      </div>
                      {hasPermission('agents', 'download') && (
                        <button
                          onClick={() => handleExportCISChecks(selectedAgent)}
                          className="inline-flex items-center px-4 py-2.5 text-sm font-medium rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                        >
                          <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
                          Export Report
                        </button>
                      )}
                    </div>
                  </div>

                  {(() => {
                    const checks = selectedAgent.cis_checks || [];
                    const total = checks.length;
                    const passed = selectedAgent.pass ?? 0;
                    const failed = selectedAgent.fail ?? 0;
                    const notApplicable = selectedAgent.invalid ?? 0;

                    // Calculate donut chart data
                    const donutData = [
                      { label: 'Passed', value: passed, color: '#16a34a' },
                      { label: 'Failed', value: failed, color: '#dc2626' },
                      { label: 'Not Applicable', value: notApplicable, color: '#6b7280' },
                    ];
                    const donutTotal = donutData.reduce((sum, d) => sum + d.value, 0) || 1;
                    let offset = 0;

                    return (
                      <>
                        {/* CIS Stats */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                          <div className="text-center p-5 bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                            <div className="text-2xl font-bold text-gray-900 dark:text-white">{total}</div>
                            <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-1">Total Checks</div>
                          </div>
                          <div className="text-center p-5 bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{passed}</div>
                            <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-1">Passed</div>
                          </div>
                          <div className="text-center p-5 bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                            <div className="text-2xl font-bold text-red-600 dark:text-red-400">{failed}</div>
                            <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-1">Failed</div>
                          </div>
                          <div className="text-center p-5 bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{selectedAgent.score ?? 0}%</div>
                            <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-1">Compliance Score</div>
                          </div>
                        </div>

                        {/* Charts Section */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* Left Side - Result Distribution Chart */}
                          <div className="bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 rounded-xl p-6 shadow-sm">
                            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                              Result Distribution
                            </h4>
                            {/* Donut Chart */}
                            <div className="flex items-center justify-center mb-6">
                              <div className="relative w-48 h-48">
                                <svg className="w-48 h-48 transform -rotate-90" viewBox="0 0 100 100">
                                  <circle
                                    cx="50"
                                    cy="50"
                                    r="40"
                                    stroke="currentColor"
                                    strokeWidth="8"
                                    fill="transparent"
                                    className="text-gray-200 dark:text-gray-700"
                                  />
                                  {donutData.map((d, i) => {
                                    const percent = (d.value / donutTotal) * 100;
                                    const dash = (percent / 100) * 251.2;
                                    const circle = (
                                      <circle
                                        key={d.label}
                                        cx="50"
                                        cy="50"
                                        r="40"
                                        stroke={d.color}
                                        strokeWidth="8"
                                        fill="transparent"
                                        strokeDasharray={`${dash} ${251.2 - dash}`}
                                        strokeDashoffset={-offset}
                                        className="transition-all duration-500"
                                      />
                                    );
                                    offset += dash;
                                    return circle;
                                  })}
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="text-center">
                                    <div className="text-2xl font-bold text-gray-900 dark:text-white">{total}</div>
                                    <div className="text-sm text-gray-500 dark:text-gray-400">Checks</div>
                                  </div>
                                </div>
                              </div>
                            </div>
                            {/* Legend */}
                            <div className="space-y-3">
                              {donutData.map(d => (
                                <div key={d.label} className="flex items-center justify-between">
                                  <div className="flex items-center space-x-3">
                                    <div className="w-3 h-3 rounded-full" style={{ background: d.color }}></div>
                                    <span className="text-sm text-gray-700 dark:text-gray-300">{d.label}</span>
                                  </div>
                                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                                    {d.value} ({((d.value / donutTotal) * 100).toFixed(1)}%)
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Right Side - Compliance Score Card */}
                          <div className="bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 rounded-xl p-6 shadow-sm">
                            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                              Compliance Overview
                            </h4>
                            <div className="space-y-6">
                              {/* Score Gauge */}
                              <div className="text-center">
                                <div className="inline-flex items-center justify-center w-32 h-32 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                                  <div className="text-center">
                                    <div className="text-3xl font-bold">{selectedAgent.score ?? 0}%</div>
                                    <div className="text-xs">Score</div>
                                  </div>
                                </div>
                              </div>

                              {/* Progress Bars */}
                              <div className="space-y-4">
                                <div>
                                  <div className="flex justify-between text-sm mb-1">
                                    <span className="text-gray-600 dark:text-gray-400">Pass Rate</span>
                                    <span className="font-semibold text-gray-900 dark:text-white">
                                      {total > 0 ? ((passed / total) * 100).toFixed(1) : 0}%
                                    </span>
                                  </div>
                                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                                    <div
                                      className="bg-green-500 h-3 rounded-full transition-all duration-500"
                                      style={{ width: `${total > 0 ? ((passed / total) * 100).toFixed(2) : 0}%` }}
                                    ></div>
                                  </div>
                                </div>

                                <div>
                                  <div className="flex justify-between text-sm mb-1">
                                    <span className="text-gray-600 dark:text-gray-400">Failure Rate</span>
                                    <span className="font-semibold text-gray-900 dark:text-white">
                                      {total > 0 ? ((failed / total) * 100).toFixed(1) : 0}%
                                    </span>
                                  </div>
                                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                                    <div
                                      className="bg-red-500 h-3 rounded-full transition-all duration-500"
                                      style={{ width: `${total > 0 ? ((failed / total) * 100).toFixed(2) : 0}%` }}
                                    ></div>
                                  </div>
                                </div>
                              </div>

                              {/* Stats Grid */}
                              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                                <div className="text-center">
                                  <div className="text-lg font-bold text-gray-900 dark:text-white">{passed}</div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400">Passed Checks</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-lg font-bold text-gray-900 dark:text-white">{failed}</div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400">Failed Checks</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* CIS Search */}
                        <div className="relative">
                          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                          <input
                            type="text"
                            placeholder="Filter requirements"
                            value={cisSearchTerm}
                            onChange={(e) => {
                              setCisSearchTerm(e.target.value);
                              setCisCurrentPage(1); // Reset to first page on search
                            }}
                            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-white transition-colors"
                          />
                        </div>

                        {/* CIS Checks - Expandable List */}
                        <div className="bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 rounded-xl p-6 shadow-sm">
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                              CIS Benchmark Checks
                            </h4>
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              Showing {Math.min((cisCurrentPage - 1) * itemsPerPage + 1, filteredCisChecks.length)} - {Math.min(cisCurrentPage * itemsPerPage, filteredCisChecks.length)} of {filteredCisChecks.length}
                            </span>
                          </div>
                          <div className="space-y-3">
                            {filteredCisChecks
                              .slice((cisCurrentPage - 1) * itemsPerPage, cisCurrentPage * itemsPerPage)
                              .map((check: any) => {
                              const isExpanded = expandedCisCheck === check.id;
                              return (
                                <div key={check.id} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                                  <div
                                    onClick={() => setExpandedCisCheck(isExpanded ? null : check.id)}
                                    className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                                  >
                                    <div className="flex items-center space-x-4 flex-1">
                                      <div className="flex-shrink-0">
                                        {getResultIcon(check.result)}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs font-mono text-blue-600 dark:text-blue-400">{check.id}</span>
                                          <span className={clsx(
                                            'inline-flex px-2 py-0.5 text-xs font-semibold rounded-full',
                                            getResultColor(check.result)
                                          )}>
                                            {check.result}
                                          </span>
                                        </div>
                                        <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                                          {check.title}
                                        </p>
                                      </div>
                                    </div>
                                    {isExpanded ? (
                                      <ChevronUpIcon className="w-5 h-5 text-gray-400 flex-shrink-0 ml-2" />
                                    ) : (
                                      <ChevronDownIcon className="w-5 h-5 text-gray-400 flex-shrink-0 ml-2" />
                                    )}
                                  </div>

                                  {/* Expanded Details */}
                                  {isExpanded && (
                                    <div className="px-4 pb-4 pt-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
                                      <div className="space-y-4">
                                        {/* Description */}
                                        {check.description && (
                                          <div>
                                            <h5 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2">
                                              Description
                                            </h5>
                                            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-wrap">
                                              {check.description}
                                            </p>
                                          </div>
                                        )}

                                        {/* Rationale */}
                                        {check.rationale && (
                                          <div>
                                            <h5 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2">
                                              Rationale
                                            </h5>
                                            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-wrap">
                                              {check.rationale}
                                            </p>
                                          </div>
                                        )}

                                        {/* Remediation */}
                                        {check.remediation && (
                                          <div>
                                            <h5 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2">
                                              Remediation
                                            </h5>
                                            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-wrap">
                                              {check.remediation}
                                            </p>
                                          </div>
                                        )}

                                        {/* Condition/Check */}
                                        {(check.condition || check.rules) && (
                                          <div>
                                            <h5 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2">
                                              Check (Condition: {check.condition || 'all'})
                                            </h5>
                                            {check.rules && check.rules.length > 0 ? (
                                              <div className="space-y-2">
                                                {check.rules.map((rule: any, ruleIdx: number) => (
                                                  <div key={ruleIdx} className="text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
                                                    <div className="font-mono">
                                                      {rule.type && <span className="text-blue-600 dark:text-blue-400">{rule.type}:</span>}
                                                      {rule.command && <span> {rule.command}</span>}
                                                      {rule.pattern && <span> -&gt; n:{rule.pattern}</span>}
                                                      {rule.comparison && <span> {rule.comparison}</span>}
                                                      {/* Handle other rule properties */}
                                                      {Object.entries(rule).map(([key, value]) => {
                                                        if (!['type', 'command', 'pattern', 'comparison'].includes(key) && value) {
                                                          return (
                                                            <div key={key} className="mt-1 ml-4">
                                                              <span className="text-gray-500">{key}:</span> {String(value)}
                                                            </div>
                                                          );
                                                        }
                                                        return null;
                                                      })}
                                                    </div>
                                                  </div>
                                                ))}
                                              </div>
                                            ) : check.condition ? (
                                              <pre className="text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 p-3 rounded-lg overflow-x-auto">
                                                {check.condition}
                                              </pre>
                                            ) : null}
                                          </div>
                                        )}

                                        {/* Compliance */}
                                        {check.compliance && (
                                          <div>
                                            <h5 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2">
                                              Compliance
                                            </h5>
                                            <div className="flex flex-wrap gap-2">
                                              {Array.isArray(check.compliance) ? (
                                                check.compliance.map((item: any, idx: number) => {
                                                  // Handle compliance items with key-value structure
                                                  if (typeof item === 'object' && item !== null && 'key' in item && 'value' in item) {
                                                    return (
                                                      <span key={idx} className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                                                        <span className="font-semibold mr-1">{item.key}:</span> {item.value}
                                                      </span>
                                                    );
                                                  }
                                                  // Handle string items
                                                  const displayItem = typeof item === 'object' ? JSON.stringify(item) : String(item);
                                                  return (
                                                    <span key={idx} className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                                                      {displayItem}
                                                    </span>
                                                  );
                                                })
                                              ) : typeof check.compliance === 'object' && !Array.isArray(check.compliance) ? (
                                                Object.entries(check.compliance).map(([key, value]) => {
                                                  // Convert value to string safely
                                                  let displayValue = '';
                                                  if (Array.isArray(value)) {
                                                    displayValue = value.join(', ');
                                                  } else if (typeof value === 'object' && value !== null) {
                                                    displayValue = JSON.stringify(value);
                                                  } else {
                                                    displayValue = String(value);
                                                  }

                                                  return (
                                                    <span key={key} className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                                                      <span className="font-semibold mr-1">{key}:</span> {displayValue}
                                                    </span>
                                                  );
                                                })
                                              ) : (
                                                <span className="text-sm text-gray-600 dark:text-gray-400">{String(check.compliance)}</span>
                                              )}
                                            </div>
                                          </div>
                                        )}

                                        {/* Command */}
                                        {check.command && (
                                          <div>
                                            <h5 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2">
                                              Command
                                            </h5>
                                            <code className="text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                                              {check.command}
                                            </code>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                            {filteredCisChecks.length === 0 && (
                              <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                                No CIS checks found.
                              </div>
                            )}
                          </div>

                          {/* Pagination */}
                          {filteredCisChecks.length > itemsPerPage && (
                            <div className="flex items-center justify-center space-x-2 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                              {/* First Page Button */}
                              <button
                                onClick={() => setCisCurrentPage(1)}
                                disabled={cisCurrentPage === 1}
                                className={`inline-flex items-center px-2 py-1.5 text-sm font-medium rounded-lg border transition-colors duration-150 ${
                                  cisCurrentPage === 1
                                    ? 'text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700/50 cursor-not-allowed'
                                    : 'text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                }`}
                                title="First page"
                              >
                                <ChevronDoubleLeftIcon className="w-4 h-4" />
                              </button>

                              {/* Previous Page Button */}
                              <button
                                onClick={() => setCisCurrentPage(Math.max(1, cisCurrentPage - 1))}
                                disabled={cisCurrentPage === 1}
                                className={`inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors duration-150 ${
                                  cisCurrentPage === 1
                                    ? 'text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700/50 cursor-not-allowed'
                                    : 'text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                }`}
                                title="Previous page"
                              >
                                <ChevronLeftIcon className="w-4 h-4 mr-1" />
                                Previous
                              </button>

                              {/* Page Info */}
                              <span className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300">
                                Page <strong>{cisCurrentPage}</strong> of <strong>{Math.ceil(filteredCisChecks.length / itemsPerPage)}</strong>
                              </span>

                              {/* Next Page Button */}
                              <button
                                onClick={() => setCisCurrentPage(Math.min(Math.ceil(filteredCisChecks.length / itemsPerPage), cisCurrentPage + 1))}
                                disabled={cisCurrentPage >= Math.ceil(filteredCisChecks.length / itemsPerPage)}
                                className={`inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors duration-150 ${
                                  cisCurrentPage >= Math.ceil(filteredCisChecks.length / itemsPerPage)
                                    ? 'text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700/50 cursor-not-allowed'
                                    : 'text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                }`}
                                title="Next page"
                              >
                                Next
                                <ChevronRightIcon className="w-4 h-4 ml-1" />
                              </button>

                              {/* Last Page Button */}
                              <button
                                onClick={() => setCisCurrentPage(Math.ceil(filteredCisChecks.length / itemsPerPage))}
                                disabled={cisCurrentPage >= Math.ceil(filteredCisChecks.length / itemsPerPage)}
                                className={`inline-flex items-center px-2 py-1.5 text-sm font-medium rounded-lg border transition-colors duration-150 ${
                                  cisCurrentPage >= Math.ceil(filteredCisChecks.length / itemsPerPage)
                                    ? 'text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700/50 cursor-not-allowed'
                                    : 'text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                }`}
                                title="Last page"
                              >
                                <ChevronDoubleRightIcon className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              {activeTab === 'vulnerabilities' && (
                <div className="space-y-6">
                  {/* Vulnerability Detection Header */}
                  <div className="bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 rounded-xl p-6 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          Vulnerability Detection
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          Security vulnerabilities found on this agent
                        </p>
                      </div>
                      {hasPermission('agents', 'download') && (
                        <button
                          onClick={() => handleExportVulnerabilities(selectedAgent)}
                          className="inline-flex items-center px-4 py-2.5 text-sm font-medium rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                        >
                          <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
                          Export Report
                        </button>
                      )}
                    </div>
                  </div>

                  {/* --- Calculate stats from selectedAgent.vulnerabilities --- */}
                  {(() => {
                    const vulns = selectedAgent.vulnerabilities || [];
                    const total = vulns.length;
                    const critical = vulns.filter(v => v.severity === 'Critical').length;
                    const high = vulns.filter(v => v.severity === 'High').length;
                    const medium = vulns.filter(v => v.severity === 'Medium').length;
                    const low = vulns.filter(v => v.severity === 'Low').length;
                    const unknown = vulns.filter(v => !['Critical', 'High', 'Medium', 'Low'].includes(v.severity)).length;

                    // For donut chart
                    const donutData = [
                      { label: 'Critical', value: critical, color: '#dc2626' },
                      { label: 'High', value: high, color: '#ea580c' },
                      { label: 'Medium', value: medium, color: '#d97706' },
                      { label: 'Low', value: low, color: '#16a34a' },
                      { label: 'Unknown', value: unknown, color: '#6b6b6bff' },
                    ];
                    const donutTotal = donutData.reduce((sum, d) => sum + d.value, 0) || 1;
                    let offset = 0;

                    // Top vulnerable packages
                    const pkgMap: Record<string, number> = {};
                    vulns.forEach(v => {
                      if (v.name) pkgMap[v.name] = (pkgMap[v.name] || 0) + 1;
                    });
                    const totalUniquePackages = Object.keys(pkgMap).length;
                    const topPkgs = Object.entries(pkgMap)
                      .sort((a, b) => b[1] - a[1])
                      .map(([name, count]) => ({
                        name,
                        count,
                        percentage: Math.round((count / total) * 100)
                      }))
                      .slice(0, 5);

                    return (
                      <>
                        {/* Summary Stats */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                          <div className="bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 rounded-xl p-5 text-center shadow-sm hover:shadow-md transition-shadow">
                            <div className="text-2xl font-bold text-gray-900 dark:text-white">{total}</div>
                            <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-1">Total</div>
                          </div>
                          <div className="bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 rounded-xl p-5 text-center shadow-sm hover:shadow-md transition-shadow">
                            <div className="text-2xl font-bold text-red-600 dark:text-red-400">{critical}</div>
                            <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-1">Critical</div>
                          </div>
                          <div className="bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 rounded-xl p-5 text-center shadow-sm hover:shadow-md transition-shadow">
                            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{high}</div>
                            <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-1">High</div>
                          </div>
                          <div className="bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 rounded-xl p-5 text-center shadow-sm hover:shadow-md transition-shadow">
                            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{medium + low}</div>
                            <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-1">Med+Low</div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* Left Side - Severity Distribution Chart */}
                          <div className="bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 rounded-xl p-6 shadow-sm">
                            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                              Severity Distribution
                            </h4>
                            {/* Donut Chart */}
                            <div className="flex items-center justify-center mb-6">
                              <div className="relative w-48 h-48">
                                <svg className="w-48 h-48 transform -rotate-90" viewBox="0 0 100 100">
                                  <circle
                                    cx="50"
                                    cy="50"
                                    r="40"
                                    stroke="currentColor"
                                    strokeWidth="8"
                                    fill="transparent"
                                    className="text-gray-200 dark:text-gray-700"
                                  />
                                  {donutData.map((d, i) => {
                                    const percent = (d.value / donutTotal) * 100;
                                    const dash = (percent / 100) * 251.2;
                                    const circle = (
                                      <circle
                                        key={d.label}
                                        cx="50"
                                        cy="50"
                                        r="40"
                                        stroke={d.color}
                                        strokeWidth="8"
                                        fill="transparent"
                                        strokeDasharray={`${dash} ${251.2 - dash}`}
                                        strokeDashoffset={-offset}
                                        className="transition-all duration-500"
                                      />
                                    );
                                    offset += dash;
                                    return circle;
                                  })}
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="text-center">
                                    <div className="text-2xl font-bold text-gray-900 dark:text-white">{total}</div>
                                    <div className="text-sm text-gray-500 dark:text-gray-400">Total</div>
                                  </div>
                                </div>
                              </div>
                            </div>
                            {/* Legend */}
                            <div className="space-y-3">
                              {donutData.map(d => (
                                <div key={d.label} className="flex items-center justify-between">
                                  <div className="flex items-center space-x-3">
                                    <div className="w-3 h-3 rounded-full" style={{ background: d.color }}></div>
                                    <span className="text-sm text-gray-700 dark:text-gray-300">{d.label}</span>
                                  </div>
                                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                                    {d.value} ({((d.value / donutTotal) * 100).toFixed(1)}%)
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                          {/* Right Side - Top Packages Bar Chart */}
                          <div className="bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 rounded-xl p-6 shadow-sm">
                            <div className="flex items-center justify-between mb-6">
                              <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                                Top Vulnerable Packages
                              </h4>
                            </div>
                            <div className="space-y-4">
                              {topPkgs.map((pkg, index) => (
                                <div key={index} className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <button className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm font-medium">
                                      {pkg.name}
                                    </button>
                                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                                      {pkg.count}
                                    </span>
                                  </div>
                                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                    <div
                                      className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-500"
                                      style={{ width: `${pkg.percentage}%` }}
                                    ></div>
                                  </div>
                                </div>
                              ))}
                            </div>
                            {/* Additional Stats */}
                            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                              <div className="grid grid-cols-2 gap-4 text-center">
                                <div>
                                  <div className="text-lg font-bold text-gray-900 dark:text-white">{totalUniquePackages}</div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400">Affected Packages</div>
                                </div>
                                <div>
                                  <div className="text-lg font-bold text-gray-900 dark:text-white">{total}</div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400">Total CVEs</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Detailed Vulnerability Timeline */}
                        <div className="bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 rounded-xl p-6 shadow-sm">
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                              Vulnerability Timeline
                            </h4>
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              Showing {Math.min((vulnCurrentPage - 1) * itemsPerPage + 1, vulns.length)} - {Math.min(vulnCurrentPage * itemsPerPage, vulns.length)} of {vulns.length}
                            </span>
                          </div>
                          <div className="space-y-3">
                            {vulns
                              .slice((vulnCurrentPage - 1) * itemsPerPage, vulnCurrentPage * itemsPerPage)
                              .map((vuln: any, index: number) => {
                              const isExpanded = expandedVulnerability === `${vuln.id}-${index}`;
                              return (
                                <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                                  <div
                                    onClick={() => setExpandedVulnerability(isExpanded ? null : `${vuln.id}-${index}`)}
                                    className="flex items-center space-x-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                                  >
                                    <div className="flex-shrink-0">
                                      <div className={`w-3 h-3 rounded-full ${vuln.severity === 'Critical' ? 'bg-red-600' :
                                        vuln.severity === 'High' ? 'bg-orange-600' :
                                          vuln.severity === 'Medium' ? 'bg-yellow-600' :
                                            vuln.severity === 'Low' ? 'bg-green-600' :
                                              'bg-gray-400'
                                        }`}></div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                                            {vuln.id} - {vuln.name}
                                          </p>
                                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                            Severity: {vuln.severity}
                                          </p>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                          {vuln.id && vuln.id.startsWith('CVE-') && (
                                            <a
                                              href={`https://nvd.nist.gov/vuln/detail/${vuln.id}`}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              onClick={(e) => e.stopPropagation()}
                                              className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                                            >
                                              <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5 mr-1" />
                                              NVD Details
                                            </a>
                                          )}
                                          {isExpanded ? (
                                            <ChevronUpIcon className="w-5 h-5 text-gray-400" />
                                          ) : (
                                            <ChevronDownIcon className="w-5 h-5 text-gray-400" />
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Expanded Description */}
                                  {isExpanded && vuln.description && (
                                    <div className="px-4 pb-4 pt-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
                                      <div className="space-y-3">
                                        <div>
                                          <h5 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2">
                                            Description
                                          </h5>
                                          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                                            {vuln.description}
                                          </p>
                                        </div>

                                        {vuln.cvss && (
                                          <div className="grid grid-cols-2 gap-3">
                                            {vuln.cvss.cvss2 && (
                                              <div>
                                                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">CVSS v2:</span>
                                                <span className="ml-2 text-sm font-semibold text-gray-900 dark:text-white">{vuln.cvss.cvss2}</span>
                                              </div>
                                            )}
                                            {vuln.cvss.cvss3 && (
                                              <div>
                                                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">CVSS v3:</span>
                                                <span className="ml-2 text-sm font-semibold text-gray-900 dark:text-white">{vuln.cvss.cvss3}</span>
                                              </div>
                                            )}
                                          </div>
                                        )}

                                        {(vuln.published || vuln.updated) && (
                                          <div className="grid grid-cols-2 gap-3 text-xs text-gray-500 dark:text-gray-400">
                                            {vuln.published && (
                                              <div>
                                                <span className="font-medium">Published:</span> {new Date(vuln.published).toLocaleDateString()}
                                              </div>
                                            )}
                                            {vuln.updated && (
                                              <div>
                                                <span className="font-medium">Updated:</span> {new Date(vuln.updated).toLocaleDateString()}
                                              </div>
                                            )}
                                          </div>
                                        )}

                                        {vuln.reference && (
                                          <div>
                                            <h5 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2">
                                              Reference{(() => {
                                                const refs = vuln.reference.split(',').map((r: string) => r.trim()).filter((r: string) => r);
                                                return refs.length > 1 ? 's' : '';
                                              })()}
                                            </h5>
                                            <div className="space-y-1.5">
                                              {vuln.reference.split(',').map((ref: string, idx: number) => {
                                                const trimmedRef = ref.trim();
                                                if (!trimmedRef) return null;
                                                return (
                                                  <a
                                                    key={idx}
                                                    href={trimmedRef}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline break-all"
                                                  >
                                                    <ArrowTopRightOnSquareIcon className="w-4 h-4 mr-1.5 flex-shrink-0" />
                                                    <span className="break-all">{trimmedRef}</span>
                                                  </a>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                            {vulns.length === 0 && (
                              <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                                No vulnerabilities found for this agent.
                              </div>
                            )}
                          </div>

                          {/* Pagination */}
                          {vulns.length > itemsPerPage && (
                            <div className="flex items-center justify-center space-x-2 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                              {/* First Page Button */}
                              <button
                                onClick={() => setVulnCurrentPage(1)}
                                disabled={vulnCurrentPage === 1}
                                className={`inline-flex items-center px-2 py-1.5 text-sm font-medium rounded-lg border transition-colors duration-150 ${
                                  vulnCurrentPage === 1
                                    ? 'text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700/50 cursor-not-allowed'
                                    : 'text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                }`}
                                title="First page"
                              >
                                <ChevronDoubleLeftIcon className="w-4 h-4" />
                              </button>

                              {/* Previous Page Button */}
                              <button
                                onClick={() => setVulnCurrentPage(Math.max(1, vulnCurrentPage - 1))}
                                disabled={vulnCurrentPage === 1}
                                className={`inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors duration-150 ${
                                  vulnCurrentPage === 1
                                    ? 'text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700/50 cursor-not-allowed'
                                    : 'text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                }`}
                                title="Previous page"
                              >
                                <ChevronLeftIcon className="w-4 h-4 mr-1" />
                                Previous
                              </button>

                              {/* Page Info */}
                              <span className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300">
                                Page <strong>{vulnCurrentPage}</strong> of <strong>{Math.ceil(vulns.length / itemsPerPage)}</strong>
                              </span>

                              {/* Next Page Button */}
                              <button
                                onClick={() => setVulnCurrentPage(Math.min(Math.ceil(vulns.length / itemsPerPage), vulnCurrentPage + 1))}
                                disabled={vulnCurrentPage >= Math.ceil(vulns.length / itemsPerPage)}
                                className={`inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors duration-150 ${
                                  vulnCurrentPage >= Math.ceil(vulns.length / itemsPerPage)
                                    ? 'text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700/50 cursor-not-allowed'
                                    : 'text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                }`}
                                title="Next page"
                              >
                                Next
                                <ChevronRightIcon className="w-4 h-4 ml-1" />
                              </button>

                              {/* Last Page Button */}
                              <button
                                onClick={() => setVulnCurrentPage(Math.ceil(vulns.length / itemsPerPage))}
                                disabled={vulnCurrentPage >= Math.ceil(vulns.length / itemsPerPage)}
                                className={`inline-flex items-center px-2 py-1.5 text-sm font-medium rounded-lg border transition-colors duration-150 ${
                                  vulnCurrentPage >= Math.ceil(vulns.length / itemsPerPage)
                                    ? 'text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700/50 cursor-not-allowed'
                                    : 'text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                }`}
                                title="Last page"
                              >
                                <ChevronDoubleRightIcon className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Quarantine Confirmation Modal */}
      {showQuarantineModal && agentToQuarantine && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <ShieldExclamationIcon className="w-8 h-8 text-orange-600" />
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Quarantine Agent
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    This action will isolate the agent from the network
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-4">
              <div className="space-y-4">
                <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <ExclamationTriangleIcon className="w-5 h-5 text-orange-400" />
                    </div>
                    <div className="ml-3">
                      <h4 className="text-sm font-medium text-orange-800 dark:text-orange-200">
                        Warning: This action will isolate the agent
                      </h4>
                      <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                        The agent will be immediately isolated from the network. You can unquarantine it later.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Agent Name:</span>
                    <span className="text-sm text-gray-900 dark:text-white">{agentToQuarantine.name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">IP Address:</span>
                    <span className="text-sm text-gray-900 dark:text-white">{agentToQuarantine.ipAddress}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Operating System:</span>
                    <span className="text-sm text-gray-900 dark:text-white">{agentToQuarantine.operatingSystem}</span>
                  </div>
                </div>

                {/* Whitelist IPs Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Additional Whitelist IPs (Optional)
                    </label>
                    <button
                      type="button"
                      onClick={addWhitelistIP}
                      className="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                    >
                      <PlusIcon className="w-4 h-4 mr-1" />
                      Add IP
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Manager IP is automatically included. Add extra IPs if needed.
                  </p>
                  {whitelistIPs.length > 0 && (
                    <div className="space-y-2">
                      {whitelistIPs.map((ip, index) => (
                        <div key={index} className="flex items-center space-x-2">
                          <input
                            type="text"
                            value={ip}
                            onChange={(e) => updateWhitelistIP(index, e.target.value)}
                            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                            placeholder="192.168.1.100"
                          />
                          <button
                            type="button"
                            onClick={() => removeWhitelistIP(index)}
                            className="p-2 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                          >
                            <MinusIcon className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Super Admin Password Field */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Super Admin Password</label>
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="Enter super admin password"
                    required
                  />
                </div>

                {/* Error Message */}
                {quarantineError && (
                  <div className="flex items-center space-x-2 text-red-600 dark:text-red-400 text-sm">
                    <ExclamationTriangleIcon className="w-4 h-4" />
                    <span>{quarantineError}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
              <button
                onClick={cancelQuarantine}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Cancel
              </button>
              <button
                onClick={confirmQuarantine}
                disabled={quarantineLoading || !adminPassword}
                className="px-4 py-2 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {quarantineLoading ? (
                  <>
                    <div className="w-4 h-4 mr-2 inline border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Quarantining...
                  </>
                ) : (
                  <>
                    <ShieldExclamationIcon className="w-4 h-4 mr-2 inline" />
                    Quarantine Agent
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unquarantine Confirmation Modal */}
      {showUnquarantineModal && agentToUnquarantine && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <CheckCircleIcon className="w-8 h-8 text-green-600" />
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Unquarantine Agent
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    This action will restore network connectivity for the agent
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-4">
              <div className="space-y-4">
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <CheckCircleIcon className="w-5 h-5 text-green-400" />
                    </div>
                    <div className="ml-3">
                      <h4 className="text-sm font-medium text-green-800 dark:text-green-200">
                        Restore Network Access
                      </h4>
                      <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                        The agent will be released from quarantine and network connectivity will be restored.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Agent Name:</span>
                    <span className="text-sm text-gray-900 dark:text-white">{agentToUnquarantine.name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">IP Address:</span>
                    <span className="text-sm text-gray-900 dark:text-white">{agentToUnquarantine.ipAddress}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Operating System:</span>
                    <span className="text-sm text-gray-900 dark:text-white">{agentToUnquarantine.operatingSystem}</span>
                  </div>
                </div>

                {/* Super Admin Password Field */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Super Admin Password</label>
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="Enter super admin password"
                    required
                  />
                </div>

                {/* Error Message */}
                {quarantineError && (
                  <div className="flex items-center space-x-2 text-red-600 dark:text-red-400 text-sm">
                    <ExclamationTriangleIcon className="w-4 h-4" />
                    <span>{quarantineError}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
              <button
                onClick={cancelUnquarantine}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Cancel
              </button>
              <button
                onClick={confirmUnquarantine}
                disabled={quarantineLoading || !adminPassword}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {quarantineLoading ? (
                  <>
                    <div className="w-4 h-4 mr-2 inline border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Releasing...
                  </>
                ) : (
                  <>
                    <CheckCircleIcon className="w-4 h-4 mr-2 inline" />
                    Unquarantine Agent
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



