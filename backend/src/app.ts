import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
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
  app.use('/api', rotaNaoEncontrada)

  // Em produção o mesmo servidor entrega o site do professor (npm run build na raiz),
  // então site e API ficam no mesmo endereço e o site chama "/api" sem configuração.
  if (config.pastaDoSite) {
    const pasta = resolve(config.pastaDoSite)
    if (!existsSync(join(pasta, 'index.html'))) {
      console.warn(`[site] ${pasta}/index.html não encontrado; rode "npm run build" na raiz do projeto.`)
    }
    app.use(express.static(pasta))
    // Rotas do React (/dashboard, /chamada...) abrem o index.html; o React decide a tela.
    app.get('/{*caminho}', (_req, res) => {
      res.sendFile(join(pasta, 'index.html'))
    })
  }

  app.use(rotaNaoEncontrada)
  app.use(tratarErros)

  return app
}
