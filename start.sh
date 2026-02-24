#!/bin/bash
fuser -k 5000/tcp 2>/dev/null
sleep 1
NODE_ENV=development exec npx tsx server/index.ts
