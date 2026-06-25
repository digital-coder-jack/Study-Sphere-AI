module.exports = {
  apps: [
    {
      name: 'ai-notebook',
      script: 'uvicorn',
      args: 'backend.main:app --host 0.0.0.0 --port 3000',
      cwd: '/home/user/webapp',
      interpreter: 'none',
      env: {
        JWT_SECRET: 'local-dev-secret-please-change-in-prod',
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork',
    },
  ],
};
