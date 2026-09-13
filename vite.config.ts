import { defineConfig } from "vite";
import basicSsl from "@vitejs/plugin-basic-ssl";

export default defineConfig({
  base: "./",
  // Self-signed HTTPS so camera access (getUserMedia requires a secure
  // context) works when testing from another device over LAN, not just
  // localhost. Only affects `vite`/`vite preview`, not the production build.
  plugins: [basicSsl()],
  server: { host: true },
  preview: { host: true },
  build: {
    rollupOptions: {
      input: {
        main: "index.html",
        decode: "decode.html",
        generate: "generate.html",
      },
    },
  },
});
