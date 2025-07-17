import { Cell, CodeCell } from '@jupyterlab/cells';

const GRADER_PACKAGE_TOKEN = 'otter';
const GRADER_METHOD_NAMES = ['check'];
let graderVariableName = '';
/**
 * Determines the type of a cell given
 *
 * @param cell the Jupyter Cell in question
 * @param success whether or not the cell ran successfully without error
 *
 * @returns the cell type, with priority given to 'grader' > 'code' for sake of triggering the tutor.
 */
const getCellType = (
  cell: Cell,
  success: boolean
): 'grader' | 'code' | 'error' | 'text' | 'grader_not_initialized' | null => {
  // Only add the UI element if the cell execution was successful.
  if (cell.model.type === 'code') {
    const codeCell = cell as CodeCell;
    if (!success) return 'error';

    const tokens = codeCell.inputArea?.editor.getTokens();
    if (tokens === undefined) {
      console.log('ISSUE RETRIEVING TOKENS FROM CODE CELL');
      return null;
    }

    // assign graderVariableName if it doesn't exist yet
    const len = tokens?.length ?? 0;
    if (graderVariableName === '') {
      for (let i = 2; i < len; i += 1) {
        if (
          tokens[i].value === GRADER_PACKAGE_TOKEN &&
          tokens[i - 1].type === 'AssignOp'
        ) {
          graderVariableName = tokens[i - 2].value;
          //   console.log('GRADER VARIABLE NAME FOUND', graderVariableName);
        }
      }
    }

    if (graderVariableName === '') {
      console.log('GRADER NOT INITIALIZED YET');
      return 'grader_not_initialized';
    }

    let isGraderCell = false;
    for (let i = 0; i < len - 2; i += 1) {
      const isGraderReference =
        tokens[i].type === 'VariableName' &&
        tokens[i].value === graderVariableName;

      if (isGraderReference) {
        if (
          tokens[i + 1].type === '.' &&
          tokens[i + 2].type === 'PropertyName' &&
          GRADER_METHOD_NAMES.indexOf(tokens[i + 2].value) !== -1
        )
          isGraderCell = true;
      }
    }

    return isGraderCell ? 'grader' : 'code';
  } else return 'text';
};

export default getCellType;
