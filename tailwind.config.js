/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#1c2a2e",
        paper: "#f4efe4",
        paper2: "#eae2d0",
        amber: "#bf7728",
        amberdark: "#9a5d1c",
        bottle: "#2d4a3e",
        bottlelight: "#3d6350",
        red: "#a8402a",
        line: "#d9cfb8",
      },
      fontFamily: {
        display: ["Fraunces", "serif"],
        sans: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
