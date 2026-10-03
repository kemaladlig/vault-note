import type { ImgHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export interface VaultNoteIconProps extends ImgHTMLAttributes<HTMLImageElement> {
  size?: number
}

/**
 * VaultNote official brand icon.
 * Renders the master high-resolution icon asset directly.
 */
export function VaultNoteIcon({ className, alt = 'VaultNote', size, ...props }: VaultNoteIconProps) {
  return (
    <img
      src="/vaultnote-icon.png"
      alt={alt}
      width={size}
      height={size}
      className={cn('size-8 rounded-[10px] shadow-e1 select-none object-cover', className)}
      {...props}
    />
  )
}
