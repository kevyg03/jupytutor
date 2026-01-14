import { DEMO_PRINTS } from '../..';
import { ParsedCell } from '../parseNB';
import NotebookContextRetrieval from './notebookContextRetrieval';

export const parseContextFromNotebook = async (
  notebook: ParsedCell[],
  pluginConfig: any
) => {
  console.log('nb parseContextFromNotebook', notebook);

  // TODO plugin config type
  // Extract all unique links from all cells
  const allLinks = new Set<string>();
  notebook.forEach(cell => {
    if (cell.links && cell.links.length > 0) {
      cell.links.forEach(link => allLinks.add(link));
    }
  });

  console.log('allLinks', allLinks);

  const uniqueLinks = Array.from(allLinks);
  if (DEMO_PRINTS) {
    console.log(
      '[Jupytutor]: Gathered unique links from notebook:',
      uniqueLinks
    );
  }

  // Create ContextRetrieval instance with the gathered links
  return new NotebookContextRetrieval({
    sourceLinks: uniqueLinks,
    whitelistedURLs: pluginConfig.context_gathering.whitelist, // whitelisted URLs
    blacklistedURLs: pluginConfig.context_gathering.blacklist, // blacklisted URLs
    jupyterbookURL: pluginConfig.context_gathering.jupyterbook.url, // jupyterbook URL
    attemptJupyterbookLinkExpansion:
      pluginConfig.context_gathering.jupyterbook.link_expansion, // attempt JupyterBook link expansion
    debug: false // debug mode
  });
};
