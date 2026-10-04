import type { ErrorRequestHandler, RequestHandler } from 'express'
import { ZodError } from 'zod'
import { ErroApp } from '../errors.ts'

/*
  Toda resposta de erro segue o formato:
  { "erro": { "codigo": "QR_EXPIRADO", "mensagem": "..." } }
*/

export const rotaNaoEncontrada: RequestHandler = (_req, res) => {
  res.status(404).json({ erro: { codigo: 'NAO_ENCONTRADO', mensagem: 'Rota não encontrada.' } })
}

export const tratarErros: ErrorRequestHandler = (erro, _req, res, _next) => {
  if (erro instanceof ErroApp) {
    res.status(erro.status).json({ erro: { codigo: erro.codigo, mensagem: erro.message } })
    return
  }

  if (erro instanceof ZodError) {
    res.status(400).json({
      erro: {
        codigo: 'DADOS_INVALIDOS',
        mensagem: erro.issues[0]?.message ?? 'Dados inválidos.',
        campos: erro.issues.map((issue) => ({ campo: issue.path.join('.'), mensagem: issue.message })),
      },
    })
    return
  }

  // Erros do body-parser (JSON malformado, corpo grande demais etc.)
  const status = (erro as { status?: number }).status
  if (typeof status === 'number' && status >= 400 && status < 500) {
    res.status(status).json({ erro: { codigo: 'REQUISICAO_INVALIDA', mensagem: 'Requisição inválida.' } })
    return
  }

  console.error(erro)
  res.status(500).json({ erro: { codigo: 'ERRO_INTERNO', mensagem: 'Erro interno do servidor.' } })
}
