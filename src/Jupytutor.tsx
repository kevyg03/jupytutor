// import { Widget } from '@lumino/widgets';
import { useState, useEffect, useRef, useMemo } from 'react';
import { ParsedCell } from './helpers/parseNB';

import { ReactWidget } from '@jupyterlab/apputils';
import { makeAPIRequest } from './helpers/makeAPIRequest';
import '../style/index.css';
import ContextRetrieval, {
  STARTING_TEXTBOOK_CONTEXT
} from './helpers/contextRetrieval';
import { formatMessage } from './helpers/messageFormatting';
import { DEMO_PRINTS } from '.';

export interface JupytutorProps {
  autograderResponse: string | undefined;
  allCells: ParsedCell[];
  activeIndex: number;
  notebookContext: 'whole' | 'upToGrader' | 'fiveAround' | 'tenAround' | 'none';
  sendTextbookWithRequest: boolean;
  contextRetriever: ContextRetrieval | null;
  cellType:
    | 'code'
    | 'free_response'
    | 'grader'
    | 'success'
    | 'error'
    | 'grader_not_initialized';
  userId: string | null;
  config: any;
}

interface ChatHistoryItem {
  role: 'user' | 'assistant' | 'system';
  content: { text: string; type: string }[] | string;
  noShow?: boolean;
}

export const Jupytutor = (props: JupytutorProps): JSX.Element => {
  const STARTING_MESSAGE = '';
  const [inputValue, setInputValue] = useState(STARTING_MESSAGE);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const hasGatheredInitialContext = useRef(false);
  const initialContextData = useRef<ChatHistoryItem[]>([]);

  const [liveResult, setLiveResult] = useState<string | null>(null);

  const {
    sendTextbookWithRequest,
    contextRetriever,
    cellType,
    userId,
    config
  } = props;

  const createChatContextFromCells = (
    cells: ParsedCell[]
  ): ChatHistoryItem[] => {
    let textbookContext: ChatHistoryItem[] = [];
    if (sendTextbookWithRequest && contextRetriever != null) {
      const context = contextRetriever.getContext();

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
      if (DEMO_PRINTS) console.log('Sending textbook with request');
    } else {
      if (DEMO_PRINTS) console.log('NOT sending textbook with request');
    }

    const notebookContext: ChatHistoryItem[] = cells.map(cell => {
      const hasOutput = cell.outputText !== '' && cell.outputText != null;
      if ((hasOutput && cell.type === 'code') || cell.type === 'grader') {
        return {
          role: 'system' as const,
          content: [
            {
              text:
                // 'The student (user role) is provided a coding skeleton and has submitted the following code:\n' +
                cell.text +
                '\nThe above code produced the following output:\n' +
                cell.outputText,
              type: 'input_text'
            }
          ],
          noShow: true
        };
      } else if (cell.type === 'free_response') {
        if (DEMO_PRINTS)
          console.log('Sending free response prompt with request!');
        return {
          role: 'system' as const,
          content: [
            {
              text:
                "The following is the student's response to the free response question directly above: [response start]" +
                cell.text +
                '\n[response over]. Provide concise feedback on the response with a focus on accuracy and understanding.',
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
            text: cell.text,
            type: 'input_text'
          }
        ],
        noShow: true
      };
    });

    return [...textbookContext, ...notebookContext];
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
      if (cell.images.length > 0 && cell.type === 'code') {
        images.push(...cell.images);
      }
      if (cell.images.length > 0 && cell.type !== 'code') {
        images.push(...cell.images);
        break;
      }
    }
    return images.slice(0, maxImages);
  };

  const gatherContext = () => {
    const filteredCells = props.allCells.filter(
      cell =>
        cell.images.length > 0 ||
        cell.text !== '' ||
        cell.text != null ||
        cell.outputText != null
    );
    const newActiveIndex = filteredCells.findIndex(
      cell => cell.index === props.activeIndex
    );
    let contextCells;
    switch (props.notebookContext) {
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
    if (DEMO_PRINTS) console.log('Chat history changed:', chatHistory);
  }, [chatHistory]);

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
        if (DEMO_PRINTS)
          console.warn('Invalid data URL: must start with "data:"', dataUrl);
        return null;
      }

      const [header, base64Data] = dataUrl.split(',');
      if (!base64Data) {
        // throw new Error('Invalid data URL: missing base64 data');
        if (DEMO_PRINTS)
          console.warn('Invalid data URL: missing base64 data', dataUrl);
        return null;
      }

      const mimeMatch = header.match(/data:([^;]+)/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';

      // Validate MIME type for images
      if (!mimeType.startsWith('image/')) {
        if (DEMO_PRINTS)
          console.warn(
            `Unexpected MIME type: ${mimeType}, expected image/*`,
            dataUrl
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

      if (DEMO_PRINTS) {
        console.log(
          `Created file: ${filename}, type: ${mimeType}, size: ${file.size} bytes`
        );
      }

      return file;
    } catch (error) {
      console.error('Error converting data URL to File:', error);
      console.error('Data URL preview:', dataUrl.substring(0, 100) + '...');
      throw new Error(
        `Invalid data URL format: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };

  const autoNewMessage =
    'This is my current attempt at the question. Focus on providing concise and accurate feedback that promotes understanding.';
  const queryAPI = async (
    forceSuggestion?: string,
    useStreaming: boolean = config.usage.use_streaming
  ) => {
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

    if (DEMO_PRINTS && images.length > 0) {
      console.log('First image preview:', images[0].substring(0, 100) + '...');
    }

    try {
      // Only gather context once on the first query
      if (!hasGatheredInitialContext.current) {
        initialContextData.current = gatherContext();
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

      if (useStreaming) {
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

        const response = await fetch(
          `${config.api.baseURL}interaction/stream`,
          {
            method: 'POST',
            body: formData,
            mode: 'cors',
            credentials: 'include',
            cache: 'no-cache'
          }
        );

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
                  console.warn(
                    'Failed to parse SSE data:',
                    parseError,
                    'Line:',
                    line
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
          if (!(firstQuery && config.usage.automatic_first_query_on_error)) {
            setChatHistory(prev => prev.slice(0, -1));
          }
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
      if (DEMO_PRINTS)
        console.log('Server returned newChatHistory:', data.newChatHistory);
      // Replace the entire chat history with the server response
      let finalChatHistory = data.newChatHistory;
      if (DEMO_PRINTS)
        console.log(
          'finalChatHistory',
          finalChatHistory,
          'firstQuery',
          firstQuery
        );
      if (firstQuery) {
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
      if (DEMO_PRINTS)
        console.log('Chat history not send, appending as fallback', data);
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

  useEffect(() => {
    if (
      config.usage.automatic_first_query_on_error &&
      cellType === 'grader' &&
      chatHistory.length === 0
    ) {
      queryAPI();
      setInputValue('Generating analysis...');
    }
  }, []);

  const callSuggestion = (suggestion: string) => {
    if (isLoading) return;
    setInputValue(suggestion);
    queryAPI(suggestion);
  };

  const callCurrentChatInput = () => {
    if (isLoading) return;
    queryAPI(inputValue);
  };

  const options: TailoredOptionProps[] = useMemo(() => {
    let opts: TailoredOptionProps[];

    if (cellType === 'grader')
      opts = [
        { id: 'error', text: 'Explain this error.' },
        {
          id: 'source',
          text: 'Provide a concise list of important review materials.'
        },
        { id: 'progress', text: 'What progress have I made so far?' }
      ];
    else if (cellType === 'free_response')
      opts = [
        {
          id: 'evaluate',
          text: 'Evaluate my answer.'
        }
      ];
    else if (cellType === 'success')
      opts = [
        { id: 'clarify', text: "I still don't feel confident in my answer." },
        {
          id: 'source_success',
          text: 'Provide me three important review materials.'
        },
        {
          id: 'improvements',
          text: 'Can I make further improvements?'
        }
      ];
    else opts = [];

    return opts;
  }, [cellType]);

  return (
    // Note we can use the same CSS classes from Method 1
    <div className={`jupytutor ${isLoading ? 'loading' : ''}`}>
      <div className="chat-container" ref={chatContainerRef}>
        {chatHistory
          .filter(item => !item.noShow)
          .map((item, index) => {
            const message =
              typeof item.content === 'string'
                ? item.content
                : item.content[0].text;
            const isUser = item.role === 'user';

            return (
              <div key={index} className="chat-message-wrapper">
                <div
                  className={`chat-sender-label ${isUser ? 'user' : 'assistant'}`}
                >
                  {isUser ? 'You' : 'JupyTutor'}
                </div>
                {isUser ? (
                  <ChatBubble message={message} position="right" />
                ) : (
                  <AssistantMessage
                    message={message}
                    streaming={
                      !config.usage.use_streaming ? 'none' : 'streamed'
                    }
                  />
                )}
              </div>
            );
          })}

        {/* Live streaming result */}
        {liveResult && (
          <div className="chat-message-wrapper">
            <div className="chat-sender-label assistant">JupyTutor</div>
            <div className="streaming-message">
              <AssistantMessage message={liveResult} streaming="streaming" />
              <div className="streaming-indicator">
                <div className="typing-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {options.length > 0 && (
        <TailoredOptions
          options={options}
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
      />
    </div>
  );
};

interface TailoredOptionsProps {
  options: TailoredOptionProps[];
  callSuggestion: (suggestion: string) => void;
  isLoading: boolean;
}

const TailoredOptions = (props: TailoredOptionsProps): JSX.Element => {
  return (
    <div
      className={`tailoredOptionsContainer ${props.isLoading ? 'loading' : ''}`}
    >
      {props.options.map((item, index) => (
        <TailoredOption
          {...item}
          key={item.id}
          callSuggestion={props.callSuggestion}
        />
      ))}
    </div>
  );
};

interface TailoredOptionProps {
  id: string;
  text: string;
  callSuggestion?: (suggestion: string) => void;
}

const TailoredOption = (props: TailoredOptionProps): JSX.Element => {
  return (
    <div
      className="tailoredOption"
      onClick={() => props.callSuggestion && props.callSuggestion(props.text)}
    >
      <h4>{props.text}</h4>
    </div>
  );
};

interface ChatBubbleProps {
  message: string;
  position: 'left' | 'right';
  timestamp?: string;
}

const ChatBubble = (props: ChatBubbleProps): JSX.Element => {
  const { message, position, timestamp } = props;
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Trigger fade-in animation after component mounts
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 100); // Small delay for smooth animation

    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className={`chat-bubble chat-bubble-${position} ${isVisible ? 'chat-bubble-visible' : ''}`}
    >
      <div className="chat-message">{message}</div>
      {timestamp && <div className="chat-timestamp">{timestamp}</div>}
    </div>
  );
};

interface AssistantMessageProps {
  message: string;
  streaming: 'none' | 'streamed' | 'streaming';
}

const AssistantMessage = (props: AssistantMessageProps): JSX.Element => {
  const { message, streaming } = props;
  const [isVisible, setIsVisible] = useState(streaming !== 'none');

  useEffect(() => {
    if (streaming !== 'none') return;
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className={`assistant-message ${isVisible ? 'assistant-visible' : ''} ${streaming === 'streaming' ? 'assistant-streaming' : ''}`}
    >
      {formatMessage(message)}
    </div>
  );
};

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  placeholder?: string;
}

const ChatInput = (props: ChatInputProps): JSX.Element => {
  const { value, onChange, onSubmit, isLoading, placeholder } = props;

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !isLoading) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className={`chat-input-container ${isLoading ? 'loading' : ''}`}>
      <input
        type="text"
        className={`chat-input ${isLoading ? 'loading' : ''}`}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyPress={handleKeyPress}
        placeholder={placeholder}
        disabled={isLoading}
      />
      <button
        className={`chat-submit-btn ${isLoading ? 'loading' : ''}`}
        onClick={onSubmit}
        disabled={isLoading || !value.trim()}
      >
        {isLoading ? (
          <div className="loading-spinner">
            <div className="spinner-ring"></div>
          </div>
        ) : (
          <svg className="submit-icon" viewBox="0 0 24 24" fill="none">
            <path
              d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"
              fill="currentColor"
            />
          </svg>
        )}
      </button>
    </div>
  );
};

class JupytutorWidget extends ReactWidget {
  private readonly props: JupytutorProps;
  constructor(
    props: JupytutorProps = {
      autograderResponse: undefined,
      allCells: [],
      activeIndex: -1,
      notebookContext: 'upToGrader',
      sendTextbookWithRequest: false,
      contextRetriever: null,
      cellType: 'code',
      userId: null,
      config: {}
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
