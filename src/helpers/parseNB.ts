import getCellType from './getCellType';
import { Cell, CodeCell } from '@jupyterlab/cells';

/**
 * For each cell, should get the Type and return any relevant information whether its:
 *  - A written question or hint
 *  - A previous sub-part
 *  - Whether it's a question marker / a previous question starting point
 *  - An image in a cell
 *  - An image in the output of a cell (like a matplotlib graph)
 *  - code:
 *      - question input
 *      - helper code
 *
 * For use in an initial notebook processing script + request making
 *
 * note code output is repeated after input if it's already present (double check this)
 */

export interface ParsedCell {
  index: number;
  type: string | null;
  html: string;
  text: string;
  outputText: string | null;
  outputHtml: string | null;
  images: string[];
  links: string[];
}

/**
 * Determines the type of a cell given
 *
 * @param cell the Jupyter Cell in question
 * @param success whether or not the cell ran successfully without error
 *
 * @returns allCells, activeIndex
 */
const parseNB = (
  notebook: any,
  cell: CodeCell | undefined = undefined
): [ParsedCell[], number] => {
  let activeIndex = notebook.activeCellIndex;
  const allCells: ParsedCell[] = notebook.cellsArray.map(
    (cell: Cell, index: number): ParsedCell => {
      const type = getCellType(
        cell,
        true,
        index > 0 ? notebook.cellsArray[index - 1] : undefined
      );
      let cellObj: ParsedCell = {
        index,
        type,
        html: cell.node.innerHTML,
        text: cell.node.innerText,
        outputText: null,
        outputHtml: null,
        images: findImageSources(cell.node.innerHTML),
        links: findHyperlinks(cell.node.innerHTML)
      };
      if (
        type === 'grader' ||
        type === 'code' ||
        type === 'error' ||
        type === 'success'
      ) {
        const codeCell = cell as CodeCell;
        if (codeCell.outputArea.layout.widgets?.length > 0) {
          cellObj.outputText =
            codeCell.outputArea.layout.widgets[0].node.innerText;
          cellObj.text = removeOutputTextFromInputText(
            cellObj.text,
            cellObj.outputText ?? ''
          );
          cellObj.outputHtml =
            codeCell.outputArea.layout.widgets[0].node.innerHTML;
          cellObj.html = removeOutputTextFromInputText(
            cellObj.html,
            cellObj.outputHtml ?? ''
          );
          cellObj.images = [
            ...cellObj.images,
            ...findImageSources(
              codeCell.outputArea.layout.widgets[0].node.innerHTML
            )
          ];
          // cellObj.links = [
          //   ...cellObj.links,
          //   ...findHyperlinks(
          //     codeCell.outputArea.layout.widgets[0].node.innerHTML
          //   )
          // ];
        }
      }
      return cellObj;
    }
  );

  // cross-reference provided cell to adjust activeIndex, tends to be one ahead when cell is run
  // but we don't want this to break if someone runs the cell manually / has different settings
  if (cell != undefined && activeIndex !== 0) {
    if (
      allCells[activeIndex - 1].outputText ===
      cell.outputArea.layout.widgets[0].node.innerText
    ) {
      activeIndex -= 1;
      console.log('ACTIVE INDEX CORRECTION PERFORMED');
    }
  }

  return [allCells, activeIndex];
};

function removeOutputTextFromInputText(
  inputText: string,
  outputText: string
): string {
  const lastIndex = inputText.lastIndexOf(outputText);
  if (lastIndex === -1) {
    return inputText;
  }
  return (
    inputText.slice(0, lastIndex) +
    inputText.slice(lastIndex + outputText.length)
  );
}

/**
 * Handy function from Gemini to parse html and extract image sources with regex.
 *
 * @param htmlString
 * @returns
 */
function findImageSources(htmlString: string): string[] {
  // 1. src='URL' or src="URL" in <img> tags.
  // 2. srcset='URL' or srcset="URL" in <source> tags.
  // 3. url(URL) in inline styles or style blocks, excluding "clip-path" artifacts starting with #.
  const regex =
    /<img[^>]+src\s*=\s*["']([^"']+)["']|<source[^>]+srcset\s*=\s*["']([^"']+)["']|url\((['"]?)(?!#)(.*?)\3\)/gi;

  const sources: Set<string> = new Set(); // Using a Set to automatically handle duplicates
  let match;

  // Loop through all matches in the HTML string
  while ((match = regex.exec(htmlString)) !== null) {
    // Check the captured groups for the URL.
    // match[1] is for <img src="...">
    // match[2] is for <source srcset="...">
    // match[4] is for url(...)
    const src = match[1] || match[2] || match[4];
    if (src) {
      sources.add(src.trim());
    }
  }

  return Array.from(sources); // Convert the Set back to an array
}

/**
 * Finds hyperlink URLs in HTML content and converts them to absolute URLs.
 *
 * @param htmlString - The HTML string to search for links
 * @returns Array of absolute URLs found in the HTML
 */
function findHyperlinks(htmlString: string): string[] {
  // Regex to find href attributes in <a> tags
  const regex = /<a[^>]+href\s*=\s*["']([^"']+)["']/gi;

  const links: Set<string> = new Set(); // Using a Set to automatically handle duplicates
  let match;

  // Loop through all matches in the HTML string
  while ((match = regex.exec(htmlString)) !== null) {
    const href = match[1];
    if (href) {
      const trimmedHref = href.trim();

      // Skip empty links, javascript links, and mailto links
      if (
        trimmedHref === '' ||
        trimmedHref.startsWith('javascript:') ||
        trimmedHref.startsWith('mailto:') ||
        trimmedHref.startsWith('#')
      ) {
        continue;
      }

      try {
        // If it's already an absolute URL, use it as-is
        if (
          trimmedHref.startsWith('http://') ||
          trimmedHref.startsWith('https://')
        ) {
          links.add(trimmedHref);
        } else {
          // Convert relative URLs to absolute URLs using a base URL
          const url = new URL(trimmedHref, 'https://example.com');
          links.add(url.href);
        }
      } catch (error) {
        // If URL construction fails, add the original href as-is
        links.add(trimmedHref);
      }
    }
  }

  return Array.from(links); // Convert the Set back to an array
}

export default parseNB;
