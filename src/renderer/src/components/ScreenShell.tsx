interface ScreenShellProps {
  children: React.ReactNode
  className?: string
}

export default function ScreenShell({ children, className = '' }: ScreenShellProps) {
  return (
    <div className={`h-screen flex flex-col overflow-hidden ${className}`}>
      {children}
    </div>
  )
}
