import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import pg from 'pg'
import { dadosDeDemonstracao, type Dados } from '../memory/seed.ts'

/*
  Prepara o banco PostgreSQL:
    1. cria o banco informado em DATABASE_URL, se ainda não existir;
    2. executa database/schema.sql (cria apenas o que falta);
    3. se o banco estiver vazio, insere os dados de demonstração ou os de um
       arquivo JSON do repositório em memória (data/db.json).

  Uso:
    npm run db:setup                               prepara o banco mantendo os dados existentes
    npm run db:setup -- --recriar                  apaga todas as tabelas e começa do zero
    npm run db:setup -- --importar data/db.json    carrega os dados usados antes do PostgreSQL
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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Insere os dados em um banco vazio, mantendo os ids. Devolve false se já houver dados. */
async function inserirDados(cliente: pg.Client, dados: Dados, origem: string) {
  const { rows } = await cliente.query('SELECT COUNT(*)::int AS total FROM professores')
  if (rows[0].total > 0) {
    console.log(`[db] O banco já tem dados; ${origem} não foi carregado.`)
    return false
  }

  // No banco o id da chamada é UUID; ids em outro formato (ex.: "demo-1") são trocados.
  const idsDasChamadas = new Map(dados.chamadas.map((chamada) => [chamada.id, UUID.test(chamada.id) ? chamada.id : randomUUID()]))
  const idDaChamada = (id: string | null) => (id === null ? null : idsDasChamadas.get(id) ?? null)

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
        [idDaChamada(c.id), c.turmaId, c.professorId, c.iniciadaEm, c.encerradaEm, c.latitude, c.longitude, c.raioMetros],
      )
    }
    for (const p of dados.presencas) {
      await cliente.query(
        `INSERT INTO presencas (id, chamada_id, aluno_id, registrada_em, origem, latitude, longitude, distancia_metros)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [p.id, idDaChamada(p.chamadaId), p.alunoId, p.registradaEm, p.origem, p.latitude, p.longitude, p.distanciaMetros],
      )
    }
    for (const t of dados.tentativas ?? []) {
      await cliente.query(
        `INSERT INTO tentativas_registro (id, aluno_id, chamada_id, resultado, distancia_metros, tentada_em)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [t.id, t.alunoId, idDaChamada(t.chamadaId), t.resultado, t.distanciaMetros, t.tentadaEm],
      )
    }

    // Os ids foram informados explicitamente; as sequências continuam do maior id.
    for (const tabela of ['professores', 'alunos', 'turmas', 'presencas', 'tentativas_registro']) {
      await cliente.query(
        `SELECT setval(pg_get_serial_sequence('${tabela}', 'id'), (SELECT MAX(id) FROM ${tabela}))`,
      )
    }

    await cliente.query('COMMIT')
    console.log(
      `[db] ${origem} carregado: ${dados.professores.length} professor(es), ${dados.alunos.length} alunos, ` +
        `${dados.turmas.length} turmas, ${dados.chamadas.length} chamadas, ${dados.presencas.length} presenças.`,
    )
    return true
  } catch (erro) {
    await cliente.query('ROLLBACK')
    throw erro
  }
}

/**
 * Cria o banco e as tabelas e, se ele estiver vazio, insere os dados de
 * demonstração ou os do arquivo JSON indicado em `importar`.
 */
export async function prepararBanco(
  connectionString: string,
  opcoes: { recriar?: boolean; demonstracao?: boolean; importar?: string } = {},
) {
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
    if (opcoes.importar) {
      const dados = JSON.parse(readFileSync(opcoes.importar, 'utf8')) as Dados
      await inserirDados(cliente, dados, `O arquivo ${opcoes.importar}`)
    } else if (opcoes.demonstracao ?? true) {
      await inserirDados(cliente, dadosDeDemonstracao(), 'Os dados de demonstração')
    }
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
    const posicao = process.argv.indexOf('--importar')
    const importar = posicao >= 0 ? process.argv[posicao + 1] : undefined
    if (posicao >= 0 && !importar) throw new Error('Informe o arquivo depois de --importar (ex.: data/db.json).')
    await prepararBanco(connectionString, { recriar: process.argv.includes('--recriar'), importar })
    console.log('[db] Banco pronto.')
  } catch (erro) {
    console.error('[db] Falha ao preparar o banco:', (erro as Error).message)
    process.exit(1)
  }
}
