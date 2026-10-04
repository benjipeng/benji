import { readFileSync } from "node:fs";
import { defineConfig } from "vite";

// index.html placeholders: <!-- garden --> becomes one empty bed per plant in
// src/garden/plants.json, in paint order, and <!-- year --> becomes the build year.
const plants: { name: string }[] = JSON.parse(readFileSync(new URL("./src/garden/plants.json", import.meta.url), "utf8"));

export default defineConfig({
  plugins: [
    {
      name: "garden",
      transformIndexHtml: (html) =>
        html
          .replace("<!-- garden -->", plants.map(({ name }) => `<div class="plant g-${name}" data-plant="${name}"></div>`).join("\n      "))
          .replace("<!-- year -->", String(new Date().getFullYear())),
    },
  ],
});
