/** Erro de regra de negócio, convertido em resposta HTTP pelo middleware de erros. */
export class ErroApp extends Error {
  readonly status: number
  readonly codigo: string

  constructor(status: number, codigo: string, mensagem: string) {
    super(mensagem)
    this.status = status
    this.codigo = codigo
  }
}

export const erros = {
  naoAutenticado: (mensagem = 'Faça login para continuar.') =>
    new ErroApp(401, 'NAO_AUTENTICADO', mensagem),
  semPermissao: (mensagem = 'Você não tem permissão para acessar este recurso.') =>
    new ErroApp(403, 'SEM_PERMISSAO', mensagem),
  naoEncontrado: (mensagem: string) => new ErroApp(404, 'NAO_ENCONTRADO', mensagem),
  conflito: (codigo: string, mensagem: string) => new ErroApp(409, codigo, mensagem),
  invalido: (codigo: string, mensagem: string) => new ErroApp(400, codigo, mensagem),
  naoProcessavel: (codigo: string, mensagem: string) => new ErroApp(422, codigo, mensagem),
}
