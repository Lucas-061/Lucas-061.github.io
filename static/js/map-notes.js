(function () {
    const mapStorageKey = 'lucas-map-library-v1';
    const activeMapStorageKey = 'lucas-active-map-v1';
    const bundledMapsFile = 'static/data/maps/map-library.json';
    const bundledNotesFile = 'static/data/maps/map-notes.json';
    const builtinMap = {
        id: 'fuzhou',
        name: '福州',
        src: 'static/map/images/fuzhou.jpeg',
        builtin: true
    };

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    async function loadNotes() {
        try {
            const response = await fetch(bundledNotesFile);
            if (!response.ok) throw new Error('No bundled map notes');
            const parsed = await response.json();
            return Array.isArray(parsed) ? parsed.map(normalizeNote).filter(Boolean) : [];
        } catch {
            return [];
        }
    }

    async function loadMaps() {
        const bundledMaps = await loadBundledMaps();
        try {
            const parsed = JSON.parse(localStorage.getItem(mapStorageKey));
            const customMaps = Array.isArray(parsed) ? parsed.map(normalizeMap).filter(Boolean) : [];
            const customIds = new Set(customMaps.map(map => map.id));
            return bundledMaps
                .filter(map => !customIds.has(map.id))
                .concat(customMaps);
        } catch {
            return bundledMaps;
        }
    }

    async function loadBundledMaps() {
        try {
            const response = await fetch(bundledMapsFile);
            if (!response.ok) throw new Error('No bundled maps');
            const parsed = await response.json();
            const maps = Array.isArray(parsed) ? parsed.map(normalizeMap).filter(Boolean) : [];
            return maps.length ? maps : [builtinMap];
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

    function normalizeNote(note, index) {
        if (!note || typeof note !== 'object') return null;
        const lngX = Number.isFinite(note.lng) ? ((note.lng + 180) / 360) * 100 : 50;
        const latY = Number.isFinite(note.lat) ? ((85 - note.lat) / 170) * 100 : 50;
        return {
            id: note.id || `note-${Date.now()}-${index}`,
            mapId: note.mapId || builtinMap.id,
            x: Number.isFinite(note.x) ? clamp(note.x, 0, 100) : clamp(lngX, 0, 100),
            y: Number.isFinite(note.y) ? clamp(note.y, 0, 100) : clamp(latY, 0, 100),
            title: note.title || 'Untitled note',
            body: note.body || '',
            previewImage: note.previewImage || '',
            audioSrc: note.audioSrc || '',
            updatedAt: note.updatedAt || Date.now()
        };
    }

    function formatCoordinate(note) {
        return `${note.x.toFixed(2)}%, ${note.y.toFixed(2)}%`;
    }

    function findFirstMarkdownImage(body) {
        const match = String(body || '').match(/!\[[^\]]*]\(([^)]+)\)/);
        return match ? match[1].trim() : '';
    }

    function summarizeBody(body) {
        return String(body || '')
            .replace(/!\[[^\]]*]\([^)]+\)/g, '')
            .replace(/[#>*_`~\-[\]()]/g, '')
            .replace(/[ \t]+/g, ' ')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }

    window.addEventListener('DOMContentLoaded', async () => {
        const root = document.querySelector('[data-map-notes]');
        if (!root) return;

        const map = root.querySelector('[data-map]');
        const mapCanvas = root.querySelector('[data-map-canvas]');
        const mapImage = root.querySelector('[data-map-image]');
        const mapTabs = root.querySelector('[data-map-tabs]');
        const coordinatePicker = root.querySelector('[data-coordinate-picker]');
        const coordinateStatus = root.querySelector('[data-coordinate-status]');
        const coordinateOutput = root.querySelector('[data-coordinate-output]');
        const markerLayer = root.querySelector('[data-markers]');
        const list = root.querySelector('[data-list]');
        const popup = root.querySelector('[data-note-popup]');

        let maps = await loadMaps();
        const defaultMapId = maps[0]?.id || builtinMap.id;
        let activeMapId = localStorage.getItem(activeMapStorageKey) || defaultMapId;
        let notes = await loadNotes();
        if (!maps.some(mapItem => mapItem.id === activeMapId)) activeMapId = defaultMapId;
        localStorage.setItem(activeMapStorageKey, activeMapId);

        let activeId = null;
        let mapScale = 1;
        let mapPanX = 0;
        let mapPanY = 0;
        let dragStart = null;
        let suppressNextClick = false;
        let pickingPoint = false;
        let pickedPoint = null;
        let activeAudio = null;
        let activeAudioId = null;

        function activeMap() {
            return maps.find(mapItem => mapItem.id === activeMapId) || builtinMap;
        }

        function currentNotes() {
            return notes.filter(note => note.mapId === activeMapId);
        }

        function activeNote() {
            return currentNotes().find(note => note.id === activeId) || null;
        }

        function getPreviewImage(note) {
            return note.previewImage || findFirstMarkdownImage(note.body) || activeMap().src;
        }

        function stopAudio() {
            if (!activeAudio) return;
            activeAudio.pause();
            activeAudio.currentTime = 0;
            activeAudio = null;
            activeAudioId = null;
            renderList();
        }

        function toggleAudio(note) {
            if (!note.audioSrc) return;

            if (activeAudio && activeAudioId === note.id) {
                stopAudio();
                return;
            }

            if (activeAudio) {
                activeAudio.pause();
                activeAudio.currentTime = 0;
            }

            activeAudio = new Audio(note.audioSrc);
            activeAudioId = note.id;
            activeAudio.addEventListener('ended', () => {
                activeAudio = null;
                activeAudioId = null;
                renderList();
            });
            activeAudio.play().then(renderList).catch(() => {
                activeAudio = null;
                activeAudioId = null;
                renderList();
            });
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
                    activeId = null;
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
            map.setAttribute('aria-label', `${selectedMap.name} offline map image`);
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
            positionPopup();
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

        function formatPointForCode(point) {
            return `"x": ${point.x.toFixed(2)}, "y": ${point.y.toFixed(2)}`;
        }

        function setPickingPoint(enabled) {
            pickingPoint = enabled;
            if (enabled) {
                pickedPoint = null;
                activeId = null;
                popup.hidden = true;
                popup.replaceChildren();
                coordinatePicker.hidden = false;
                coordinateStatus.textContent = 'Click the map to choose a marker position.';
                coordinateOutput.textContent = '';
                map.classList.add('picking');
            } else {
                pickedPoint = null;
                coordinatePicker.hidden = true;
                coordinateOutput.textContent = '';
                map.classList.remove('picking');
            }
            render();
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
                    render();
                });
                markerLayer.appendChild(button);
            });

            if (pickedPoint) {
                const marker = document.createElement('div');
                marker.className = 'map-note-marker map-note-marker-draft active';
                marker.style.left = `${pickedPoint.x}%`;
                marker.style.top = `${pickedPoint.y}%`;
                marker.innerHTML = `<i class="bi bi-geo-alt-fill"></i><span class="map-draft-coordinate">${formatCoordinate(pickedPoint)}</span>`;
                markerLayer.appendChild(marker);
            }
        }

        function renderList() {
            list.innerHTML = '';
            currentNotes()
                .slice()
                .sort((a, b) => b.updatedAt - a.updatedAt)
                .forEach(note => {
                    const item = document.createElement('div');
                    item.className = `map-note-list-item${note.id === activeId ? ' active' : ''}`;

                    const selectButton = document.createElement('button');
                    selectButton.type = 'button';
                    selectButton.className = 'map-note-list-select';
                    selectButton.innerHTML = `<strong>${note.title || 'Untitled note'}</strong><span>${formatCoordinate(note)}</span>`;
                    selectButton.addEventListener('click', () => {
                        activeId = note.id;
                        render();
                    });
                    item.appendChild(selectButton);

                    if (note.audioSrc) {
                        const audioButton = document.createElement('button');
                        const isPlaying = activeAudioId === note.id;
                        audioButton.type = 'button';
                        audioButton.className = `map-note-audio-button${isPlaying ? ' playing' : ''}`;
                        audioButton.title = isPlaying ? 'Pause music' : 'Play music';
                        audioButton.innerHTML = `<i class="bi ${isPlaying ? 'bi-pause-fill' : 'bi-play-fill'}"></i>`;
                        audioButton.addEventListener('click', event => {
                            event.stopPropagation();
                            toggleAudio(note);
                        });
                        item.appendChild(audioButton);
                    }

                    list.appendChild(item);
                });
        }

        function renderPopup() {
            const note = activeNote();
            if (!note) {
                popup.hidden = true;
                popup.replaceChildren();
                return;
            }

            const image = document.createElement('img');
            image.src = getPreviewImage(note);
            image.alt = note.title || 'Map note preview';

            const content = document.createElement('div');
            content.className = 'map-note-popup-content';

            const title = document.createElement('strong');
            title.textContent = note.title || 'Untitled note';
            content.appendChild(title);

            const summary = summarizeBody(note.body);
            if (summary) {
                const text = document.createElement('span');
                text.textContent = summary;
                content.appendChild(text);
            }

            popup.replaceChildren(image, content);
            popup.hidden = false;
            positionPopup();
        }

        function positionPopup() {
            const note = activeNote();
            if (!note || popup.hidden) return;

            const rect = map.getBoundingClientRect();
            const x = (note.x / 100) * rect.width * mapScale + mapPanX;
            const y = (note.y / 100) * rect.height * mapScale + mapPanY;
            const popupWidth = popup.offsetWidth || 272;
            const popupHeight = popup.offsetHeight || 120;
            const nearRightEdge = x > rect.width - popupWidth - 16;
            const nearTopEdge = y < popupHeight + 16;

            popup.classList.toggle('flip-x', nearRightEdge);
            popup.classList.toggle('flip-y', nearTopEdge);
            popup.style.left = `${x}px`;
            popup.style.top = `${y}px`;
        }

        function render() {
            renderMapTabs();
            renderMapImage();
            renderMarkers();
            renderList();
            renderPopup();
        }

        map.addEventListener('click', event => {
            if (suppressNextClick) {
                suppressNextClick = false;
                return;
            }

            if (pickingPoint) {
                if (event.target.closest('[data-note-popup]')) return;
                pickedPoint = getMapPoint(event);
                pickingPoint = false;
                coordinateStatus.textContent = 'Selected coordinate:';
                coordinateOutput.textContent = formatPointForCode(pickedPoint);
                map.classList.remove('picking');
                render();
                return;
            }

            if (event.target.closest('.map-note-marker') || event.target.closest('[data-note-popup]')) return;
            activeId = null;
            render();
        });

        map.addEventListener('wheel', event => {
            event.preventDefault();
            const rect = map.getBoundingClientRect();
            const delta = event.deltaY < 0 ? 0.3 : -0.3;
            zoomMap(mapScale + delta, event.clientX - rect.left, event.clientY - rect.top);
        }, { passive: false });

        map.addEventListener('pointerdown', event => {
            if (event.target.closest('.map-note-marker') || event.target.closest('[data-note-popup]')) return;
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

        root.addEventListener('click', event => {
            const action = event.target.closest('[data-action]')?.dataset.action;
            if (!action) return;

            if (action === 'pick-point') {
                setPickingPoint(true);
            }

            if (action === 'cancel-pick') {
                setPickingPoint(false);
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
        });

        window.addEventListener('resize', applyMapTransform);
        mapImage.addEventListener('load', positionPopup);

        applyMapTransform();
        render();
    });
})();
