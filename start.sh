#!/bin/bash

set -e
cd "$(dirname "$0")"

echo "========================================="
echo " Uniot Linux Starter"
echo "========================================="

echo "[1/2] Installing dependencies (npm install)..."
npm install

echo ""
echo "[2/2] Starting application (npm start)..."
npm start
