/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0a0c10',
        card: '#11141a',
        border: '#1f242c',
        primary: '#3b82f6',
      },
      fontFamily: {
        mono: ['DM Mono', 'monospace'],
        sans: ['Syne', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
