import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { CircleHelp, Crosshair, MapPin, Radio, StopCircle, UserCheck, Users } from 'lucide-react'
import Header from '../components/Header'
import PageState from '../components/PageState'
import QrCodeBox from '../components/QrCodeBox'
import Sidebar from '../components/Sidebar'
import { useDados } from '../hooks/useDados'
import { mensagemDeErro } from '../services/api'
import { obterLocalizacao } from '../services/localizacao'
import {
  consultarChamadaAtiva,
  encerrarChamada,
  iniciarChamada,
  listarTurmas,
  registrarPresencaComoAluno,
  registrarPresencaManual,
  type SituacaoDaChamada,
} from '../services/presencas'
import './Chamada.css'

/** Intervalo, em segundos, entre as consultas de novos registros ao backend. */
const INTERVALO_ATUALIZACAO = 3

function hora(data: string) {
  return new Date(data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export default function Chamada() {
  const { dados: turmasCarregadas, erro: erroTurmas, recarregar: recarregarTurmas } = useDados(listarTurmas)
  const [situacao, setSituacao] = useState<SituacaoDaChamada | null>(null)
  const [erroConexao, setErroConexao] = useState('')
  const [segundosRestantes, setSegundosRestantes] = useState(0)
  const prazoDoQr = useRef(0)

  const [turmaId, setTurmaId] = useState<number | null>(null)
  const [coordenadas, setCoordenadas] = useState<{ latitude: string; longitude: string } | null>(null)
  const [precisaoMetros, setPrecisaoMetros] = useState<number | null>(null)
  const [emailAluno, setEmailAluno] = useState('')
  const [senhaAluno, setSenhaAluno] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [erro, setErro] = useState('')
  const [acao, setAcao] = useState('')

  const aplicarSituacao = useCallback((nova: SituacaoDaChamada) => {
    prazoDoQr.current = nova.chamada ? Date.now() + nova.chamada.qr.validoPorMs : 0
    setSegundosRestantes(nova.chamada ? Math.ceil(nova.chamada.qr.validoPorMs / 1000) : 0)
    setSituacao(nova)
    setErroConexao('')
  }, [])

  const atualizar = useCallback(async () => {
    try {
      aplicarSituacao(await consultarChamadaAtiva())
    } catch (error) {
      setErroConexao(mensagemDeErro(error))
    }
  }, [aplicarSituacao])

  // Mantém o QR Code e a lista de presenças sincronizados com o backend.
  useEffect(() => {
    let buscando = false
    let segundos = 0

    async function sincronizar() {
      if (buscando) return
      buscando = true
      await atualizar()
      buscando = false
    }

    sincronizar()
    const intervalo = window.setInterval(() => {
      segundos += 1
      const restante = prazoDoQr.current ? Math.ceil((prazoDoQr.current - Date.now()) / 1000) : 0
      setSegundosRestantes(Math.max(0, restante))

      const qrVencido = prazoDoQr.current > 0 && restante <= 0
      if (qrVencido || segundos % INTERVALO_ATUALIZACAO === 0) sincronizar()
    }, 1000)

    return () => window.clearInterval(intervalo)
  }, [atualizar])

  const turmas = turmasCarregadas ?? []
  const chamada = situacao?.chamada ?? null
  const registros = situacao?.registros ?? []
  const presentes = registros.filter((registro) => registro.status === 'PRESENTE')
  const pendentes = registros.length - presentes.length
  const turmaDaChamada = turmas.find((turma) => turma.id === chamada?.turmaId)

  const turmaDoFormulario = turmas.find((turma) => turma.id === turmaId) ?? turmas[0]
  const localSalvo = turmaDoFormulario?.latitude != null && turmaDoFormulario.longitude != null
    ? { latitude: String(turmaDoFormulario.latitude), longitude: String(turmaDoFormulario.longitude) }
    : null
  const { latitude, longitude } = coordenadas ?? localSalvo ?? { latitude: '', longitude: '' }

  function limparAvisos() {
    setErro('')
    setMensagem('')
  }

  function selecionarTurma(id: number) {
    setTurmaId(id)
    setCoordenadas(null)
    setPrecisaoMetros(null)
  }

  async function usarLocalizacaoAtual() {
    limparAvisos()
    setAcao('localizacao')

    try {
      const local = await obterLocalizacao()
      setCoordenadas({ latitude: local.latitude.toFixed(6), longitude: local.longitude.toFixed(6) })
      setPrecisaoMetros(local.precisaoMetros)
    } catch (error) {
      setErro(mensagemDeErro(error))
    } finally {
      setAcao('')
    }
  }

  async function handleIniciarChamada(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!turmaDoFormulario) return
    limparAvisos()
    setAcao('iniciar')

    try {
      aplicarSituacao(await iniciarChamada(turmaDoFormulario.id, Number(latitude), Number(longitude)))
      setMensagem('Chamada iniciada. O QR Code é renovado automaticamente a cada 30 segundos.')
    } catch (error) {
      setErro(mensagemDeErro(error, 'Não foi possível iniciar a chamada.'))
      await atualizar()
    } finally {
      setAcao('')
    }
  }

  async function handleEncerrarChamada() {
    if (!chamada) return

    const aviso = pendentes
      ? `Encerrar a chamada? ${pendentes} ${pendentes === 1 ? 'aluno sem registro receberá falta' : 'alunos sem registro receberão falta'}.`
      : 'Encerrar a chamada?'
    if (!window.confirm(aviso)) return

    limparAvisos()
    setAcao('encerrar')

    try {
      const encerrada = await encerrarChamada(chamada.id)
      aplicarSituacao({ chamada: null, registros: [] })
      setCoordenadas(null)
      setPrecisaoMetros(null)
      recarregarTurmas()
      setMensagem(`Chamada encerrada com ${encerrada.totalPresentes} de ${encerrada.totalAlunos} alunos presentes. Consulte os detalhes em Registros.`)
    } catch (error) {
      setErro(mensagemDeErro(error, 'Não foi possível encerrar a chamada.'))
    } finally {
      setAcao('')
    }
  }

  async function handlePresencaManual(alunoId: number, alunoNome: string) {
    if (!chamada) return
    limparAvisos()
    setAcao(`manual-${alunoId}`)

    try {
      aplicarSituacao(await registrarPresencaManual(chamada.id, alunoId))
      setMensagem(`Presença de ${alunoNome} registrada manualmente.`)
    } catch (error) {
      setErro(mensagemDeErro(error, 'Não foi possível registrar a presença.'))
      await atualizar()
    } finally {
      setAcao('')
    }
  }

  async function handleRegistroDoAluno(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!chamada) return
    limparAvisos()
    setAcao('aluno')

    try {
      const local = await obterLocalizacao()
      const registro = await registrarPresencaComoAluno({
        email: emailAluno.trim(),
        senha: senhaAluno,
        chamadaId: chamada.id,
        token: chamada.qr.token,
        latitude: local.latitude,
        longitude: local.longitude,
      })
      setEmailAluno('')
      setSenhaAluno('')
      setMensagem(`Presença registrada pelo fluxo do aluno, a ${registro.distanciaMetros} m do local da aula.`)
      await atualizar()
    } catch (error) {
      setErro(mensagemDeErro(error, 'Não foi possível registrar a presença.'))
    } finally {
      setAcao('')
    }
  }

  function conteudo() {
    if (!situacao || !turmasCarregadas) {
      const falha = erroConexao || erroTurmas
      return (
        <PageState
          carregando={!falha}
          erro={falha}
          onTentarNovamente={() => {
            setErroConexao('')
            recarregarTurmas()
            atualizar()
          }}
        />
      )
    }

    if (!chamada) {
      return (
        <form className="call-setup" onSubmit={handleIniciarChamada}>
          <div className="call-setup__heading">
            <div className="call-setup__icon"><Radio size={20} /></div>
            <div>
              <h3>Nova chamada</h3>
              <p>Escolha a turma e defina o ponto de referência da sala.</p>
            </div>
          </div>

          <label className="call-field">
            <span>Turma</span>
            <select value={turmaDoFormulario?.id ?? ''} onChange={(event) => selecionarTurma(Number(event.target.value))} disabled={!turmas.length}>
              {!turmas.length && <option value="">Nenhuma turma vinculada a este professor</option>}
              {turmas.map((turma) => (
                <option key={turma.id} value={turma.id}>{turma.codigo} · {turma.disciplina} ({turma.quantidadeAlunos} alunos)</option>
              ))}
            </select>
          </label>

          <div className="call-setup__location-heading">
            <div>
              <strong><MapPin size={16} /> Localização da aula{turmaDoFormulario ? ` · ${turmaDoFormulario.local}` : ''}</strong>
              <span>Usada somente para validar cada registro dentro do raio de 20 m.</span>
            </div>
            <button className="call-button call-button--quiet" type="button" onClick={usarLocalizacaoAtual} disabled={acao !== ''}>
              <Crosshair size={16} />
              {acao === 'localizacao' ? 'Obtendo...' : 'Usar minha localização'}
            </button>
          </div>

          <div className="call-setup__coordinates">
            <label className="call-field">
              <span>Latitude</span>
              <input type="number" min="-90" max="90" step="any" value={latitude} onChange={(event) => setCoordenadas({ latitude: event.target.value, longitude })} placeholder="Ex.: -28.6775" required />
            </label>
            <label className="call-field">
              <span>Longitude</span>
              <input type="number" min="-180" max="180" step="any" value={longitude} onChange={(event) => setCoordenadas({ latitude, longitude: event.target.value })} placeholder="Ex.: -49.3697" required />
            </label>
          </div>

          {!coordenadas && localSalvo && (
            <p className="call-setup__hint">Coordenadas da última chamada desta turma. Altere se a aula for em outro local.</p>
          )}
          {coordenadas && precisaoMetros !== null && (
            <p className={`call-setup__hint ${precisaoMetros > 20 ? 'call-setup__hint--warning' : ''}`}>
              Precisão informada pelo dispositivo: ±{precisaoMetros} m.
              {precisaoMetros > 20 && ' É maior que o raio de 20 m — comum em computadores sem GPS. Confira as coordenadas ou obtenha-as em um celular.'}
            </p>
          )}

          <div className="call-setup__footer">
            <p><CircleHelp size={16} /> A localização é solicitada apenas por ação sua; não há rastreamento contínuo.</p>
            <button className="call-button call-button--primary" type="submit" disabled={!turmas.length || acao !== ''}>
              {acao === 'iniciar' ? 'Iniciando...' : 'Iniciar chamada'}
            </button>
          </div>
        </form>
      )
    }

    return (
      <>
        <div className="call-active">
          <div className="call-active__details">
            <div className="call-active__class">
              <span className="call-active__status"><span /> AO VIVO</span>
              <h3>{turmaDaChamada?.disciplina ?? 'Turma'}</h3>
              <p>{turmaDaChamada?.codigo} · {turmaDaChamada?.nome}</p>
            </div>
            <div className="call-active__facts">
              <span><Users size={17} /> {presentes.length} de {registros.length} alunos presentes</span>
              <span><MapPin size={17} /> Raio de validação: {chamada.raioMetros} m{turmaDaChamada ? ` · ${turmaDaChamada.local}` : ''}</span>
              <span><Radio size={17} /> Iniciada às {hora(chamada.iniciadaEm)}</span>
            </div>
            <div
              className="call-active__progress"
              role="progressbar"
              aria-label="Alunos presentes"
              aria-valuemin={0}
              aria-valuemax={registros.length}
              aria-valuenow={presentes.length}
            >
              <span style={{ width: `${registros.length ? (presentes.length / registros.length) * 100 : 0}%` }} />
            </div>
            <button className="call-button call-button--stop" type="button" onClick={handleEncerrarChamada} disabled={acao !== ''}>
              <StopCircle size={17} /> {acao === 'encerrar' ? 'Encerrando...' : 'Encerrar chamada'}
            </button>
          </div>

          <div className="call-active__qr">
            <QrCodeBox payload={chamada.qr.payload} segundosRestantes={segundosRestantes} />
            <p>O código é exclusivo desta aula e muda automaticamente a cada 30 segundos.</p>
          </div>
        </div>

        <section className="call-attendance">
          <div className="call-attendance__heading">
            <div><h3>Alunos da turma</h3><p>Atualizado automaticamente enquanto a chamada estiver aberta.</p></div>
            <strong>{presentes.length}/{registros.length}</strong>
          </div>
          {registros.length ? (
            <div className="call-attendance__table-wrap">
              <table>
                <thead><tr><th>Aluno</th><th>Matrícula</th><th>Horário</th><th>Distância</th><th>Situação</th></tr></thead>
                <tbody>{registros.map((registro) => (
                  <tr key={registro.id}>
                    <td>{registro.alunoNome}</td>
                    <td>{registro.matricula}</td>
                    <td>{registro.dataHoraRegistro ? hora(registro.dataHoraRegistro) : '—'}</td>
                    <td>{registro.origem === 'MANUAL' ? 'Manual' : registro.distanciaMetros === undefined ? '—' : `${registro.distanciaMetros} m`}</td>
                    <td>
                      {registro.status === 'PRESENTE' ? (
                        <span className="call-attendance__present"><UserCheck size={15} /> Presente</span>
                      ) : (
                        <button
                          className="call-attendance__mark"
                          type="button"
                          onClick={() => handlePresencaManual(registro.alunoId, registro.alunoNome)}
                          disabled={acao !== ''}
                          title="Registrar a presença deste aluno manualmente"
                        >
                          {acao === `manual-${registro.alunoId}` ? 'Registrando...' : 'Marcar presença'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : <p className="call-attendance__empty">Esta turma ainda não possui alunos matriculados.</p>}
        </section>

        <details className="call-test">
          <summary>Testar o registro do aluno neste dispositivo</summary>
          <div className="call-test__content">
            <p>
              Executa o mesmo fluxo do aplicativo do aluno: login, envio do QR Code atual e da localização deste
              dispositivo. O servidor valida o código, a matrícula na turma, o raio de {chamada.raioMetros} m e a duplicidade.
              Contas de demonstração: aluno1@unesc.net a aluno12@unesc.net, senha 123456.
            </p>
            <form className="call-test__form" onSubmit={handleRegistroDoAluno}>
              <label className="call-field">
                <span>E-mail do aluno</span>
                <input type="email" value={emailAluno} onChange={(event) => setEmailAluno(event.target.value)} placeholder="aluno1@unesc.net" autoComplete="off" required />
              </label>
              <label className="call-field">
                <span>Senha do aluno</span>
                <input type="password" value={senhaAluno} onChange={(event) => setSenhaAluno(event.target.value)} autoComplete="off" required />
              </label>
              <button className="call-button call-button--primary" type="submit" disabled={acao !== ''}>
                {acao === 'aluno' ? 'Validando...' : 'Validar e registrar'}
              </button>
            </form>
          </div>
        </details>
      </>
    )
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <Header />
        <section className="call-page">
          <div className="call-page__intro">
            <div>
              <span className="call-page__eyebrow">CONTROLE DE PRESENÇA</span>
              <h2>Realizar chamada</h2>
              <p>Gere um QR Code temporário e acompanhe os registros da aula.</p>
            </div>
            {chamada && <span className="call-page__live"><span /> Chamada em andamento</span>}
          </div>

          {mensagem && <p className="call-page__notice" role="status">{mensagem}</p>}
          {erro && <p className="call-page__error" role="alert">{erro}</p>}
          {situacao && erroConexao && (
            <p className="call-page__error" role="alert">{erroConexao} Tentando reconectar...</p>
          )}

          {conteudo()}
        </section>
      </main>
    </div>
  )
}
