/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ashland: {
          blue: '#1e40af',
          light: '#eff6ff',
          gold: '#fbbf24',
        }
      }
    },
  },
  plugins: [],
}