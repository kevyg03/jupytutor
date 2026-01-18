import { CodeCell, CodeCellModel, ICellModel } from '@jupyterlab/cells';
import { Notebook } from '@jupyterlab/notebook';
import { IOutputModel } from '@jupyterlab/rendermime';

import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { extractLinksAndImages } from './markdown/extract-links-images';

export type ParsedCellType = 'code' | 'markdown' | 'unknown';

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
  type: ParsedCellType | null;
  text: string;
  editable: boolean;
  tags: string[];
  outputs: IOutputModel[];
  imageSources: string[]; // these aren't actually the image content -- you should fetch those asynchronously if you want them
  links: string[];
}

/**
 * Determines the type of a cell given
 *
 * @param cell the Jupyter Cell in question
 * @param success whether or not the cell ran successfully without error
 *
 * @returns allCells, activeIndex, allowed
 */
const parseNB = (
  notebook: Notebook,
  cell: CodeCell | undefined = undefined
): [ParsedCell[], number] => {
  let activeIndex = notebook.activeCellIndex;

  const cells = notebook.model?.cells ?? [];

  const parsedCells: ParsedCell[] = [];

  for (const cell of cells) {
    parsedCells.push(parseCellModel(cell));
  }

  // cross-reference provided cell to adjust activeIndex, tends to be one ahead when cell is run
  // but we don't want this to break if someone runs the cell manually / has different settings
  // if (cell != undefined && activeIndex !== 0) {
  //   if (
  //     parsedCells[activeIndex - 1].outputs[0]?.data.toString() ===
  //     cell.outputArea.layout.widgets[0].node.innerText
  //   ) {
  //     activeIndex -= 1;
  //     console.log(
  //       '[Jupytutor]: ACTIVE INDEX CORRECTION PERFORMED TO',
  //       activeIndex
  //     );
  //   }
  // }

  return [parsedCells, activeIndex];
};

/**
 * For now, we've removed the ability to parse FRQ answer fields -- I think this goes best in the authoring
 * step (as it already is in data8, with 'otter-answer-cell' as a tag)
 * @param cell - The cell to parse
 */
function parseCellModel(cell: ICellModel): ParsedCell {
  // console.log(cell, cell.id, cell.type);
  // console.log(cell.sharedModel.getSource());

  // if (cell.type === 'code') {
  //   console.log('IS CODE');
  //   const codeCell = cell as CodeCellModel;
  //   console.log('OUTPUTS LENGTH', codeCell.outputs.length);
  //   for (let i = 0; i < codeCell.outputs.length; i++) {
  //     console.log('OUTPUT', i);
  //     const output = codeCell.outputs.get(i);
  //     console.log(output);
  //   }
  // }

  const type: ParsedCellType =
    cell.type === 'markdown'
      ? 'markdown'
      : cell.type === 'code'
        ? 'code'
        : 'unknown';
  const text = cell.sharedModel.getSource();
  const parsedMarkdown = parseCellMarkdown(text);

  const outputs = [];
  if (type === 'code') {
    const codeCell = cell as CodeCellModel;
    for (let i = 0; i < codeCell.outputs.length; i++) {
      const output = codeCell.outputs.get(i);
      outputs.push(output);
    }
  }

  return {
    type,
    text,
    editable: cell.getMetadata('editable') ?? true,
    tags: cell.getMetadata('tags') ?? [],
    outputs,
    links: parsedMarkdown.links,
    imageSources: parsedMarkdown.imageSources
  };
}

function parseCellMarkdown(text: string): {
  links: string[];
  imageSources: string[];
} {
  const markdownTree = unified().use(remarkParse).parse(text);
  const markdownLinksImages = extractLinksAndImages(markdownTree);
  return {
    links: markdownLinksImages
      .filter(link => link.kind === 'link')
      .map(link => link.url)
      .filter(url => url !== undefined) as string[],
    imageSources: markdownLinksImages
      .filter(link => link.kind === 'image')
      .map(link => link.url)
      .filter(url => url !== undefined) as string[]
  };
}

export default parseNB;
