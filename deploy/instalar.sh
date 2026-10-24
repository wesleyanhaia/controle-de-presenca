#!/usr/bin/env bash
# Instala o Presença+ (site do professor, API e PostgreSQL) num servidor
# Ubuntu 24.04 da AWS (EC2). Executado como root, normalmente pelo "User data"
# na criação do servidor (veja deploy/README.md).
#
# Pode ser executado de novo: mantém o .env (segredos) e os dados do banco.
set -euo pipefail

DIR=/opt/presenca
REPOSITORIO=https://github.com/wesleyanhaia/controle-de-presenca.git
USUARIO=presenca

log() { echo "[presenca] $*"; }

export DEBIAN_FRONTEND=noninteractive

# ---------------------------------------------------------------- memória
# Servidores pequenos (1 GB) ficam sem memória ao compilar o site; 2 GB de
# swap evitam isso.
if ! swapon --show | grep -q /swapfile; then
  log "Criando 2 GB de swap"
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# ---------------------------------------------------------------- programas
log "Instalando PostgreSQL, Node.js 24 e Caddy"
apt-get update -q
apt-get install -y -q ca-certificates curl gnupg git openssl postgresql debian-keyring debian-archive-keyring apt-transport-https

if ! command -v node >/dev/null || ! node --version | grep -q '^v24\.'; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt-get install -y -q nodejs
fi

if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -q
  apt-get install -y -q caddy
fi

# ---------------------------------------------------------------- código
id "$USUARIO" >/dev/null 2>&1 || useradd --system --create-home --shell /usr/sbin/nologin "$USUARIO"

if [ ! -d "$DIR/.git" ]; then
  log "Baixando o código de $REPOSITORIO"
  git clone --depth 1 "$REPOSITORIO" "$DIR"
fi
chown -R "$USUARIO:$USUARIO" "$DIR"

# ---------------------------------------------------------------- banco e segredos
ENV="$DIR/backend/.env"
if [ ! -f "$ENV" ]; then
  log "Criando o banco PostgreSQL e os segredos"
  SENHA_DO_BANCO=$(openssl rand -hex 24)
  sudo -u postgres psql -v ON_ERROR_STOP=1 -q <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$USUARIO') THEN
    CREATE ROLE $USUARIO LOGIN PASSWORD '$SENHA_DO_BANCO';
  ELSE
    ALTER ROLE $USUARIO PASSWORD '$SENHA_DO_BANCO';
  END IF;
END \$\$;
SQL
  sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname = 'presenca'" | grep -q 1 \
    || sudo -u postgres createdb --owner "$USUARIO" presenca

  cat > "$ENV" <<EOF
# Gerado por deploy/instalar.sh. Não vai para o Git.
NODE_ENV=production
PORT=3333
JWT_SECRET=$(openssl rand -base64 48 | tr -d '\n')
DATABASE_URL=postgres://$USUARIO:$SENHA_DO_BANCO@localhost:5432/presenca
# O backend entrega também o site do professor (compilado em ../dist).
PASTA_SITE=../dist
QR_VALIDADE_SEGUNDOS=30
RAIO_PERMITIDO_METROS=20
EOF
  chown "$USUARIO:$USUARIO" "$ENV"
  chmod 600 "$ENV"
fi

# ---------------------------------------------------------------- compilação
log "Instalando dependências e compilando (alguns minutos)"
sudo -u "$USUARIO" -H bash -c "
  set -euo pipefail
  cd '$DIR'
  npm ci --no-audit --no-fund
  npm run build
  cd backend
  npm ci --no-audit --no-fund
  npm run build
  node dist/repositories/postgres/setup.js
"

# ---------------------------------------------------------------- serviços
log "Configurando os serviços"
cat > /etc/systemd/system/presenca-api.service <<EOF
[Unit]
Description=Presença+ (API e site do professor)
After=network.target postgresql.service
Requires=postgresql.service

[Service]
User=$USUARIO
WorkingDirectory=$DIR/backend
Environment=NODE_ENV=production
ExecStart=/usr/bin/node dist/server.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

# A cada inicialização o IP público pode mudar; este serviço recalcula o
# endereço https (IP.sslip.io) antes de o Caddy subir.
cat > /etc/systemd/system/presenca-dominio.service <<EOF
[Unit]
Description=Presença+: endereço https a partir do IP público
Wants=network-online.target
After=network-online.target
Before=caddy.service

[Service]
Type=oneshot
ExecStart=/bin/bash $DIR/deploy/dominio.sh

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now presenca-api.service
systemctl enable presenca-dominio.service caddy.service
systemctl start presenca-dominio.service
systemctl restart caddy.service

# ---------------------------------------------------------------- conferência
for _ in $(seq 1 30); do
  if curl -fsS http://localhost:3333/api/health >/dev/null 2>&1; then
    log "Instalação concluída. Endereço do sistema: $(cat /etc/presenca-endereco)"
    log "O certificado https pode levar até 1 minuto para ficar pronto no primeiro acesso."
    exit 0
  fi
  sleep 2
done

log "A API não respondeu. Veja os registros com: journalctl -u presenca-api -n 50"
exit 1
