import { useEffect, useMemo, useState } from 'react'
import { loadHistory } from '@/services/storage'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Bar, BarChart, CartesianGrid, Legend, Pie, PieChart, Tooltip, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts'

const COLORS = ['#3b82f6','#f59e0b','#10b981','#ef4444']

export default function ChartsPage() {
	const [tick, setTick] = useState(0)
	useEffect(() => {
		const id = setInterval(() => setTick((t) => t + 1), 2000)
		return () => clearInterval(id)
	}, [])
	const history = loadHistory()
	const data = useMemo(() => {
		const counts: Record<string, number> = { mri: 0, drug: 0, referral: 0, transfer: 0 }
		history.forEach(h => { counts[h.data.authType] = (counts[h.data.authType] ?? 0) + 1 })
		return Object.entries(counts).map(([type, count]) => ({ type, count }))
	}, [tick])

	return (
		<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
			<Card>
				<CardHeader><CardTitle>Requests by Type (Bar)</CardTitle></CardHeader>
				<CardContent className="h-80">
					<ResponsiveContainer width="100%" height="100%">
						<BarChart data={data}>
							<CartesianGrid strokeDasharray="3 3" />
							<XAxis dataKey="type" />
							<YAxis allowDecimals={false} />
							<Tooltip />
							<Legend />
							<Bar dataKey="count" fill="#3b82f6" />
						</BarChart>
					</ResponsiveContainer>
				</CardContent>
			</Card>
			<Card>
				<CardHeader><CardTitle>Requests by Type (Pie)</CardTitle></CardHeader>
				<CardContent className="h-80">
					<ResponsiveContainer width="100%" height="100%">
						<PieChart>
							<Pie data={data} dataKey="count" nameKey="type" outerRadius={110} label>
								{data.map((entry, index) => (
									<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
								))}
							</Pie>
							<Tooltip />
						</PieChart>
					</ResponsiveContainer>
				</CardContent>
			</Card>
		</div>
	)
}
