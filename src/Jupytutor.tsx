import type { ParsedCell, ParsedCellType } from './helpers/parseNB';

import { ReactWidget } from '@jupyterlab/apputils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { produce } from 'immer';
import '../style/index.css';
import { ChatHistory } from './components/ChatHistory';
import { ChatInput } from './components/ChatInput';
import { TailoredOptions } from './components/TailoredOptions';
import { useQueryAPIFunction } from './helpers/api/chat-api';
import GlobalNotebookContextRetrieval from './helpers/context/globalNotebookContextRetrieval';
import { PluginConfig } from './schemas/config';
import {
  useJupytutorReactState,
  usePatchKeyCommand750,
  useWidgetState
} from './store';

export interface JupytutorProps {
  autograderResponse: string | undefined;
  cellId: string;
  allCells: ParsedCell[];
  activeIndex: number;
  sendTextbookWithRequest: boolean;
  globalNotebookContextRetriever: GlobalNotebookContextRetrieval | null;
  cellType: ParsedCellType;
  userId: string | null;
  baseURL: string;
  instructorNote: string | null;
  quickResponses: string[];
  setNotebookConfig: (newConfig: PluginConfig) => void;
}

export const Jupytutor = (props: JupytutorProps): JSX.Element => {
  const notebookConfig = useJupytutorReactState(state => state.notebookConfig);
  const widgetState = useWidgetState(props.cellId);
  console.log({ widgetState });

  const {
    cellId,
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
    // chatHistory,
    // setChatHistory,
    // setLiveResult,
    // setIsLoading,
    cellId,
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
  private readonly queryClient: QueryClient;

  constructor(
    props: JupytutorProps = {
      autograderResponse: undefined,
      cellId: '',
      allCells: [],
      activeIndex: -1,
      sendTextbookWithRequest: false,
      globalNotebookContextRetriever: null,
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
    this.queryClient = new QueryClient();
    this.addClass('jp-ReactWidget'); // For styling
  }

  render(): JSX.Element {
    return (
      <QueryClientProvider client={this.queryClient}>
        <Jupytutor {...this.props} />
      </QueryClientProvider>
    );
  }
}

export default JupytutorWidget;
