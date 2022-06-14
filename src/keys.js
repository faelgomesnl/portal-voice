module.exports = {
    database : {
        user: 'sa',
        password: 'SQL.M3t0d0@2021#',
        server: '192.168.4.4', 
        database: 'MGE_PROD',
        connectionTimeout: 300000,
        requestTimeout: 300000,
        pool: {
          idleTimeoutMillis: 300000,
          max: 100
        }
        
    } 
};

/* module.exports = {
    database : {
        user: 'sankhya',
        password: 'tecsis',
        server: '192.168.4.4', 
        database: 'MGE_TESTE',
        pool: {
            max: 10,
            min: 0,
            idleTimeoutMillis: 60000
        }
        
    } 
}; */