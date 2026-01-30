import { produce } from 'immer';
import { useMemo } from 'react';
import { create } from 'zustand';
import { ChatHistoryItem } from './components/ChatMessage';
import { useCellId } from './context/cell-context';
import { PluginConfig } from './schemas/config';

export type WidgetState = {
  chatHistory: ChatHistoryItem[];
  liveResult: string | null;
  isLoading: boolean;
};

const DEFAULT_WIDGET_STATE: () => WidgetState = () => ({
  chatHistory: [],
  liveResult: null,
  isLoading: false
});

type JupytutorReactState = {
  notebookConfig: PluginConfig;
  patchKeyCommand750: boolean;

  widgetStateByCellId: Record<string, WidgetState>;
  setChatHistory: (cellId: string) => (chatHistory: ChatHistoryItem[]) => void;
  setLiveResult: (cellId: string) => (liveResult: string | null) => void;
  setIsLoading: (cellId: string) => (isLoading: boolean) => void;
};

// TODO probably change the scoping on these setters
export const useJupytutorReactState = create<JupytutorReactState>(set => ({
  notebookConfig: null! as PluginConfig, // shh
  patchKeyCommand750: false,

  widgetStateByCellId: {} as Record<string, WidgetState>,
  setChatHistory: (cellId: string) => (chatHistory: ChatHistoryItem[]) => {
    set(state => {
      return produce(state, draft => {
        if (!draft.widgetStateByCellId[cellId]) {
          draft.widgetStateByCellId[cellId] = DEFAULT_WIDGET_STATE();
        }
        draft.widgetStateByCellId[cellId].chatHistory = chatHistory;
      });
    });
  },

  setLiveResult: (cellId: string) => (liveResult: string | null) => {
    set(state => {
      return produce(state, draft => {
        if (!draft.widgetStateByCellId[cellId]) {
          draft.widgetStateByCellId[cellId] = DEFAULT_WIDGET_STATE();
        }
        draft.widgetStateByCellId[cellId].liveResult = liveResult;
      });
    });
  },

  setIsLoading: (cellId: string) => (isLoading: boolean) => {
    set(state => {
      return produce(state, draft => {
        if (!draft.widgetStateByCellId[cellId]) {
          draft.widgetStateByCellId[cellId] = DEFAULT_WIDGET_STATE();
        }
        draft.widgetStateByCellId[cellId].isLoading = isLoading;
      });
    });
  }
}));

// @ts-expect-error debug
window.useJupytutorReactState = useJupytutorReactState;

export const useNotebookPreferences = () => {
  return useJupytutorReactState(state => state.notebookConfig.preferences);
};

export const usePatchKeyCommand750 = () => {
  return useJupytutorReactState(state => state.patchKeyCommand750);
};

export const useWidgetState = () => {
  const cellId = useCellId();

  if (cellId === null) {
    throw new Error('useWidgetState must be used within a CellContextProvider');
  }

  return (
    useJupytutorReactState(state => state.widgetStateByCellId[cellId]) ??
    DEFAULT_WIDGET_STATE()
  );
};

export const useChatHistory = (): [
  ChatHistoryItem[],
  (chatHistory: ChatHistoryItem[]) => void
] => {
  const cellId = useCellId();
  const setChatHistory = useJupytutorReactState(state => state.setChatHistory);
  const widgetState = useWidgetState();
  const setChatHistoryCurried = useMemo(
    () => setChatHistory(cellId),
    [widgetState, cellId]
  );

  return [widgetState.chatHistory, setChatHistoryCurried];
};

export const useLiveResult = (): [
  string | null,
  (liveResult: string | null) => void
] => {
  const cellId = useCellId();
  const setLiveResult = useJupytutorReactState(state => state.setLiveResult);
  const widgetState = useWidgetState();
  const setLiveResultCurried = useMemo(
    () => setLiveResult(cellId),
    [widgetState, cellId]
  );

  return [widgetState.liveResult, setLiveResultCurried];
};

export const useIsLoading = (): [boolean, (isLoading: boolean) => void] => {
  const cellId = useCellId();
  const setIsLoading = useJupytutorReactState(state => state.setIsLoading);
  const widgetState = useWidgetState();
  const setIsLoadingCurried = useMemo(
    () => setIsLoading(cellId),
    [widgetState, cellId]
  );

  return [widgetState.isLoading, setIsLoadingCurried];
};
