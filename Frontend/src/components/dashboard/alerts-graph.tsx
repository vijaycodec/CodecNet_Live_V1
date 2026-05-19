'use client';

import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

interface HourlyAlertCount {
  hour: string; // "00" - "23"
  count: number;
}

interface DashboardMetrics {
  hourly_alert_counts: {
    minor: HourlyAlertCount[];
    major: HourlyAlertCount[];
    critical: HourlyAlertCount[];
  };
}

interface AlertsGraphProps {
  data: DashboardMetrics;
}

// Build an array of length 24, indexed by hour, and add all 3 series to each point
// function build24hChartData(hourly: DashboardMetrics['hourly_alert_counts']) {
//   // Ensure hours are '00', '01', ..., '23'
//   const hours = Array.from({ length: 24 }, (_, i) => (23 - i).toString());
//   const pad = (h: string) => h.padStart(2, '0');
//   const minorMap = Object.fromEntries(hourly.minor.map(item => [item.hour, item.count]));
//   const majorMap = Object.fromEntries(hourly.major.map(item => [item.hour, item.count]));
//   const criticalMap = Object.fromEntries(hourly.critical.map(item => [item.hour, item.count]));

//   return hours.map(hr => ({
//     hour: pad(hr),
//     minor: minorMap[hr] ?? 0,
//     major: majorMap[hr] ?? 0,
//     critical: criticalMap[hr] ?? 0,
//   }));
// }

function build24hChartData(hourly?: DashboardMetrics['hourly_alert_counts']) {
  // Default values for missing data
  const emptyArray: HourlyAlertCount[] = [];
  const safeHourly = hourly || { minor: emptyArray, major: emptyArray, critical: emptyArray };

  // Create hours from 0 to 23 in chronological order
  const hours = Array.from({ length: 24 }, (_, i) => i.toString());
  const pad = (h: string) => h.padStart(2, '0');
  const minorMap = Object.fromEntries((safeHourly.minor || []).map(item => [item.hour, item.count]));
  const majorMap = Object.fromEntries((safeHourly.major || []).map(item => [item.hour, item.count]));
  const criticalMap = Object.fromEntries((safeHourly.critical || []).map(item => [item.hour, item.count]));

  return hours.map(hr => ({
    hour: pad(hr),
    minor: minorMap[hr] ?? 0,
    major: majorMap[hr] ?? 0,
    critical: criticalMap[hr] ?? 0,
  }));
}

export function AlertsGraph({ data }: AlertsGraphProps) {
  // Prepare data for the chart: all 24 hours
  const chartData = build24hChartData(data.hourly_alert_counts);

  return (
    <div className="h-full flex flex-col bg-[#0f172a] rounded-xl shadow-md text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-700/30 to-indigo-700/30 backdrop-blur-sm px-4 py-3 rounded-t-xl">
        <div className="flex items-center space-x-2 mb-1">
          <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
          <h3 className="text-base font-medium text-white">
            Severity Alerts Graph
          </h3>
        </div>
        <p className="text-xs text-blue-200/80">By Severity (Minor, Major, Critical)</p>
      </div>

      {/* Chart Section */}
      <div className="flex-1 p-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
            <XAxis dataKey="hour" stroke="#cbd5e1" tick={{ fill: "#cbd5e1" }} />
            <YAxis
              stroke="#cbd5e1"
              label={{
                value: 'Alerts',
                angle: -90,
                position: 'insideLeft',
                fill: '#cbd5e1',
              }}
            />
            <Tooltip
              labelFormatter={(label) => {
                // Convert hour to readable format
                const hour = parseInt(label);
                const period = hour >= 12 ? 'PM' : 'AM';
                const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
                return `${displayHour}:00 ${period}`;
              }}
              contentStyle={{
                backgroundColor: '#1e293b',
                borderColor: '#334155',
                color: '#f1f5f9',
              }}
              labelStyle={{ color: '#93c5fd' }}
            />

            <Legend wrapperStyle={{ color: '#e2e8f0' }} />
            <Line
              type="monotone"
              dataKey="minor"
              stroke="#818cf8"
              strokeWidth={2}
              name="Minor"
              dot={{ r: 2 }}
              activeDot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="major"
              stroke="#38bdf8"
              strokeWidth={2}
              name="Major"
              dot={{ r: 2 }}
              activeDot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="critical"
              stroke="#f43f5e"
              strokeWidth={2}
              name="Critical"
              dot={{ r: 2 }}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}


// 'use client';

// import React from 'react';
// import {
//   LineChart,
//   Line,
//   XAxis,
//   YAxis,
//   Tooltip,
//   Legend,
//   ResponsiveContainer,
//   CartesianGrid,
// } from 'recharts';

// interface DashboardMetrics {
//   total_alerts: number;
//   alerts_last_24hr: number;
//   critical_alerts: number;
//   major_alerts: number;
//   minor_alerts: number;
//   open_tickets: number;
//   resolved_today: number;
//   avg_response_time: string;
//   compliance_score: string;
//   active_agents: number;
//   wazuh_health: string;
// }

// interface AlertsGraphProps {
//   data: DashboardMetrics;
// }

// const generateAlertData = (critical: number, major: number, minor: number) => {
//   const now = new Date();
//   const hours = [...Array(6)].map((_, i) => {
//     const date = new Date(now.getTime() - i * 60 * 60 * 1000);
//     const label = `${date.getHours()}:00`;

//     return {
//       time: label,
//       critical: Math.floor(critical / 6),
//       major: Math.floor(major / 6),
//       minor: Math.floor(minor / 6),
//     };
//   });

//   return hours.reverse();
// };

// export function AlertsGraph({ data }: AlertsGraphProps) {
//   const chartData = generateAlertData(
//     data.critical_alerts,
//     data.major_alerts,
//     data.minor_alerts
//   );

//   return (
//     <div className="h-full flex flex-col bg-[#0f172a] rounded-xl shadow-md text-white">
//       {/* Header */}
//       <div className="bg-gradient-to-r from-blue-700/30 to-indigo-700/30 backdrop-blur-sm px-4 py-3 rounded-t-xl">
//         <div className="flex items-center space-x-2 mb-1">
//           <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
//           <h3 className="text-base font-medium text-white">Severity Alerts Graph</h3>
//         </div>
//         <p className="text-xs text-blue-200/80">Last 6 hours</p>
//       </div>

//       {/* Chart Section */}
//       <div className="flex-1 p-4">
//         <ResponsiveContainer width="100%" height="100%">
//           <LineChart data={chartData}>
//             <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
//             <XAxis dataKey="time" stroke="#cbd5e1" />
//             <YAxis
//               stroke="#cbd5e1"
//               label={{
//                 value: 'No. of Alerts',
//                 angle: -90,
//                 position: 'insideLeft',
//                 fill: '#cbd5e1',
//               }}
//             />
//             <Tooltip
//               contentStyle={{
//                 backgroundColor: '#1e293b',
//                 borderColor: '#334155',
//                 color: '#f1f5f9',
//               }}
//               labelStyle={{ color: '#93c5fd' }}
//             />
//             <Legend wrapperStyle={{ color: '#e2e8f0' }} />
//             <Line
//               type="monotone"
//               dataKey="critical"
//               stroke="#ef4444"
//               strokeWidth={2}
//               name="Critical Alerts"
//               dot={{ r: 3 }}
//             />
//             <Line
//               type="monotone"
//               dataKey="major"
//               stroke="#fbbf24"
//               strokeWidth={2}
//               name="Major Alerts"
//               dot={{ r: 3 }}
//             />
//             <Line
//               type="monotone"
//               dataKey="minor"
//               stroke="#3b82f6"
//               strokeWidth={2}
//               name="Minor Alerts"
//               dot={{ r: 3 }}
//             />
//           </LineChart>
//         </ResponsiveContainer>
//       </div>
//     </div>
//   );
// }
