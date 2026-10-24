# Publicar o Presença+ na AWS

Este guia coloca o sistema inteiro num servidor da AWS (EC2), acessível de qualquer rede, inclusive 3G/4G, com `https`:

```
Internet ──https──► Servidor EC2 (Ubuntu 24.04, região São Paulo)
                     ├─ Caddy: https automático
                     ├─ Backend Node: site do professor + /api
                     └─ PostgreSQL
```

O endereço do sistema é montado a partir do IP do servidor, pelo serviço gratuito sslip.io. Por exemplo, para o IP `54.232.10.20`, o endereço é **`https://54-232-10-20.sslip.io`**.

Os scripts desta pasta fazem a instalação sozinhos:

| Script | Função |
| --- | --- |
| `instalar.sh` | Instala PostgreSQL, Node.js e Caddy, baixa o código do GitHub, compila, cria o banco e os segredos e configura os serviços. |
| `dominio.sh` | A cada vez que o servidor liga, recalcula o endereço `https` a partir do IP. |
| `atualizar.sh` | Baixa a versão mais recente do GitHub e reinicia o sistema. |

## 1. Criar a conta (uma vez)

1. Acesse [aws.amazon.com/free](https://aws.amazon.com/free) e crie a conta. Escolha o **Free plan** (plano gratuito). A AWS normalmente pede um cartão de crédito no cadastro.
2. No canto superior direito do painel, escolha a região **América do Sul (São Paulo) `sa-east-1`**. Assim os dados ficam no Brasil, o que vale citar na análise da LGPD.
3. **Crie um alerta de gastos.** Procure por **Budgets** na barra de busca, depois **Create budget** → modelo **Zero spend budget** (ou um "Monthly cost budget" de US$ 5) → informe o seu e-mail. Criar um orçamento é uma das tarefas que dão créditos extras.

## 2. Criar o servidor

No painel, procure por **EC2** → **Launch instance** (Executar instância) e preencha:

| Campo | Valor |
| --- | --- |
| **Name** | `presenca` |
| **Application and OS Images** | **Ubuntu** → **Ubuntu Server 24.04 LTS** |
| **Instance type** | Um tipo marcado como **Free tier eligible**. Prefira `t3.small` (2 GB) se aparecer; senão, `t3.micro`. |
| **Key pair** | **Create new key pair** → nome `presenca` → **Create**. Guarde o arquivo `.pem` baixado; é a chave de acesso ao servidor. |
| **Network settings** | Marque **Allow SSH traffic**, **Allow HTTPS traffic from the internet** e **Allow HTTP traffic from the internet**. |
| **Configure storage** | `10` GiB, tipo **gp3**. |
| **Advanced details → User data** | Cole o texto abaixo. |

Texto do **User data**:

```bash
#!/bin/bash
git clone https://github.com/wesleyanhaia/controle-de-presenca.git /opt/presenca
bash /opt/presenca/deploy/instalar.sh
```

Clique em **Launch instance**. A instalação roda sozinha e leva de **5 a 10 minutos**.

> O servidor baixa o código do GitHub (branch `main`). Antes de criar o servidor, confirme que suas últimas alterações foram enviadas com "Sincronizar alterações".

## 3. Abrir o sistema

1. Em **EC2 → Instances**, clique no servidor `presenca` e copie o **Public IPv4 address**, por exemplo `54.232.10.20`.
2. Troque os pontos por traços e acrescente `.sslip.io`: **`https://54-232-10-20.sslip.io`**.
3. Abra esse endereço no navegador. O primeiro acesso pode levar até um minuto, enquanto o certificado `https` é gerado.
4. Entre com `professor@unesc.br` e a senha `123456`.

No app do aluno, toque em **Sair**, depois em **Alterar servidor**, cole o endereço `https://...sslip.io` e toque em **Testar e salvar**. Agora o app funciona em qualquer rede, inclusive 4G.

### Acompanhar a instalação ou ver erros

Em **EC2 → Instances**, selecione o servidor → **Connect** → aba **EC2 Instance Connect** → **Connect**. Abre um terminal no navegador. Comandos úteis:

```bash
sudo tail -f /var/log/cloud-init-output.log   # andamento da instalação (Ctrl+C para sair)
cat /etc/presenca-endereco                     # endereço do sistema
sudo journalctl -u presenca-api -n 50          # registros do backend
sudo systemctl status presenca-api caddy       # situação dos serviços
```

A instalação terminou quando aparecer `[presenca] Instalação concluída. Endereço do sistema: https://...`.

## 4. Ligar e desligar para economizar créditos

Em **EC2 → Instances**, selecione o servidor → **Instance state**:

- **Stop instance** (Parar): desliga. Os dados ficam guardados, e para de cobrar pelo processamento; só o disco continua sendo cobrado, um valor pequeno.
- **Start instance** (Iniciar): liga de novo em 1 ou 2 minutos.
- **Nunca use "Terminate instance" (Encerrar)**: isso apaga o servidor e o banco para sempre.

**Sem IP fixo, o IP muda a cada vez que o servidor é iniciado**, e o endereço `https` muda junto. O servidor recalcula o endereço sozinho; basta copiar o novo IP no painel e usar **Alterar servidor** no app.

### IP fixo (para os testes em sala e a defesa)

Para o endereço nunca mudar: **EC2 → Elastic IPs → Allocate Elastic IP address → Allocate**. Depois, **Actions → Associate Elastic IP address** → escolha o servidor `presenca` → **Associate**. O endereço passa a ser o desse IP. O Elastic IP tem um custo pequeno, inclusive com o servidor parado. Quando o TCC terminar, use **Release** para liberá-lo.

## 5. Atualizar o sistema depois de mudar o código

Envie as alterações para o GitHub ("Sincronizar alterações"). Depois, no terminal do servidor (EC2 Instance Connect):

```bash
sudo bash /opt/presenca/deploy/atualizar.sh
```

Os dados do banco são mantidos. Mudanças no app do aluno continuam exigindo um APK novo (veja `mobile/README.md`).

## Cuidados

- **Senhas de demonstração na internet:** com o sistema publicado, qualquer pessoa que souber o endereço pode tentar entrar com `professor@unesc.br` / `123456`. Para os testes, troque a senha do professor (`PUT /api/professores/1`, ou peça ajuda). Use apenas dados fictícios ou de voluntários que concordaram em participar.
- **Segredos:** a senha do banco e o `JWT_SECRET` são gerados no próprio servidor, em `/opt/presenca/backend/.env`, e não vão para o GitHub.
- **Créditos:** no Free plan, a conta fecha depois de 6 meses ou quando os créditos acabam. Acompanhe em **Billing → Credits**.
