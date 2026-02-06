interface StatusBarProps {
  status: 'loading' | 'ready' | 'error'
  message?: string
}

export default function StatusBar({ status, message }: StatusBarProps): React.JSX.Element {
  const statusConfig = {
    loading: { color: 'bg-yellow-400', label: message || 'Initializing...' },
    ready: { color: 'bg-green-500', label: 'Ready' },
    error: { color: 'bg-red-500', label: message || 'Error' }
  }

  const { color, label } = statusConfig[status]

  return (
    <div className="flex items-center gap-2 px-6 py-3 border-b border-therapy-grey-light bg-therapy-card">
      <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
      <span className="text-sm text-therapy-grey-deep">{label}</span>
    </div>
  )
}
