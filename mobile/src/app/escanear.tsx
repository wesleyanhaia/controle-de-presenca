import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera'
import { router } from 'expo-router'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Botao } from '../components/Botao'
import { ErroDaApi, type PresencaRegistrada } from '../lib/api'
import { formatarHora } from '../lib/formato'
import { ErroDeLocalizacao, obterLocalizacaoAtual, type Coordenadas } from '../lib/localizacao'
import { lerConteudoDoQr } from '../lib/qr'
import { useSessao } from '../lib/useSessao'
import { cores, espaco, raio } from '../lib/tema'

type Etapa =
  | { tipo: 'lendo' }
  | { tipo: 'enviando'; mensagem: string }
  | { tipo: 'sucesso'; presenca: PresencaRegistrada }
  | { tipo: 'falha'; titulo: string; mensagem: string; abrirConfiguracoes?: boolean; aviso?: boolean }

type EstadoDaLocalizacao =
  | { tipo: 'buscando' }
  | { tipo: 'pronta'; coordenadas: Coordenadas }
  | { tipo: 'erro'; erro: ErroDeLocalizacao }

/** Títulos das recusas devolvidas pela API em POST /presencas. */
const TITULOS: Record<string, string> = {
  QR_INVALIDO: 'QR Code inválido',
  QR_EXPIRADO: 'QR Code expirado',
  CHAMADA_ENCERRADA: 'Chamada encerrada',
  SEM_PERMISSAO: 'Turma diferente',
  PRESENCA_DUPLICADA: 'Presença já registrada',
  FORA_DO_RAIO: 'Você está fora da sala',
  COORDENADAS_INVALIDAS: 'Localização inválida',
  SEM_CONEXAO: 'Sem conexão',
}

const TITULOS_DE_LOCALIZACAO: Record<ErroDeLocalizacao['motivo'], string> = {
  PERMISSAO_NEGADA: 'Permissão de localização negada',
  PERMISSAO_BLOQUEADA: 'Permissão de localização bloqueada',
  GPS_DESLIGADO: 'Localização desligada',
  SEM_SINAL: 'Localização indisponível',
}

export default function TelaDeLeitura() {
  const { requisitarComSessao } = useSessao()
  const [permissaoDaCamera, pedirPermissaoDaCamera] = useCameraPermissions()
  const [etapa, setEtapa] = useState<Etapa>({ tipo: 'lendo' })
  const [localizacao, setLocalizacao] = useState<EstadoDaLocalizacao>({ tipo: 'buscando' })

  // A localização começa a ser lida ao abrir a tela, para não atrasar o envio:
  // o QR Code vale só 30 segundos.
  const pedidoDeLocalizacao = useRef<Promise<Coordenadas> | null>(null)
  const processando = useRef(false)

  const iniciarLeitura = useCallback(() => {
    const pedido = obterLocalizacaoAtual()
    pedidoDeLocalizacao.current = pedido
    pedido
      .then((coordenadas) => setLocalizacao({ tipo: 'pronta', coordenadas }))
      .catch((erro) => {
        if (erro instanceof ErroDeLocalizacao) setLocalizacao({ tipo: 'erro', erro })
      })
    return pedido
  }, [])

  const lerLocalizacao = useCallback(() => {
    setLocalizacao({ tipo: 'buscando' })
    return iniciarLeitura()
  }, [iniciarLeitura])

  useEffect(() => {
    iniciarLeitura()
  }, [iniciarLeitura])

  function falhaDeLocalizacao(erro: ErroDeLocalizacao): Etapa {
    return {
      tipo: 'falha',
      titulo: TITULOS_DE_LOCALIZACAO[erro.motivo],
      mensagem: erro.message,
      abrirConfiguracoes: erro.motivo === 'PERMISSAO_BLOQUEADA',
    }
  }

  async function aoLerCodigo({ data }: BarcodeScanningResult) {
    if (processando.current) return
    processando.current = true

    const conteudo = lerConteudoDoQr(data)
    if (!conteudo) {
      setEtapa({
        tipo: 'falha',
        titulo: 'QR Code não reconhecido',
        mensagem: 'Este não é o QR Code de uma chamada do Presença+. Aponte a câmera para o código exibido pelo professor.',
      })
      return
    }

    setEtapa({ tipo: 'enviando', mensagem: 'Confirmando sua localização…' })
    let coordenadas: Coordenadas
    try {
      // Se a leitura anterior falhou, tenta de novo agora.
      coordenadas = await (localizacao.tipo === 'erro' ? lerLocalizacao() : pedidoDeLocalizacao.current ?? lerLocalizacao())
    } catch (erro) {
      setEtapa(
        erro instanceof ErroDeLocalizacao
          ? falhaDeLocalizacao(erro)
          : { tipo: 'falha', titulo: 'Localização indisponível', mensagem: 'Não foi possível obter sua localização.' },
      )
      return
    }

    setEtapa({ tipo: 'enviando', mensagem: 'Registrando presença…' })
    try {
      const presenca = await requisitarComSessao<PresencaRegistrada>('/presencas', {
        corpo: {
          chamadaId: conteudo.chamadaId,
          token: conteudo.token,
          latitude: coordenadas.latitude,
          longitude: coordenadas.longitude,
        },
      })
      setEtapa({ tipo: 'sucesso', presenca })
    } catch (erro) {
      const codigo = erro instanceof ErroDaApi ? erro.codigo : ''
      setEtapa({
        tipo: 'falha',
        titulo: TITULOS[codigo] ?? 'Não foi possível registrar',
        mensagem: erro instanceof Error ? erro.message : 'Tente novamente.',
        aviso: codigo === 'PRESENCA_DUPLICADA',
      })
    }
  }

  function lerNovamente() {
    processando.current = false
    // Uma localização antiga ou que falhou é lida de novo na nova tentativa.
    lerLocalizacao()
    setEtapa({ tipo: 'lendo' })
  }

  // ---------- Permissão da câmera ----------

  if (!permissaoDaCamera) {
    return <Centralizado><ActivityIndicator color={cores.primaria} size="large" /></Centralizado>
  }

  if (!permissaoDaCamera.granted) {
    return (
      <Centralizado>
        <Text style={estilos.titulo}>Permita o uso da câmera</Text>
        <Text style={estilos.texto}>A câmera é usada somente para ler o QR Code da chamada exibido pelo professor.</Text>
        <View style={estilos.acoes}>
          {permissaoDaCamera.canAskAgain ? (
            <Botao titulo="Permitir câmera" onPress={pedirPermissaoDaCamera} />
          ) : (
            <Botao titulo="Abrir configurações" onPress={() => Linking.openSettings()} />
          )}
          <Botao titulo="Voltar" variante="secundaria" onPress={() => router.back()} />
        </View>
      </Centralizado>
    )
  }

  // ---------- Resultado ----------

  if (etapa.tipo === 'sucesso') {
    return (
      <Centralizado>
        <View style={[estilos.icone, { backgroundColor: cores.sucessoSuave }]}>
          <Text style={[estilos.iconeTexto, { color: cores.sucesso }]}>✓</Text>
        </View>
        <Text style={estilos.titulo}>Presença registrada</Text>
        <Text style={estilos.texto}>
          Registrada às {formatarHora(etapa.presenca.registradaEm)}, a {etapa.presenca.distanciaMetros} m do ponto da sala.
        </Text>
        <View style={estilos.acoes}>
          <Botao titulo="Voltar ao início" onPress={() => router.back()} />
        </View>
      </Centralizado>
    )
  }

  if (etapa.tipo === 'falha') {
    const cor = etapa.aviso ? cores.alerta : cores.erro
    return (
      <Centralizado>
        <View style={[estilos.icone, { backgroundColor: etapa.aviso ? cores.alertaSuave : cores.erroSuave }]}>
          <Text style={[estilos.iconeTexto, { color: cor }]}>{etapa.aviso ? '!' : '✕'}</Text>
        </View>
        <Text style={estilos.titulo}>{etapa.titulo}</Text>
        <Text style={estilos.texto}>{etapa.mensagem}</Text>
        <View style={estilos.acoes}>
          {etapa.abrirConfiguracoes && <Botao titulo="Abrir configurações" onPress={() => Linking.openSettings()} />}
          {!etapa.aviso && (
            <Botao
              titulo="Ler novamente"
              variante={etapa.abrirConfiguracoes ? 'secundaria' : 'primaria'}
              onPress={lerNovamente}
            />
          )}
          <Botao titulo="Voltar ao início" variante={etapa.aviso ? 'primaria' : 'secundaria'} onPress={() => router.back()} />
        </View>
      </Centralizado>
    )
  }

  // ---------- Câmera ----------

  return (
    <View style={estilos.camera}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={etapa.tipo === 'lendo' ? aoLerCodigo : undefined}
      />

      <View style={estilos.moldura} pointerEvents="none" />

      <View style={estilos.painel}>
        {etapa.tipo === 'enviando' ? (
          <View style={estilos.linha}>
            <ActivityIndicator color={cores.primaria} />
            <Text style={estilos.painelTexto}>{etapa.mensagem}</Text>
          </View>
        ) : (
          <>
            <Text style={estilos.painelTitulo}>Aponte para o QR Code do professor</Text>
            <StatusDaLocalizacao estado={localizacao} />
          </>
        )}
      </View>
    </View>
  )
}

function StatusDaLocalizacao({ estado }: { estado: EstadoDaLocalizacao }) {
  if (estado.tipo === 'buscando') {
    return <Text style={estilos.painelTexto}>Obtendo sua localização…</Text>
  }
  if (estado.tipo === 'erro') {
    return <Text style={[estilos.painelTexto, { color: cores.erro }]}>{estado.erro.message}</Text>
  }
  const { precisaoMetros } = estado.coordenadas
  return (
    <Text style={[estilos.painelTexto, { color: cores.sucesso }]}>
      Localização obtida{precisaoMetros != null ? ` (precisão de ±${Math.round(precisaoMetros)} m)` : ''}
    </Text>
  )
}

function Centralizado({ children }: { children: ReactNode }) {
  return <ScrollView contentContainerStyle={estilos.centralizado}>{children}</ScrollView>
}

const estilos = StyleSheet.create({
  centralizado: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: espaco.grande,
  },
  icone: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: espaco.medio,
  },
  iconeTexto: {
    fontSize: 34,
    fontWeight: '800',
  },
  titulo: {
    fontSize: 22,
    fontWeight: '800',
    color: cores.texto,
    textAlign: 'center',
  },
  texto: {
    marginTop: espaco.pequeno,
    fontSize: 15,
    lineHeight: 22,
    color: cores.textoSecundario,
    textAlign: 'center',
  },
  acoes: {
    alignSelf: 'stretch',
    marginTop: espaco.grande,
    gap: 12,
  },
  camera: {
    flex: 1,
    backgroundColor: '#000000',
  },
  moldura: {
    position: 'absolute',
    top: '18%',
    alignSelf: 'center',
    width: 240,
    height: 240,
    borderWidth: 3,
    borderColor: '#ffffff',
    borderRadius: 24,
  },
  painel: {
    position: 'absolute',
    left: espaco.medio,
    right: espaco.medio,
    bottom: espaco.grande,
    padding: espaco.medio,
    gap: 6,
    borderRadius: raio,
    backgroundColor: cores.superficie,
  },
  painelTitulo: {
    fontSize: 16,
    fontWeight: '700',
    color: cores.texto,
  },
  painelTexto: {
    fontSize: 14,
    color: cores.textoSecundario,
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
})
