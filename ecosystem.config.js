module.exports = {
  apps: [{
    name: 'customer-support-rep',
    script: 'server.js',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    watch: false,
    max_memory_restart: '256M'
  }]
};
