/** Conteúdo do QR Code exibido pelo professor: { chamadaId, token, expiraEm }. */
export interface ConteudoDoQr {
  chamadaId: string
  token: string
}

/** Devolve null quando o código lido não é um QR Code de chamada do Presença+. */
export function lerConteudoDoQr(texto: string): ConteudoDoQr | null {
  try {
    const dados = JSON.parse(texto) as Record<string, unknown>
    if (typeof dados.chamadaId === 'string' && dados.chamadaId && typeof dados.token === 'string' && dados.token) {
      return { chamadaId: dados.chamadaId, token: dados.token }
    }
  } catch {
    // Não é JSON: QR Code de outro sistema.
  }
  return null
}
