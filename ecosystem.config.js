module.exports = {
  apps: [
    {
      name: "soc-backend",
      cwd: "/home/cyberpull.space/public_html/Backend",
      script: "server.js",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: 5000
      },
      error_file: "/home/cyberpull.space/public_html/logs/soc-backend-error.log",
      out_file: "/home/cyberpull.space/public_html/logs/soc-backend-out.log",
      log_file: "/home/cyberpull.space/public_html/logs/soc-backend-combined.log",
      time: true,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G"
    },
    {
      name: "soc-frontend",
      cwd: "/home/cyberpull.space/public_html/Frontend",
      script: "node_modules/.bin/next",
      args: "start -H 0.0.0.0",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        HOSTNAME: "0.0.0.0"
      },
      error_file: "/home/cyberpull.space/public_html/logs/soc-frontend-error.log",
      out_file: "/home/cyberpull.space/public_html/logs/soc-frontend-out.log",
      log_file: "/home/cyberpull.space/public_html/logs/soc-frontend-combined.log",
      time: true,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G"
    }
  ]
};
