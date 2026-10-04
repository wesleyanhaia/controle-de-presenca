import { config } from '../config.ts'
import type { Repositorios } from './contracts.ts'
import { criarRepositoriosEmMemoria } from './memory/index.ts'

/*
  Ponto único de escolha da fonte de dados.

  Para migrar para o PostgreSQL:
    1. crie as tabelas com database/schema.sql;
    2. implemente os contratos de ./contracts.ts em ./postgres (usando "pg" ou um ORM);
    3. retorne essa implementação aqui quando DATABASE_URL estiver definida.
*/
export function criarRepositorios(): Repositorios {
  return criarRepositoriosEmMemoria(config.arquivoDados || undefined)
}
