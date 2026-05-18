import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API route for extracting WRX (deprecated, migrated client-side)
  app.post("/api/extract", async (req, res) => {
    res.status(501).json({
      error: "This backend API endpoint has been deprecated and migrated entirely to the client side in the browser."
    });
  });

  // API route for SPARQL query (deprecated, migrated client-side)
  app.post("/api/query", async (req, res) => {
    res.status(501).json({
      error: "This backend API endpoint has been deprecated and migrated entirely to the client side in the browser."
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
