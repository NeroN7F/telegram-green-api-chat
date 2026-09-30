import { cn } from '@/shared/lib/utils'

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <img
        src="/telegram-logo.svg"
        alt=""
        className={cn('shrink-0', compact ? 'size-10' : 'size-12')}
      />
      <span className="text-xl font-semibold tracking-tight">Telegram</span>
    </div>
  )
}
