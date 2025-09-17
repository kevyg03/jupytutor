// import { Widget } from '@lumino/widgets';
import { useState, useEffect, useRef } from 'react';
import { ParsedCell } from './helpers/parseNB';

import { ReactWidget } from '@jupyterlab/apputils';
import { makeAPIRequest } from './helpers/makeAPIRequest';
import '../style/index.css';
import ContextRetrieval, {
  STARTING_TEXTBOOK_CONTEXT
} from './helpers/contextRetrieval';
import { DEMO_PRINTS } from '.';

export interface JupytutorProps {
  autograderResponse: string | undefined;
  allCells: ParsedCell[];
  activeIndex: number;
  notebookContext: 'whole' | 'upToGrader' | 'fiveAround' | 'tenAround' | 'none';
  sendTextbookWithRequest: boolean;
  contextRetriever: ContextRetrieval | null;
}

interface ChatHistoryItem {
  role: 'user' | 'assistant' | 'system';
  content: { text: string; type: string }[] | string;
  noShow?: boolean;
}

export const Jupytutor = (props: JupytutorProps): JSX.Element => {
  const STARTING_MESSAGE = 'Generating initial analysis...';
  const [inputValue, setInputValue] = useState(STARTING_MESSAGE);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const hasGatheredInitialContext = useRef(false);
  const initialContextData = useRef<ChatHistoryItem[]>([]);

  const { sendTextbookWithRequest, contextRetriever } = props;

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
      if (hasOutput) {
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
        contextCells = filteredCells.slice(0, Math.max(0, newActiveIndex));
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
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory]);

  // Show suggestions after first assistant response
  useEffect(() => {
    const hasAssistantResponse = chatHistory.some(
      item => item.role === 'assistant' && !item.noShow
    );
    if (hasAssistantResponse && !showSuggestions) {
      setShowSuggestions(true);
    }
  }, [chatHistory, showSuggestions]);

  // Debug chat history changes
  useEffect(() => {
    if (DEMO_PRINTS) console.log('Chat history changed:', chatHistory);
  }, [chatHistory]);

  const queryAPI = async (forceSuggestion?: string) => {
    const noInput = inputValue === STARTING_MESSAGE && !forceSuggestion;
    const firstQuery = chatHistory.length === 0 && noInput;
    if (noInput && !firstQuery) return;

    let newMessage = forceSuggestion || inputValue;
    let updatedChatHistory = [...chatHistory];

    if (noInput) {
      newMessage =
        "This is my first attempt at the question. It's possible an attempt wasn't made yet. Either way, the error is provided above and some non-revealing, concise, and pedagogical steps to work toward a solution would be helpful. Frameworking your finding into bullet lists is helpful for formatting.";
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

      const response: any = await makeAPIRequest('interaction', {
        method: 'POST',
        data: {
          chatHistory: chatHistoryToSend,
          images,
          newMessage,
          // Include the current chat history so the server has the full context
          currentChatHistory: updatedChatHistory
        },
        files: images.map(image => ({
          name: image.split('/').pop(),
          file: image
        }))
      });

      if (!response.success) {
        console.error('API request failed:', response.error);
        // Remove user message if request failed
        if (!firstQuery) {
          setChatHistory(prev => prev.slice(0, -1));
        }
      } else if (response.data?.newChatHistory) {
        console.log(
          'Server returned newChatHistory:',
          response.data.newChatHistory
        );
        // Replace the entire chat history with the server response
        let finalChatHistory = response.data.newChatHistory;
        if (firstQuery) {
          // 3 because of the reasoning item that's hidden
          finalChatHistory[finalChatHistory.length - 3].noShow = true;
        }
        setChatHistory(finalChatHistory);

        // Only mark initial context as gathered after successful first query
        if (!hasGatheredInitialContext.current) {
          hasGatheredInitialContext.current = true;
        }
      } else {
        console.log('Server response data:', response.data);
        // If server doesn't return newChatHistory, append the assistant response
        // This is a fallback to ensure the conversation continues
        const assistantMessage: ChatHistoryItem = {
          role: 'assistant',
          content:
            response.data?.response ||
            'I apologize, but I encountered an issue processing your request.'
        };
        // Add both user message and assistant response
        const userMessage: ChatHistoryItem = {
          role: 'user',
          content: newMessage
        };
        setChatHistory(prev => [...prev, userMessage, assistantMessage]);
      }
    } catch (error) {
      console.error('API request failed:', error);
      // Remove user message if request failed
      if (!firstQuery) {
        setChatHistory(prev => prev.slice(0, -1));
      }
    }

    setIsLoading(false);
    setInputValue('');
  };

  useEffect(() => {
    queryAPI();
  }, []);

  const callSuggestion = (suggestion: string) => {
    setInputValue(suggestion);
    queryAPI(suggestion);
  };

  const callCurrentChatInput = () => {
    queryAPI(inputValue);
  };

  const options: TailoredOptionProps[] = [
    { id: 'error', text: 'Why this error?' },
    { id: 'source', text: 'What should I review?' },
    { id: 'progress', text: 'What progress have I made?' },
    { id: 'course', text: 'What course concepts are relevant?' }
  ];

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
                  <AssistantMessage message={message} />
                )}
              </div>
            );
          })}
      </div>

      {showSuggestions && (
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
}

const AssistantMessage = (props: AssistantMessageProps): JSX.Element => {
  const { message } = props;
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Auto-format the message
  const formatMessage = (text: string): JSX.Element[] => {
    const lines = text.split('\n');
    return lines.map((line, index) => {
      const trimmedLine = line.trim();

      // Calculate indentation level based on leading whitespace
      const indentLevel = line.search(/\S/);
      const indentStyle =
        indentLevel > 0 ? { marginLeft: `${indentLevel * 0.5}em` } : {};

      // Handle hyphen lists
      if (trimmedLine.startsWith('- ')) {
        const content = trimmedLine.substring(2);

        // Check if the content starts with a colon sentence
        if (content.endsWith(':') && content.split(' ').length <= 15) {
          return (
            <div
              key={index}
              className="assistant-list-item"
              style={indentStyle}
            >
              <span className="list-bullet">•</span>
              <span className="list-content-header">{content}</span>
            </div>
          );
        }
        return (
          <div key={index} className="assistant-list-item" style={indentStyle}>
            <span className="list-bullet">•</span>
            <span className="list-content">{content}</span>
          </div>
        );
      }

      // Handle numbered lists
      if (/^\d+\.\s/.test(trimmedLine)) {
        const match = trimmedLine.match(/^(\d+)\.\s(.+)/);
        if (match) {
          return (
            <div
              key={index}
              className="assistant-list-item"
              style={indentStyle}
            >
              <span className="list-number">{match[1]}.</span>
              <span className="list-content">{match[2]}</span>
            </div>
          );
        }
      }

      // Handle code blocks (lines starting with 4+ spaces or tabs)
      if (/^(\s{4,}|\t)/.test(line)) {
        return (
          <div key={index} className="assistant-code-line" style={indentStyle}>
            {line}
          </div>
        );
      }

      // Handle empty lines
      if (trimmedLine === '') {
        return <div key={index} className="assistant-empty-line" />;
      }

      // Handle header formatting - single line sentences ending with colon
      if (
        trimmedLine.endsWith(':') &&
        !trimmedLine.includes('\n') &&
        trimmedLine.split(' ').length <= 15
      ) {
        return (
          <div
            key={index}
            className="assistant-header-line"
            style={indentStyle}
          >
            <strong>{trimmedLine}</strong>
          </div>
        );
      }

      // Handle regular text with proper indentation
      return (
        <div key={index} className="assistant-text-line" style={indentStyle}>
          {trimmedLine}
        </div>
      );
    });
  };

  return (
    <div
      className={`assistant-message ${isVisible ? 'assistant-visible' : ''}`}
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
      contextRetriever: null
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
