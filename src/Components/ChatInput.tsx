import '../../style/index.css';
import { ChatMenu } from './ChatMenu';


interface ChatInputProps {
    value: string;
    onChange: (value: string) => void;
    onSubmit: () => void;
    isLoading: boolean;
    placeholder?: string;
    setProactiveEnabled: (enabled: boolean) => void;
  }
  
  export const ChatInput = (props: ChatInputProps): JSX.Element => {
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
        {/* TODO: i kind of wanted this button to the left, but it overlaps with the output-area-enter click. */}
        {/* should widget go in output area? */}
        <ChatMenu setProactiveEnabled={props.setProactiveEnabled} />
      </div>
    );
  };