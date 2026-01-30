import { create } from 'zustand';
import { PluginConfig } from './schemas/config';

export const useJupytutorReactState = create(() => ({
  notebookConfig: null! as PluginConfig, // shh
  patchKeyCommand750: false
}));

export const useNotebookPreferences = () => {
  return useJupytutorReactState(state => state.notebookConfig.preferences);
};

export const usePatchKeyCommand750 = () => {
  return useJupytutorReactState(state => state.patchKeyCommand750);
};
