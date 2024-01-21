import fs from "fs/promises";
import Mustache from "mustache";
import frontMatter from "front-matter";
import showdown from "showdown";
import config from "../config.js";

const DIST = config.build.dist;
const PAGES = config.build.pages;
const CONTENTS = config.build.contents;
const CONTENTS_SLUG = config.build.contentSlug;

// const { dist: DIST, pages: PAGES, contents: CONTENTS } = config.build;

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

async function buildContentsFiles() {
  const files = await fs.readdir(CONTENTS);
  await fs.mkdir(`${DIST}/${CONTENTS_SLUG}`);

  for (const file of files) {
    const { attributes, body } = frontMatter(
      (await fs.readFile(`${CONTENTS}/${file}/index.md`)).toString()
    );
    const template = await fs.readFile("templates/post.html");
    const bodyHtml = new showdown.Converter().makeHtml(body);
    const html = Mustache.render(template.toString(), {
      ...config,
      post: { ...attributes, body: bodyHtml },
    });
    await fs.mkdir(`${DIST}/${CONTENTS_SLUG}/${file}`);
    await fs.writeFile(`${DIST}/${CONTENTS_SLUG}/${file}/index.html`, html);
  }
}

async function build() {
  await fs.mkdir(DIST);

  await buildHtmlFiles();
  await buildContentsFiles();
}

build();
