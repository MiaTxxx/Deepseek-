/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        dark: {
          bg: '#16161E',
          panel: '#1E1E2E',
          border: '#2A2A3E',
          text: '#C0CAF5',
          muted: '#565F89'
        },
        neon: {
          blue: '#3D59AB',
          purple: '#9D7CD8',
          yellow: '#E0AF68',
          cyan: '#7DCFFF',
          green: '#9ECE6A',
          orange: '#FF9E64',
          red: '#F7768E'
        }
      },
      fontFamily: {
        sans: ['Inter', '"PingFang SC"', '"Microsoft YaHei"', 'sans-serif']
      },
      boxShadow: {
        neon: '0 0 15px -3px rgba(61, 89, 171, 0.4)',
        glass: '0 8px 32px 0 rgba(0, 0, 0, 0.37)'
      }
    }
  },
  plugins: []
};
