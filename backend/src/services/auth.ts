import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { config } from '../config.ts'
import type { Perfil, UsuarioAutenticado } from '../domain/types.ts'
import { erros } from '../errors.ts'
import type { Repositorios } from '../repositories/contracts.ts'

export interface UsuarioDTO {
  id: number
  nome: string
  email: string
  perfil: Perfil
  matricula?: string
}

export function criarAuthService(repositorios: Repositorios) {
  async function buscarUsuario({ id, perfil }: UsuarioAutenticado): Promise<UsuarioDTO | null> {
    if (perfil === 'PROFESSOR') {
      const professor = await repositorios.professores.buscarPorId(id)
      return professor && { id: professor.id, nome: professor.nome, email: professor.email, perfil }
    }
    const aluno = await repositorios.alunos.buscarPorId(id)
    return aluno && { id: aluno.id, nome: aluno.nome, email: aluno.email, perfil, matricula: aluno.matricula }
  }

  return {
    async login(email: string, senha: string) {
      const professor = await repositorios.professores.buscarPorEmail(email)
      const aluno = professor ? null : await repositorios.alunos.buscarPorEmail(email)
      const conta = professor ?? aluno

      if (!conta || !(await bcrypt.compare(senha, conta.senhaHash))) {
        throw erros.naoAutenticado('E-mail ou senha inválidos.')
      }

      const autenticado: UsuarioAutenticado = { id: conta.id, perfil: professor ? 'PROFESSOR' : 'ALUNO' }
      const token = jwt.sign({ perfil: autenticado.perfil }, config.jwtSecret, {
        subject: String(autenticado.id),
        expiresIn: config.jwtExpiraEm,
      })

      return { token, usuario: (await buscarUsuario(autenticado))! }
    },

    verificarToken(token: string): UsuarioAutenticado {
      try {
        const dados = jwt.verify(token, config.jwtSecret) as jwt.JwtPayload
        const id = Number(dados.sub)
        if (!Number.isInteger(id) || (dados.perfil !== 'PROFESSOR' && dados.perfil !== 'ALUNO')) {
          throw new Error('Token inválido')
        }
        return { id, perfil: dados.perfil }
      } catch {
        throw erros.naoAutenticado('Sessão expirada. Faça login novamente.')
      }
    },

    async usuarioAtual(autenticado: UsuarioAutenticado) {
      const usuario = await buscarUsuario(autenticado)
      if (!usuario) throw erros.naoAutenticado('Sessão expirada. Faça login novamente.')
      return usuario
    },
  }
}

export type AuthService = ReturnType<typeof criarAuthService>
