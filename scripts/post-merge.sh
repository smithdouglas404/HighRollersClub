#!/bin/bash
set -e

npm install --legacy-peer-deps
npm run db:push 2>/dev/null || true
