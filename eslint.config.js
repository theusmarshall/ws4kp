import js from '@eslint/js';
import globals from 'globals';

export default [
	js.configs.recommended,
	{
		languageOptions: {
			ecmaVersion: 'latest',
			sourceType: 'module',
			globals: {
				...globals.browser,
				...globals.node,
				...globals.es2021,
				// Custom globals from vendor scripts
				TravelCities: 'readonly',
				RegionalCities: 'readonly',
				StationInfo: 'readonly',
				SunCalc: 'readonly',
				NoSleep: 'readonly',
			},
		},
		rules: {
			// Indentation with tabs
			indent: ['error', 'tab', { SwitchCase: 1 }],
			'no-tabs': 'off',

			// Allow console
			'no-console': 'off',

			// No max line length
			'max-len': 'off',

			// Allow using variables before definition (for hoisted functions)
			'no-use-before-define': ['error', { variables: false }],

			// Allow param reassignment for properties
			'no-param-reassign': ['error', { props: false }],

			// Mixed operators config
			'no-mixed-operators': ['error', {
				groups: [
					['&', '|', '^', '~', '<<', '>>', '>>>'],
					['==', '!=', '===', '!==', '>', '>=', '<', '<='],
					['&&', '||'],
					['in', 'instanceof'],
				],
				allowSamePrecedence: true,
			}],
		},
	},
	{
		// Ignore patterns
		ignores: [
			'*.min.js',
			'*.min.mjs',
			'server/scripts/vendor/**',
			'dist/**',
			'node_modules/**',
		],
	},
];
