# Presença+ · Backend

API REST do controle de presença, em Node.js + Express + TypeScript.

## Executar

```bash
npm install
npm run db:setup # cria o banco PostgreSQL, as tabelas e os dados de demonstração
npm run dev      # desenvolvimento, reinicia a cada alteração (http://localhost:3333/api)
npm test         # cenários de teste da proposta
npm run build    # compila para dist/
npm start        # executa a versão compilada
```

A configuração fica em `.env` (modelo em `.env.example`): conexão com o banco, porta, segredo do JWT, validade do QR Code (30 s) e raio permitido (20 m).

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
    cadastros.ts       CRUD de professores, alunos, turmas e matrículas
    presencas.ts       chamadas, presenças, frequência e tentativas
    qr.ts              token temporário do QR Code
    geo.ts             distância entre coordenadas (Haversine)
  repositories/
    contracts.ts       interfaces de acesso a dados
    memory/            implementação em memória + dados de demonstração
    postgres/          implementação PostgreSQL + script db:setup
    index.ts           escolhe a implementação usada
  domain/types.ts      entidades
database/schema.sql    esquema PostgreSQL (tabelas, índices e visões de relatório)
tests/api.test.ts      testes de ponta a ponta da API
```

## Rotas

Todas ficam sob `/api`. Exceto o login, exigem o cabeçalho `Authorization: Bearer <token>`.

| Método | Rota                              | Perfil    | Descrição                                                    |
| ------ | --------------------------------- | --------- | ------------------------------------------------------------ |
| POST   | `/auth/login`                     | —         | `{ email, senha }` → `{ token, usuario }`                     |
| POST   | `/auth/login/aluno`               | —         | `{ matricula, senha }` → `{ token, usuario }` (aplicativo)    |
| GET    | `/auth/me`                        | qualquer  | Dados do usuário logado                                       |
| GET    | `/turmas/:id/frequencia`          | professor | Presenças, faltas e percentual de cada aluno                  |
| GET    | `/chamadas`                       | professor | Chamadas realizadas, da mais recente para a mais antiga       |
| GET    | `/chamadas/ativa`                 | professor | Chamada aberta, QR Code atual e situação de cada aluno        |
| POST   | `/chamadas`                       | professor | `{ turmaId, latitude, longitude }` inicia uma chamada         |
| POST   | `/chamadas/:id/encerrar`          | professor | Encerra a chamada                                             |
| POST   | `/chamadas/:id/presencas/manual`  | professor | `{ alunoId }` registra presença manualmente                   |
| DELETE | `/chamadas/:id/presencas/:alunoId`| professor | Remove uma presença registrada por engano                     |
| DELETE | `/chamadas/:id`                   | professor | Exclui a chamada e as presenças dela                          |
| GET    | `/presencas`                      | professor | Registros (presente, ausente, pendente) de todas as chamadas  |
| GET    | `/relatorios/tentativas`          | professor | Tentativas de registro pelo app: total, % de sucesso, motivos |
| POST   | `/presencas`                      | aluno     | `{ chamadaId, token, latitude, longitude }` registra presença |
| GET    | `/alunos/me/presencas`            | aluno     | Histórico de presenças e faltas do aluno                      |

### Cadastros (CRUD)

Todas as rotas exigem o perfil professor. Exclusões respondem `204` sem corpo.

| Recurso     | Rotas                                                                                  | Corpo do POST (no PUT, todos os campos são opcionais)                  |
| ----------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Professores | `GET /professores`, `POST /professores`, `GET/PUT/DELETE /professores/:id`             | `{ nome, email, senha }`                                               |
| Alunos      | `GET /alunos?busca=`, `POST /alunos`, `GET/PUT/DELETE /alunos/:id`                     | `{ nome, matricula, email, senha }`                                    |
| Turmas      | `GET /turmas`, `POST /turmas`, `GET/PUT/DELETE /turmas/:id`                            | `{ codigo, nome, disciplina, semestre, local?, latitude?, longitude? }` |
| Matrículas  | `GET /turmas/:id/alunos`, `POST /turmas/:id/alunos`, `DELETE /turmas/:id/alunos/:alunoId` | `{ alunoId }`                                                       |

Regras:

- As turmas listadas e alteradas são sempre as do professor logado.
- Um professor só altera o próprio cadastro (PUT de outro id → 403) e não pode excluir a si mesmo.
- A senha tem no mínimo 6 caracteres e é gravada como hash `bcryptjs`; as respostas nunca trazem o hash.
- O mesmo e-mail não pode pertencer a um professor e a um aluno, porque o login procura nos dois cadastros.

Códigos dos cadastros: `CADASTRO_DUPLICADO` (409: e-mail, matrícula ou código da turma no semestre já usados), `POSSUI_VINCULOS` (409: aluno com presenças, turma com chamadas ou professor com turmas não podem ser excluídos, para preservar o histórico de frequência), `DADOS_INVALIDOS` (400) e `NAO_ENCONTRADO` (404).

Erros seguem o formato `{ "erro": { "codigo": "QR_EXPIRADO", "mensagem": "..." } }`. Códigos do registro de presença: `QR_INVALIDO`, `QR_EXPIRADO` (400), `SEM_PERMISSAO` (403, aluno fora da turma), `CHAMADA_ENCERRADA`, `PRESENCA_DUPLICADA` (409) e `FORA_DO_RAIO` (422).

### Integração com o aplicativo do aluno

O QR Code exibido ao professor contém o JSON `{ "chamadaId": "...", "token": "...", "expiraEm": 1790000000000 }`. O aplicativo faz login em `/auth/login/aluno` com a matrícula, lê o QR Code e envia `chamadaId`, `token` e a localização do aparelho para `POST /presencas`.

O token do QR Code não é gravado: é um HMAC do id da chamada com a janela de 30 segundos atual, então o código anterior deixa de valer assim que a janela muda.

## Banco de dados (PostgreSQL)

Com `DATABASE_URL` definida no `.env`, a API usa o PostgreSQL. Sem ela, os dados ficam em memória com cópia em `data/db.json`, o que serve para demonstrar sem banco. Ao iniciar, o terminal informa qual fonte está em uso.

```bash
npm run db:setup              # cria o banco "presenca" (se faltar), as tabelas e os dados de demonstração
npm run db:setup -- --recriar # apaga tudo e recria do zero
```

O script só cria o que ainda não existe e só insere os dados de demonstração se não houver professores. Por isso, pode ser executado de novo sem perder dados.

### Tabelas

| Tabela                | Conteúdo                                                                                           |
| --------------------- | -------------------------------------------------------------------------------------------------- |
| `professores`         | nome, e-mail (único) e hash da senha                                                               |
| `alunos`              | nome, matrícula (única), e-mail (único) e hash da senha                                            |
| `turmas`              | professor, código + semestre (únicos), disciplina, local e ponto de referência da última chamada   |
| `matriculas`          | aluno × turma                                                                                       |
| `chamadas`            | turma, início, encerramento, coordenada da sala e raio (20 m); no máximo uma aberta por professor   |
| `presencas`           | aluno × chamada (única), horário, origem (QR_CODE/MANUAL), coordenada do aluno e distância          |
| `tentativas_registro` | cada leitura de QR Code pelo app, com o resultado (REGISTRADA ou o motivo da recusa) e a distância |

As faltas não são gravadas: um aluno matriculado sem presença em uma chamada encerrada está ausente (ou pendente, se a chamada estiver aberta).

As exclusões preservam o histórico: aluno com presenças, turma com chamadas e professor com turmas não podem ser excluídos (`ON DELETE RESTRICT`). Excluir uma chamada remove as presenças e tentativas dela; excluir um aluno ou uma turma remove as matrículas.

### Visões para relatórios

Podem ser consultadas no pgAdmin ou no `psql`, por exemplo para montar tabelas do TCC:

| Visão                         | Uma linha por                         | Uso                                                        |
| ----------------------------- | ------------------------------------- | ---------------------------------------------------------- |
| `vw_registros_presenca`       | aluno matriculado em cada chamada     | situação PRESENTE/AUSENTE/PENDENTE, horário e distância    |
| `vw_frequencia_alunos`        | aluno em cada turma                   | aulas, presenças, faltas, % e `abaixo_do_minimo` (< 75%)   |
| `vw_tentativas_por_resultado` | resultado das tentativas por chamada  | indicadores dos testes: % de sucesso e falhas por motivo   |

```sql
SELECT * FROM vw_frequencia_alunos WHERE abaixo_do_minimo;
SELECT resultado, SUM(quantidade) FROM vw_tentativas_por_resultado GROUP BY resultado;
```

### Dados pessoais (LGPD)

São gravados apenas os dados necessários ao controle de frequência: nome, matrícula, e-mail, turma, horário do registro, coordenada usada na validação e situação. A localização do aluno é enviada somente no momento do registro, e a tabela de tentativas guarda apenas a distância calculada, não a coordenada.

### Testes no PostgreSQL

`npm test` usa a memória. Para rodar os mesmos cenários no banco, defina `TEST_DATABASE_URL` no `.env` apontando para um banco **separado** (por exemplo, `presenca_teste`), porque ele é apagado e recriado a cada execução. Os testes se recusam a rodar se ele for igual a `DATABASE_URL`.
