import type { Presenca } from '../types/Presenca'
import type { Turma } from '../types/Turma'

const CHAVE_DADOS = 'presenca-prototipo-v1'
const VALIDADE_QR_MS = 30_000
const RAIO_PERMITIDO_METROS = 20

export interface TurmaPresenca extends Turma {
  codigo: string
  local: string
}

export interface RegistroPresenca extends Presenca {
  chamadaId: string
  dataAula: string
  distanciaMetros?: number
}

export interface ChamadaAtiva {
  id: string
  turmaId: number
  iniciadaEm: string
  latitude: number
  longitude: number
  tokenQr: string
  qrExpiraEm: number
}

interface BancoLocal {
  turmas: TurmaPresenca[]
  registros: RegistroPresenca[]
  chamadaAtiva: ChamadaAtiva | null
}

interface NovoRegistro {
  chamadaId: string
  tokenQr: string
  alunoNome: string
  matricula: string
  latitude: number
  longitude: number
}

function idUnico() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function novoTokenQr() {
  return idUnico().replaceAll('-', '')
}

function coordenadasValidas(latitude: number, longitude: number) {
  return Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 &&
    Number.isFinite(longitude) && longitude >= -180 && longitude <= 180
}

function dataDeDemonstracao(diasAtras: number, hora: number, minuto: number) {
  const data = new Date()
  data.setDate(data.getDate() - diasAtras)
  data.setHours(hora, minuto, 0, 0)
  return data.toISOString()
}

function dadosIniciais(): BancoLocal {
  return {
    turmas: [
      { id: 1, codigo: 'CCO-501', nome: 'Ciência da Computação · 5ª fase', disciplina: 'Estruturas de Dados', semestre: '2026/2', quantidadeAlunos: 32, local: 'Bloco XXI · Sala 204' },
      { id: 2, codigo: 'CCO-302', nome: 'Ciência da Computação · 3ª fase', disciplina: 'Programação Orientada a Objetos', semestre: '2026/2', quantidadeAlunos: 36, local: 'Bloco XXI · Sala 108' },
      { id: 3, codigo: 'CCO-405', nome: 'Ciência da Computação · 4ª fase', disciplina: 'Banco de Dados', semestre: '2026/2', quantidadeAlunos: 28, local: 'Bloco XXI · Sala 301' },
      { id: 4, codigo: 'CCO-204', nome: 'Ciência da Computação · 2ª fase', disciplina: 'Redes de Computadores', semestre: '2026/2', quantidadeAlunos: 30, local: 'Bloco XXI · Laboratório 2' },
    ],
    registros: [
      { id: 1, chamadaId: 'demo-1', turmaId: 1, alunoNome: 'Ana Paula Martins', matricula: '20241021', dataHoraRegistro: dataDeDemonstracao(1, 19, 4), dataAula: dataDeDemonstracao(1, 19, 0), status: 'PRESENTE', distanciaMetros: 8 },
      { id: 2, chamadaId: 'demo-1', turmaId: 1, alunoNome: 'Bruno Henrique Costa', matricula: '20241036', dataHoraRegistro: dataDeDemonstracao(1, 19, 6), dataAula: dataDeDemonstracao(1, 19, 0), status: 'PRESENTE', distanciaMetros: 12 },
      { id: 3, chamadaId: 'demo-1', turmaId: 1, alunoNome: 'Camila Souza Lima', matricula: '20241049', dataAula: dataDeDemonstracao(1, 19, 0), status: 'AUSENTE' },
      { id: 4, chamadaId: 'demo-2', turmaId: 2, alunoNome: 'Diego Alves Rocha', matricula: '20230918', dataHoraRegistro: dataDeDemonstracao(2, 19, 15), dataAula: dataDeDemonstracao(2, 19, 0), status: 'PRESENTE', distanciaMetros: 6 },
      { id: 5, chamadaId: 'demo-2', turmaId: 2, alunoNome: 'Eduarda Mendes Silva', matricula: '20230942', dataAula: dataDeDemonstracao(2, 19, 0), status: 'AUSENTE' },
      { id: 6, chamadaId: 'demo-3', turmaId: 3, alunoNome: 'Felipe Nunes Oliveira', matricula: '20230813', dataHoraRegistro: dataDeDemonstracao(3, 20, 2), dataAula: dataDeDemonstracao(3, 19, 0), status: 'PRESENTE', distanciaMetros: 15 },
    ],
    chamadaAtiva: null,
  }
}

function salvarDados(dados: BancoLocal) {
  localStorage.setItem(CHAVE_DADOS, JSON.stringify(dados))
}

function lerDados(): BancoLocal {
  const salvo = localStorage.getItem(CHAVE_DADOS)

  if (salvo) {
    try {
      return JSON.parse(salvo) as BancoLocal
    } catch {
      localStorage.removeItem(CHAVE_DADOS)
    }
  }

  const iniciais = dadosIniciais()
  salvarDados(iniciais)
  return iniciais
}

export function listarTurmas() {
  return lerDados().turmas
}

export function listarPresencas() {
  return lerDados().registros.sort((a, b) =>
    (b.dataHoraRegistro ?? '').localeCompare(a.dataHoraRegistro ?? ''),
  )
}

export function consultarChamadaAtiva() {
  const dados = lerDados()
  const chamada = dados.chamadaAtiva

  if (!chamada) return null

  if (Date.now() >= chamada.qrExpiraEm) {
    chamada.tokenQr = novoTokenQr()
    chamada.qrExpiraEm = Date.now() + VALIDADE_QR_MS
    salvarDados(dados)
  }

  return chamada
}

export function iniciarChamada(turmaId: number, latitude: number, longitude: number) {
  const dados = lerDados()

  if (!dados.turmas.some((turma) => turma.id === turmaId)) {
    throw new Error('Selecione uma turma válida.')
  }

  if (!coordenadasValidas(latitude, longitude)) {
    throw new Error('Informe coordenadas válidas para o local da aula.')
  }

  if (dados.chamadaAtiva) {
    throw new Error('Encerre a chamada atual antes de iniciar outra.')
  }

  const chamada: ChamadaAtiva = {
    id: idUnico(),
    turmaId,
    iniciadaEm: new Date().toISOString(),
    latitude,
    longitude,
    tokenQr: novoTokenQr(),
    qrExpiraEm: Date.now() + VALIDADE_QR_MS,
  }

  dados.chamadaAtiva = chamada
  salvarDados(dados)
  return chamada
}

export function encerrarChamada() {
  const dados = lerDados()
  dados.chamadaAtiva = null
  salvarDados(dados)
}

export function distanciaEmMetros(
  latitudeInicial: number,
  longitudeInicial: number,
  latitudeFinal: number,
  longitudeFinal: number,
) {
  const radianos = (graus: number) => (graus * Math.PI) / 180
  const diferencaLatitude = radianos(latitudeFinal - latitudeInicial)
  const diferencaLongitude = radianos(longitudeFinal - longitudeInicial)
  const a =
    Math.sin(diferencaLatitude / 2) ** 2 +
    Math.cos(radianos(latitudeInicial)) *
      Math.cos(radianos(latitudeFinal)) *
      Math.sin(diferencaLongitude / 2) ** 2

  const valorLimitado = Math.min(1, Math.max(0, a))
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(valorLimitado), Math.sqrt(1 - valorLimitado))
}

export function registrarPresenca(novoRegistro: NovoRegistro) {
  const dados = lerDados()
  const chamada = dados.chamadaAtiva

  if (!chamada || chamada.id !== novoRegistro.chamadaId) {
    throw new Error('Esta chamada não está mais ativa.')
  }

  if (Date.now() >= chamada.qrExpiraEm || chamada.tokenQr !== novoRegistro.tokenQr) {
    throw new Error('O QR Code expirou. Leia o código atualizado e tente novamente.')
  }

  if (!novoRegistro.alunoNome.trim() || !novoRegistro.matricula.trim()) {
    throw new Error('Informe o nome e a matrícula do aluno.')
  }

  if (!coordenadasValidas(novoRegistro.latitude, novoRegistro.longitude)) {
    throw new Error('Não foi possível validar uma localização válida.')
  }

  const matricula = novoRegistro.matricula.trim()

  if (dados.registros.some((registro) => registro.chamadaId === chamada.id && registro.matricula === matricula)) {
    throw new Error('Esta matrícula já registrou presença nesta chamada.')
  }

  const distanciaMetros = distanciaEmMetros(
    chamada.latitude,
    chamada.longitude,
    novoRegistro.latitude,
    novoRegistro.longitude,
  )

  if (distanciaMetros > RAIO_PERMITIDO_METROS) {
    throw new Error(`Localização fora do limite de 20 m (${Math.round(distanciaMetros)} m).`)
  }

  const registro: RegistroPresenca = {
    id: Date.now(),
    chamadaId: chamada.id,
    turmaId: chamada.turmaId,
    alunoNome: novoRegistro.alunoNome.trim(),
    matricula,
    dataHoraRegistro: new Date().toISOString(),
    dataAula: new Date().toISOString(),
    status: 'PRESENTE',
    distanciaMetros: Math.round(distanciaMetros),
  }

  dados.registros.push(registro)
  salvarDados(dados)
  return registro
}

export function montarPayloadQr(chamada: ChamadaAtiva) {
  return JSON.stringify({
    chamadaId: chamada.id,
    token: chamada.tokenQr,
    expiraEm: chamada.qrExpiraEm,
  })
}