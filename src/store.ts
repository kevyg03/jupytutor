import { create } from 'zustand';
import { PluginConfig } from './schemas/config';

export const useJupytutorReactState = create(() => ({
  notebookConfig: null! as PluginConfig // shh
}));

export const useNotebookPreferences = () => {
  return useJupytutorReactState(state => state.notebookConfig.preferences);
}