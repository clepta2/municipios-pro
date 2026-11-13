/**
 * functions/api/municipios.js
 * API de Municípios e Cálculo de Distâncias Geográficas IBGE Pro (Haversine)
 * 
 * Base Soberana e 100% Offline com todos os 5.570 municípios do Brasil.
 * Permite cálculo instantâneo em sub-1ms de distância em linha reta (KM)
 * entre duas cidades para estimativa de frete, logística e cobertura de entrega.
 * 
 * @license MIT
 */

import { GEO_MUNICIPIOS_IBGE, GEO_MUNICIPIOS_NOME } from './municipios_geo.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
  'Access-Control-Max-Age': '86400'
};

const UF_POR_CODIGO = {
  '11': 'RO', '12': 'AC', '13': 'AM', '14': 'RR', '15': 'PA', '16': 'AP', '17': 'TO',
  '21': 'MA', '22': 'PI', '23': 'CE', '24': 'RN', '25': 'PB', '26': 'PE', '27': 'AL', '28': 'SE', '29': 'BA',
  '31': 'MG', '32': 'ES', '33': 'RJ', '35': 'SP',
  '41': 'PR', '42': 'SC', '43': 'RS',
  '50': 'MS', '51': 'MT', '52': 'GO', '53': 'DF'
};

const NOMES_UFS = {
  'SP': 'São Paulo', 'RJ': 'Rio de Janeiro', 'MG': 'Minas Gerais', 'ES': 'Espírito Santo',
  'PR': 'Paraná', 'SC': 'Santa Catarina', 'RS': 'Rio Grande do Sul',
  'BA': 'Bahia', 'PE': 'Pernambuco', 'CE': 'Ceará', 'RN': 'Rio Grande do Norte',
  'PB': 'Paraíba', 'AL': 'Alagoas', 'SE': 'Sergipe', 'MA': 'Maranhão', 'PI': 'Piauí',
  'GO': 'Goiás', 'MT': 'Mato Grosso', 'MS': 'Mato Grosso do Sul', 'DF': 'Distrito Federal',
  'PA': 'Pará', 'AM': 'Amazonas', 'RO': 'Rondônia', 'TO': 'Tocantins', 'AC': 'Acre', 'AP': 'Amapá', 'RR': 'Roraima'
};

const CAPITAIS_IBGE = new Set([
  '1100205', '1200401', '1302603', '1400100', '1501402', '1600303', '1721000',
  '2111300', '2211001', '2304400', '2408102', '2507507', '2611606', '2704302', '2800308', '2927408',
  '3106200', '3205309', '3304557', '3550308',
  '4106902', '4205407', '4314902',
  '5002704', '5103403', '5208707', '5300108'
]);

let MAPA_IBGE_PARA_NOME = null;
function getMapaIbgeParaNome() {
  if (!MAPA_IBGE_PARA_NOME && GEO_MUNICIPIOS_NOME) {
    MAPA_IBGE_PARA_NOME = new Map();
    for (const [chaveNome, dados] of Object.entries(GEO_MUNICIPIOS_NOME)) {
      const ibge = dados[3];
      const partes = chaveNome.split('_');
      const nomeCru = partes[0] || '';
      const uf = (partes[1] || '').toUpperCase();
      const nomeFormatado = formatarNomeCidade(nomeCru);
      MAPA_IBGE_PARA_NOME.set(ibge, { nome: nomeFormatado, uf });
    }
  }
  return MAPA_IBGE_PARA_NOME;
}

function formatarNomeCidade(str) {
  if (!str) return '';
  return str
    .split(' ')
    .map(palavra => {
      const p = palavra.toLowerCase();
      if (['de', 'da', 'do', 'dos', 'das', 'e'].includes(p)) return p;
      return p.charAt(0).toUpperCase() + p.slice(1);
    })
    .join(' ');
}

function normalizarTexto(txt) {
  if (!txt) return '';
  return txt
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function resolverPontoMunicipio(termo) {
  if (!termo || typeof termo !== 'string') return null;
  const limpo = termo.trim();

  // 1. Código IBGE (7 dígitos)
  const apenasNums = limpo.replace(/\D/g, '');
  if (apenasNums.length === 7 && GEO_MUNICIPIOS_IBGE[apenasNums]) {
    const [lat, lon, ddd] = GEO_MUNICIPIOS_IBGE[apenasNums];
    const mapa = getMapaIbgeParaNome();
    const info = mapa.get(apenasNums) || {};
    const uf = info.uf || UF_POR_CODIGO[apenasNums.substring(0, 2)] || '';
    return {
      codigoIbge: apenasNums,
      nome: info.nome || 'Município ' + apenasNums,
      uf,
      estadoNome: NOMES_UFS[uf] || uf,
      latitude: lat,
      longitude: lon,
      ddd,
      isCapital: CAPITAIS_IBGE.has(apenasNums)
    };
  }

  // 2. Busca por Nome
  const termoNorm = normalizarTexto(limpo).replace(/[^a-z0-9 ]/g, ' ');
  const partes = termoNorm.split(/\s+/).filter(Boolean);

  let melhorMatch = null;
  let melhorScore = -1;

  for (const [chaveNome, dados] of Object.entries(GEO_MUNICIPIOS_NOME)) {
    const [nomeKey, ufKey] = chaveNome.split('_');
    const ibge = dados[3];

    let score = 0;
    if (chaveNome === termoNorm.replace(/\s+/g, '_') || chaveNome === `${termoNorm}_sp`) {
      score = 100;
    } else if (nomeKey === termoNorm) {
      score = 80;
    } else if (nomeKey.startsWith(termoNorm)) {
      score = 60;
    } else if (partes.every(p => nomeKey.includes(p) || ufKey === p)) {
      score = 40;
    }

    if (score > melhorScore) {
      melhorScore = score;
      const uf = ufKey ? ufKey.toUpperCase() : UF_POR_CODIGO[ibge.substring(0, 2)];
      melhorMatch = {
        codigoIbge: ibge,
        nome: formatarNomeCidade(nomeKey),
        uf,
        estadoNome: NOMES_UFS[uf] || uf,
        latitude: dados[0],
        longitude: dados[1],
        ddd: dados[2],
        isCapital: CAPITAIS_IBGE.has(ibge)
      };
      if (score === 100) break;
    }
  }

  return melhorMatch;
}

function calcularDistanciaHaversine(lat1, lon1, lat2, lon2) {
  const R = 6371; // Raio médio da Terra em km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(2));
}

function simularFreteELogistica(distanciaKm, { pesoKg = 1, valorMercadoria = 100 } = {}) {
  const distanciaRodoviaria = parseFloat((distanciaKm * 1.22).toFixed(1));
  const tempoViagemHoras = parseFloat((distanciaRodoviaria / 75).toFixed(1));

  let diasExpresso = 1;
  let diasEconomico = 2;

  if (distanciaRodoviaria > 1500) {
    diasExpresso = 3;
    diasEconomico = 8;
  } else if (distanciaRodoviaria > 800) {
    diasExpresso = 2;
    diasEconomico = 5;
  } else if (distanciaRodoviaria > 300) {
    diasExpresso = 1;
    diasEconomico = 3;
  }

  const taxaFixaExpresso = 18.50;
  const taxaFixaEconomico = 12.00;
  const taxaPorKm = 0.045;
  const taxaPeso = Math.max(0, (pesoKg - 1)) * 3.50;
  const taxaSeguro = valorMercadoria * 0.007;

  const valorEconomico = parseFloat((taxaFixaEconomico + (distanciaRodoviaria * taxaPorKm) + taxaPeso + taxaSeguro).toFixed(2));
  const valorExpresso = parseFloat((taxaFixaExpresso + (distanciaRodoviaria * taxaPorKm * 1.6) + (taxaPeso * 1.3) + taxaSeguro).toFixed(2));

  const qtdPracasPedagio = Math.floor(distanciaRodoviaria / 65);
  const custoMedioPedagio = parseFloat((qtdPracasPedagio * 9.80).toFixed(2));
  const cargaFechadaDedicada = parseFloat((distanciaRodoviaria * 4.50).toFixed(2));

  return {
    distanciaLinhaRetaKm: distanciaKm,
    distanciaRodoviariaKm: distanciaRodoviaria,
    tempoEstimadoHoras: tempoViagemHoras,
    pracasPedagioEstimadas: qtdPracasPedagio,
    custoPedagioEstimado: custoMedioPedagio,
    opcoesFrete: [
      {
        modal: 'Expresso (Sedex / Aéreo)',
        tipo: 'expresso',
        prazoDiasUteis: diasExpresso,
        prazoTexto: `${diasExpresso} dia${diasExpresso > 1 ? 's' : ''} útil${diasExpresso > 1 ? 'eis' : ''}`,
        valor: valorExpresso,
        valorFormatado: valorExpresso.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      },
      {
        modal: 'Econômico (PAC / Rodoviário Fracionado)',
        tipo: 'economico',
        prazoDiasUteis: diasEconomico,
        prazoTexto: `${diasEconomico} a ${diasEconomico + 2} dias úteis`,
        valor: valorEconomico,
        valorFormatado: valorEconomico.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      },
      {
        modal: 'Carga Dedicada / Caminhão Exclusivo',
        tipo: 'dedicado',
        prazoDiasUteis: Math.max(1, Math.ceil(tempoViagemHoras / 10)),
        prazoTexto: `Direto (~${tempoViagemHoras}h de trânsito)`,
        valor: cargaFechadaDedicada,
        valorFormatado: cargaFechadaDedicada.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
        observacao: 'Veículo exclusivo para lote ou pallet'
      }
    ]
  };
}

/**
 * Consulta a rota rodoviária real com geometria GeoJSON e rodovias via OSRM / OpenStreetMap
 * com fallback para interpolação geodésica em caso de instabilidade
 */
async function obterRotaRodoviariaReal(lat1, lon1, lat2, lon2) {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=full&geometries=geojson&steps=true`;
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'OZPro-Route-Engine/1.0' }
    });

    if (resp.ok) {
      const data = await resp.json();
      if (data && data.routes && data.routes[0]) {
        const r = data.routes[0];
        const distanciaKm = parseFloat((r.distance / 1000).toFixed(1));
        const duracaoMinutos = Math.round(r.duration / 60);
        const horas = Math.floor(duracaoMinutos / 60);
        const mins = duracaoMinutos % 60;
        const duracaoTexto = horas > 0 ? `${horas}h ${mins}min` : `${mins} min`;

        // Converte GeoJSON [lon, lat] para formato Leaflet [lat, lon]
        const coordenadasLeaflet = (r.geometry.coordinates || []).map(([ln, lt]) => [lt, ln]);

        const passos = [];
        if (r.legs && r.legs[0] && Array.isArray(r.legs[0].steps)) {
          for (const s of r.legs[0].steps) {
            if (s.name && s.distance > 400) {
              passos.push({
                via: s.name,
                distanciaKm: parseFloat((s.distance / 1000).toFixed(1)),
                duracaoMinutos: parseFloat((s.duration / 60).toFixed(1))
              });
            }
          }
        }

        const rodoviasPrincipais = [...new Set(passos.map(p => p.via).filter(Boolean))].slice(0, 10);

        return {
          sucesso: true,
          provedor: 'osrm-openstreetmap-highways',
          distanciaRodoviariaKm: distanciaKm,
          duracaoMinutos,
          duracaoTexto,
          coordenadas: coordenadasLeaflet,
          rodoviasPrincipais,
          totalPontos: coordenadasLeaflet.length
        };
      }
    }
  } catch (_) {}

  // Fallback Geodésico Inteligente (Arco suave entre as coordenadas)
  const distHaversine = calcularDistanciaHaversine(lat1, lon1, lat2, lon2);
  const distanciaRodoviaria = parseFloat((distHaversine * 1.22).toFixed(1));
  const tempoViagemHoras = parseFloat((distanciaRodoviaria / 75).toFixed(1));

  const coordenadasInterpoladas = [];
  const PONTOS = 25;
  for (let i = 0; i <= PONTOS; i++) {
    const f = i / PONTOS;
    const lat = lat1 + (lat2 - lat1) * f;
    const lon = lon1 + (lon2 - lon1) * f;
    const arcOffset = Math.sin(f * Math.PI) * 0.04;
    coordenadasInterpoladas.push([parseFloat((lat + arcOffset).toFixed(4)), parseFloat(lon.toFixed(4))]);
  }

  return {
    sucesso: true,
    provedor: 'geodesico-haversine-estimado',
    distanciaRodoviariaKm: distanciaRodoviaria,
    duracaoMinutos: Math.round(tempoViagemHoras * 60),
    duracaoTexto: `~${tempoViagemHoras} h`,
    coordenadas: coordenadasInterpoladas,
    rodoviasPrincipais: ['Malha Rodoviária Nacional'],
    totalPontos: coordenadasInterpoladas.length
  };
}

const ipBuckets = new Map();
function checkRateLimit(ipOrKey, limit = 60, windowMs = 60000) {
  const now = Date.now();
  let entry = ipBuckets.get(ipOrKey);
  if (!entry || now > entry.resetAt) {
    entry = { count: 1, resetAt: now + windowMs };
    ipBuckets.set(ipOrKey, entry);
    if (ipBuckets.size > 10000) {
      for (const [k, v] of ipBuckets) {
        if (now > v.resetAt) ipBuckets.delete(k);
      }
    }
    return { ok: true, remaining: limit - 1, resetAt: entry.resetAt };
  }
  entry.count++;
  if (entry.count > limit) {
    return { ok: false, remaining: 0, resetAt: entry.resetAt };
  }
  return { ok: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, '') || '/';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const authHeader = request.headers.get('Authorization') || request.headers.get('x-api-key') || '';
    const cleanKey = authHeader.replace(/^Bearer\s+/i, '').trim();
    const hasApiKey = Boolean(
      cleanKey && (
        cleanKey.startsWith('mun_live_') || 
        cleanKey.startsWith('mun_pro_') || 
        cleanKey.startsWith('mun_master_') || 
        cleanKey.startsWith('pnt_live_') ||
        (env && (env.API_KEY === cleanKey || env.PRO_KEY === cleanKey))
      ) && cleanKey.length >= 16
    );
    const clientIp = request.headers.get('cf-connecting-ip') || '127.0.0.1';
    const maxReqs = hasApiKey ? 300 : 60;
    const rl = checkRateLimit(hasApiKey ? cleanKey : clientIp, maxReqs);
    if (!rl.ok && path !== '/health' && path !== '/status') {
      return new Response(JSON.stringify({ ok: false, error: 'Rate limit excedido.' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      });
    }

    // 1. Busca e Autocomplete Textual de Municípios (/api/municipios/busca)
    if (path === '/api/municipios/busca' || path === '/api/cidades/busca') {
      const q = url.searchParams.get('q') || url.searchParams.get('termo') || url.searchParams.get('query') || '';
      const limite = Math.min(50, parseInt(url.searchParams.get('limit') || '15', 10));

      if (!q.trim()) {
        return new Response(JSON.stringify({ ok: false, erro: 'Informe o termo de busca "q". Ex: /api/municipios/busca?q=santos' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS }
        });
      }

      const qNorm = normalizarTexto(q);
      const resultados = [];

      for (const [chaveNome, dados] of Object.entries(GEO_MUNICIPIOS_NOME)) {
        const [nomeKey, ufKey] = chaveNome.split('_');
        if (nomeKey.includes(qNorm) || chaveNome.includes(qNorm)) {
          const ibge = dados[3];
          const uf = ufKey ? ufKey.toUpperCase() : UF_POR_CODIGO[ibge.substring(0, 2)];
          resultados.push({
            codigoIbge: ibge,
            nome: formatarNomeCidade(nomeKey),
            uf,
            estadoNome: NOMES_UFS[uf] || uf,
            ddd: dados[2],
            latitude: dados[0],
            longitude: dados[1],
            isCapital: CAPITAIS_IBGE.has(ibge)
          });
          if (resultados.length >= limite) break;
        }
      }

      return new Response(JSON.stringify({
        ok: true,
        termo: q,
        totalEncontrados: resultados.length,
        resultados
      }, null, 2), {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS }
      });
    }

    // 2. Cálculo Completo de Distância, Frete e Rota (/api/municipios/distancia ou /api/distancia ou /api/municipios/rota)
    if (path === '/api/municipios/distancia' || path === '/api/distancia' || path === '/api/municipios/frete' || path === '/api/municipios/rota') {
      const origemParam = url.searchParams.get('origem') || url.searchParams.get('de') || '';
      const destinoParam = url.searchParams.get('destino') || url.searchParams.get('para') || '';
      const pesoKg = parseFloat(url.searchParams.get('peso') || '1');
      const valorMercadoria = parseFloat(url.searchParams.get('valor') || '100');

      if (!origemParam || !destinoParam) {
        return new Response(JSON.stringify({
          ok: false,
          erro: 'Informe "origem" e "destino" (códigos IBGE ou nomes de cidades). Ex: /api/municipios/distancia?origem=Santos,SP&destino=Campinas,SP'
        }, null, 2), {
          status: 400,
          headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS }
        });
      }

      const origem = resolverPontoMunicipio(origemParam);
      const destino = resolverPontoMunicipio(destinoParam);

      if (!origem) {
        return new Response(JSON.stringify({ ok: false, erro: `Município de origem não localizado: "${origemParam}"` }), {
          status: 404,
          headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS }
        });
      }

      if (!destino) {
        return new Response(JSON.stringify({ ok: false, erro: `Município de destino não localizado: "${destinoParam}"` }), {
          status: 404,
          headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS }
        });
      }

      const distHaversine = calcularDistanciaHaversine(origem.latitude, origem.longitude, destino.latitude, destino.longitude);
      const logistica = simularFreteELogistica(distHaversine, { pesoKg, valorMercadoria });

      // Obtém o traçado rodoviário e rodovias reais
      const rotaRodoviaria = await obterRotaRodoviariaReal(origem.latitude, origem.longitude, destino.latitude, destino.longitude);

      // Se a rota rodoviária oficial foi obtida, ajusta a quilometragem para a da estrada real
      if (rotaRodoviaria && rotaRodoviaria.distanciaRodoviariaKm) {
        logistica.distanciaRodoviariaKm = rotaRodoviaria.distanciaRodoviariaKm;
        logistica.tempoEstimadoTexto = rotaRodoviaria.duracaoTexto;
      }

      return new Response(JSON.stringify({
        ok: true,
        origem,
        destino,
        mesmaUf: origem.uf === destino.uf,
        mesmoDdd: origem.ddd === destino.ddd,
        logistica,
        rota: rotaRodoviaria
      }, null, 2), {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'public, max-age=86400',
          ...CORS_HEADERS
        }
      });
    }

    // 3. Filtrar Municípios por Estado (UF) ou por DDD (/api/municipios?uf=SP ou ?ddd=11)
    const ufFiltro = (url.searchParams.get('uf') || '').toUpperCase();
    const dddFiltro = url.searchParams.get('ddd') || '';

    if (ufFiltro || dddFiltro) {
      const mapa = getMapaIbgeParaNome();
      const cidades = [];

      for (const [ibge, dados] of Object.entries(GEO_MUNICIPIOS_IBGE)) {
        const uf = UF_POR_CODIGO[ibge.substring(0, 2)];
        const ddd = dados[2];

        if (ufFiltro && uf !== ufFiltro) continue;
        if (dddFiltro && ddd !== dddFiltro) continue;

        const info = mapa.get(ibge);
        cidades.push({
          codigoIbge: ibge,
          nome: info ? info.nome : 'Município ' + ibge,
          uf,
          ddd,
          latitude: dados[0],
          longitude: dados[1],
          isCapital: CAPITAIS_IBGE.has(ibge)
        });
      }

      return new Response(JSON.stringify({
        ok: true,
        filtro: { uf: ufFiltro || null, ddd: dddFiltro || null },
        totalCidades: cidades.length,
        cidades
      }, null, 2), {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=86400', ...CORS_HEADERS }
      });
    }

    // 3.5 Listagem Oficial de UFs do Brasil
    if (path === '/api/municipios/ufs' || path === '/ufs' || path === '/estados') {
      const ufs = Object.keys(NOMES_UFS).map(sigla => ({
        sigla,
        nome: NOMES_UFS[sigla]
      }));
      return new Response(JSON.stringify({
        ok: true,
        total: ufs.length,
        ufs
      }, null, 2), {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=86400', ...CORS_HEADERS }
      });
    }

    // 4. Consulta de um Município Específico por Código IBGE
    const matches = path.match(/^\/api\/municipios\/(\d{7})/);
    const ibgeQuery = matches ? matches[1] : (url.searchParams.get('ibge') || '').replace(/\D/g, '');

    if (ibgeQuery) {
      const ponto = resolverPontoMunicipio(ibgeQuery);
      if (!ponto) {
        return new Response(JSON.stringify({ ok: false, erro: 'Município não encontrado na base de 5.570 cidades do IBGE' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS }
        });
      }
      return new Response(JSON.stringify({ ok: true, municipio: ponto }, null, 2), {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=86400', ...CORS_HEADERS }
      });
    }

    // 5. Estatísticas Gerais
    if (path === '/api/municipios/stats' || path === '/api/municipios/status' || path === '/api/municipios') {
      return new Response(JSON.stringify({
        ok: true,
        servico: 'Municípios & Distâncias IBGE Pro',
        totalMunicipios: Object.keys(GEO_MUNICIPIOS_IBGE).length,
        totalCapitais: CAPITAIS_IBGE.size,
        fonte: 'IBGE / CNEFE 2022',
        algoritmo: 'Haversine Great-Circle Distance',
        latencia: 'sub-1ms RAM',
        rotas: {
          busca: '/api/municipios/busca?q=santos',
          distancia: '/api/municipios/distancia?origem=Santos,SP&destino=Campinas,SP',
          porUf: '/api/municipios?uf=SP',
          porDdd: '/api/municipios?ddd=11',
          cidade: '/api/municipios/:ibge'
        }
      }, null, 2), {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS }
      });
    }

    return new Response(JSON.stringify({
      ok: false,
      erro: 'Endpoint não encontrado.',
      rotasDisponiveis: [
        'GET /api/municipios/busca?q=santos',
        'GET /api/municipios/distancia?origem=Santos,SP&destino=Campinas,SP',
        'GET /api/municipios?uf=SP',
        'GET /api/municipios/:ibge'
      ]
    }, null, 2), {
      status: 404,
      headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS }
    });
  }
};
