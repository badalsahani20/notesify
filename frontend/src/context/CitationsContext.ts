import { createContext } from "react";
import type { WebCitation } from "@/components/ai/types";

export const CitationsContext = createContext<WebCitation[]>([]);
