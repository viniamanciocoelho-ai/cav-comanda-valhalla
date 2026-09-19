#!/bin/sh
set -eu

bun packages/web/scripts/deploy-setup.ts
exec bun packages/web/src/server.ts
