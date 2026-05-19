'use client'

import { useState } from 'react'
import {
  XMarkIcon,
  MagnifyingGlassIcon,
  ShieldCheckIcon,
  ChartBarIcon,
  ClipboardDocumentListIcon,
  DocumentTextIcon,
  HeartIcon,
  BanknotesIcon,
  BuildingOfficeIcon,
  CogIcon,
  ScaleIcon,
  ShieldExclamationIcon
} from '@heroicons/react/24/outline'
import { useRouter } from 'next/navigation'

interface ComplianceFramework {
  id: string
  name: string
  title: string
  description: string
  icon: React.ComponentType<any>
  requirements: ComplianceRequirement[]
  hasWazuhLink: boolean
  wazuhPath?: string
}

interface ComplianceRequirement {
  id: string
  title: string
  alertCount: number
}

const complianceFrameworks: ComplianceFramework[] = [
  {
    id: 'pci-dss',
    name: 'PCI DSS',
    title: 'PCI DSS',
    description: 'Global security standard for entities that process, store, or transmit payment cardholder data.',
    icon: ShieldCheckIcon,
    requirements: [],
    hasWazuhLink: true,
    wazuhPath: '/app/pci-dss#/overview/?tab=pci&tabView=inventory&_a=(filters:!(),query:(language:kuery,query:\'\'))&_g=(filters:!(),refreshInterval:(pause:!t,value:0),time:(from:now-24h,to:now))'
  },
  {
    id: 'gdpr',
    name: 'GDPR',
    title: 'GDPR',
    description: 'General Data Protection Regulation (GDPR) sets guidelines for processing of personal data.',
    icon: ChartBarIcon,
    requirements: [],
    hasWazuhLink: true,
    wazuhPath: '/app/gdpr#/overview/?tab=gdpr&tabView=dashboard&_a=(filters:!(),query:(language:kuery,query:\'\'))&_g=(filters:!(),refreshInterval:(pause:!t,value:0),time:(from:now-24h,to:now))'
  },
  {
    id: 'hipaa',
    name: 'HIPAA',
    title: 'HIPAA',
    description: 'Health Insurance Portability and Accountability Act of 1996 (HIPAA) provides data privacy and security provisions for safeguarding medical information.',
    icon: HeartIcon,
    requirements: [],
    hasWazuhLink: true,
    wazuhPath: '/app/hipaa#/overview/?tab=hipaa&tabView=dashboard&_a=(filters:!(),query:(language:kuery,query:\'\'))&_g=(filters:!(),refreshInterval:(pause:!t,value:0),time:(from:now-24h,to:now))'
  },
  {
    id: 'nist-800-53',
    name: 'NIST 800-53',
    title: 'NIST 800-53',
    description: 'National Institute of Standards and Technology Special Publication 800-53 (NIST 800-53) sets guidelines for federal information systems.',
    icon: DocumentTextIcon,
    requirements: [],
    hasWazuhLink: true,
    wazuhPath: '/app/nist-800-53#/overview/?tab=nist&tabView=dashboard&_a=(filters:!(),query:(language:kuery,query:\'\'))&_g=(filters:!(),refreshInterval:(pause:!t,value:0),time:(from:now-24h,to:now))'
  },
  {
    id: 'tsc',
    name: 'TSC',
    title: 'TSC',
    description: 'Trust Services Criteria for Security, Availability, Processing Integrity, Confidentiality, and Privacy.',
    icon: ClipboardDocumentListIcon,
    requirements: [],
    hasWazuhLink: true,
    wazuhPath: '/app/tsc#/overview/?tab=tsc&tabView=dashboard&_a=(filters:!(),query:(language:kuery,query:\'\'))&_g=(filters:!(),refreshInterval:(pause:!t,value:0),time:(from:now-24h,to:now))'
  },
  {
    id: 'rbi',
    name: 'RBI',
    title: 'RBI',
    description: 'Reserve Bank of India guidelines for financial institutions and banking sector cybersecurity compliance.',
    icon: BanknotesIcon,
    requirements: [],
    hasWazuhLink: false
  },
  {
    id: 'irdai',
    name: 'IRDAI',
    title: 'IRDAI',
    description: 'Insurance Regulatory and Development Authority of India guidelines for insurance sector data protection and security.',
    icon: BuildingOfficeIcon,
    requirements: [],
    hasWazuhLink: false
  },
  {
    id: 'iso27001',
    name: 'ISO27001',
    title: 'ISO 27001',
    description: 'International standard for information security management systems (ISMS) providing a framework for establishing, implementing, maintaining and continually improving information security.',
    icon: CogIcon,
    requirements: [],
    hasWazuhLink: true,
    wazuhPath: ''
  },
  {
    id: 'sebi',
    name: 'SEBI',
    title: 'SEBI',
    description: 'Securities and Exchange Board of India guidelines for capital markets and securities sector cybersecurity compliance.',
    icon: ScaleIcon,
    requirements: [],
    hasWazuhLink: false
  },
  {
    id: 'gpg13',
    name: 'GPG13',
    title: 'GPG13',
    description: 'German government security guidelines for protecting information and communications technology systems.',
    icon: ShieldExclamationIcon,
    requirements: [],
    hasWazuhLink: true,
    wazuhPath: '/app/gpg13#/overview/?tab=gpg13&tabView=dashboard&_a=(filters:!(),query:(language:kuery,query:\'\'))&_g=(filters:!(),refreshInterval:(pause:!t,value:0),time:(from:now-24h,to:now))'
  }
]

export default function CompliancePage() {
  const router = useRouter()

  const handleFrameworkClick = (framework: ComplianceFramework) => {
    router.push(`/compliance/${framework.id}`)
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
          Compliance Frameworks
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Security framework compliance monitoring and requirements management
        </p>
      </div>

      {/* Compliance Frameworks Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {complianceFrameworks.map((framework) => {
          const IconComponent = framework.icon
          return (
            <div
              key={framework.id}
              onClick={() => handleFrameworkClick(framework)}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-200 cursor-pointer group"
            >
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  <IconComponent className="w-8 h-8 text-gray-600 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {framework.title}
                  </h3>
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    {framework.description}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}