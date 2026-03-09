import axios from 'axios';

export interface RestaurantConfig {
    deliveryFee: number; // Taxa fixa
    valorKm: number;
    raioMaxKm: number;
    lat: number;
    lon: number;
    geoapifyApiKey?: string | null;
}

export const calcularFreteGeoapify = async (
    latDestino: number,
    lonDestino: number,
    config: RestaurantConfig
): Promise<{ error?: string; distanceKm?: number; price?: number }> => {
    try {
        const apiKey = config.geoapifyApiKey || process.env.GEOAPIFY_API_KEY;
        if (!apiKey) {
            return { error: 'API Key do Geoapify não configurada no servidor nem no lojista.' };
        }

        const url = `https://api.geoapify.com/v1/routing?waypoints=${config.lat},${config.lon}|${latDestino},${lonDestino}&mode=drive&apiKey=${apiKey}`;

        const response = await axios.get(url);

        if (!response.data.features || response.data.features.length === 0) {
            return { error: 'Não foi possível calcular a rota para este endereço.' };
        }

        const distanceMeters = response.data.features[0].properties.distance;
        const distanceKm = distanceMeters / 1000;

        if (distanceKm > config.raioMaxKm) {
            return { error: `A distância (${distanceKm.toFixed(1)}km) excede o raio máximo de entrega (${config.raioMaxKm}km).` };
        }

        const rawPrice = config.deliveryFee + (distanceKm * config.valorKm);

        // Arredondamento inteligente: decimal ≤ 0.40 → inteiro inferior | > 0.40 → inteiro superior
        const intPart = Math.floor(rawPrice);
        const decimal = rawPrice - intPart;
        const price = decimal <= 0.40 ? intPart : Math.ceil(rawPrice);

        return {
            distanceKm,
            price
        };

    } catch (error) {
        console.error('Geoapify Routing Error:', error);
        return { error: 'Erro ao conectar com o serviço de mapas.' };
    }
};
