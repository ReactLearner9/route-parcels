import type { PropsWithChildren, HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type CardProps = PropsWithChildren<HTMLAttributes<HTMLDivElement>>;

export function Card({ children, className, ...props }: CardProps) {
  return (
    <div
      className={cn('rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/20', className)}
      {...props}
    >
      {children}
    </div>
  );
}
