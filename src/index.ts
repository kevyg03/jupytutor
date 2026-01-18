import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { Cell, CodeCell } from '@jupyterlab/cells';
import {
  INotebookModel,
  INotebookTracker,
  Notebook,
  NotebookActions
} from '@jupyterlab/notebook';
import JupytutorWidget from './Jupytutor';
import { applyConfigRules } from './helpers/config-rules';
import { parseContextFromNotebook } from './helpers/context/notebookContextParsing';
import NotebookContextRetrieval, {
  STARTING_TEXTBOOK_CONTEXT
} from './helpers/context/notebookContextRetrieval';
import parseNB from './helpers/parseNB';
import { ConfigSchema } from './schemas/config';

export const DEMO_PRINTS = true;

// const assertNever = (x: never) => {
//   throw new Error(`Unexpected value: ${x}`);
// };

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
  activate: async (app: JupyterFrontEnd, notebookTracker: INotebookTracker) => {
    // Get the DataHub user identifier
    const userId = getUserIdentifier();

    let notebookContextRetriever: NotebookContextRetrieval | null = null;
    let pluginEnabled: boolean = false;

    const gatherNotebookContext = async () => {
      try {
        const currentWidget = notebookTracker.currentWidget;

        if (!currentWidget) {
          console.warn(
            '[Jupytutor]: No active notebook found for context gathering'
          );
          return;
        }

        await currentWidget.context.ready;
        await currentWidget.revealed;

        const notebook = currentWidget.content;
        const notebookModel = notebook.model;
        if (!notebookModel) {
          console.warn(
            '[Jupytutor]: No notebook model found for context gathering'
          );
          return;
        }

        const notebookConfig = loadConfiguration(notebookModel);

        // TODO: listen for changes
        pluginEnabled = notebookConfig.pluginEnabled;

        // Skip context gathering if activation flag criteria not met
        if (!pluginEnabled) {
          if (DEMO_PRINTS) {
            console.log(
              '[Jupytutor]: Activation flag not found in notebook. Skipping context gathering.'
            );
          }
          return;
        }

        // Parse the notebook to get all cells and their links
        const [allCells, _] = parseNB(notebook);

        if (DEMO_PRINTS) {
          console.log(
            '[Jupytutor]: Gathered all cells from notebook on initial load.',
            allCells
          );
        }

        notebookContextRetriever = await parseContextFromNotebook(
          allCells,
          notebookConfig
        );

        if (DEMO_PRINTS) {
          console.log('[Jupytutor]: Textbook Context Gathering Completed\n');
          console.log(
            '[Jupytutor]: Starting Textbook Prompt:\n',
            STARTING_TEXTBOOK_CONTEXT
          );
          console.log(
            '[Jupytutor]: Textbook Context Snippet:\n',
            (await notebookContextRetriever?.getContext())?.substring(
              STARTING_TEXTBOOK_CONTEXT.length,
              STARTING_TEXTBOOK_CONTEXT.length + 500
            )
          );
          console.log(
            '[Jupytutor]: Textbook Context Length:\n',
            (await notebookContextRetriever?.getContext())?.length
          );
          console.log(
            '[Jupytutor]: Textbook Source Links:\n',
            await notebookContextRetriever?.getSourceLinks()
          );
        }
      } catch (error) {
        console.error('[Jupytutor]: Error gathering context:', error);
      }
    };

    // Gather context when a notebook is opened or becomes active
    notebookTracker.currentChanged.connect(gatherNotebookContext);

    // Also gather context immediately if there's already an active notebook
    if (notebookTracker.currentWidget) {
      gatherNotebookContext();
    }

    // Listen for the execution of a cell. [1, 3, 6]
    NotebookActions.executed.connect(
      (
        _,
        {
          notebook,
          cell,
          success
        }: { notebook: Notebook; cell: Cell; success: boolean }
      ) => {
        const notebookModel = notebook.model;
        if (!notebookModel) {
          console.warn(
            '[Jupytutor]: No notebook model found during cell execution.'
          );
          return;
        }

        const notebookConfig = loadConfiguration(notebookModel);

        console.log({ notebookConfig });

        if (!notebookConfig.pluginEnabled) {
          // NEVER DO ANYTHING IF THE ACTIVATION FLAG IS NOT MET, NO MATTER WHAT
          return;
        }

        const cellIndex = [...notebookModel.cells].findIndex(
          c => c === cell.model
        );
        const cellConfig = applyConfigRules(
          notebookModel,
          cellIndex,
          notebookConfig.rules
        );
        if (DEMO_PRINTS) console.log({ cellConfig });

        if (cellConfig.chatEnabled && cellConfig.chatProactive) {
          const [allCells, activeIndex] = parseNB(notebook);

          const jupytutor = new JupytutorWidget({
            autograderResponse: '',
            allCells,
            activeIndex,
            localContextScope: 'upToGrader',
            sendTextbookWithRequest:
              notebookConfig.remoteContextGathering.enabled,
            notebookContextRetriever,
            cellType: 'code',
            userId,
            baseURL: notebookConfig.api.baseURL,
            instructorNote: cellConfig.instructorNote,
            quickResponses: cellConfig.quickResponses
          });

          // TODO: rejig 'active cell' logic

          if (cell.model.type === 'code') {
            const codeCell = cell as CodeCell;

            if (codeCell.outputArea && codeCell.outputArea.layout) {
              (codeCell.outputArea.layout as any).addWidget(jupytutor);
            }
          } else if (cell.model.type === 'markdown') {
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
          } else {
            console.warn(
              '[Jupytutor]: Unknown cell type; not adding Jupytutor widget.'
            );
          }
        }
      }
    );
  }
};

const loadConfiguration = (notebookModel: INotebookModel) => {
  const rawConfig = notebookModel.getMetadata('jupytutor') ?? {};
  const notebookConfig = ConfigSchema.parse(rawConfig);
  return notebookConfig;
};

export default plugin;
