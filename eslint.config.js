import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

// The backend and scripts. The web app in web/ has its own config.
export default defineConfig([
  globalIgnores(['web', 'convex/_generated']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      globals: globals.node,
    },
  },
])
