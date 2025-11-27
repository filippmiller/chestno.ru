import * as React from 'react'

import { cn } from '@/lib/utils'

export type CheckboxProps = React.InputHTMLAttributes<HTMLInputElement>

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, ...props }, ref) => (
    <input
      type="checkbox"
      ref={ref}
      className={cn(
        'h-4 w-4 rounded border border-input text-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        className,
      )}
      {...props}
    />
  ),
)

Checkbox.displayName = 'Checkbox'

