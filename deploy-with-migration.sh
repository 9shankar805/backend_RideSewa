#!/bin/bash

# Role Persistence Migration for Render Deployment
echo "🚀 Starting role persistence migration..."

# Run the migration
node migrate-role-persistence.js

# Start the server
echo "🔄 Starting server..."
npm start