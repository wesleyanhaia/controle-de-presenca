import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import pg from 'pg'
import { dadosDeDemonstracao } from '../memory/seed.ts'

/*
  Prepara o banco PostgreSQL:
    1. cria o banco informado em DATABASE_URL, se ainda não existir;
    2. executa database/schema.sql (cria apenas o que falta);
    3. insere os dados de demonstração, se ainda não houver professores.

  Uso:
    npm run db:setup              prepara o banco mantendo os dados existentes
    npm run db:setup -- --recriar apaga todas as tabelas e começa do zero
*/

const ARQUIVO_SCHEMA = new URL('../../../database/schema.sql', import.meta.url)

/** Cria o banco de `connectionString` conectando-se ao banco padrão "postgres" do mesmo servidor. */
async function criarBancoSeNecessario(connectionString: string) {
  const url = new URL(connectionString)
  const nomeDoBanco = decodeURIComponent(url.pathname.slice(1))
  if (!nomeDoBanco) throw new Error('Informe o nome do banco em DATABASE_URL (ex.: .../presenca).')

  url.pathname = '/postgres'
  const cliente = new pg.Client({ connectionString: url.toString() })
  await cliente.connect()
  try {
    const { rowCount } = await cliente.query('SELECT 1 FROM pg_database WHERE datname = $1', [nomeDoBanco])
    if (!rowCount) {
      await cliente.query(`CREATE DATABASE ${pg.escapeIdentifier(nomeDoBanco)}`)
      console.log(`[db] Banco "${nomeDoBanco}" criado.`)
    }
  } finally {
    await cliente.end()
  }
}

async function inserirDadosDeDemonstracao(cliente: pg.Client) {
  const { rows } = await cliente.query('SELECT COUNT(*)::int AS total FROM professores')
  if (rows[0].total > 0) {
    console.log('[db] Já existem dados; a carga de demonstração foi ignorada.')
    return
  }

  const dados = dadosDeDemonstracao()
  // No banco o id da chamada é UUID; os ids "demo-N" da memória são trocados.
  const idsDasChamadas = new Map(dados.chamadas.map((chamada) => [chamada.id, randomUUID()]))

  await cliente.query('BEGIN')
  try {
    for (const p of dados.professores) {
      await cliente.query(
        'INSERT INTO professores (id, nome, email, senha_hash) VALUES ($1, $2, $3, $4)',
        [p.id, p.nome, p.email, p.senhaHash],
      )
    }
    for (const a of dados.alunos) {
      await cliente.query(
        'INSERT INTO alunos (id, nome, matricula, email, senha_hash) VALUES ($1, $2, $3, $4, $5)',
        [a.id, a.nome, a.matricula, a.email, a.senhaHash],
      )
    }
    for (const t of dados.turmas) {
      await cliente.query(
        `INSERT INTO turmas (id, professor_id, codigo, nome, disciplina, semestre, local, latitude, longitude)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [t.id, t.professorId, t.codigo, t.nome, t.disciplina, t.semestre, t.local, t.latitude, t.longitude],
      )
    }
    for (const m of dados.matriculas) {
      await cliente.query('INSERT INTO matriculas (turma_id, aluno_id) VALUES ($1, $2)', [m.turmaId, m.alunoId])
    }
    for (const c of dados.chamadas) {
      await cliente.query(
        `INSERT INTO chamadas (id, turma_id, professor_id, iniciada_em, encerrada_em, latitude, longitude, raio_metros)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [idsDasChamadas.get(c.id), c.turmaId, c.professorId, c.iniciadaEm, c.encerradaEm, c.latitude, c.longitude, c.raioMetros],
      )
    }
    for (const p of dados.presencas) {
      await cliente.query(
        `INSERT INTO presencas (chamada_id, aluno_id, registrada_em, origem, latitude, longitude, distancia_metros)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [idsDasChamadas.get(p.chamadaId), p.alunoId, p.registradaEm, p.origem, p.latitude, p.longitude, p.distanciaMetros],
      )
    }

    // Os ids foram informados explicitamente; as sequências continuam do maior id.
    for (const tabela of ['professores', 'alunos', 'turmas']) {
      await cliente.query(
        `SELECT setval(pg_get_serial_sequence('${tabela}', 'id'), (SELECT MAX(id) FROM ${tabela}))`,
      )
    }

    await cliente.query('COMMIT')
    console.log(
      `[db] Dados de demonstração inseridos: ${dados.professores.length} professor, ${dados.alunos.length} alunos, ` +
        `${dados.turmas.length} turmas, ${dados.chamadas.length} chamadas.`,
    )
  } catch (erro) {
    await cliente.query('ROLLBACK')
    throw erro
  }
}

/** Cria o banco e as tabelas e, opcionalmente, insere os dados de demonstração. */
export async function prepararBanco(connectionString: string, opcoes: { recriar?: boolean; demonstracao?: boolean } = {}) {
  await criarBancoSeNecessario(connectionString)

  const cliente = new pg.Client({ connectionString })
  await cliente.connect()
  try {
    // Evita os avisos "already exists, skipping" a cada execução.
    await cliente.query('SET client_min_messages = warning')
    if (opcoes.recriar) {
      await cliente.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;')
      console.log('[db] Tabelas anteriores removidas.')
    }
    await cliente.query(readFileSync(ARQUIVO_SCHEMA, 'utf8'))
    if (opcoes.demonstracao ?? true) await inserirDadosDeDemonstracao(cliente)
  } finally {
    await cliente.end()
  }
}

// Executado diretamente (npm run db:setup)
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.loadEnvFile()
  } catch {
    // Sem arquivo .env: vale a variável do ambiente.
  }

  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    console.error('Defina DATABASE_URL no arquivo .env (veja .env.example).')
    process.exit(1)
  }

  try {
    await prepararBanco(connectionString, { recriar: process.argv.includes('--recriar') })
    console.log('[db] Banco pronto.')
  } catch (erro) {
    console.error('[db] Falha ao preparar o banco:', (erro as Error).message)
    process.exit(1)
  }
}
