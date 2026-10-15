const data = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
const hora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })

export const formatarData = (iso: string) => data.format(new Date(iso))
export const formatarHora = (iso: string) => hora.format(new Date(iso))

/** Frequência mínima exigida nos cursos presenciais (Parecer CNE/CES 224/2006). */
export const FREQUENCIA_MINIMA = 75
