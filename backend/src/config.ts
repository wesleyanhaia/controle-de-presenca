import type { SignOptions } from 'jsonwebtoken'

try {
  process.loadEnvFile()
} catch {
  // Sem arquivo .env: valem as variáveis do ambiente e os padrões abaixo.
}

const SEGREDO_DE_DESENVOLVIMENTO = 'segredo-apenas-para-desenvolvimento'

function numero(nome: string, padrao: number) {
  const valor = Number(process.env[nome])
  return Number.isFinite(valor) && valor > 0 ? valor : padrao
}

const emProducao = process.env.NODE_ENV === 'production'
const jwtSecret = process.env.JWT_SECRET || SEGREDO_DE_DESENVOLVIMENTO

if (jwtSecret === SEGREDO_DE_DESENVOLVIMENTO) {
  if (emProducao) {
    throw new Error('Defina a variável JWT_SECRET antes de executar em produção.')
  }
  if (process.env.NODE_ENV !== 'test') {
    console.warn('[config] JWT_SECRET não definido; usando segredo de desenvolvimento.')
  }
}

export const config = {
  porta: numero('PORT', 3333),
  jwtSecret,
  jwtExpiraEm: (process.env.JWT_EXPIRA_EM || '8h') as SignOptions['expiresIn'],
  corsOrigens: (process.env.CORS_ORIGENS || 'http://localhost:5173')
    .split(',')
    .map((origem) => origem.trim())
    .filter(Boolean),
  qrValidadeMs: numero('QR_VALIDADE_SEGUNDOS', 30) * 1000,
  raioPermitidoMetros: numero('RAIO_PERMITIDO_METROS', 20),
  arquivoDados: process.env.ARQUIVO_DADOS ?? 'data/db.json',
}
