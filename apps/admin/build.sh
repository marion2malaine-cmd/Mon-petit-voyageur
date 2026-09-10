#!/bin/sh
set -eu
cd "$(dirname "$0")/../.."
npx esbuild apps/admin/main.tsx --bundle --format=esm --jsx=automatic --loader:.css=css '--define:import.meta.env.VITE_API_BASE_URL=""' --outfile=apps/admin/dist/app.js --minify
