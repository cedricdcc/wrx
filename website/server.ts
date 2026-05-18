import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { extractRDF } from "wrx";
import * as N3 from "n3";
import { QueryEngine } from "@comunica/query-sparql-rdfjs";

const { namedNode, literal, defaultGraph } = N3.DataFactory;

import jsonld from "jsonld";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API route for extracting WRX
  app.post("/api/extract", async (req, res) => {
    try {
      const { uri } = req.body;
      if (!uri) {
        return res.status(400).json({ error: "URI is required" });
      }
      
      const wrxResult = await extractRDF(uri);
      
      if (!wrxResult || !wrxResult.content) {
        return res.status(404).json({ error: "No RDF content found" });
      }

      const triples: any[] = [];
      let parsed = false;

      // Ensure content is a string
      const contentStr = typeof wrxResult.content === 'string' 
        ? wrxResult.content 
        : JSON.stringify(wrxResult.content);

      const format = (wrxResult.format || '').toLowerCase();

      try {
        if (format.includes('json') && format.includes('ld')) {
          // JSON-LD support
          const json = JSON.parse(contentStr);
          const nquads = await jsonld.toRDF(json, { format: 'application/n-quads' });
          const parser = new N3.Parser({ format: 'N-Quads', baseIRI: wrxResult.url });
          const quads = parser.parse(nquads as string);
          quads.forEach(quad => {
            let datatype = '';
            if (quad.object.termType === 'Literal') {
              datatype = quad.object.datatype.value;
            }
            triples.push({
              subject: quad.subject.value,
              predicate: quad.predicate.value,
              object: quad.object.value,
              objectType: quad.object.termType,
              datatype: datatype
            });
          });
          parsed = true;
        } else {
          // Try N3 parser (supports Turtle, N-Triples, N-Quads, TriG)
          const parser = new N3.Parser({ baseIRI: wrxResult.url });
          const quads = parser.parse(contentStr);
          quads.forEach(quad => {
            let datatype = '';
            if (quad.object.termType === 'Literal') {
              datatype = quad.object.datatype.value;
            }
            triples.push({
              subject: quad.subject.value,
              predicate: quad.predicate.value,
              object: quad.object.value,
              objectType: quad.object.termType,
              datatype: datatype
            });
          });
          parsed = true;
        }
      } catch (e: any) {
        console.error(`Parsing failed for format ${format}:`, e);
        // If specific format parsing failed, we might still have partial triples or just show raw content
      }

      res.json({
        metadata: {
          source: wrxResult.source,
          format: wrxResult.format,
          url: wrxResult.url
        },
        triples,
        rawContent: parsed ? null : contentStr
      });
    } catch (error: any) {
      console.error("Extraction error:", error);
      res.status(500).json({ error: error.message || "Extraction failed" });
    }
  });

  // API route for SPARQL query
  app.post("/api/query", async (req, res) => {
    try {
      const { triples, query } = req.body;
      if (!triples || !query) {
        return res.status(400).json({ error: "Triples and query are required" });
      }

      const store = new N3.Store();
      triples.forEach((t: any) => {
        store.addQuad(
          namedNode(t.subject),
          namedNode(t.predicate),
          t.objectType === 'Literal' ? literal(t.object) : namedNode(t.object),
          defaultGraph()
        );
      });

      const myEngine = new QueryEngine();
      const bindingsStream = await myEngine.queryBindings(query, {
        sources: [store],
      });

      const bindings = await bindingsStream.toArray();
      const formattedResults = bindings.map(b => {
        const resObj: any = {};
        for (const [key, value] of b) {
          resObj[key.value] = value.value;
        }
        return resObj;
      });

      res.json({ results: formattedResults });
    } catch (error: any) {
      console.error("SPARQL error:", error);
      res.status(500).json({ error: error.message || "Query failed" });
    }
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
