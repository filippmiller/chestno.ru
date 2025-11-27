import * as React from 'react'
import * as LabelPrimitive from '@radix-ui/react-label'
import {
  Controller,
  FormProvider,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
  type UseFormReturn,
} from 'react-hook-form'

import { cn } from '@/lib/utils'

const Form = <TFieldValues extends FieldValues = FieldValues>({
  children,
  ...form
}: UseFormReturn<TFieldValues> & { children: React.ReactNode }) => {
  return <FormProvider {...form}>{children}</FormProvider>
}

const FormField = <TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>({
  ...props
}: ControllerProps<TFieldValues, TName>) => {
  return <Controller {...props} />
}

const FormItem = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('space-y-2', className)} {...props} />
  ),
)
FormItem.displayName = 'FormItem'

const FormLabel = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => {
  return (
    <LabelPrimitive.Root ref={ref} className={cn('text-sm font-medium', className)} {...props} />
  )
})
FormLabel.displayName = 'FormLabel'

const FormControl = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('space-y-1', className)} {...props} />
  ),
)
FormControl.displayName = 'FormControl'

const FormDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
))
FormDescription.displayName = 'FormDescription'

const FormMessage = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, children, ...props }, ref) => {
  if (!children) return null
  return (
    <p ref={ref} className={cn('text-sm font-medium text-destructive', className)} {...props}>
      {children}
    </p>
  )
})
FormMessage.displayName = 'FormMessage'

export { Form, FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage }

