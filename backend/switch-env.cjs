const fs = require('fs');
const path = require('path');

const mode = process.argv[2]; // 'local' ou 'prod'
const prodUrl = process.argv[3]; // URL do Render

if (!mode || (mode === 'prod' && !prodUrl)) {
    console.log('Uso: node switch-env.cjs <local|prod> [url_producao]');
    process.exit(1);
}

const frontendPath = path.join(__dirname, '..', 'frontend');
const filesToUpdate = [
    path.join(frontendPath, 'admin', 'js', 'auth-api.js'),
    path.join(frontendPath, 'admin', 'js', 'dashboard.js'), // Assumindo que existem
    path.join(frontendPath, 'menu', 'js', 'menu-api.js')   // Assumindo que existem
];

const targetUrl = mode === 'prod' ? prodUrl : 'http://localhost:3000';

filesToUpdate.forEach(file => {
    if (fs.existsSync(file)) {
        let content = fs.readFileSync(file, 'utf8');
        // Substitui a linha do API_URL
        content = content.replace(/const API_URL = ['"].*?['"];/g, `const API_URL = '${targetUrl}/api';`);
        fs.writeFileSync(file, content);
        console.log(`✅ Atualizado: ${path.basename(file)} -> ${targetUrl}`);
    }
});
