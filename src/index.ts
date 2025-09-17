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

export const DEMO_PRINTS = true;
const SEND_TEXTBOOK_WITH_REQUEST = true;

/**
 * Initialization data for the jupytutor extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'jupytutor:plugin',
  description:
    'A Jupyter extension for providing students LLM feedback based on autograder results and supplied course context.',
  autoStart: true,
  requires: [INotebookTracker],
  activate: (app: JupyterFrontEnd, tracker: INotebookTracker) => {
    console.log('JupyterLab extension jupytutor is activated!');
    let contextRetriever: ContextRetrieval | null = null;

    // GATHER CONTEXT IMMEDIATELY (doesn't need to stay up to date, just happens once)
    const gatherContext = async () => {
      try {
        // Get the current active notebook
        const notebook = tracker.currentWidget?.content;
        if (!notebook) {
          console.log('No active notebook found for context gathering');
          return;
        }

        // Parse the notebook to get all cells and their links
        const [allCells, _] = parseNB(notebook);
        if (DEMO_PRINTS) {
          console.log(
            'Initial load: Gathered all cells from notebook:',
            allCells
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
          console.log('Gathered unique links from notebook:', uniqueLinks);
        }

        // Create ContextRetrieval instance with the gathered links
        contextRetriever = new ContextRetrieval({
          sourceLinks: uniqueLinks,
          blacklistedURLs: [
            'data8.org', // Includes references, policies, schedule, etc.
            'berkeley.edu', // Includes map, etc.
            'gradescope.com'
          ], // blacklisted URLs
          jupyterbookURL: 'inferentialthinking.com', // jupyterbook URL
          attemptJupyterbookLinkExpansion: true, // attempt JupyterBook link expansion
          debug: false // debug mode
        });

        // Store the context retriever globally or make it accessible
        // (window as any).jupytutorContextRetriever = contextRetriever;

        // print this after 3 seconds have passed
        setTimeout(() => {
          if (DEMO_PRINTS) {
            console.log('Textbook Context Gathering Completed\n');
            console.log(
              'Starting Textbook Prompt:\n',
              STARTING_TEXTBOOK_CONTEXT
            );
            console.log(
              'Textbook Context Snippet:\n',
              contextRetriever
                ?.getContext()
                ?.substring(
                  STARTING_TEXTBOOK_CONTEXT.length,
                  STARTING_TEXTBOOK_CONTEXT.length + 500
                )
            );
            console.log(
              'Textbook Context Length:\n',
              contextRetriever?.getContext()?.length
            );
            console.log(
              'Textbook Source Links:\n',
              contextRetriever?.getSourceLinks()
            );
          }
        }, 3000);
      } catch (error) {
        console.error('Error gathering context:', error);
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
        if (cellType === 'grader') {
          const codeCell = cell as CodeCell;

          // activeIndex is guaranteed to be the cell just run within parseNB by cross-referencing cell
          const [allCells, activeIndex] = parseNB(notebook, codeCell);

          if (codeCell.outputArea && codeCell.outputArea.layout) {
            const autograderResponse =
              codeCell.outputArea.layout.widgets[0].node.innerText;

            const jupytutor = new JupytutorWidget({
              autograderResponse,
              allCells,
              activeIndex,
              notebookContext: 'upToGrader',
              sendTextbookWithRequest: SEND_TEXTBOOK_WITH_REQUEST,
              contextRetriever
            });

            (codeCell.outputArea.layout as any).addWidget(jupytutor);
          }
        } else if (cellType === 'code') {
          // CAN DEFINE OTHER BEHAVIORS! INCLUDING MAP TO STORE ALL THE RELEVANT CONTEXT
        }
      }
    );
  }
};

export default plugin;
