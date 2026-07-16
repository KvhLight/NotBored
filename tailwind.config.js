/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
	theme:{
		extend:{
			colors:{
				'app-bg':	'var(--color-app-bg)',
				'card-bg':	'var(--color-card-bg)',
	  		'accent':	'var(--color-accent)',
				'accent-2':	'var(--color-accent-2)',
				'msg-user':	'var(--color-msg-user)',
				'msg-ai':	'var(--color-msg-ai)',
			},
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.4s ease-out',
      },
      keyframes: {
        fadeIn: { 
          '0%': { opacity: 0 }, 
          '100%': { opacity: 1 } 
        },
        slideUp: { 
          '0%': { transform: 'translateY(20px)', opacity: 0 },
          '100%': { transform: 'translateY(0)', opacity: 1 } 
        },
      },
    },
  },
  plugins: [],
};