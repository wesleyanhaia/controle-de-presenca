#!/usr/bin/env bash
# Monta o endereço https do sistema a partir do IP público do servidor
# (ex.: IP 54.232.10.20 -> https://54-232-10-20.sslip.io) e configura o Caddy.
#
# O sslip.io é um serviço de DNS gratuito que aponta "54-232-10-20.sslip.io"
# para o IP 54.232.10.20, o que permite ter https sem comprar um domínio.
# Executado a cada inicialização (presenca-dominio.service), porque parar e
# iniciar o servidor sem IP fixo (Elastic IP) troca o IP.
set -euo pipefail

METADADOS=http://169.254.169.254/latest
TOKEN=$(curl -fsS --retry 10 --retry-connrefused --retry-delay 2 -X PUT "$METADADOS/api/token" \
  -H 'X-aws-ec2-metadata-token-ttl-seconds: 60')
IP=$(curl -fsS --retry 10 --retry-delay 2 -H "X-aws-ec2-metadata-token: $TOKEN" "$METADADOS/meta-data/public-ipv4")
DOMINIO="${IP//./-}.sslip.io"

cat > /etc/caddy/Caddyfile <<EOF
# Gerado por deploy/dominio.sh a cada inicialização.
$DOMINIO {
	encode gzip
	reverse_proxy localhost:3333
}

# Quem digitar só o IP no navegador é levado ao endereço https.
http://$IP {
	redir https://$DOMINIO{uri}
}
EOF

echo "https://$DOMINIO" > /etc/presenca-endereco
echo "[presenca] Endereço do sistema: https://$DOMINIO"
