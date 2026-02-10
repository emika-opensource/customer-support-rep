#!/bin/bash
cd /home/node/app
npm install 2>/dev/null || true
exec node server.js
