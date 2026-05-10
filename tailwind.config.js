/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: {
          50: '#FDFBF7',
          100: '#FAF6EF',
          200: '#F5EEE0',
          300: '#EBDFC7',
          400: '#D9C5A0',
          500: '#C4A878'
        },
        warm: {
          50: '#FBF8F3',
          100: '#F6F1E8',
          200: '#ECE3D1',
          300: '#DCCDB0',
          600: '#8B7355',
          700: '#6B5842',
          800: '#4A3E2E',
          900: '#2E2620'
        },
        accent: {
          peach: '#F4B183',
          terracotta: '#D78B5C',
          sage: '#A8B89D',
          dusty: '#C4A78F'
        }
      },
      fontFamily: {
        sans: ['Inter', '"PingFang SC"', '"Microsoft YaHei"', 'sans-serif']
      },
      boxShadow: {
        soft: '0 4px 20px -4px rgba(139, 115, 85, 0.12)',
        warm: '0 8px 30px -8px rgba(215, 139, 92, 0.25)'
      }
    }
  },
  plugins: []
};
