import { cn } from '@/lib/utils'

function Kbd({ className, children, ...props }: React.ComponentProps<'kbd'>) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-[6px] border border-border bg-muted px-1.5 font-sans text-[11px] font-medium text-muted-foreground',
        className,
      )}
      {...props}
    >
      {children}
    </kbd>
  )
}

export { Kbd }
