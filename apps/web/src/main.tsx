import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { LearnerLanguageProvider } from "./learner-language";
import { ModelSettingsProvider } from "./model-settings";
import "./visual-system.css";

createRoot(document.getElementById("root")!).render(<React.StrictMode><LearnerLanguageProvider><ModelSettingsProvider><App /></ModelSettingsProvider></LearnerLanguageProvider></React.StrictMode>);
