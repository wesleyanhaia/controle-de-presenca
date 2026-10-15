import cors from 'cors'
import express from 'express'
import { config } from './config.ts'
import { rotaNaoEncontrada, tratarErros } from './middlewares/erros.ts'
import type { Repositorios } from './repositories/contracts.ts'
import { criarRotas } from './routes.ts'
import { criarAuthService } from './services/auth.ts'
import { criarCadastroService } from './services/cadastros.ts'
import { criarPresencaService } from './services/presencas.ts'

export function criarApp(repositorios: Repositorios) {
  const app = express()

  app.disable('x-powered-by')
  app.use(cors({ origin: config.corsOrigens }))
  app.use(express.json({ limit: '100kb' }))

  app.use(
    '/api',
    criarRotas(criarAuthService(repositorios), criarCadastroService(repositorios), criarPresencaService(repositorios)),
  )
  app.use(rotaNaoEncontrada)
  app.use(tratarErros)

  return app
}
