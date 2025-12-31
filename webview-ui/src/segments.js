/**
 * Segments View JavaScript
 * Handles all interaction logic for the segments sidebar
 */

(function() {
    const vscode = acquireVsCodeApi();
    let segments = [];
    let displayedSegments = []; // Sorted segments in display order
    let currentSort = 'line'; // Default sort by line number
    let allFiles = []; // All files with segments
    let currentFile = null; // Currently active file

    // Listen for messages from extension
    window.addEventListener('message', event => {
        const message = event.data;

        switch (message.command) {
            case 'updateSegments':
                segments = message.segments;
                allFiles = message.files || [];
                currentFile = message.currentFile || null;
                renderSegments();
                updateFileSelector();
                break;

            case 'showFileList':
                renderFileList(message.files);
                break;

            case 'explanationLoading':
                updateExplanationState(message.segmentId, 'loading', message.loading);
                break;

            case 'updateExplanation':
                updateExplanationContent(message.segmentId, message.explanation);
                break;

            case 'explanationError':
                updateExplanationState(message.segmentId, 'error', message.error);
                break;

            case 'contextSaved':
                // Update local segment data and hide input without re-rendering
                handleContextSaved(message.segmentId, message.context);
                break;

            case 'highlightSegment':
                highlightSegmentById(message.segmentId);
                break;
        }
    });

    function renderSegments() {
        const container = document.getElementById('segments-list');
        const countEl = document.getElementById('segment-count');

        // Show sort controls when rendering segments
        const sortControls = document.querySelector('.sort-controls');
        if (sortControls) {
            sortControls.style.display = 'flex';
        }

        // Show/hide bulk remove button
        const bulkRemoveBtn = document.querySelector('.bulk-remove-btn');
        if (bulkRemoveBtn) {
            bulkRemoveBtn.style.display = segments && segments.length > 0 ? 'flex' : 'none';
        }

        // Show skeleton loaders on initial load (when segments is undefined/null)
        if (segments === undefined || segments === null) {
            container.innerHTML = `
                <div class="skeleton-loader">
                    ${generateSkeletonCard()}
                    ${generateSkeletonCard()}
                    ${generateSkeletonCard()}
                </div>
            `;
            countEl.textContent = 'Loading...';
            return;
        }

        if (segments.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="codicon codicon-inbox"></div>
                    <p>No segments detected yet.</p>
                    <p style="margin-top: 8px; font-size: 12px;">Segments will appear here as you work.</p>
                </div>
            `;
            countEl.textContent = 'No segments';
            return;
        }

        countEl.textContent = `${segments.length} segment${segments.length !== 1 ? 's' : ''}`;

        // Sort segments based on current sort mode and store for auto-advance
        displayedSegments = sortSegments([...segments], currentSort);

        container.innerHTML = displayedSegments.map(segment => {
            const complexityLevel = getComplexityLevel(segment.complexity);
            const lineCount = segment.endLine - segment.startLine + 1;
            const isNew = isSegmentNew(segment);
            const isStarred = segment.metadata?.isStarred || false;

            return `
            <div class="segment-card" data-segment-id="${segment.id}" data-complexity="${complexityLevel}">
                <div class="segment-header" data-clickable="true">
                    <div class="segment-header-left">
                        <div class="segment-title-wrapper">
                            <span class="segment-title">${escapeHtml(segment.name)}</span>
                            <span class="segment-subtitle">
                                ${escapeHtml(segment.lineRange || '')}
                                ${isNew ? '<span class="new-badge">NEW</span>' : ''}
                            </span>
                        </div>
                    </div>
                    <div class="segment-header-actions">
                        ${segment.metadata?.context ? `
                        <button
                            class="vk-icon-button context-indicator-btn"
                            title="Has context note"
                            disabled>
                            <span class="codicon codicon-note"></span>
                        </button>
                        ` : ''}
                        <button
                            class="vk-icon-button star-btn ${isStarred ? 'starred' : ''}"
                            title="Star for later"
                            data-starred="${isStarred}">
                            <span class="codicon codicon-star-${isStarred ? 'full' : 'empty'}"></span>
                        </button>
                        <button
                            class="vk-icon-button dismiss-btn"
                            title="Mark as reviewed">
                            <span class="codicon codicon-check"></span>
                        </button>
                        <button
                            class="vk-icon-button expand-btn"
                            title="Expand segment"
                            data-expanded="false">
                            <span class="codicon codicon-chevron-down"></span>
                        </button>
                    </div>
                </div>
                <div class="segment-body">
                    <!-- Compact metadata badges -->
                    <div class="metadata-badges">
                        <span class="metadata-badge complexity-badge-${complexityLevel}">
                            <span class="codicon codicon-pulse"></span>
                            <span>${segment.complexity !== null ? segment.complexity : 'N/A'}</span>
                        </span>
                        <span class="metadata-badge">
                            <span class="codicon codicon-file-code"></span>
                            <span>${lineCount} lines</span>
                        </span>
                        <span class="metadata-badge" title="${escapeHtml(segment.filePath)}">
                            <span class="codicon codicon-folder"></span>
                            <span>${escapeHtml(segment.fileName)}</span>
                        </span>
                    </div>

                    <!-- Explanation section -->
                    <div class="explanation-section" data-segment-id="${segment.id}">
                        <!-- This will be populated dynamically by JS -->
                    </div>

                    <!-- Context section (shows saved context or hidden input) -->
                    <div class="context-section ${segment.metadata?.context ? 'has-content' : ''}" data-segment-id="${segment.id}">
                        ${segment.metadata?.context ? `
                            <div class="context-display-wrapper">
                                <div class="context-display">${escapeHtml(segment.metadata.context)}</div>
                                <button class="context-menu-btn" title="Edit or remove context note">
                                    <span class="codicon codicon-ellipsis"></span>
                                </button>
                                <div class="context-menu" style="display: none;">
                                    <button class="context-menu-item edit-context-menu-btn">
                                        <span class="codicon codicon-edit"></span>
                                        <span>Edit</span>
                                    </button>
                                    <button class="context-menu-item remove-segment-btn">
                                        <span class="codicon codicon-trash"></span>
                                        <span>Remove Context</span>
                                    </button>
                                </div>
                            </div>
                        ` : `
                            <div class="context-input-wrapper">
                                <textarea class="context-input" placeholder="Add context about this code segment..."></textarea>
                                <div class="context-actions">
                                    <button class="vk-button vk-button--primary save-context-btn">Save</button>
                                    <button class="vk-button cancel-context-btn">Cancel</button>
                                </div>
                            </div>
                        `}
                    </div>

                    <!-- Action Footer -->
                    <div class="action-footer">
                        <div class="action-footer-left">
                            <button class="action-icon-btn explain-btn" title="Explain this code with AI">
                                <span class="codicon codicon-sparkle"></span>
                            </button>
                            <button class="action-icon-btn note-btn" title="Add a context note">
                                <span class="codicon codicon-edit"></span>
                            </button>
                        </div>
                        <button class="action-icon-btn reviewed-btn" title="Mark as reviewed">
                            <span class="codicon codicon-check"></span>
                        </button>
                    </div>
                </div>
            </div>
            `;
        }).join('');
    }

    function toggleSegment(segmentId) {
        const card = document.querySelector(`.segment-card[data-segment-id="${segmentId}"]`);
        if (!card) return;

        const expandBtn = card.querySelector('.expand-btn');
        const isExpanded = card.classList.contains('expanded');

        if (isExpanded) {
            // Collapse this card
            card.classList.remove('expanded');
            if (expandBtn) {
                expandBtn.dataset.expanded = 'false';
                expandBtn.title = 'Expand segment';
            }
        } else {
            // Accordion behavior: collapse all other cards first
            document.querySelectorAll('.segment-card.expanded').forEach(otherCard => {
                if (otherCard !== card) {
                    otherCard.classList.remove('expanded');
                    const otherExpandBtn = otherCard.querySelector('.expand-btn');
                    if (otherExpandBtn) {
                        otherExpandBtn.dataset.expanded = 'false';
                        otherExpandBtn.title = 'Expand segment';
                    }
                }
            });

            // Expand this card
            card.classList.add('expanded');
            if (expandBtn) {
                expandBtn.dataset.expanded = 'true';
                expandBtn.title = 'Collapse segment';
            }
        }
    }

    function renderFileList(files) {
        const container = document.getElementById('segments-list');
        const countEl = document.getElementById('segment-count');

        if (!files || files.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="codicon codicon-inbox"></div>
                    <p>No segments detected yet.</p>
                    <p style="margin-top: 8px; font-size: 12px;">Segments will appear here as you work.</p>
                </div>
            `;
            countEl.textContent = 'No segments';
            return;
        }

        countEl.textContent = `${files.length} file${files.length !== 1 ? 's' : ''} with segments`;

        // Hide sort controls when showing file list
        const sortControls = document.querySelector('.sort-controls');
        if (sortControls) {
            sortControls.style.display = 'none';
        }

        // Build file list items
        const fileItems = files.map((file, index) => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'file-list-item';
            itemDiv.dataset.fileIndex = index;

            itemDiv.innerHTML = `
                <div class="file-list-item-icon">
                    <span class="codicon codicon-file-code"></span>
                </div>
                <div class="file-list-item-content">
                    <div class="file-list-item-title">${escapeHtml(file.fileName)}</div>
                    <div class="file-list-item-subtitle">${file.segmentCount} segment${file.segmentCount !== 1 ? 's' : ''}</div>
                </div>
                <div class="file-list-item-action">
                    <span class="codicon codicon-chevron-right"></span>
                </div>
            `;

            // Store file path directly on the element to avoid closure issues
            itemDiv._filePath = file.filePath;

            // Add click handler directly to element
            itemDiv.addEventListener('click', function(e) {
                e.stopPropagation();
                console.log('File list item clicked:', this._filePath);
                vscode.postMessage({
                    command: 'openFile',
                    filePath: this._filePath
                });
            });

            return itemDiv;
        });

        // Clear and rebuild container
        container.innerHTML = `
            <div class="file-list-header">
                <div class="codicon codicon-info"></div>
                <p>No segments in current file. Click a file below to view its segments:</p>
            </div>
        `;

        // Append file items
        fileItems.forEach(item => container.appendChild(item));
    }

    function updateFileSelector() {
        const selectorContainer = document.getElementById('file-selector-container');
        const selector = document.getElementById('file-selector');

        if (!allFiles || allFiles.length === 0) {
            // No files with segments - hide selector
            if (selectorContainer) {
                selectorContainer.style.display = 'none';
            }
            return;
        }

        // Show selector when there are files
        if (selectorContainer) {
            selectorContainer.style.display = 'block';
        }

        // Populate selector with files
        if (selector) {
            selector.innerHTML = allFiles.map(file => {
                const selected = file.isActive ? 'selected' : '';
                return `<option value="${escapeHtml(file.filePath)}" ${selected}>
                    ${escapeHtml(file.fileName)} (${file.segmentCount})
                </option>`;
            }).join('');

            // Remove existing listener if any
            const newSelector = selector.cloneNode(true);
            selector.parentNode.replaceChild(newSelector, selector);

            // Add change listener
            newSelector.addEventListener('change', (e) => {
                const selectedPath = e.target.value;
                if (selectedPath) {
                    vscode.postMessage({
                        command: 'openFile',
                        filePath: selectedPath
                    });
                }
            });
        }
    }

    function goToCode(segmentId, startLine) {
        vscode.postMessage({
            command: 'goToCode',
            segmentId,
            line: startLine
        });
    }

    function saveContext(segmentId, context) {
        vscode.postMessage({
            command: 'saveContext',
            segmentId,
            context
        });
    }

    /**
     * Handle context saved confirmation from backend
     * Updates local state and displays the saved context
     */
    function handleContextSaved(segmentId, context) {
        // Update local segment data
        const segment = segments.find(s => s.id === segmentId);
        if (segment) {
            if (!segment.metadata) {
                segment.metadata = {};
            }
            segment.metadata.context = context;
        }

        // Find the context section and replace input with saved context display
        const card = document.querySelector(`.segment-card[data-segment-id="${segmentId}"]`);
        if (card) {
            const contextSection = card.querySelector('.context-section');
            if (contextSection) {
                if (context && context.trim().length > 0) {
                    // Add has-content class for styling
                    contextSection.classList.add('has-content');

                    // Replace content with saved context display and menu button
                    contextSection.innerHTML = `
                        <div class="context-display-wrapper">
                            <div class="context-display">${escapeHtml(context)}</div>
                            <button class="context-menu-btn" title="Edit or remove context note">
                                <span class="codicon codicon-ellipsis"></span>
                            </button>
                            <div class="context-menu" style="display: none;">
                                <button class="context-menu-item edit-context-menu-btn">
                                    <span class="codicon codicon-edit"></span>
                                    <span>Edit</span>
                                </button>
                                <button class="context-menu-item remove-segment-btn">
                                    <span class="codicon codicon-trash"></span>
                                    <span>Remove Context</span>
                                </button>
                            </div>
                        </div>
                    `;

                    // Add context indicator button to header if not present
                    const headerActions = card.querySelector('.segment-header-actions');
                    if (headerActions && !headerActions.querySelector('.context-indicator-btn')) {
                        // Insert context indicator before star button
                        const starBtn = headerActions.querySelector('.star-btn');
                        if (starBtn) {
                            const contextIndicator = document.createElement('button');
                            contextIndicator.className = 'vk-icon-button context-indicator-btn';
                            contextIndicator.title = 'Has context note';
                            contextIndicator.disabled = true;
                            contextIndicator.innerHTML = '<span class="codicon codicon-note"></span>';
                            headerActions.insertBefore(contextIndicator, starBtn);
                        }
                    }
                } else {
                    // Empty context - remove indicator and reset section
                    contextSection.classList.remove('has-content');
                    contextSection.innerHTML = `
                        <div class="context-input-wrapper">
                            <textarea class="context-input" placeholder="Add context about this code segment..."></textarea>
                            <div class="context-actions">
                                <button class="vk-button vk-button--primary save-context-btn">Save</button>
                                <button class="vk-button cancel-context-btn">Cancel</button>
                            </div>
                        </div>
                    `;

                    // Remove context indicator button from header
                    const contextIndicator = card.querySelector('.context-indicator-btn');
                    if (contextIndicator) {
                        contextIndicator.remove();
                    }
                }
            }
        }
    }

    function explainSegment(segmentId) {
        vscode.postMessage({
            command: 'explainSegment',
            segmentId
        });
    }

    function dismissSegment(segmentId) {
        // Find the current segment index in the DISPLAYED (sorted) order
        const currentIndex = displayedSegments.findIndex(s => s.id === segmentId);

        // Find the card element
        const card = document.querySelector(`.segment-card[data-segment-id="${segmentId}"]`);
        if (!card) return;

        // Subtle dismiss animation - just fade and swipe
        card.classList.add('dismissing');

        // Wait for animation to complete (250ms)
        setTimeout(() => {
            // Remove from DOM
            card.remove();

            // Remove from both arrays
            segments = segments.filter(s => s.id !== segmentId);
            displayedSegments = displayedSegments.filter(s => s.id !== segmentId);

            // Update segment count
            const countEl = document.getElementById('segment-count');
            if (countEl) {
                countEl.textContent = segments.length === 0
                    ? 'No segments'
                    : `${segments.length} segment${segments.length !== 1 ? 's' : ''}`;
            }

            // Notify backend
            vscode.postMessage({
                command: 'dismissSegment',
                segmentId
            });

            // Auto-advance: Navigate to next segment in DISPLAY ORDER
            if (displayedSegments.length > 0) {
                // After removing current segment, if currentIndex >= length, wrap to 0
                // Otherwise, currentIndex now points to what was the next segment
                const nextIndex = currentIndex >= displayedSegments.length ? 0 : currentIndex;
                const nextSegment = displayedSegments[nextIndex];

                if (nextSegment) {
                    // Tell backend to navigate to this segment
                    vscode.postMessage({
                        command: 'goToSegment',
                        segmentId: nextSegment.id,
                        startLine: nextSegment.startLine,
                        endLine: nextSegment.endLine,
                        filePath: nextSegment.filePath
                    });
                }
            }
        }, 250); // Subtle swipe animation duration
    }

    function removeSegment(segmentId) {
        // Force remove a segment completely, regardless of context or star status
        const currentIndex = displayedSegments.findIndex(s => s.id === segmentId);

        // Find the card element
        const card = document.querySelector(`.segment-card[data-segment-id="${segmentId}"]`);
        if (!card) {
            return;
        }

        // Add dismissing class to trigger animation
        card.classList.add('dismissing');

        // Wait for animation to complete before removing from DOM and notifying backend
        setTimeout(() => {
            // Remove from DOM
            card.remove();

            // Remove from both arrays
            segments = segments.filter(s => s.id !== segmentId);
            displayedSegments = displayedSegments.filter(s => s.id !== segmentId);

            // Update segment count
            const countEl = document.getElementById('segment-count');
            if (countEl) {
                countEl.textContent = segments.length === 0
                    ? 'No segments'
                    : `${segments.length} segment${segments.length !== 1 ? 's' : ''}`;
            }

            // Notify backend to force remove
            vscode.postMessage({
                command: 'removeSegment',
                segmentId
            });

            // Auto-advance: Navigate to next segment in DISPLAY ORDER
            if (displayedSegments.length > 0) {
                const nextIndex = currentIndex >= displayedSegments.length ? 0 : currentIndex;
                const nextSegment = displayedSegments[nextIndex];

                if (nextSegment) {
                    vscode.postMessage({
                        command: 'goToSegment',
                        segmentId: nextSegment.id,
                        startLine: nextSegment.startLine,
                        endLine: nextSegment.endLine,
                        filePath: nextSegment.filePath
                    });
                }
            }
        }, 300); // Match animation duration
    }

    function bulkRemoveSegments() {
        // Show subtle confirmation
        const confirmEl = document.querySelector('.bulk-remove-confirm');
        if (!confirmEl) return;

        // Show confirmation
        confirmEl.style.display = 'flex';

        // Auto-hide after 10 seconds if no action taken
        setTimeout(() => {
            if (confirmEl.style.display === 'flex') {
                confirmEl.style.display = 'none';
            }
        }, 10000);
    }

    function confirmBulkRemove() {
        // Get all segment IDs
        const allSegmentIds = segments.map(s => s.id);

        // Hide confirmation
        const confirmEl = document.querySelector('.bulk-remove-confirm');
        if (confirmEl) {
            confirmEl.style.display = 'none';
        }

        // Animate all cards out
        const allCards = document.querySelectorAll('.segment-card');
        allCards.forEach(card => card.classList.add('dismissing'));

        // Wait for animation then clean up
        setTimeout(() => {
            // Clear arrays
            segments = [];
            displayedSegments = [];

            // Update UI
            const countEl = document.getElementById('segment-count');
            if (countEl) {
                countEl.textContent = 'No segments';
            }

            // Hide bulk remove button
            const bulkRemoveBtn = document.querySelector('.bulk-remove-btn');
            if (bulkRemoveBtn) {
                bulkRemoveBtn.style.display = 'none';
            }

            // Re-render to show empty state
            renderSegments();

            // Notify backend
            vscode.postMessage({
                command: 'bulkRemoveSegments',
                segmentIds: allSegmentIds
            });
        }, 300);
    }

    function cancelBulkRemove() {
        const confirmEl = document.querySelector('.bulk-remove-confirm');
        if (confirmEl) {
            confirmEl.style.display = 'none';
        }
    }

    function toggleStar(segmentId) {
        // Find the segment in local state
        const segment = segments.find(s => s.id === segmentId);
        if (!segment) return;

        // Toggle the star state
        const newStarState = !segment.metadata?.isStarred;
        if (!segment.metadata) {
            segment.metadata = {};
        }
        segment.metadata.isStarred = newStarState;

        // Update UI immediately
        const card = document.querySelector(`.segment-card[data-segment-id="${segmentId}"]`);
        if (card) {
            const starBtn = card.querySelector('.star-btn');
            const starIcon = starBtn?.querySelector('.codicon');
            if (starBtn && starIcon) {
                starBtn.dataset.starred = newStarState;
                if (newStarState) {
                    starBtn.classList.add('starred');
                    starIcon.className = 'codicon codicon-star-full';
                } else {
                    starBtn.classList.remove('starred');
                    starIcon.className = 'codicon codicon-star-empty';
                }
            }
        }

        // Notify backend
        vscode.postMessage({
            command: 'toggleStar',
            segmentId,
            isStarred: newStarState
        });
    }

    /**
     * Highlight a segment by ID (called when cursor is in that segment's code)
     */
    function highlightSegmentById(segmentId) {
        // Remove highlight from all segments
        document.querySelectorAll('.segment-card').forEach(card => {
            card.classList.remove('selected');
        });

        // Add highlight to the specified segment
        if (segmentId) {
            const card = document.querySelector(`.segment-card[data-segment-id="${segmentId}"]`);
            if (card) {
                card.classList.add('selected');
            }
        }
    }

    /**
     * Check if a segment is new (detected within last 5 minutes)
     */
    function isSegmentNew(segment) {
        if (!segment.metadata?.detectedAt) return false;

        const detectedTime = new Date(segment.metadata.detectedAt).getTime();
        const now = Date.now();
        const fiveMinutesInMs = 5 * 60 * 1000;

        return (now - detectedTime) < fiveMinutesInMs;
    }

    /**
     * Sort segments based on selected mode
     * Primary sort: Starred items always appear first
     * Secondary sort: User's selected sort mode (line or complexity)
     */
    function sortSegments(segmentsArray, sortMode) {
        return segmentsArray.sort((a, b) => {
            // Primary sort: Starred items first
            const aStarred = a.metadata?.isStarred || false;
            const bStarred = b.metadata?.isStarred || false;

            if (aStarred !== bStarred) {
                return bStarred ? 1 : -1; // Starred items come first
            }

            // Secondary sort: Apply user's selected sort mode
            if (sortMode === 'line') {
                // Sort by line number (ascending)
                if (a.filePath !== b.filePath) {
                    return a.filePath.localeCompare(b.filePath);
                }
                return a.startLine - b.startLine;
            } else if (sortMode === 'complexity') {
                // Sort by complexity (descending - highest first)
                const complexityA = a.complexity !== null ? a.complexity : -1;
                const complexityB = b.complexity !== null ? b.complexity : -1;
                return complexityB - complexityA;
            }

            return 0;
        });
    }

    /**
     * Update sort mode and re-render
     */
    function setSortMode(mode) {
        currentSort = mode;

        // Update button states
        document.querySelectorAll('.sort-button').forEach(btn => {
            if (btn.dataset.sort === mode) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Re-render with new sort
        renderSegments();
    }

    /**
     * Get complexity level using traffic light system
     * Green (0-5): Low complexity
     * Yellow/Orange (6-10): Medium complexity
     * Red (11+): High complexity
     */
    function getComplexityLevel(complexity) {
        if (complexity === null || complexity === undefined) {
            return 'unknown';
        }
        if (complexity <= 5) return 'low';      // Green
        if (complexity <= 10) return 'medium';  // Yellow/Orange
        return 'high';                          // Red
    }


    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function generateSkeletonCard() {
        return `
            <div class="skeleton-card">
                <div class="skeleton-header">
                    <div class="skeleton-title"></div>
                    <div class="skeleton-actions">
                        <div class="skeleton-icon"></div>
                        <div class="skeleton-icon"></div>
                        <div class="skeleton-icon"></div>
                    </div>
                </div>
                <div class="skeleton-badges">
                    <div class="skeleton-badge"></div>
                    <div class="skeleton-badge"></div>
                    <div class="skeleton-badge"></div>
                </div>
            </div>
        `;
    }

    /**
     * Render markdown content using marked.js library
     */
    function renderMarkdown(markdown) {
        if (!markdown) return '';

        // Wait for marked to be loaded
        if (typeof marked === 'undefined') {
            console.warn('marked.js not loaded yet, returning plain text');
            return escapeHtml(markdown);
        }

        try {
            // Configure marked options for better rendering
            marked.setOptions({
                breaks: true,        // Convert \n to <br>
                gfm: true,          // GitHub Flavored Markdown
                headerIds: false,   // Don't add IDs to headers
                mangle: false       // Don't mangle email addresses
            });

            return marked.parse(markdown);
        } catch (error) {
            console.error('Error rendering markdown:', error);
            return escapeHtml(markdown);
        }
    }

    /**
     * Update explanation section with loading/error state
     */
    function updateExplanationState(segmentId, state, data) {
        const section = document.querySelector(`.explanation-section[data-segment-id="${segmentId}"]`);
        if (!section) return;

        if (state === 'loading') {
            if (data) {
                section.className = 'explanation-section loading';
                section.innerHTML = `
                    <div class="explanation-loading">
                        <div class="loading-spinner"></div>
                        <span>Generating explanation...</span>
                    </div>
                `;
            } else {
                // Clear loading if data is false
                if (!section.classList.contains('has-content')) {
                    section.innerHTML = '';
                    section.className = 'explanation-section';
                }
            }
        } else if (state === 'error') {
            section.className = 'explanation-section error';
            section.innerHTML = `
                <div class="explanation-error">
                    <span class="codicon codicon-warning"></span>
                    <div>
                        <div>${escapeHtml(data)}</div>
                        <div class="explanation-actions">
                            <button class="regenerate-btn" data-segment-id="${segmentId}">
                                <span class="codicon codicon-refresh"></span>
                                <span>Retry</span>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    /**
     * Update explanation section with content
     */
    function updateExplanationContent(segmentId, explanation) {
        const section = document.querySelector(`.explanation-section[data-segment-id="${segmentId}"]`);
        if (!section) return;

        section.className = 'explanation-section has-content';
        section.innerHTML = `
            <div class="explanation-header" data-segment-id="${segmentId}">
                <div class="explanation-label">
                    <span class="codicon codicon-lightbulb"></span>
                    <span>AI Explanation</span>
                </div>
                <div class="explanation-toggle">
                    <button class="regenerate-btn" data-segment-id="${segmentId}">
                        <span class="codicon codicon-refresh"></span>
                        <span>Regenerate</span>
                    </button>
                    <div class="collapse-icon">
                        <span class="codicon codicon-remove"></span>
                    </div>
                </div>
            </div>
            <div class="explanation-body">
                <div class="explanation-content">
                    ${renderMarkdown(explanation)}
                </div>
            </div>
        `;

        // Update segment metadata for persistence
        const segment = segments.find(function(s) { return s.id === segmentId; });
        if (segment) {
            if (!segment.metadata) {
                segment.metadata = {};
            }
            segment.metadata.explanation = explanation;
        }
    }

    // Event delegation for all clicks
    document.addEventListener('click', function(e) {
        const target = e.target;

        // Close any open context menus when clicking outside
        if (!target.closest('.context-menu-btn') && !target.closest('.context-menu')) {
            const openMenus = document.querySelectorAll('.context-menu');
            openMenus.forEach(menu => {
                menu.style.display = 'none';
            });
        }

        // Handle sort buttons
        const sortBtn = target.closest('.sort-button');
        if (sortBtn) {
            const sortMode = sortBtn.dataset.sort;
            if (sortMode) {
                e.preventDefault();
                setSortMode(sortMode);
            }
            return;
        }

        // Handle title/subtitle click to navigate to code
        const title = target.closest('.segment-title');
        const subtitle = target.closest('.segment-subtitle');
        if (title || subtitle) {
            const card = target.closest('[data-segment-id]');
            if (card) {
                e.preventDefault();
                e.stopPropagation();
                const segmentId = card.dataset.segmentId;
                const segment = segments.find(s => s.id === segmentId);
                if (segment) {
                    goToCode(segmentId, segment.startLine);
                }
            }
            return;
        }

        // Handle header click to expand/collapse (but not if clicking on buttons or title)
        const header = target.closest('.segment-header[data-clickable="true"]');
        if (header && !target.closest('button') && !target.closest('.segment-title') && !target.closest('.segment-subtitle')) {
            const card = header.closest('[data-segment-id]');
            if (card) {
                e.preventDefault();
                const segmentId = card.dataset.segmentId;
                toggleSegment(segmentId);
            }
            return;
        }

        // Handle expand/collapse button
        const expandBtn = target.closest('.expand-btn');
        if (expandBtn) {
            const segmentId = expandBtn.closest('[data-segment-id]')?.dataset.segmentId;
            if (segmentId) {
                e.preventDefault();
                e.stopPropagation();
                toggleSegment(segmentId);
            }
            return;
        }

        // Handle Add Context button
        const addContextBtn = target.closest('.add-context-btn');
        if (addContextBtn) {
            const contextSection = addContextBtn.closest('.context-section');
            if (contextSection) {
                e.preventDefault();
                const btn = contextSection.querySelector('.add-context-btn');
                const wrapper = contextSection.querySelector('.context-input-wrapper');
                if (btn && wrapper) {
                    btn.style.display = 'none';
                    wrapper.classList.add('visible');
                    const textarea = wrapper.querySelector('.context-input');
                    if (textarea) {
                        setTimeout(() => textarea.focus(), 100);
                    }
                }
            }
            return;
        }

        // Handle Cancel Add Context button
        const cancelAddContextBtn = target.closest('.cancel-add-context-btn');
        if (cancelAddContextBtn) {
            const contextSection = cancelAddContextBtn.closest('.context-section');
            if (contextSection) {
                e.preventDefault();
                const btn = contextSection.querySelector('.add-context-btn');
                const wrapper = contextSection.querySelector('.context-input-wrapper');
                if (btn && wrapper) {
                    btn.style.display = '';
                    wrapper.classList.remove('visible');
                    const textarea = wrapper.querySelector('.context-input');
                    if (textarea) {
                        textarea.value = '';
                    }
                }
            }
            return;
        }

        // Handle Save Context button
        const saveContextBtn = target.closest('.save-context-btn');
        if (saveContextBtn) {
            const contextSection = saveContextBtn.closest('.context-section');
            if (contextSection) {
                const segmentId = contextSection.dataset.segmentId;
                const textarea = contextSection.querySelector('.context-input');
                if (textarea && segmentId) {
                    e.preventDefault();
                    saveContext(segmentId, textarea.value);
                }
            }
            return;
        }

        // Handle Edit Context button
        const editContextBtn = target.closest('.edit-context-btn');
        if (editContextBtn) {
            const contextSection = editContextBtn.closest('.context-section');
            if (contextSection) {
                const segmentId = contextSection.dataset.segmentId;
                const segment = segments.find(s => s.id === segmentId);
                if (segment) {
                    e.preventDefault();
                    contextSection.classList.remove('has-content');
                    contextSection.innerHTML = `
                        <div class="context-header">
                            <div class="context-label">Context</div>
                        </div>
                        <div class="context-input-wrapper visible">
                            <textarea
                                class="context-input"
                                placeholder="What does this code do? Why is it important?"
                                data-segment-id="${segmentId}">${segment.metadata?.context || ''}</textarea>
                            <div class="context-actions">
                                <button class="vk-button vk-button--secondary cancel-context-btn">
                                    <span>Cancel</span>
                                </button>
                                <button class="vk-button vk-button--primary save-context-btn">
                                    <span class="codicon codicon-save"></span>
                                    <span>Save</span>
                                </button>
                            </div>
                        </div>
                    `;
                    const textarea = contextSection.querySelector('.context-input');
                    if (textarea) {
                        setTimeout(() => textarea.focus(), 100);
                    }
                }
            }
            return;
        }

        // Handle Cancel Context button
        const cancelContextBtn = target.closest('.cancel-context-btn');
        if (cancelContextBtn) {
            const contextSection = cancelContextBtn.closest('.context-section');
            if (contextSection) {
                e.preventDefault();
                const segmentId = contextSection.dataset.segmentId;
                const segment = segments.find(s => s.id === segmentId);

                if (segment && segment.metadata?.context) {
                    // Restore saved context display with menu button
                    contextSection.classList.add('has-content');
                    contextSection.innerHTML = `
                        <div class="context-display-wrapper">
                            <div class="context-display">${escapeHtml(segment.metadata.context)}</div>
                            <button class="context-menu-btn" title="Edit or remove context note">
                                <span class="codicon codicon-ellipsis"></span>
                            </button>
                            <div class="context-menu" style="display: none;">
                                <button class="context-menu-item edit-context-menu-btn">
                                    <span class="codicon codicon-edit"></span>
                                    <span>Edit</span>
                                </button>
                                <button class="context-menu-item remove-segment-btn">
                                    <span class="codicon codicon-trash"></span>
                                    <span>Remove Context</span>
                                </button>
                            </div>
                        </div>
                    `;
                } else {
                    // No existing context, hide the section completely
                    contextSection.style.display = 'none';
                    const wrapper = contextSection.querySelector('.context-input-wrapper');
                    if (wrapper) {
                        wrapper.classList.remove('visible');
                        const textarea = wrapper.querySelector('.context-input');
                        if (textarea) {
                            textarea.value = '';
                        }
                    }
                }
            }
            return;
        }

        // Handle Context Menu Button
        const contextMenuBtn = target.closest('.context-menu-btn');
        if (contextMenuBtn) {
            e.preventDefault();
            const menu = contextMenuBtn.nextElementSibling;
            if (menu && menu.classList.contains('context-menu')) {
                const isVisible = menu.style.display !== 'none';
                menu.style.display = isVisible ? 'none' : 'block';
            }
            return;
        }

        // Handle Edit Context Menu Item
        const editContextMenuBtn = target.closest('.edit-context-menu-btn');
        if (editContextMenuBtn) {
            const contextSection = editContextMenuBtn.closest('.context-section');
            if (contextSection) {
                e.preventDefault();
                const segmentId = contextSection.dataset.segmentId;
                const segment = segments.find(s => s.id === segmentId);

                // Hide the menu
                const menu = contextSection.querySelector('.context-menu');
                if (menu) {
                    menu.style.display = 'none';
                }

                // Get existing context text
                const existingContext = segment?.metadata?.context || '';

                // Show edit mode
                contextSection.classList.remove('has-content');
                contextSection.innerHTML = `
                    <div class="context-input-wrapper visible">
                        <textarea class="context-input" placeholder="Add context about this code segment...">${escapeHtml(existingContext)}</textarea>
                        <div class="context-actions">
                            <button class="vk-button cancel-context-btn">Cancel</button>
                            <button class="vk-button vk-button--primary save-context-btn">Save</button>
                        </div>
                    </div>
                `;
                const textarea = contextSection.querySelector('.context-input');
                if (textarea) {
                    setTimeout(() => textarea.focus(), 100);
                }
            }
            return;
        }

        // Handle Remove Context Menu Item
        const removeSegmentBtn = target.closest('.remove-segment-btn');
        if (removeSegmentBtn) {
            const contextSection = removeSegmentBtn.closest('.context-section');
            if (contextSection) {
                const segmentId = contextSection.dataset.segmentId;
                if (segmentId) {
                    e.preventDefault();
                    // Hide the menu
                    const menu = contextSection.querySelector('.context-menu');
                    if (menu) {
                        menu.style.display = 'none';
                    }

                    // Remove only the context note, not the entire segment
                    const segment = segments.find(s => s.id === segmentId);
                    if (segment && segment.metadata) {
                        segment.metadata.context = '';
                    }

                    // Save empty context to backend
                    saveContext(segmentId, '');

                    // Update UI to hide context section
                    contextSection.classList.remove('has-content');
                    contextSection.innerHTML = `
                        <div class="context-input-wrapper">
                            <textarea class="context-input" placeholder="Add context about this code segment..."></textarea>
                            <div class="context-actions">
                                <button class="vk-button vk-button--primary save-context-btn">Save</button>
                                <button class="vk-button cancel-context-btn">Cancel</button>
                            </div>
                        </div>
                    `;

                    // Remove context indicator button from header
                    const card = document.querySelector(`.segment-card[data-segment-id="${segmentId}"]`);
                    if (card) {
                        const contextIndicator = card.querySelector('.context-indicator-btn');
                        if (contextIndicator) {
                            contextIndicator.remove();
                        }
                    }
                }
            }
            return;
        }

        // Handle Explain button (in action footer)
        const explainBtn = target.closest('.explain-btn');
        if (explainBtn) {
            const card = explainBtn.closest('[data-segment-id]');
            if (card) {
                e.preventDefault();
                explainSegment(card.dataset.segmentId);
            }
            return;
        }

        // Handle Note button (in action footer) - Edit context
        const noteBtn = target.closest('.note-btn');
        if (noteBtn) {
            const card = noteBtn.closest('[data-segment-id]');
            if (card) {
                e.preventDefault();
                const segmentId = card.dataset.segmentId;
                const segment = segments.find(s => s.id === segmentId);

                // First, expand the segment if it's not already expanded
                if (!card.classList.contains('expanded')) {
                    toggleSegment(segmentId);
                }

                // Wait a bit for expansion animation, then show context input
                setTimeout(() => {
                    const contextSection = card.querySelector('.context-section');
                    if (contextSection) {
                        // If there's saved context, show edit mode with existing text
                        if (segment && segment.metadata?.context) {
                            contextSection.classList.remove('has-content');
                            contextSection.innerHTML = `
                                <div class="context-input-wrapper visible">
                                    <textarea class="context-input" placeholder="Add context about this code segment...">${escapeHtml(segment.metadata.context)}</textarea>
                                    <div class="context-actions">
                                        <button class="vk-button vk-button--primary save-context-btn">Save</button>
                                        <button class="vk-button cancel-context-btn">Cancel</button>
                                    </div>
                                </div>
                            `;
                        } else {
                            // No saved context, show empty input
                            // First make the section visible, then show the wrapper
                            contextSection.style.display = 'block';
                            const wrapper = contextSection.querySelector('.context-input-wrapper');
                            if (wrapper) {
                                wrapper.classList.add('visible');
                            }
                        }

                        const textarea = contextSection.querySelector('.context-input');
                        if (textarea) {
                            setTimeout(() => textarea.focus(), 100);
                        }
                    }
                }, 150);
            }
            return;
        }

        // Handle Reviewed button (in action footer)
        const reviewedBtn = target.closest('.reviewed-btn');
        if (reviewedBtn) {
            const card = reviewedBtn.closest('[data-segment-id]');
            if (card) {
                e.preventDefault();
                const segmentId = card.dataset.segmentId;
                dismissSegment(segmentId);
            }
            return;
        }

        // Handle Star button
        const starBtn = target.closest('.star-btn');
        if (starBtn) {
            const card = starBtn.closest('[data-segment-id]');
            if (card) {
                e.preventDefault();
                const segmentId = card.dataset.segmentId;
                toggleStar(segmentId);
            }
            return;
        }

        // Handle Dismiss button
        const dismissBtn = target.closest('.dismiss-btn');
        if (dismissBtn) {
            const card = dismissBtn.closest('[data-segment-id]');
            if (card) {
                e.preventDefault();
                const segmentId = card.dataset.segmentId;
                dismissSegment(segmentId);
            }
            return;
        }

        // Handle Regenerate explanation button
        const regenerateBtn = target.closest('.regenerate-btn');
        if (regenerateBtn && regenerateBtn.dataset.segmentId) {
            e.preventDefault();
            e.stopPropagation();
            explainSegment(regenerateBtn.dataset.segmentId);
            return;
        }

        // Handle Explanation collapse/expand
        const explanationHeader = target.closest('.explanation-header');
        if (explanationHeader) {
            const section = explanationHeader.closest('.explanation-section');
            if (section && section.classList.contains('has-content')) {
                e.preventDefault();
                section.classList.toggle('collapsed');

                // Update icon
                const icon = section.querySelector('.collapse-icon .codicon');
                if (icon) {
                    if (section.classList.contains('collapsed')) {
                        icon.className = 'codicon codicon-add';
                    } else {
                        icon.className = 'codicon codicon-remove';
                    }
                }
            }
            return;
        }

        // Handle Bulk Remove button
        const bulkRemoveBtn = target.closest('.bulk-remove-btn');
        if (bulkRemoveBtn) {
            e.preventDefault();
            bulkRemoveSegments();
            return;
        }

        // Handle Confirm Bulk Remove button
        const confirmBtn = target.closest('.confirm-bulk-remove-btn');
        if (confirmBtn) {
            e.preventDefault();
            confirmBulkRemove();
            return;
        }

        // Handle Cancel Bulk Remove button
        const cancelBtn = target.closest('.cancel-bulk-remove-btn');
        if (cancelBtn) {
            e.preventDefault();
            cancelBulkRemove();
            return;
        }
    });

    // Request initial data
    vscode.postMessage({ command: 'refresh' });
})();
