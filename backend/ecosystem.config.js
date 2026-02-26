module.exports = {
    apps: [{
        name: 'smartpedidos-backend',
        script: 'src/server.ts',
        interpreter: './node_modules/.bin/tsx',
        instances: 1,
        autorestart: true,
        watch: false,
        max_memory_restart: '1G',
        env: {
            NODE_ENV: 'production',
            PORT: 3000
        },
        error_file: 'logs/err.log',
        out_file: 'logs/out.log',
        log_date_format: 'YYYY-MM-DD HH:mm:ss'
    }]
};
