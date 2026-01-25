import ReactMarkdown from 'react-markdown';
import { useFadeInVisibleState } from '../hooks/useFadeInVisibleState';
import '../../style/index.css';

export interface ChatHistoryItem {
  role: 'user' | 'assistant' | 'system';
  content: { text: string; type: string }[] | string;
  noShow?: boolean;
  index?: number;
}

export const ChatMessage = (props: ChatHistoryItem) => {
  const message =
    typeof props.content === 'string' ? props.content : props.content[0].text;
  const isUser = props.role === 'user';

  return (
    <div key={props.index} className="chat-message-wrapper">
      {/* <div
              className={`chat-sender-label ${isUser ? 'user' : 'assistant'}`}
          >
              {isUser ? 'You' : 'JupyTutor'}
          </div> */}
      {isUser ? (
        <UserMessage message={message} position="right" />
      ) : (
        <AssistantMessage message={message} streaming={'streamed'} />
      )}
    </div>
  );
};

interface ChatBubbleProps {
  message: string;
  position: 'left' | 'right';
  timestamp?: string;
}

const UserMessage = (props: ChatBubbleProps): JSX.Element => {
  const { message, position, timestamp } = props;
  const isVisible = useFadeInVisibleState(100);

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
  const shouldFadeIn = streaming === 'none';
  const fadeInVisible = useFadeInVisibleState(100);
  const isVisible = shouldFadeIn ? fadeInVisible : true;

  console.log(message);

  return (
    <div
      className={`assistant-message ${isVisible ? 'assistant-visible' : ''} ${streaming === 'streaming' ? 'assistant-streaming' : ''}`}
    >
      <ReactMarkdown
        components={{
          a: ({ node, ...props }) => (
            <a
              className="assistant-link"
              {...props}
              target="_blank"
              rel="noopener noreferrer"
            />
          ),
          h1: ({ node, ...props }) => (
            <h1
              style={{
                fontSize: '1.4em',
                fontWeight: 'bold',
                marginTop: '0.8em',
                marginBottom: '0.4em'
              }}
              {...props}
            />
          ),
          h2: ({ node, ...props }) => (
            <h2
              style={{
                fontSize: '1.2em',
                fontWeight: 'bold',
                marginTop: '0.8em',
                marginBottom: '0.4em'
              }}
              {...props}
            />
          ),
          h3: ({ node, ...props }) => (
            <h3
              style={{
                fontSize: '1.1em',
                fontWeight: 'bold',
                marginTop: '0.6em',
                marginBottom: '0.3em'
              }}
              {...props}
            />
          )
        }}
      >
        {message}
      </ReactMarkdown>
    </div>
  );
};

interface StreamingAssistantMessageProps {
  liveResult: string | null;
}

export const StreamingAssistantMessage = (
  props: StreamingAssistantMessageProps
): JSX.Element | null => {
  if (!props.liveResult) return null;

  return (
    <div className="chat-message-wrapper">
      <div className="chat-sender-label assistant">JupyTutor</div>
      <div className="streaming-message">
        <AssistantMessage message={props.liveResult} streaming="streaming" />
        <div className="streaming-indicator">
          <div className="typing-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      </div>
    </div>
  );
};
