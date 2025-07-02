   const canvas = document.getElementById('canvas');
        const ctx = canvas.getContext('2d');
        const nodeContainer = document.getElementById('node-container');
        const runButton = document.getElementById('run-button');
        const clearButton = document.getElementById('clear-button');
        const sidebar = document.getElementById('sidebar');

        let state = {
            nodes: [],
            connections: [],
            dragging: { node: null, offsetX: 0, offsetY: 0 },
            connecting: { fromNode: null, fromConnector: null, line: null },
            draggedFromPalette: false
        };

        const nodeTypes = {
            'Number': {
                title: 'Number',
                inputs: [],
                outputs: ['value'],
                render: node => `<input type="number" value="${node.data.value || 0}" oninput="updateNodeData(${node.id}, 'value', this.valueAsNumber)">`,
                process: node => ({ value: node.data.value || 0 })
            },
            'Text': {
                title: 'Text',
                inputs: [],
                outputs: ['text'],
                render: node => `<input type="text" value="${node.data.text || ''}" oninput="updateNodeData(${node.id}, 'text', this.value)">`,
                process: node => ({ text: node.data.text || '' })
            },
            'Add': {
                title: 'Add',
                inputs: ['a', 'b'],
                outputs: ['sum'],
                process: (node, inputs) => ({ sum: (inputs.a || 0) + (inputs.b || 0) })
            },
            'Concatenate': {
                title: 'Concatenate',
                inputs: ['str1', 'str2'],
                outputs: ['result'],
                process: (node, inputs) => ({ result: (inputs.str1 || '') + (inputs.str2 || '') })
            },
            'Display': {
                title: 'Display',
                inputs: ['data'],
                outputs: [],
                render: node => `<div class="display-output" id="display-output-${node.id}">${node.data.displayValue || ''}</div>`,
                process: (node, inputs) => {
                    const outputEl = document.getElementById(`display-output-${node.id}`);
                    const valueToDisplay = inputs.data !== undefined ? inputs.data : 'No Input';
                    if (outputEl) {
                        outputEl.textContent = valueToDisplay;
                    }
                    updateNodeData(node.id, 'displayValue', valueToDisplay);
                    return {};
                }
            }
        };

        function createNode(type, x, y, data = {}) {
            const id = state.nodes.length;
            const node = { id, type, x, y, data, element: null };
            state.nodes.push(node);
            renderNode(node);
            drawConnections();
            return node;
        }

        function renderNode(node) {
            const el = document.createElement('div');
            el.className = 'node';
            el.id = `node-${node.id}`;
            el.style.left = `${node.x}px`;
            el.style.top = `${node.y}px`;

            const type = nodeTypes[node.type];
            let html = `<div class="node-header">${type.title}</div><div class="node-body">`;
            if (type.render) html += type.render(node);

            type.inputs.forEach(name => {
                html += `<div class="io input"><div class="connector" data-node-id="${node.id}" data-connector-name="${name}" data-connector-type="input"></div><span>${name}</span></div>`;
            });
            type.outputs.forEach(name => {
                html += `<div class="io output"><span>${name}</span><div class="connector" data-node-id="${node.id}" data-connector-name="${name}" data-connector-type="output"></div></div>`;
            });

            html += `</div>`;
            el.innerHTML = html;
            nodeContainer.appendChild(el);
            node.element = el;

            el.querySelector('.node-header').addEventListener('mousedown', e => onDragStart(e, node));
            el.querySelectorAll('.connector').forEach(c => c.addEventListener('mousedown', e => onConnectStart(e, node, c)));
        }

        function updateNodeData(nodeId, key, value) {
            state.nodes[nodeId].data[key] = value;
        }

        function drawConnections() {
            canvas.width = window.innerWidth - sidebar.offsetWidth;
            canvas.height = window.innerHeight;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.strokeStyle = '#999999';
            ctx.lineWidth = 2;

            state.connections.forEach(conn => {
                const fromPos = getConnectorPosition(conn.fromNode, conn.fromConnector, 'output');
                const toPos = getConnectorPosition(conn.toNode, conn.toConnector, 'input');
                if (fromPos && toPos) {
                    ctx.beginPath();
                    ctx.moveTo(fromPos.x - sidebar.offsetWidth, fromPos.y);
                    ctx.lineTo(toPos.x - sidebar.offsetWidth, toPos.y);
                    ctx.stroke();
                }
            });
             if (state.connecting.line) {
                ctx.beginPath();
                ctx.moveTo(state.connecting.line.x1 - sidebar.offsetWidth, state.connecting.line.y1);
                ctx.lineTo(state.connecting.line.x2 - sidebar.offsetWidth, state.connecting.line.y2);
                ctx.stroke();
            }
        }

        function getConnectorPosition(nodeId, connectorName, type) {
            const node = state.nodes[nodeId];
            if (!node || !node.element) return null;
            const connectorEl = node.element.querySelector(`[data-connector-name="${connectorName}"][data-connector-type="${type}"]`);
            if (!connectorEl) return null;
            const rect = connectorEl.getBoundingClientRect();
            return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        }
        
        function onDragStart(e, node) {
            state.dragging = { node, offsetX: e.clientX - node.x, offsetY: e.clientY - node.y };
            window.addEventListener('mousemove', onDrag);
            window.addEventListener('mouseup', onDragEnd, { once: true });
        }

        function onDrag(e) {
            const { node, offsetX, offsetY } = state.dragging;
            if (!node) return;
            node.x = e.clientX - offsetX;
            node.y = e.clientY - offsetY;
            node.element.style.left = `${node.x}px`;
            node.element.style.top = `${node.y}px`;
            drawConnections();
        }

        function onDragEnd() {
            state.dragging.node = null;
            window.removeEventListener('mousemove', onDrag);
        }

        function onConnectStart(e, node, connectorEl) {
            e.stopPropagation();
            if (connectorEl.dataset.connectorType !== 'output') return;

            const fromPos = getConnectorPosition(node.id, connectorEl.dataset.connectorName, 'output');
            if (!fromPos) return;

            state.connecting = { fromNode: node, fromConnector: connectorEl.dataset.connectorName, line: { x1: fromPos.x, y1: fromPos.y, x2: e.clientX, y2: e.clientY } };
            window.addEventListener('mousemove', onConnecting);
            window.addEventListener('mouseup', onConnectEnd, { once: true });
        }
        
        function onConnecting(e) {
            if (!state.connecting.fromNode) return;
            state.connecting.line.x2 = e.clientX;
            state.connecting.line.y2 = e.clientY;
            drawConnections();
        }

        function onConnectEnd(e) {
            const el = e.target;
            if (state.connecting.fromNode && el.classList.contains('connector') && el.dataset.connectorType === 'input') {
                const toNodeId = parseInt(el.dataset.nodeId);
                if (state.connecting.fromNode.id !== toNodeId) {
                    const existingConnection = state.connections.find(c => c.toNode === toNodeId && c.toConnector === el.dataset.connectorName);
                    if (!existingConnection) {
                        state.connections.push({
                            fromNode: state.connecting.fromNode.id,
                            fromConnector: state.connecting.fromConnector,
                            toNode: toNodeId,
                            toConnector: el.dataset.connectorName
                        });
                    }
                }
            }
            state.connecting = { fromNode: null, fromConnector: null, line: null };
            window.removeEventListener('mousemove', onConnecting);
            drawConnections();
        }

        function topologicalSort(nodes, connections) {
            const graph = new Map();
            const inDegree = new Map();
            const queue = [];

            nodes.forEach(node => {
                graph.set(node.id, []);
                inDegree.set(node.id, 0);
            });

            connections.forEach(conn => {
                graph.get(conn.fromNode).push(conn.toNode);
                inDegree.set(conn.toNode, inDegree.get(conn.toNode) + 1);
            });

            nodes.forEach(node => {
                if (inDegree.get(node.id) === 0) {
                    queue.push(node.id);
                }
            });

            const result = [];
            while (queue.length > 0) {
                const nodeId = queue.shift();
                result.push(nodeId);

                for (const neighborId of graph.get(nodeId)) {
                    inDegree.set(neighborId, inDegree.get(neighborId) - 1);
                    if (inDegree.get(neighborId) === 0) {
                        queue.push(neighborId);
                    }
                }
            }

            if (result.length !== nodes.length) {
                console.warn("Cycle detected in graph! Some nodes might not be processed.");
            }
            return result;
        }

        async function run() {
            const resolvedOutputs = {};
            const executionOrder = topologicalSort(state.nodes, state.connections);

            for (const nodeId of executionOrder) {
                const node = state.nodes[nodeId];
                const type = nodeTypes[node.type];
                const inputs = {};
                
                state.connections.filter(c => c.toNode === nodeId).forEach(c => {
                    inputs[c.toConnector] = resolvedOutputs[`${c.fromNode}-${c.fromConnector}`];
                });

                const outputs = await Promise.resolve(type.process(node, inputs));
                if (outputs) {
                    Object.entries(outputs).forEach(([key, value]) => {
                        resolvedOutputs[`${nodeId}-${key}`] = value;
                    });
                }
            }
        }

        function clearAllNodes() {
            state.nodes = [];
            state.connections = [];
            nodeContainer.innerHTML = '';
            drawConnections();
        }

        document.querySelectorAll('.node-palette-item').forEach(item => {
            item.addEventListener('dragstart', e => {
                e.dataTransfer.setData('text/plain', e.target.dataset.nodeType);
                state.draggedFromPalette = true;
            });

            item.addEventListener('click', e => {
                const nodeType = e.target.dataset.nodeType;
                const defaultX = sidebar.offsetWidth + 50;
                const defaultY = 50 + (state.nodes.length * 20 % (window.innerHeight - 100));
                createNode(nodeType, defaultX, defaultY);
            });
        });

        canvas.addEventListener('dragover', e => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        });

        canvas.addEventListener('drop', e => {
            e.preventDefault();
            if (state.draggedFromPalette) {
                const nodeType = e.dataTransfer.getData('text/plain');
                const x = e.clientX - sidebar.offsetWidth;
                const y = e.clientY;
                createNode(nodeType, x, y);
                state.draggedFromPalette = false;
            }
        });

        runButton.addEventListener('click', run);
        clearButton.addEventListener('click', clearAllNodes);
        window.addEventListener('resize', drawConnections);

        const helloNode = createNode('Text', 250, 100, { text: 'Hello' });
        const displayNode = createNode('Display', 450, 100);
        state.connections.push({
            fromNode: helloNode.id,
            fromConnector: 'text',
            toNode: displayNode.id,
            toConnector: 'data'
        });
        
        drawConnections();