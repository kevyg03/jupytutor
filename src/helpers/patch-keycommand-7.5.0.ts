import { JupyterFrontEnd } from '@jupyterlab/application';
import { devLog } from './dev';
import { useJupytutorReactState } from '../store';

// https://github.com/team-jupytutor/jupytutor/issues/25#issue-3841086723
// issue introduced in Jupyter Notebook v7.5.0, patched in v7.5.1
export const patchKeyCommand750 = (app: JupyterFrontEnd) => {
  if (app.version === '7.5.0') {
    // from commands/src/index.ts:
    //  When the keydown event is processed, if the event target or any of its
    //  ancestor nodes has a `data-lm-suppress-shortcuts` attribute, its keydown
    //  events will not invoke commands.

    devLog(() => "Patching key 'o' command for Jupyter Notebook v7.5.0");

    useJupytutorReactState.setState({ patchKeyCommand750: true });
  }
};
