/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#16A34A',
          hover: '#15803D',
          light: '#F0FDF4',
        },
        accent: '#F59E0B',
        ink: '#1F2937',
        muted: '#6B7280',
        danger: '#DC2626',
        line: '#E5E7EB',
      },
      fontFamily: {
        sans: ['Inter', 'Noto Sans Devanagari', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.06)',
        lift: '0 4px 12px rgba(0,0,0,0.10), 0 12px 28px rgba(0,0,0,0.08)',
      },
      borderRadius: {
        card: '1rem',
      },
    },
  },
  plugins: [],
};
