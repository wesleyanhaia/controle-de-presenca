import { useEffect, useMemo, useState } from 'react'
import { BarChart3, Download, RefreshCw, Search, SlidersHorizontal, Users } from 'lucide-react'
import Header from '../components/Header'
import PageState from '../components/PageState'
import Sidebar from '../components/Sidebar'
import { useDados } from '../hooks/useDados'
import { listarFrequencia, listarPresencas, listarTurmas, type FrequenciaAluno } from '../services/presencas'
import type { StatusPresenca } from '../types/Presenca'
import './Registros.css'

/** Frequência mínima exigida nos cursos superiores presenciais. */
const FREQUENCIA_MINIMA = 75

const ROTULO_STATUS: Record<StatusPresenca, string> = {
  PRESENTE: 'Presente',
  AUSENTE: 'Ausente',
  PENDENTE: 'Pendente',
}

function dataLocal(data: string) {
  const valor = new Date(data)
  const ano = valor.getFullYear()
  const mes = String(valor.getMonth() + 1).padStart(2, '0')
  const dia = String(valor.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

function formatarData(data: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(data))
}

function escaparCsv(valor: string | number) {
  return `"${String(valor).replaceAll('"', '""')}"`
}

async function carregarRegistros() {
  const [registros, turmas] = await Promise.all([listarPresencas(), listarTurmas()])
  return { registros, turmas }
}

export default function Registros() {
  const { dados, erro, carregando, recarregar } = useDados(carregarRegistros)
  const [busca, setBusca] = useState('')
  const [turmaId, setTurmaId] = useState('todas')
  const [status, setStatus] = useState('todos')
  const [data, setData] = useState('')
  const [frequencia, setFrequencia] = useState<{ turmaId: string; alunos: FrequenciaAluno[] } | null>(null)

  const registros = dados?.registros
  const turmas = dados?.turmas

  useEffect(() => {
    if (turmaId === 'todas' || !registros) return
    let ativo = true

    listarFrequencia(Number(turmaId)).then(
      (alunos) => {
        if (ativo) setFrequencia({ turmaId, alunos })
      },
      () => {
        if (ativo) setFrequencia(null)
      },
    )

    return () => {
      ativo = false
    }
  }, [turmaId, registros])

  const registrosFiltrados = useMemo(() => {
    if (!registros || !turmas) return []
    const consulta = busca.trim().toLocaleLowerCase('pt-BR')

    return registros.filter((registro) => {
      const turma = turmas.find((item) => item.id === registro.turmaId)
      const correspondeBusca = !consulta || [
        registro.alunoNome,
        registro.matricula,
        turma?.codigo,
        turma?.disciplina,
      ].some((valor) => valor?.toLocaleLowerCase('pt-BR').includes(consulta))

      return correspondeBusca &&
        (turmaId === 'todas' || registro.turmaId === Number(turmaId)) &&
        (status === 'todos' || registro.status === status) &&
        (!data || dataLocal(registro.dataAula) === data)
    })
  }, [busca, data, registros, status, turmaId, turmas])

  const totalPresentes = registrosFiltrados.filter((registro) => registro.status === 'PRESENTE').length
  const totalAusentes = registrosFiltrados.filter((registro) => registro.status === 'AUSENTE').length
  const filtrosAtivos = Boolean(busca || data || turmaId !== 'todas' || status !== 'todos')
  const frequenciaDaTurma = frequencia?.turmaId === turmaId ? frequencia.alunos : null

  function exportarCsv() {
    const linhas = [
      ['Data da aula', 'Turma', 'Disciplina', 'Aluno', 'Matrícula', 'Status', 'Registro', 'Forma de registro', 'Distância (m)'],
      ...registrosFiltrados.map((registro) => {
        const turma = turmas?.find((item) => item.id === registro.turmaId)
        return [
          formatarData(registro.dataAula),
          turma?.codigo ?? '',
          turma?.disciplina ?? '',
          registro.alunoNome,
          registro.matricula,
          ROTULO_STATUS[registro.status],
          registro.dataHoraRegistro ? new Date(registro.dataHoraRegistro).toLocaleString('pt-BR') : '',
          registro.origem === 'MANUAL' ? 'Manual (professor)' : registro.origem === 'QR_CODE' ? 'QR Code' : '',
          registro.distanciaMetros ?? '',
        ]
      }),
    ]
    const conteudo = `\uFEFF${linhas.map((linha) => linha.map(escaparCsv).join(';')).join('\r\n')}`
    const arquivo = new Blob([conteudo], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(arquivo)
    const link = document.createElement('a')
    link.href = url
    link.download = `registros-presenca-${data || 'consulta'}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  function limparFiltros() {
    setBusca('')
    setTurmaId('todas')
    setStatus('todos')
    setData('')
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <Header />
        <section className="records-page">
          <div className="records-page__intro">
            <div>
              <span className="records-page__eyebrow">ACOMPANHAMENTO ACADÊMICO</span>
              <h2>Registros de presença</h2>
              <p>Consulte presenças e faltas por aluno, turma ou data.</p>
            </div>
            <div className="records-page__actions">
              <button className="records-page__export" type="button" onClick={recarregar} disabled={carregando}>
                <RefreshCw size={17} /> {carregando ? 'Atualizando...' : 'Atualizar'}
              </button>
              <button className="records-page__export" type="button" onClick={exportarCsv} disabled={!registrosFiltrados.length}>
                <Download size={17} /> Exportar CSV
              </button>
            </div>
          </div>

          {!turmas ? <PageState carregando={carregando} erro={erro} onTentarNovamente={recarregar} /> : (
            <>
              {erro && <p className="records-page__error" role="alert">{erro}</p>}

              <div className="records-page__summary" aria-live="polite">
                <div><span>Registros encontrados</span><strong>{registrosFiltrados.length}</strong></div>
                <div><span>Presenças</span><strong className="records-page__present">{totalPresentes}</strong></div>
                <div><span>Faltas</span><strong className="records-page__absent">{totalAusentes}</strong></div>
              </div>

              <section className="records-panel">
                <div className="records-panel__heading">
                  <div><SlidersHorizontal size={18} /><h3>Filtros</h3></div>
                  {filtrosAtivos && <button type="button" onClick={limparFiltros}>Limpar filtros</button>}
                </div>

                <div className="records-filters">
                  <label className="records-filter records-filter--search">
                    <span>Aluno, matrícula ou turma</span>
                    <div><Search size={17} /><input type="search" value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar registros" /></div>
                  </label>
                  <label className="records-filter">
                    <span>Turma</span>
                    <select value={turmaId} onChange={(event) => setTurmaId(event.target.value)}>
                      <option value="todas">Todas as turmas</option>
                      {turmas.map((turma) => <option key={turma.id} value={turma.id}>{turma.codigo} · {turma.disciplina}</option>)}
                    </select>
                  </label>
                  <label className="records-filter">
                    <span>Situação</span>
                    <select value={status} onChange={(event) => setStatus(event.target.value)}>
                      <option value="todos">Todas</option>
                      <option value="PRESENTE">Presente</option>
                      <option value="AUSENTE">Ausente</option>
                      <option value="PENDENTE">Pendente (chamada aberta)</option>
                    </select>
                  </label>
                  <label className="records-filter">
                    <span>Data da aula</span>
                    <input type="date" value={data} onChange={(event) => setData(event.target.value)} />
                  </label>
                </div>

                <div className="records-table__meta">
                  <span><Users size={16} /> {registrosFiltrados.length} {registrosFiltrados.length === 1 ? 'resultado' : 'resultados'}</span>
                  <span>Faltas são contabilizadas quando a chamada é encerrada</span>
                </div>

                <div className="records-table__scroll">
                  <table className="records-table">
                    <thead><tr><th>Aluno</th><th>Turma / disciplina</th><th>Data da aula</th><th>Horário</th><th>Distância</th><th>Situação</th></tr></thead>
                    <tbody>
                      {registrosFiltrados.map((registro) => {
                        const turma = turmas.find((item) => item.id === registro.turmaId)
                        return (
                          <tr key={registro.id}>
                            <td><strong>{registro.alunoNome}</strong><span>{registro.matricula}</span></td>
                            <td><strong>{turma?.codigo ?? '—'}</strong><span>{turma?.disciplina ?? 'Turma removida'}</span></td>
                            <td>{formatarData(registro.dataAula)}</td>
                            <td>{registro.dataHoraRegistro ? new Date(registro.dataHoraRegistro).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                            <td>{registro.origem === 'MANUAL' ? 'Registro manual' : registro.distanciaMetros === undefined ? '—' : `${registro.distanciaMetros} m`}</td>
                            <td><span className={`record-status record-status--${registro.status.toLowerCase()}`}>{ROTULO_STATUS[registro.status]}</span></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  {!registrosFiltrados.length && (
                    <div className="records-table__empty">
                      <Users size={23} />
                      <strong>Nenhum registro encontrado</strong>
                      <span>{filtrosAtivos ? 'Altere os filtros para consultar outras aulas.' : 'Os registros aparecem aqui após a primeira chamada.'}</span>
                    </div>
                  )}
                </div>
              </section>

              {frequenciaDaTurma && (
                <section className="records-panel records-frequency">
                  <div className="records-panel__heading">
                    <div><BarChart3 size={18} /><h3>Frequência por aluno na turma</h3></div>
                    <span className="records-frequency__hint">Mínimo exigido: {FREQUENCIA_MINIMA}% · considera chamadas encerradas</span>
                  </div>
                  <div className="records-table__scroll">
                    <table className="records-table">
                      <thead><tr><th>Aluno</th><th>Aulas</th><th>Presenças</th><th>Faltas</th><th>Frequência</th></tr></thead>
                      <tbody>
                        {frequenciaDaTurma.map((aluno) => {
                          const abaixo = aluno.totalAulas > 0 && aluno.percentualPresenca < FREQUENCIA_MINIMA
                          return (
                            <tr key={aluno.alunoId}>
                              <td><strong>{aluno.alunoNome}</strong><span>{aluno.matricula}</span></td>
                              <td>{aluno.totalAulas}</td>
                              <td>{aluno.presencas}</td>
                              <td>{aluno.faltas}</td>
                              <td>
                                <strong className={abaixo ? 'records-frequency__low' : undefined}>
                                  {aluno.totalAulas ? `${aluno.percentualPresenca}%` : '—'}{abaixo && ' · abaixo do mínimo'}
                                </strong>
                                <span className={`records-frequency__bar ${abaixo ? 'records-frequency__bar--low' : ''}`}>
                                  <span style={{ width: `${aluno.percentualPresenca}%` }} />
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  )
}
