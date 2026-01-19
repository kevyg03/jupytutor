import { DEMO_PRINTS } from '../..';
import { PluginConfig } from '../../schemas/config';
import type { ParsedCell } from '../parseNB';
import NotebookContextRetrieval from './notebookContextRetrieval';

export const parseContextFromNotebook = async (
  notebook: ParsedCell[],
  pluginConfig: PluginConfig
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
    whitelistedURLs: pluginConfig.remoteContextGathering.whitelist, // whitelisted URLs
    blacklistedURLs: pluginConfig.remoteContextGathering.blacklist, // blacklisted URLs
    jupyterbookURLs: pluginConfig.remoteContextGathering.jupyterbook.urls, // jupyterbook URL
    attemptJupyterbookLinkExpansion:
      pluginConfig.remoteContextGathering.jupyterbook.linkExpansion, // attempt JupyterBook link expansion
    debug: false // debug mode
  });
};
