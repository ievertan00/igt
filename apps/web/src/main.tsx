import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { LearnerLanguageProvider } from "./learner-language";
import "./visual-system.css";

createRoot(document.getElementById("root")!).render(<React.StrictMode><LearnerLanguageProvider><App /></LearnerLanguageProvider></React.StrictMode>);
