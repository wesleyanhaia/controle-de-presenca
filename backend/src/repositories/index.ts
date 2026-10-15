import { config } from '../config.ts'
import type { Repositorios } from './contracts.ts'
import { criarRepositoriosEmMemoria } from './memory/index.ts'
import { criarPool, criarRepositoriosPostgres } from './postgres/index.ts'

/*
  Ponto único de escolha da fonte de dados: PostgreSQL quando DATABASE_URL
  estiver definida (crie o banco antes com "npm run db:setup"); caso
  contrário, os dados ficam em memória com cópia em ARQUIVO_DADOS.
*/
export function criarRepositorios(): Repositorios {
  if (config.databaseUrl) {
    console.log('[dados] Usando o PostgreSQL (DATABASE_URL).')
    return criarRepositoriosPostgres(criarPool(config.databaseUrl))
  }
  console.log('[dados] DATABASE_URL não definida; usando dados em memória.')
  return criarRepositoriosEmMemoria(config.arquivoDados || undefined)
}
