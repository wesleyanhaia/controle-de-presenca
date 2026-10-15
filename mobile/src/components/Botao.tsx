import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native'
import { cores, raio } from '../lib/tema'

interface Props {
  titulo: string
  onPress: () => void
  variante?: 'primaria' | 'secundaria'
  carregando?: boolean
  desabilitado?: boolean
}

export function Botao({ titulo, onPress, variante = 'primaria', carregando = false, desabilitado = false }: Props) {
  const primaria = variante === 'primaria'
  const inativo = desabilitado || carregando

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inativo, busy: carregando }}
      disabled={inativo}
      onPress={onPress}
      style={({ pressed }) => [
        estilos.botao,
        primaria ? estilos.primaria : estilos.secundaria,
        (pressed || inativo) && estilos.apagado,
      ]}
    >
      {carregando ? (
        <ActivityIndicator color={primaria ? '#ffffff' : cores.primaria} />
      ) : (
        <Text style={[estilos.texto, { color: primaria ? '#ffffff' : cores.primaria }]}>{titulo}</Text>
      )}
    </Pressable>
  )
}

const estilos = StyleSheet.create({
  botao: {
    minHeight: 52,
    borderRadius: raio,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  primaria: {
    backgroundColor: cores.primaria,
  },
  secundaria: {
    backgroundColor: cores.superficie,
    borderWidth: 1,
    borderColor: cores.primariaSuave,
  },
  apagado: {
    opacity: 0.7,
  },
  texto: {
    fontSize: 16,
    fontWeight: '700',
  },
})
