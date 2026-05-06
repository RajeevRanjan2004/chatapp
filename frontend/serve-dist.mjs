import { createReadStream, existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { cwd } from "node:process";

const host = "127.0.0.1";
const port = Number(process.env.PORT || 3000);
const distDir = join(cwd(), "dist");

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
};

function resolveFile(urlPath) {
  const safePath = normalize(decodeURIComponent(urlPath).replace(/^\/+/, ""));
  const candidate = join(distDir, safePath);

  if (existsSync(candidate) && statSync(candidate).isFile()) {
    return candidate;
  }

  return join(distDir, "index.html");
}

const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url || "/", `http://${host}:${port}`).pathname;
    const filePath = resolveFile(pathname);
    const extension = extname(filePath).toLowerCase();
    const contentType = contentTypes[extension] || "application/octet-stream";

    response.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": extension === ".html" ? "no-cache" : "public, max-age=3600",
    });

    if (extension === ".html") {
      const html = await readFile(filePath);
      response.end(html);
      return;
    }

    createReadStream(filePath).pipe(response);
  } catch (error) {
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(`Local server error: ${error.message}`);
  }
});

server.listen(port, host, () => {
  console.log(`Static app running at http://${host}:${port}`);
});
