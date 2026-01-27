// import { Widget } from '@lumino/widgets';
import { useEffect, useRef, useState } from 'react';
import type { ParsedCell, ParsedCellType } from './helpers/parseNB';

import { ReactWidget } from '@jupyterlab/apputils';
import { produce } from 'immer';
import '../style/index.css';
import { ChatInput } from './Components/ChatInput';
import {
  ChatHistoryItem,
  ChatMessage,
  StreamingAssistantMessage
} from './Components/ChatMessage';
import { TailoredOptions } from './Components/TailoredOptions';
import NotebookContextRetrieval, {
  STARTING_TEXTBOOK_CONTEXT
} from './helpers/context/notebookContextRetrieval';
import { devLog } from './helpers/devLog';
import { makeAPIRequest } from './helpers/makeAPIRequest';
import { PluginConfig } from './schemas/config';
import { useJupytutorReactState, usePatchKeyCommand750 } from './store';

export interface JupytutorProps {
  autograderResponse: string | undefined;
  allCells: ParsedCell[];
  activeIndex: number;
  localContextScope:
    | 'whole'
    | 'upToGrader'
    | 'fiveAround'
    | 'tenAround'
    | 'none';
  sendTextbookWithRequest: boolean;
  notebookContextRetriever: NotebookContextRetrieval | null;
  cellType: ParsedCellType;
  userId: string | null;
  baseURL: string;
  instructorNote: string | null;
  quickResponses: string[];
  setNotebookConfig: (newConfig: PluginConfig) => void;
}

const getCodeCellOutputAsLLMContent = (
  cell: ParsedCell
): { type: 'input_text'; text: string }[] => {
  return cell.outputs.map(output => {
    if ('image/png' in output.data) {
      return {
        type: 'input_text',
        // TODO: include in the chat prompt
        text: '[Image output]'
      };
    }
    if ('text/html' in output.data) {
      return {
        type: 'input_text',
        text: output.data['text/html']?.toString() ?? ''
      };
    }
    if ('text/plain' in output.data) {
      return {
        type: 'input_text',
        text: output.data['text/plain']?.toString() ?? ''
      };
    }
    // TODO: make sure this is getting trimmed somewhere
    return { type: 'input_text', text: JSON.stringify(output.data) };
  });
};

export const Jupytutor = (props: JupytutorProps): JSX.Element => {
  const STARTING_MESSAGE = '';
  const [inputValue, setInputValue] = useState(STARTING_MESSAGE);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const hasGatheredInitialContext = useRef(false);
  const initialContextData = useRef<ChatHistoryItem[]>([]);

  const [liveResult, setLiveResult] = useState<string | null>(null);
  const notebookConfig = useJupytutorReactState(state => state.notebookConfig);

  const {
    sendTextbookWithRequest,
    notebookContextRetriever: contextRetriever,
    cellType,
    userId,
    baseURL,
    instructorNote,
    quickResponses
  } = props;

  const createChatContextFromCells = async (
    cells: ParsedCell[]
  ): Promise<ChatHistoryItem[]> => {
    let textbookContext: ChatHistoryItem[] = [];
    if (sendTextbookWithRequest && contextRetriever != null) {
      const context = await contextRetriever.getContext();

      textbookContext = [
        {
          role: 'system',
          content: [
            {
              text: STARTING_TEXTBOOK_CONTEXT,
              type: 'input_text'
            }
          ],
          noShow: true
        },
        {
          role: 'system',
          content: [
            {
              text: context || '',
              type: 'input_text'
            }
          ],
          noShow: true
        }
      ];
      devLog(() => 'Sending textbook with request');
    } else {
      devLog(() => 'NOT sending textbook with request');
    }

    const notebookContext: ChatHistoryItem[] = cells.map(cell => {
      const output = getCodeCellOutputAsLLMContent(cell);
      const hasOutput = output.length > 0;
      if (hasOutput && cell.type === 'code') {
        return {
          role: 'system' as const,
          content: [
            {
              text:
                cell.text + '\nThe above code produced the following output:\n',
              type: 'input_text'
            },
            ...output
          ],
          noShow: true
        };
      } else if (cell.type === 'markdown') {
        devLog(() => 'Sending free response prompt with request!');

        return {
          role: 'system' as const,
          content: [
            {
              text: cell.text,
              type: 'input_text'
            }
          ],
          noShow: true
        };
      }
      return {
        role: 'system' as const,
        content: [
          {
            text: cell.text ?? '',
            type: 'input_text'
          }
        ],
        noShow: true
      };
    });

    return [
      ...textbookContext,
      ...notebookContext,
      ...(instructorNote !== null
        ? [
            {
              role: 'system' as const,
              content: [
                {
                  text: instructorNote,
                  type: 'input_text'
                }
              ],
              noShow: true
            }
          ]
        : [])
    ];
  };

  /**
   * Include images from all code cells and the first non-code cell back from the active indexwith images
   *
   * @param cells - the cells to gather images from
   * @param maxGoBack - the maximum number of cells to go back to find an image
   * @returns a string of images from the cells
   */
  const gatherImagesFromCells = (
    cells: ParsedCell[],
    maxGoBack: number,
    maxImages: number = 5
  ) => {
    const images = [];
    for (
      let i = props.activeIndex;
      i > Math.max(0, props.activeIndex - maxGoBack);
      i--
    ) {
      const cell = cells[i];
      if (cell.imageSources.length > 0 && cell.type === 'code') {
        images.push(...cell.imageSources);
      }
      if (cell.imageSources.length > 0 && cell.type !== 'code') {
        images.push(...cell.imageSources);
        break;
      }
    }
    return images.slice(0, maxImages);
  };

  const gatherLocalContext = async () => {
    const activeCell = props.allCells[props.activeIndex];
    const filteredCells = props.allCells.filter(
      cell =>
        cell.imageSources.length > 0 || cell.text !== '' || cell.text != null
      // TODO // || cell.outputText != null
    );
    const newActiveIndex = filteredCells.findIndex(cell => cell === activeCell);
    let contextCells;
    switch (props.localContextScope) {
      case 'whole':
        contextCells = filteredCells;
        break;
      case 'upToGrader':
        contextCells = filteredCells.slice(0, Math.max(0, newActiveIndex + 1));
        break;
      case 'fiveAround':
        contextCells = filteredCells.slice(
          Math.max(0, newActiveIndex - 5),
          Math.min(filteredCells.length, newActiveIndex + 5)
        );
        break;
      case 'tenAround':
        contextCells = filteredCells.slice(
          Math.max(0, newActiveIndex - 10),
          Math.min(filteredCells.length, newActiveIndex + 10)
        );
        break;
      case 'none':
        contextCells = [filteredCells[newActiveIndex]];
        break;
    }
    return createChatContextFromCells(contextCells);
  };

  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory]);

  // Auto-scroll to bottom when streaming content updates
  useEffect(() => {
    if (chatContainerRef.current && liveResult) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [liveResult]);

  // Debug chat history changes
  useEffect(() => {
    devLog(
      () => 'Chat history changed.'
      //, chatHistory
    );
  }, [chatHistory]);

  const patchKeyCommand750 = usePatchKeyCommand750();
  const dataProps = patchKeyCommand750
    ? { 'data-lm-suppress-shortcuts': true }
    : {};

  /**
   * Converts a base64 data URL to a File object
   * @param {string} dataUrl - Base64 data URL (e.g., "data:image/png;base64,iVBORw0KGgo...")
   * @param {string} filename - Name for the file
   * @returns {File} File object
   */
  const dataUrlToFile = (
    dataUrl: string,
    filename: string = 'file'
  ): File | null => {
    try {
      // Validate data URL format
      if (!dataUrl.startsWith('data:')) {
        // throw new Error('Invalid data URL: must start with "data:"');
        devLog.warn(
          () => 'Invalid data URL: must start with "data:"',
          () => dataUrl
        );
        return null;
      }

      const [header, base64Data] = dataUrl.split(',');
      if (!base64Data) {
        // throw new Error('Invalid data URL: missing base64 data');
        devLog.warn(
          () => 'Invalid data URL: missing base64 data',
          () => dataUrl
        );
        return null;
      }

      const mimeMatch = header.match(/data:([^;]+)/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';

      // Validate MIME type for images
      if (!mimeType.startsWith('image/')) {
        devLog.warn(
          () => `Unexpected MIME type: ${mimeType}, expected image/*`,
          () => dataUrl
        );
        return null;
      }

      // Convert base64 to binary
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);

      // Create File object
      const file = new File([byteArray], filename, { type: mimeType });

      devLog(
        () =>
          `Created file: ${filename}, type: ${mimeType}, size: ${file.size} bytes`
      );

      return file;
    } catch (error) {
      devLog.error(
        () => 'Error converting data URL to File:',
        () => error
      );
      devLog.error(
        () => 'Data URL preview:',
        () => dataUrl.substring(0, 100) + '...'
      );
      throw new Error(
        `Invalid data URL format: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };

  const autoNewMessage =
    'This is my current attempt at the question. Focus on providing concise and accurate feedback that promotes understanding.';
  const queryAPI = async (forceSuggestion?: string) => {
    const noInput = inputValue === STARTING_MESSAGE && !forceSuggestion;
    const firstQuery = chatHistory.length === 0;
    if (noInput && !firstQuery) return;

    let newMessage = forceSuggestion || inputValue;
    let updatedChatHistory = [...chatHistory];

    if (noInput) {
      newMessage = autoNewMessage;
    } else {
      // Add user message immediately for responsiveness
      const userMessage: ChatHistoryItem = {
        role: 'user',
        content: newMessage
      };
      updatedChatHistory = [...updatedChatHistory, userMessage];
      setChatHistory(updatedChatHistory);
    }

    setIsLoading(true);
    const images = gatherImagesFromCells(props.allCells, 10, 5);

    if (images.length > 0) {
      devLog(
        () => 'Image detected.'
        //images[0].substring(0, 100) + '...'
      );
    }

    try {
      // Only gather context once on the first query
      if (!hasGatheredInitialContext.current) {
        initialContextData.current = await gatherLocalContext();
      }

      // For the first query, include initial notebook context
      // For subsequent queries, the server already has the full context
      // Send only the conversation history up to the previous assistant message to avoid duplicates
      const chatHistoryToSend = hasGatheredInitialContext.current
        ? updatedChatHistory.slice(0, -1) // Exclude the user message we just added
        : [...initialContextData.current, ...updatedChatHistory];

      // console.log(
      //   'Sending to server - updatedChatHistory:',
      //   chatHistoryToSend
      // );
      const files = images.map((image, index) => {
        // Extract filename from base64 data URL or use default
        let filename = 'image.png';
        try {
          const [header] = image.split(',');
          const mimeMatch = header.match(/data:([^;]+)/);
          if (mimeMatch) {
            const mimeType = mimeMatch[1];
            const extension =
              mimeType === 'image/png'
                ? 'png'
                : mimeType === 'image/jpeg'
                  ? 'jpg'
                  : mimeType === 'image/gif'
                    ? 'gif'
                    : 'png';
            filename = `image_${index}.${extension}`;
          }
        } catch (error) {
          console.warn('Could not extract filename from image:', error);
          filename = `image_${index}.png`;
        }

        return {
          name: filename,
          file: dataUrlToFile(image, filename)
        };
      });

      // TODO - i think we can just keep this on. successful feature flag
      if (true) {
        // Use streaming request
        setLiveResult(''); // Clear previous live result

        // Create FormData for streaming request
        const formData = new FormData();
        formData.append('chatHistory', JSON.stringify(chatHistoryToSend));
        formData.append('images', JSON.stringify(images));
        formData.append('newMessage', newMessage);
        formData.append(
          'currentChatHistory',
          JSON.stringify(updatedChatHistory)
        );
        formData.append('cellType', cellType);
        formData.append('userId', userId || '');

        // Add files
        files
          .filter(file => file.file instanceof File)
          .forEach(file => {
            if (file.file) {
              formData.append(file.name, file.file);
            }
          });

        const response = await fetch(`${baseURL}interaction/stream`, {
          method: 'POST',
          body: formData,
          mode: 'cors',
          credentials: 'include',
          cache: 'no-cache'
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response body reader available');
        }

        const decoder = new TextDecoder();
        let buffer = '';
        let currentMessage = '';

        try {
          while (true) {
            const { done, value } = await reader.read();

            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep incomplete line in buffer

            for (const line of lines) {
              if (line.trim() === '') continue;

              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));

                  if (data.type === 'message_delta') {
                    currentMessage += data.content;
                    setLiveResult(currentMessage);
                  } else if (data.type === 'final_response') {
                    // Complete message received - add to chat history
                    handleQueryResult(data.data, noInput, newMessage);
                    setLiveResult(null); // Clear live result when message is complete
                    break;
                  }
                } catch (parseError) {
                  devLog.error(
                    () => 'Failed to parse SSE data:',
                    () => parseError,
                    () => 'Line:',
                    () => line
                  );
                }
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
      } else {
        // Use regular request
        const response: any = await makeAPIRequest('interaction', {
          method: 'POST',
          data: {
            chatHistory: chatHistoryToSend,
            images,
            newMessage,
            // Include the current chat history so the server has the full context
            currentChatHistory: updatedChatHistory,
            cellType,
            userId: userId || ''
          },
          files: files.filter(file => file.file instanceof File)
        });

        if (!response.success) {
          console.error('API request failed:', response.error);
          // Remove user message if request failed
          // if (!(firstQuery && config.usage.automatic_first_query_on_error)) {
          //   setChatHistory(prev => prev.slice(0, -1));
          // }
        } else {
          handleQueryResult(response.data, noInput, newMessage);
        }
      }
    } catch (error) {
      console.error('API request failed:', error);
      // Remove user message if request failed
      // if (!firstQuery) {
      setChatHistory(prev => prev.slice(0, -1));
      // }
    }

    setIsLoading(false);
    setInputValue('');
  };

  const handleQueryResult = (
    data: any,
    firstQuery: boolean,
    newMessage: string
  ) => {
    if (data?.newChatHistory) {
      devLog(
        () => 'Server returned newChatHistory:',
        () => data.newChatHistory
      );
      // Replace the entire chat history with the server response
      let finalChatHistory = data.newChatHistory;
      if (firstQuery) {
        // console.log(
        //   'finalChatHistory',
        //   finalChatHistory,
        //   'firstQuery',
        //   firstQuery
        // );
        // Hide the system reasoning item if present (defensive guard)
        const idxToHide = finalChatHistory.length - 3;
        if (
          idxToHide >= 0 &&
          idxToHide < finalChatHistory.length &&
          finalChatHistory[idxToHide]
        ) {
          finalChatHistory[idxToHide].noShow = true;
        }

        // Additionally hide the auto user message (default newMessage) if the backend returns it
        finalChatHistory = finalChatHistory.map((item: any) => {
          if (item?.role === 'user') {
            let text: string | undefined;
            if (typeof item.content === 'string') {
              text = item.content;
            } else if (
              Array.isArray(item.content) &&
              item.content.length > 0 &&
              item.content[0] &&
              typeof item.content[0].text === 'string'
            ) {
              text = item.content[0].text;
            }
            if (text === newMessage) {
              return { ...item, noShow: true };
            }
          }
          return item;
        });
      }
      setChatHistory(finalChatHistory);

      // Only mark initial context as gathered after successful first query
      if (!hasGatheredInitialContext.current) {
        hasGatheredInitialContext.current = true;
      }
    } else {
      devLog(
        () => 'Chat history not send, appending as fallback',
        () => data
      );
      // If server doesn't return newChatHistory, append the assistant response
      // This is a fallback to ensure the conversation continues
      const assistantMessage: ChatHistoryItem = {
        role: 'assistant',
        content:
          data?.response ||
          'I apologize, but I encountered an issue processing your request.'
      };
      // Add both user message and assistant response
      const userMessage: ChatHistoryItem = {
        role: 'user',
        content: newMessage
      };
      setChatHistory(prev => [...prev, userMessage, assistantMessage]);
    }
  };

  // TODO - this is disabled in the default config - decide whether to keep it around
  // useEffect(() => {
  //   if (
  //     config.usage.automatic_first_query_on_error &&
  //     cellType === 'code' &&
  //     chatHistory.length === 0
  //   ) {
  //     queryAPI();
  //     setInputValue('Generating analysis...');
  //   }
  // }, []);

  const callSuggestion = (suggestion: string) => {
    if (isLoading) return;
    setInputValue(suggestion);
    queryAPI(suggestion);
  };

  const callCurrentChatInput = () => {
    if (isLoading) return;
    queryAPI(inputValue);
  };

  return (
    // Note we can use the same CSS classes from Method 1
    <div className={`jupytutor ${isLoading ? 'loading' : ''}`} {...dataProps}>
      <div className="chat-container" ref={chatContainerRef}>
        {chatHistory
          .filter(item => !item.noShow)
          .map((item, index) => (
            <ChatMessage {...item} index={index} />
          ))}
        {/**The above handles the ChatHistory. Below handles a new streaming message.*/}
        <StreamingAssistantMessage liveResult={liveResult} />
      </div>

      {quickResponses.length > 0 && (
        <TailoredOptions
          options={quickResponses}
          callSuggestion={callSuggestion}
          isLoading={isLoading}
        />
      )}
      <ChatInput
        value={inputValue}
        onChange={setInputValue}
        onSubmit={callCurrentChatInput}
        isLoading={isLoading}
        placeholder="Ask JupyTutor anything..."
        setProactiveEnabled={(enabled: boolean) => {
          props.setNotebookConfig(
            produce(notebookConfig, (draft: PluginConfig) => {
              if (!draft.preferences) {
                draft.preferences = { proactiveEnabled: enabled };
                return;
              }
              draft.preferences.proactiveEnabled = enabled;
            })
          );
        }}
      />
    </div>
  );
};

// Provides an interface for Jupyter to render the React Component
class JupytutorWidget extends ReactWidget {
  private readonly props: JupytutorProps;
  constructor(
    props: JupytutorProps = {
      autograderResponse: undefined,
      allCells: [],
      activeIndex: -1,
      localContextScope: 'upToGrader',
      sendTextbookWithRequest: false,
      notebookContextRetriever: null,
      cellType: 'code',
      userId: null,
      baseURL: '',
      instructorNote: null,
      quickResponses: [],
      setNotebookConfig: () => {}
    }
  ) {
    super();
    this.props = props;
    this.addClass('jp-ReactWidget'); // For styling
  }

  render(): JSX.Element {
    return <Jupytutor {...this.props} />;
  }
}

export default JupytutorWidget;
