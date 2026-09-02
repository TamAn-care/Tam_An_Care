#!/bin/bash
set -e
cd "$(dirname "$0")"
if ! docker info >/dev/null 2>&1; then echo "Please start Docker Desktop first."; exit 1; fi
docker compose up --build
