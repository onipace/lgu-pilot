import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        // PILLAR brand tokens
        "pillar-bg": "hsl(var(--pillar-bg))",
        "pillar-surface": "hsl(var(--pillar-surface))",
        "pillar-surface-alt": "hsl(var(--pillar-surface-alt))",
        "pillar-primary": "hsl(var(--pillar-primary))",
        "pillar-teal": "hsl(var(--pillar-teal))",
        "pillar-gold": "hsl(var(--pillar-gold))",
        "pillar-text": "hsl(var(--pillar-text))",
        "pillar-muted": "hsl(var(--pillar-muted))",
        "pillar-border": "hsl(var(--pillar-border))",
        // Module accents
        "ella-accent": "hsl(var(--ella-accent))",
        "obra-accent": "hsl(var(--obra-accent))",
        "yala-accent": "hsl(var(--yala-accent))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "Inter", "sans-serif"],
      },
      backgroundImage: {
        "pillar-hero": "var(--pillar-hero-gradient)",
        "pillar-card": "var(--pillar-card-gradient)",
        "ella-card": "var(--ella-card-gradient)",
        "obra-card": "var(--obra-card-gradient)",
        "yala-card": "var(--yala-card-gradient)",
      },
      boxShadow: {
        "pillar-glow": "var(--pillar-glow)",
        "ella-glow": "var(--ella-glow)",
        "obra-glow": "var(--obra-glow)",
        "yala-glow": "var(--yala-glow)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in": {
          from: { opacity: "0", transform: "translateX(-12px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        pulse: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.4s ease-out",
        "slide-in": "slide-in 0.3s ease-out",
        shimmer: "shimmer 2s infinite linear",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
