import type { AnchorHTMLAttributes, ButtonHTMLAttributes, PropsWithChildren } from 'react';
import { cn } from '@/lib/utils';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
type ButtonElement = 'button' | 'a';

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'border border-emerald-300/20 bg-linear-to-r from-emerald-300 to-teal-300 text-slate-950 shadow-lg shadow-emerald-950/30 hover:from-emerald-200 hover:to-cyan-200',
  secondary:
    'border border-white/10 bg-white/6 text-slate-100 shadow-lg shadow-black/15 hover:border-white/16 hover:bg-white/10',
  ghost:
    'border border-transparent bg-transparent text-slate-100 hover:border-white/8 hover:bg-white/6',
  destructive:
    'border border-red-300/35 bg-linear-to-r from-red-600 to-rose-600 text-white shadow-lg shadow-red-950/35 hover:from-red-500 hover:to-rose-500'
};

type CommonButtonProps = {
  variant?: ButtonVariant;
  as?: ButtonElement;
};

type ButtonProps =
  | PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement> & CommonButtonProps>
  | PropsWithChildren<AnchorHTMLAttributes<HTMLAnchorElement> & CommonButtonProps>;

export function Button({ children, className, variant = 'primary', as = 'button', ...props }: ButtonProps) {
  const classes = cn(
    'inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold tracking-[0.01em] transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60',
    variantClasses[variant],
    className
  );

  if (as === 'a') {
    const anchorProps = props as AnchorHTMLAttributes<HTMLAnchorElement>;

    return (
      <a className={classes} {...anchorProps}>
        {children}
      </a>
    );
  }

  const buttonProps = props as ButtonHTMLAttributes<HTMLButtonElement>;

  return (
    <button className={classes} {...buttonProps}>
      {children}
    </button>
  );
}
