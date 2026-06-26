module.exports = {
  apps: [
    {
      name: "backend",
      script: "run.py",
      interpreter: "python3",
      cwd: "./backend",
      watch: false,
      autorestart: true,
      restart_delay: 3000,
      env: {
        PYTHONUNBUFFERED: "1",
      },
    },
    {
      name: "bot",
      script: "bot.py",
      interpreter: "python3",
      cwd: "./bot",
      watch: false,
      autorestart: true,
      restart_delay: 3000,
      env: {
        PYTHONUNBUFFERED: "1",
      },
    },
  ],
};
