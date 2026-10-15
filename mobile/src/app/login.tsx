import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Botao } from '../components/Botao'
import { ErroDaApi } from '../lib/api'
import { useSessao } from '../lib/useSessao'
import { cores, espaco, raio } from '../lib/tema'

export default function TelaDeLogin() {
  const { entrar, servidor } = useSessao()
  const [matricula, setMatricula] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function aoEntrar() {
    if (!servidor) {
      setErro('Informe o endereço do servidor abaixo antes de entrar.')
      return
    }
    if (!matricula.trim() || !senha) {
      setErro('Informe a matrícula e a senha.')
      return
    }
    setErro(null)
    setEnviando(true)
    try {
      await entrar(matricula.trim(), senha)
      // A navegação para o início acontece sozinha quando a sessão é criada.
    } catch (falha) {
      setErro(falha instanceof ErroDaApi ? falha.message : 'Não foi possível entrar. Tente novamente.')
      setEnviando(false)
    }
  }

  return (
    <SafeAreaView style={estilos.tela}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
          <View style={estilos.logo}>
            <Text style={estilos.logoTexto}>P+</Text>
          </View>
          <Text style={estilos.titulo}>Presença+</Text>
          <Text style={estilos.subtitulo}>Entre com seu código de matrícula para registrar sua presença nas aulas.</Text>

          <Text style={estilos.rotulo}>Matrícula</Text>
          <TextInput
            style={estilos.campo}
            value={matricula}
            onChangeText={setMatricula}
            placeholder="Ex.: 1"
            placeholderTextColor={cores.textoSecundario}
            keyboardType="number-pad"
            autoComplete="username"
            textContentType="username"
            returnKeyType="next"
            editable={!enviando}
          />

          <Text style={estilos.rotulo}>Senha</Text>
          <TextInput
            style={estilos.campo}
            value={senha}
            onChangeText={setSenha}
            placeholder="Sua senha"
            placeholderTextColor={cores.textoSecundario}
            secureTextEntry
            autoComplete="password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={aoEntrar}
            editable={!enviando}
          />

          {erro && (
            <Text style={estilos.erro} accessibilityRole="alert">
              {erro}
            </Text>
          )}

          <View style={{ marginTop: espaco.medio }}>
            <Botao titulo="Entrar" onPress={aoEntrar} carregando={enviando} />
          </View>

          <ConfiguracaoDoServidor bloqueado={enviando} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

/** Mostra o endereço do servidor e permite trocá-lo (o IP muda de uma rede para outra). */
function ConfiguracaoDoServidor({ bloqueado }: { bloqueado: boolean }) {
  const { servidor, alterarServidor } = useSessao()
  const [editando, setEditando] = useState(!servidor)
  const [endereco, setEndereco] = useState(servidor)
  const [testando, setTestando] = useState(false)
  const [mensagem, setMensagem] = useState<{ texto: string; erro: boolean } | null>(null)

  async function aoSalvar() {
    if (!endereco.trim()) {
      setMensagem({ texto: 'Informe o IP do computador que roda o backend.', erro: true })
      return
    }
    setTestando(true)
    setMensagem(null)
    try {
      await alterarServidor(endereco)
      setEditando(false)
      setMensagem({ texto: 'Servidor encontrado e salvo.', erro: false })
    } catch (falha) {
      setMensagem({ texto: falha instanceof Error ? falha.message : 'Não foi possível conectar.', erro: true })
    } finally {
      setTestando(false)
    }
  }

  if (!editando) {
    return (
      <View style={estilos.servidor}>
        <Text style={estilos.servidorTexto}>Servidor: {servidor}</Text>
        {mensagem && <Text style={[estilos.servidorTexto, { color: cores.sucesso }]}>{mensagem.texto}</Text>}
        <Pressable
          onPress={() => {
            setEndereco(servidor)
            setMensagem(null)
            setEditando(true)
          }}
          disabled={bloqueado}
          hitSlop={8}
          accessibilityRole="button"
        >
          <Text style={estilos.servidorLink}>Alterar servidor</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View style={estilos.servidorCaixa}>
      <Text style={estilos.rotulo}>Endereço do servidor</Text>
      <Text style={estilos.servidorAjuda}>
        IP do computador que roda o backend, na mesma rede Wi-Fi do celular. Ex.: 192.168.1.140
      </Text>
      <TextInput
        style={estilos.campo}
        value={endereco}
        onChangeText={setEndereco}
        placeholder="192.168.1.140"
        placeholderTextColor={cores.textoSecundario}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        editable={!testando}
      />
      {mensagem && (
        <Text style={[estilos.servidorTexto, { color: mensagem.erro ? cores.erro : cores.sucesso, textAlign: 'left' }]}>
          {mensagem.texto}
        </Text>
      )}
      <View style={{ gap: espaco.pequeno, marginTop: espaco.pequeno }}>
        <Botao titulo="Testar e salvar" variante="secundaria" onPress={aoSalvar} carregando={testando} />
        {!!servidor && (
          <Pressable onPress={() => setEditando(false)} disabled={testando} hitSlop={8} accessibilityRole="button">
            <Text style={[estilos.servidorLink, { textAlign: 'center' }]}>Cancelar</Text>
          </Pressable>
        )}
      </View>
    </View>
  )
}

const estilos = StyleSheet.create({
  tela: {
    flex: 1,
    backgroundColor: cores.fundo,
  },
  conteudo: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: espaco.grande,
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: raio,
    backgroundColor: cores.primaria,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: espaco.grande,
  },
  logoTexto: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 18,
  },
  titulo: {
    fontSize: 28,
    fontWeight: '800',
    color: cores.texto,
  },
  subtitulo: {
    marginTop: espaco.pequeno,
    marginBottom: espaco.grande,
    fontSize: 15,
    lineHeight: 22,
    color: cores.textoSecundario,
  },
  rotulo: {
    marginTop: espaco.medio,
    marginBottom: 6,
    fontSize: 14,
    fontWeight: '600',
    color: cores.texto,
  },
  campo: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: raio,
    paddingHorizontal: espaco.medio,
    fontSize: 16,
    color: cores.texto,
    backgroundColor: cores.superficie,
  },
  erro: {
    marginTop: espaco.medio,
    padding: 12,
    borderRadius: 10,
    color: cores.erro,
    backgroundColor: cores.erroSuave,
    fontSize: 14,
  },
  servidor: {
    marginTop: espaco.grande,
    alignItems: 'center',
    gap: 4,
  },
  servidorTexto: {
    marginTop: 6,
    textAlign: 'center',
    fontSize: 12,
    color: cores.textoSecundario,
  },
  servidorLink: {
    fontSize: 13,
    fontWeight: '600',
    color: cores.primaria,
  },
  servidorCaixa: {
    marginTop: espaco.grande,
    padding: espaco.medio,
    borderRadius: raio,
    borderWidth: 1,
    borderColor: cores.borda,
    backgroundColor: cores.superficie,
  },
  servidorAjuda: {
    marginBottom: espaco.pequeno,
    fontSize: 13,
    lineHeight: 18,
    color: cores.textoSecundario,
  },
})
