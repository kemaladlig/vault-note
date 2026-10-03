import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-secondary text-secondary-foreground',
        primary: 'border-transparent bg-accent text-accent-foreground',
        success:
          'border-transparent bg-[color-mix(in_srgb,var(--success)_16%,transparent)] text-[var(--success)]',
        warning:
          'border-transparent bg-[color-mix(in_srgb,var(--warning)_18%,transparent)] text-[var(--warning)]',
        destructive:
          'border-transparent bg-[color-mix(in_srgb,var(--destructive)_14%,transparent)] text-[var(--destructive)]',
        outline: 'border-border text-muted-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge }
