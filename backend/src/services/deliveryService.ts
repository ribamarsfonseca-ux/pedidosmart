import axios from 'axios';

/**
 * Interface para as configurações de frete do restaurante
 */
interface RestauranteConfig {
    raio_max_km: number;
    taxa_fixa: number;
    valor_km: number;
}

/**
 * Módulo de Cálculo de Frete via Geoapify Routing API
 * Calculo baseado na distância real da rota entre dois pontos.
 */
export const calcularFreteGeoapify = async (
    latOrigem: number,
    lonOrigem: number,
    latDestino: number,
    lonDestino: number,
    configRestaurante: RestauranteConfig
) => {
    const API_KEY = process.env.GEOAPIFY_API_KEY;

    if (!API_KEY) {
        throw new Error('GEOAPIFY_API_KEY não configurada no ambiente.');
    }

    try {
        // Geoapify Routing API endpoint
        const url = `https://api.geoapify.com/v1/routing?waypoints=${latOrigem},${lonOrigem}|${latDestino},${lonDestino}&mode=drive&apiKey=${API_KEY}`;

        const response = await axios.get(url);

        if (!response.data.features || response.data.features.length === 0) {
            throw new Error('Rota não encontrada para as coordenadas fornecidas.');
        }

        // Distância total em metros
        const distanciaMetros = response.data.features[0].properties.distance;
        const distanciaKm = distanciaMetros / 1000;

        // Tempo estimado em segundos (convertendo para minutos)
        const tempoSegundos = response.data.features[0].properties.time;
        const tempoEstimadoMinutos = Math.round(tempoSegundos / 60);

        // Validação de Raio Máximo
        if (distanciaKm > configRestaurante.raio_max_km) {
            return {
                success: false,
                error: `Distância de ${distanciaKm.toFixed(2)} km excede o limite de ${configRestaurante.raio_max_km} km.`,
                distanciaKm
            };
        }

        // Cálculo do Preço: Taxa Fixa + (Distância * Valor por KM)
        const valorFrete = configRestaurante.taxa_fixa + (distanciaKm * configRestaurante.valor_km);

        return {
            success: true,
            valorFrete: Number(valorFrete.toFixed(2)),
            distanciaKm: Number(distanciaKm.toFixed(2)),
            tempoEstimadoMinutos,
            meta: {
                rawDistance: distanciaMetros,
                rawTime: tempoSegundos
            }
        };

    } catch (error: any) {
        console.error('Erro na Geoapify Routing API:', error.response?.data || error.message);
        throw new Error('Falha ao calcular rota externa.');
    }
};
