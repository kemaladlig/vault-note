import { Lock } from 'lucide-react'
import { useState, type ImgHTMLAttributes } from 'react'

import { cn } from '@/lib/utils'

export interface VaultNoteIconProps extends ImgHTMLAttributes<HTMLImageElement> {
  size?: number
}

const BOX = 'size-8 rounded-md shadow-e1 ring-1 ring-foreground/10 select-none'

/**
 * VaultNote official brand icon.
 * Renders the master high-resolution icon asset directly, falling back to a
 * neutral lock mark if the asset fails to load (no broken-image flash).
 */
export function VaultNoteIcon({ className, alt = 'VaultNote', size, onError, ...props }: VaultNoteIconProps) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <span
        role="img"
        aria-label={alt}
        style={{ width: size, height: size }}
        className={cn(BOX, 'grid place-items-center bg-primary text-primary-foreground', className)}
      >
        <Lock className="size-1/2" aria-hidden />
      </span>
    )
  }

  return (
    <img
      src="/pwa-192.png"
      alt={alt}
      width={size}
      height={size}
      className={cn(BOX, className)}
      onError={(event) => {
        setFailed(true)
        onError?.(event)
      }}
      {...props}
    />
  )
}
