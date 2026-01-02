"use strict";
(() => {
  // webview-ui/src/segments.js
  (function() {
    const vscode = acquireVsCodeApi();
    let segments = [];
    let displayedSegments = [];
    let currentSort = "line";
    let allFiles = [];
    let currentFile = null;
    let collapsedFiles = /* @__PURE__ */ new Set();
    window.addEventListener("message", (event) => {
      const message = event.data;
      switch (message.command) {
        case "updateSegments":
          segments = message.segments;
          allFiles = message.files || [];
          currentFile = message.currentFile || null;
          if (message.sortMode && message.sortMode !== currentSort) {
            currentSort = message.sortMode;
            document.querySelectorAll(".sort-button").forEach((btn) => {
              if (btn.dataset.sort === currentSort) {
                btn.classList.add("active");
              } else {
                btn.classList.remove("active");
              }
            });
          }
          renderSegments();
          updateFileSelector();
          break;
        case "showFileList":
          renderFileList(message.files);
          break;
        case "explanationLoading":
          updateExplanationState(message.segmentId, "loading", message.loading);
          break;
        case "updateExplanation":
          updateExplanationContent(message.segmentId, message.explanation);
          break;
        case "explanationError":
          updateExplanationState(message.segmentId, "error", message.error);
          break;
        case "contextSaved":
          handleContextSaved(message.segmentId, message.context);
          break;
        case "highlightSegment":
          highlightSegmentById(message.segmentId);
          break;
      }
    });
    function renderSegments() {
      const container = document.getElementById("segments-list");
      const countEl = document.getElementById("segment-count");
      const sortControls = document.querySelector(".sort-controls");
      if (sortControls) {
        sortControls.style.display = "flex";
      }
      const bulkRemoveBtn = document.querySelector(".bulk-remove-btn");
      if (bulkRemoveBtn) {
        bulkRemoveBtn.style.display = segments && segments.length > 0 ? "flex" : "none";
      }
      if (segments === void 0 || segments === null) {
        container.innerHTML = `
                <div class="skeleton-loader">
                    ${generateSkeletonCard()}
                    ${generateSkeletonCard()}
                    ${generateSkeletonCard()}
                </div>
            `;
        countEl.textContent = "Loading...";
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
        countEl.textContent = "No segments";
        return;
      }
      countEl.textContent = `${segments.length} segment${segments.length !== 1 ? "s" : ""}`;
      displayedSegments = sortSegments([...segments], currentSort);
      const isTimelineView = currentSort === "time";
      const isAllFilesMode = currentFile === "__all__";
      if (isAllFilesMode) {
        container.innerHTML = renderGroupedSegments(displayedSegments, isTimelineView);
        return;
      }
      container.innerHTML = displayedSegments.map((segment, index) => {
        const complexityLevel = getComplexityLevel(segment.complexity);
        const lineCount = segment.endLine - segment.startLine + 1;
        const isNew = isSegmentNew(segment);
        const isStarred = segment.metadata?.isStarred || false;
        const hasDiff = !!segment.metadata?.beforeCode;
        let flowIndicator = "";
        if (isTimelineView && index > 0) {
          const prevSegment = displayedSegments[index - 1];
          const prevFilePath = prevSegment.filePath;
          const currFilePath = segment.filePath;
          const currFile = segment.fileName;
          if (prevFilePath !== currFilePath) {
            const isReturning = displayedSegments.slice(0, index - 1).some((s) => s.filePath === currFilePath);
            if (isReturning) {
              flowIndicator = `
                        <div class="flow-indicator flow-return">
                            <div class="flow-line"></div>
                            <div class="flow-label">
                                <span class="codicon codicon-arrow-circle-left"></span>
                                <span>returned to ${escapeHtml(currFile)}</span>
                            </div>
                        </div>`;
            } else {
              flowIndicator = `
                        <div class="flow-indicator flow-switch">
                            <div class="flow-line"></div>
                            <div class="flow-label">
                                <span class="codicon codicon-arrow-right"></span>
                                <span>switched to ${escapeHtml(currFile)}</span>
                            </div>
                        </div>`;
            }
          }
        }
        const timeLabel = isTimelineView && segment.metadata?.detectedAt ? formatTimeAgo(segment.metadata.detectedAt) : "";
        return `${flowIndicator}
            <div class="segment-card ${isTimelineView ? "timeline-view" : ""}" data-segment-id="${segment.id}" data-complexity="${complexityLevel}" data-time="${segment.metadata?.detectedAt || ""}">
                <div class="segment-header" data-clickable="true">
                    <div class="segment-header-left">
                        ${isTimelineView ? `<span class="timeline-order">${index + 1}</span>` : ""}
                        <div class="segment-title-wrapper">
                            <span class="segment-title">${escapeHtml(segment.name)}</span>
                            <span class="segment-subtitle">
                                ${escapeHtml(segment.lineRange || "")}
                                ${isNew ? '<span class="new-badge">NEW</span>' : ""}
                                ${hasDiff ? '<span class="diff-badge" title="Has changes from previous version"><span class="codicon codicon-diff"></span>DIFF</span>' : ""}
                                ${timeLabel ? `<span class="time-badge" title="${segment.metadata?.detectedAt || ""}">${timeLabel}</span>` : ""}
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
                        ` : ""}
                        ${segment.metadata?.beforeCode ? `
                        <button
                            class="vk-icon-button diff-btn"
                            title="Toggle diff view"
                            data-diff-active="false"
                            style="display: none;">
                            <span class="codicon codicon-diff"></span>
                        </button>
                        ` : ""}
                        ${!isTimelineView ? `
                        <button
                            class="vk-icon-button star-btn ${isStarred ? "starred" : ""}"
                            title="Star for later"
                            data-starred="${isStarred}">
                            <span class="codicon codicon-star-${isStarred ? "full" : "empty"}"></span>
                        </button>
                        ` : ""}
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
                            <span>${segment.complexity !== null ? segment.complexity : "N/A"}</span>
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
                    <div class="context-section ${segment.metadata?.context ? "has-content" : ""}" data-segment-id="${segment.id}">
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

                    <!-- Code/Diff View Section (only if beforeCode exists) -->
                    ${segment.metadata?.beforeCode ? `
                    <div class="code-diff-section" data-segment-id="${segment.id}">
                        <!-- Will be populated with current code or diff view -->
                    </div>
                    ` : ""}

                    <!-- Action Footer -->
                    <div class="action-footer">
                        <div class="action-footer-left">
                            <button class="action-icon-btn explain-btn" title="Explain this code with AI">
                                <span class="codicon codicon-sparkle"></span>
                            </button>
                            <button class="action-icon-btn note-btn" title="Add a context note">
                                <span class="codicon codicon-edit"></span>
                            </button>
                            <button class="action-icon-btn footer-star-btn ${isStarred ? "starred" : ""}" title="${isStarred ? "Unstar" : "Star for later"}" data-starred="${isStarred}">
                                <span class="codicon codicon-star-${isStarred ? "full" : "empty"}"></span>
                            </button>
                        </div>
                        <button class="action-icon-btn reviewed-btn" title="Mark as reviewed">
                            <span class="codicon codicon-check"></span>
                        </button>
                    </div>
                </div>
            </div>
            `;
      }).join("");
    }
    function renderGroupedSegments(segmentsToRender, isTimelineView) {
      const sessions = [];
      let currentSession = null;
      const visitedFiles = /* @__PURE__ */ new Set();
      segmentsToRender.forEach((segment, globalIndex) => {
        const filePath = segment.filePath;
        if (!currentSession || currentSession.filePath !== filePath) {
          const isReturn = visitedFiles.has(filePath);
          visitedFiles.add(filePath);
          currentSession = {
            filePath,
            fileName: segment.fileName,
            isReturn,
            isFirst: sessions.length === 0,
            segments: [],
            globalIndices: [],
            sessionIndex: sessions.length
          };
          sessions.push(currentSession);
        }
        currentSession.segments.push(segment);
        currentSession.globalIndices.push(globalIndex);
      });
      let html = "";
      sessions.forEach((session, sessionIndex) => {
        const sessionKey = `${session.filePath}-${sessionIndex}`;
        const isCollapsed = collapsedFiles.has(sessionKey);
        const segmentCount = session.segments.length;
        let headerIcon, headerText, headerClass;
        if (session.isFirst) {
          headerIcon = "codicon-file-code";
          headerText = `Started in ${session.fileName}`;
          headerClass = "session-start";
        } else if (session.isReturn) {
          headerIcon = "codicon-arrow-circle-left";
          headerText = `Returned to ${session.fileName}`;
          headerClass = "session-return";
        } else {
          headerIcon = "codicon-arrow-right";
          headerText = `Switched to ${session.fileName}`;
          headerClass = "session-switch";
        }
        html += `
            <div class="file-group ${headerClass}" data-session-key="${escapeHtml(sessionKey)}">
                <div class="file-group-header ${isCollapsed ? "collapsed" : ""}" data-session-key="${escapeHtml(sessionKey)}">
                    <div class="file-group-header-left">
                        <span class="file-group-chevron codicon codicon-chevron-${isCollapsed ? "right" : "down"}"></span>
                        <span class="codicon ${headerIcon} file-group-icon"></span>
                        <span class="file-group-name">${escapeHtml(headerText)}</span>
                        <span class="file-group-count">${segmentCount}</span>
                    </div>
                    <div class="file-group-header-right">
                        <button class="file-group-collapse-all-btn" title="${isCollapsed ? "Expand session" : "Collapse session"}">
                            <span class="codicon codicon-${isCollapsed ? "expand-all" : "collapse-all"}"></span>
                        </button>
                    </div>
                </div>
                <div class="file-group-content ${isCollapsed ? "collapsed" : ""}">
            `;
        session.segments.forEach((segment, indexInSession) => {
          const globalIndex = session.globalIndices[indexInSession];
          html += renderSegmentCard(segment, globalIndex, isTimelineView, segmentsToRender, false);
        });
        html += `
                </div>
            </div>
            `;
      });
      return html;
    }
    function renderSegmentCard(segment, index, isTimelineView, allSegments, showFlowIndicator = true) {
      const complexityLevel = getComplexityLevel(segment.complexity);
      const lineCount = segment.endLine - segment.startLine + 1;
      const isNew = isSegmentNew(segment);
      const isStarred = segment.metadata?.isStarred || false;
      const hasDiff = !!segment.metadata?.beforeCode;
      let flowIndicator = "";
      if (showFlowIndicator && isTimelineView && index > 0) {
        const prevSegment = allSegments[index - 1];
        const prevFilePath = prevSegment.filePath;
        const currFilePath = segment.filePath;
        const currFile = segment.fileName;
        if (prevFilePath !== currFilePath) {
          const isReturning = allSegments.slice(0, index - 1).some((s) => s.filePath === currFilePath);
          if (isReturning) {
            flowIndicator = `
                    <div class="flow-indicator flow-return">
                        <div class="flow-line"></div>
                        <div class="flow-label">
                            <span class="codicon codicon-arrow-circle-left"></span>
                            <span>returned to ${escapeHtml(currFile)}</span>
                        </div>
                    </div>`;
          } else {
            flowIndicator = `
                    <div class="flow-indicator flow-switch">
                        <div class="flow-line"></div>
                        <div class="flow-label">
                            <span class="codicon codicon-arrow-right"></span>
                            <span>switched to ${escapeHtml(currFile)}</span>
                        </div>
                    </div>`;
          }
        }
      }
      const timeLabel = isTimelineView && segment.metadata?.detectedAt ? formatTimeAgo(segment.metadata.detectedAt) : "";
      return `${flowIndicator}
        <div class="segment-card ${isTimelineView ? "timeline-view" : ""}" data-segment-id="${segment.id}" data-complexity="${complexityLevel}" data-time="${segment.metadata?.detectedAt || ""}">
            <div class="segment-header" data-clickable="true">
                <div class="segment-header-left">
                    ${isTimelineView ? `<span class="timeline-order">${index + 1}</span>` : ""}
                    <div class="segment-title-wrapper">
                        <span class="segment-title">${escapeHtml(segment.name)}</span>
                        <span class="segment-subtitle">
                            ${escapeHtml(segment.lineRange || "")}
                            ${isNew ? '<span class="new-badge">NEW</span>' : ""}
                            ${hasDiff ? '<span class="diff-badge" title="Has changes from previous version"><span class="codicon codicon-diff"></span>DIFF</span>' : ""}
                            ${timeLabel ? `<span class="time-badge" title="${segment.metadata?.detectedAt || ""}">${timeLabel}</span>` : ""}
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
                    ` : ""}
                    ${segment.metadata?.beforeCode ? `
                    <button
                        class="vk-icon-button diff-btn"
                        title="Toggle diff view"
                        data-diff-active="false"
                        style="display: none;">
                        <span class="codicon codicon-diff"></span>
                    </button>
                    ` : ""}
                    ${!isTimelineView ? `
                    <button
                        class="vk-icon-button star-btn ${isStarred ? "starred" : ""}"
                        title="Star for later"
                        data-starred="${isStarred}">
                        <span class="codicon codicon-star-${isStarred ? "full" : "empty"}"></span>
                    </button>
                    ` : ""}
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
                        <span>${segment.complexity !== null ? segment.complexity : "N/A"}</span>
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
                <div class="context-section ${segment.metadata?.context ? "has-content" : ""}" data-segment-id="${segment.id}">
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

                <!-- Code/Diff View Section (only if beforeCode exists) -->
                ${segment.metadata?.beforeCode ? `
                <div class="code-diff-section" data-segment-id="${segment.id}">
                    <!-- Will be populated with current code or diff view -->
                </div>
                ` : ""}

                <!-- Action Footer -->
                <div class="action-footer">
                    <div class="action-footer-left">
                        <button class="action-icon-btn explain-btn" title="Explain this code with AI">
                            <span class="codicon codicon-sparkle"></span>
                        </button>
                        <button class="action-icon-btn note-btn" title="Add a context note">
                            <span class="codicon codicon-edit"></span>
                        </button>
                        <button class="action-icon-btn footer-star-btn ${isStarred ? "starred" : ""}" title="${isStarred ? "Unstar" : "Star for later"}" data-starred="${isStarred}">
                            <span class="codicon codicon-star-${isStarred ? "full" : "empty"}"></span>
                        </button>
                    </div>
                    <button class="action-icon-btn reviewed-btn" title="Mark as reviewed">
                        <span class="codicon codicon-check"></span>
                    </button>
                </div>
            </div>
        </div>
        `;
    }
    function toggleFileGroup(filePath) {
      if (collapsedFiles.has(filePath)) {
        collapsedFiles.delete(filePath);
      } else {
        collapsedFiles.add(filePath);
      }
      renderSegments();
    }
    function collapseAllFileGroups() {
      allFiles.forEach((file) => {
        collapsedFiles.add(file.filePath);
      });
      renderSegments();
    }
    function expandAllFileGroups() {
      collapsedFiles.clear();
      renderSegments();
    }
    function toggleSegment(segmentId) {
      const card = document.querySelector(`.segment-card[data-segment-id="${segmentId}"]`);
      if (!card) return;
      const expandBtn = card.querySelector(".expand-btn");
      const diffBtn = card.querySelector(".diff-btn");
      const isExpanded = card.classList.contains("expanded");
      if (isExpanded) {
        card.classList.remove("expanded");
        if (expandBtn) {
          expandBtn.dataset.expanded = "false";
          expandBtn.title = "Expand segment";
        }
        if (diffBtn) {
          diffBtn.style.display = "none";
        }
      } else {
        document.querySelectorAll(".segment-card.expanded").forEach((otherCard) => {
          if (otherCard !== card) {
            otherCard.classList.remove("expanded");
            const otherExpandBtn = otherCard.querySelector(".expand-btn");
            const otherDiffBtn = otherCard.querySelector(".diff-btn");
            if (otherExpandBtn) {
              otherExpandBtn.dataset.expanded = "false";
              otherExpandBtn.title = "Expand segment";
            }
            if (otherDiffBtn) {
              otherDiffBtn.style.display = "none";
            }
          }
        });
        card.classList.add("expanded");
        if (expandBtn) {
          expandBtn.dataset.expanded = "true";
          expandBtn.title = "Collapse segment";
        }
        if (diffBtn) {
          diffBtn.style.display = "";
        }
      }
    }
    function renderFileList(files) {
      const container = document.getElementById("segments-list");
      const countEl = document.getElementById("segment-count");
      if (!files || files.length === 0) {
        container.innerHTML = `
                <div class="empty-state">
                    <div class="codicon codicon-inbox"></div>
                    <p>No segments detected yet.</p>
                    <p style="margin-top: 8px; font-size: 12px;">Segments will appear here as you work.</p>
                </div>
            `;
        countEl.textContent = "No segments";
        return;
      }
      countEl.textContent = `${files.length} file${files.length !== 1 ? "s" : ""} with segments`;
      const sortControls = document.querySelector(".sort-controls");
      if (sortControls) {
        sortControls.style.display = "none";
      }
      const fileItems = files.map((file, index) => {
        const itemDiv = document.createElement("div");
        itemDiv.className = "file-list-item";
        itemDiv.dataset.fileIndex = index;
        itemDiv.innerHTML = `
                <div class="file-list-item-icon">
                    <span class="codicon codicon-file-code"></span>
                </div>
                <div class="file-list-item-content">
                    <div class="file-list-item-title">${escapeHtml(file.fileName)}</div>
                    <div class="file-list-item-subtitle">${file.segmentCount} segment${file.segmentCount !== 1 ? "s" : ""}</div>
                </div>
                <div class="file-list-item-action">
                    <span class="codicon codicon-chevron-right"></span>
                </div>
            `;
        itemDiv._filePath = file.filePath;
        itemDiv.addEventListener("click", function(e) {
          e.stopPropagation();
          console.log("File list item clicked:", this._filePath);
          vscode.postMessage({
            command: "openFile",
            filePath: this._filePath
          });
        });
        return itemDiv;
      });
      container.innerHTML = `
            <div class="file-list-header">
                <div class="codicon codicon-info"></div>
                <p>No segments in current file. Click a file below to view its segments:</p>
            </div>
        `;
      fileItems.forEach((item) => container.appendChild(item));
    }
    function updateFileSelector() {
      const selectorContainer = document.getElementById("file-selector-container");
      const selector = document.getElementById("file-selector");
      if (!allFiles || allFiles.length === 0) {
        if (selectorContainer) {
          selectorContainer.style.display = "none";
        }
        return;
      }
      if (selectorContainer) {
        selectorContainer.style.display = "block";
      }
      if (selector) {
        const totalSegments = allFiles.reduce((sum, f) => sum + f.segmentCount, 0);
        const isAllFilesMode = currentFile === "__all__";
        const allFilesOption = `<option value="__all__" ${isAllFilesMode ? "selected" : ""}>
                All Files (${totalSegments})
            </option>`;
        const fileOptions = allFiles.map((file) => {
          const selected = !isAllFilesMode && file.isActive ? "selected" : "";
          return `<option value="${escapeHtml(file.filePath)}" ${selected}>
                    ${escapeHtml(file.fileName)} (${file.segmentCount})
                </option>`;
        }).join("");
        selector.innerHTML = allFilesOption + fileOptions;
        const newSelector = selector.cloneNode(true);
        selector.parentNode.replaceChild(newSelector, selector);
        newSelector.addEventListener("change", (e) => {
          const selectedPath = e.target.value;
          if (selectedPath === "__all__") {
            vscode.postMessage({
              command: "showAllFiles"
            });
          } else if (selectedPath) {
            vscode.postMessage({
              command: "openFile",
              filePath: selectedPath
            });
          }
        });
      }
    }
    function goToCode(segmentId, startLine) {
      vscode.postMessage({
        command: "goToCode",
        segmentId,
        line: startLine
      });
    }
    function saveContext(segmentId, context) {
      vscode.postMessage({
        command: "saveContext",
        segmentId,
        context
      });
    }
    function handleContextSaved(segmentId, context) {
      const segment = segments.find((s) => s.id === segmentId);
      if (segment) {
        if (!segment.metadata) {
          segment.metadata = {};
        }
        segment.metadata.context = context;
      }
      const card = document.querySelector(`.segment-card[data-segment-id="${segmentId}"]`);
      if (card) {
        const contextSection = card.querySelector(".context-section");
        if (contextSection) {
          if (context && context.trim().length > 0) {
            contextSection.classList.add("has-content");
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
            const headerActions = card.querySelector(".segment-header-actions");
            if (headerActions && !headerActions.querySelector(".context-indicator-btn")) {
              const starBtn = headerActions.querySelector(".star-btn");
              if (starBtn) {
                const contextIndicator = document.createElement("button");
                contextIndicator.className = "vk-icon-button context-indicator-btn";
                contextIndicator.title = "Has context note";
                contextIndicator.disabled = true;
                contextIndicator.innerHTML = '<span class="codicon codicon-note"></span>';
                headerActions.insertBefore(contextIndicator, starBtn);
              }
            }
          } else {
            contextSection.classList.remove("has-content");
            contextSection.innerHTML = `
                        <div class="context-input-wrapper">
                            <textarea class="context-input" placeholder="Add context about this code segment..."></textarea>
                            <div class="context-actions">
                                <button class="vk-button vk-button--primary save-context-btn">Save</button>
                                <button class="vk-button cancel-context-btn">Cancel</button>
                            </div>
                        </div>
                    `;
            const contextIndicator = card.querySelector(".context-indicator-btn");
            if (contextIndicator) {
              contextIndicator.remove();
            }
          }
        }
      }
    }
    function explainSegment(segmentId) {
      vscode.postMessage({
        command: "explainSegment",
        segmentId
      });
    }
    function dismissSegment(segmentId) {
      const currentIndex = displayedSegments.findIndex((s) => s.id === segmentId);
      const card = document.querySelector(`.segment-card[data-segment-id="${segmentId}"]`);
      if (!card) return;
      card.classList.add("dismissing");
      setTimeout(() => {
        card.remove();
        segments = segments.filter((s) => s.id !== segmentId);
        displayedSegments = displayedSegments.filter((s) => s.id !== segmentId);
        const countEl = document.getElementById("segment-count");
        if (countEl) {
          countEl.textContent = segments.length === 0 ? "No segments" : `${segments.length} segment${segments.length !== 1 ? "s" : ""}`;
        }
        vscode.postMessage({
          command: "dismissSegment",
          segmentId
        });
        if (displayedSegments.length > 0) {
          const nextIndex = currentIndex >= displayedSegments.length ? 0 : currentIndex;
          const nextSegment = displayedSegments[nextIndex];
          if (nextSegment) {
            vscode.postMessage({
              command: "goToSegment",
              segmentId: nextSegment.id,
              startLine: nextSegment.startLine,
              endLine: nextSegment.endLine,
              filePath: nextSegment.filePath
            });
          }
        }
      }, 350);
    }
    function removeSegment(segmentId) {
      const currentIndex = displayedSegments.findIndex((s) => s.id === segmentId);
      const card = document.querySelector(`.segment-card[data-segment-id="${segmentId}"]`);
      if (!card) {
        return;
      }
      card.classList.add("dismissing");
      setTimeout(() => {
        card.remove();
        segments = segments.filter((s) => s.id !== segmentId);
        displayedSegments = displayedSegments.filter((s) => s.id !== segmentId);
        const countEl = document.getElementById("segment-count");
        if (countEl) {
          countEl.textContent = segments.length === 0 ? "No segments" : `${segments.length} segment${segments.length !== 1 ? "s" : ""}`;
        }
        vscode.postMessage({
          command: "removeSegment",
          segmentId
        });
        if (displayedSegments.length > 0) {
          const nextIndex = currentIndex >= displayedSegments.length ? 0 : currentIndex;
          const nextSegment = displayedSegments[nextIndex];
          if (nextSegment) {
            vscode.postMessage({
              command: "goToSegment",
              segmentId: nextSegment.id,
              startLine: nextSegment.startLine,
              endLine: nextSegment.endLine,
              filePath: nextSegment.filePath
            });
          }
        }
      }, 350);
    }
    function bulkRemoveSegments() {
      const confirmEl = document.querySelector(".bulk-remove-confirm");
      if (!confirmEl) return;
      confirmEl.style.display = "flex";
      setTimeout(() => {
        if (confirmEl.style.display === "flex") {
          confirmEl.style.display = "none";
        }
      }, 1e4);
    }
    function confirmBulkRemove() {
      const allSegmentIds = segments.map((s) => s.id);
      const confirmEl = document.querySelector(".bulk-remove-confirm");
      if (confirmEl) {
        confirmEl.style.display = "none";
      }
      const allCards = document.querySelectorAll(".segment-card");
      allCards.forEach((card) => card.classList.add("dismissing"));
      setTimeout(() => {
        segments = [];
        displayedSegments = [];
        const countEl = document.getElementById("segment-count");
        if (countEl) {
          countEl.textContent = "No segments";
        }
        const bulkRemoveBtn = document.querySelector(".bulk-remove-btn");
        if (bulkRemoveBtn) {
          bulkRemoveBtn.style.display = "none";
        }
        renderSegments();
        vscode.postMessage({
          command: "bulkRemoveSegments",
          segmentIds: allSegmentIds
        });
      }, 300);
    }
    function cancelBulkRemove() {
      const confirmEl = document.querySelector(".bulk-remove-confirm");
      if (confirmEl) {
        confirmEl.style.display = "none";
      }
    }
    function toggleStar(segmentId) {
      const segment = segments.find((s) => s.id === segmentId);
      if (!segment) return;
      const newStarState = !segment.metadata?.isStarred;
      if (!segment.metadata) {
        segment.metadata = {};
      }
      segment.metadata.isStarred = newStarState;
      updateStarButtonsUI(segmentId, newStarState);
      vscode.postMessage({
        command: "toggleStar",
        segmentId,
        isStarred: newStarState
      });
    }
    function toggleStarFromFooter(segmentId) {
      toggleStar(segmentId);
    }
    function updateStarButtonsUI(segmentId, isStarred) {
      const card = document.querySelector(`.segment-card[data-segment-id="${segmentId}"]`);
      if (!card) return;
      const headerStarBtn = card.querySelector(".star-btn");
      if (headerStarBtn) {
        const headerIcon = headerStarBtn.querySelector(".codicon");
        headerStarBtn.dataset.starred = isStarred;
        if (isStarred) {
          headerStarBtn.classList.add("starred");
          if (headerIcon) headerIcon.className = "codicon codicon-star-full";
        } else {
          headerStarBtn.classList.remove("starred");
          if (headerIcon) headerIcon.className = "codicon codicon-star-empty";
        }
      }
      const footerStarBtn = card.querySelector(".footer-star-btn");
      if (footerStarBtn) {
        const footerIcon = footerStarBtn.querySelector(".codicon");
        footerStarBtn.dataset.starred = isStarred;
        footerStarBtn.title = isStarred ? "Unstar" : "Star for later";
        if (isStarred) {
          footerStarBtn.classList.add("starred");
          if (footerIcon) footerIcon.className = "codicon codicon-star-full";
        } else {
          footerStarBtn.classList.remove("starred");
          if (footerIcon) footerIcon.className = "codicon codicon-star-empty";
        }
      }
    }
    function highlightSegmentById(segmentId) {
      document.querySelectorAll(".segment-card").forEach((card) => {
        card.classList.remove("selected");
      });
      if (segmentId) {
        const card = document.querySelector(`.segment-card[data-segment-id="${segmentId}"]`);
        if (card) {
          card.classList.add("selected");
        }
      }
    }
    function isSegmentNew(segment) {
      if (!segment.metadata?.detectedAt) return false;
      const detectedTime = new Date(segment.metadata.detectedAt).getTime();
      const now = Date.now();
      const fiveMinutesInMs = 5 * 60 * 1e3;
      return now - detectedTime < fiveMinutesInMs;
    }
    function sortSegments(segmentsArray, sortMode) {
      return segmentsArray.sort((a, b) => {
        const aStarred = a.metadata?.isStarred || false;
        const bStarred = b.metadata?.isStarred || false;
        if (aStarred !== bStarred) {
          return bStarred ? 1 : -1;
        }
        if (sortMode === "line") {
          if (a.filePath !== b.filePath) {
            return a.filePath.localeCompare(b.filePath);
          }
          return a.startLine - b.startLine;
        } else if (sortMode === "complexity") {
          const complexityA = a.complexity !== null ? a.complexity : -1;
          const complexityB = b.complexity !== null ? b.complexity : -1;
          return complexityB - complexityA;
        } else if (sortMode === "time") {
          const timeA = a.metadata?.detectedAt ? new Date(a.metadata.detectedAt).getTime() : 0;
          const timeB = b.metadata?.detectedAt ? new Date(b.metadata.detectedAt).getTime() : 0;
          return timeA - timeB;
        }
        return 0;
      });
    }
    function setSortMode(mode) {
      currentSort = mode;
      document.querySelectorAll(".sort-button").forEach((btn) => {
        if (btn.dataset.sort === mode) {
          btn.classList.add("active");
        } else {
          btn.classList.remove("active");
        }
      });
      vscode.postMessage({
        command: "setSortMode",
        sortMode: mode
      });
      renderSegments();
    }
    function formatTimeAgo(isoString) {
      if (!isoString) return "";
      const date = new Date(isoString);
      const now = Date.now();
      const diffMs = now - date.getTime();
      const seconds = Math.floor(diffMs / 1e3);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      if (seconds < 60) {
        return "just now";
      } else if (minutes < 60) {
        return `${minutes}m ago`;
      } else if (hours < 24) {
        return `${hours}h ago`;
      } else {
        return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      }
    }
    function getComplexityLevel(complexity) {
      if (complexity === null || complexity === void 0) {
        return "unknown";
      }
      if (complexity <= 5) return "low";
      if (complexity <= 10) return "medium";
      return "high";
    }
    function escapeHtml(text) {
      const div = document.createElement("div");
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
    function toggleDiffView(segmentId, showDiff) {
      const card = document.querySelector(`.segment-card[data-segment-id="${segmentId}"]`);
      if (!card) return;
      const diffBtn = card.querySelector(".diff-btn");
      const diffSection = card.querySelector(".code-diff-section");
      const segment = segments.find((s) => s.id === segmentId);
      if (!diffBtn || !diffSection || !segment) return;
      diffBtn.dataset.diffActive = showDiff;
      if (showDiff) {
        diffBtn.classList.add("active");
        diffBtn.title = "Show current code";
      } else {
        diffBtn.classList.remove("active");
        diffBtn.title = "Toggle diff view";
      }
      if (showDiff) {
        renderDiffView(diffSection, segment);
      } else {
        renderCurrentCodeView(diffSection, segment);
      }
    }
    function renderCurrentCodeView(container, segment) {
      const code = segment.code || "";
      const lines = code.split("\n");
      const startLine = segment.startLine || 1;
      const codeLines = lines.map((line, index) => {
        const lineNum = startLine + index;
        return `<div class="code-line"><span class="code-line-gutter">${lineNum}</span><span class="code-line-content">${escapeHtml(line) || " "}</span></div>`;
      }).join("");
      container.innerHTML = `
            <div class="code-view">
                <div class="code-view-header">
                    <div class="code-view-title">
                        <span class="codicon codicon-file-code"></span>
                        <span class="code-view-label">Current Code</span>
                    </div>
                    <div class="code-view-actions">
                        <button class="code-view-action-btn copy-code-btn" title="Copy code">
                            <span class="codicon codicon-copy"></span>
                        </button>
                    </div>
                </div>
                <div class="code-view-content">
                    ${codeLines || '<div class="code-view-empty">No code content</div>'}
                </div>
            </div>
        `;
    }
    function renderDiffView(container, segment) {
      if (!segment.metadata?.beforeCode) {
        container.innerHTML = `
                <div class="diff-view">
                    <div class="diff-error">
                        <span class="codicon codicon-info"></span>
                        <span>No previous version available for comparison</span>
                    </div>
                </div>
            `;
        return;
      }
      const beforeCode = segment.metadata.beforeCode;
      const afterCode = segment.code || "";
      const beforeLines = beforeCode.split("\n");
      const afterLines = afterCode.split("\n");
      let addedCount = 0;
      let removedCount = 0;
      const diffLines = [];
      let oldLineNum = segment.startLine || 1;
      let newLineNum = segment.startLine || 1;
      const maxLines = Math.max(beforeLines.length, afterLines.length);
      let i = 0;
      while (i < maxLines) {
        const beforeLine = i < beforeLines.length ? beforeLines[i] : null;
        const afterLine = i < afterLines.length ? afterLines[i] : null;
        if (beforeLine === null) {
          addedCount++;
          diffLines.push(
            `<div class="diff-line added"><span class="diff-gutter-indicator">+</span><span class="diff-line-num old"></span><span class="diff-line-num new">${newLineNum}</span><span class="diff-content">${escapeHtml(afterLine) || " "}</span></div>`
          );
          newLineNum++;
          i++;
        } else if (afterLine === null) {
          removedCount++;
          diffLines.push(
            `<div class="diff-line removed"><span class="diff-gutter-indicator">\u2212</span><span class="diff-line-num old">${oldLineNum}</span><span class="diff-line-num new"></span><span class="diff-content">${escapeHtml(beforeLine) || " "}</span></div>`
          );
          oldLineNum++;
          i++;
        } else if (beforeLine !== afterLine) {
          const removedBlock = [];
          const addedBlock = [];
          let j = i;
          while (j < maxLines) {
            const b = j < beforeLines.length ? beforeLines[j] : null;
            const a = j < afterLines.length ? afterLines[j] : null;
            if (b === a || b === null || a === null) {
              break;
            }
            removedBlock.push({ line: b, num: oldLineNum + (j - i) });
            addedBlock.push({ line: a, num: newLineNum + (j - i) });
            j++;
          }
          if (removedBlock.length > 0) {
            removedBlock.forEach((item, idx) => {
              removedCount++;
              diffLines.push(
                `<div class="diff-line removed"><span class="diff-gutter-indicator">\u2212</span><span class="diff-line-num old">${oldLineNum + idx}</span><span class="diff-line-num new"></span><span class="diff-content">${escapeHtml(item.line) || " "}</span></div>`
              );
            });
            addedBlock.forEach((item, idx) => {
              addedCount++;
              diffLines.push(
                `<div class="diff-line added"><span class="diff-gutter-indicator">+</span><span class="diff-line-num old"></span><span class="diff-line-num new">${newLineNum + idx}</span><span class="diff-content">${escapeHtml(item.line) || " "}</span></div>`
              );
            });
            oldLineNum += removedBlock.length;
            newLineNum += addedBlock.length;
            i = j;
          } else {
            removedCount++;
            addedCount++;
            diffLines.push(
              `<div class="diff-line removed"><span class="diff-gutter-indicator">\u2212</span><span class="diff-line-num old">${oldLineNum}</span><span class="diff-line-num new"></span><span class="diff-content">${escapeHtml(beforeLine) || " "}</span></div>`
            );
            diffLines.push(
              `<div class="diff-line added"><span class="diff-gutter-indicator">+</span><span class="diff-line-num old"></span><span class="diff-line-num new">${newLineNum}</span><span class="diff-content">${escapeHtml(afterLine) || " "}</span></div>`
            );
            oldLineNum++;
            newLineNum++;
            i++;
          }
        } else {
          diffLines.push(
            `<div class="diff-line context"><span class="diff-gutter-indicator"></span><span class="diff-line-num old">${oldLineNum}</span><span class="diff-line-num new">${newLineNum}</span><span class="diff-content">${escapeHtml(afterLine) || " "}</span></div>`
          );
          oldLineNum++;
          newLineNum++;
          i++;
        }
      }
      container.innerHTML = `
            <div class="diff-view">
                <div class="diff-view-header">
                    <div class="diff-view-title">
                        <span class="codicon codicon-diff"></span>
                        <span class="diff-view-label">Changes</span>
                    </div>
                    <div class="diff-stats">
                        <span class="diff-stat-add">+${addedCount}</span>
                        <span class="diff-stat-remove">\u2212${removedCount}</span>
                    </div>
                </div>
                <div class="diff-view-content">
                    ${diffLines.join("")}
                </div>
            </div>
        `;
    }
    function renderMarkdown(markdown) {
      if (!markdown) return "";
      if (typeof marked === "undefined") {
        console.warn("marked.js not loaded yet, returning plain text");
        return escapeHtml(markdown);
      }
      try {
        marked.setOptions({
          breaks: true,
          // Convert \n to <br>
          gfm: true,
          // GitHub Flavored Markdown
          headerIds: false,
          // Don't add IDs to headers
          mangle: false
          // Don't mangle email addresses
        });
        return marked.parse(markdown);
      } catch (error) {
        console.error("Error rendering markdown:", error);
        return escapeHtml(markdown);
      }
    }
    function updateExplanationState(segmentId, state, data) {
      const section = document.querySelector(`.explanation-section[data-segment-id="${segmentId}"]`);
      if (!section) return;
      if (state === "loading") {
        if (data) {
          section.className = "explanation-section loading";
          section.innerHTML = `
                    <div class="explanation-loading">
                        <div class="loading-spinner"></div>
                        <span>Generating explanation...</span>
                    </div>
                `;
        } else {
          if (!section.classList.contains("has-content")) {
            section.innerHTML = "";
            section.className = "explanation-section";
          }
        }
      } else if (state === "error") {
        section.className = "explanation-section error";
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
    function updateExplanationContent(segmentId, explanation) {
      const section = document.querySelector(`.explanation-section[data-segment-id="${segmentId}"]`);
      if (!section) return;
      section.className = "explanation-section has-content";
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
      const segment = segments.find(function(s) {
        return s.id === segmentId;
      });
      if (segment) {
        if (!segment.metadata) {
          segment.metadata = {};
        }
        segment.metadata.explanation = explanation;
      }
    }
    document.addEventListener("click", function(e) {
      const target = e.target;
      if (!target.closest(".context-menu-btn") && !target.closest(".context-menu")) {
        const openMenus = document.querySelectorAll(".context-menu");
        openMenus.forEach((menu) => {
          menu.style.display = "none";
        });
      }
      const sortBtn = target.closest(".sort-button");
      if (sortBtn) {
        const sortMode = sortBtn.dataset.sort;
        if (sortMode) {
          e.preventDefault();
          setSortMode(sortMode);
        }
        return;
      }
      const fileGroupHeader = target.closest(".file-group-header");
      if (fileGroupHeader) {
        const sessionKey = fileGroupHeader.dataset.sessionKey || fileGroupHeader.dataset.filePath;
        if (sessionKey) {
          e.preventDefault();
          toggleFileGroup(sessionKey);
        }
        return;
      }
      const title = target.closest(".segment-title");
      const subtitle = target.closest(".segment-subtitle");
      if (title || subtitle) {
        const card = target.closest("[data-segment-id]");
        if (card) {
          e.preventDefault();
          e.stopPropagation();
          const segmentId = card.dataset.segmentId;
          const segment = segments.find((s) => s.id === segmentId);
          if (segment) {
            goToCode(segmentId, segment.startLine);
          }
        }
        return;
      }
      const header = target.closest('.segment-header[data-clickable="true"]');
      if (header && !target.closest("button") && !target.closest(".segment-title") && !target.closest(".segment-subtitle")) {
        const card = header.closest("[data-segment-id]");
        if (card) {
          e.preventDefault();
          const segmentId = card.dataset.segmentId;
          toggleSegment(segmentId);
        }
        return;
      }
      const expandBtn = target.closest(".expand-btn");
      if (expandBtn) {
        const segmentId = expandBtn.closest("[data-segment-id]")?.dataset.segmentId;
        if (segmentId) {
          e.preventDefault();
          e.stopPropagation();
          toggleSegment(segmentId);
        }
        return;
      }
      const addContextBtn = target.closest(".add-context-btn");
      if (addContextBtn) {
        const contextSection = addContextBtn.closest(".context-section");
        if (contextSection) {
          e.preventDefault();
          const btn = contextSection.querySelector(".add-context-btn");
          const wrapper = contextSection.querySelector(".context-input-wrapper");
          if (btn && wrapper) {
            btn.style.display = "none";
            wrapper.classList.add("visible");
            const textarea = wrapper.querySelector(".context-input");
            if (textarea) {
              setTimeout(() => textarea.focus(), 100);
            }
          }
        }
        return;
      }
      const cancelAddContextBtn = target.closest(".cancel-add-context-btn");
      if (cancelAddContextBtn) {
        const contextSection = cancelAddContextBtn.closest(".context-section");
        if (contextSection) {
          e.preventDefault();
          const btn = contextSection.querySelector(".add-context-btn");
          const wrapper = contextSection.querySelector(".context-input-wrapper");
          if (btn && wrapper) {
            btn.style.display = "";
            wrapper.classList.remove("visible");
            const textarea = wrapper.querySelector(".context-input");
            if (textarea) {
              textarea.value = "";
            }
          }
        }
        return;
      }
      const saveContextBtn = target.closest(".save-context-btn");
      if (saveContextBtn) {
        const contextSection = saveContextBtn.closest(".context-section");
        if (contextSection) {
          const segmentId = contextSection.dataset.segmentId;
          const textarea = contextSection.querySelector(".context-input");
          if (textarea && segmentId) {
            e.preventDefault();
            saveContext(segmentId, textarea.value);
          }
        }
        return;
      }
      const editContextBtn = target.closest(".edit-context-btn");
      if (editContextBtn) {
        const contextSection = editContextBtn.closest(".context-section");
        if (contextSection) {
          const segmentId = contextSection.dataset.segmentId;
          const segment = segments.find((s) => s.id === segmentId);
          if (segment) {
            e.preventDefault();
            contextSection.classList.remove("has-content");
            contextSection.innerHTML = `
                        <div class="context-header">
                            <div class="context-label">Context</div>
                        </div>
                        <div class="context-input-wrapper visible">
                            <textarea
                                class="context-input"
                                placeholder="What does this code do? Why is it important?"
                                data-segment-id="${segmentId}">${segment.metadata?.context || ""}</textarea>
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
            const textarea = contextSection.querySelector(".context-input");
            if (textarea) {
              setTimeout(() => textarea.focus(), 100);
            }
          }
        }
        return;
      }
      const cancelContextBtn = target.closest(".cancel-context-btn");
      if (cancelContextBtn) {
        const contextSection = cancelContextBtn.closest(".context-section");
        if (contextSection) {
          e.preventDefault();
          const segmentId = contextSection.dataset.segmentId;
          const segment = segments.find((s) => s.id === segmentId);
          if (segment && segment.metadata?.context) {
            contextSection.classList.add("has-content");
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
            contextSection.style.display = "none";
            const wrapper = contextSection.querySelector(".context-input-wrapper");
            if (wrapper) {
              wrapper.classList.remove("visible");
              const textarea = wrapper.querySelector(".context-input");
              if (textarea) {
                textarea.value = "";
              }
            }
          }
        }
        return;
      }
      const contextMenuBtn = target.closest(".context-menu-btn");
      if (contextMenuBtn) {
        e.preventDefault();
        const menu = contextMenuBtn.nextElementSibling;
        if (menu && menu.classList.contains("context-menu")) {
          const isVisible = menu.style.display !== "none";
          menu.style.display = isVisible ? "none" : "block";
        }
        return;
      }
      const editContextMenuBtn = target.closest(".edit-context-menu-btn");
      if (editContextMenuBtn) {
        const contextSection = editContextMenuBtn.closest(".context-section");
        if (contextSection) {
          e.preventDefault();
          const segmentId = contextSection.dataset.segmentId;
          const segment = segments.find((s) => s.id === segmentId);
          const menu = contextSection.querySelector(".context-menu");
          if (menu) {
            menu.style.display = "none";
          }
          const existingContext = segment?.metadata?.context || "";
          contextSection.classList.remove("has-content");
          contextSection.innerHTML = `
                    <div class="context-input-wrapper visible">
                        <textarea class="context-input" placeholder="Add context about this code segment...">${escapeHtml(existingContext)}</textarea>
                        <div class="context-actions">
                            <button class="vk-button cancel-context-btn">Cancel</button>
                            <button class="vk-button vk-button--primary save-context-btn">Save</button>
                        </div>
                    </div>
                `;
          const textarea = contextSection.querySelector(".context-input");
          if (textarea) {
            setTimeout(() => textarea.focus(), 100);
          }
        }
        return;
      }
      const removeSegmentBtn = target.closest(".remove-segment-btn");
      if (removeSegmentBtn) {
        const contextSection = removeSegmentBtn.closest(".context-section");
        if (contextSection) {
          const segmentId = contextSection.dataset.segmentId;
          if (segmentId) {
            e.preventDefault();
            const menu = contextSection.querySelector(".context-menu");
            if (menu) {
              menu.style.display = "none";
            }
            const segment = segments.find((s) => s.id === segmentId);
            if (segment && segment.metadata) {
              segment.metadata.context = "";
            }
            saveContext(segmentId, "");
            contextSection.classList.remove("has-content");
            contextSection.innerHTML = `
                        <div class="context-input-wrapper">
                            <textarea class="context-input" placeholder="Add context about this code segment..."></textarea>
                            <div class="context-actions">
                                <button class="vk-button vk-button--primary save-context-btn">Save</button>
                                <button class="vk-button cancel-context-btn">Cancel</button>
                            </div>
                        </div>
                    `;
            const card = document.querySelector(`.segment-card[data-segment-id="${segmentId}"]`);
            if (card) {
              const contextIndicator = card.querySelector(".context-indicator-btn");
              if (contextIndicator) {
                contextIndicator.remove();
              }
            }
          }
        }
        return;
      }
      const explainBtn = target.closest(".explain-btn");
      if (explainBtn) {
        const card = explainBtn.closest("[data-segment-id]");
        if (card) {
          e.preventDefault();
          explainSegment(card.dataset.segmentId);
        }
        return;
      }
      const noteBtn = target.closest(".note-btn");
      if (noteBtn) {
        const card = noteBtn.closest("[data-segment-id]");
        if (card) {
          e.preventDefault();
          const segmentId = card.dataset.segmentId;
          const segment = segments.find((s) => s.id === segmentId);
          if (!card.classList.contains("expanded")) {
            toggleSegment(segmentId);
          }
          setTimeout(() => {
            const contextSection = card.querySelector(".context-section");
            if (contextSection) {
              if (segment && segment.metadata?.context) {
                contextSection.classList.remove("has-content");
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
                contextSection.style.display = "block";
                const wrapper = contextSection.querySelector(".context-input-wrapper");
                if (wrapper) {
                  wrapper.classList.add("visible");
                }
              }
              const textarea = contextSection.querySelector(".context-input");
              if (textarea) {
                setTimeout(() => textarea.focus(), 100);
              }
            }
          }, 150);
        }
        return;
      }
      const reviewedBtn = target.closest(".reviewed-btn");
      if (reviewedBtn) {
        const card = reviewedBtn.closest("[data-segment-id]");
        if (card) {
          e.preventDefault();
          const segmentId = card.dataset.segmentId;
          dismissSegment(segmentId);
        }
        return;
      }
      const starBtn = target.closest(".star-btn");
      if (starBtn) {
        const card = starBtn.closest("[data-segment-id]");
        if (card) {
          e.preventDefault();
          const segmentId = card.dataset.segmentId;
          toggleStar(segmentId);
        }
        return;
      }
      const footerStarBtn = target.closest(".footer-star-btn");
      if (footerStarBtn) {
        const card = footerStarBtn.closest("[data-segment-id]");
        if (card) {
          e.preventDefault();
          const segmentId = card.dataset.segmentId;
          toggleStarFromFooter(segmentId);
        }
        return;
      }
      const dismissBtn = target.closest(".dismiss-btn");
      if (dismissBtn) {
        const card = dismissBtn.closest("[data-segment-id]");
        if (card) {
          e.preventDefault();
          const segmentId = card.dataset.segmentId;
          dismissSegment(segmentId);
        }
        return;
      }
      const regenerateBtn = target.closest(".regenerate-btn");
      if (regenerateBtn && regenerateBtn.dataset.segmentId) {
        e.preventDefault();
        e.stopPropagation();
        explainSegment(regenerateBtn.dataset.segmentId);
        return;
      }
      const explanationHeader = target.closest(".explanation-header");
      if (explanationHeader) {
        const section = explanationHeader.closest(".explanation-section");
        if (section && section.classList.contains("has-content")) {
          e.preventDefault();
          section.classList.toggle("collapsed");
          const icon = section.querySelector(".collapse-icon .codicon");
          if (icon) {
            if (section.classList.contains("collapsed")) {
              icon.className = "codicon codicon-add";
            } else {
              icon.className = "codicon codicon-remove";
            }
          }
        }
        return;
      }
      const diffBtn = target.closest(".diff-btn");
      if (diffBtn) {
        e.preventDefault();
        const card = diffBtn.closest("[data-segment-id]");
        if (card) {
          const segmentId = card.dataset.segmentId;
          const isDiffActive = diffBtn.dataset.diffActive === "true";
          toggleDiffView(segmentId, !isDiffActive);
        }
        return;
      }
      const bulkRemoveBtn = target.closest(".bulk-remove-btn");
      if (bulkRemoveBtn) {
        e.preventDefault();
        bulkRemoveSegments();
        return;
      }
      const confirmBtn = target.closest(".confirm-bulk-remove-btn");
      if (confirmBtn) {
        e.preventDefault();
        confirmBulkRemove();
        return;
      }
      const cancelBtn = target.closest(".cancel-bulk-remove-btn");
      if (cancelBtn) {
        e.preventDefault();
        cancelBulkRemove();
        return;
      }
    });
    vscode.postMessage({ command: "refresh" });
  })();
})();
//# sourceMappingURL=segments.js.map
