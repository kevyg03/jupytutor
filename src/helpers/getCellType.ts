import { Cell, CodeCell } from '@jupyterlab/cells';
import { DEMO_PRINTS } from '..';
import config from '../config';

const GRADER_PACKAGE_TOKEN = 'otter';
const GRADER_METHOD_NAMES = ['check'];
let graderVariableName = '';

const FREE_RESPONSE_REGEX = config.keywords.free_response_regex;
const SUCCESS_REGEX = config.keywords.success_regex;

/**
 * Determines the type of a cell given
 *
 * @param cell the Jupyter Cell in question
 * @param success whether or not the cell ran successfully without error
 *
 * @returns the cell type, with priority given to 'free_response' > 'grader' > 'code' for sake of triggering the tutor.
 */
const getCellType = (
  cell: Cell,
  success: boolean,
  previousCell: Cell | undefined = undefined
):
  | 'grader'
  | 'code'
  | 'error'
  | 'text'
  | 'grader_not_initialized'
  | 'free_response'
  | 'success'
  | null => {
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
          if (DEMO_PRINTS)
            console.log('GRADER VARIABLE NAME FOUND', graderVariableName);
        }
      }
    }

    if (graderVariableName === '') {
      if (DEMO_PRINTS) console.log('GRADER NOT INITIALIZED YET');
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

    const cellOutput = codeCell.outputArea?.layout.widgets[0];
    const cellOutputText = cellOutput
      ? cellOutput.node.innerText.toLowerCase()
      : '';
    const containsSuccessKeyword = SUCCESS_REGEX.test(cellOutputText);

    if (isGraderCell) {
      if (containsSuccessKeyword) {
        if (DEMO_PRINTS) console.log('SUCCESS CELL DETECTED');
        return 'success';
      } else {
        return 'grader';
      }
    } else {
      return 'code';
    }
  } else {
    // Check if cell is unlocked (editable) and contains free response keywords
    // const cellText = cell.node.innerText.toLowerCase();
    let isUnlocked = true; // Assume unlocked by default

    try {
      const metadata = cell.model.metadata as any;
      const locked = metadata?.get?.('locked');
      const readonly = metadata?.get?.('readonly');
      isUnlocked = !locked && !readonly;
    } catch (e) {
      // If metadata access fails, assume unlocked
      isUnlocked = true;
    }

    if (!isUnlocked) {
      return 'text';
    }

    let isFreeResponseCell = false;
    if (previousCell) {
      const previousCellText = previousCell.node.innerText.toLowerCase();
      isFreeResponseCell = FREE_RESPONSE_REGEX.test(previousCellText);
      console.log('previousCellText', previousCellText, isFreeResponseCell);
    }

    if (isUnlocked && isFreeResponseCell) {
      if (DEMO_PRINTS) console.log('FREE RESPONSE CELL DETECTED');
      return 'free_response';
    }
    return 'text';
  }
};

export default getCellType;
