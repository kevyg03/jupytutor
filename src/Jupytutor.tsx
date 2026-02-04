import { ReactWidget } from '@jupyterlab/apputils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { produce } from 'immer';
import '../style/index.css';
import { ChatHistory } from './components/ChatHistory';
import { ChatInput } from './components/ChatInput';
import { TailoredOptions } from './components/TailoredOptions';
import {
  CellContextProvider,
  NotebookContextProvider
} from './context/notebook-cell-context';
import { useQueryAPIFunction } from './helpers/api/chat-api';
import { PluginConfig } from './schemas/config';
import {
  useNotebookConfig,
  usePatchKeyCommand750,
  useWidgetState
} from './store';

export interface JupytutorProps {
  cellId: string;
  notebookPath: string;
  activeIndex: number;
  instructorNote: string | null;
  quickResponses: string[];
}

// big TODO -- chat history no longer clears. maybe would be good if there were a way to force-clear?
// not sure if the chat context is actually updating when we update the cell value

export const Jupytutor = (props: JupytutorProps): JSX.Element => {
  const [notebookConfig, setNotebookConfig] = useNotebookConfig();
  const widgetState = useWidgetState();

  const { activeIndex, instructorNote, quickResponses } = props;

  const patchKeyCommand750 = usePatchKeyCommand750();
  const dataProps = patchKeyCommand750
    ? { 'data-lm-suppress-shortcuts': true }
    : {};

  // TODO: clean this up
  const queryAPI = useQueryAPIFunction(activeIndex, instructorNote);

  const callSuggestion = async (suggestion: string) => {
    if (widgetState.isLoading) return;
    await queryAPI(suggestion);
  };

  const callChatInput = async (input: string) => {
    if (widgetState.isLoading) return;
    await queryAPI(input);
  };

  return (
    <div
      className={`jupytutor ${widgetState.isLoading ? 'loading' : ''}`}
      {...dataProps}
    >
      <ChatHistory
        chatHistory={widgetState.chatHistory}
        liveResult={widgetState.liveResult}
      />

      {quickResponses.length > 0 && (
        <TailoredOptions
          options={quickResponses}
          callSuggestion={callSuggestion}
          isLoading={widgetState.isLoading}
        />
      )}
      <ChatInput
        onSubmit={callChatInput}
        isLoading={widgetState.isLoading}
        setProactiveEnabled={(enabled: boolean) => {
          setNotebookConfig(
            produce(
              // TODO
              notebookConfig ?? ({} as PluginConfig),
              (draft: PluginConfig) => {
                if (!draft.preferences) {
                  draft.preferences = { proactiveEnabled: enabled };
                  return;
                }
                draft.preferences.proactiveEnabled = enabled;
              }
            )
          );
        }}
      />
    </div>
  );
};

// Provides an interface for Jupyter to render the React Component
class JupytutorWidget extends ReactWidget {
  private readonly props: JupytutorProps;
  private readonly queryClient: QueryClient;

  constructor(
    props: JupytutorProps = {
      cellId: '',
      notebookPath: '',
      activeIndex: -1,
      instructorNote: null,
      quickResponses: []
    }
  ) {
    super();
    this.props = props;
    this.queryClient = new QueryClient();
    this.addClass('jp-ReactWidget'); // For styling
  }

  render(): JSX.Element {
    return (
      <QueryClientProvider client={this.queryClient}>
        <NotebookContextProvider
          value={{ notebookPath: this.props.notebookPath }}
        >
          <CellContextProvider value={{ cellId: this.props.cellId }}>
            <Jupytutor {...this.props} />
          </CellContextProvider>
        </NotebookContextProvider>
      </QueryClientProvider>
    );
  }
}

export default JupytutorWidget;
