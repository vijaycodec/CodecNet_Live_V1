'use client'

import { useState } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'

type SeverityItem = {
  name: string
  value: number
  color: string
  percentage: number
}

type SeverityDonutProps = {
  data: SeverityItem[]
}

export function SeverityDonut({ data }: SeverityDonutProps) {

  // Custom tooltip component
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div 
          className="bg-gray-800/95 backdrop-blur-sm px-4 py-3 rounded-lg shadow-xl border border-gray-700/50"
          style={{ 
            zIndex: 99999,
            position: 'relative'
          }}
        >
          <div className="flex items-center space-x-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: data.color }}
            />
            <span className="font-semibold text-white">
              {data.name}
            </span>
          </div>
          <div className="mt-1 text-sm text-gray-300">
            <span className="font-medium">{data.value}</span> alerts ({data.percentage}%)
          </div>
        </div>
      )
    }
    return null
  }

  // export function SeverityDonut() {
  const total = data.reduce((sum, item) => sum + item.value, 0)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  const onPieEnter = (_: any, index: number) => {
    setActiveIndex(index)
  }

  const onPieLeave = () => {
    setActiveIndex(null)
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600/30 to-indigo-600/30 backdrop-blur-sm px-4 py-3 rounded-t-xl">
        <div className="flex items-center space-x-2 mb-1">
          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
          <h3 className="text-base font-medium text-white">Severity Distribution</h3>
        </div>
        <p className="text-xs text-blue-100/80">
          Last 24 hours • {total} total alerts
        </p>
      </div>
      <div className="flex-1 flex flex-col px-4 pt-4 pb-2">
        {/* Pie Chart Section - Reduced height */}
        <div className="relative h-[180px] z-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <defs>
                {data.map((entry, index) => (
                  <radialGradient
                    key={`gradient-${index}`}
                    id={`gradient-${index}`}
                    cx="50%"
                    cy="50%"
                    r="50%"
                    fx="50%"
                    fy="50%"
                  >
                    <stop offset="0%" stopColor={entry.color} stopOpacity={0.9} />
                    <stop offset="100%" stopColor={entry.color} stopOpacity={0.6} />
                  </radialGradient>
                ))}
              </defs>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={70}
                innerRadius={45}
                paddingAngle={2}
                dataKey="value"
                animationBegin={0}
                animationDuration={1200}
                animationEasing="ease-out"
                onMouseEnter={onPieEnter}
                onMouseLeave={onPieLeave}
              >
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={`url(#gradient-${index})`}
                    stroke="rgba(0,0,0,0.3)"
                    strokeWidth={1}
                    style={{
                      filter: activeIndex === index ? 'drop-shadow(0 0 6px rgba(255,255,255,0.3))' : 'none',
                      transform: activeIndex === index ? 'scale(1.05)' : 'scale(1)',
                      transformOrigin: 'center',
                      transition: 'transform 0.2s, filter 0.2s'
                    }}
                  />
                ))}
              </Pie>
              <Tooltip 
                content={<CustomTooltip />}
                wrapperStyle={{ zIndex: 9999 }}
              />
            </PieChart>
          </ResponsiveContainer>
          {/* Center text */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <div className="text-center bg-gray-900/40 backdrop-blur-sm rounded-full w-24 h-24 flex flex-col items-center justify-center border border-gray-700/30 shadow-lg">
              <div className="text-2xl font-bold text-white">
                {total}
              </div>
              <div className="text-xs text-gray-400">
                Total Alerts
              </div>
            </div>
          </div>
        </div>

        {/* Horizontal Table - Categories */}
        <div className="mt-4 border-t border-gray-700/50 pt-4">
          <div className="grid grid-cols-3 gap-4">
            {data.map((item, index) => (
              <div
                key={item.name}
                className="bg-gray-800/40 rounded-lg p-2 text-center hover:bg-gray-800/60 transition-all duration-200 cursor-pointer border border-gray-700/30"
                onMouseEnter={() => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
                style={{
                  borderColor: activeIndex === index ? item.color : undefined,
                  boxShadow: activeIndex === index ? `0 0 8px ${item.color}30` : 'none'
                }}
              >
                <div className="flex items-center justify-center mb-1">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ 
                      backgroundColor: item.color,
                      boxShadow: `0 0 4px ${item.color}50`
                    }}
                  />
                </div>
                <div className="text-xs font-medium text-gray-300 mb-1">
                  {item.name}
                </div>
                <div className="text-lg font-bold text-white mb-1">
                  {item.value || 0}
                </div>
                <div className="text-xs text-gray-400">
                  {item.percentage}%
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Status indicator */}
        <div className="mt-3 border-t border-gray-700/50 pt-2">
          <div className="flex items-center">
            <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
            <span className="text-xs text-green-400">
              Real-time monitoring active
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
