# Presença+

Protótipo de controle de presença acadêmica com QR Code temporário e validação por geolocalização.

- **Frontend** (raiz do projeto): aplicação web do professor em React + TypeScript + Vite.
- **Backend** (`backend/`): API REST em Node.js + Express + TypeScript. Detalhes em [backend/README.md](backend/README.md).

## Executar

São dois terminais, um para cada parte:

```bash
# Terminal 1 – API em http://localhost:3333
cd backend
npm install
npm run dev

# Terminal 2 – aplicação web em http://localhost:5173
npm install
npm run dev
```

O Vite encaminha as chamadas de `/api` para o backend (veja `vite.config.ts`), então não é preciso configurar nada para desenvolver. Para usar uma API em outro endereço, defina `VITE_API_URL` (por exemplo, em um arquivo `.env.local`).

## Acesso de demonstração

| Perfil    | E-mail                                  | Senha    |
| --------- | --------------------------------------- | -------- |
| Professor | `professor@unesc.br`                    | `123456` |
| Alunos    | `aluno1@unesc.net` … `aluno12@unesc.net` | `123456` |

O portal web aceita apenas o professor. As contas de aluno servem para o aplicativo do aluno e para o teste disponível na tela de chamada.

## Funcionalidades

- Login do professor com token JWT; a sessão expirada volta para o login.
- Dashboard com turmas, presenças do dia, frequência dos últimos 7 dias e últimas chamadas.
- Abertura e encerramento de chamadas por turma, com o ponto de referência da sala (a última localização de cada turma fica salva).
- QR Code gerado pelo servidor e renovado a cada 30 segundos.
- Lista da turma atualizada em tempo real durante a chamada, com registro manual pelo professor.
- Validação feita no servidor: QR Code válido e não expirado, aluno matriculado na turma, raio de 20 metros e bloqueio de presença duplicada.
- Ao encerrar a chamada, os alunos sem registro passam a constar como ausentes.
- Consulta por aluno, matrícula, turma, situação e data, frequência por aluno na turma (com destaque abaixo de 75%) e exportação CSV.
- A localização é solicitada apenas quando o usuário aciona uma ação; não há rastreamento contínuo.

## Limites do protótipo

- O aplicativo Android do aluno ainda não existe. A API dele já está pronta (`POST /api/presencas` e `GET /api/alunos/me/presencas`), e a tela de chamada tem a opção "Testar o registro do aluno neste dispositivo", que executa exatamente esse fluxo.
- Os dados ficam em memória, com cópia em `backend/data/db.json`. A troca para PostgreSQL está preparada, mas não implementada (veja o README do backend).
- Não há telas de cadastro de professores, alunos e turmas: eles vêm dos dados de demonstração.
- Em computadores sem GPS a localização do navegador pode errar por mais de 20 m; a tela avisa a precisão e permite informar as coordenadas manualmente.
