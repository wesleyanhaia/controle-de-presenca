

import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  MapPin,
  Users,
} from "lucide-react";
import Header from "../components/Header";
import Sidebar from "../components/Sidebar";
import "./Dashboard.css";

function Dashboard() {
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

            <button className="dashboard__new-call" type="button">
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
                <strong>4</strong>
                <small>Semestre atual</small>
              </div>
            </article>

            <article className="stat-card">
              <div className="stat-card__icon stat-card__icon--purple">
                <Users size={22} />
              </div>

              <div>
                <span>Total de alunos</span>
                <strong>126</strong>
                <small>Em todas as turmas</small>
              </div>
            </article>

            <article className="stat-card">
              <div className="stat-card__icon stat-card__icon--green">
                <CheckCircle2 size={22} />
              </div>

              <div>
                <span>Presenças hoje</span>
                <strong>78</strong>
                <small className="stat-card__positive">+12% em relação à média</small>
              </div>
            </article>

            <article className="stat-card">
              <div className="stat-card__icon stat-card__icon--orange">
                <Clock3 size={22} />
              </div>

              <div>
                <span>Chamadas realizadas</span>
                <strong>2</strong>
                <small>De 3 aulas previstas</small>
              </div>
            </article>
          </div>

          <div className="dashboard__grid">
            <article className="next-class">
              <div className="next-class__header">
                <div>
                  <span className="section-label">PRÓXIMA AULA</span>
                  <h3>Estruturas de Dados</h3>
                  <p>Ciência da Computação · 5ª fase</p>
                </div>

                <span className="next-class__badge">Hoje</span>
              </div>

              <div className="next-class__details">
                <div>
                  <Clock3 size={19} />
                  <span>19:00 às 22:30</span>
                </div>

                <div>
                  <MapPin size={19} />
                  <span>Bloco XXI · Sala 204</span>
                </div>

                <div>
                  <Users size={19} />
                  <span>32 alunos matriculados</span>
                </div>
              </div>

              <div className="next-class__footer">
                <p>
                  A chamada ainda não foi iniciada. Gere um QR Code temporário
                  para registrar a presença dos alunos.
                </p>

                <button type="button">
                  Abrir chamada <ArrowRight size={18} />
                </button>
              </div>
            </article>

            <article className="attendance-card">
              <div className="attendance-card__header">
                <div>
                  <span className="section-label">RESUMO SEMANAL</span>
                  <h3>Frequência das turmas</h3>
                </div>

                <button type="button">Ver registros</button>
              </div>

              <div className="attendance-card__chart">
                <div className="attendance-card__circle">
                  <strong>91%</strong>
                  <span>presença média</span>
                </div>

                <div className="attendance-card__legend">
                  <div>
                    <span className="legend-dot legend-dot--present" />
                    <p>
                      Presenças
                      <strong>91%</strong>
                    </p>
                  </div>

                  <div>
                    <span className="legend-dot legend-dot--absent" />
                    <p>
                      Faltas
                      <strong>9%</strong>
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

              <button type="button">Ver todas</button>
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
                  <tr>
                    <td>CCO-501</td>
                    <td>Estruturas de Dados</td>
                    <td>18/09/2026</td>
                    <td>
                      <strong>29</strong> de 32 alunos
                    </td>
                    <td>
                      <span className="status status--finished">Finalizada</span>
                    </td>
                  </tr>

                  <tr>
                    <td>CCO-302</td>
                    <td>Programação Orientada a Objetos</td>
                    <td>17/09/2026</td>
                    <td>
                      <strong>34</strong> de 36 alunos
                    </td>
                    <td>
                      <span className="status status--finished">Finalizada</span>
                    </td>
                  </tr>

                  <tr>
                    <td>CCO-501</td>
                    <td>Estruturas de Dados</td>
                    <td>16/09/2026</td>
                    <td>
                      <strong>30</strong> de 32 alunos
                    </td>
                    <td>
                      <span className="status status--finished">Finalizada</span>
                    </td>
                  </tr>
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

