#!/bin/bash
echo "🔄 Running database migrations..."
node migrate.js
echo "🚀 Starting server..."
node server.js