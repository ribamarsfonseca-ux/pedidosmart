import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import apiRoutes from './routes';
import path from 'path';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(helmet({
    contentSecurityPolicy: false, // Necessário para carregar recursos externos se houver
}));
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve os arquivos estáticos do frontend (Ajustado para VPS)
const frontendPath = path.join(__dirname, '..', '..', 'frontend');

// Rota dinâmica para o Menu (para meta tags do WhatsApp)
app.get(['/menu/:slug', '/m/:slug'], async (req, res) => {
    const { slug } = req.params;
    const fs = require('fs');
    const prisma = require('./prismaClient').default;

    try {
        const tenant = await prisma.tenant.findUnique({
            where: { slug },
            select: { name: true, logoUrl: true }
        });

        const indexPath = path.join(frontendPath, 'menu', 'index.html');
        let html = fs.readFileSync(indexPath, 'utf8');

        if (tenant) {
            const title = `${tenant.name} | Cardápio Digital`;
            const image = tenant.logoUrl || 'https://smartpede.com.br/logo.png';

            // Injeta as Meta Tags
            const metaTags = `
                <title>${title}</title>
                <meta property="og:title" content="${title}">
                <meta property="og:description" content="Peça online pelo nosso cardápio digital!">
                <meta property="og:image" content="${image}">
                <meta property="og:type" content="website">
                <meta name="twitter:card" content="summary_large_image">
            `;
            html = html.replace('</head>', `${metaTags}\n</head>`);
            // Remove o título original se existir para não duplicar
            html = html.replace(/<title>.*?<\/title>/, '');
        }

        res.send(html);
    } catch (e) {
        res.sendFile(path.join(frontendPath, 'menu', 'index.html'));
    }
});

app.use(express.static(frontendPath));

// Rota base para a API
app.use('/api', apiRoutes);

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
