#!/usr/bin/env bash
# Atualiza o servidor com a versão mais recente do GitHub (main).
# Uso, no terminal do servidor:  sudo bash /opt/presenca/deploy/atualizar.sh
set -euo pipefail

DIR=/opt/presenca
USUARIO=presenca

sudo -u "$USUARIO" -H bash -c "
  set -euo pipefail
  cd '$DIR'
  git pull --ff-only
  npm ci --no-audit --no-fund
  npm run build
  cd backend
  npm ci --no-audit --no-fund
  npm run build
  # Cria tabelas novas, se houver; não apaga nem repete os dados.
  node dist/repositories/postgres/setup.js
"

systemctl restart presenca-api.service
echo "[presenca] Atualizado. Endereço: $(cat /etc/presenca-endereco)"
