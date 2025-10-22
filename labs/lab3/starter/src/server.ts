import express from "express";

const app = express();
const PORT = process.env.PORT ?? 8080;

app.get("/", (_req, res) => {
  res.json({ message: "ContainrLab Lab 3" });
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
