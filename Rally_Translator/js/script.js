document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element References ---
    const uiQueryInput = document.getElementById('rally-query');
    const translateButton = document.getElementById('translate-button');
    const errorMessageDiv = document.getElementById('error-message');
    const errorTextSpan = document.getElementById('error-text');
    const resultsContainer = document.getElementById('results-container');

    const fullUrlValue = document.getElementById('full-url-value');
    // Debugging: Reference to the decoded query value display element (commented out as per original)
    // const decodedQueryValue = document.getElementById('decoded-query-value');
    // Debugging: Reference to the encoded query value display element (commented out as per original)
    // const encodedQueryValue = document.getElementById('encoded-query-value');

    const copyFullUrlBtn = document.getElementById('copy-full-url');
    // Debugging: Reference to the copy button for the decoded query (commented out as per original)
    // const copyDecodedQueryBtn = document.getElementById('copy-decoded-query');
    // Debugging: Reference to the copy button for the encoded query (commented out as per original)
    // const copyEncodedQueryBtn = document.getElementById('copy-encoded-query');

    const testCasesContainer = document.getElementById('test-cases-container');

    // --- STATE MANAGEMENT (Plain JS variables) ---
    // Initialize uiQuery with the value directly from the textarea on load
    let uiQuery = uiQueryInput.value; 

    // --- TEST CASES ---
    const testCases = {
        "User Reported Query": `((parent.formattedID = PGM519) and (ProductArea = "D-RAD") AND (ProductRoadmapQuarterStatus = "Committed") and (State != Done))`,
        "Complex Mixed Logic": `(((Parent.formattedid = PGM519) OR (Parent.formattedid = PGM815)) AND (tags.name contains "#AWSMasterPRJ") OR ((milestones.ObjectID = 734046831375) OR (milestones.ObjectID = 465069487428)) AND ((c_ProjStatusColor = "Red") OR (c_ProjStatusColor = "Yellow")) AND (State != Done) AND (State != "Obsolete/Not Needed") AND (tags.name !contains "Exclude_RY_Status"))`,
        "Simple Custom Field": `(My Custom Field = "Test Value" and status = In-Progress)`,
        "Nested Parentheses": `((((parent.formattedID = PGM519) AND ((milestones.ObjectID = 734046831375) OR (milestones.ObjectID = 465069487428)) AND (State != "Obsolete/Not Needed")))) OR (parent.formattedID = PGM815))`,
    };

    // --- CORE TRANSLATION LOGIC (Unchanged from React version) ---
    const CONFIRMED_FIELDS = new Set([
        'c_CustomerReferenceWorkOrderCR', 'c_CustomerReqID', 'c_ItemPriority',
        'c_PMOLeader', 'c_ProductArea', 'c_ProductRoadmapBUTEOProduct',
        'c_ProductRoadmapQuarter', 'c_ProductRoadmapQuarterStatus', 'c_ProductSuitePriority',
        'c_ProgramManager', 'c_ProjectProgress', 'c_ProjStatusColor', 'c_TechOwner',
        'c_TEOActionsToGreen', 'c_TEOFunctionalArea', 'c_TEOMajorDeliverable',
        'c_TEORYReason', 'Expedite', 'FormattedID', 'LeafStoryPlanEstimateTotal',
        'Milestones', 'Name', 'Notes', 'Owner', 'Parent', 'PercentDoneByStoryCount',
        'PercentDoneByStoryPlanEstimate', 'PlannedEndDate', 'PlannedStartDate',
        'PreliminaryEstimate', 'State', 'status', 'TEOMajorDeliverable', 'Tags'
    ]);

    const toPascalCase = (str) => {
        if (!str) return '';
        return str.replace(/\w+/g, w => w[0].toUpperCase() + w.slice(1)).replace(/\s/g, '');
    };
    
    const translateRallyQuery = (query) => {
        // Regex to split the query into tokens, handling quoted strings, operators, and words/periods.
        // It now correctly handles parts like '!=', '!contains', 'contains', and 'AND'/'OR' as distinct tokens.
        const rawTokens = query.match(/"[^"]*"|\(|\)|!=|!contains|contains|=|>|<|\bAND\b|\bOR\b|[\w\s.]+/g) || [];
        if (rawTokens.length === 0 && query.trim() !== '') {
            throw new Error("Could not parse the query. Please check for syntax errors or provide a valid query.");
        }

        const tokens = [];
        const operatorsAndParens = new Set(['(', ')', '=', '!=', '>', '<', 'contains', '!contains']);
        rawTokens.forEach(rawToken => {
            const t = rawToken.trim();
            if (t === '') return; // Skip empty tokens

            // Special handling for tokens ending with ')' that are not operators themselves
            // Example: "FormattedID)" should split into "FormattedID" and ")"
            if (t.length > 1 && t.endsWith(')')) {
                const partBeforeParen = t.slice(0, -1).trim();
                // Check if the part before the parenthesis is NOT an operator or another parenthesis
                if (!operatorsAndParens.has(partBeforeParen.toLowerCase())) {
                    tokens.push(partBeforeParen);
                    tokens.push(')');
                    return;
                }
            }
            tokens.push(t);
        });
        
        const expressions = [];
        const logicalOperators = [];
        const operators = new Set(['=', '!=', '>', '<', 'contains', '!contains']);
        let i = 0;

        while (i < tokens.length) {
            let token = tokens[i];
            const lowerToken = token.toLowerCase();

            if (lowerToken === 'and' || lowerToken === 'or') {
                if(expressions.length > 0) { // Only add logical operator if there's a preceding expression
                    logicalOperators.push(token.toUpperCase());
                }
                i++;
                continue;
            }

            if (token === '(') {
                let balance = 1;
                let j = i + 1;
                // Find the matching closing parenthesis
                while (j < tokens.length && balance > 0) {
                    if (tokens[j] === '(') balance++;
                    if (tokens[j] === ')') balance--;
                    j++;
                }
                if (balance !== 0) throw new Error("Mismatched parentheses in your query.");
                
                // Extract the sub-query (excluding the outer parentheses)
                const subQuery = tokens.slice(i + 1, j - 1).join(' ');
                const subTranslation = translateRallyQuery(subQuery);
                
                expressions.push(subTranslation.decodedQuery);
                i = j; // Move index past the processed sub-query
                continue;
            }

            // Expecting a field, operator, value triplet
            const fieldToken = tokens[i];
            const operatorToken = tokens[i + 1];
            const valueToken = tokens[i + 2];

            // Basic validation for the triplet
            if(!fieldToken || !operatorToken || !valueToken || !operators.has(operatorToken.toLowerCase())) {
                throw new Error(`Malformed expression starting near: '${fieldToken || tokens[i]}' or unexpected token at index ${i}. Expected a 'Field Operator Value' pattern.`);
            }
            
            let finalField;
            if (fieldToken.includes('.')) {
                // Handle dot notation (e.g., Parent.FormattedID, Tags.Name)
                const parts = fieldToken.split('.').map(part => {
                   const casedPart = toPascalCase(part);
                   // If the cased part is a confirmed field, use it, otherwise keep original part (for nested custom fields)
                   return CONFIRMED_FIELDS.has(casedPart) ? casedPart : part;
                });
                finalField = parts.join('.');
            } else {
                // For single fields, convert to PascalCase and prefix with 'c_' if not a confirmed field
                const pascalCased = toPascalCase(fieldToken);
                if (CONFIRMED_FIELDS.has(pascalCased)) {
                    finalField = pascalCased;
                } else {
                    // Assume it's a custom field if not in confirmed list
                    finalField = `c_${pascalCased}`;
                }
            }

            let finalValue = valueToken;
            // Check if value needs quotes: it's not already quoted, not a number, not true/false
            if (!finalValue.startsWith('"') && !finalValue.endsWith('"') && !/^\d+$/.test(finalValue) && finalValue.toLowerCase() !== 'true' && finalValue.toLowerCase() !== 'false') {
               finalValue = `"${finalValue}"`;
            }
            
            expressions.push(`(${finalField} ${operatorToken.toLowerCase()} ${finalValue})`);
            i += 3; // Move past the field, operator, and value
        }

        if (expressions.length === 0 && query.trim() !== '') {
            // This case might be hit if the tokenizer found tokens but the parser couldn't make expressions
            throw new Error("No valid query expressions could be extracted. Please check your query syntax.");
        }
        if (expressions.length === 0) {
            return { decodedQuery: '', encodedQuery: '', fullExampleUrl: '' };
        }
        
        // Final check to ensure a valid structure of expressions and logical operators
        if (expressions.length !== logicalOperators.length + 1 && logicalOperators.length > 0) {
            throw new Error(`Invalid query structure. Found ${expressions.length} expressions but ${logicalOperators.length} logical operators. This might be due to malformed expressions or missing operators.`);
        }

        let decodedQuery = expressions[0];
        for (let k = 0; k < logicalOperators.length; k++) {
            decodedQuery = `(${decodedQuery} ${logicalOperators[k]} ${expressions[k + 1]})`;
        }
        
        const encodedQuery = encodeURIComponent(decodedQuery);
        const fullExampleUrl = `https://rally1.rallydev.com/slm/webservice/v2.0/portfolioitem/ppmproject?query=${encodedQuery}`;

        return { decodedQuery, encodedQuery, fullExampleUrl };
    };


    // --- UI Update Functions ---

    function displayError(message) {
        errorTextSpan.textContent = message;
        errorMessageDiv.classList.remove('hidden');
        resultsContainer.classList.add('hidden'); // Hide results if there's an error
    }

    function hideError() {
        errorMessageDiv.classList.add('hidden');
        errorTextSpan.textContent = '';
    }

    function displayResults(translation) {
        fullUrlValue.textContent = translation.fullExampleUrl;
        // Debugging: Display the decoded query in its dedicated element. Uncomment to re-enable.
        // decodedQueryValue.textContent = translation.decodedQuery;
        // Debugging: Display the URL-encoded query in its dedicated element. Uncomment to re-enable.
        // encodedQueryValue.textContent = translation.encodedQuery;
        resultsContainer.classList.remove('hidden');
    }

    function hideResults() {
        resultsContainer.classList.add('hidden');
        fullUrlValue.textContent = '';
        // Debugging: Clear the decoded query display element. Uncomment to re-enable.
        // decodedQueryValue.textContent = '';
        // Debugging: Clear the encoded query display element. Uncomment to re-enable.
        // encodedQueryValue.textContent = '';
    }

    function setCopyButtonState(buttonElement, isCopied) {
        const copyTextSpan = buttonElement.querySelector('.copy-text');
        const copyIcon = buttonElement.querySelector('.copy-icon');
        const checkIcon = buttonElement.querySelector('.check-icon');

        if (isCopied) {
            buttonElement.classList.add('copied');
            copyTextSpan.textContent = 'Copied!';
            if (copyIcon) copyIcon.classList.add('hidden');
            if (checkIcon) checkIcon.classList.remove('hidden');
        } else {
            buttonElement.classList.remove('copied');
            copyTextSpan.textContent = 'Copy';
            if (copyIcon) copyIcon.classList.remove('hidden');
            if (checkIcon) checkIcon.classList.add('hidden');
        }
    }

    // --- EVENT HANDLERS ---

    uiQueryInput.addEventListener('input', (event) => {
        uiQuery = event.target.value;
        hideError(); // Clear error on new input
        hideResults(); // Clear results on new input
    });

    translateButton.addEventListener('click', () => {
        hideError();
        hideResults(); // Ensure results are hidden initially for a new translation

        if (!uiQuery.trim()) {
            displayError("Query input cannot be empty.");
            return;
        }

        try {
            const translation = translateRallyQuery(uiQuery.trim());
            displayResults(translation);
        } catch (e) {
            displayError(e.message);
        }
    });

    const handleCopyToClipboard = (text, buttonElement) => {
        // Create a temporary textarea element to copy text
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = 'fixed'; // Prevents scrolling to bottom
        textArea.style.left = '-9999px'; // Move off-screen
        textArea.style.top = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select(); // Select the text in the textarea

        try {
            document.execCommand('copy'); // Execute copy command
            setCopyButtonState(buttonElement, true); // Update button UI to "Copied!"
            // Revert button UI after 2 seconds
            setTimeout(() => {
                setCopyButtonState(buttonElement, false);
            }, 2000);
        } catch (err) {
            console.error('Failed to copy: ', err);
            // Optionally, display a user-friendly error message if copy fails
        } finally {
            document.body.removeChild(textArea); // Clean up the temporary textarea
        }
    };

    // Attach clipboard handlers to each copy button
    copyFullUrlBtn.addEventListener('click', () => handleCopyToClipboard(fullUrlValue.textContent, copyFullUrlBtn));
    // Debugging: Attach clipboard handler for the decoded query copy button. Uncomment to re-enable.
    // copyDecodedQueryBtn.addEventListener('click', () => handleCopyToClipboard(decodedQueryValue.textContent, copyDecodedQueryBtn));
    // Debugging: Attach clipboard handler for the encoded query copy button. Uncomment to re-enable.
    // copyEncodedQueryBtn.addEventListener('click', () => handleCopyToClipboard(encodedQueryValue.textContent, copyEncodedQueryBtn));

    // Populate test cases buttons dynamically
    for (const [name, query] of Object.entries(testCases)) {
        const button = document.createElement('button');
        button.textContent = name;
        // Add Pico's button classes and our custom test-case-btn class
        button.classList.add('test-case-btn');
        button.addEventListener('click', () => {
            uiQueryInput.value = query; // Update textarea value
            uiQuery = query; // Update internal state variable
            hideError(); // Clear error messages
            hideResults(); // Hide previous results
        });
        testCasesContainer.appendChild(button);
    }

    // Initial state setup
    hideError(); // Ensure error is hidden on page load
    hideResults(); // Ensure results are hidden on page load
});
