module.exports = {
  apps: [
    {
      name: "codex-channel",
      script: "dist/index.js",
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_restarts: 10,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
