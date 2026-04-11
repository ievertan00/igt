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
- **🆕 English Learning Suite**:
  - **Automatic Data Collection**: All grammar checks are logged to a local SQLite database.
  - **Anki Flashcards**: Export your errors as study cards (`cards` command).
  - **Personal Error Handbook**: Generate a Markdown report of your weak points (`handbook` command).
  - **Practice Mode**: Get targeted exercises based on your errors (`practice` command).
  - **Proficiency Assessment**: Estimate your CEFR level and track progress (`assess` command).

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

### 🆕 Learning Commands (Inside IGT)

Once you've collected some grammar check data, you can use these commands:

| Command | Description |
|---------|-------------|
| `cards` | Export Anki-compatible flashcards CSV |
| `handbook` | Generate personal error handbook (Markdown) |
| `practice` | Start targeted practice exercises |
| `assess` | View proficiency assessment and CEFR estimate |

### Standalone Commands (Outside IGT)

```powershell
# Initialize database (first time only)
node init-db.mjs

# Export flashcards with custom filename
node igt-cards.mjs --export my_cards.csv

# Generate handbook for last 7 days
node igt-handbook.mjs --days=7

# Practice specific error type
node igt-practice.mjs "Article misuse"

# Generate 10 practice exercises
node igt-practice.mjs --count=10
```

## Configuration (`igt_config.json`)

```json
{
    "ReviewPath": "C:\\path\\to\\your\\Review_Log.md",
    "Model": "gemini-2.5-flash-lite",
    "SystemPromptPath": "system_prompt.txt",
    "DbPath": "igt_data.db",
    "ApiKey": "YOUR_API_KEY_HERE"
}
```

| Field | Description |
|-------|-------------|
| `ReviewPath` | Path to Markdown log file |
| `Model` | Gemini model to use |
| `SystemPromptPath` | Path to system prompt file |
| `DbPath` | SQLite database path for learning data |
| `ApiKey` | Your Gemini API key |

## License

MIT
