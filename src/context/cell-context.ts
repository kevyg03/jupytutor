import { createContext, useContext } from 'react';

const CellContext = createContext<{ cellId: string | null }>({
  cellId: null
});

export const CellContextProvider = CellContext.Provider;
export const CellContextConsumer = CellContext.Consumer;

export const useCellId = () => {
  const context = useContext(CellContext);
  if (!context || context.cellId === null) {
    throw new Error(
      'useCellId must be used within a CellContextProvider with a non-null cellId'
    );
  }
  return context.cellId;
};
