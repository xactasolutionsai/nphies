#!/bin/bash
set -euo pipefail
install -d /usr/share/postgresql-common/pgdg
curl --fail --silent --show-error -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc https://www.postgresql.org/media/keys/ACCC4CF8.asc
cat > /etc/apt/sources.list.d/pgdg.sources <<'EOF'
Types: deb
URIs: https://apt.postgresql.org/pub/repos/apt
Suites: noble-pgdg
Architectures: amd64
Components: main
Signed-By: /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc
EOF
apt-get update -qq
DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a apt-get install -y -qq postgresql-18 postgresql-client-18 postgresql-18-pgvector
pg_lsclusters
