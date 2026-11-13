# Municipios Pro — SDK & API de Cidades do Brasil & Distâncias

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Edge Latency](https://img.shields.io/badge/Latency-%3C1ms-10b981.svg)](https://ponte.ozpro.com.br)
[![Municípios](https://img.shields.io/badge/Cidades-5.570%20IBGE-a855f7.svg)](https://ibge.gov.br)

SDK e API Oficial contendo **todos os 5.570 municípios do Brasil**, coordenadas geodésicas, cálculo de distâncias em linha reta (Haversine), estimativa de trajeto rodoviário e precificação logística de frete na borda Cloudflare Edge (<1ms).

---

## 🚀 Uso Rápido

```bash
npm install municipios-pro
```

### Exemplo em JavaScript
```javascript
// 1. Consulta distância entre São Paulo e Rio de Janeiro
const resp = await fetch('https://ponte.ozpro.com.br/api/municipios/distancia?origem=3550308&destino=3304557');
const data = await resp.json();

console.log(`Distância em linha reta: ${data.distanciaKm} km`);
console.log(`Estimativa rodoviária: ${data.estimativaRodoviaria.distanciaAproxKm} km`);
```

---

## 🧪 Testes Unitários

```bash
npm test
```

Licença **MIT** &copy; 2026 Clepta Tech.
