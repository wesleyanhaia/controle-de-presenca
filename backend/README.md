# Presença+ · Backend

API REST do controle de presença, em Node.js + Express + TypeScript.

## Executar

```bash
npm install
npm run dev      # desenvolvimento, reinicia a cada alteração (http://localhost:3333/api)
npm test         # cenários de teste da proposta
npm run build    # compila para dist/
npm start        # executa a versão compilada
```

A configuração é opcional: copie `.env.example` para `.env` para alterar porta, segredo do JWT, validade do QR Code (30 s) e raio permitido (20 m).

## Estrutura

```
src/
  server.ts            inicia o servidor HTTP
  app.ts               monta o Express (CORS, JSON, rotas, erros)
  config.ts            variáveis de ambiente
  routes.ts            rotas e validação das entradas (zod)
  middlewares/         autenticação JWT e tratamento de erros
  services/            regras de negócio
    auth.ts            login e verificação do token
    presencas.ts       turmas, chamadas, presenças e frequência
    qr.ts              token temporário do QR Code
    geo.ts             distância entre coordenadas (Haversine)
  repositories/
    contracts.ts       interfaces de acesso a dados
    memory/            implementação em memória + dados de demonstração
    index.ts           escolhe a implementação usada
  domain/types.ts      entidades
database/schema.sql    esquema PostgreSQL
tests/api.test.ts      testes de ponta a ponta da API
```

## Rotas

Todas ficam sob `/api`. Exceto o login, exigem o cabeçalho `Authorization: Bearer <token>`.

| Método | Rota                              | Perfil    | Descrição                                                    |
| ------ | --------------------------------- | --------- | ------------------------------------------------------------ |
| POST   | `/auth/login`                     | —         | `{ email, senha }` → `{ token, usuario }`                     |
| GET    | `/auth/me`                        | qualquer  | Dados do usuário logado                                       |
| GET    | `/turmas`                         | professor | Turmas do professor                                           |
| GET    | `/turmas/:id/frequencia`          | professor | Presenças, faltas e percentual de cada aluno                  |
| GET    | `/chamadas`                       | professor | Chamadas realizadas, da mais recente para a mais antiga       |
| GET    | `/chamadas/ativa`                 | professor | Chamada aberta, QR Code atual e situação de cada aluno        |
| POST   | `/chamadas`                       | professor | `{ turmaId, latitude, longitude }` inicia uma chamada         |
| POST   | `/chamadas/:id/encerrar`          | professor | Encerra a chamada                                             |
| POST   | `/chamadas/:id/presencas/manual`  | professor | `{ alunoId }` registra presença manualmente                   |
| GET    | `/presencas`                      | professor | Registros (presente, ausente, pendente) de todas as chamadas  |
| POST   | `/presencas`                      | aluno     | `{ chamadaId, token, latitude, longitude }` registra presença |
| GET    | `/alunos/me/presencas`            | aluno     | Histórico de presenças e faltas do aluno                      |

Erros seguem o formato `{ "erro": { "codigo": "QR_EXPIRADO", "mensagem": "..." } }`. Códigos do registro de presença: `QR_INVALIDO`, `QR_EXPIRADO` (400), `SEM_PERMISSAO` (403, aluno fora da turma), `CHAMADA_ENCERRADA`, `PRESENCA_DUPLICADA` (409) e `FORA_DO_RAIO` (422).

### Integração com o aplicativo do aluno

O QR Code exibido ao professor contém o JSON `{ "chamadaId": "...", "token": "...", "expiraEm": 1790000000000 }`. O aplicativo faz login em `/auth/login`, lê o QR Code e envia `chamadaId`, `token` e a localização do aparelho para `POST /presencas`.

O token do QR Code não é gravado: é um HMAC do id da chamada com a janela de 30 segundos atual, então o código anterior deixa de valer assim que a janela muda.

## Dados e migração para o PostgreSQL

Hoje os dados ficam em memória e são copiados para `data/db.json` a cada alteração (apague o arquivo para voltar aos dados de demonstração). As faltas não são gravadas: aluno matriculado sem presença em uma chamada encerrada está ausente.

As regras de negócio só conhecem as interfaces de `src/repositories/contracts.ts`, e todos os métodos já são assíncronos. Para migrar:

1. Crie o banco e as tabelas com `database/schema.sql`.
2. Instale o driver (`npm install pg` e `npm install -D @types/pg`) ou um ORM.
3. Crie `src/repositories/postgres/` implementando `Repositorios`. `criar` de chamadas e de presenças deve lançar `ErroDeDuplicidade` quando o banco acusar violação de unicidade (código `23505`); os índices únicos já estão no esquema.
4. Em `src/repositories/index.ts`, retorne a implementação PostgreSQL quando `DATABASE_URL` estiver definida.
5. Insira professores, alunos, turmas e matrículas (as senhas são hashes `bcryptjs`).

Nada em `services/`, `routes.ts` ou no frontend precisa mudar.
