import { useCallback, useEffect, useMemo, useState } from 'react'
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { ErroDaApi, type Historico, type Registro } from '../lib/api'
import { formatarData, formatarHora } from '../lib/formato'
import { useSessao } from '../lib/useSessao'
import { cores, espaco, raio } from '../lib/tema'

type Filtro = 'TODOS' | 'PRESENTE' | 'AUSENTE'

const FILTROS: { valor: Filtro; rotulo: string }[] = [
  { valor: 'TODOS', rotulo: 'Todos' },
  { valor: 'PRESENTE', rotulo: 'Presenças' },
  { valor: 'AUSENTE', rotulo: 'Faltas' },
]

const SITUACAO: Record<Registro['status'], { rotulo: string; cor: string; fundo: string }> = {
  PRESENTE: { rotulo: 'Presente', cor: cores.sucesso, fundo: cores.sucessoSuave },
  AUSENTE: { rotulo: 'Falta', cor: cores.erro, fundo: cores.erroSuave },
  PENDENTE: { rotulo: 'Em andamento', cor: cores.alerta, fundo: cores.alertaSuave },
}

export default function TelaDeHistorico() {
  const { requisitarComSessao } = useSessao()
  const [historico, setHistorico] = useState<Historico | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [atualizando, setAtualizando] = useState(false)
  const [filtro, setFiltro] = useState<Filtro>('TODOS')

  const carregar = useCallback(
    () =>
      requisitarComSessao<Historico>('/alunos/me/presencas').then(
        (dados) => ({ dados, erro: null }),
        (falha) => ({ dados: null, erro: falha instanceof ErroDaApi ? falha.message : 'Não foi possível carregar o histórico.' }),
      ),
    [requisitarComSessao],
  )

  const aplicar = useCallback((resultado: Awaited<ReturnType<typeof carregar>>) => {
    if (resultado.dados) setHistorico(resultado.dados)
    setErro(resultado.erro)
  }, [])

  useEffect(() => {
    let ativa = true
    carregar().then((resultado) => {
      if (ativa) aplicar(resultado)
    })
    return () => {
      ativa = false
    }
  }, [carregar, aplicar])

  async function aoAtualizar() {
    setAtualizando(true)
    aplicar(await carregar())
    setAtualizando(false)
  }

  const turmas = useMemo(() => new Map(historico?.turmas.map((turma) => [turma.id, turma])), [historico])
  const registros = useMemo(
    () => (historico?.registros ?? []).filter((registro) => filtro === 'TODOS' || registro.status === filtro),
    [historico, filtro],
  )

  return (
    <FlatList
      data={registros}
      keyExtractor={(registro) => registro.id}
      contentContainerStyle={estilos.conteudo}
      refreshControl={<RefreshControl refreshing={atualizando} onRefresh={aoAtualizar} />}
      ListHeaderComponent={
        <View style={estilos.filtros}>
          {FILTROS.map(({ valor, rotulo }) => {
            const ativo = filtro === valor
            return (
              <Pressable
                key={valor}
                onPress={() => setFiltro(valor)}
                accessibilityRole="button"
                accessibilityState={{ selected: ativo }}
                style={[estilos.filtro, ativo && estilos.filtroAtivo]}
              >
                <Text style={[estilos.filtroTexto, ativo && estilos.filtroTextoAtivo]}>{rotulo}</Text>
              </Pressable>
            )
          })}
        </View>
      }
      ListEmptyComponent={
        <Text style={erro ? estilos.erro : estilos.vazio}>
          {erro ?? (historico ? 'Nenhum registro encontrado.' : 'Carregando…')}
        </Text>
      }
      renderItem={({ item }) => {
        const turma = turmas.get(item.turmaId)
        const situacao = SITUACAO[item.status]
        return (
          <View style={estilos.item}>
            <View style={{ flex: 1 }}>
              <Text style={estilos.disciplina}>{turma?.disciplina ?? 'Turma'}</Text>
              <Text style={estilos.detalhe}>
                Aula de {formatarData(item.dataAula)}
                {item.dataHoraRegistro ? ` · registrada às ${formatarHora(item.dataHoraRegistro)}` : ''}
                {item.origem === 'MANUAL' ? ' pelo professor' : ''}
              </Text>
            </View>
            <Text style={[estilos.situacao, { color: situacao.cor, backgroundColor: situacao.fundo }]}>{situacao.rotulo}</Text>
          </View>
        )
      }}
    />
  )
}

const estilos = StyleSheet.create({
  conteudo: {
    padding: espaco.medio,
    gap: espaco.pequeno,
  },
  filtros: {
    flexDirection: 'row',
    gap: espaco.pequeno,
    marginBottom: espaco.pequeno,
  },
  filtro: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: cores.borda,
    backgroundColor: cores.superficie,
  },
  filtroAtivo: {
    borderColor: cores.primaria,
    backgroundColor: cores.primariaSuave,
  },
  filtroTexto: {
    fontSize: 14,
    color: cores.textoSecundario,
    fontWeight: '600',
  },
  filtroTextoAtivo: {
    color: cores.primaria,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.pequeno,
    padding: espaco.medio,
    borderRadius: raio,
    borderWidth: 1,
    borderColor: cores.borda,
    backgroundColor: cores.superficie,
  },
  disciplina: {
    fontSize: 15,
    fontWeight: '700',
    color: cores.texto,
  },
  detalhe: {
    marginTop: 2,
    fontSize: 13,
    color: cores.textoSecundario,
  },
  situacao: {
    overflow: 'hidden',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    fontSize: 13,
    fontWeight: '700',
  },
  vazio: {
    marginTop: espaco.medio,
    textAlign: 'center',
    color: cores.textoSecundario,
  },
  erro: {
    padding: 12,
    borderRadius: 10,
    color: cores.erro,
    backgroundColor: cores.erroSuave,
  },
})
