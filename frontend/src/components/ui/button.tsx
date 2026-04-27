import type { AnchorHTMLAttributes, ButtonHTMLAttributes, PropsWithChildren } from 'react';
import { cn } from '@/lib/utils';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';
type ButtonElement = 'button' | 'a';

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-sky-400 text-slate-950 hover:bg-sky-300',
  secondary: 'bg-slate-800 text-slate-100 hover:bg-slate-700',
  ghost: 'bg-transparent text-slate-100 hover:bg-slate-900'
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
    'inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium transition-colors',
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
