import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

/**
 * Initialization data for the jupytutor extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'jupytutor:plugin',
  description: 'A Jupyter extension for providing students LLM feedback based on autograder results and supplied course context.',
  autoStart: true,
  activate: (app: JupyterFrontEnd) => {
    console.log('JupyterLab extension jupytutor is activated!');
  }
};

export default plugin;
