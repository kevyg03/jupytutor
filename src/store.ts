import { Draft, produce } from 'immer';
import { useMemo } from 'react';
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { ChatHistoryItem } from './components/ChatMessage';
import { useCellId, useNotebookPath } from './context/notebook-cell-context';
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

type NotebookState = {
  widgetStateByCellId: Record<string, WidgetState>;
  notebookConfig: PluginConfig | null;
};

type JupytutorReactState = {
  patchKeyCommand750: boolean;

  notebookStateByPath: Record<string, NotebookState>;

  setChatHistory: (
    notebookPath: string
  ) => (cellId: string) => (chatHistory: ChatHistoryItem[]) => void;
  setLiveResult: (
    notebookPath: string
  ) => (cellId: string) => (liveResult: string | null) => void;
  setIsLoading: (
    notebookPath: string
  ) => (cellId: string) => (isLoading: boolean) => void;

  setNotebookConfig: (
    notebookPath: string
  ) => (newConfig: PluginConfig) => void;
};

const ensureDraftHasNotebookCell = (
  draft: Draft<JupytutorReactState>,
  notebookPath: string,
  cellId: string
) => {
  if (!draft.notebookStateByPath[notebookPath]) {
    draft.notebookStateByPath[notebookPath] = {
      widgetStateByCellId: {},
      notebookConfig: null
    };
  }

  if (!draft.notebookStateByPath[notebookPath].widgetStateByCellId[cellId]) {
    draft.notebookStateByPath[notebookPath].widgetStateByCellId[cellId] =
      DEFAULT_WIDGET_STATE();
  }
};

const cellData = (
  draft: Draft<JupytutorReactState>,
  notebookPath: string,
  cellId: string
) => {
  ensureDraftHasNotebookCell(draft, notebookPath, cellId);
  return draft.notebookStateByPath[notebookPath].widgetStateByCellId[cellId];
};

export const useJupytutorReactState = create<JupytutorReactState>()(
  subscribeWithSelector(set => ({
    patchKeyCommand750: false,

    notebookStateByPath: {} as Record<string, NotebookState>,
    setChatHistory:
      (notebookPath: string) =>
      (cellId: string) =>
      (chatHistory: ChatHistoryItem[]) => {
        set(state => {
          return produce(state, draft => {
            cellData(draft, notebookPath, cellId).chatHistory = chatHistory;
          });
        });
      },

    setLiveResult:
      (notebookPath: string) =>
      (cellId: string) =>
      (liveResult: string | null) => {
        set(state => {
          return produce(state, draft => {
            cellData(draft, notebookPath, cellId).liveResult = liveResult;
          });
        });
      },

    setIsLoading:
      (notebookPath: string) => (cellId: string) => (isLoading: boolean) => {
        set(state => {
          return produce(state, draft => {
            cellData(draft, notebookPath, cellId).isLoading = isLoading;
          });
        });
      },

    setNotebookConfig: (notebookPath: string) => (newConfig: PluginConfig) => {
      set(state => {
        return produce(state, draft => {
          draft.notebookStateByPath[notebookPath].notebookConfig = newConfig;
        });
      });
    }
  }))
);

// @ts-expect-error debug
window.useJupytutorReactState = useJupytutorReactState;

const useNotebookState = () => {
  const notebookPath = useNotebookPath();
  return useJupytutorReactState(
    state => state.notebookStateByPath[notebookPath]
  );
};

export const useNotebookPreferences = () => {
  const [config] = useNotebookConfig();
  return config?.preferences;
};

export const usePatchKeyCommand750 = () => {
  return useJupytutorReactState(state => state.patchKeyCommand750);
};

export const useWidgetState = () => {
  const notebookPath = useNotebookPath();
  const cellId = useCellId();

  if (cellId === null) {
    throw new Error('useWidgetState must be used within a CellContextProvider');
  }

  return (
    useJupytutorReactState(
      state =>
        state.notebookStateByPath[notebookPath]?.widgetStateByCellId[cellId]
    ) ?? DEFAULT_WIDGET_STATE()
  );
};

export const useChatHistory = (): [
  ChatHistoryItem[],
  (chatHistory: ChatHistoryItem[]) => void
] => {
  const notebookPath = useNotebookPath();
  const cellId = useCellId();
  const setChatHistory = useJupytutorReactState(state => state.setChatHistory);
  const widgetState = useWidgetState();
  const setChatHistoryCurried = useMemo(
    () => setChatHistory(notebookPath)(cellId),
    [widgetState, notebookPath, cellId]
  );

  return [widgetState.chatHistory, setChatHistoryCurried];
};

export const useLiveResult = (): [
  string | null,
  (liveResult: string | null) => void
] => {
  const notebookPath = useNotebookPath();
  const cellId = useCellId();
  const setLiveResult = useJupytutorReactState(state => state.setLiveResult);
  const widgetState = useWidgetState();
  const setLiveResultCurried = useMemo(
    () => setLiveResult(notebookPath)(cellId),
    [widgetState, notebookPath, cellId]
  );

  return [widgetState.liveResult, setLiveResultCurried];
};

export const useIsLoading = (): [boolean, (isLoading: boolean) => void] => {
  const notebookPath = useNotebookPath();
  const cellId = useCellId();
  const setIsLoading = useJupytutorReactState(state => state.setIsLoading);
  const widgetState = useWidgetState();
  const setIsLoadingCurried = useMemo(
    () => setIsLoading(notebookPath)(cellId),
    [widgetState, notebookPath, cellId]
  );

  return [widgetState.isLoading, setIsLoadingCurried];
};

export const useNotebookConfig = () => {
  const notebookPath = useNotebookPath();
  const notebookState = useNotebookState();
  const setNotebookConfig = useJupytutorReactState(
    state => state.setNotebookConfig
  );
  const setNotebookConfigCurried = useMemo(
    () => setNotebookConfig(notebookPath),
    [notebookPath]
  );
  return [notebookState.notebookConfig, setNotebookConfigCurried] as const;
};
