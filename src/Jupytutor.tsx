import type { ParsedCell, ParsedCellType } from './helpers/parseNB';

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
import GlobalNotebookContextRetrieval from './helpers/prompt-context/globalNotebookContextRetrieval';
import { PluginConfig } from './schemas/config';
import {
  useNotebookConfig,
  usePatchKeyCommand750,
  useWidgetState
} from './store';

export interface JupytutorProps {
  cellId: string;
  notebookPath: string;
  allCells: ParsedCell[];
  activeIndex: number;
  sendTextbookWithRequest: boolean;
  globalNotebookContextRetriever: GlobalNotebookContextRetrieval | null;
  cellType: ParsedCellType;
  userId: string | null;
  baseURL: string;
  instructorNote: string | null;
  quickResponses: string[];
}

export const Jupytutor = (props: JupytutorProps): JSX.Element => {
  const [notebookConfig, setNotebookConfig] = useNotebookConfig();
  const widgetState = useWidgetState();

  const {
    sendTextbookWithRequest,
    globalNotebookContextRetriever,
    baseURL,
    instructorNote,
    allCells,
    quickResponses
  } = props;

  const patchKeyCommand750 = usePatchKeyCommand750();
  const dataProps = patchKeyCommand750
    ? { 'data-lm-suppress-shortcuts': true }
    : {};

  // TODO: clean this up
  const queryAPI = useQueryAPIFunction(
    allCells,
    props.activeIndex,
    sendTextbookWithRequest,
    baseURL,
    instructorNote,
    globalNotebookContextRetriever
  );

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
      allCells: [],
      activeIndex: -1,
      sendTextbookWithRequest: false,
      globalNotebookContextRetriever: null,
      cellType: 'code',
      userId: null,
      baseURL: '',
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
