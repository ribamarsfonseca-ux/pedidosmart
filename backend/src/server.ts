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

// Serve os arquivos estáticos do frontend
app.use(express.static(path.join(__dirname, '../../frontend')));

// Rota base para a API
app.use('/api', apiRoutes);

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
