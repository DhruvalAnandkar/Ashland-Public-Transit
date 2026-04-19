/** @type {import('tailwindcss').Config} */
module.exports = {
  // Class-based dark mode: we toggle a `dark` class on <html> via ThemeContext.
  darkMode: 'class',
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