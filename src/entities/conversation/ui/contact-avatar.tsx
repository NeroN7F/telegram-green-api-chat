import { Avatar, AvatarFallback } from '@/shared/ui/avatar'
import { cn } from '@/shared/lib/utils'

const colors = [
  'bg-[#e9e4fb] text-[#5f478f]',
  'bg-[#dfedf5] text-[#386783]',
  'bg-[#f9e9da] text-[#835123]',
  'bg-[#dcefe7] text-[#2c664d]',
]

export function ContactAvatar({
  name,
  id,
  className,
}: {
  name: string
  id: string
  className?: string
}) {
  const color =
    colors[
      Array.from(id).reduce((sum, char) => sum + char.charCodeAt(0), 0) %
        colors.length
    ]
  const initials =
    name.startsWith('+') || name.startsWith('Чат ')
      ? id.slice(-2)
      : name
          .split(/\s+/)
          .map((word) => word[0])
          .slice(0, 2)
          .join('')
          .toUpperCase()
  return (
    <Avatar className={cn('size-12', className)}>
      <AvatarFallback className={cn('font-semibold', color)}>
        {initials}
      </AvatarFallback>
    </Avatar>
  )
}
