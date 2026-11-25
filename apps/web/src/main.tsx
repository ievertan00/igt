import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { LearnerLanguageProvider } from "./components/learner-language";
import { ModelSettingsProvider } from "./components/model-settings";
import "./visual-system.css";
import "./pages/AndroidWorkspace.css";

createRoot(document.getElementById("root")!).render(<React.StrictMode><LearnerLanguageProvider><ModelSettingsProvider><App /></ModelSettingsProvider></LearnerLanguageProvider></React.StrictMode>);
