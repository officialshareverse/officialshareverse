/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          dark: "#003b2b",
          DEFAULT: "#004b3b",
          light: "#34d399",
        }
      }
    },
  },
  plugins: [],
};
