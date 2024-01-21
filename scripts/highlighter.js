import hljs from "highlight.js";

const highlighter = (code, codeType) => {
  return hljs.highlight(code, { language: codeType }).value;
};

export const mdHighlighter = (md) => {
  const splittedMd = md.split("\n```");
  const splittedMdLength = splittedMd.length;
  const highlightSplittedMd = [];

  // no code block
  if (splittedMdLength === 1) return;

  for (let i = 0; i < splittedMdLength / 2; i++) {
    const index = i * 2;
    // last part
    if (index + 1 === splittedMdLength) {
      highlightSplittedMd.push(splittedMd[splittedMdLength - 1]);
      break;
    }

    const codeArea = splittedMd[index + 1];
    const codeStartIndex = codeArea.indexOf("\n");
    const codeType = codeArea.substr(0, codeStartIndex).trim();
    const code = codeArea.substr(codeStartIndex).trim();
    const highlightCode = codeType ? highlighter(code, codeType) : code;

    highlightSplittedMd.push(splittedMd[index] + "\n");
    highlightSplittedMd.push(
      `<pre><code${codeType ? ` class="language-${codeType}"` : ""}>`
    );
    highlightSplittedMd.push(highlightCode);
    highlightSplittedMd.push(`</code></pre>`);
  }

  return highlightSplittedMd.join("");
};
