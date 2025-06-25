document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element References ---
    const errorMessageDiv = document.getElementById('error-message');
    const errorTextSpan = document.getElementById('error-text');
    const resultsContainer = document.getElementById('results-container');
    const fullUrlValue = document.getElementById('full-url-value');
    const copyFullUrlBtn = document.getElementById('copy-full-url');

    // --- PESTAÑAS ---
    const tabTranslate = document.getElementById('tab-translate');
    const tabConstruct = document.getElementById('tab-construct');
    const translateContent = document.getElementById('translate-content');
    const constructContent = document.getElementById('construct-content');

    // --- CONTROLES PESTAÑA TRANSLATE ---
    const uiQueryInputTranslate = document.getElementById('rally-query-translate');
    const translateButton = document.getElementById('translate-button');
    // REMOVED: const testCasesContainerTranslate = document.getElementById('test-cases-container-translate');

    // --- CONTROLES PESTAÑA CONSTRUCT ---
    const uiQueryInputConstruct = document.getElementById('rally-query-construct');
    const constructButton = document.getElementById('construct-button');

    // --- STATE MANAGEMENT ---
    let uiQuery = uiQueryInputTranslate.value;

    // --- LÓGICA DE PESTAÑAS ---
    function showTab(tabToShow) {
        hideError();
        hideResults();
        if (tabToShow === 'translate') {
            translateContent.classList.remove('hidden');
            constructContent.classList.add('hidden');
            tabTranslate.setAttribute('aria-selected', 'true');
            tabConstruct.setAttribute('aria-selected', 'false');
        } else {
            translateContent.classList.add('hidden');
            constructContent.classList.remove('hidden');
            tabTranslate.setAttribute('aria-selected', 'false');
            tabConstruct.setAttribute('aria-selected', 'true');
        }
    }
    tabTranslate.addEventListener('click', (e) => { e.preventDefault(); showTab('translate'); });
    tabConstruct.addEventListener('click', (e) => { e.preventDefault(); showTab('construct'); });

    // --- LÓGICA DE TRANSLATE (EXISTENTE Y FUNCIONAL) ---
    // REMOVED: const testCases = { ... };
    const CONFIRMED_FIELDS = new Set(['c_CustomerReferenceWorkOrderCR', 'c_CustomerReqID', 'c_ItemPriority', 'c_PMOLeader', 'c_ProductArea', 'c_ProductRoadmapBUTEOProduct', 'c_ProductRoadmapQuarter', 'c_ProductRoadmapQuarterStatus', 'c_ProductSuitePriority', 'c_ProgramManager', 'c_ProjectProgress', 'c_ProjStatusColor', 'c_TechOwner', 'c_TEOActionsToGreen', 'c_TEOFunctionalArea', 'c_TEOMajorDeliverable', 'c_TEORYReason', 'Expedite', 'FormattedID', 'LeafStoryPlanEstimateTotal', 'Milestones', 'Name', 'Notes', 'Owner', 'Parent', 'PercentDoneByStoryCount', 'PercentDoneByStoryPlanEstimate', 'PlannedEndDate', 'PlannedStartDate', 'PreliminaryEstimate', 'State', 'status', 'TEOMajorDeliverable', 'Tags']);
    const toPascalCase = (str) => str ? str.replace(/\w+/g, w => w[0].toUpperCase() + w.slice(1)).replace(/\s/g, '') : '';

    const translateRallyQuery = (query) => {
        const rawTokens = query.match(/"[^"]*"|\(|\)|!=|!contains|contains|=|>|<|\bAND\b|\bOR\b|[\w\s.]+/g) || [];
        if (rawTokens.length === 0 && query.trim() !== '') throw new Error("Could not parse the query. Check syntax.");
        const tokens = [];
        const operatorsAndParens = new Set(['(', ')', '=', '!=', '>', '<', 'contains', '!contains']);
        rawTokens.forEach(rawToken => {
            const t = rawToken.trim();
            if (t === '') return;
            if (t.length > 1 && t.endsWith(')')) {
                const partBeforeParen = t.slice(0, -1).trim();
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
                if (expressions.length > 0) logicalOperators.push(token.toUpperCase());
                i++;
                continue;
            }
            if (token === '(') {
                let balance = 1;
                let j = i + 1;
                while (j < tokens.length && balance > 0) {
                    if (tokens[j] === '(') balance++;
                    if (tokens[j] === ')') balance--;
                    j++;
                }
                if (balance !== 0) throw new Error("Mismatched parentheses.");
                const subQuery = tokens.slice(i + 1, j - 1).join(' ');
                const subTranslation = translateRallyQuery(subQuery);
                expressions.push(subTranslation.decodedQuery);
                i = j;
                continue;
            }
            const [fieldToken, operatorToken, valueToken] = [tokens[i], tokens[i + 1], tokens[i + 2]];
            if (!fieldToken || !operatorToken || !valueToken || !operators.has(operatorToken.toLowerCase())) {
                i++;
                continue;
            }
            let finalField;
            if (fieldToken.includes('.')) {
                const parts = fieldToken.split('.').map(part => {
                    const casedPart = toPascalCase(part);
                    return CONFIRMED_FIELDS.has(casedPart) ? casedPart : part;
                });
                finalField = parts.join('.');
            } else {
                const pascalCased = toPascalCase(fieldToken);
                finalField = CONFIRMED_FIELDS.has(pascalCased) ? pascalCased : `c_${pascalCased}`;
            }
            let finalValue = valueToken;
            if (!finalValue.startsWith('"') && !/^\d+$/.test(finalValue) && !['true', 'false'].includes(finalValue.toLowerCase())) {
                finalValue = `"${finalValue}"`;
            }
            expressions.push(`(${finalField} ${operatorToken.toLowerCase()} ${finalValue})`);
            i += 3;
        }
        if (expressions.length === 0) return { decodedQuery: '', encodedQuery: '', fullExampleUrl: '' };
        if (expressions.length !== logicalOperators.length + 1) throw new Error("Invalid query structure.");
        let decodedQuery = expressions[0];
        for (let k = 0; k < logicalOperators.length; k++) {
            decodedQuery = `(${decodedQuery} ${logicalOperators[k]} ${expressions[k + 1]})`;
        }
        const encodedQuery = encodeURIComponent(decodedQuery);
        const fullExampleUrl = `https://rally1.rallydev.com/slm/webservice/v2.0/portfolioitem/ppmproject?query=${encodedQuery}`;
        return { decodedQuery, encodedQuery, fullExampleUrl };
    };
    
    uiQueryInputTranslate.addEventListener('input', (event) => {
        uiQuery = event.target.value;
        hideError();
        hideResults();
    });
    translateButton.addEventListener('click', () => {
        hideError();
        hideResults();
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

    // --- NUEVA LÓGICA PARA "CONSTRUCT" ---

    const ENDPOINT_MAPPING = {
        "PRJ": "portfolioitem/ppmfeature",
        "FEA": "portfolioitem/teamfeature"
    };
    
    function urlEncodeConstructQuery(query) {
        // Codificación específica de la guía
        return query.replace(/ /g, '%20').replace(/"/g, '%22');
    }

    function buildRecursiveQuery(idList) {
        // Construcción recursiva de izquierda a derecha: ((A OR B) OR C)
        if (idList.length === 1) {
            return `(Parent.FormattedID = "${idList[0]}")`;
        }
        const recursivePart = buildRecursiveQuery(idList.slice(0, -1));
        const lastIdCondition = `(Parent.FormattedID = "${idList.slice(-1)}")`;
        return `(${recursivePart} OR ${lastIdCondition})`;
    }

    constructButton.addEventListener('click', () => {
        hideError();
        hideResults();

        const idInput = uiQueryInputConstruct.value.trim();

        // 1. Validar entrada vacía
        if (!idInput) {
            displayError("El campo de IDs no puede estar vacío.");
            return;
        }
        
        // Limpiar y crear la lista de IDs
        const idList = idInput.split(/[,\s]+/).filter(id => id.trim() !== '');
        if (idList.length === 0) {
            displayError("El campo de IDs no puede estar vacío.");
            return;
        }

        // 2. Validar que todos los prefijos sean iguales
        const firstIdPrefix = (idList[0].match(/^[A-Za-z]+/) || [''])[0].toUpperCase();
        for (let i = 1; i < idList.length; i++) {
            const currentIdPrefix = (idList[i].match(/^[A-Za-z]+/) || [''])[0].toUpperCase();
            if (currentIdPrefix !== firstIdPrefix) {
                displayError("Todos los IDs deben ser del mismo tipo (todos PRJ o todos FEA).");
                return;
            }
        }

        // 3. Validar prefijo soportado y obtener endpoint
        const endpoint = ENDPOINT_MAPPING[firstIdPrefix];
        if (!endpoint) {
            displayError(`El prefijo "${firstIdPrefix}" no es compatible. Solo se aceptan "PRJ" y "FEA".`);
            return;
        }

        try {
            // 4. Construir la consulta
            const humanReadableQuery = `${buildRecursiveQuery(idList)}`;
            const encodedQuery = urlEncodeConstructQuery(humanReadableQuery);
            const fullUrl = `https://rally1.rallydev.com/slm/webservice/v2.0/${endpoint}?query=${encodedQuery}`;
            
            // 5. Mostrar resultados (reutilizando la función existente)
            // Adaptamos la salida al formato esperado por displayResults
            displayResults({ fullExampleUrl: fullUrl });

        } catch (e) {
            displayError(e.message);
        }
    });

    // --- FUNCIONES DE UI (COMPARTIDAS) ---
    function displayError(message) {
        errorTextSpan.textContent = message;
        errorMessageDiv.classList.remove('hidden');
        resultsContainer.classList.add('hidden');
    }
    function hideError() {
        errorMessageDiv.classList.add('hidden');
        errorTextSpan.textContent = '';
    }
    function displayResults(translation) {
        fullUrlValue.textContent = translation.fullExampleUrl;
        resultsContainer.classList.remove('hidden');
        // Asegurarse de que el botón de copia esté en su estado inicial
        setCopyButtonState(copyFullUrlBtn, false);
    }
    function hideResults() {
        resultsContainer.classList.add('hidden');
        fullUrlValue.textContent = '';
    }
    function setCopyButtonState(buttonElement, isCopied) {
        const copyTextSpan = buttonElement.querySelector('.copy-text');
        if (!copyTextSpan) return;
        if (isCopied) {
            buttonElement.classList.add('copied');
            copyTextSpan.textContent = 'Copied!';
        } else {
            buttonElement.classList.remove('copied');
            copyTextSpan.textContent = 'Copy';
        }
    }
    const handleCopyToClipboard = (text, buttonElement) => {
        navigator.clipboard.writeText(text).then(() => {
            setCopyButtonState(buttonElement, true);
            setTimeout(() => setCopyButtonState(buttonElement, false), 2000);
        }).catch(err => {
            console.error('Failed to copy: ', err);
        });
    };

    copyFullUrlBtn.addEventListener('click', () => handleCopyToClipboard(fullUrlValue.textContent, copyFullUrlBtn));

    // --- INICIALIZACIÓN ---
    // REMOVED: for (const [name, query] of Object.entries(testCases)) { ... }
    showTab('translate'); // Mostrar la primera pestaña por defecto
});