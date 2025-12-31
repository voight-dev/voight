"use strict";(()=>{(function(){let v=acquireVsCodeApi(),l=[],m=[],$="line",y=[],W=null;window.addEventListener("message",e=>{let t=e.data;switch(t.command){case"updateSegments":l=t.segments,y=t.files||[],W=t.currentFile||null,h(),z();break;case"showFileList":_(t.files);break;case"explanationLoading":C(t.segmentId,"loading",t.loading);break;case"updateExplanation":nt(t.segmentId,t.explanation);break;case"explanationError":C(t.segmentId,"error",t.error);break;case"contextSaved":G(t.segmentId,t.context);break;case"highlightSegment":U(t.segmentId);break}});function h(){let e=document.getElementById("segments-list"),t=document.getElementById("segment-count"),a=document.querySelector(".sort-controls");a&&(a.style.display="flex");let o=document.querySelector(".bulk-remove-btn");if(o&&(o.style.display=l&&l.length>0?"flex":"none"),l==null){e.innerHTML=`
                <div class="skeleton-loader">
                    ${k()}
                    ${k()}
                    ${k()}
                </div>
            `,t.textContent="Loading...";return}if(l.length===0){e.innerHTML=`
                <div class="empty-state">
                    <div class="codicon codicon-inbox"></div>
                    <p>No segments detected yet.</p>
                    <p style="margin-top: 8px; font-size: 12px;">Segments will appear here as you work.</p>
                </div>
            `,t.textContent="No segments";return}t.textContent=`${l.length} segment${l.length!==1?"s":""}`,m=Y([...l],$),e.innerHTML=m.map(s=>{let c=tt(s.complexity),f=s.endLine-s.startLine+1,u=X(s),b=s.metadata?.isStarred||!1;return`
            <div class="segment-card" data-segment-id="${s.id}" data-complexity="${c}">
                <div class="segment-header" data-clickable="true">
                    <div class="segment-header-left">
                        <div class="segment-title-wrapper">
                            <span class="segment-title">${p(s.name)}</span>
                            <span class="segment-subtitle">
                                ${p(s.lineRange||"")}
                                ${u?'<span class="new-badge">NEW</span>':""}
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
                            class="vk-icon-button star-btn ${b?"starred":""}"
                            title="Star for later"
                            data-starred="${b}">
                            <span class="codicon codicon-star-${b?"full":"empty"}"></span>
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
                        <span class="metadata-badge complexity-badge-${c}">
                            <span class="codicon codicon-pulse"></span>
                            <span>${s.complexity!==null?s.complexity:"N/A"}</span>
                        </span>
                        <span class="metadata-badge">
                            <span class="codicon codicon-file-code"></span>
                            <span>${f} lines</span>
                        </span>
                        <span class="metadata-badge" title="${p(s.filePath)}">
                            <span class="codicon codicon-folder"></span>
                            <span>${p(s.fileName)}</span>
                        </span>
                    </div>

                    <!-- Explanation section -->
                    <div class="explanation-section" data-segment-id="${s.id}">
                        <!-- This will be populated dynamically by JS -->
                    </div>

                    <!-- Context section (shows saved context or hidden input) -->
                    <div class="context-section ${s.metadata?.context?"has-content":""}" data-segment-id="${s.id}">
                        ${s.metadata?.context?`
                            <div class="context-display-wrapper">
                                <div class="context-display">${p(s.metadata.context)}</div>
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
            `}).join("")}function S(e){let t=document.querySelector(`.segment-card[data-segment-id="${e}"]`);if(!t)return;let a=t.querySelector(".expand-btn");t.classList.contains("expanded")?(t.classList.remove("expanded"),a&&(a.dataset.expanded="false",a.title="Expand segment")):(document.querySelectorAll(".segment-card.expanded").forEach(s=>{if(s!==t){s.classList.remove("expanded");let c=s.querySelector(".expand-btn");c&&(c.dataset.expanded="false",c.title="Expand segment")}}),t.classList.add("expanded"),a&&(a.dataset.expanded="true",a.title="Collapse segment"))}function _(e){let t=document.getElementById("segments-list"),a=document.getElementById("segment-count");if(!e||e.length===0){t.innerHTML=`
                <div class="empty-state">
                    <div class="codicon codicon-inbox"></div>
                    <p>No segments detected yet.</p>
                    <p style="margin-top: 8px; font-size: 12px;">Segments will appear here as you work.</p>
                </div>
            `,a.textContent="No segments";return}a.textContent=`${e.length} file${e.length!==1?"s":""} with segments`;let o=document.querySelector(".sort-controls");o&&(o.style.display="none");let s=e.map((c,f)=>{let u=document.createElement("div");return u.className="file-list-item",u.dataset.fileIndex=f,u.innerHTML=`
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
            `,u._filePath=c.filePath,u.addEventListener("click",function(b){b.stopPropagation(),console.log("File list item clicked:",this._filePath),v.postMessage({command:"openFile",filePath:this._filePath})}),u});t.innerHTML=`
            <div class="file-list-header">
                <div class="codicon codicon-info"></div>
                <p>No segments in current file. Click a file below to view its segments:</p>
            </div>
        `,s.forEach(c=>t.appendChild(c))}function z(){let e=document.getElementById("file-selector-container"),t=document.getElementById("file-selector");if(!y||y.length===0){e&&(e.style.display="none");return}if(e&&(e.style.display="block"),t){t.innerHTML=y.map(o=>{let s=o.isActive?"selected":"";return`<option value="${p(o.filePath)}" ${s}>
                    ${p(o.fileName)} (${o.segmentCount})
                </option>`}).join("");let a=t.cloneNode(!0);t.parentNode.replaceChild(a,t),a.addEventListener("change",o=>{let s=o.target.value;s&&v.postMessage({command:"openFile",filePath:s})})}}function V(e,t){v.postMessage({command:"goToCode",segmentId:e,line:t})}function E(e,t){v.postMessage({command:"saveContext",segmentId:e,context:t})}function G(e,t){let a=l.find(s=>s.id===e);a&&(a.metadata||(a.metadata={}),a.metadata.context=t);let o=document.querySelector(`.segment-card[data-segment-id="${e}"]`);if(o){let s=o.querySelector(".context-section");if(s)if(t&&t.trim().length>0){s.classList.add("has-content"),s.innerHTML=`
                        <div class="context-display-wrapper">
                            <div class="context-display">${p(t)}</div>
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
                    `;let c=o.querySelector(".segment-header-actions");if(c&&!c.querySelector(".context-indicator-btn")){let f=c.querySelector(".star-btn");if(f){let u=document.createElement("button");u.className="vk-icon-button context-indicator-btn",u.title="Has context note",u.disabled=!0,u.innerHTML='<span class="codicon codicon-note"></span>',c.insertBefore(u,f)}}}else{s.classList.remove("has-content"),s.innerHTML=`
                        <div class="context-input-wrapper">
                            <textarea class="context-input" placeholder="Add context about this code segment..."></textarea>
                            <div class="context-actions">
                                <button class="vk-button vk-button--primary save-context-btn">Save</button>
                                <button class="vk-button cancel-context-btn">Cancel</button>
                            </div>
                        </div>
                    `;let c=o.querySelector(".context-indicator-btn");c&&c.remove()}}}function q(e){v.postMessage({command:"explainSegment",segmentId:e})}function w(e){let t=m.findIndex(o=>o.id===e),a=document.querySelector(`.segment-card[data-segment-id="${e}"]`);a&&(a.classList.add("dismissing"),setTimeout(()=>{a.remove(),l=l.filter(s=>s.id!==e),m=m.filter(s=>s.id!==e);let o=document.getElementById("segment-count");if(o&&(o.textContent=l.length===0?"No segments":`${l.length} segment${l.length!==1?"s":""}`),v.postMessage({command:"dismissSegment",segmentId:e}),m.length>0){let s=t>=m.length?0:t,c=m[s];c&&v.postMessage({command:"goToSegment",segmentId:c.id,startLine:c.startLine,endLine:c.endLine,filePath:c.filePath})}},250))}function ot(e){let t=m.findIndex(o=>o.id===e),a=document.querySelector(`.segment-card[data-segment-id="${e}"]`);a&&(a.classList.add("dismissing"),setTimeout(()=>{a.remove(),l=l.filter(s=>s.id!==e),m=m.filter(s=>s.id!==e);let o=document.getElementById("segment-count");if(o&&(o.textContent=l.length===0?"No segments":`${l.length} segment${l.length!==1?"s":""}`),v.postMessage({command:"removeSegment",segmentId:e}),m.length>0){let s=t>=m.length?0:t,c=m[s];c&&v.postMessage({command:"goToSegment",segmentId:c.id,startLine:c.startLine,endLine:c.endLine,filePath:c.filePath})}},300))}function J(){let e=document.querySelector(".bulk-remove-confirm");e&&(e.style.display="flex",setTimeout(()=>{e.style.display==="flex"&&(e.style.display="none")},1e4))}function O(){let e=l.map(o=>o.id),t=document.querySelector(".bulk-remove-confirm");t&&(t.style.display="none"),document.querySelectorAll(".segment-card").forEach(o=>o.classList.add("dismissing")),setTimeout(()=>{l=[],m=[];let o=document.getElementById("segment-count");o&&(o.textContent="No segments");let s=document.querySelector(".bulk-remove-btn");s&&(s.style.display="none"),h(),v.postMessage({command:"bulkRemoveSegments",segmentIds:e})},300)}function K(){let e=document.querySelector(".bulk-remove-confirm");e&&(e.style.display="none")}function Q(e){let t=l.find(s=>s.id===e);if(!t)return;let a=!t.metadata?.isStarred;t.metadata||(t.metadata={}),t.metadata.isStarred=a;let o=document.querySelector(`.segment-card[data-segment-id="${e}"]`);if(o){let s=o.querySelector(".star-btn"),c=s?.querySelector(".codicon");s&&c&&(s.dataset.starred=a,a?(s.classList.add("starred"),c.className="codicon codicon-star-full"):(s.classList.remove("starred"),c.className="codicon codicon-star-empty"))}v.postMessage({command:"toggleStar",segmentId:e,isStarred:a})}function U(e){if(document.querySelectorAll(".segment-card").forEach(t=>{t.classList.remove("selected")}),e){let t=document.querySelector(`.segment-card[data-segment-id="${e}"]`);t&&t.classList.add("selected")}}function X(e){if(!e.metadata?.detectedAt)return!1;let t=new Date(e.metadata.detectedAt).getTime(),a=Date.now(),o=300*1e3;return a-t<o}function Y(e,t){return e.sort((a,o)=>{let s=a.metadata?.isStarred||!1,c=o.metadata?.isStarred||!1;if(s!==c)return c?1:-1;if(t==="line")return a.filePath!==o.filePath?a.filePath.localeCompare(o.filePath):a.startLine-o.startLine;if(t==="complexity"){let f=a.complexity!==null?a.complexity:-1;return(o.complexity!==null?o.complexity:-1)-f}return 0})}function Z(e){$=e,document.querySelectorAll(".sort-button").forEach(t=>{t.dataset.sort===e?t.classList.add("active"):t.classList.remove("active")}),h()}function tt(e){return e==null?"unknown":e<=5?"low":e<=10?"medium":"high"}function p(e){let t=document.createElement("div");return t.textContent=e,t.innerHTML}function k(){return`
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
        `}function et(e){if(!e)return"";if(typeof marked>"u")return console.warn("marked.js not loaded yet, returning plain text"),p(e);try{return marked.setOptions({breaks:!0,gfm:!0,headerIds:!1,mangle:!1}),marked.parse(e)}catch(t){return console.error("Error rendering markdown:",t),p(e)}}function C(e,t,a){let o=document.querySelector(`.explanation-section[data-segment-id="${e}"]`);o&&(t==="loading"?a?(o.className="explanation-section loading",o.innerHTML=`
                    <div class="explanation-loading">
                        <div class="loading-spinner"></div>
                        <span>Generating explanation...</span>
                    </div>
                `):o.classList.contains("has-content")||(o.innerHTML="",o.className="explanation-section"):t==="error"&&(o.className="explanation-section error",o.innerHTML=`
                <div class="explanation-error">
                    <span class="codicon codicon-warning"></span>
                    <div>
                        <div>${p(a)}</div>
                        <div class="explanation-actions">
                            <button class="regenerate-btn" data-segment-id="${e}">
                                <span class="codicon codicon-refresh"></span>
                                <span>Retry</span>
                            </button>
                        </div>
                    </div>
                </div>
            `))}function nt(e,t){let a=document.querySelector(`.explanation-section[data-segment-id="${e}"]`);if(!a)return;a.className="explanation-section has-content",a.innerHTML=`
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
                    ${et(t)}
                </div>
            </div>
        `;let o=l.find(function(s){return s.id===e});o&&(o.metadata||(o.metadata={}),o.metadata.explanation=t)}document.addEventListener("click",function(e){let t=e.target;!t.closest(".context-menu-btn")&&!t.closest(".context-menu")&&document.querySelectorAll(".context-menu").forEach(i=>{i.style.display="none"});let a=t.closest(".sort-button");if(a){let n=a.dataset.sort;n&&(e.preventDefault(),Z(n));return}let o=t.closest(".segment-title"),s=t.closest(".segment-subtitle");if(o||s){let n=t.closest("[data-segment-id]");if(n){e.preventDefault(),e.stopPropagation();let i=n.dataset.segmentId,r=l.find(d=>d.id===i);r&&V(i,r.startLine)}return}let c=t.closest('.segment-header[data-clickable="true"]');if(c&&!t.closest("button")&&!t.closest(".segment-title")&&!t.closest(".segment-subtitle")){let n=c.closest("[data-segment-id]");if(n){e.preventDefault();let i=n.dataset.segmentId;S(i)}return}let f=t.closest(".expand-btn");if(f){let n=f.closest("[data-segment-id]")?.dataset.segmentId;n&&(e.preventDefault(),e.stopPropagation(),S(n));return}let u=t.closest(".add-context-btn");if(u){let n=u.closest(".context-section");if(n){e.preventDefault();let i=n.querySelector(".add-context-btn"),r=n.querySelector(".context-input-wrapper");if(i&&r){i.style.display="none",r.classList.add("visible");let d=r.querySelector(".context-input");d&&setTimeout(()=>d.focus(),100)}}return}let b=t.closest(".cancel-add-context-btn");if(b){let n=b.closest(".context-section");if(n){e.preventDefault();let i=n.querySelector(".add-context-btn"),r=n.querySelector(".context-input-wrapper");if(i&&r){i.style.display="",r.classList.remove("visible");let d=r.querySelector(".context-input");d&&(d.value="")}}return}let I=t.closest(".save-context-btn");if(I){let n=I.closest(".context-section");if(n){let i=n.dataset.segmentId,r=n.querySelector(".context-input");r&&i&&(e.preventDefault(),E(i,r.value))}return}let B=t.closest(".edit-context-btn");if(B){let n=B.closest(".context-section");if(n){let i=n.dataset.segmentId,r=l.find(d=>d.id===i);if(r){e.preventDefault(),n.classList.remove("has-content"),n.innerHTML=`
                        <div class="context-header">
                            <div class="context-label">Context</div>
                        </div>
                        <div class="context-input-wrapper visible">
                            <textarea
                                class="context-input"
                                placeholder="What does this code do? Why is it important?"
                                data-segment-id="${i}">${r.metadata?.context||""}</textarea>
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
                    `;let d=n.querySelector(".context-input");d&&setTimeout(()=>d.focus(),100)}}return}let M=t.closest(".cancel-context-btn");if(M){let n=M.closest(".context-section");if(n){e.preventDefault();let i=n.dataset.segmentId,r=l.find(d=>d.id===i);if(r&&r.metadata?.context)n.classList.add("has-content"),n.innerHTML=`
                        <div class="context-display-wrapper">
                            <div class="context-display">${p(r.metadata.context)}</div>
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
                    `;else{n.style.display="none";let d=n.querySelector(".context-input-wrapper");if(d){d.classList.remove("visible");let x=d.querySelector(".context-input");x&&(x.value="")}}}return}let T=t.closest(".context-menu-btn");if(T){e.preventDefault();let n=T.nextElementSibling;if(n&&n.classList.contains("context-menu")){let i=n.style.display!=="none";n.style.display=i?"none":"block"}return}let N=t.closest(".edit-context-menu-btn");if(N){let n=N.closest(".context-section");if(n){e.preventDefault();let i=n.dataset.segmentId,r=l.find(st=>st.id===i),d=n.querySelector(".context-menu");d&&(d.style.display="none");let x=r?.metadata?.context||"";n.classList.remove("has-content"),n.innerHTML=`
                    <div class="context-input-wrapper visible">
                        <textarea class="context-input" placeholder="Add context about this code segment...">${p(x)}</textarea>
                        <div class="context-actions">
                            <button class="vk-button cancel-context-btn">Cancel</button>
                            <button class="vk-button vk-button--primary save-context-btn">Save</button>
                        </div>
                    </div>
                `;let g=n.querySelector(".context-input");g&&setTimeout(()=>g.focus(),100)}return}let D=t.closest(".remove-segment-btn");if(D){let n=D.closest(".context-section");if(n){let i=n.dataset.segmentId;if(i){e.preventDefault();let r=n.querySelector(".context-menu");r&&(r.style.display="none");let d=l.find(g=>g.id===i);d&&d.metadata&&(d.metadata.context=""),E(i,""),n.classList.remove("has-content"),n.innerHTML=`
                        <div class="context-input-wrapper">
                            <textarea class="context-input" placeholder="Add context about this code segment..."></textarea>
                            <div class="context-actions">
                                <button class="vk-button vk-button--primary save-context-btn">Save</button>
                                <button class="vk-button cancel-context-btn">Cancel</button>
                            </div>
                        </div>
                    `;let x=document.querySelector(`.segment-card[data-segment-id="${i}"]`);if(x){let g=x.querySelector(".context-indicator-btn");g&&g.remove()}}}return}let H=t.closest(".explain-btn");if(H){let n=H.closest("[data-segment-id]");n&&(e.preventDefault(),q(n.dataset.segmentId));return}let A=t.closest(".note-btn");if(A){let n=A.closest("[data-segment-id]");if(n){e.preventDefault();let i=n.dataset.segmentId,r=l.find(d=>d.id===i);n.classList.contains("expanded")||S(i),setTimeout(()=>{let d=n.querySelector(".context-section");if(d){if(r&&r.metadata?.context)d.classList.remove("has-content"),d.innerHTML=`
                                <div class="context-input-wrapper visible">
                                    <textarea class="context-input" placeholder="Add context about this code segment...">${p(r.metadata.context)}</textarea>
                                    <div class="context-actions">
                                        <button class="vk-button vk-button--primary save-context-btn">Save</button>
                                        <button class="vk-button cancel-context-btn">Cancel</button>
                                    </div>
                                </div>
                            `;else{d.style.display="block";let g=d.querySelector(".context-input-wrapper");g&&g.classList.add("visible")}let x=d.querySelector(".context-input");x&&setTimeout(()=>x.focus(),100)}},150)}return}let P=t.closest(".reviewed-btn");if(P){let n=P.closest("[data-segment-id]");if(n){e.preventDefault();let i=n.dataset.segmentId;w(i)}return}let R=t.closest(".star-btn");if(R){let n=R.closest("[data-segment-id]");if(n){e.preventDefault();let i=n.dataset.segmentId;Q(i)}return}let F=t.closest(".dismiss-btn");if(F){let n=F.closest("[data-segment-id]");if(n){e.preventDefault();let i=n.dataset.segmentId;w(i)}return}let L=t.closest(".regenerate-btn");if(L&&L.dataset.segmentId){e.preventDefault(),e.stopPropagation(),q(L.dataset.segmentId);return}let j=t.closest(".explanation-header");if(j){let n=j.closest(".explanation-section");if(n&&n.classList.contains("has-content")){e.preventDefault(),n.classList.toggle("collapsed");let i=n.querySelector(".collapse-icon .codicon");i&&(n.classList.contains("collapsed")?i.className="codicon codicon-add":i.className="codicon codicon-remove")}return}if(t.closest(".bulk-remove-btn")){e.preventDefault(),J();return}if(t.closest(".confirm-bulk-remove-btn")){e.preventDefault(),O();return}if(t.closest(".cancel-bulk-remove-btn")){e.preventDefault(),K();return}}),v.postMessage({command:"refresh"})})();})();
