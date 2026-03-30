#!/usr/bin/env bash
set -euo pipefail

payload="${1:-}"
if [ -z "$payload" ]; then
  exit 0
fi

mkdir -p /tmp
printf '%s\n' "$payload" >> /tmp/ubuntu-workbench-codex-events.jsonl
