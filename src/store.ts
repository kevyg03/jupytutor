import { create } from 'zustand';
import { PluginConfig } from './schemas/config';
import { ChatHistoryItem } from './components/ChatMessage';
import { produce } from 'immer';

export type WidgetState = {
  chatHistory: ChatHistoryItem[];
  liveResult: string | null;
  isLoading: boolean;
};

const DEFAULT_WIDGET_STATE: WidgetState = {
  chatHistory: [],
  liveResult: null,
  isLoading: false
};

type JupytutorReactState = {
  notebookConfig: PluginConfig;
  patchKeyCommand750: boolean;
  widgetStateByCellId: Record<string, WidgetState>;
  setChatHistory: (cellId: string, chatHistory: ChatHistoryItem[]) => void;
  setLiveResult: (cellId: string, liveResult: string | null) => void;
  setIsLoading: (cellId: string, isLoading: boolean) => void;
};

// TODO probably change the scoping on these setters
export const useJupytutorReactState = create<JupytutorReactState>(set => ({
  notebookConfig: null! as PluginConfig, // shh
  patchKeyCommand750: false,

  widgetStateByCellId: {} as Record<string, WidgetState>,
  setChatHistory: (cellId: string, chatHistory: ChatHistoryItem[]) => {
    set(state => {
      return produce(state, draft => {
        if (!draft.widgetStateByCellId[cellId]) {
          draft.widgetStateByCellId[cellId] = DEFAULT_WIDGET_STATE;
        }
        draft.widgetStateByCellId[cellId].chatHistory = chatHistory;
      });
    });
  },

  setLiveResult: (cellId: string, liveResult: string | null) => {
    set(state => {
      return produce(state, draft => {
        if (!draft.widgetStateByCellId[cellId]) {
          draft.widgetStateByCellId[cellId] = DEFAULT_WIDGET_STATE;
        }
        draft.widgetStateByCellId[cellId].liveResult = liveResult;
      });
    });
  },

  setIsLoading: (cellId: string, isLoading: boolean) => {
    set(state => {
      return produce(state, draft => {
        if (!draft.widgetStateByCellId[cellId]) {
          draft.widgetStateByCellId[cellId] = DEFAULT_WIDGET_STATE;
        }
        draft.widgetStateByCellId[cellId].isLoading = isLoading;
      });
    });
  }
}));

export const useNotebookPreferences = () => {
  return useJupytutorReactState(state => state.notebookConfig.preferences);
};

export const usePatchKeyCommand750 = () => {
  return useJupytutorReactState(state => state.patchKeyCommand750);
};

export const useWidgetState = (cellId: string) => {
  return (
    useJupytutorReactState(state => state.widgetStateByCellId[cellId]) ??
    DEFAULT_WIDGET_STATE
  );
};

export const useChatHistory = (
  cellId: string
): [
  ChatHistoryItem[],
  (cellId: string, chatHistory: ChatHistoryItem[]) => void
] => {
  const widgetState = useWidgetState(cellId);
  return [
    widgetState.chatHistory,
    useJupytutorReactState(state => state.setChatHistory)
  ];
};

export const useLiveResult = (
  cellId: string
): [string | null, (cellId: string, liveResult: string | null) => void] => {
  const widgetState = useWidgetState(cellId);
  return [
    widgetState.liveResult,
    useJupytutorReactState(state => state.setLiveResult)
  ];
};

export const useIsLoading = (
  cellId: string
): [boolean, (cellId: string, isLoading: boolean) => void] => {
  const widgetState = useWidgetState(cellId);
  return [
    widgetState.isLoading,
    useJupytutorReactState(state => state.setIsLoading)
  ];
};
