# Presença+

Protótipo de controle de presença acadêmica com QR Code temporário e validação por geolocalização.

- **Frontend** (raiz do projeto): aplicação web do professor em React + TypeScript + Vite.
- **Aplicativo do aluno** (`mobile/`): React Native + Expo + TypeScript, para Android. Detalhes em [mobile/README.md](mobile/README.md).
- **Publicação na AWS** (`deploy/`): scripts e passo a passo para colocar tudo num servidor com https. Veja [deploy/README.md](deploy/README.md).
- **Backend** (`backend/`): API REST em Node.js + Express + TypeScript, com banco PostgreSQL. Detalhes em [backend/README.md](backend/README.md).

## Executar

São dois terminais para a parte web (e um terceiro para o aplicativo, veja [mobile/README.md](mobile/README.md)):

```bash
# Terminal 1 – API em http://localhost:3333
cd backend
npm install
npm run db:setup   # uma vez: cria o banco PostgreSQL (configuração em backend/.env)
npm run dev

# Terminal 2 – aplicação web em http://localhost:5173
npm install
npm run dev
```

O Vite encaminha as chamadas de `/api` para o backend (veja `vite.config.ts`), então não é preciso configurar nada para desenvolver. Para usar uma API em outro endereço, defina `VITE_API_URL` (por exemplo, em um arquivo `.env.local`).

## Acesso de demonstração

| Perfil    | Acesso                                                          | Senha    |
| --------- | --------------------------------------------------------------- | -------- |
| Professor | e-mail `professor@unesc.br` (site)                              | `123456` |
| Alunos    | matrícula `1` a `12` (aplicativo) ou `aluno1@unesc.net` … `aluno12@unesc.net` | `123`    |

O portal web aceita apenas o professor. As contas de aluno servem para o aplicativo do aluno (matrícula 1 = Ana Paula, 2 = Bruno, e assim por diante) e para o teste disponível na tela de chamada. Os dados de demonstração começam sem chamadas, presenças ou faltas.

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

- Os cadastros de professores, alunos, turmas e matrículas existem na API (CRUD), mas ainda não há telas para eles na aplicação web.
- Em computadores sem GPS a localização do navegador pode errar por mais de 20 m; a tela avisa a precisão e permite informar as coordenadas manualmente.
