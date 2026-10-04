export interface Localizacao {
  latitude: number
  longitude: number
  /** Margem de erro informada pelo dispositivo, em metros. */
  precisaoMetros: number
}

/** Solicita a localização uma única vez; não há rastreamento contínuo. */
export function obterLocalizacao(): Promise<Localizacao> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Este navegador não oferece acesso à localização.'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({
        latitude: coords.latitude,
        longitude: coords.longitude,
        precisaoMetros: Math.round(coords.accuracy),
      }),
      (erro) => reject(new Error(
        erro.code === erro.PERMISSION_DENIED
          ? 'Permissão de localização negada. Autorize o acesso no navegador ou informe as coordenadas manualmente.'
          : 'Não foi possível obter a localização. Tente novamente ou informe as coordenadas manualmente.',
      )),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    )
  })
}
