import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  MapPin,
  Users,
} from "lucide-react";
import { useNavigate } from 'react-router-dom'
import Header from "../components/Header";
import PageState from '../components/PageState'
import Sidebar from "../components/Sidebar";
import { useDados } from '../hooks/useDados'
import { consultarChamadaAtiva, listarChamadas, listarPresencas, listarTurmas } from '../services/presencas'
import "./DashBoard.css";

function dataLocal(data: Date) {
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

function hora(data: string) {
  return new Date(data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

async function carregarDashboard() {
  const [turmas, registros, chamadas, situacao] = await Promise.all([
    listarTurmas(),
    listarPresencas(),
    listarChamadas(),
    consultarChamadaAtiva(),
  ])
  return { turmas, registros, chamadas, chamadaAtiva: situacao.chamada }
}

function Dashboard() {
  const navigate = useNavigate()
  const { dados, erro, carregando, recarregar } = useDados(carregarDashboard)

  function conteudo() {
    if (!dados) return <PageState carregando={carregando} erro={erro} onTentarNovamente={recarregar} />

    const { turmas, registros, chamadas, chamadaAtiva } = dados
    const agora = new Date()
    const hoje = dataLocal(agora)
    const inicioSemana = new Date(agora)
    inicioSemana.setDate(inicioSemana.getDate() - 7)

    const registrosHoje = registros.filter((registro) => dataLocal(new Date(registro.dataAula)) === hoje)
    const registrosSemana = registros.filter((registro) => new Date(registro.dataAula) >= inicioSemana)
    const presencasSemana = registrosSemana.filter((registro) => registro.status === 'PRESENTE').length
    const faltasSemana = registrosSemana.filter((registro) => registro.status === 'AUSENTE').length
    const totalSemana = presencasSemana + faltasSemana
    const percentualPresenca = totalSemana ? Math.round((presencasSemana / totalSemana) * 100) : 0
    const percentualFaltas = totalSemana ? 100 - percentualPresenca : 0

    const chamadasHoje = chamadas.filter((chamada) => dataLocal(new Date(chamada.iniciadaEm)) === hoje)
    const finalizadasHoje = chamadasHoje.filter((chamada) => chamada.encerradaEm).length
    const chamadasRecentes = chamadas.slice(0, 5)
    const turmaEmDestaque = turmas.find((turma) => turma.id === chamadaAtiva?.turmaId) ?? turmas[0]

    return (
      <>
        <div className="dashboard__stats">
          <article className="stat-card">
            <div className="stat-card__icon stat-card__icon--blue">
              <BookOpen size={22} />
            </div>

            <div>
              <span>Turmas ativas</span>
              <strong>{turmas.length}</strong>
              <small>Semestre atual</small>
            </div>
          </article>

          <article className="stat-card">
            <div className="stat-card__icon stat-card__icon--purple">
              <Users size={22} />
            </div>

            <div>
              <span>Matrículas</span>
              <strong>{turmas.reduce((total, turma) => total + turma.quantidadeAlunos, 0)}</strong>
              <small>Somando todas as turmas</small>
            </div>
          </article>

          <article className="stat-card">
            <div className="stat-card__icon stat-card__icon--green">
              <CheckCircle2 size={22} />
            </div>

            <div>
              <span>Presenças hoje</span>
              <strong>{registrosHoje.filter((registro) => registro.status === 'PRESENTE').length}</strong>
              <small className="stat-card__positive">Registros confirmados hoje</small>
            </div>
          </article>

          <article className="stat-card">
            <div className="stat-card__icon stat-card__icon--orange">
              <Clock3 size={22} />
            </div>

            <div>
              <span>Chamadas hoje</span>
              <strong>{chamadasHoje.length}</strong>
              <small>
                {chamadasHoje.length > finalizadasHoje
                  ? `1 em andamento · ${finalizadasHoje} ${finalizadasHoje === 1 ? 'finalizada' : 'finalizadas'}`
                  : 'Chamadas realizadas hoje'}
              </small>
            </div>
          </article>
        </div>

        <div className="dashboard__grid">
          <article className="next-class">
            <div className="next-class__header">
              <div>
                <span className="section-label">{chamadaAtiva ? 'CHAMADA EM ANDAMENTO' : 'TURMA EM DESTAQUE'}</span>
                <h3>{turmaEmDestaque?.disciplina ?? 'Nenhuma turma disponível'}</h3>
                <p>{turmaEmDestaque ? `${turmaEmDestaque.codigo} · ${turmaEmDestaque.nome}` : 'Nenhuma turma está vinculada a este professor.'}</p>
              </div>

              <span className="next-class__badge">{chamadaAtiva ? 'Ao vivo' : turmaEmDestaque?.semestre ?? 'Sem turma'}</span>
            </div>

            <div className="next-class__details">
              <div>
                <Clock3 size={19} />
                <span>{chamadaAtiva ? `Iniciada às ${hora(chamadaAtiva.iniciadaEm)}` : 'Nenhuma chamada aberta'}</span>
              </div>

              <div>
                <MapPin size={19} />
                <span>{turmaEmDestaque?.local ?? 'Local não definido'}</span>
              </div>

              <div>
                <Users size={19} />
                <span>
                  {chamadaAtiva
                    ? `${chamadaAtiva.totalPresentes} de ${chamadaAtiva.totalAlunos} alunos presentes`
                    : `${turmaEmDestaque?.quantidadeAlunos ?? 0} alunos matriculados`}
                </span>
              </div>
            </div>

            <div className="next-class__footer">
              <p>
                {chamadaAtiva
                  ? 'O QR Code temporário está ativo. Acompanhe os registros ou encerre a chamada.'
                  : 'Inicie uma chamada para gerar o QR Code temporário e acompanhar os registros dos alunos.'}
              </p>

              <button type="button" onClick={() => navigate('/chamada')} disabled={!turmas.length}>
                {chamadaAtiva ? 'Continuar chamada' : 'Iniciar chamada'} <ArrowRight size={18} />
              </button>
            </div>
          </article>

          <article className="attendance-card">
            <div className="attendance-card__header">
              <div>
                <span className="section-label">ÚLTIMOS 7 DIAS</span>
                <h3>Frequência das turmas</h3>
              </div>

              <button type="button" onClick={() => navigate('/registros')}>Ver registros</button>
            </div>

            <div className="attendance-card__chart">
              <div
                className="attendance-card__circle"
                style={{ background: `conic-gradient(#2f80ed 0 ${percentualPresenca}%, #eaf0f7 ${percentualPresenca}% 100%)` }}
              >
                <strong>{totalSemana ? `${percentualPresenca}%` : '—'}</strong>
                <span>{totalSemana ? 'presença média' : 'sem aulas no período'}</span>
              </div>

              <div className="attendance-card__legend">
                <div>
                  <span className="legend-dot legend-dot--present" />
                  <p>
                    Presenças
                    <strong>{presencasSemana} ({percentualPresenca}%)</strong>
                  </p>
                </div>

                <div>
                  <span className="legend-dot legend-dot--absent" />
                  <p>
                    Faltas
                    <strong>{faltasSemana} ({percentualFaltas}%)</strong>
                  </p>
                </div>
              </div>
            </div>
          </article>
        </div>

        <article className="recent-classes">
          <div className="recent-classes__header">
            <div>
              <span className="section-label">ATIVIDADE RECENTE</span>
              <h3>Últimas chamadas realizadas</h3>
            </div>

            <button type="button" onClick={() => navigate('/registros')}>Ver todas</button>
          </div>

          <div className="recent-classes__table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Turma</th>
                  <th>Disciplina</th>
                  <th>Data</th>
                  <th>Presenças</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {chamadasRecentes.map((chamada) => {
                  const turma = turmas.find((item) => item.id === chamada.turmaId)
                  const ativa = !chamada.encerradaEm

                  return (
                    <tr key={chamada.id}>
                      <td>{turma?.codigo ?? '—'}</td>
                      <td>{turma?.disciplina ?? '—'}</td>
                      <td>{new Date(chamada.iniciadaEm).toLocaleDateString('pt-BR')} · {hora(chamada.iniciadaEm)}</td>
                      <td><strong>{chamada.totalPresentes}</strong> de {chamada.totalAlunos} alunos</td>
                      <td><span className={`status ${ativa ? 'status--active' : 'status--finished'}`}>{ativa ? 'Em andamento' : 'Finalizada'}</span></td>
                    </tr>
                  )
                })}
                {!chamadasRecentes.length && <tr><td colSpan={5}>Nenhuma chamada registrada.</td></tr>}
              </tbody>
            </table>
          </div>
        </article>
      </>
    )
  }

  return (
    <div className="app-layout">
      <Sidebar />

      <main className="main-content">
        <Header />

        <section className="dashboard">
          <div className="dashboard__intro">
            <div>
              <h2>Dashboard</h2>
              <p>
                Acompanhe suas turmas e gerencie as chamadas do dia.
              </p>
            </div>

            <button className="dashboard__new-call" type="button" onClick={() => navigate('/chamada')}>
              <CalendarDays size={19} />
              {dados?.chamadaAtiva ? 'Continuar chamada' : 'Iniciar chamada'}
            </button>
          </div>

          {conteudo()}
        </section>
      </main>
    </div>
  );
}

export default Dashboard;
