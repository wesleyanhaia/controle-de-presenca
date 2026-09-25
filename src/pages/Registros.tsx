import { useMemo, useState } from 'react'
import { Download, Search, SlidersHorizontal, Users } from 'lucide-react'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import { listarPresencas, listarTurmas, type RegistroPresenca } from '../services/presencas'
import './Registros.css'

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

export default function Registros() {
  const [registros] = useState<RegistroPresenca[]>(() => listarPresencas())
  const [turmas] = useState(() => listarTurmas())
  const [busca, setBusca] = useState('')
  const [turmaId, setTurmaId] = useState('todas')
  const [status, setStatus] = useState('todos')
  const [data, setData] = useState('')

  const registrosFiltrados = useMemo(() => {
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

  function exportarCsv() {
    const linhas = [
      ['Data da aula', 'Turma', 'Disciplina', 'Aluno', 'Matrícula', 'Status', 'Registro', 'Distância (m)'],
      ...registrosFiltrados.map((registro) => {
        const turma = turmas.find((item) => item.id === registro.turmaId)
        return [
          formatarData(registro.dataAula),
          turma?.codigo ?? '',
          turma?.disciplina ?? '',
          registro.alunoNome,
          registro.matricula,
          registro.status === 'PRESENTE' ? 'Presente' : 'Ausente',
          registro.dataHoraRegistro ? new Date(registro.dataHoraRegistro).toLocaleString('pt-BR') : '',
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
            <button className="records-page__export" type="button" onClick={exportarCsv} disabled={!registrosFiltrados.length}>
              <Download size={17} /> Exportar CSV
            </button>
          </div>

          <div className="records-page__summary" aria-live="polite">
            <div><span>Registros encontrados</span><strong>{registrosFiltrados.length}</strong></div>
            <div><span>Presenças</span><strong className="records-page__present">{totalPresentes}</strong></div>
            <div><span>Faltas</span><strong className="records-page__absent">{totalAusentes}</strong></div>
          </div>

          <section className="records-panel">
            <div className="records-panel__heading">
              <div><SlidersHorizontal size={18} /><h3>Filtros</h3></div>
              <button type="button" onClick={limparFiltros}>Limpar filtros</button>
            </div>

            <div className="records-filters">
              <label className="records-filter records-filter--search">
                <span>Aluno, matrícula ou turma</span>
                <div><Search size={17} /><input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar registros" /></div>
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
                </select>
              </label>
              <label className="records-filter">
                <span>Data da aula</span>
                <input type="date" value={data} onChange={(event) => setData(event.target.value)} />
              </label>
            </div>

            <div className="records-table__meta">
              <span><Users size={16} /> {registrosFiltrados.length} {registrosFiltrados.length === 1 ? 'resultado' : 'resultados'}</span>
              <span>Dados de demonstração neste navegador</span>
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
                        <td>{registro.distanciaMetros === undefined ? '—' : `${registro.distanciaMetros} m`}</td>
                        <td><span className={`record-status record-status--${registro.status.toLowerCase()}`}>{registro.status === 'PRESENTE' ? 'Presente' : 'Ausente'}</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {!registrosFiltrados.length && <div className="records-table__empty"><Users size={23} /><strong>Nenhum registro encontrado</strong><span>Altere os filtros para consultar outras aulas.</span></div>}
            </div>
          </section>
        </section>
      </main>
    </div>
  )
}