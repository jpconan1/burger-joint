let editorData = { groups: [] };
let selectedGroupIndex = -1;
let currentMode = 'json';

const listEl = document.getElementById('group-list');
const editorEl = document.getElementById('json-editor');
const formEl = document.getElementById('form-editor');
const titleEl = document.getElementById('group-title');
const statusBar = document.getElementById('status-bar');

async function init() {
    try {
        const res = await fetch('/items.json');
        editorData = await res.json();
        renderSidebar();
    } catch (e) {
        showStatus('Error loading items.json: ' + e.message, true);
    }
}

function renderSidebar() {
    listEl.innerHTML = '';
    editorData.groups.forEach((group, index) => {
        const li = document.createElement('li');
        li.className = `group-item ${index === selectedGroupIndex ? 'active' : ''}`;

        // Create content wrapper for click handling
        const content = document.createElement('div');
        content.style.flex = '1';
        content.style.display = 'flex';
        content.style.justifyContent = 'space-between';
        content.style.alignItems = 'center';
        content.innerHTML = `
            <span>${group.id}</span>
            <span class="group-type">${group.type}</span>
        `;
        content.onclick = () => selectGroup(index);

        // Actions container
        const actions = document.createElement('div');
        actions.style.display = 'flex';
        actions.style.alignItems = 'center';

        // Clone button
        const cloneBtn = document.createElement('button');
        cloneBtn.className = 'clone-group-btn';
        cloneBtn.innerHTML = '📋';
        cloneBtn.title = 'Clone Group';
        cloneBtn.onclick = (e) => {
            e.stopPropagation();
            cloneGroup(index);
        };

        // Delete button
        const delBtn = document.createElement('button');
        delBtn.className = 'delete-group-btn';
        delBtn.innerHTML = '&times;';
        delBtn.title = 'Delete Group';
        delBtn.onclick = (e) => {
            e.stopPropagation();
            deleteGroup(index);
        };

        actions.appendChild(cloneBtn);
        actions.appendChild(delBtn);

        li.appendChild(content);
        li.appendChild(actions);

        listEl.appendChild(li);
    });
}

function deleteGroup(index) {
    if (!confirm('Are you sure you want to delete this group?')) return;

    editorData.groups.splice(index, 1);

    if (selectedGroupIndex === index) {
        selectedGroupIndex = -1;
        titleEl.textContent = 'Select a Group';
        editorEl.value = '';
        formEl.innerHTML = '';
        currentMode = 'json'; // Reset to JSON view on delete to be safe
    } else if (selectedGroupIndex > index) {
        selectedGroupIndex--;
    }
    renderSidebar();
}

function cloneGroup(index) {
    const group = editorData.groups[index];
    // Deep clone
    const newGroup = JSON.parse(JSON.stringify(group));

    // Modify ID to ensure uniqueness
    const oldId = newGroup.id;
    let newId = oldId + "_copy";

    // Simple collision check (could be robustified, but usually enough)
    let counter = 1;
    while (editorData.groups.some(g => g.id === newId)) {
        newId = oldId + "_copy" + counter;
        counter++;
    }

    newGroup.id = newId;

    // Update inner IDs if they matched the old ID (common convention in this data)
    // E.g. if old ID was "tomato", box id might be "tomato_box".
    // We try to replace the base ID in sub-properties if safe.
    // NOTE: This assumes a naming convention. If not strict, we might just leave them 
    // and let the user fix it. But helping them is nice.
    const replaceIdRecursive = (obj) => {
        for (const key in obj) {
            if (typeof obj[key] === 'string') {
                if (obj[key].includes(oldId)) {
                    obj[key] = obj[key].replace(oldId, newId);
                }
            } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                replaceIdRecursive(obj[key]);
            }
        }
    };

    replaceIdRecursive(newGroup);
    // Restore the main ID in case the recursive replace messed it up or didn't hit it (it's top level)
    newGroup.id = newId;

    editorData.groups.push(newGroup);
    selectGroup(editorData.groups.length - 1);

    showStatus('Group cloned!');
}

function switchMode(mode) {
    if (mode === currentMode) return;

    if (mode === 'form') {
        // Validate JSON before switching
        try {
            const json = JSON.parse(editorEl.value);
            editorData.groups[selectedGroupIndex] = json;
            renderForm();
        } catch (e) {
            showStatus('Cannot switch to form: Invalid JSON', true);
            return;
        }
    } else {
        // Switch to JSON
        editorEl.value = JSON.stringify(editorData.groups[selectedGroupIndex], null, 4);
    }

    currentMode = mode;

    // Toggle UI
    document.getElementById('tab-json').className = `tab ${mode === 'json' ? 'active' : ''}`;
    document.getElementById('tab-form').className = `tab ${mode === 'form' ? 'active' : ''}`;

    editorEl.style.display = mode === 'json' ? 'block' : 'none';
    formEl.style.display = mode === 'form' ? 'block' : 'none';
}

function renderForm() {
    formEl.innerHTML = '';
    const group = editorData.groups[selectedGroupIndex];
    if (!group) return;

    const buildFields = (obj, container, isRoot = false) => {
        Object.entries(obj).forEach(([key, value]) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'form-group';

            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                // Nested Object
                const fieldset = document.createElement('fieldset');
                fieldset.className = 'form-fieldset';
                fieldset.innerHTML = `<legend class="form-legend">${key}</legend>`;
                buildFields(value, fieldset, false);
                container.appendChild(fieldset);
            } else {
                // Primitive or Array
                const label = document.createElement('label');
                label.className = 'form-label';
                label.textContent = key;
                wrapper.appendChild(label);

                const input = document.createElement(Array.isArray(value) ? 'textarea' : 'input');
                input.className = 'form-control';

                if (typeof value === 'number') {
                    input.type = 'number';
                    input.value = value;
                    input.oninput = (e) => obj[key] = parseFloat(e.target.value);
                } else if (typeof value === 'boolean') {
                    input.type = 'checkbox';
                    input.checked = value;
                    // Reset styling for checkbox
                    input.style.width = 'auto';
                    input.onchange = (e) => obj[key] = e.target.checked;
                } else if (Array.isArray(value)) {
                    input.value = JSON.stringify(value);
                    input.placeholder = "Array (JSON format): [1, 2, \"a\"]";
                    input.onchange = (e) => {
                        try {
                            obj[key] = JSON.parse(e.target.value);
                            input.style.borderColor = '';
                        } catch (err) {
                            input.style.borderColor = 'red';
                        }
                    };
                } else {
                    input.type = 'text';
                    input.value = value || '';
                    input.oninput = (e) => obj[key] = e.target.value;
                }

                if (isRoot && key === 'id') {
                    // Wrap in flex container for the button
                    const inputGroup = document.createElement('div');
                    inputGroup.style.display = 'flex';
                    inputGroup.style.gap = '5px';

                    input.style.flex = '1';

                    const propBtn = document.createElement('button');
                    propBtn.className = 'btn';
                    propBtn.style.padding = '4px 8px';
                    propBtn.style.fontSize = '11px';
                    propBtn.innerHTML = '⚡ Propagate ID';
                    propBtn.title = 'Smartly update all other fields to match this new ID';
                    propBtn.onclick = () => propagateId();

                    inputGroup.appendChild(input);
                    inputGroup.appendChild(propBtn);
                    wrapper.appendChild(inputGroup);
                } else {
                    wrapper.appendChild(input);
                }

                container.appendChild(wrapper);
            }
        });

        // Container for property buttons
        const btnContainer = document.createElement('div');
        btnContainer.style.marginTop = '10px';
        btnContainer.style.display = 'flex';
        btnContainer.style.gap = '10px';

        // Add Property Button
        const addBtn = document.createElement('button');
        addBtn.className = 'btn secondary';
        addBtn.style.fontSize = '12px';
        addBtn.textContent = '+ Add Property';
        addBtn.onclick = () => {
            const key = prompt('Enter property name:');
            if (key && !obj.hasOwnProperty(key)) {
                if (key === 'orderConfig') {
                    obj[key] = {
                        type: "topping",
                        value: 2.0,
                        capability: "CUT_TOPPINGS"
                    };
                } else {
                    obj[key] = "";
                }
                renderForm();
            }
        };

        // Remove Property Button
        const remBtn = document.createElement('button');
        remBtn.className = 'btn secondary';
        remBtn.style.fontSize = '12px';
        remBtn.style.backgroundColor = '#4a4a4f'; // Slightly different/warning color intent, but keeping consistent style
        remBtn.textContent = '- Remove Property';
        remBtn.onclick = () => {
            const key = prompt('Enter property name to delete:');
            if (key) {
                if (obj.hasOwnProperty(key)) {
                    delete obj[key];
                    renderForm();
                } else {
                    alert(`Property "${key}" not found in this object.`);
                }
            }
        };

        btnContainer.appendChild(addBtn);
        btnContainer.appendChild(remBtn);
        container.appendChild(btnContainer);
    };

    buildFields(group, formEl, true);
}

function propagateId() {
    const group = editorData.groups[selectedGroupIndex];
    if (!group) return;

    const currentId = group.id;
    let oldId = null;

    // Try to guess the old ID
    // 1. Check item.id
    if (group.item && typeof group.item.id === 'string' && group.item.id !== currentId) {
        oldId = group.item.id;
    }
    // 2. Check box.produces
    else if (group.box && typeof group.box.produces === 'string' && group.box.produces !== currentId) {
        oldId = group.box.produces;
    }

    // 3. Fallback: Ask user
    if (!oldId) {
        oldId = prompt(`Could not auto-detect old ID. Enter the text pattern you want to replace with "${currentId}":`);
        if (!oldId) return; // User cancelled
    } else {
        // Validation with user
        if (!confirm(`Found probable old ID: "${oldId}".\n\nAre you sure you want to replace all occurrences of "${oldId}" with "${currentId}" in this group?`)) {
            return;
        }
    }

    if (oldId === currentId) {
        alert("Old ID is identical to Current ID. No changes needed.");
        return;
    }

    // Do the replacement
    let changeCount = 0;
    const replaceRecursive = (obj) => {
        for (const key in obj) {
            if (key === 'id' && obj === group) continue; // Skip the top-level ID we just set

            if (typeof obj[key] === 'string') {
                if (obj[key].includes(oldId)) {
                    // Use global replacement
                    const newVal = obj[key].split(oldId).join(currentId);
                    if (newVal !== obj[key]) {
                        obj[key] = newVal;
                        changeCount++;
                    }
                }
            } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                replaceRecursive(obj[key]);
            }
        }
    };

    replaceRecursive(group);

    // Re-render to show changes
    renderForm();
    showStatus(`Success! Propagated ID. Updated ${changeCount} fields.`);
}

function selectGroup(index) {
    selectedGroupIndex = index;
    renderSidebar();

    const group = editorData.groups[index];
    titleEl.textContent = `${group.id} (${group.type})`;

    if (currentMode === 'json') {
        editorEl.value = JSON.stringify(group, null, 4);
        editorEl.classList.remove('invalid');
    } else {
        renderForm();
    }
}

function addNewGroup() {
    const id = "new_item_" + Date.now().toString().slice(-4);
    const newGroup = {
        id: id,
        type: "supply_chain",
        box: {
            id: id + "_box",
            maxCount: 10,
            price: 10,
            produces: id
        },
        item: {
            id: id,
            category: "ingredient",
            texture: "texture.png",
            partTexture: "texture-part.png",
            nudge: 0,
            toolRequirement: "HANDS",
            orderConfig: {
                type: "topping",
                value: 2.0,
                capability: "CUT_TOPPINGS"
            }
        },
        spoilage: {
            id: id + "_old",
            texture: "texture-old.png"
        }
    };
    editorData.groups.push(newGroup);
    selectGroup(editorData.groups.length - 1);

    // Auto-switch to form for convenience
    if (currentMode !== 'form') {
        switchMode('form');
    }
}

// Editor interaction
editorEl.addEventListener('input', () => {
    try {
        const json = JSON.parse(editorEl.value);
        editorEl.classList.remove('invalid');

        // Update model
        editorData.groups[selectedGroupIndex] = json;

        // Update UI if ID changed
        const currentId = listEl.children[selectedGroupIndex].querySelector('span').textContent;
        if (json.id !== currentId) {
            renderSidebar();
        }
    } catch (e) {
        editorEl.classList.add('invalid');
    }
});

// Enable Tab indentation
editorEl.addEventListener('keydown', function (e) {
    if (e.key === 'Tab') {
        e.preventDefault();
        const start = this.selectionStart;
        const end = this.selectionEnd;

        // set textarea value to: text before caret + tab + text after caret
        this.value = this.value.substring(0, start) +
            "    " + this.value.substring(end);

        // put caret at right position again
        this.selectionStart = this.selectionEnd = start + 4;
    }
});

async function saveAll() {
    // Re-validate current editor content before saving to be sure
    try {
        JSON.parse(editorEl.value);
    } catch (e) {
        showStatus('Fix invalid JSON before saving!', true);
        return;
    }

    try {
        const res = await fetch('/save', {
            method: 'POST',
            body: JSON.stringify(editorData)
        });
        const result = await res.json();

        if (result.success) {
            showStatus('Items saved successfully!');
        } else {
            showStatus('Error saving: ' + (result.error || 'Unknown'), true);
        }
    } catch (e) {
        showStatus('Network error saving data.', true);
    }
}

function showStatus(msg, isError = false) {
    statusBar.textContent = msg;
    statusBar.style.backgroundColor = isError ? '#e51400' : '#007acc';
    statusBar.classList.add('visible');
    setTimeout(() => {
        statusBar.classList.remove('visible');
    }, 3000);
}

// Start
init();
