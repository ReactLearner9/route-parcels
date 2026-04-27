import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}', './docs/**/*.{md,mdx}'],
  theme: {
    extend: {}
  }
} satisfies Config;
