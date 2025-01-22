module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./index.html"
  ],
  theme: {
    extend: {
      colors: {
        primary: '#007AFF',
        danger: '#FF3B30',
        background: 'rgba(255, 255, 255, 0.95)'
      },
      animation: {
        'expand': 'expand 0.3s ease-out',
        'collapse': 'collapse 0.3s ease-in'
      },
      keyframes: {
        expand: {
          '0%': { height: '48px' },
          '100%': { height: '400px' }
        },
        collapse: {
          '0%': { height: '400px' },
          '100%': { height: '48px' }
        }
      }
    },
  },
  plugins: [],
}
