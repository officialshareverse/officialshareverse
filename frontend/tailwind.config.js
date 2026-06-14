/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          dark: "#003b2b",
          DEFAULT: "#004b3b",
          light: "#34d399",
        }
      },
      borderRadius: {
        '4xl': '32px',
      }
    },
  },
  plugins: [],
};
