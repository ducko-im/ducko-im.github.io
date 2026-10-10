import js from '@eslint/js';
import astro from 'eslint-plugin-astro';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(globalIgnores(['dist', '.astro', '.turbo']), js.configs.recommended, tseslint.configs.recommended, astro.configs.recommended);
