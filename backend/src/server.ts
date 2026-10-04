import { criarApp } from './app.ts'
import { config } from './config.ts'
import { criarRepositorios } from './repositories/index.ts'

const app = criarApp(criarRepositorios())

app.listen(config.porta, () => {
  console.log(`API de presença em http://localhost:${config.porta}/api`)
})
