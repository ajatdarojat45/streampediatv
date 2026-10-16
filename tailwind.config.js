/**
 * Theme aliases for the CSS tokens in app/globals.css. Every colour, radius,
 * shadow and easing the UI uses is declared here — components reference the
 * alias (`text-live-ink`, `border-border-hover`, `rounded`, `shadow-md`) and
 * the light/dark value switches with the `data-theme` attribute, so a
 * component never needs a `[[data-theme=dark]_&]` override.
 */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Surfaces
        bg: 'var(--bg)',
        panel: 'var(--panel)',
        card: 'var(--card)',
        'surface-2': 'var(--surface-2)',
        'surface-3': 'var(--surface-3)',
        glass: 'var(--glass)',
        // Hairlines
        border: 'var(--border)',
        'border-soft': 'var(--border-soft)',
        'border-hover': 'var(--border-hover)',
        // Ink
        text: 'var(--text)',
        muted: 'var(--muted)',
        neutral: 'var(--neutral)',
        track: 'var(--track)',
        warn: 'var(--warn)',
        accent: 'var(--accent)',
        'accent-2': 'var(--accent-2)',
        'accent-soft': 'var(--accent-soft)',
        // Status tones: the fill, its hairline, and the ink that reads on it
        live: 'var(--live)',
        'live-ink': 'var(--live-ink)',
        'live-soft': 'var(--live-soft)',
        'live-border': 'var(--live-border)',
        'live-on': 'var(--live-on)',
        shimmer: 'var(--shimmer)',
        success: 'var(--success)',
        'success-ink': 'var(--success-ink)',
        'success-soft': 'var(--success-soft)',
        'success-border': 'var(--success-border)',
        'danger-ink': 'var(--danger-ink)',
        'danger-soft': 'var(--danger-soft)',
        'danger-border': 'var(--danger-border)',
        'warn-ink': 'var(--warn-ink)',
        'warn-soft': 'var(--warn-soft)',
        'warn-border': 'var(--warn-border)',
      },
      borderRadius: {
        // 14px panels · 10px cards/rows · 8px controls/badges
        DEFAULT: 'var(--radius)',
        lg: 'var(--radius-card)',
        sm: 'var(--radius-sm)',
      },
      boxShadow: {
        // 3 steps only: resting, card hover, floating (menus, dialogs)
        DEFAULT: 'var(--shadow)',
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
      },
      fontFamily: {
        mono: ["'SF Mono'", 'Menlo', 'Consolas', 'monospace'],
      },
      // One easing for the whole app — a calm ease-out instead of the browser
      // default, so every hover/lift/reveal resolves the same way.
      transitionTimingFunction: {
        DEFAULT: 'cubic-bezier(0.2, 0, 0, 1)',
      },
      keyframes: {
        blink: { '50%': { opacity: '0.25' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        blink: 'blink 1.2s infinite',
        shimmer: 'shimmer 1.4s infinite',
      },
    },
  },
  plugins: [],
};

