#!/bin/bash

# Development environment variables
export NODE_ENV=development
export AWS_REGION=ap-northeast-1
export DYNAMODB_ENDPOINT=http://localhost:8000
export FEATURE_FLAGS_TABLE_NAME=feature-flags
export PORT=3001

# Start the simplified API server
npm run dev