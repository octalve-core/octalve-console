module.exports = {
  apps: [
    {
      name: "octalve-console-frontend",
      cwd: "/home/octalvecloud/apps/octalve-console/frontend",
      script: "pnpm",
      args: "start",
      env: {
        NODE_ENV: "production",
        PORT: "3001",
        HOSTNAME: "127.0.0.1"
      }
    }
  ]
};
