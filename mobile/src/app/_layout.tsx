import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { ActivityIndicator, View } from 'react-native'
import { ProvedorDeSessao } from '../lib/sessao'
import { useSessao } from '../lib/useSessao'
import { cores } from '../lib/tema'

export default function LayoutRaiz() {
  return (
    <ProvedorDeSessao>
      <StatusBar style="dark" />
      <Navegacao />
    </ProvedorDeSessao>
  )
}

/** Sem sessão, só a tela de login fica acessível; com sessão, só as telas do aluno. */
function Navegacao() {
  const { sessao, carregando } = useSessao()

  if (carregando) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: cores.fundo }}>
        <ActivityIndicator color={cores.primaria} size="large" />
      </View>
    )
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: cores.superficie },
        headerTintColor: cores.texto,
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: cores.fundo },
      }}
    >
      <Stack.Protected guard={!!sessao}>
        <Stack.Screen name="index" options={{ title: 'Presença+' }} />
        <Stack.Screen name="escanear" options={{ title: 'Registrar presença' }} />
        <Stack.Screen name="historico" options={{ title: 'Histórico' }} />
      </Stack.Protected>
      <Stack.Protected guard={!sessao}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  )
}
