import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        vayroGold: '#D4AF37',
        vayroGoldDark: '#B8960C',
        vayroDark: '#0B0B0D',
        vayroCard: '#141414',
        vayroBorder: '#2A2A2A',
      },
    },
  },
  plugins: [],
};

export default config;
