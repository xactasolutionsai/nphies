import { useEffect, useMemo, useState } from 'react'
import { loadHistory } from '@/services/storage'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table'
import { Link } from 'react-router-dom'

export default function HistoryTable() {
	const [query, setQuery] = useState('')
	const [typeFilter, setTypeFilter] = useState('')
	const [statusFilter, setStatusFilter] = useState('')
	const [tick, setTick] = useState(0)
	useEffect(() => {
		const id = setInterval(() => setTick((t) => t + 1), 2000)
		return () => clearInterval(id)
	}, [])
	const history = loadHistory()
	const filtered = useMemo(() => {
		return history.filter(h =>
			(h.data.patient.fullName.toLowerCase().includes(query.toLowerCase()) ||
				h.data.service.serviceType.toLowerCase().includes(query.toLowerCase())) &&
			(typeFilter ? h.data.service.serviceType === typeFilter : true) &&
			(statusFilter ? h.status === statusFilter : true)
		)
	}, [query, typeFilter, statusFilter, tick])

	return (
		<div className="space-y-3">
			<div className="grid grid-cols-1 md:grid-cols-4 gap-2">
				<input className="border rounded-md px-3 py-2 text-sm" placeholder="Search by patient or type" value={query} onChange={(e) => setQuery(e.target.value)} />
				<select className="border rounded-md px-3 py-2 text-sm" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
					<option value="">All Types</option>
					{['imaging','surgery','pharmacy','referral','transfer','vision','dental','other'].map(t => (
						<option key={t} value={t}>{t}</option>
					))}
				</select>
				<select className="border rounded-md px-3 py-2 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
					<option value="">All Statuses</option>
					{['pending','approved','denied','queued'].map(s => (
						<option key={s} value={s}>{s}</option>
					))}
				</select>
				<Link className="text-primary underline self-center" to="/charts">Open Analytics</Link>
			</div>
			<div className="overflow-auto">
				<Table>
					<THead>
						<TR>
							<TH>Time</TH>
							<TH>Type</TH>
							<TH>Status</TH>
							<TH>Patient</TH>
						</TR>
					</THead>
					<TBody>
						{filtered.map((h) => (
							<TR key={h.id}>
								<TD>{new Date(h.timestamp).toLocaleString()}</TD>
								<TD className="uppercase">{h.data.service.serviceType}</TD>
								<TD>{h.status}</TD>
								<TD>{h.data.patient.fullName}</TD>
							</TR>
						))}
					</TBody>
				</Table>
			</div>
		</div>
	)
}
