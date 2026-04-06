import type { Config } from "tailwindcss";

const sansApple = [
  "var(--font-inter)",
  "-apple-system",
  "BlinkMacSystemFont",
  '"SF Pro Text"',
  '"SF Pro Display"',
  '"Helvetica Neue"',
  "Helvetica",
  "Arial",
  "sans-serif",
] as const;

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
  	container: {
  		center: true,
  		padding: '2rem',
  		screens: {
  			'2xl': '1400px'
  		}
  	},
  	extend: {
  		fontFamily: {
  			sans: [
                    ...sansApple
                ],
  			display: [
                    ...sansApple
                ],
  			mono: [
  				'var(--font-plex-mono)',
  				'IBM Plex Mono',
  				'ui-monospace',
  				'monospace'
  			]
  		},
  		fontSize: {
  			'display-hero': [
  				'3.5rem',
  				{
  					lineHeight: '1.07',
  					letterSpacing: '-0.28px',
  					fontWeight: '600'
  				}
  			],
  			'section-title': [
  				'2.5rem',
  				{
  					lineHeight: '1.1',
  					letterSpacing: '-0.28px',
  					fontWeight: '600'
  				}
  			],
  			'tile-title': [
  				'1.75rem',
  				{
  					lineHeight: '1.14',
  					letterSpacing: '0.196px',
  					fontWeight: '400'
  				}
  			],
  			'body-emphasis': [
  				'1.0625rem',
  				{
  					lineHeight: '1.24',
  					letterSpacing: '-0.374px',
  					fontWeight: '600'
  				}
  			],
  			caption: [
  				'0.875rem',
  				{
  					lineHeight: '1.29',
  					letterSpacing: '-0.224px'
  				}
  			],
  			micro: [
  				'0.75rem',
  				{
  					lineHeight: '1.33',
  					letterSpacing: '-0.12px'
  				}
  			]
  		},
  		colors: {
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			link: {
  				DEFAULT: 'hsl(var(--link))'
  			},
  			filter: {
  				DEFAULT: 'hsl(var(--filter-bg))'
  			},
  			header: {
  				DEFAULT: 'hsl(var(--header))',
  				foreground: 'hsl(var(--header-foreground))'
  			},
  			alert: {
  				warning: 'hsl(var(--alert-warning-bg))',
  				warningBorder: 'hsl(var(--alert-warning-border))',
  				success: 'hsl(var(--alert-success-bg))',
  				successBorder: 'hsl(var(--alert-success-border))',
  				error: 'hsl(var(--alert-error-bg))',
  				errorBorder: 'hsl(var(--alert-error-border))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)',
  			pill: '980px',
  			filter: '11px'
  		},
  		boxShadow: {
  			card: 'var(--shadow-card)'
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
