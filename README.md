E-mail: professor@unesc.br
Senha: 123456
# Presença+

Protótipo web para controle de presença acadêmica com autenticação simulada, QR Code temporário, validação de localização e consulta de registros.

## Executar

```bash
npm install
npm run dev
```

## Acesso de demonstração

- E-mail: `professor@unesc.br`
- Senha: `123456`

## Funcionalidades

- Dashboard com indicadores calculados dos registros locais.
- Abertura e encerramento de chamadas por turma.
- QR Code escaneável com token renovado a cada 30 segundos.
- Validação de presença de demonstração com raio de 20 metros e bloqueio de matrícula duplicada.
- Consulta e filtros por aluno, matrícula, turma, situação e data, com exportação CSV.
- Localização solicitada apenas quando o usuário aciona uma ação; não há rastreamento contínuo.

## Limites do protótipo

Este repositório contém somente a aplicação web do professor. Os dados de exemplo e as chamadas são salvos no `localStorage` deste navegador. A validação de presença disponível na tela de chamada é uma simulação local para testar as regras; o aplicativo Android do aluno, o backend Spring Boot, o MySQL, a autenticação segura e a sincronização entre dispositivos ainda precisam ser implementados. Portanto, o armazenamento local e o token do QR não devem ser usados como controle de presença em produção.
```

E-mail: professor@unesc.br
Senha: 123456
