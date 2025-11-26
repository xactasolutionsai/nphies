import { HistoryRecord } from "@/types"

const KEY = "pa_history_v1"

export function loadHistory(): HistoryRecord[] {
	try {
		const raw = localStorage.getItem(KEY)
		return raw ? (JSON.parse(raw) as HistoryRecord[]) : []
	} catch {
		return []
	}
}

export function saveHistory(items: HistoryRecord[]) {
	localStorage.setItem(KEY, JSON.stringify(items))
}

export function addHistory(item: HistoryRecord) {
	const items = loadHistory()
	items.unshift(item)
	saveHistory(items.slice(0, 200))
}
