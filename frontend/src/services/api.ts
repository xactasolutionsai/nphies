import axios from 'axios'

export async function sendPriorAuth(payload: unknown, webhookUrl?: string) {
	const runtimeWebhook = typeof window !== 'undefined' ? window.localStorage?.getItem('webhookUrl') || undefined : undefined
	const envWebhook = (import.meta as any)?.env?.VITE_WEBHOOK_URL as string | undefined
	const targetWebhookUrl = webhookUrl || (runtimeWebhook && runtimeWebhook.trim()) || (envWebhook && envWebhook.trim()) || ''
	
	if (!targetWebhookUrl) {
		throw new Error('No webhook URL provided')
	}
	
	// Use CORS proxy to avoid CORS issues
	const res = await axios.post('/api/n8n-proxy', {
		webhookUrl: targetWebhookUrl,
		payload
	}, {
		headers: { 'Content-Type': 'application/json' },
	})
	return res.data
}
