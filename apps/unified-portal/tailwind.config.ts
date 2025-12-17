import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./contexts/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  safelist: [
    // Critical mobile navigation classes - NEVER purge these
    'fixed', 'bottom-0', 'left-0', 'right-0', 'z-50',
    'md:hidden', 'hidden', 'md:block',
    'bg-white', 'bg-gray-900', 'bg-opacity-90', 'backdrop-blur-xl',
    'border-t', 'border-gray-200', 'border-white/10',
    'flex', 'items-center', 'justify-around', 'justify-center',
    'h-20', 'h-24', 'pb-4', 'px-2',
    'text-gold-400', 'text-gray-400', 'text-gray-500',
    'active:scale-95', 'transition-all', 'duration-150',
    // Ensure gold colors are available
    'text-[#D4AF37]', 'bg-gold-500', 'bg-gold-50',
  ],
  theme: {
    extend: {
      colors: {
        // OpenHouse Premium Brand Colors
        white: '#FFFFFF',
        black: {
          DEFAULT: '#0C0C0C',
          pure: '#000000',
          matte: '#0C0C0C',
        },
        gold: {
          50: '#FDF8E8',   // Very light gold tint
          100: '#FAF0D1',  // Light gold cream
          200: '#F5E2AA',  // Soft gold
          300: '#EED07C',  // Warm gold
          400: '#E5BC4E',  // Medium gold
          500: '#D4AF37',  // Primary premium gold
          600: '#C9A961',  // Darker gold
          700: '#B8934C',  // Deep gold
          800: '#A67C3A',  // Rich gold
          900: '#8B6428',  // Dark gold
          950: '#6B4E1C',  // Very dark gold
        },
        grey: {
          50: '#F9FAFB',
          100: '#F3F4F6',
          200: '#E5E7EB',
          300: '#D1D5DB',
          400: '#9CA3AF',
          500: '#6B7280',
          600: '#4B5563',
          700: '#374151',
          800: '#1F2937',
          900: '#111827',
        },
        border: 'var(--border)',
        bg: 'var(--bg)',
        'surface-1': 'var(--surface-1)',
        'surface-2': 'var(--surface-2)',
        'text-1': 'var(--text-1)',
        'text-2': 'var(--text-2)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        serif: ['Source Serif 4', 'Georgia', 'Cambria', 'Times New Roman', 'serif'],
      },
      fontSize: {
        'display-lg': ['4rem', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '700' }],
        'display': ['3rem', { lineHeight: '1.15', letterSpacing: '-0.02em', fontWeight: '700' }],
        'heading-xl': ['2.5rem', { lineHeight: '1.2', letterSpacing: '-0.01em', fontWeight: '600' }],
        'heading-lg': ['2rem', { lineHeight: '1.25', letterSpacing: '-0.01em', fontWeight: '600' }],
        'heading-md': ['1.5rem', { lineHeight: '1.3', fontWeight: '600' }],
        'heading-sm': ['1.25rem', { lineHeight: '1.4', fontWeight: '600' }],
        'body-lg': ['1.125rem', { lineHeight: '1.6', fontWeight: '400' }],
        'body': ['1rem', { lineHeight: '1.6', fontWeight: '400' }],
        'body-sm': ['0.875rem', { lineHeight: '1.5', fontWeight: '400' }],
        'caption': ['0.75rem', { lineHeight: '1.4', fontWeight: '500' }],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      borderRadius: {
        'premium': '12px',
        'card': '10px',
      },
      boxShadow: {
        'premium': '0 4px 20px rgba(212, 175, 55, 0.08)',
        'premium-lg': '0 8px 32px rgba(212, 175, 55, 0.12)',
        'card': '0 2px 12px rgba(12, 12, 12, 0.04)',
        'card-hover': '0 4px 24px rgba(12, 12, 12, 0.08)',
        'gold-glow': '0 0 20px rgba(212, 175, 55, 0.3)',
      },
      animation: {
        'fadeIn': 'fadeIn 0.3s ease-out forwards',
        'fade-in': 'fadeIn 0.25s ease-out',
        'slide-up': 'slideUp 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)',
        'slide-down': 'slideDown 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)',
        'scale-in': 'scaleIn 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)',
        'shimmer': 'shimmer 2s infinite',
        'pulse': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
      },
      transitionDuration: {
        'premium': '250ms',
      },
      transitionTimingFunction: {
        'premium': 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      },
    },
  },
  plugins: [],
};
export default config;
