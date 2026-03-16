/** @type {import('tailwindcss').Config} */
export default {
    content: [
      "./index.html",
      "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
      extend: {
        colors: {
          sentinel: {
            dark: '#0f172a',
            card: '#1e293b',
            accent: '#38bdf8',
            success: '#10b981'
          }
        }
      },
    },
    plugins: [],
  }