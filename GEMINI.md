# GEMINI.md

## Project Overview

This project is an AI-powered test workbench that allows users to create and manage automated tests using natural language. The application is a web-based interface built with React, TypeScript, and Vite. It leverages the Gemini API to translate user intents into structured test steps and to generate complete test scripts in two different modes:

*   **Static Mode:** Generates standard Playwright test scripts that are fast but sensitive to UI changes.
*   **Dynamic Mode:** Generates test scripts for a custom "Stagehand (AI)" framework, which is more resilient to UI changes.

The application's UI is composed of several key components:

*   **StepList:** Displays the list of test steps.
*   **ComponentLibrary:** A library of reusable test components.
*   **BrowserPreview:** A live preview of the website under test.
*   **CodePanel:** Displays the generated test script.
*   **FlowGraph:** Visualizes the test flow.

## Building and Running

To build and run this project, you will need to have Node.js and pnpm installed.

1.  **Install dependencies:**
    ```bash
    pnpm install
    ```

2.  **Set up your environment variables:**
    Create a `.env.local` file in the root of the project and add your Gemini API key:
    ```
    GEMINI_API_KEY=your-api-key
    ```

3.  **Run the development server:**
    ```bash
    pnpm run dev
    ```
    This will start the Vite development server and you can view the application in your browser at `http://localhost:5173`.

### Other Scripts

*   **Build for production:**
    ```bash
    pnpm run build
    ```

*   **Preview the production build:**
    ```bash
    pnpm run preview
    ```

## Development Conventions

*   **Technology Stack:** The project is built with React, TypeScript, and Vite.
*   **Styling:** The project uses Tailwind CSS for styling. The class names are written directly in the JSX.
*   **State Management:** The main application state is managed in the `App.tsx` component using React hooks (`useState`, `useEffect`).
*   **API Interaction:** All interaction with the Gemini API is handled in the `services/geminiService.ts` file.
*   **Typing:** The project uses TypeScript and defines custom types in the `types.ts` file.
*   **Component Structure:** Components are organized in the `components` directory. Each component is in its own file.
*   **AI Integration:** The project uses the `@google/genai` package to interact with the Gemini API. The AI logic is separated into the `services` directory.
