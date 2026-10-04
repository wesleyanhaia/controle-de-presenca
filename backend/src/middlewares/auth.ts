import type { RequestHandler, Response } from 'express'
import type { Perfil, UsuarioAutenticado } from '../domain/types.ts'
import { erros } from '../errors.ts'
import type { AuthService } from '../services/auth.ts'

/** Exige um token JWT válido (Authorization: Bearer ...) e, opcionalmente, um perfil. */
export function autenticar(auth: AuthService, perfil?: Perfil): RequestHandler {
  return (req, res, next) => {
    const [tipo, token] = (req.headers.authorization ?? '').split(' ')
    if (tipo !== 'Bearer' || !token) throw erros.naoAutenticado()

    const usuario = auth.verificarToken(token)
    if (perfil && usuario.perfil !== perfil) throw erros.semPermissao()

    res.locals.usuario = usuario
    next()
  }
}

export function usuarioDa(res: Response) {
  return res.locals.usuario as UsuarioAutenticado
}
