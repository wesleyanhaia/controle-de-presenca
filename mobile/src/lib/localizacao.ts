import * as Location from 'expo-location'

/*
  A localização é lida uma única vez, quando o aluno abre a tela de registro,
  e só é enviada junto com o QR Code lido. Não há rastreamento contínuo nem
  leitura em segundo plano (LGPD: finalidade e necessidade).
*/

const TEMPO_LIMITE_MS = 20_000

export interface Coordenadas {
  latitude: number
  longitude: number
  /** Raio de incerteza informado pelo aparelho, em metros. */
  precisaoMetros: number | null
}

export type MotivoSemLocalizacao = 'PERMISSAO_NEGADA' | 'PERMISSAO_BLOQUEADA' | 'GPS_DESLIGADO' | 'SEM_SINAL'

export class ErroDeLocalizacao extends Error {
  readonly motivo: MotivoSemLocalizacao

  constructor(motivo: MotivoSemLocalizacao, mensagem: string) {
    super(mensagem)
    this.motivo = motivo
  }
}

export async function obterLocalizacaoAtual(): Promise<Coordenadas> {
  const permissao = await Location.requestForegroundPermissionsAsync()
  if (!permissao.granted) {
    throw permissao.canAskAgain
      ? new ErroDeLocalizacao('PERMISSAO_NEGADA', 'Sem a permissão de localização não é possível confirmar que você está na sala.')
      : new ErroDeLocalizacao(
          'PERMISSAO_BLOQUEADA',
          'A permissão de localização foi negada. Libere-a nas configurações do aparelho para registrar a presença.',
        )
  }

  if (!(await Location.hasServicesEnabledAsync())) {
    throw new ErroDeLocalizacao('GPS_DESLIGADO', 'A localização do aparelho está desligada. Ative-a e tente novamente.')
  }

  const tempoEsgotado = new Promise<never>((_, rejeitar) =>
    setTimeout(
      () => rejeitar(new ErroDeLocalizacao('SEM_SINAL', 'Não foi possível obter sua localização. Tente perto de uma janela ou com o Wi-Fi ligado.')),
      TEMPO_LIMITE_MS,
    ),
  )

  const posicao = await Promise.race([
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
    tempoEsgotado,
  ])

  return {
    latitude: posicao.coords.latitude,
    longitude: posicao.coords.longitude,
    precisaoMetros: posicao.coords.accuracy ?? null,
  }
}
