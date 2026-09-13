import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
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
