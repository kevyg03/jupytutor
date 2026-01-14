/**
 * THIS IS THE DEFAULT CONFIGURATION FOR THE EXTENSION.
 *
 * It is overridden by the config file in ~/.config/jupytutor/config.json
 *
 * Structure ~/.config/jupytutor/config.json the same as the exported config object.
 */
export const config = {
  api: {
    baseURL: 'http://localhost:3000/'
    /*baseURL:
      'https://server-jupytutor-cmeghve8dyf3agde.westus-01.azurewebsites.net/'*/
  },
  usage: {
    show_on_success: true, // For asking questions, not effective if context_gathering is disabled
    show_on_free_response: true, // For asking questions, not effective if context_gathering is disabled
    automatic_first_query_on_error: false,
    use_streaming: true // Stream in the text responses instead of sending the entire response at once
  },
  context_gathering: {
    enabled: true, // Otherwise, just sends the notebook context
    // If not null, whitelist overrides the blacklist
    whitelist: ['inferentialthinking.com'],
    // If not using the whitelist, these are examples of URLs that should be blacklisted
    blacklist: ['data8.org', 'berkeley.edu', 'gradescope.com'],
    // Special support for JupyterBook textbooks
    jupyterbook: {
      // This link should be a JupyterBook site, which enables link expansion to retrieve entire chapters and subsections
      url: 'inferentialthinking.com',
      link_expansion: true // If true, will expand JupyterBook links to retrieve entire chapters and subsections
    }
  },
  keywords: {
    // This is tested on the current cell and the one immediately before it. The current cell must be unlocked.
    free_response_regex:
      /.*question\s+\d+(?:\.\d+)*\.?\s*.*(?:\(?\d+\s+points\)?)?.*/i,
    // This is tested on the output of the current code cell (autograder output).
    success_regex: /.* passed!.*/i
  },
  activation_flag: 'jupytutor-activated-can-be-a-tag-of-any-cell', // If not empty, will only parse the notebook and run the plug-in if the activation flag is present in ANY cell's tags
  deactivation_flag: 'jupytutor: false', // IF IT IS NOT "" AND APPEARS IN ANY CODE CELL, THE PLUGIN WILL BE DEACTIVATED
  instructor_note: '' // NOT IMPLEMENTED YET
};

export default config;
