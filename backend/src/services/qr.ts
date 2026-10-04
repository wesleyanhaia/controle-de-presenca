import { createHmac, timingSafeEqual } from 'node:crypto'
import { config } from '../config.ts'
import type { Chamada } from '../domain/types.ts'

/*
  O token do QR Code não é armazenado: ele é derivado (HMAC) do id da chamada
  e da "janela" de tempo atual. A cada QR_VALIDADE_SEGUNDOS a janela muda e o
  token anterior deixa de ser aceito, sem precisar gravar nada no banco.
*/

export interface QrAtual {
  token: string
  expiraEm: string
  validoPorMs: number
  /** Conteúdo codificado no QR Code, lido pelo aplicativo do aluno. */
  payload: string
}

export type ResultadoToken = 'VALIDO' | 'EXPIRADO' | 'INVALIDO'

function janelaAtual(chamada: Chamada, agora: number) {
  return Math.floor((agora - Date.parse(chamada.iniciadaEm)) / config.qrValidadeMs)
}

function tokenDaJanela(chamada: Chamada, janela: number) {
  return createHmac('sha256', config.jwtSecret)
    .update(`qr:${chamada.id}:${janela}`)
    .digest('hex')
    .slice(0, 32)
}

function iguais(a: string, b: string) {
  const bufferA = Buffer.from(a)
  const bufferB = Buffer.from(b)
  return bufferA.length === bufferB.length && timingSafeEqual(bufferA, bufferB)
}

export function qrAtual(chamada: Chamada, agora = Date.now()): QrAtual {
  const janela = janelaAtual(chamada, agora)
  const token = tokenDaJanela(chamada, janela)
  const expiraEm = Date.parse(chamada.iniciadaEm) + (janela + 1) * config.qrValidadeMs

  return {
    token,
    expiraEm: new Date(expiraEm).toISOString(),
    validoPorMs: expiraEm - agora,
    payload: JSON.stringify({ chamadaId: chamada.id, token, expiraEm }),
  }
}

export function validarToken(chamada: Chamada, token: string, agora = Date.now()): ResultadoToken {
  const janela = janelaAtual(chamada, agora)
  if (iguais(token, tokenDaJanela(chamada, janela))) return 'VALIDO'

  // Um token de janelas anteriores é um QR legítimo que já venceu.
  for (let anterior = janela - 1; anterior >= Math.max(0, janela - 20); anterior--) {
    if (iguais(token, tokenDaJanela(chamada, anterior))) return 'EXPIRADO'
  }
  return 'INVALIDO'
}
