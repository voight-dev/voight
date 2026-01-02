"use strict";(()=>{(function(){let w=acquireVsCodeApi(),f=[],h=[],q="line",B=[],P=null,A=new Set;window.addEventListener("message",t=>{let e=t.data;switch(e.command){case"updateSegments":f=e.segments,B=e.files||[],P=e.currentFile||null,e.sortMode&&e.sortMode!==q&&(q=e.sortMode,document.querySelectorAll(".sort-button").forEach(a=>{a.dataset.sort===q?a.classList.add("active"):a.classList.remove("active")})),N(),tt();break;case"showFileList":Z(e.files);break;case"explanationLoading":V(e.segmentId,"loading",e.loading);break;case"updateExplanation":vt(e.segmentId,e.explanation);break;case"explanationError":V(e.segmentId,"error",e.error);break;case"contextSaved":nt(e.segmentId,e.context);break;case"highlightSegment":dt(e.segmentId);break}});function N(){let t=document.getElementById("segments-list"),e=document.getElementById("segment-count"),a=document.querySelector(".sort-controls");a&&(a.style.display="flex");let n=document.querySelector(".bulk-remove-btn");if(n&&(n.style.display=f&&f.length>0?"flex":"none"),f==null){t.innerHTML=`
                <div class="skeleton-loader">
                    ${F()}
                    ${F()}
                    ${F()}
                </div>
            `,e.textContent="Loading...";return}if(f.length===0){t.innerHTML=`
                <div class="empty-state">
                    <div class="codicon codicon-inbox"></div>
                    <p>No segments detected yet.</p>
                    <p style="margin-top: 8px; font-size: 12px;">Segments will appear here as you work.</p>
                </div>
            `,e.textContent="No segments";return}e.textContent=`${f.length} segment${f.length!==1?"s":""}`,h=lt([...f],q);let i=q==="time";if(P==="__all__"){t.innerHTML=Q(h,i);return}t.innerHTML=h.map((o,l)=>{let r=O(o.complexity),v=o.endLine-o.startLine+1,g=W(o),x=o.metadata?.isStarred||!1,b=!!o.metadata?.beforeCode,y="";if(i&&l>0){let C=h[l-1].filePath,$=o.filePath,k=o.fileName;C!==$&&(h.slice(0,l-1).some(D=>D.filePath===$)?y=`
                        <div class="flow-indicator flow-return">
                            <div class="flow-line"></div>
                            <div class="flow-label">
                                <span class="codicon codicon-arrow-circle-left"></span>
                                <span>returned to ${p(k)}</span>
                            </div>
                        </div>`:y=`
                        <div class="flow-indicator flow-switch">
                            <div class="flow-line"></div>
                            <div class="flow-label">
                                <span class="codicon codicon-arrow-right"></span>
                                <span>switched to ${p(k)}</span>
                            </div>
                        </div>`)}let S=i&&o.metadata?.detectedAt?K(o.metadata.detectedAt):"";return`${y}
            <div class="segment-card ${i?"timeline-view":""}" data-segment-id="${o.id}" data-complexity="${r}" data-time="${o.metadata?.detectedAt||""}">
                <div class="segment-header" data-clickable="true">
                    <div class="segment-header-left">
                        ${i?`<span class="timeline-order">${l+1}</span>`:""}
                        <div class="segment-title-wrapper">
                            <span class="segment-title">${p(o.name)}</span>
                            <span class="segment-subtitle">
                                ${p(o.lineRange||"")}
                                ${g?'<span class="new-badge">NEW</span>':""}
                                ${b?'<span class="diff-badge" title="Has changes from previous version"><span class="codicon codicon-diff"></span>DIFF</span>':""}
                                ${S?`<span class="time-badge" title="${o.metadata?.detectedAt||""}">${S}</span>`:""}
                            </span>
                        </div>
                    </div>
                    <div class="segment-header-actions">
                        ${o.metadata?.context?`
                        <button
                            class="vk-icon-button context-indicator-btn"
                            title="Has context note"
                            disabled>
                            <span class="codicon codicon-note"></span>
                        </button>
                        `:""}
                        ${o.metadata?.beforeCode?`
                        <button
                            class="vk-icon-button diff-btn"
                            title="Toggle diff view"
                            data-diff-active="false"
                            style="display: none;">
                            <span class="codicon codicon-diff"></span>
                        </button>
                        `:""}
                        ${i?"":`
                        <button
                            class="vk-icon-button star-btn ${x?"starred":""}"
                            title="Star for later"
                            data-starred="${x}">
                            <span class="codicon codicon-star-${x?"full":"empty"}"></span>
                        </button>
                        `}
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
                        <span class="metadata-badge complexity-badge-${r}">
                            <span class="codicon codicon-pulse"></span>
                            <span>${o.complexity!==null?o.complexity:"N/A"}</span>
                        </span>
                        <span class="metadata-badge">
                            <span class="codicon codicon-file-code"></span>
                            <span>${v} lines</span>
                        </span>
                        <span class="metadata-badge" title="${p(o.filePath)}">
                            <span class="codicon codicon-folder"></span>
                            <span>${p(o.fileName)}</span>
                        </span>
                    </div>

                    <!-- Explanation section -->
                    <div class="explanation-section" data-segment-id="${o.id}">
                        <!-- This will be populated dynamically by JS -->
                    </div>

                    <!-- Context section (shows saved context or hidden input) -->
                    <div class="context-section ${o.metadata?.context?"has-content":""}" data-segment-id="${o.id}">
                        ${o.metadata?.context?`
                            <div class="context-display-wrapper">
                                <div class="context-display">${p(o.metadata.context)}</div>
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
                        `:`
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
                    ${o.metadata?.beforeCode?`
                    <div class="code-diff-section" data-segment-id="${o.id}"></div>
                    `:""}

                    <!-- Action Footer -->
                    <div class="action-footer">
                        <div class="action-footer-left">
                            <button class="action-icon-btn explain-btn" title="Explain this code with AI">
                                <span class="codicon codicon-sparkle"></span>
                            </button>
                            <button class="action-icon-btn note-btn" title="Add a context note">
                                <span class="codicon codicon-edit"></span>
                            </button>
                            ${i?`
                            <button class="action-icon-btn footer-star-btn ${x?"starred":""}" title="${x?"Unstar":"Star for later"}" data-starred="${x}">
                                <span class="codicon codicon-star-${x?"full":"empty"}"></span>
                            </button>
                            `:""}
                        </div>
                        <button class="action-icon-btn reviewed-btn" title="Mark as reviewed">
                            <span class="codicon codicon-check"></span>
                        </button>
                    </div>
                </div>
            </div>
            `}).join("")}function Q(t,e){let a=[],n=null,i=new Set;t.forEach((o,l)=>{let r=o.filePath;if(!n||n.filePath!==r){let v=i.has(r);i.add(r),n={filePath:r,fileName:o.fileName,isReturn:v,isFirst:a.length===0,segments:[],globalIndices:[],sessionIndex:a.length},a.push(n)}n.segments.push(o),n.globalIndices.push(l)});let c="";return a.forEach((o,l)=>{let r=`${o.filePath}-${l}`,v=A.has(r),g=o.segments.length,x,b,y;o.isFirst?(x="codicon-file-code",b=`Started in ${o.fileName}`,y="session-start"):o.isReturn?(x="codicon-arrow-circle-left",b=`Returned to ${o.fileName}`,y="session-return"):(x="codicon-arrow-right",b=`Switched to ${o.fileName}`,y="session-switch"),c+=`
            <div class="file-group ${y}" data-session-key="${p(r)}">
                <div class="file-group-header ${v?"collapsed":""}" data-session-key="${p(r)}">
                    <div class="file-group-header-left">
                        <span class="file-group-chevron codicon codicon-chevron-${v?"right":"down"}"></span>
                        <span class="codicon ${x} file-group-icon"></span>
                        <span class="file-group-name">${p(b)}</span>
                        <span class="file-group-count">${g}</span>
                    </div>
                    <div class="file-group-header-right">
                        <button class="file-group-collapse-all-btn" title="${v?"Expand session":"Collapse session"}">
                            <span class="codicon codicon-${v?"expand-all":"collapse-all"}"></span>
                        </button>
                    </div>
                </div>
                <div class="file-group-content ${v?"collapsed":""}">
            `,o.segments.forEach((S,L)=>{let C=o.globalIndices[L];c+=X(S,C,e,t,!1)}),c+=`
                </div>
            </div>
            `}),c}function X(t,e,a,n,i=!0){let c=O(t.complexity),o=t.endLine-t.startLine+1,l=W(t),r=t.metadata?.isStarred||!1,v=!!t.metadata?.beforeCode,g="";if(i&&a&&e>0){let y=n[e-1].filePath,S=t.filePath,L=t.fileName;y!==S&&(n.slice(0,e-1).some($=>$.filePath===S)?g=`
                    <div class="flow-indicator flow-return">
                        <div class="flow-line"></div>
                        <div class="flow-label">
                            <span class="codicon codicon-arrow-circle-left"></span>
                            <span>returned to ${p(L)}</span>
                        </div>
                    </div>`:g=`
                    <div class="flow-indicator flow-switch">
                        <div class="flow-line"></div>
                        <div class="flow-label">
                            <span class="codicon codicon-arrow-right"></span>
                            <span>switched to ${p(L)}</span>
                        </div>
                    </div>`)}let x=a&&t.metadata?.detectedAt?K(t.metadata.detectedAt):"";return`${g}
        <div class="segment-card ${a?"timeline-view":""}" data-segment-id="${t.id}" data-complexity="${c}" data-time="${t.metadata?.detectedAt||""}">
            <div class="segment-header" data-clickable="true">
                <div class="segment-header-left">
                    ${a?`<span class="timeline-order">${e+1}</span>`:""}
                    <div class="segment-title-wrapper">
                        <span class="segment-title">${p(t.name)}</span>
                        <span class="segment-subtitle">
                            ${p(t.lineRange||"")}
                            ${l?'<span class="new-badge">NEW</span>':""}
                            ${v?'<span class="diff-badge" title="Has changes from previous version"><span class="codicon codicon-diff"></span>DIFF</span>':""}
                            ${x?`<span class="time-badge" title="${t.metadata?.detectedAt||""}">${x}</span>`:""}
                        </span>
                    </div>
                </div>
                <div class="segment-header-actions">
                    ${t.metadata?.context?`
                    <button
                        class="vk-icon-button context-indicator-btn"
                        title="Has context note"
                        disabled>
                        <span class="codicon codicon-note"></span>
                    </button>
                    `:""}
                    ${t.metadata?.beforeCode?`
                    <button
                        class="vk-icon-button diff-btn"
                        title="Toggle diff view"
                        data-diff-active="false"
                        style="display: none;">
                        <span class="codicon codicon-diff"></span>
                    </button>
                    `:""}
                    ${a?"":`
                    <button
                        class="vk-icon-button star-btn ${r?"starred":""}"
                        title="Star for later"
                        data-starred="${r}">
                        <span class="codicon codicon-star-${r?"full":"empty"}"></span>
                    </button>
                    `}
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
                    <span class="metadata-badge complexity-badge-${c}">
                        <span class="codicon codicon-pulse"></span>
                        <span>${t.complexity!==null?t.complexity:"N/A"}</span>
                    </span>
                    <span class="metadata-badge">
                        <span class="codicon codicon-file-code"></span>
                        <span>${o} lines</span>
                    </span>
                    <span class="metadata-badge" title="${p(t.filePath)}">
                        <span class="codicon codicon-folder"></span>
                        <span>${p(t.fileName)}</span>
                    </span>
                </div>

                <!-- Explanation section -->
                <div class="explanation-section" data-segment-id="${t.id}">
                    <!-- This will be populated dynamically by JS -->
                </div>

                <!-- Context section (shows saved context or hidden input) -->
                <div class="context-section ${t.metadata?.context?"has-content":""}" data-segment-id="${t.id}">
                    ${t.metadata?.context?`
                        <div class="context-display-wrapper">
                            <div class="context-display">${p(t.metadata.context)}</div>
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
                    `:`
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
                ${t.metadata?.beforeCode?`
                <div class="code-diff-section" data-segment-id="${t.id}"></div>
                `:""}

                <!-- Action Footer -->
                <div class="action-footer">
                    <div class="action-footer-left">
                        <button class="action-icon-btn explain-btn" title="Explain this code with AI">
                            <span class="codicon codicon-sparkle"></span>
                        </button>
                        <button class="action-icon-btn note-btn" title="Add a context note">
                            <span class="codicon codicon-edit"></span>
                        </button>
                        ${a?`
                        <button class="action-icon-btn footer-star-btn ${r?"starred":""}" title="${r?"Unstar":"Star for later"}" data-starred="${r}">
                            <span class="codicon codicon-star-${r?"full":"empty"}"></span>
                        </button>
                        `:""}
                    </div>
                    <button class="action-icon-btn reviewed-btn" title="Mark as reviewed">
                        <span class="codicon codicon-check"></span>
                    </button>
                </div>
            </div>
        </div>
        `}function Y(t){A.has(t)?A.delete(t):A.add(t),N()}function xt(){B.forEach(t=>{A.add(t.filePath)}),N()}function gt(){A.clear(),N()}function T(t){let e=document.querySelector(`.segment-card[data-segment-id="${t}"]`);if(!e)return;let a=e.querySelector(".expand-btn"),n=e.querySelector(".diff-btn");e.classList.contains("expanded")?(e.classList.remove("expanded"),a&&(a.dataset.expanded="false",a.title="Expand segment"),n&&(n.style.display="none")):(document.querySelectorAll(".segment-card.expanded").forEach(c=>{if(c!==e){c.classList.remove("expanded");let o=c.querySelector(".expand-btn"),l=c.querySelector(".diff-btn");o&&(o.dataset.expanded="false",o.title="Expand segment"),l&&(l.style.display="none")}}),e.classList.add("expanded"),a&&(a.dataset.expanded="true",a.title="Collapse segment"),n&&(n.style.display=""))}function Z(t){let e=document.getElementById("segments-list"),a=document.getElementById("segment-count");if(!t||t.length===0){e.innerHTML=`
                <div class="empty-state">
                    <div class="codicon codicon-inbox"></div>
                    <p>No segments detected yet.</p>
                    <p style="margin-top: 8px; font-size: 12px;">Segments will appear here as you work.</p>
                </div>
            `,a.textContent="No segments";return}a.textContent=`${t.length} file${t.length!==1?"s":""} with segments`;let n=document.querySelector(".sort-controls");n&&(n.style.display="none");let i=t.map((c,o)=>{let l=document.createElement("div");return l.className="file-list-item",l.dataset.fileIndex=o,l.innerHTML=`
                <div class="file-list-item-icon">
                    <span class="codicon codicon-file-code"></span>
                </div>
                <div class="file-list-item-content">
                    <div class="file-list-item-title">${p(c.fileName)}</div>
                    <div class="file-list-item-subtitle">${c.segmentCount} segment${c.segmentCount!==1?"s":""}</div>
                </div>
                <div class="file-list-item-action">
                    <span class="codicon codicon-chevron-right"></span>
                </div>
            `,l._filePath=c.filePath,l.addEventListener("click",function(r){r.stopPropagation(),console.log("File list item clicked:",this._filePath),w.postMessage({command:"openFile",filePath:this._filePath})}),l});e.innerHTML=`
            <div class="file-list-header">
                <div class="codicon codicon-info"></div>
                <p>No segments in current file. Click a file below to view its segments:</p>
            </div>
        `,i.forEach(c=>e.appendChild(c))}function tt(){let t=document.getElementById("file-selector-container"),e=document.getElementById("file-selector");if(!B||B.length===0){t&&(t.style.display="none");return}if(t&&(t.style.display="block"),e){let a=B.reduce((l,r)=>l+r.segmentCount,0),n=P==="__all__",i=`<option value="__all__" ${n?"selected":""}>
                All Files (${a})
            </option>`,c=B.map(l=>{let r=!n&&l.isActive?"selected":"";return`<option value="${p(l.filePath)}" ${r}>
                    ${p(l.fileName)} (${l.segmentCount})
                </option>`}).join("");e.innerHTML=i+c;let o=e.cloneNode(!0);e.parentNode.replaceChild(o,e),o.addEventListener("change",l=>{let r=l.target.value;r==="__all__"?w.postMessage({command:"showAllFiles"}):r&&w.postMessage({command:"openFile",filePath:r})})}}function et(t,e){w.postMessage({command:"goToCode",segmentId:t,line:e})}function _(t,e){w.postMessage({command:"saveContext",segmentId:t,context:e})}function nt(t,e){let a=f.find(i=>i.id===t);a&&(a.metadata||(a.metadata={}),a.metadata.context=e);let n=document.querySelector(`.segment-card[data-segment-id="${t}"]`);if(n){let i=n.querySelector(".context-section");if(i)if(e&&e.trim().length>0){i.classList.add("has-content"),i.innerHTML=`
                        <div class="context-display-wrapper">
                            <div class="context-display">${p(e)}</div>
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
                    `;let c=n.querySelector(".segment-header-actions");if(c&&!c.querySelector(".context-indicator-btn")){let o=c.querySelector(".star-btn");if(o){let l=document.createElement("button");l.className="vk-icon-button context-indicator-btn",l.title="Has context note",l.disabled=!0,l.innerHTML='<span class="codicon codicon-note"></span>',c.insertBefore(l,o)}}}else{i.classList.remove("has-content"),i.innerHTML=`
                        <div class="context-input-wrapper">
                            <textarea class="context-input" placeholder="Add context about this code segment..."></textarea>
                            <div class="context-actions">
                                <button class="vk-button vk-button--primary save-context-btn">Save</button>
                                <button class="vk-button cancel-context-btn">Cancel</button>
                            </div>
                        </div>
                    `;let c=n.querySelector(".context-indicator-btn");c&&c.remove()}}}function j(t){w.postMessage({command:"explainSegment",segmentId:t})}function G(t){let e=h.findIndex(n=>n.id===t),a=document.querySelector(`.segment-card[data-segment-id="${t}"]`);a&&(a.classList.add("dismissing"),setTimeout(()=>{a.remove(),f=f.filter(i=>i.id!==t),h=h.filter(i=>i.id!==t);let n=document.getElementById("segment-count");if(n&&(n.textContent=f.length===0?"No segments":`${f.length} segment${f.length!==1?"s":""}`),w.postMessage({command:"dismissSegment",segmentId:t}),h.length>0){let i=e>=h.length?0:e,c=h[i];c&&w.postMessage({command:"goToSegment",segmentId:c.id,startLine:c.startLine,endLine:c.endLine,filePath:c.filePath})}},350))}function ht(t){let e=h.findIndex(n=>n.id===t),a=document.querySelector(`.segment-card[data-segment-id="${t}"]`);a&&(a.classList.add("dismissing"),setTimeout(()=>{a.remove(),f=f.filter(i=>i.id!==t),h=h.filter(i=>i.id!==t);let n=document.getElementById("segment-count");if(n&&(n.textContent=f.length===0?"No segments":`${f.length} segment${f.length!==1?"s":""}`),w.postMessage({command:"removeSegment",segmentId:t}),h.length>0){let i=e>=h.length?0:e,c=h[i];c&&w.postMessage({command:"goToSegment",segmentId:c.id,startLine:c.startLine,endLine:c.endLine,filePath:c.filePath})}},350))}function st(){let t=document.querySelector(".bulk-remove-confirm");t&&(t.style.display="flex",setTimeout(()=>{t.style.display==="flex"&&(t.style.display="none")},1e4))}function at(){let t=f.map(n=>n.id),e=document.querySelector(".bulk-remove-confirm");e&&(e.style.display="none"),document.querySelectorAll(".segment-card").forEach(n=>n.classList.add("dismissing")),setTimeout(()=>{f=[],h=[];let n=document.getElementById("segment-count");n&&(n.textContent="No segments");let i=document.querySelector(".bulk-remove-btn");i&&(i.style.display="none"),N(),w.postMessage({command:"bulkRemoveSegments",segmentIds:t})},300)}function ot(){let t=document.querySelector(".bulk-remove-confirm");t&&(t.style.display="none")}function U(t){let e=f.find(n=>n.id===t);if(!e)return;let a=!e.metadata?.isStarred;e.metadata||(e.metadata={}),e.metadata.isStarred=a,it(t,a),w.postMessage({command:"toggleStar",segmentId:t,isStarred:a})}function ct(t){U(t)}function it(t,e){let a=document.querySelector(`.segment-card[data-segment-id="${t}"]`);if(!a)return;let n=a.querySelector(".star-btn");if(n){let c=n.querySelector(".codicon");n.dataset.starred=e,e?(n.classList.add("starred"),c&&(c.className="codicon codicon-star-full")):(n.classList.remove("starred"),c&&(c.className="codicon codicon-star-empty"))}let i=a.querySelector(".footer-star-btn");if(i){let c=i.querySelector(".codicon");i.dataset.starred=e,i.title=e?"Unstar":"Star for later",e?(i.classList.add("starred"),c&&(c.className="codicon codicon-star-full")):(i.classList.remove("starred"),c&&(c.className="codicon codicon-star-empty"))}}function dt(t){if(document.querySelectorAll(".segment-card").forEach(e=>{e.classList.remove("selected")}),t){let e=document.querySelector(`.segment-card[data-segment-id="${t}"]`);e&&e.classList.add("selected")}}function W(t){if(!t.metadata?.detectedAt)return!1;let e=new Date(t.metadata.detectedAt).getTime(),a=Date.now(),n=300*1e3;return a-e<n}function lt(t,e){return t.sort((a,n)=>{let i=a.metadata?.isStarred||!1,c=n.metadata?.isStarred||!1;if(i!==c)return c?1:-1;if(e==="line")return a.filePath!==n.filePath?a.filePath.localeCompare(n.filePath):a.startLine-n.startLine;if(e==="complexity"){let o=a.complexity!==null?a.complexity:-1;return(n.complexity!==null?n.complexity:-1)-o}else if(e==="time"){let o=a.metadata?.detectedAt?new Date(a.metadata.detectedAt).getTime():0,l=n.metadata?.detectedAt?new Date(n.metadata.detectedAt).getTime():0;return o-l}return 0})}function rt(t){q=t,document.querySelectorAll(".sort-button").forEach(e=>{e.dataset.sort===t?e.classList.add("active"):e.classList.remove("active")}),w.postMessage({command:"setSortMode",sortMode:t}),N()}function K(t){if(!t)return"";let e=new Date(t),n=Date.now()-e.getTime(),i=Math.floor(n/1e3),c=Math.floor(i/60),o=Math.floor(c/60);return i<60?"just now":c<60?`${c}m ago`:o<24?`${o}h ago`:e.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}function O(t){return t==null?"unknown":t<=5?"low":t<=10?"medium":"high"}function p(t){let e=document.createElement("div");return e.textContent=t,e.innerHTML}function F(){return`
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
        `}function pt(t,e){let a=document.querySelector(`.segment-card[data-segment-id="${t}"]`);if(!a)return;let n=a.querySelector(".diff-btn"),i=a.querySelector(".code-diff-section"),c=f.find(o=>o.id===t);!n||!i||!c||(n.dataset.diffActive=e,e?(n.classList.add("active"),n.title="Show current code"):(n.classList.remove("active"),n.title="Toggle diff view"),e?ft(i,c):ut(i,c))}function ut(t,e){let n=(e.code||"").split(`
`),i=e.startLine||1,c=n.map((o,l)=>`<div class="code-line"><span class="code-line-gutter">${i+l}</span><span class="code-line-content">${p(o)||" "}</span></div>`).join("");t.innerHTML=`
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
                    ${c||'<div class="code-view-empty">No code content</div>'}
                </div>
            </div>
        `}function ft(t,e){if(!e.metadata?.beforeCode){t.innerHTML=`
                <div class="diff-view">
                    <div class="diff-error">
                        <span class="codicon codicon-info"></span>
                        <span>No previous version available for comparison</span>
                    </div>
                </div>
            `;return}let a=e.metadata.beforeCode,n=e.code||"",i=a.split(`
`),c=n.split(`
`),o=0,l=0,r=[],v=e.startLine||1,g=e.startLine||1,x=Math.max(i.length,c.length),b=0;for(;b<x;){let y=b<i.length?i[b]:null,S=b<c.length?c[b]:null;if(y===null)o++,r.push(`<div class="diff-line added"><span class="diff-gutter-indicator">+</span><span class="diff-line-num old"></span><span class="diff-line-num new">${g}</span><span class="diff-content">${p(S)||" "}</span></div>`),g++,b++;else if(S===null)l++,r.push(`<div class="diff-line removed"><span class="diff-gutter-indicator">\u2212</span><span class="diff-line-num old">${v}</span><span class="diff-line-num new"></span><span class="diff-content">${p(y)||" "}</span></div>`),v++,b++;else if(y!==S){let L=[],C=[],$=b;for(;$<x;){let k=$<i.length?i[$]:null,E=$<c.length?c[$]:null;if(k===E||k===null||E===null)break;L.push({line:k,num:v+($-b)}),C.push({line:E,num:g+($-b)}),$++}L.length>0?(L.forEach((k,E)=>{l++,r.push(`<div class="diff-line removed"><span class="diff-gutter-indicator">\u2212</span><span class="diff-line-num old">${v+E}</span><span class="diff-line-num new"></span><span class="diff-content">${p(k.line)||" "}</span></div>`)}),C.forEach((k,E)=>{o++,r.push(`<div class="diff-line added"><span class="diff-gutter-indicator">+</span><span class="diff-line-num old"></span><span class="diff-line-num new">${g+E}</span><span class="diff-content">${p(k.line)||" "}</span></div>`)}),v+=L.length,g+=C.length,b=$):(l++,o++,r.push(`<div class="diff-line removed"><span class="diff-gutter-indicator">\u2212</span><span class="diff-line-num old">${v}</span><span class="diff-line-num new"></span><span class="diff-content">${p(y)||" "}</span></div>`),r.push(`<div class="diff-line added"><span class="diff-gutter-indicator">+</span><span class="diff-line-num old"></span><span class="diff-line-num new">${g}</span><span class="diff-content">${p(S)||" "}</span></div>`),v++,g++,b++)}else r.push(`<div class="diff-line context"><span class="diff-gutter-indicator"></span><span class="diff-line-num old">${v}</span><span class="diff-line-num new">${g}</span><span class="diff-content">${p(S)||" "}</span></div>`),v++,g++,b++}t.innerHTML=`
            <div class="diff-view">
                <div class="diff-view-header">
                    <div class="diff-view-title">
                        <span class="codicon codicon-diff"></span>
                        <span class="diff-view-label">Changes</span>
                    </div>
                    <div class="diff-stats">
                        <span class="diff-stat-add">+${o}</span>
                        <span class="diff-stat-remove">\u2212${l}</span>
                    </div>
                </div>
                <div class="diff-view-content">
                    ${r.join("")}
                </div>
            </div>
        `}function mt(t){if(!t)return"";if(typeof marked>"u")return console.warn("marked.js not loaded yet, returning plain text"),p(t);try{return marked.setOptions({breaks:!0,gfm:!0,headerIds:!1,mangle:!1}),marked.parse(t)}catch(e){return console.error("Error rendering markdown:",e),p(t)}}function V(t,e,a){let n=document.querySelector(`.explanation-section[data-segment-id="${t}"]`);n&&(e==="loading"?a?(n.className="explanation-section loading",n.innerHTML=`
                    <div class="explanation-loading">
                        <div class="loading-spinner"></div>
                        <span>Generating explanation...</span>
                    </div>
                `):n.classList.contains("has-content")||(n.innerHTML="",n.className="explanation-section"):e==="error"&&(n.className="explanation-section error",n.innerHTML=`
                <div class="explanation-error">
                    <span class="codicon codicon-error"></span>
                    <div class="explanation-error-content">
                        <div class="explanation-error-message">${p(a||"Unknown error")}</div>
                        <div class="explanation-actions">
                            <button class="regenerate-btn" data-segment-id="${t}">
                                <span class="codicon codicon-refresh"></span>
                                <span>Retry</span>
                            </button>
                        </div>
                    </div>
                </div>
            `))}function vt(t,e){let a=document.querySelector(`.explanation-section[data-segment-id="${t}"]`);if(!a)return;a.className="explanation-section has-content",a.innerHTML=`
            <div class="explanation-header" data-segment-id="${t}">
                <div class="explanation-label">
                    <span class="codicon codicon-lightbulb"></span>
                    <span>AI Explanation</span>
                </div>
                <div class="explanation-toggle">
                    <button class="regenerate-btn" data-segment-id="${t}">
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
                    ${mt(e)}
                </div>
            </div>
        `;let n=f.find(function(i){return i.id===t});n&&(n.metadata||(n.metadata={}),n.metadata.explanation=e)}document.addEventListener("click",function(t){let e=t.target;!e.closest(".context-menu-btn")&&!e.closest(".context-menu")&&document.querySelectorAll(".context-menu").forEach(d=>{d.style.display="none"});let a=e.closest(".sort-button");if(a){let s=a.dataset.sort;s&&(t.preventDefault(),rt(s));return}let n=e.closest(".file-group-header");if(n){let s=n.dataset.sessionKey||n.dataset.filePath;s&&(t.preventDefault(),Y(s));return}let i=e.closest(".segment-title"),c=e.closest(".segment-subtitle");if(i||c){let s=e.closest("[data-segment-id]");if(s){t.preventDefault(),t.stopPropagation();let d=s.dataset.segmentId,m=f.find(u=>u.id===d);m&&et(d,m.startLine)}return}let o=e.closest('.segment-header[data-clickable="true"]');if(o&&!e.closest("button")&&!e.closest(".segment-title")&&!e.closest(".segment-subtitle")){let s=o.closest("[data-segment-id]");if(s){t.preventDefault();let d=s.dataset.segmentId;T(d)}return}let l=e.closest(".expand-btn");if(l){let s=l.closest("[data-segment-id]")?.dataset.segmentId;s&&(t.preventDefault(),t.stopPropagation(),T(s));return}let r=e.closest(".add-context-btn");if(r){let s=r.closest(".context-section");if(s){t.preventDefault();let d=s.querySelector(".add-context-btn"),m=s.querySelector(".context-input-wrapper");if(d&&m){d.style.display="none",m.classList.add("visible");let u=m.querySelector(".context-input");u&&setTimeout(()=>u.focus(),100)}}return}let v=e.closest(".cancel-add-context-btn");if(v){let s=v.closest(".context-section");if(s){t.preventDefault();let d=s.querySelector(".add-context-btn"),m=s.querySelector(".context-input-wrapper");if(d&&m){d.style.display="",m.classList.remove("visible");let u=m.querySelector(".context-input");u&&(u.value="")}}return}let g=e.closest(".save-context-btn");if(g){let s=g.closest(".context-section");if(s){let d=s.dataset.segmentId,m=s.querySelector(".context-input");m&&d&&(t.preventDefault(),_(d,m.value))}return}let x=e.closest(".edit-context-btn");if(x){let s=x.closest(".context-section");if(s){let d=s.dataset.segmentId,m=f.find(u=>u.id===d);if(m){t.preventDefault(),s.classList.remove("has-content"),s.innerHTML=`
                        <div class="context-header">
                            <div class="context-label">Context</div>
                        </div>
                        <div class="context-input-wrapper visible">
                            <textarea
                                class="context-input"
                                placeholder="What does this code do? Why is it important?"
                                data-segment-id="${d}">${m.metadata?.context||""}</textarea>
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
                    `;let u=s.querySelector(".context-input");u&&setTimeout(()=>u.focus(),100)}}return}let b=e.closest(".cancel-context-btn");if(b){let s=b.closest(".context-section");if(s){t.preventDefault();let d=s.dataset.segmentId,m=f.find(u=>u.id===d);if(m&&m.metadata?.context)s.classList.add("has-content"),s.innerHTML=`
                        <div class="context-display-wrapper">
                            <div class="context-display">${p(m.metadata.context)}</div>
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
                    `;else{s.style.display="none";let u=s.querySelector(".context-input-wrapper");if(u){u.classList.remove("visible");let I=u.querySelector(".context-input");I&&(I.value="")}}}return}let y=e.closest(".context-menu-btn");if(y){t.preventDefault();let s=y.nextElementSibling;if(s&&s.classList.contains("context-menu")){let d=s.style.display!=="none";s.style.display=d?"none":"block"}return}let S=e.closest(".edit-context-menu-btn");if(S){let s=S.closest(".context-section");if(s){t.preventDefault();let d=s.dataset.segmentId,m=f.find(bt=>bt.id===d),u=s.querySelector(".context-menu");u&&(u.style.display="none");let I=m?.metadata?.context||"";s.classList.remove("has-content"),s.innerHTML=`
                    <div class="context-input-wrapper visible">
                        <textarea class="context-input" placeholder="Add context about this code segment...">${p(I)}</textarea>
                        <div class="context-actions">
                            <button class="vk-button cancel-context-btn">Cancel</button>
                            <button class="vk-button vk-button--primary save-context-btn">Save</button>
                        </div>
                    </div>
                `;let M=s.querySelector(".context-input");M&&setTimeout(()=>M.focus(),100)}return}let L=e.closest(".remove-segment-btn");if(L){let s=L.closest(".context-section");if(s){let d=s.dataset.segmentId;if(d){t.preventDefault();let m=s.querySelector(".context-menu");m&&(m.style.display="none");let u=f.find(M=>M.id===d);u&&u.metadata&&(u.metadata.context=""),_(d,""),s.classList.remove("has-content"),s.innerHTML=`
                        <div class="context-input-wrapper">
                            <textarea class="context-input" placeholder="Add context about this code segment..."></textarea>
                            <div class="context-actions">
                                <button class="vk-button vk-button--primary save-context-btn">Save</button>
                                <button class="vk-button cancel-context-btn">Cancel</button>
                            </div>
                        </div>
                    `;let I=document.querySelector(`.segment-card[data-segment-id="${d}"]`);if(I){let M=I.querySelector(".context-indicator-btn");M&&M.remove()}}}return}let C=e.closest(".explain-btn");if(C){let s=C.closest("[data-segment-id]");if(s){t.preventDefault();let d=s.dataset.segmentId;s.classList.contains("expanded")||T(d),j(d)}return}let $=e.closest(".note-btn");if($){let s=$.closest("[data-segment-id]");if(s){t.preventDefault();let d=s.dataset.segmentId,m=f.find(u=>u.id===d);s.classList.contains("expanded")||T(d),setTimeout(()=>{let u=s.querySelector(".context-section");if(u){if(m&&m.metadata?.context)u.classList.remove("has-content"),u.innerHTML=`
                                <div class="context-input-wrapper visible">
                                    <textarea class="context-input" placeholder="Add context about this code segment...">${p(m.metadata.context)}</textarea>
                                    <div class="context-actions">
                                        <button class="vk-button vk-button--primary save-context-btn">Save</button>
                                        <button class="vk-button cancel-context-btn">Cancel</button>
                                    </div>
                                </div>
                            `;else{u.style.display="block";let M=u.querySelector(".context-input-wrapper");M&&M.classList.add("visible")}let I=u.querySelector(".context-input");I&&setTimeout(()=>I.focus(),100)}},150)}return}let k=e.closest(".reviewed-btn");if(k){let s=k.closest("[data-segment-id]");if(s){t.preventDefault();let d=s.dataset.segmentId;G(d)}return}let E=e.closest(".star-btn");if(E){let s=E.closest("[data-segment-id]");if(s){t.preventDefault();let d=s.dataset.segmentId;U(d)}return}let D=e.closest(".footer-star-btn");if(D){let s=D.closest("[data-segment-id]");if(s){t.preventDefault();let d=s.dataset.segmentId;ct(d)}return}let z=e.closest(".dismiss-btn");if(z){let s=z.closest("[data-segment-id]");if(s){t.preventDefault();let d=s.dataset.segmentId;G(d)}return}let H=e.closest(".regenerate-btn");if(H&&H.dataset.segmentId){t.preventDefault(),t.stopPropagation(),j(H.dataset.segmentId);return}let J=e.closest(".explanation-header");if(J){let s=J.closest(".explanation-section");if(s&&s.classList.contains("has-content")){t.preventDefault(),s.classList.toggle("collapsed");let d=s.querySelector(".collapse-icon .codicon");d&&(s.classList.contains("collapsed")?d.className="codicon codicon-add":d.className="codicon codicon-remove")}return}let R=e.closest(".diff-btn");if(R){t.preventDefault();let s=R.closest("[data-segment-id]");if(s){let d=s.dataset.segmentId,m=R.dataset.diffActive==="true";pt(d,!m)}return}if(e.closest(".bulk-remove-btn")){t.preventDefault(),st();return}if(e.closest(".confirm-bulk-remove-btn")){t.preventDefault(),at();return}if(e.closest(".cancel-bulk-remove-btn")){t.preventDefault(),ot();return}}),w.postMessage({command:"refresh"})})();})();
