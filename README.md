# Rally API Query Tool

This is a simple, client-side web tool designed to help users translate Rally UI queries into API-compatible query URLs or construct new queries based on a list of parent object IDs. It leverages Pico.css for a minimalist and responsive design.

## Table of Contents

  * [Features](https://www.google.com/search?q=%23features)
  * [Technologies Used](https://www.google.com/search?q=%23technologies-used)
  * [Getting Started](https://www.google.com/search?q=%23getting-started)
  * [Usage](https://www.google.com/search?q=%23usage)
      * [Translate Tab](https://www.google.com/search?q=%23translate-tab)
      * [Construct Tab](https://www.google.com/search?q=%23construct-tab)
  * [Project Structure](https://www.google.com/search?q=%23project-structure)
  * [Customization](https://www.google.com/search?q=%23customization)
  * [Contributing](https://www.google.com/search?q=%23contributing)
  * [License](https://www.google.com/search?q=%23license)

-----

## Features

  * **UI Query Translation**: Converts human-readable Rally UI queries (e.g., `(State = Open) AND (Owner = user@example.com)`) into URL-encoded API queries.
  * **Query Construction**: Generates API queries for child items based on a comma-separated list of parent Formatted IDs (e.g., `PRJ101, PRJ102`).
  * **Tabbed Interface**: Easily switch between "Translate" and "Construct" functionalities.
  * **Copy to Clipboard**: One-click button to copy the generated API URL.
  * **Error Handling**: Provides clear messages for invalid inputs or query structures.
  * **Minimalist Design**: Built with Pico.css for a clean and accessible user interface.
  * **Separation of Concerns**: HTML, CSS, and JavaScript are cleanly separated into their respective files for better maintainability and readability.

-----

## Technologies Used

  * **HTML5**: For the basic structure of the web page.
  * **CSS3**: For styling and layout.
  * **JavaScript (ES6+)**: For interactive functionality and query logic.
  * **Pico.css**: A minimalist CSS framework for styling.

-----

## Getting Started

To get a copy of the project up and running on your local machine, follow these simple steps.

### Prerequisites

You only need a modern web browser to open the `index.html` file.

### Installation

1.  **Clone the repository** (if hosted on Git) or **download the project files** as a ZIP.
    ```bash
    git clone https://github.com/your-username/rally-api-query-tool.git
    cd rally-api-query-tool
    ```
2.  **Navigate to the project directory:**
    ```bash
    cd rally-api-query-tool
    ```
3.  **Open `index.html` in your web browser:**
    Simply double-click `index.html` or drag it into your browser.

-----

## Usage

The tool presents two main functionalities accessible via tabs: "Translate" and "Construct".

### Translate Tab

This tab is designed to convert a Rally UI query string into a URL-encoded string suitable for the Rally API.

1.  **Enter your Rally UI Query**: Type or paste your query into the text area. An example query is pre-filled.
2.  **Click "Translate"**: The tool will process your input and display the full Rally API Query URL in the results section below.
3.  **Copy the URL**: Use the "Copy" button to quickly copy the generated URL to your clipboard.

### Construct Tab

This tab helps you build a Rally API query from a list of parent object IDs.

1.  **Enter Parent Object IDs**: Type or paste a comma-separated list of Rally Formatted IDs (e.g., `PRJ101, PRJ102, FEA300`). An example list is pre-filled.
      * **Important**: All IDs must be of the same type (e.g., all `PRJ` or all `FEA`). The tool currently supports `PRJ` (for `portfolioitem/ppmfeature`) and `FEA` (for `portfolioitem/teamfeature`) prefixes.
2.  **Click "Construct"**: The tool will generate a query URL based on your provided IDs.
3.  **Copy the URL**: Use the "Copy" button to copy the generated URL.

-----

## Project Structure

The project follows a clean and separated structure:

```
rally-api-query-tool/
├── index.html        // Main HTML file, defines the page structure and links to CSS/JS
├── css/              // Contains all project-specific CSS
│   └── style.css     // Custom styles for the tool
└── js/               // Contains all project-specific JavaScript
    └── script.js     // Handles all interactive logic and query processing
```

-----

## Customization

You can easily customize this tool:

  * **Styling**: Modify `css/style.css` to change colors, fonts, spacing, or other visual aspects. The base font size for the entire application can be adjusted by changing the `--pico-font-size` variable within the `:root` selector in `style.css`.
  * **Query Logic**: Edit `js/script.js` to modify how queries are translated or constructed, or to add new functionalities.
  * **Rally Fields**: The `CONFIRMED_FIELDS` Set in `script.js` can be updated to include or remove recognized Rally field names for translation.
  * **Endpoint Mapping**: The `ENDPOINT_MAPPING` object in `script.js` can be extended to support more Rally object types for query construction.

-----