import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { INotebookTracker, NotebookActions } from '@jupyterlab/notebook';
import { Cell, CodeCell } from '@jupyterlab/cells';
import JupytutorWidget from './Jupytutor';
import getCellType from './helpers/getCellType';
import { Widget } from '@lumino/widgets';

/**
 * Initialization data for the jupytutor extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'jupytutor:plugin',
  description:
    'A Jupyter extension for providing students LLM feedback based on autograder results and supplied course context.',
  autoStart: true,
  activate: (app: JupyterFrontEnd, tracker: INotebookTracker) => {
    console.log('JupyterLab extension jupytutor is activated!');

    // Listen for the execution of a cell. [1, 3, 6]
    NotebookActions.executed.connect(
      (_, args: { notebook: any; cell: Cell; success: boolean }) => {
        const { cell, success } = args;

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

        // Only add the UI element if it was a grader cell.
        if (cellType === 'grader') {
          const codeCell = cell as CodeCell;

          // Create a new widget to hold our UI element.
          const jupytutor = new JupytutorWidget();

          // Add the new UI element to the cell's output area. [15]
          if (codeCell.outputArea && codeCell.outputArea.layout) {
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
