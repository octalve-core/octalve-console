const { createServer } = require("http");
const next = require("next");

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = process.env.PORT || 3001;

const app = next({
  dev,
  hostname,
  port,
});

const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      await handle(req, res);
    } catch (err) {
      console.error("Server error:", err);
      res.statusCode = 500;
      res.end("Internal Server Error");
    }
  }).listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});