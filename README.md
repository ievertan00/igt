# Interactive Grammar Tool (IGT)

IGT is a high-performance, CLI-based grammar validation and refinement tool. It leverages the Google Gemini API to provide meticulous linguistic audits, corrections, and professional refinements in real-time.

## Features

- **High Speed**: Optimized Node.js bridge achieves loop times of **<2 seconds**.
- **Meticulous Audits**: Identifies specific grammatical errors, punctuation issues, and typos.
- **Three-Tier Feedback**:
  - **Review**: Detailed analysis of the original text.
  - **Correction**: Grammatically perfect version of the input.
  - **Refine**: Polished, professional version for natural flow.
- **Persistent Logging**: Automatically logs all interactions to a Markdown file (e.g., in an Obsidian vault).
- **Customizable**: Externalize system prompts and models via `igt_config.json`.

## Prerequisites

- **Node.js** (v24 or higher recommended)
- **PowerShell** (for the main loop)
- **Google AI Studio API Key** (Get one at [aistudio.google.com](https://aistudio.google.com/))

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/ievertan00/igt.git
   cd igt
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure the tool:
   - Copy `igt_config.json` (if not present, create it based on the template).
   - Add your Gemini API Key to `igt_config.json` or set the `GOOGLE_API_KEY` environment variable.
   - Set the `ReviewPath` to your desired Markdown log file.

## Usage

Run the tool using the PowerShell script or the CMD wrapper:

```powershell
./igt.ps1
```

Or via CMD:
```cmd
igt.cmd
```

Type your text at the `Grammar Input >` prompt and press Enter. Type `exit` to quit.

## Configuration (`igt_config.json`)

```json
{
    "ReviewPath": "C:\\path\\to\\your\\Review_Log.md",
    "Model": "gemini-2.5-flash-lite",
    "SystemPromptPath": "system_prompt.txt",
    "ApiKey": "YOUR_API_KEY_HERE"
}
```

## License

MIT
