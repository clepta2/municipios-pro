export interface Municipio {
  ibge: string;
  nome: string;
  uf: string;
  lat: number;
  lon: number;
  ddd?: string;
}

export interface DistanciaResultado {
  origem: Municipio;
  destino: Municipio;
  distanciaKm: number;
  estimativaRodoviaria: {
    distanciaAproxKm: number;
    tempoEstimadoHoras: number;
    custoEstimadoPedagio?: number;
  };
}

export class MunicipiosPro {
  static buscar(query: string, options?: { uf?: string; limit?: number }): Promise<{ ok: boolean; resultados: Municipio[] }>;
  static consultar(ibge: string): Promise<{ ok: boolean; municipio: Municipio }>;
  static calcularDistancia(origemIbge: string, destinoIbge: string): Promise<DistanciaResultado>;
  static listarUfs(): Promise<{ ok: boolean; ufs: string[] }>;
}

export default MunicipiosPro;
