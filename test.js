import worker from './worker.js';

console.log('🧪 Iniciando Bateria de Testes do MunicipiosPro (5.570 Cidades IBGE)...\n');

let pass = 0;
function assert(cond, msg) {
  if (cond) {
    pass++;
    console.log(`  ✅ ${msg}`);
  } else {
    console.error(`  ❌ FALHA: ${msg}`);
    throw new Error(msg);
  }
}

// 1. Teste de Busca de Município por Nome
const reqBusca = new Request('https://api.test/api/municipios/busca?q=São+Paulo');
const resBusca = await worker.fetch(reqBusca);
assert(resBusca.status === 200, 'Busca por nome retorna 200 OK');
const bodyBusca = await resBusca.json();
assert(bodyBusca.ok === true && bodyBusca.resultados.length > 0, 'Encontra São Paulo');
assert(bodyBusca.resultados[0].codigoIbge === '3550308', 'Código IBGE de São Paulo correto (3550308)');

// 2. Teste de Consulta por Código IBGE
const reqIbge = new Request('https://api.test/api/municipios/3550308');
const resIbge = await worker.fetch(reqIbge);
assert(resIbge.status === 200, 'Consulta direta por IBGE retorna 200 OK');
const bodyIbge = await resIbge.json();
assert(bodyIbge.municipio.nome.includes('Paulo'), 'Nome retornado confere com o código');
assert(bodyIbge.municipio.latitude !== undefined, 'Latitude presente');

// 3. Teste de Cálculo de Distância Haversine (São Paulo -> Rio de Janeiro)
const reqDist = new Request('https://api.test/api/municipios/distancia?origem=3550308&destino=3304557');
const resDist = await worker.fetch(reqDist);
assert(resDist.status === 200, 'Cálculo de distância responde 200 OK');
const bodyDist = await resDist.json();
const distKm = bodyDist.logistica.distanciaLinhaRetaKm;
assert(distKm > 340 && distKm < 380, `Distância em linha reta compatível (~358km): ${distKm}km`);
assert(bodyDist.logistica.distanciaRodoviariaKm > 400, 'Distância rodoviária calculada');

// 4. Teste de Listagem de UFs
const reqUfs = new Request('https://api.test/api/municipios/ufs');
const resUfs = await worker.fetch(reqUfs);
assert(resUfs.status === 200, 'Listagem de UFs responde 200 OK');
const bodyUfs = await resUfs.json();
assert(bodyUfs.total === 27, 'Total de 27 Unidades Federativas confirmadas');

console.log(`\n🎉 Todos os ${pass} testes do MunicipiosPro passaram com 100% de sucesso!`);
