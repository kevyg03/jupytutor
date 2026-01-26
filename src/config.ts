import z from 'zod';
import { ConfigSchema } from './schemas/config';

/**
 * NOT USED AS DEFAULT AT THE MOMENT (CONFIG IS ADDED TO JUPYTOR METADATA, SEE loadConfiguration in index.ts)
 * 
 * For datahub wide configurations applying to an entire course, could be overridden by a config file in ~/.config/jupytutor/config.json
 * Structure ~/.config/jupytutor/config.json the same as the exported config object.
 * NOTE: This is currently not the case in this design iteration.
 */
export const defaultConfig: z.input<typeof ConfigSchema> = {
  pluginEnabled: true,
  api: {
    baseURL: 'http://localhost:3000/'
    /*baseURL:
      'https://server-jupytutor-cmeghve8dyf3agde.westus-01.azurewebsites.net/'*/
  },
  remoteContextGathering: {
    enabled: true, // Otherwise, just sends the notebook context
    // If not null, whitelist overrides the blacklist
    whitelist: ['inferentialthinking.com'],
    // If not using the whitelist, these are examples of URLs that should be blacklisted
    blacklist: ['data8.org', 'berkeley.edu', 'gradescope.com'],
    // Special support for JupyterBook textbooks
    jupyterbook: {
      // This link should be a JupyterBook site, which enables link expansion to retrieve entire chapters and subsections
      urls: ['inferentialthinking.com'],
      linkExpansion: true // If true, will expand JupyterBook links to retrieve entire chapters and subsections
    }
  },

  rules: [
    {
      _comment: 'Default rule: disable chat in all cells',
      config: {
        chatEnabled: false
      }
    },
    {
      when: {
        AND: [
          {
            cellType: 'code'
          },
          {
            hasError: true
          }
        ]
      },
      config: {
        chatEnabled: true,
        chatProactive: true,
        quickResponses: ['Explain this error.']
      }
    },
    {
      _comment:
        'Code cell (likely a grader cell) following an answer cell with all tests passing',
      when: {
        AND: [
          {
            cellType: 'code'
          },
          {
            OR: [
              {
                nearbyCell: {
                  relativePosition: -1,
                  matches: {
                    tags: {
                      any: 'otter_answer_cell'
                    }
                  }
                }
              },
              {
                OR: [
                  {
                    tags: {
                      any: 'jupytutor:grader_cell'
                    }
                  },
                  {
                    tags: {
                      any: 'jupytutor_grader_cell'
                    }
                  }
                ]
              }
            ]
          },
          {
            output: {
              matchesRegex: {
                pattern: '.*passed!.*',
                flags: 'i'
              }
            }
          }
        ]
      },
      config: {
        chatEnabled: true,
        chatProactive: true,
        quickResponses: [
          "I still don't feel confident in my answer.",
          'Provide me three important review materials.',
          'Can I make further improvements?'
        ]
      }
    },
    {
      _comment:
        'Code cell (likely a grader cell) following an answer cell without all tests passing',
      when: {
        AND: [
          {
            cellType: 'code'
          },
          {
            OR: [
              {
                nearbyCell: {
                  relativePosition: -1,
                  matches: {
                    tags: {
                      any: 'otter_answer_cell'
                    }
                  }
                }
              },
              {
                OR: [
                  {
                    tags: {
                      any: 'jupytutor:grader_cell'
                    }
                  },
                  {
                    tags: {
                      any: 'jupytutor_grader_cell'
                    }
                  }
                ]
              }
            ]
          },
          {
            output: {
              matchesRegex: {
                pattern: '.*Test case failed.*',
                flags: 'i'
              }
            }
          }
        ]
      },
      config: {
        chatEnabled: true,
        chatProactive: true,
        quickResponses: [
          'Explain this error.',
          'Provide a concise list of important review materials.',
          'What progress have I made so far?'
        ]
      }
    },
    {
      _comment: 'Markdown answer cell',
      when: {
        AND: [
          {
            cellType: 'markdown'
          },
          {
            tags: {
              any: 'otter_answer_cell'
            }
          }
        ]
      },
      config: {
        chatEnabled: true,
        chatProactive: true,
        quickResponses: ['Evaluate my answer.']
      }
    },
    {
      _comment:
        "Disable proactive mode when there's an explicit disable tag (best to keep this rule toward the end)",
      when: {
        tags: {
          any: 'jupytutor:disable_proactive'
        }
      },
      config: {
        chatEnabled: false
      }
    },
    {
      _comment:
        "Disable when there's an explicit disable tag (best to keep this rule at the end)",
      when: {
        tags: {
          any: 'jupytutor:disable'
        }
      },
      config: {
        chatEnabled: false
      }
    }
  ]
};

export default defaultConfig;
