"use strict";(()=>{(function(){let p=acquireVsCodeApi(),r=[],f=[],L="line",b=[],H=null;window.addEventListener("message",e=>{let t=e.data;switch(t.command){case"updateSegments":r=t.segments,b=t.files||[],H=t.currentFile||null,y(),R();break;case"showFileList":A(t.files);break;case"explanationLoading":w(t.segmentId,"loading",t.loading);break;case"updateExplanation":Y(t.segmentId,t.explanation);break;case"explanationError":w(t.segmentId,"error",t.error);break;case"contextSaved":W(t.segmentId,t.context);break;case"highlightSegment":O(t.segmentId);break}});function y(){let e=document.getElementById("segments-list"),t=document.getElementById("segment-count"),o=document.querySelector(".sort-controls");o&&(o.style.display="flex");let a=document.querySelector(".bulk-remove-btn");if(a&&(a.style.display=r&&r.length>0?"flex":"none"),!r||r.length===0){e.innerHTML=`
                <div class="empty-state">
                    <div class="codicon codicon-inbox"></div>
                    <p>No segments detected yet.</p>
                    <p style="margin-top: 8px; font-size: 12px;">Segments will appear here as you work.</p>
                </div>
            `,t.textContent="No segments";return}t.textContent=`${r.length} segment${r.length!==1?"s":""}`,f=K([...r],L),e.innerHTML=f.map(s=>{let i=U(s.complexity),v=s.endLine-s.startLine+1,m=V(s),g=s.metadata?.isStarred||!1;return`
            <div class="segment-card" data-segment-id="${s.id}" data-complexity="${i}">
                <div class="segment-header" data-clickable="true">
                    <div class="segment-header-left">
                        <div class="segment-title-wrapper">
                            <span class="segment-title">${u(s.name)}</span>
                            <span class="segment-subtitle">
                                ${u(s.lineRange||"")}
                                ${m?'<span class="new-badge">NEW</span>':""}
                            </span>
                        </div>
                    </div>
                    <div class="segment-header-actions">
                        ${s.metadata?.context?`
                        <button
                            class="vk-icon-button context-indicator-btn"
                            title="Has context note"
                            disabled>
                            <span class="codicon codicon-note"></span>
                        </button>
                        `:""}
                        <button
                            class="vk-icon-button star-btn ${g?"starred":""}"
                            title="Star for later"
                            data-starred="${g}">
                            <span class="codicon codicon-star-${g?"full":"empty"}"></span>
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
                        <span class="metadata-badge complexity-badge-${i}">
                            <span class="codicon codicon-pulse"></span>
                            <span>${s.complexity!==null?s.complexity:"N/A"}</span>
                        </span>
                        <span class="metadata-badge">
                            <span class="codicon codicon-file-code"></span>
                            <span>${v} lines</span>
                        </span>
                        <span class="metadata-badge" title="${u(s.filePath)}">
                            <span class="codicon codicon-folder"></span>
                            <span>${u(s.fileName)}</span>
                        </span>
                    </div>

                    <!-- Explanation section -->
                    <div class="explanation-section" data-segment-id="${s.id}">
                        <!-- This will be populated dynamically by JS -->
                    </div>

                    <!-- Context section (shows saved context or hidden input) -->
                    <div class="context-section ${s.metadata?.context?"has-content":""}" data-segment-id="${s.id}">
                        ${s.metadata?.context?`
                            <div class="context-display">${u(s.metadata.context)}</div>
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
            `}).join("")}function h(e){let t=document.querySelector(`.segment-card[data-segment-id="${e}"]`);if(!t)return;let o=t.querySelector(".expand-btn");t.classList.contains("expanded")?(t.classList.remove("expanded"),o&&(o.dataset.expanded="false",o.title="Expand segment")):(document.querySelectorAll(".segment-card.expanded").forEach(s=>{if(s!==t){s.classList.remove("expanded");let i=s.querySelector(".expand-btn");i&&(i.dataset.expanded="false",i.title="Expand segment")}}),t.classList.add("expanded"),o&&(o.dataset.expanded="true",o.title="Collapse segment"))}function A(e){let t=document.getElementById("segments-list"),o=document.getElementById("segment-count");if(!e||e.length===0){t.innerHTML=`
                <div class="empty-state">
                    <div class="codicon codicon-inbox"></div>
                    <p>No segments detected yet.</p>
                    <p style="margin-top: 8px; font-size: 12px;">Segments will appear here as you work.</p>
                </div>
            `,o.textContent="No segments";return}o.textContent=`${e.length} file${e.length!==1?"s":""} with segments`;let a=document.querySelector(".sort-controls");a&&(a.style.display="none");let s=e.map((i,v)=>{let m=document.createElement("div");return m.className="file-list-item",m.dataset.fileIndex=v,m.innerHTML=`
                <div class="file-list-item-icon">
                    <span class="codicon codicon-file-code"></span>
                </div>
                <div class="file-list-item-content">
                    <div class="file-list-item-title">${u(i.fileName)}</div>
                    <div class="file-list-item-subtitle">${i.segmentCount} segment${i.segmentCount!==1?"s":""}</div>
                </div>
                <div class="file-list-item-action">
                    <span class="codicon codicon-chevron-right"></span>
                </div>
            `,m._filePath=i.filePath,m.addEventListener("click",function(g){g.stopPropagation(),console.log("File list item clicked:",this._filePath),p.postMessage({command:"openFile",filePath:this._filePath})}),m});t.innerHTML=`
            <div class="file-list-header">
                <div class="codicon codicon-info"></div>
                <p>No segments in current file. Click a file below to view its segments:</p>
            </div>
        `,s.forEach(i=>t.appendChild(i))}function R(){let e=document.getElementById("file-selector-container"),t=document.getElementById("file-selector");if(!b||b.length===0){e&&(e.style.display="none");return}if(e&&(e.style.display="block"),t){t.innerHTML=b.map(a=>{let s=a.isActive?"selected":"";return`<option value="${u(a.filePath)}" ${s}>
                    ${u(a.fileName)} (${a.segmentCount})
                </option>`}).join("");let o=t.cloneNode(!0);t.parentNode.replaceChild(o,t),o.addEventListener("change",a=>{let s=a.target.value;s&&p.postMessage({command:"openFile",filePath:s})})}}function F(e,t){p.postMessage({command:"goToCode",segmentId:e,line:t})}function j(e,t){p.postMessage({command:"saveContext",segmentId:e,context:t})}function W(e,t){let o=r.find(s=>s.id===e);o&&(o.metadata||(o.metadata={}),o.metadata.context=t);let a=document.querySelector(`.segment-card[data-segment-id="${e}"]`);if(a){let s=a.querySelector(".context-section");s&&(s.classList.add("has-content"),s.innerHTML=`
                    <div class="context-display">${u(t)}</div>
                `)}}function k(e){p.postMessage({command:"explainSegment",segmentId:e})}function $(e){let t=f.findIndex(a=>a.id===e),o=document.querySelector(`.segment-card[data-segment-id="${e}"]`);o&&(o.classList.add("dismissing"),setTimeout(()=>{o.remove(),r=r.filter(s=>s.id!==e),f=f.filter(s=>s.id!==e);let a=document.getElementById("segment-count");if(a&&(a.textContent=r.length===0?"No segments":`${r.length} segment${r.length!==1?"s":""}`),p.postMessage({command:"dismissSegment",segmentId:e}),f.length>0){let s=t>=f.length?0:t,i=f[s];i&&p.postMessage({command:"goToSegment",segmentId:i.id,startLine:i.startLine,endLine:i.endLine,filePath:i.filePath})}},300))}function _(){let e=document.querySelector(".bulk-remove-confirm");e&&(e.style.display="flex",setTimeout(()=>{e.style.display==="flex"&&(e.style.display="none")},1e4))}function z(){let e=r.map(a=>a.id),t=document.querySelector(".bulk-remove-confirm");t&&(t.style.display="none"),document.querySelectorAll(".segment-card").forEach(a=>a.classList.add("dismissing")),setTimeout(()=>{r=[],f=[];let a=document.getElementById("segment-count");a&&(a.textContent="No segments");let s=document.querySelector(".bulk-remove-btn");s&&(s.style.display="none"),y(),p.postMessage({command:"bulkRemoveSegments",segmentIds:e})},300)}function G(){let e=document.querySelector(".bulk-remove-confirm");e&&(e.style.display="none")}function J(e){let t=r.find(s=>s.id===e);if(!t)return;let o=!t.metadata?.isStarred;t.metadata||(t.metadata={}),t.metadata.isStarred=o;let a=document.querySelector(`.segment-card[data-segment-id="${e}"]`);if(a){let s=a.querySelector(".star-btn"),i=s?.querySelector(".codicon");s&&i&&(s.dataset.starred=o,o?(s.classList.add("starred"),i.className="codicon codicon-star-full"):(s.classList.remove("starred"),i.className="codicon codicon-star-empty"))}p.postMessage({command:"toggleStar",segmentId:e,isStarred:o})}function O(e){if(document.querySelectorAll(".segment-card").forEach(t=>{t.classList.remove("selected")}),e){let t=document.querySelector(`.segment-card[data-segment-id="${e}"]`);t&&t.classList.add("selected")}}function V(e){if(!e.metadata?.detectedAt)return!1;let t=new Date(e.metadata.detectedAt).getTime(),o=Date.now(),a=300*1e3;return o-t<a}function K(e,t){return e.sort((o,a)=>{let s=o.metadata?.isStarred||!1,i=a.metadata?.isStarred||!1;if(s!==i)return i?1:-1;if(t==="line")return o.filePath!==a.filePath?o.filePath.localeCompare(a.filePath):o.startLine-a.startLine;if(t==="complexity"){let v=o.complexity!==null?o.complexity:-1;return(a.complexity!==null?a.complexity:-1)-v}return 0})}function Q(e){L=e,document.querySelectorAll(".sort-button").forEach(t=>{t.dataset.sort===e?t.classList.add("active"):t.classList.remove("active")}),y()}function U(e){return e==null?"unknown":e<=5?"low":e<=10?"medium":"high"}function u(e){let t=document.createElement("div");return t.textContent=e,t.innerHTML}function X(e){if(!e)return"";if(typeof marked>"u")return console.warn("marked.js not loaded yet, returning plain text"),u(e);try{return marked.setOptions({breaks:!0,gfm:!0,headerIds:!1,mangle:!1}),marked.parse(e)}catch(t){return console.error("Error rendering markdown:",t),u(e)}}function w(e,t,o){let a=document.querySelector(`.explanation-section[data-segment-id="${e}"]`);a&&(t==="loading"?o?(a.className="explanation-section loading",a.innerHTML=`
                    <div class="explanation-loading">
                        <div class="loading-spinner"></div>
                        <span>Generating explanation...</span>
                    </div>
                `):a.classList.contains("has-content")||(a.innerHTML="",a.className="explanation-section"):t==="error"&&(a.className="explanation-section error",a.innerHTML=`
                <div class="explanation-error">
                    <span class="codicon codicon-warning"></span>
                    <div>
                        <div>${u(o)}</div>
                        <div class="explanation-actions">
                            <button class="regenerate-btn" data-segment-id="${e}">
                                <span class="codicon codicon-refresh"></span>
                                <span>Retry</span>
                            </button>
                        </div>
                    </div>
                </div>
            `))}function Y(e,t){let o=document.querySelector(`.explanation-section[data-segment-id="${e}"]`);if(!o)return;o.className="explanation-section has-content",o.innerHTML=`
            <div class="explanation-header" data-segment-id="${e}">
                <div class="explanation-label">
                    <span class="codicon codicon-lightbulb"></span>
                    <span>AI Explanation</span>
                </div>
                <div class="explanation-toggle">
                    <button class="regenerate-btn" data-segment-id="${e}">
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
                    ${X(t)}
                </div>
            </div>
        `;let a=r.find(function(s){return s.id===e});a&&(a.metadata||(a.metadata={}),a.metadata.explanation=t)}document.addEventListener("click",function(e){let t=e.target,o=t.closest(".sort-button");if(o){let n=o.dataset.sort;n&&(e.preventDefault(),Q(n));return}let a=t.closest(".segment-title"),s=t.closest(".segment-subtitle");if(a||s){let n=t.closest("[data-segment-id]");if(n){e.preventDefault(),e.stopPropagation();let c=n.dataset.segmentId,l=r.find(d=>d.id===c);l&&F(c,l.startLine)}return}let i=t.closest('.segment-header[data-clickable="true"]');if(i&&!t.closest("button")&&!t.closest(".segment-title")&&!t.closest(".segment-subtitle")){let n=i.closest("[data-segment-id]");if(n){e.preventDefault();let c=n.dataset.segmentId;h(c)}return}let v=t.closest(".expand-btn");if(v){let n=v.closest("[data-segment-id]")?.dataset.segmentId;n&&(e.preventDefault(),e.stopPropagation(),h(n));return}let m=t.closest(".add-context-btn");if(m){let n=m.closest(".context-section");if(n){e.preventDefault();let c=n.querySelector(".add-context-btn"),l=n.querySelector(".context-input-wrapper");if(c&&l){c.style.display="none",l.classList.add("visible");let d=l.querySelector(".context-input");d&&setTimeout(()=>d.focus(),100)}}return}let g=t.closest(".cancel-add-context-btn");if(g){let n=g.closest(".context-section");if(n){e.preventDefault();let c=n.querySelector(".add-context-btn"),l=n.querySelector(".context-input-wrapper");if(c&&l){c.style.display="",l.classList.remove("visible");let d=l.querySelector(".context-input");d&&(d.value="")}}return}let E=t.closest(".save-context-btn");if(E){let n=E.closest(".context-section");if(n){let c=n.dataset.segmentId,l=n.querySelector(".context-input");l&&c&&(e.preventDefault(),j(c,l.value))}return}let q=t.closest(".edit-context-btn");if(q){let n=q.closest(".context-section");if(n){let c=n.dataset.segmentId,l=r.find(d=>d.id===c);if(l){e.preventDefault(),n.classList.remove("has-content"),n.innerHTML=`
                        <div class="context-header">
                            <div class="context-label">Context</div>
                        </div>
                        <div class="context-input-wrapper visible">
                            <textarea
                                class="context-input"
                                placeholder="What does this code do? Why is it important?"
                                data-segment-id="${c}">${l.metadata?.context||""}</textarea>
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
                    `;let d=n.querySelector(".context-input");d&&setTimeout(()=>d.focus(),100)}}return}let C=t.closest(".cancel-context-btn");if(C){let n=C.closest(".context-section");if(n){e.preventDefault();let c=n.dataset.segmentId,l=r.find(d=>d.id===c);if(l&&l.metadata?.context)n.classList.add("has-content"),n.innerHTML=`
                        <div class="context-display">${u(l.metadata.context)}</div>
                    `;else{n.style.display="none";let d=n.querySelector(".context-input-wrapper");if(d){d.classList.remove("visible");let x=d.querySelector(".context-input");x&&(x.value="")}}}return}let I=t.closest(".explain-btn");if(I){let n=I.closest("[data-segment-id]");n&&(e.preventDefault(),k(n.dataset.segmentId));return}let B=t.closest(".note-btn");if(B){let n=B.closest("[data-segment-id]");if(n){e.preventDefault();let c=n.dataset.segmentId,l=r.find(d=>d.id===c);n.classList.contains("expanded")||h(c),setTimeout(()=>{let d=n.querySelector(".context-section");if(d){if(l&&l.metadata?.context)d.classList.remove("has-content"),d.innerHTML=`
                                <div class="context-input-wrapper visible">
                                    <textarea class="context-input" placeholder="Add context about this code segment...">${u(l.metadata.context)}</textarea>
                                    <div class="context-actions">
                                        <button class="vk-button vk-button--primary save-context-btn">Save</button>
                                        <button class="vk-button cancel-context-btn">Cancel</button>
                                    </div>
                                </div>
                            `;else{d.style.display="block";let P=d.querySelector(".context-input-wrapper");P&&P.classList.add("visible")}let x=d.querySelector(".context-input");x&&setTimeout(()=>x.focus(),100)}},150)}return}let M=t.closest(".reviewed-btn");if(M){let n=M.closest("[data-segment-id]");if(n){e.preventDefault();let c=n.dataset.segmentId;$(c)}return}let T=t.closest(".star-btn");if(T){let n=T.closest("[data-segment-id]");if(n){e.preventDefault();let c=n.dataset.segmentId;J(c)}return}let N=t.closest(".dismiss-btn");if(N){let n=N.closest("[data-segment-id]");if(n){e.preventDefault();let c=n.dataset.segmentId;$(c)}return}let S=t.closest(".regenerate-btn");if(S&&S.dataset.segmentId){e.preventDefault(),e.stopPropagation(),k(S.dataset.segmentId);return}let D=t.closest(".explanation-header");if(D){let n=D.closest(".explanation-section");if(n&&n.classList.contains("has-content")){e.preventDefault(),n.classList.toggle("collapsed");let c=n.querySelector(".collapse-icon .codicon");c&&(n.classList.contains("collapsed")?c.className="codicon codicon-add":c.className="codicon codicon-remove")}return}if(t.closest(".bulk-remove-btn")){e.preventDefault(),_();return}if(t.closest(".confirm-bulk-remove-btn")){e.preventDefault(),z();return}if(t.closest(".cancel-bulk-remove-btn")){e.preventDefault(),G();return}}),p.postMessage({command:"refresh"})})();})();
