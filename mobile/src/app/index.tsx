import { router, Stack, useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Botao } from '../components/Botao'
import { ErroDaApi, type Historico, type TurmaResumo } from '../lib/api'
import { FREQUENCIA_MINIMA } from '../lib/formato'
import { useSessao } from '../lib/useSessao'
import { cores, espaco, raio } from '../lib/tema'

export default function TelaInicial() {
  const { sessao, sair, requisitarComSessao } = useSessao()
  const [historico, setHistorico] = useState<Historico | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [atualizando, setAtualizando] = useState(false)

  const carregar = useCallback(async () => {
    try {
      setHistorico(await requisitarComSessao<Historico>('/alunos/me/presencas'))
      setErro(null)
    } catch (falha) {
      setErro(falha instanceof ErroDaApi ? falha.message : 'Não foi possível carregar sua frequência.')
    }
  }, [requisitarComSessao])

  // Recarrega ao voltar para esta tela (por exemplo, depois de registrar uma presença).
  useFocusEffect(
    useCallback(() => {
      carregar()
    }, [carregar]),
  )

  async function aoAtualizar() {
    setAtualizando(true)
    await carregar()
    setAtualizando(false)
  }

  const primeiroNome = sessao?.usuario.nome.split(' ')[0] ?? ''

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={sair} hitSlop={12} accessibilityRole="button">
              <Text style={estilos.sair}>Sair</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView
        contentContainerStyle={estilos.conteudo}
        refreshControl={<RefreshControl refreshing={atualizando} onRefresh={aoAtualizar} />}
      >
        <Text style={estilos.saudacao}>Olá, {primeiroNome}</Text>
        <Text style={estilos.matricula}>Matrícula {sessao?.usuario.matricula}</Text>

        <View style={estilos.chamada}>
          <Text style={estilos.chamadaTitulo}>Chamada em andamento?</Text>
          <Text style={estilos.chamadaTexto}>
            Leia o QR Code exibido pelo professor. Sua localização é usada apenas neste momento, para confirmar que você
            está na sala.
          </Text>
          <Botao titulo="Ler QR Code da chamada" onPress={() => router.push('/escanear')} />
        </View>

        <View style={estilos.cabecalhoSecao}>
          <Text style={estilos.secao}>Minha frequência</Text>
          <Pressable onPress={() => router.push('/historico')} hitSlop={8} accessibilityRole="link">
            <Text style={estilos.link}>Ver histórico</Text>
          </Pressable>
        </View>

        {erro && <Text style={estilos.erro}>{erro}</Text>}
        {!historico && !erro && <Text style={estilos.vazio}>Carregando…</Text>}
        {historico?.turmas.length === 0 && <Text style={estilos.vazio}>Você ainda não está matriculado em nenhuma turma.</Text>}
        {historico?.turmas.map((turma) => <CartaoDaTurma key={turma.id} turma={turma} />)}
      </ScrollView>
    </>
  )
}

function CartaoDaTurma({ turma }: { turma: TurmaResumo }) {
  const aulas = turma.presencas + turma.faltas
  const abaixoDoMinimo = aulas > 0 && turma.percentualPresenca < FREQUENCIA_MINIMA
  const corDaBarra = abaixoDoMinimo ? cores.alerta : cores.sucesso

  return (
    <View style={estilos.cartao}>
      <View style={estilos.cartaoTopo}>
        <View style={{ flex: 1 }}>
          <Text style={estilos.disciplina}>{turma.disciplina}</Text>
          <Text style={estilos.codigo}>{turma.codigo}</Text>
        </View>
        <Text style={[estilos.percentual, { color: aulas ? corDaBarra : cores.textoSecundario }]}>
          {aulas ? `${turma.percentualPresenca}%` : '—'}
        </Text>
      </View>

      <View style={estilos.barra}>
        <View style={[estilos.barraPreenchida, { width: `${aulas ? turma.percentualPresenca : 0}%`, backgroundColor: corDaBarra }]} />
      </View>

      <Text style={estilos.detalhe}>
        {aulas
          ? `${turma.presencas} ${turma.presencas === 1 ? 'presença' : 'presenças'} · ${turma.faltas} ${turma.faltas === 1 ? 'falta' : 'faltas'}`
          : 'Nenhuma aula registrada ainda'}
      </Text>
      {abaixoDoMinimo && (
        <Text style={estilos.aviso}>Abaixo da frequência mínima de {FREQUENCIA_MINIMA}%.</Text>
      )}
    </View>
  )
}

const estilos = StyleSheet.create({
  conteudo: {
    padding: espaco.medio,
    paddingBottom: espaco.grande * 2,
  },
  sair: {
    color: cores.primaria,
    fontSize: 16,
    fontWeight: '600',
  },
  saudacao: {
    fontSize: 24,
    fontWeight: '800',
    color: cores.texto,
  },
  matricula: {
    marginTop: 2,
    fontSize: 14,
    color: cores.textoSecundario,
  },
  chamada: {
    marginTop: espaco.medio,
    padding: espaco.medio,
    gap: 12,
    borderRadius: raio,
    backgroundColor: cores.superficie,
    borderWidth: 1,
    borderColor: cores.primariaSuave,
  },
  chamadaTitulo: {
    fontSize: 17,
    fontWeight: '700',
    color: cores.texto,
  },
  chamadaTexto: {
    fontSize: 14,
    lineHeight: 20,
    color: cores.textoSecundario,
  },
  cabecalhoSecao: {
    marginTop: espaco.grande,
    marginBottom: espaco.pequeno,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  secao: {
    fontSize: 18,
    fontWeight: '700',
    color: cores.texto,
  },
  link: {
    color: cores.primaria,
    fontSize: 15,
    fontWeight: '600',
  },
  cartao: {
    marginTop: espaco.pequeno,
    padding: espaco.medio,
    borderRadius: raio,
    backgroundColor: cores.superficie,
    borderWidth: 1,
    borderColor: cores.borda,
  },
  cartaoTopo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: espaco.pequeno,
  },
  disciplina: {
    fontSize: 16,
    fontWeight: '700',
    color: cores.texto,
  },
  codigo: {
    marginTop: 2,
    fontSize: 13,
    color: cores.textoSecundario,
  },
  percentual: {
    fontSize: 22,
    fontWeight: '800',
  },
  barra: {
    marginTop: 12,
    height: 8,
    borderRadius: 4,
    backgroundColor: cores.fundo,
    overflow: 'hidden',
  },
  barraPreenchida: {
    height: '100%',
    borderRadius: 4,
  },
  detalhe: {
    marginTop: espaco.pequeno,
    fontSize: 13,
    color: cores.textoSecundario,
  },
  aviso: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '600',
    color: cores.alerta,
  },
  erro: {
    padding: 12,
    borderRadius: 10,
    color: cores.erro,
    backgroundColor: cores.erroSuave,
  },
  vazio: {
    marginTop: espaco.pequeno,
    color: cores.textoSecundario,
  },
})
