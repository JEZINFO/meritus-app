"use client";

import { createContext, useContext } from "react";

const ProgramContext = createContext({
  programas: [],
  programaId: "",
  setProgramaId: () => {},
  loadingProgramas: false,
});

export function ProgramProvider({ value, children }) {
  return <ProgramContext.Provider value={value}>{children}</ProgramContext.Provider>;
}

export function useProgram() {
  return useContext(ProgramContext);
}
