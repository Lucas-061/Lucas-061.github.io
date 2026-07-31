(function () {
    const storageKey = 'lucas-map-notes-image-v1';
    const mapStorageKey = 'lucas-map-library-v1';
    const activeMapStorageKey = 'lucas-active-map-v1';
    const legacyKeys = ['lucas-map-notes-v2', 'lucas-map-notes-v1'];
    const builtinMap = {
        id: 'fuzhou',
        name: '福州',
        src: 'static/map/fuzhou.jpeg',
        builtin: true
    };
    const defaultNote = {
        id: 'sample-note',
        mapId: builtinMap.id,
        x: 54,
        y: 39,
        title: 'Example note',
        body: '# 福州地图笔记\n\n点击地图可以添加标记点。每个点都可以写 Markdown 文章，也可以直接粘贴图片。后续添加城市地图时可以上传 PNG、JPG 或 SVG。',
        updatedAt: Date.now()
    };

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function loadNotes() {
        try {
            const raw = localStorage.getItem(storageKey) || legacyKeys.map(key => localStorage.getItem(key)).find(Boolean);
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) && parsed.length ? parsed.map(normalizeNote) : [defaultNote];
        } catch {
            return [defaultNote];
        }
    }

    function loadMaps() {
        try {
            const parsed = JSON.parse(localStorage.getItem(mapStorageKey));
            const customMaps = Array.isArray(parsed) ? parsed.map(normalizeMap).filter(Boolean) : [];
            return [builtinMap].concat(customMaps.filter(map => map.id !== builtinMap.id));
        } catch {
            return [builtinMap];
        }
    }

    function normalizeMap(map) {
        if (!map || typeof map !== 'object' || !map.name || !map.src) return null;
        return {
            id: map.id || `map-${Date.now()}-${Math.round(Math.random() * 1000)}`,
            name: String(map.name).trim() || 'Untitled',
            src: map.src,
            builtin: Boolean(map.builtin)
        };
    }

    function saveCustomMaps(maps) {
        localStorage.setItem(mapStorageKey, JSON.stringify(maps.filter(map => !map.builtin)));
    }

    function normalizeNote(note, index) {
        const lngX = Number.isFinite(note.lng) ? ((note.lng + 180) / 360) * 100 : 50;
        const latY = Number.isFinite(note.lat) ? ((85 - note.lat) / 170) * 100 : 50;
        return {
            id: note.id || `note-${Date.now()}-${index}`,
            mapId: note.mapId || builtinMap.id,
            x: Number.isFinite(note.x) ? clamp(note.x, 0, 100) : clamp(lngX, 0, 100),
            y: Number.isFinite(note.y) ? clamp(note.y, 0, 100) : clamp(latY, 0, 100),
            title: note.title || 'Untitled note',
            body: note.body || '',
            updatedAt: note.updatedAt || Date.now()
        };
    }

    function saveNotes(notes) {
        localStorage.setItem(storageKey, JSON.stringify(notes));
    }

    function formatCoordinate(note) {
        return `${note.x.toFixed(2)}%, ${note.y.toFixed(2)}%`;
    }

    function insertText(textarea, value) {
        const start = textarea.selectionStart || 0;
        const end = textarea.selectionEnd || 0;
        textarea.value = textarea.value.slice(0, start) + value + textarea.value.slice(end);
        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd = start + value.length;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }

    window.addEventListener('DOMContentLoaded', () => {
        const root = document.querySelector('[data-map-notes]');
        if (!root) return;

        const map = root.querySelector('[data-map]');
        const mapCanvas = root.querySelector('[data-map-canvas]');
        const mapImage = root.querySelector('[data-map-image]');
        const mapTabs = root.querySelector('[data-map-tabs]');
        const mapForm = root.querySelector('[data-map-form]');
        const mapNameInput = root.querySelector('[data-map-name]');
        const mapFileInput = root.querySelector('[data-map-file]');
        const markerLayer = root.querySelector('[data-markers]');
        const list = root.querySelector('[data-list]');
        const empty = root.querySelector('[data-empty]');
        const form = root.querySelector('[data-form]');
        const titleInput = root.querySelector('[data-title]');
        const bodyInput = root.querySelector('[data-body]');
        const coordinates = root.querySelector('[data-coordinates]');
        const preview = root.querySelector('[data-preview]');
        const saveState = root.querySelector('[data-save-state]');
        const importInput = root.querySelector('[data-action="import"]');

        let maps = loadMaps();
        let activeMapId = localStorage.getItem(activeMapStorageKey) || builtinMap.id;
        let notes = loadNotes();
        if (!maps.some(mapItem => mapItem.id === activeMapId)) activeMapId = builtinMap.id;
        let activeId = notes.find(note => note.mapId === activeMapId)?.id || null;
        let previewMode = false;
        let mapScale = 1;
        let mapPanX = 0;
        let mapPanY = 0;
        let dragStart = null;
        let suppressNextClick = false;

        function activeNote() {
            return notes.find(note => note.id === activeId && note.mapId === activeMapId);
        }

        function activeMap() {
            return maps.find(mapItem => mapItem.id === activeMapId) || builtinMap;
        }

        function currentNotes() {
            return notes.filter(note => note.mapId === activeMapId);
        }

        function persist(message) {
            saveNotes(notes);
            saveState.textContent = message || 'Saved locally';
        }

        function renderMapTabs() {
            mapTabs.innerHTML = '';
            maps.forEach(mapItem => {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = `map-city-tab${mapItem.id === activeMapId ? ' active' : ''}`;
                button.textContent = mapItem.name;
                button.addEventListener('click', () => {
                    activeMapId = mapItem.id;
                    localStorage.setItem(activeMapStorageKey, activeMapId);
                    activeId = currentNotes()[0]?.id || null;
                    previewMode = false;
                    resetMapView();
                    render();
                });
                mapTabs.appendChild(button);
            });
        }

        function renderMapImage() {
            const selectedMap = activeMap();
            mapImage.src = selectedMap.src;
            mapImage.alt = `${selectedMap.name} offline map`;
            map.setAttribute('aria-label', `${selectedMap.name} offline map image for choosing note points`);
        }

        function clampMapPan() {
            const rect = map.getBoundingClientRect();
            const minX = rect.width - rect.width * mapScale;
            const minY = rect.height - rect.height * mapScale;
            mapPanX = mapScale === 1 ? 0 : clamp(mapPanX, minX, 0);
            mapPanY = mapScale === 1 ? 0 : clamp(mapPanY, minY, 0);
        }

        function applyMapTransform() {
            clampMapPan();
            mapCanvas.style.transform = `translate(${mapPanX}px, ${mapPanY}px) scale(${mapScale})`;
            map.dataset.zoom = `${Math.round(mapScale * 100)}%`;
        }

        function zoomMap(nextScale, originX, originY) {
            const rect = map.getBoundingClientRect();
            const oldScale = mapScale;
            mapScale = clamp(nextScale, 1, 5);
            const localX = originX == null ? rect.width / 2 : originX;
            const localY = originY == null ? rect.height / 2 : originY;
            mapPanX = localX - ((localX - mapPanX) / oldScale) * mapScale;
            mapPanY = localY - ((localY - mapPanY) / oldScale) * mapScale;
            applyMapTransform();
        }

        function resetMapView() {
            mapScale = 1;
            mapPanX = 0;
            mapPanY = 0;
            applyMapTransform();
        }

        function getMapPoint(event) {
            const rect = map.getBoundingClientRect();
            const x = ((event.clientX - rect.left - mapPanX) / mapScale / rect.width) * 100;
            const y = ((event.clientY - rect.top - mapPanY) / mapScale / rect.height) * 100;
            return { x: clamp(x, 0, 100), y: clamp(y, 0, 100) };
        }

        function renderMarkers() {
            markerLayer.innerHTML = '';
            currentNotes().forEach(note => {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = `map-note-marker${note.id === activeId ? ' active' : ''}`;
                button.style.left = `${note.x}%`;
                button.style.top = `${note.y}%`;
                button.title = note.title || 'Untitled note';
                button.innerHTML = '<i class="bi bi-geo-alt-fill"></i>';
                button.addEventListener('click', event => {
                    event.stopPropagation();
                    activeId = note.id;
                    previewMode = false;
                    render();
                });
                markerLayer.appendChild(button);
            });
        }

        function renderList() {
            list.innerHTML = '';
            currentNotes()
                .slice()
                .sort((a, b) => b.updatedAt - a.updatedAt)
                .forEach(note => {
                    const button = document.createElement('button');
                    button.type = 'button';
                    button.className = `map-note-list-item${note.id === activeId ? ' active' : ''}`;
                    button.innerHTML = `<strong>${note.title || 'Untitled note'}</strong><span>${formatCoordinate(note)}</span>`;
                    button.addEventListener('click', () => {
                        activeId = note.id;
                        previewMode = false;
                        render();
                    });
                    list.appendChild(button);
                });
        }

        function renderEditor() {
            const note = activeNote();
            empty.hidden = Boolean(note);
            form.hidden = !note;
            if (!note) return;

            titleInput.value = note.title || '';
            bodyInput.value = note.body || '';
            coordinates.textContent = formatCoordinate(note);
            preview.hidden = !previewMode;
            bodyInput.hidden = previewMode;
            if (previewMode) {
                preview.innerHTML = marked.parse(note.body || '');
                if (window.MathJax && MathJax.typeset) MathJax.typeset([preview]);
            }
        }

        function render() {
            renderMapTabs();
            renderMapImage();
            renderMarkers();
            renderList();
            renderEditor();
        }

        function createNote(x, y) {
            const id = `note-${Date.now()}-${Math.round(Math.random() * 1000)}`;
            const note = {
                id,
                mapId: activeMapId,
                x: clamp(x, 0, 100),
                y: clamp(y, 0, 100),
                title: 'New place note',
                body: '# New place note\n\n',
                updatedAt: Date.now()
            };
            notes.push(note);
            activeId = id;
            previewMode = false;
            persist('New point saved');
            render();
        }

        map.addEventListener('click', event => {
            if (suppressNextClick) {
                suppressNextClick = false;
                return;
            }
            const point = getMapPoint(event);
            createNote(point.x, point.y);
        });

        map.addEventListener('wheel', event => {
            event.preventDefault();
            const rect = map.getBoundingClientRect();
            const delta = event.deltaY < 0 ? 0.3 : -0.3;
            zoomMap(mapScale + delta, event.clientX - rect.left, event.clientY - rect.top);
        }, { passive: false });

        map.addEventListener('pointerdown', event => {
            if (event.target.closest('.map-note-marker')) return;
            map.setPointerCapture(event.pointerId);
            dragStart = {
                pointerId: event.pointerId,
                clientX: event.clientX,
                clientY: event.clientY,
                panX: mapPanX,
                panY: mapPanY,
                moved: false
            };
        });

        map.addEventListener('pointermove', event => {
            if (!dragStart || dragStart.pointerId !== event.pointerId) return;
            const dx = event.clientX - dragStart.clientX;
            const dy = event.clientY - dragStart.clientY;
            if (Math.abs(dx) + Math.abs(dy) > 4) dragStart.moved = true;
            if (!dragStart.moved) return;
            mapPanX = dragStart.panX + dx;
            mapPanY = dragStart.panY + dy;
            applyMapTransform();
        });

        map.addEventListener('pointerup', event => {
            if (!dragStart || dragStart.pointerId !== event.pointerId) return;
            suppressNextClick = dragStart.moved;
            dragStart = null;
        });

        map.addEventListener('pointercancel', () => {
            dragStart = null;
        });

        window.addEventListener('resize', applyMapTransform);

        titleInput.addEventListener('input', () => {
            const note = activeNote();
            if (!note) return;
            note.title = titleInput.value;
            note.updatedAt = Date.now();
            persist('Title saved');
            renderMarkers();
            renderList();
        });

        bodyInput.addEventListener('input', () => {
            const note = activeNote();
            if (!note) return;
            note.body = bodyInput.value;
            note.updatedAt = Date.now();
            persist('Article saved');
            renderList();
        });

        bodyInput.addEventListener('paste', event => {
            const files = Array.from(event.clipboardData.files || []).filter(file => file.type.startsWith('image/'));
            if (!files.length) return;
            event.preventDefault();
            files.forEach(file => {
                const reader = new FileReader();
                reader.onload = () => insertText(bodyInput, `\n![${file.name || 'pasted image'}](${reader.result})\n`);
                reader.readAsDataURL(file);
            });
        });

        root.addEventListener('click', event => {
            const action = event.target.closest('[data-action]')?.dataset.action;
            if (!action || action === 'import') return;

            if (action === 'add-map') {
                mapForm.hidden = false;
                mapNameInput.focus();
            }

            if (action === 'cancel-map') {
                mapForm.hidden = true;
                mapNameInput.value = '';
                mapFileInput.value = '';
            }

            if (action === 'save-map') {
                const name = mapNameInput.value.trim();
                const file = mapFileInput.files[0];
                if (!name || !file) {
                    saveState.textContent = 'City name and image required';
                    return;
                }
                const reader = new FileReader();
                reader.onload = () => {
                    const mapItem = {
                        id: `map-${Date.now()}-${Math.round(Math.random() * 1000)}`,
                        name,
                        src: reader.result,
                        builtin: false
                    };
                    maps.push(mapItem);
                    saveCustomMaps(maps);
                    activeMapId = mapItem.id;
                    localStorage.setItem(activeMapStorageKey, activeMapId);
                    activeId = null;
                    mapForm.hidden = true;
                    mapNameInput.value = '';
                    mapFileInput.value = '';
                    resetMapView();
                    render();
                    saveState.textContent = `${name} map added`;
                };
                reader.readAsDataURL(file);
            }

            if (action === 'new') {
                createNote(50, 50);
            }

            if (action === 'zoom-in') {
                zoomMap(mapScale + 0.5);
            }

            if (action === 'zoom-out') {
                zoomMap(mapScale - 0.5);
            }

            if (action === 'zoom-reset') {
                resetMapView();
            }

            if (action === 'delete') {
                notes = notes.filter(note => note.id !== activeId);
                activeId = notes[0] ? notes[0].id : null;
                previewMode = false;
                persist('Point deleted');
                render();
            }

            if (action === 'preview') {
                previewMode = true;
                renderEditor();
            }

            if (action === 'edit') {
                previewMode = false;
                renderEditor();
            }

            if (action === 'export') {
                const blob = new Blob([JSON.stringify(notes, null, 2)], { type: 'application/json' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = 'map-notes.json';
                link.click();
                URL.revokeObjectURL(link.href);
            }
        });

        importInput.addEventListener('change', () => {
            const file = importInput.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                try {
                    const imported = JSON.parse(reader.result);
                    if (!Array.isArray(imported)) throw new Error('Invalid notes');
                    notes = imported
                        .filter(note => note && typeof note === 'object')
                        .map(normalizeNote);
                    activeId = currentNotes()[0]?.id || null;
                    previewMode = false;
                    persist('Imported');
                    render();
                } catch {
                    saveState.textContent = 'Import failed';
                }
                importInput.value = '';
            };
            reader.readAsText(file);
        });

        applyMapTransform();
        render();
    });
})();
