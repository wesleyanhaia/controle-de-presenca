import { useEffect, useState, type FormEvent } from 'react'
import { CircleHelp, Crosshair, MapPin, Radio, StopCircle, Users } from 'lucide-react'
import Header from '../components/Header'
import QrCodeBox from '../components/QrCodeBox'
import Sidebar from '../components/Sidebar'
import {
  consultarChamadaAtiva,
  encerrarChamada,
  iniciarChamada,
  listarPresencas,
  listarTurmas,
  montarPayloadQr,
  registrarPresenca,
  type ChamadaAtiva,
  type RegistroPresenca,
  type TurmaPresenca,
} from '../services/presencas'
import './Chamada.css'

export default function Chamada() {
  const [turmas] = useState<TurmaPresenca[]>(() => listarTurmas())
  const [turmaId, setTurmaId] = useState(() => turmas[0]?.id ?? 0)
  const [chamada, setChamada] = useState<ChamadaAtiva | null>(() => consultarChamadaAtiva())
  const [registros, setRegistros] = useState<RegistroPresenca[]>(() => listarPresencas())
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [alunoNome, setAlunoNome] = useState('')
  const [matricula, setMatricula] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [erro, setErro] = useState('')
  const [carregandoLocalizacao, setCarregandoLocalizacao] = useState(false)
  const [segundosRestantes, setSegundosRestantes] = useState(30)

  useEffect(() => {
    const intervalo = window.setInterval(() => {
      const chamadaAtualizada = consultarChamadaAtiva()
      setChamada(chamadaAtualizada)
      setRegistros(listarPresencas())
      setSegundosRestantes(
        chamadaAtualizada
          ? Math.max(0, Math.ceil((chamadaAtualizada.qrExpiraEm - Date.now()) / 1000))
          : 30,
      )
    }, 1000)

    return () => window.clearInterval(intervalo)
  }, [])

  const turmaSelecionada = turmas.find((turma) => turma.id === chamada?.turmaId)
  const registrosDaChamada = chamada
    ? registros.filter((registro) => registro.chamadaId === chamada.id)
    : []

  function usarLocalizacaoAtual() {
    setErro('')

    if (!navigator.geolocation) {
      setErro('Este navegador não oferece acesso à localização.')
      return
    }

    setCarregandoLocalizacao(true)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLatitude(coords.latitude.toFixed(6))
        setLongitude(coords.longitude.toFixed(6))
        setCarregandoLocalizacao(false)
      },
      () => {
        setErro('Não foi possível obter a localização. Verifique a permissão ou informe as coordenadas da sala.')
        setCarregandoLocalizacao(false)
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    )
  }

  function handleIniciarChamada(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErro('')

    try {
      const novaChamada = iniciarChamada(turmaId, Number(latitude), Number(longitude))
      setChamada(novaChamada)
      setMensagem('Chamada iniciada. O QR Code será renovado automaticamente a cada 30 segundos.')
      setSegundosRestantes(30)
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível iniciar a chamada.')
    }
  }

  function handleEncerrarChamada() {
    encerrarChamada()
    setChamada(null)
    setRegistros(listarPresencas())
    setMensagem('Chamada encerrada. Os registros já recebidos foram mantidos.')
  }

  function handleSimularRegistro(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErro('')
    setMensagem('')

    if (!chamada || !navigator.geolocation) {
      setErro('Não foi possível iniciar o teste de localização neste navegador.')
      return
    }

    const chamadaId = chamada.id
    const tokenQr = chamada.tokenQr
    setCarregandoLocalizacao(true)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        try {
          registrarPresenca({
            chamadaId,
            tokenQr,
            alunoNome,
            matricula,
            latitude: coords.latitude,
            longitude: coords.longitude,
          })
          setRegistros(listarPresencas())
          setAlunoNome('')
          setMatricula('')
          setMensagem('Presença de teste registrada e validada nesta demonstração local.')
        } catch (error) {
          setErro(error instanceof Error ? error.message : 'Não foi possível registrar a presença.')
        } finally {
          setCarregandoLocalizacao(false)
        }
      },
      () => {
        setErro('Localização não disponível. A presença não foi registrada.')
        setCarregandoLocalizacao(false)
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
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

          {!chamada ? (
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
                <select value={turmaId} onChange={(event) => setTurmaId(Number(event.target.value))}>
                  {turmas.map((turma) => (
                    <option key={turma.id} value={turma.id}>{turma.codigo} · {turma.disciplina}</option>
                  ))}
                </select>
              </label>

              <div className="call-setup__location-heading">
                <div>
                  <strong><MapPin size={16} /> Localização da aula</strong>
                  <span>Usada somente para validar cada registro dentro do raio de 20 m.</span>
                </div>
                <button className="call-button call-button--quiet" type="button" onClick={usarLocalizacaoAtual} disabled={carregandoLocalizacao}>
                  <Crosshair size={16} />
                  {carregandoLocalizacao ? 'Obtendo...' : 'Usar minha localização'}
                </button>
              </div>

              <div className="call-setup__coordinates">
                <label className="call-field">
                  <span>Latitude</span>
                  <input type="number" min="-90" max="90" step="any" value={latitude} onChange={(event) => setLatitude(event.target.value)} placeholder="Ex.: -28.6775" required />
                </label>
                <label className="call-field">
                  <span>Longitude</span>
                  <input type="number" min="-180" max="180" step="any" value={longitude} onChange={(event) => setLongitude(event.target.value)} placeholder="Ex.: -49.3697" required />
                </label>
              </div>

              <div className="call-setup__footer">
                <p><CircleHelp size={16} /> A localização é solicitada apenas por ação sua; não há rastreamento contínuo.</p>
                <button className="call-button call-button--primary" type="submit" disabled={!turmas.length}>Iniciar chamada</button>
              </div>
            </form>
          ) : (
            <>
              <div className="call-active">
                <div className="call-active__details">
                  <div className="call-active__class">
                    <span className="call-active__status"><span /> AO VIVO</span>
                    <h3>{turmaSelecionada?.disciplina ?? 'Turma'}</h3>
                    <p>{turmaSelecionada?.codigo} · {turmaSelecionada?.nome}</p>
                  </div>
                  <div className="call-active__facts">
                    <span><MapPin size={17} /> Raio de validação: 20 m</span>
                    <span><Users size={17} /> {registrosDaChamada.length} {registrosDaChamada.length === 1 ? 'presença registrada' : 'presenças registradas'}</span>
                    <span><Radio size={17} /> Iniciada às {new Date(chamada.iniciadaEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <button className="call-button call-button--stop" type="button" onClick={handleEncerrarChamada}><StopCircle size={17} /> Encerrar chamada</button>
                </div>

                <div className="call-active__qr">
                  <QrCodeBox payload={montarPayloadQr(chamada)} segundosRestantes={segundosRestantes} />
                  <p>O código é pessoal para esta aula e muda automaticamente a cada 30 segundos.</p>
                </div>
              </div>

              <details className="call-test">
                <summary>Testar um registro neste dispositivo</summary>
                <div className="call-test__content">
                  <p>Simulação local para validar QR, localização e duplicidade. Não substitui o app Android nem a API do projeto.</p>
                  <form className="call-test__form" onSubmit={handleSimularRegistro}>
                    <label className="call-field">
                      <span>Nome do aluno</span>
                      <input value={alunoNome} onChange={(event) => setAlunoNome(event.target.value)} autoComplete="name" required />
                    </label>
                    <label className="call-field">
                      <span>Matrícula</span>
                      <input value={matricula} onChange={(event) => setMatricula(event.target.value)} required />
                    </label>
                    <button className="call-button call-button--primary" type="submit" disabled={carregandoLocalizacao}>
                      {carregandoLocalizacao ? 'Validando localização...' : 'Validar e registrar'}
                    </button>
                  </form>
                </div>
              </details>

              <section className="call-attendance">
                <div className="call-attendance__heading">
                  <div><h3>Registros desta chamada</h3><p>Atualizados enquanto a chamada estiver aberta.</p></div>
                  <strong>{registrosDaChamada.length}</strong>
                </div>
                {registrosDaChamada.length ? (
                  <div className="call-attendance__table-wrap">
                    <table>
                      <thead><tr><th>Aluno</th><th>Matrícula</th><th>Horário</th><th>Distância</th></tr></thead>
                      <tbody>{registrosDaChamada.map((registro) => (
                        <tr key={registro.id}>
                          <td>{registro.alunoNome}</td><td>{registro.matricula}</td>
                          <td>{registro.dataHoraRegistro ? new Date(registro.dataHoraRegistro).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                          <td>{registro.distanciaMetros ?? '—'} m</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                ) : <p className="call-attendance__empty">Aguardando registros dos alunos.</p>}
              </section>
            </>
          )}
        </section>
      </main>
    </div>
  )
}