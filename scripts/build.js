import fs from "fs/promises";
import Mustache from "mustache";
import config from "../config.js";

const DIST = config.build.dist;
const PAGES = config.build.pages;

async function renderFile(source, dest) {
  const file = await fs.readFile(source);
  const result = Mustache.render(file.toString(), config);
  await fs.writeFile(dest, result);
}

async function buildHtmlFiles() {
  const files = await fs.readdir(PAGES);
  for (const file of files) {
    if (file === "index.html") {
      await renderFile(`${PAGES}/${file}`, `${DIST}/${file}`);
    } else {
      const folderName = file.split(".html")[0];
      await fs.mkdir(`${DIST}/${folderName}`);
      await renderFile(`${PAGES}/${file}`, `${DIST}/${folderName}/index.html`);
    }
  }
}

async function build() {
  await fs.mkdir(DIST);

  await buildHtmlFiles();
}

build();
