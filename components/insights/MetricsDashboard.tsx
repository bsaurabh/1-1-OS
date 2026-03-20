import type { ComputedMetrics } from '@/lib/excel/metrics'

interface MetricsDashboardProps {
  metrics: ComputedMetrics
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-semibold text-gray-900 mt-1">{value}</p>
    </div>
  )
}

function SectionHeader({ title }: { title: string }) {
  return <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">{title}</h3>
}

export default function MetricsDashboard({ metrics }: MetricsDashboardProps) {
  const { delivery, time, business, throughput } = metrics

  return (
    <div data-testid="metrics-dashboard" className="space-y-8">

      {/* Delivery */}
      <section data-testid="delivery-metrics">
        <SectionHeader title="Delivery" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <StatCard label="Total Items" value={delivery.totalItems} />
          <StatCard label="Completion Rate" value={`${delivery.completionRate}%`} />
          {Object.entries(delivery.byStatus).map(([status, count]) => (
            <StatCard key={status} label={status} value={count} />
          ))}
        </div>
        {Object.keys(delivery.bySize).length > 0 && (
          <div>
            <p className="text-xs text-gray-500 mb-2">Size breakdown</p>
            <div className="flex gap-3 flex-wrap">
              {Object.entries(delivery.bySize).map(([size, count]) => (
                <span key={size} className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-full text-sm font-medium">
                  {size}: {count}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Time */}
      {time.avgTurnaroundDays !== null && (
        <section data-testid="time-metrics">
          <SectionHeader title="Time Metrics" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatCard label="Avg Turnaround" value={`${time.avgTurnaroundDays}d`} />
            <StatCard label="Items with Delays" value={time.itemsWithDelays} />
            {Object.entries(time.avgTurnaroundBySize).map(([size, days]) => (
              <StatCard key={size} label={`Avg (${size})`} value={`${days}d`} />
            ))}
          </div>
        </section>
      )}

      {/* Business Impact */}
      {business.totalRevenue > 0 && (
        <section data-testid="business-metrics">
          <SectionHeader title="Business Impact" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
            <StatCard label="Total Revenue" value={`$${business.totalRevenue.toLocaleString()}`} />
            {business.revenuePerItem !== null && (
              <StatCard label="Revenue / Item" value={`$${business.revenuePerItem.toLocaleString()}`} />
            )}
          </div>
          {business.revenueByMonth.length > 0 && (
            <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2 text-gray-600 font-medium">Month</th>
                  <th className="text-right px-4 py-2 text-gray-600 font-medium">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {business.revenueByMonth.map((r) => (
                  <tr key={r.month} className="border-t border-gray-100">
                    <td className="px-4 py-2 text-gray-700">{r.month}</td>
                    <td className="px-4 py-2 text-gray-900 text-right font-medium">${r.revenue.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {/* Throughput */}
      {Object.keys(throughput.completedByMonth).length > 0 && (
        <section data-testid="throughput-metrics">
          <SectionHeader title="Throughput" />
          <div className="mb-3">
            <span className={`text-sm font-medium px-3 py-1 rounded-full ${
              throughput.velocityTrend === 'improving' ? 'bg-green-100 text-green-700' :
              throughput.velocityTrend === 'declining' ? 'bg-red-100 text-red-700' :
              throughput.velocityTrend === 'stable' ? 'bg-gray-100 text-gray-600' :
              'bg-gray-100 text-gray-500'
            }`}>
              Velocity: {throughput.velocityTrend.replace('_', ' ')}
            </span>
          </div>
          <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2 text-gray-600 font-medium">Month</th>
                <th className="text-right px-4 py-2 text-gray-600 font-medium">Completed</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(throughput.completedByMonth)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([month, count]) => (
                <tr key={month} className="border-t border-gray-100">
                  <td className="px-4 py-2 text-gray-700">{month}</td>
                  <td className="px-4 py-2 text-gray-900 text-right font-medium">{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  )
}
