import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { QRCodeTimeline } from '@/types/auth'

interface QRTimelineChartProps {
  timeline: QRCodeTimeline
}

export const QRTimelineChart = ({ timeline }: QRTimelineChartProps) => {
  // Transform data for recharts format
  const chartData = timeline.data_points.map((point) => ({
    date: formatDate(point.date),
    scans: point.count,
    fullDate: point.date,
  }))

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12 }}
            angle={-45}
            textAnchor="end"
            height={60}
          />
          <YAxis
            tick={{ fontSize: 12 }}
            label={{ value: 'Сканирований', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ strokeDasharray: '3 3' }}
          />
          <Line
            type="monotone"
            dataKey="scans"
            stroke="#8884d8"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{
    payload: {
      fullDate: string
      scans: number
    }
  }>
}

const CustomTooltip = ({ active, payload }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className="bg-white p-3 border border-gray-300 rounded shadow-lg">
        <p className="font-semibold text-sm">{data.fullDate}</p>
        <p className="text-sm text-gray-600">
          Сканирований: <span className="font-bold text-blue-600">{data.scans}</span>
        </p>
      </div>
    )
  }
  return null
}

// Format date for display on X-axis
const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr)
  const month = date.getMonth() + 1
  const day = date.getDate()
  return `${day}/${month}`
}
