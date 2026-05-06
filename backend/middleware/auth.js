const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

function extractBearerToken(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw.toLowerCase().startsWith("bearer ") ? raw.slice(7).trim() : raw;
}

function verifyAuthToken(token) {
  const normalizedToken = extractBearerToken(token);
  if (!normalizedToken) {
    throw new Error("Missing auth token");
  }

  return jwt.verify(normalizedToken, JWT_SECRET);
}

function requireAuth(req, res, next) {
  try {
    const payload = verifyAuthToken(req.headers.authorization);
    req.user = { id: String(payload.id) };
    next();
  } catch {
    res.status(401).json({ msg: "Unauthorized" });
  }
}

module.exports = {
  extractBearerToken,
  requireAuth,
  verifyAuthToken,
};
