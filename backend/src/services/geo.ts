const RAIO_DA_TERRA_METROS = 6_371_000

export function coordenadasValidas(latitude: number, longitude: number) {
  return Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 &&
    Number.isFinite(longitude) && longitude >= -180 && longitude <= 180
}

/** Distância entre duas coordenadas pela fórmula de Haversine. */
export function distanciaEmMetros(
  latitudeInicial: number,
  longitudeInicial: number,
  latitudeFinal: number,
  longitudeFinal: number,
) {
  const radianos = (graus: number) => (graus * Math.PI) / 180
  const diferencaLatitude = radianos(latitudeFinal - latitudeInicial)
  const diferencaLongitude = radianos(longitudeFinal - longitudeInicial)
  const a =
    Math.sin(diferencaLatitude / 2) ** 2 +
    Math.cos(radianos(latitudeInicial)) *
      Math.cos(radianos(latitudeFinal)) *
      Math.sin(diferencaLongitude / 2) ** 2

  const valorLimitado = Math.min(1, Math.max(0, a))
  return RAIO_DA_TERRA_METROS * 2 * Math.atan2(Math.sqrt(valorLimitado), Math.sqrt(1 - valorLimitado))
}
