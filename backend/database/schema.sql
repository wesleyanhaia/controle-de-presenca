-- Esquema PostgreSQL equivalente aos tipos de src/domain/types.ts.
-- Ainda não é usado pela API: serve de base para a futura implementação
-- dos repositórios em src/repositories/postgres.
--
--   createdb presenca
--   psql -d presenca -f database/schema.sql

CREATE TABLE professores (
    id          SERIAL PRIMARY KEY,
    nome        TEXT NOT NULL,
    email       TEXT NOT NULL,
    senha_hash  TEXT NOT NULL
);
CREATE UNIQUE INDEX professores_email_unico ON professores (LOWER(email));

CREATE TABLE alunos (
    id          SERIAL PRIMARY KEY,
    nome        TEXT NOT NULL,
    matricula   TEXT NOT NULL UNIQUE,
    email       TEXT NOT NULL,
    senha_hash  TEXT NOT NULL
);
CREATE UNIQUE INDEX alunos_email_unico ON alunos (LOWER(email));

CREATE TABLE turmas (
    id            SERIAL PRIMARY KEY,
    professor_id  INTEGER NOT NULL REFERENCES professores (id),
    codigo        TEXT NOT NULL,
    nome          TEXT NOT NULL,
    disciplina    TEXT NOT NULL,
    semestre      TEXT NOT NULL,
    local         TEXT NOT NULL,
    -- ponto de referência da sala, salvo na última chamada da turma
    latitude      DOUBLE PRECISION,
    longitude     DOUBLE PRECISION,
    UNIQUE (codigo, semestre)
);

CREATE TABLE matriculas (
    turma_id  INTEGER NOT NULL REFERENCES turmas (id) ON DELETE CASCADE,
    aluno_id  INTEGER NOT NULL REFERENCES alunos (id) ON DELETE CASCADE,
    PRIMARY KEY (turma_id, aluno_id)
);

CREATE TABLE chamadas (
    id            UUID PRIMARY KEY,
    turma_id      INTEGER NOT NULL REFERENCES turmas (id),
    professor_id  INTEGER NOT NULL REFERENCES professores (id),
    iniciada_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    encerrada_em  TIMESTAMPTZ,
    latitude      DOUBLE PRECISION NOT NULL,
    longitude     DOUBLE PRECISION NOT NULL,
    raio_metros   INTEGER NOT NULL DEFAULT 20
);
CREATE INDEX chamadas_turma ON chamadas (turma_id, iniciada_em DESC);
-- cada professor só pode ter uma chamada aberta (ErroDeDuplicidade em ChamadaRepository.criar)
CREATE UNIQUE INDEX chamadas_uma_aberta_por_professor ON chamadas (professor_id) WHERE encerrada_em IS NULL;

CREATE TABLE presencas (
    id                SERIAL PRIMARY KEY,
    chamada_id        UUID NOT NULL REFERENCES chamadas (id) ON DELETE CASCADE,
    aluno_id          INTEGER NOT NULL REFERENCES alunos (id),
    registrada_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    origem            TEXT NOT NULL CHECK (origem IN ('QR_CODE', 'MANUAL')),
    -- coordenada enviada pelo aluno somente no momento do registro
    latitude          DOUBLE PRECISION,
    longitude         DOUBLE PRECISION,
    distancia_metros  INTEGER,
    -- impede presença duplicada (ErroDeDuplicidade em PresencaRepository.criar)
    UNIQUE (chamada_id, aluno_id)
);

-- As faltas não são gravadas: um aluno matriculado sem linha em "presencas"
-- está AUSENTE (chamada encerrada) ou PENDENTE (chamada aberta).
