

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
import Sidebar from "../components/Sidebar";
import { consultarChamadaAtiva, listarPresencas, listarTurmas } from '../services/presencas'
import "./DashBoard.css";

function dataLocal(data: Date) {
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

function Dashboard() {
  const navigate = useNavigate()
  const turmas = listarTurmas()
  const registros = listarPresencas()
  const chamadaAtiva = consultarChamadaAtiva()
  const hoje = dataLocal(new Date())
  const registrosHoje = registros.filter((registro) => dataLocal(new Date(registro.dataAula)) === hoje)
  const agora = new Date()
  const inicioSemana = new Date(agora)
  inicioSemana.setDate(inicioSemana.getDate() - 7)
  const registrosSemana = registros.filter((registro) => {
    const dataAula = new Date(registro.dataAula)
    return dataAula >= inicioSemana && dataAula <= agora
  })
  const presencasSemana = registrosSemana.filter((registro) => registro.status === 'PRESENTE').length
  const faltasSemana = registrosSemana.filter((registro) => registro.status === 'AUSENTE').length
  const totalSemana = presencasSemana + faltasSemana
  const percentualPresenca = totalSemana ? Math.round((presencasSemana / totalSemana) * 100) : 0
  const idsChamadasHoje = new Set(registrosHoje.map((registro) => registro.chamadaId))
  const chamadaAtivaHoje = chamadaAtiva && dataLocal(new Date(chamadaAtiva.iniciadaEm)) === hoje
  const chamadasHoje = idsChamadasHoje.size + Number(Boolean(chamadaAtivaHoje && !idsChamadasHoje.has(chamadaAtiva.id)))
  const chamadasMapeadas = new Map<string, { chamadaId: string; turmaId: number; dataAula: string; registros: typeof registros }>()

  registros.forEach((registro) => {
    const grupo = chamadasMapeadas.get(registro.chamadaId)
    if (grupo) {
      grupo.registros.push(registro)
      if (registro.dataAula > grupo.dataAula) grupo.dataAula = registro.dataAula
    } else {
      chamadasMapeadas.set(registro.chamadaId, {
        chamadaId: registro.chamadaId,
        turmaId: registro.turmaId,
        dataAula: registro.dataAula,
        registros: [registro],
      })
    }
  })

  if (chamadaAtiva && !chamadasMapeadas.has(chamadaAtiva.id)) {
    chamadasMapeadas.set(chamadaAtiva.id, {
      chamadaId: chamadaAtiva.id,
      turmaId: chamadaAtiva.turmaId,
      dataAula: chamadaAtiva.iniciadaEm,
      registros: [],
    })
  }

  const chamadasRecentes = [...chamadasMapeadas.values()]
    .sort((a, b) => b.dataAula.localeCompare(a.dataAula))
    .slice(0, 3)
  const turmaEmDestaque = turmas.find((turma) => turma.id === chamadaAtiva?.turmaId) ?? turmas[0]

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
              Iniciar chamada
            </button>
          </div>

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
                <span>Total de alunos</span>
                <strong>{turmas.reduce((total, turma) => total + turma.quantidadeAlunos, 0)}</strong>
                <small>Em todas as turmas</small>
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
                <span>Chamadas realizadas</span>
                <strong>{chamadasHoje}</strong>
                <small>{chamadaAtivaHoje ? `1 em andamento · ${Math.max(0, chamadasHoje - 1)} finalizadas` : 'Chamadas registradas hoje'}</small>
              </div>
            </article>
          </div>

          <div className="dashboard__grid">
            <article className="next-class">
              <div className="next-class__header">
                <div>
                  <span className="section-label">{chamadaAtiva ? 'CHAMADA EM ANDAMENTO' : 'TURMA EM DESTAQUE'}</span>
                  <h3>{turmaEmDestaque?.disciplina ?? 'Nenhuma turma disponível'}</h3>
                  <p>{turmaEmDestaque ? `${turmaEmDestaque.codigo} · ${turmaEmDestaque.nome}` : 'Cadastre turmas no backend para continuar.'}</p>
                </div>

                <span className="next-class__badge">{chamadaAtiva ? 'Ao vivo' : turmaEmDestaque?.semestre ?? 'Sem turma'}</span>
              </div>

              <div className="next-class__details">
                <div>
                  <Clock3 size={19} />
                  <span>{chamadaAtiva ? `Iniciada às ${new Date(chamadaAtiva.iniciadaEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : 'Nenhuma chamada aberta'}</span>
                </div>

                <div>
                  <MapPin size={19} />
                  <span>{turmaEmDestaque?.local ?? 'Local não definido'}</span>
                </div>

                <div>
                  <Users size={19} />
                  <span>{turmaEmDestaque?.quantidadeAlunos ?? 0} alunos matriculados</span>
                </div>
              </div>

              <div className="next-class__footer">
                <p>
                  {chamadaAtiva
                    ? 'O QR Code temporário está ativo. Acompanhe os registros ou encerre a chamada.'
                    : 'Inicie uma chamada para gerar o QR Code temporário e acompanhar os registros dos alunos.'}
                </p>

                <button type="button" onClick={() => navigate('/chamada')}>
                  {chamadaAtiva ? 'Continuar chamada' : 'Iniciar chamada'} <ArrowRight size={18} />
                </button>
              </div>
            </article>

            <article className="attendance-card">
              <div className="attendance-card__header">
                <div>
                  <span className="section-label">RESUMO SEMANAL</span>
                  <h3>Frequência das turmas</h3>
                </div>

                <button type="button" onClick={() => navigate('/registros')}>Ver registros</button>
              </div>

              <div className="attendance-card__chart">
                <div
                  className="attendance-card__circle"
                  style={{ background: `conic-gradient(#2f80ed 0 ${percentualPresenca}%, #eaf0f7 ${percentualPresenca}% 100%)` }}
                >
                    <strong>{percentualPresenca}%</strong>
                  <span>presença média</span>
                </div>

                <div className="attendance-card__legend">
                  <div>
                    <span className="legend-dot legend-dot--present" />
                    <p>
                      Presenças
                      <strong>{percentualPresenca}%</strong>
                    </p>
                  </div>

                  <div>
                    <span className="legend-dot legend-dot--absent" />
                    <p>
                      Faltas
                      <strong>{totalSemana ? Math.round((faltasSemana / totalSemana) * 100) : 0}%</strong>
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
                  {chamadasRecentes.map((chamadaRecente) => {
                    const turma = turmas.find((item) => item.id === chamadaRecente.turmaId)
                    const presentes = chamadaRecente.registros.filter((registro) => registro.status === 'PRESENTE').length
                    const ativa = chamadaRecente.chamadaId === chamadaAtiva?.id

                    return (
                      <tr key={chamadaRecente.chamadaId}>
                        <td>{turma?.codigo ?? '—'}</td>
                        <td>{turma?.disciplina ?? '—'}</td>
                        <td>{new Date(chamadaRecente.dataAula).toLocaleDateString('pt-BR')}</td>
                        <td><strong>{presentes}</strong> de {turma?.quantidadeAlunos ?? 0} alunos</td>
                        <td><span className={`status ${ativa ? 'status--active' : 'status--finished'}`}>{ativa ? 'Em andamento' : 'Finalizada'}</span></td>
                      </tr>
                    )
                  })}
                  {!chamadasRecentes.length && <tr><td colSpan={5}>Nenhuma chamada registrada.</td></tr>}
                </tbody>
              </table>
            </div>
          </article>
        </section>
      </main>
    </div>
  );
}

export default Dashboard;

