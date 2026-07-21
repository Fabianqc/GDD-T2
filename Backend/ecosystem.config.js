module.exports = {
  apps: [
    {
      name: "gdd-t2-backend",
      cwd: "./",
      script: "venv/bin/uvicorn",
      args: "main:app --host 0.0.0.0 --port 8000 --workers 2",
      interpreter: "none",
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
