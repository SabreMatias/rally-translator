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
      // Normalización base
      const normQuotes = (s) => s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
      let s = normQuotes(String(query || "")).replace(/\r|\n/g, " ").trim();
      if (!s) return { decodedQuery: "", encodedQuery: "", fullExampleUrl: "" };

      // Casing mínimo alineado a tus “correctos”
      s = s
        .replace(/\bparent\.formattedid\b/gi, "Parent.FormattedID")
        .replace(/\bmilestones\.objectid\b/gi, "Milestones.ObjectID")
        .replace(/\btags\.name\b/gi, "Tags.Name")
        .replace(/\bstate\b/gi, "State")
        .replace(/\bstatus\b/gi, "status");

      // Quotes SOLO para RHS de *FormattedID si es string sin comillas
      s = quoteFormattedIdValues(s);

      // Balanceo obvio de paréntesis
      s = balanceParens(s);

      // Normalización L→R (AND/OR) en todos los niveles
      const core0 = unwrapOuterOnce(s);
      const core  = normalizeL2RDeep(core0);

      // Wrapper final solo si aún no está completamente envuelto
      const decodedQuery = isWrapped(core) ? core : `(${core})`;

      // Encode dejando () literales
      const encodedQuery = encodeURIComponent(decodedQuery)
        .replace(/%28/g, "(").replace(/%29/g, ")");

      const fullExampleUrl =
        `https://rally1.rallydev.com/slm/webservice/v2.0/portfolioitem/ppmproject?query=${encodedQuery}`;

      return { decodedQuery, encodedQuery, fullExampleUrl };
    };

    // Cita RHS si el campo termina en "FormattedID" (case-insensitive) y RHS es string sin comillas
    function quoteFormattedIdValues(input) {
      const re = /((?:\b[\w]+(?:\.[\w]+)*)\.?FormattedID)\s*(=|!=)\s*("[^"]*"|'[^']*'|[A-Za-z][A-Za-z0-9_\-]*)/gi;
      return input.replace(re, (_m, field, op, rhs) => {
        const isQuoted  = /^".*"$/.test(rhs) || /^'.*'$/.test(rhs);
        const isNumeric = /^-?\d+(\.\d+)?$/.test(rhs);
        let valueOut = rhs;
        if (!isQuoted && !isNumeric) valueOut = `"${rhs}"`;
        if (/^'.*'$/.test(valueOut)) valueOut = `"${valueOut.slice(1, -1)}"`;
        return `${field} ${op} ${valueOut}`;
      });
    }

    // Balanceo global de paréntesis (prepend '(' si minDepth<0; append ')' si depth>0)
    function balanceParens(s) {
      let depth = 0, minDepth = 0;
      for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (c === "(") depth++;
        else if (c === ")") { depth--; if (depth < minDepth) minDepth = depth; }
      }
      const needPrepend = -minDepth;
      const needAppend  = depth > 0 ? depth : 0;
      if (needPrepend > 0 || needAppend > 0) {
        return `${"(".repeat(needPrepend)}${s}${")".repeat(needAppend)}`;
      }
      return s;
    }

    // Quita UN par exterior si envuelve toda la expresión
    function unwrapOuterOnce(s) {
      const t = s.trim();
      if (!t.startsWith("(") || !t.endsWith(")")) return t;
      let depth = 0;
      for (let i = 0; i < t.length; i++) {
        const c = t[i];
        if (c === "(") depth++;
        else if (c === ")") {
          depth--;
          if (depth === 0 && i === t.length - 1) return t.slice(1, -1).trim();
          if (depth === 0 && i < t.length - 1) return t;
        }
      }
      return t;
    }

    // Normaliza operadores L→R en todos los niveles (AND/OR), respetando subgrupos
    function normalizeL2RDeep(s) {
      // 1) Normalizar recursivamente cada subgrupo
      let rebuilt = "";
      for (let i = 0; i < s.length; ) {
        const c = s[i];
        if (c === "(") {
          const j = findMatchingParen(s, i);
          const inner = s.slice(i + 1, j);
          const normalizedInner = normalizeL2RDeep(inner);
          const piece = isWrapped(normalizedInner) ? normalizedInner : `(${normalizedInner})`;
          rebuilt += piece;
          i = j + 1;
        } else {
          rebuilt += c;
          i++;
        }
      }

      // 2) Tokenizar a nivel top en [expr, OP, expr, OP, expr ...]
      const tokens = splitTopLevelByOps(rebuilt);

      // 3) Si no hay operadores top-level, devolver tal cual (trim)
      if (tokens.length === 1) return tokens[0].trim();

      // 4) Plegado L→R
      let acc = wrapIfNeeded(tokens[0]);
      for (let k = 1; k < tokens.length; k += 2) {
        const op  = tokens[k];              // "AND" | "OR"
        const rhs = wrapIfNeeded(tokens[k + 1]);
        acc = `(${acc} ${op} ${rhs})`;
      }
      return acc;
    }

    // Divide a nivel top por AND/OR conservando subgrupos
    function splitTopLevelByOps(s) {
      const out = [];
      let depth = 0, buf = "";
      const isBoundary = (ch) => ch === "" || /[^\w]/.test(ch); // incluye () y espacios
      const n = s.length;

      for (let i = 0; i < n; ) {
        const c = s[i];

        if (c === "(") { depth++; buf += c; i++; continue; }
        if (c === ")") { depth = Math.max(0, depth - 1); buf += c; i++; continue; }

        if (depth === 0) {
          if (i + 3 <= n && s.substring(i, i + 3).toUpperCase() === "AND") {
            const prev = i > 0 ? s[i - 1] : "";
            const next = i + 3 < n ? s[i + 3] : "";
            if (isBoundary(prev) && isBoundary(next)) {
              out.push(buf.trim()); buf = ""; i += 3;
              out.push("AND");
              continue;
            }
          }
          if (i + 2 <= n && s.substring(i, i + 2).toUpperCase() === "OR") {
            const prev = i > 0 ? s[i - 1] : "";
            const next = i + 2 < n ? s[i + 2] : "";
            if (isBoundary(prev) && isBoundary(next)) {
              out.push(buf.trim()); buf = ""; i += 2;
              out.push("OR");
              continue;
            }
          }
        }

        buf += c; i++;
      }

      if (buf.trim().length) out.push(buf.trim());
      if (out.length === 0) out.push(s.trim());
      return out;
    }

    function wrapIfNeeded(expr) {
      const t = expr.trim();
      return isWrapped(t) ? t : `(${t})`;
    }

    // Índice del ')' que cierra el '(' en posición i
    function findMatchingParen(s, i) {
      let depth = 0;
      for (let k = i; k < s.length; k++) {
        if (s[k] === "(") depth++;
        else if (s[k] === ")") {
          depth--;
          if (depth === 0) return k;
        }
      }
      return s.length - 1; // fallback (balanceParens ya corrió)
    }

    // ¿Está completamente envuelto por un par de paréntesis?
    function isWrapped(t) {
      const s = t.trim();
      if (!s.startsWith("(") || !s.endsWith(")")) return false;
      let depth = 0;
      for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        if (ch === "(") depth++;
        else if (ch === ")") {
          depth--;
          if (depth === 0 && i < s.length - 1) return false;
        }
      }
      return depth === 0;
    }

    
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