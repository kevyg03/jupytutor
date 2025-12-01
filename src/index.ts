import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { INotebookTracker, NotebookActions } from '@jupyterlab/notebook';
import { Cell, CodeCell } from '@jupyterlab/cells';
import JupytutorWidget from './Jupytutor';
import getCellType from './helpers/getCellType';
import { Widget } from '@lumino/widgets';
import parseNB from './helpers/parseNB';
import ContextRetrieval, {
  STARTING_TEXTBOOK_CONTEXT
} from './helpers/contextRetrieval';
import config from './config';
import { ServerConnection } from '@jupyterlab/services';

// Destructure the configuration
// const {
//   usage: { show_on_success, run_automatically },
//   context_gathering: {
//     enabled: contextGatheringEnabled,
//     whitelist,
//     blacklist,
//     jupyterbook: { url: jupyterbookUrl, link_expansion: linkExpansion }
//   }
// } = config;

export const DEMO_PRINTS = true;

/**
 * Helper function to extract the user identifier from DataHub-style URLs
 * @returns The username/identifier from the URL path, or null if not found
 */
const getUserIdentifier = (): string | null => {
  const pathname = window.location.pathname;
  // Match DataHub-style URLs: /user/<username>/...
  const match = pathname.match(/\/user\/([^\/]+)/);
  return match ? match[1] : null;
};

/**
 * Initialization data for the jupytutor extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'jupytutor:plugin',
  description:
    'A Jupyter extension for providing students LLM feedback based on autograder results and supplied course context.',
  autoStart: true,
  requires: [INotebookTracker],
  activate: async (app: JupyterFrontEnd, tracker: INotebookTracker) => {
    // Try to load user config from ~/.config/jupytutor/config.json
    let finalConfig = await loadConfiguration();
    if (DEMO_PRINTS) {
      console.log(
        '[Jupytutor]: Loaded configuration.'
        // finalConfig
      );
    }

    const SEND_TEXTBOOK_WITH_REQUEST = finalConfig.context_gathering.enabled;

    // Get the DataHub user identifier
    const userId = getUserIdentifier();
    if (DEMO_PRINTS) {
      // console.log('Current URL:', window.location.href);
      // console.log('DataHub User ID:', userId);
    }

    let contextRetriever: ContextRetrieval | null = null;
    let allowed = true; // DEFAULT, THEN CHECKS FOR FLAG ON FIRST PARSE

    // GATHER CONTEXT IMMEDIATELY (doesn't need to stay up to date, just happens once)
    const gatherContext = async () => {
      try {
        // Get the current active notebook
        const notebook = tracker.currentWidget?.content;
        if (!notebook) {
          console.log(
            '[Jupytutor]: No active notebook found for context gathering'
          );
          return;
        }

        // Parse the notebook to get all cells and their links
        const [allCells, _, allowed_value] = parseNB(
          notebook,
          undefined,
          finalConfig.activation_flag ?? ''
        );
        allowed = allowed_value; // set this globally

        // Skip context gathering if activation flag criteria not met
        if (!allowed) {
          if (DEMO_PRINTS) {
            console.log(
              '[Jupytutor]: Activation flag not found in notebook. Skipping context gathering.'
            );
          }
          return;
        }
        if (DEMO_PRINTS) {
          console.log(
            '[Jupytutor]: Gathered all cells from notebook on initial load.'
            // allCells
          );
        }

        // Extract all unique links from all cells
        const allLinks = new Set<string>();
        allCells.forEach(cell => {
          if (cell.links && cell.links.length > 0) {
            cell.links.forEach(link => allLinks.add(link));
          }
        });

        const uniqueLinks = Array.from(allLinks);
        if (DEMO_PRINTS) {
          console.log(
            '[Jupytutor]: Gathered unique links from notebook:',
            uniqueLinks
          );
        }

        // Create ContextRetrieval instance with the gathered links
        contextRetriever = new ContextRetrieval({
          sourceLinks: uniqueLinks,
          whitelistedURLs: finalConfig.context_gathering.whitelist, // whitelisted URLs
          blacklistedURLs: finalConfig.context_gathering.blacklist, // blacklisted URLs
          jupyterbookURL: finalConfig.context_gathering.jupyterbook.url, // jupyterbook URL
          attemptJupyterbookLinkExpansion:
            finalConfig.context_gathering.jupyterbook.link_expansion, // attempt JupyterBook link expansion
          debug: false // debug mode
        });

        // Store the context retriever globally or make it accessible
        // (window as any).jupytutorContextRetriever = contextRetriever;

        // print this after 3 seconds have passed
        setTimeout(() => {
          if (DEMO_PRINTS) {
            console.log('[Jupytutor]: Textbook Context Gathering Completed\n');
            console.log(
              '[Jupytutor]: Starting Textbook Prompt:\n',
              STARTING_TEXTBOOK_CONTEXT
            );
            console.log(
              '[Jupytutor]: Textbook Context Snippet:\n',
              contextRetriever
                ?.getContext()
                ?.substring(
                  STARTING_TEXTBOOK_CONTEXT.length,
                  STARTING_TEXTBOOK_CONTEXT.length + 500
                )
            );
            console.log(
              '[Jupytutor]: Textbook Context Length:\n',
              contextRetriever?.getContext()?.length
            );
            console.log(
              '[Jupytutor]: Textbook Source Links:\n',
              contextRetriever?.getSourceLinks()
            );
          }
        }, 3000);
      } catch (error) {
        console.error('[Jupytutor]: Error gathering context:', error);
      }
    };

    // Simple sleep function
    const sleep = (ms: number) =>
      new Promise(resolve => setTimeout(resolve, ms));

    // Gather context when a notebook is opened or becomes active
    tracker.currentChanged.connect(async () => {
      await sleep(500); // Give notebook time to fully load
      gatherContext();
    });

    // Also gather context immediately if there's already an active notebook
    if (tracker.currentWidget) {
      sleep(500).then(() => {
        gatherContext();
      });
    }

    // Listen for the execution of a cell. [1, 3, 6]
    NotebookActions.executed.connect(
      (_, args: { notebook: any; cell: Cell; success: boolean }) => {
        if (!allowed) {
          // NEVER DO ANYTHING IF THE ACTIVATION FLAG IS NOT MET, NO MATTER WHAT
          return;
        }
        const { cell, success, notebook } = args;

        const cellType = getCellType(cell, success);

        if (cellType === 'grader_not_initialized') {
          const codeCell = cell as CodeCell;

          // Create a new widget to hold our UI element.
          const error = new Widget();
          error.node.innerHTML = `<h4>Did not find autograder. Make sure you have run the cells to initialize it!</h4>`;

          // Add the new UI element to the cell's output area. [15]
          if (codeCell.outputArea && codeCell.outputArea.layout) {
            (codeCell.outputArea.layout as any).addWidget(error);
          }
        }

        // Only add the Jupytutor element if it was a grader cell.
        if (
          cellType === 'grader' ||
          (cellType === 'success' && finalConfig.usage.show_on_success)
        ) {
          const codeCell = cell as CodeCell;

          // activeIndex is guaranteed to be the cell just run within parseNB by cross-referencing cell
          const [allCells, activeIndex, allowed] = parseNB(
            notebook,
            codeCell,
            finalConfig.activation_flag ?? ''
          );

          // Skip showing UI if activation flag criteria not met
          if (!allowed) {
            return;
          }

          if (codeCell.outputArea && codeCell.outputArea.layout) {
            const autograderResponse =
              codeCell.outputArea.layout.widgets[0].node.innerText;

            const jupytutor = new JupytutorWidget({
              autograderResponse,
              allCells,
              activeIndex,
              notebookContext: 'upToGrader',
              sendTextbookWithRequest: SEND_TEXTBOOK_WITH_REQUEST,
              contextRetriever,
              cellType: cellType,
              userId: userId,
              config: finalConfig
            });

            (codeCell.outputArea.layout as any).addWidget(jupytutor);
          }
        } else if (cellType === 'code') {
          // CAN DEFINE OTHER BEHAVIORS! INCLUDING MAP TO STORE ALL THE RELEVANT CONTEXT
        } else if (finalConfig.usage.show_on_free_response) {
          // For markdown cells, create a proper ReactWidget mounting
          const [allCells, activeIndex, allowed] = parseNB(
            notebook,
            undefined,
            finalConfig.activation_flag ?? ''
          );

          // Skip showing UI if activation flag criteria not met
          if (!allowed) {
            return;
          }

          const cellType: string | null = allCells[activeIndex].type;

          if (cellType === 'free_response') {
            // Create the Jupytutor widget
            const jupytutor = new JupytutorWidget({
              autograderResponse: '', // No autograder response for free response cells
              allCells,
              activeIndex,
              notebookContext: 'upToGrader',
              sendTextbookWithRequest: SEND_TEXTBOOK_WITH_REQUEST,
              contextRetriever,
              cellType: cellType,
              userId: userId,
              config: finalConfig
            });

            // Check if there's already a JupyTutor widget in this cell and remove it
            const existingContainer = cell.node.querySelector(
              '.jp-jupytutor-markdown-container'
            );
            if (existingContainer) {
              existingContainer.remove();
            }

            // Create a proper container div with React mounting point
            const container = document.createElement('div');
            container.className = 'jp-jupytutor-markdown-container';
            container.style.cssText = `
            margin-top: 15px;
            border: 1px solid #e0e0e0;
            border-radius: 6px;
            padding: 0;
            background-color: #ffffff;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          `;

            // Mount the ReactWidget properly
            container.appendChild(jupytutor.node);

            // Add to the cell
            cell.node.appendChild(container);

            // Ensure React renders by calling update after DOM insertion
            requestAnimationFrame(() => {
              jupytutor.update();
            });
          }
        }
      }
    );
  }
};

const loadConfiguration = async () => {
  let finalConfig = { ...config };
  try {
    const settings = ServerConnection.makeSettings();
    const response = await ServerConnection.makeRequest(
      `${settings.baseUrl}jupytutor/config`,
      { method: 'GET' },
      settings
    );

    if (response.ok) {
      const data = await response.json();
      if (data.status === 'success' && data.config) {
        if (JSONVerify(finalConfig, data.config)) {
          finalConfig = recursiveJSONModify(finalConfig, data.config);
        } else {
          console.error(
            'ERROR: User config does not match the default config. Changes not reflected. Edit ~/.config/jupytutor/config.json to fix this.'
          );
          return finalConfig;
        }
      }
    }
  } catch (error) {
    // Config file doesn't exist or failed to load - use default config
    if (DEMO_PRINTS) {
      console.log(
        '[Jupytutor]: No user config found at ~/.config/jupytutor/config.json, using default config'
      );
    }
  }
  return finalConfig;
};

/**
 * Takes two JSON objects, and modifies the first 1 throughout its entire structure with values
 * found in the second in the exact same structure location.
 *
 * DOES NOT add any new keys to the first object, or delete any keys from the first object.
 * IT ONLY MODIFIES THE VALUES OF THE FIRST OBJECT. Based on the structure of the second object.
 * @param obj1 - The first JSON object to modify
 * @param obj2 - The second JSON object to use as the source of truth
 * @returns The copy of the first object with the values modified
 */
const recursiveJSONModify = (obj1: any, obj2: any): any => {
  const newObj = { ...obj1 };
  return Object.keys(obj2).reduce((acc, key) => {
    if (obj2[key] && typeof obj2[key] === 'object') {
      acc[key] = recursiveJSONModify(acc[key], obj2[key]);
    } else {
      if (key in obj1) acc[key] = obj2[key];
    }
    return acc;
  }, newObj);
};

/**
 * Returns TRUE if obj2 contains a SUBSET of all the keys in the same structure location as obj1.
 * If obj2 contains a key that is not in obj1 at the same point of the structure, returns FALSE.
 *
 * @param obj1
 * @param obj2
 */
const JSONVerify = (obj1: any, obj2: any): boolean => {
  return Object.keys(obj2).every(key => {
    if (obj2[key] && typeof obj2[key] === 'object') {
      return JSONVerify(obj1[key], obj2[key]);
    } else {
      return key in obj1;
    }
  });
};

export default plugin;
