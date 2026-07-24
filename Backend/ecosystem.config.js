module.exports = {
  apps: [
    {
      name: "gdd-t2-backend",
      cwd: "./",
      script: "venv/bin/uvicorn",
      args: "main:app --host 0.0.0.0 --port 8004 --workers 2",
      interpreter: "none",
      env: {
        NODE_ENV: "production"
      }
    },
    {
      name: "gdd-t2-reminder-worker",
      cwd: "./",
      script: "venv/bin/python",
      args: "reminder_worker.py",
      interpreter: "none",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
