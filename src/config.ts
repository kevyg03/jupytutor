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
  },
  usage: {
    show_on_success: true, // For asking questions, not effective if context_gathering is disabled
    show_on_free_response: true, // For asking questions, not effective if context_gathering is disabled
    automatic_first_query_on_error: true,
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
      /.*question\s+\d+(?:\.\d+)*\.\s+.*\(?\d+\s+points\)?.*/i,
    // This is tested on the output of the current code cell (autograder output).
    success_regex: /.* passed!.*/i
  },
  instructor_note: '' // NOT IMPLEMENTED YET
};

export default config;
