const canvas = document.getElementById('graphCanvas');
const ctx = canvas.getContext('2d');
const nodeCountSelect = document.getElementById('nodeCount');
const generateGraphBtn = document.getElementById('generateGraph');
const startAlgorithmBtn = document.getElementById('startAlgorithm');
const nextStepBtn = document.getElementById('nextStep');
const resetBtn = document.getElementById('reset');
const showMatrixBtn = document.getElementById('showMatrix');
const stepInfoDiv = document.getElementById('stepInfo');
const adjacencyMatrixDiv = document.getElementById('adjacencyMatrix');
const weightTable = document.getElementById('weightTable');

let nodes = [];
let edges = [];
let adjacencyMatrix = [];
let nodePositions = [];

let animationState = {
    running: false,
    currentStep: 0,
    includedNodes: [],
    mstEdges: [],
    currentlyConsideredEdge: null,
    priorityQueue: [],
    stepMessage: "Generate a graph to begin.",
    isStepInProgress: false
};

const NODE_RADIUS = 20;
const CANVAS_PADDING = 50;
const COLORS = {
    node: '#3498db',
    includedNode: '#2ecc71',
    edge: '#bdc3c7',
    mstEdge: '#2ecc71',
    consideredEdge: '#f39c12'
};
const VISUALIZATION_DELAY = 500;

function init() {
    generateGraph();
    setupEventListeners();
}

function setupEventListeners() {
    generateGraphBtn.addEventListener('click', generateGraph);
    startAlgorithmBtn.addEventListener('click', startAlgorithm);
    nextStepBtn.addEventListener('click', nextStep);
    resetBtn.addEventListener('click', resetAlgorithm);
    showMatrixBtn.addEventListener('click', toggleMatrix);
    nodeCountSelect.addEventListener('change', handleNodeCountChange);
}

function generateGraph() {
    const nodeCount = parseInt(nodeCountSelect.value);
    resetAlgorithmState();

    nodes = Array.from({ length: nodeCount }, (_, i) => i);

    nodePositions = [];
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(canvas.width, canvas.height) / 2 - CANVAS_PADDING;

    for (let i = 0; i < nodeCount; i++) {
        const angle = (i * 2 * Math.PI / nodeCount) - Math.PI / 2;
        nodePositions.push({
            x: centerX + radius * Math.cos(angle),
            y: centerY + radius * Math.sin(angle),
            id: i
        });
    }

    adjacencyMatrix = Array(nodeCount).fill().map(() => Array(nodeCount).fill(0));

    if (nodeCount > 1) {
        const connected = [0];
        const unconnected = nodes.slice(1);

        while (unconnected.length > 0) {
            const from = connected[Math.floor(Math.random() * connected.length)];
            const toIndex = Math.floor(Math.random() * unconnected.length);
            const to = unconnected[toIndex];
            const weight = Math.floor(Math.random() * 20) + 1;

            adjacencyMatrix[from][to] = weight;
            adjacencyMatrix[to][from] = weight;

            connected.push(to);
            unconnected.splice(toIndex, 1);
        }
    }

    const maxPossibleEdges = nodeCount * (nodeCount - 1) / 2;
    const targetExtraEdges = Math.floor(maxPossibleEdges * 0.2);
    let addedExtra = 0;
    let attempts = 0;

    while(addedExtra < targetExtraEdges && attempts < maxPossibleEdges * 2) {
        const from = Math.floor(Math.random() * nodeCount);
        const to = Math.floor(Math.random() * nodeCount);
        attempts++;
        if (from !== to && adjacencyMatrix[from][to] === 0) {
            const weight = Math.floor(Math.random() * 25) + 1;
            adjacencyMatrix[from][to] = weight;
            adjacencyMatrix[to][from] = weight;
            addedExtra++;
        }
    }

    updateEdgesFromMatrix();
    animationState.stepMessage = `Graph with ${nodeCount} nodes generated. Click 'Start Algorithm'.`;
    updateUI();
}

function updateEdgesFromMatrix() {
    edges = [];
    const nodeCount = adjacencyMatrix.length;
    for (let i = 0; i < nodeCount; i++) {
        for (let j = i + 1; j < nodeCount; j++) {
            if (adjacencyMatrix[i][j] > 0) {
                edges.push({ from: i, to: j, weight: adjacencyMatrix[i][j] });
            }
        }
    }
}

function resetAlgorithmState() {
    const lastMessage = animationState.stepMessage;
    animationState = {
        running: false,
        currentStep: 0,
        includedNodes: [],
        mstEdges: [],
        currentlyConsideredEdge: null,
        priorityQueue: [],
        stepMessage: "State reset.",
        isStepInProgress: false
    };
    if (lastMessage && lastMessage !== "Generate a graph to begin.") {
        animationState.stepMessage = "Algorithm reset.";
    } else {
        animationState.stepMessage = "Generate a graph to begin.";
    }
}

function resetAlgorithm() {
    resetAlgorithmState();
    updateEdgesFromMatrix();
    animationState.stepMessage = "Algorithm reset. Generate a new graph or start again.";
    updateUI();
}

function startAlgorithm() {
    if (animationState.running || nodes.length === 0) return;

    resetAlgorithmState();
    animationState.running = true;
    animationState.includedNodes.push(0);
    updatePriorityQueue();
    animationState.stepMessage = `Started. Node ${getNodeName(0)} in MST. Click 'Next Step'.`;
    animationState.currentStep = 0;
    updateUI();
}

function updatePriorityQueue() {
    animationState.priorityQueue = [];
    const includedSet = new Set(animationState.includedNodes);

    for (const node of animationState.includedNodes) {
        for (let neighbor = 0; neighbor < adjacencyMatrix.length; neighbor++) {
            const weight = adjacencyMatrix[node][neighbor];
            if (weight > 0 && !includedSet.has(neighbor)) {
                animationState.priorityQueue.push({ from: node, to: neighbor, weight });
            }
        }
    }
    animationState.priorityQueue.sort((a, b) => a.weight - b.weight);
}

function nextStep() {
    if (!animationState.running || animationState.isStepInProgress) return;

    animationState.isStepInProgress = true;
    animationState.currentStep++;
    animationState.currentlyConsideredEdge = null;

    if (animationState.includedNodes.length === nodes.length) {
        animationState.running = false;
        animationState.stepMessage = `Algorithm complete! <div class="final-cost">Final MST Cost = ${calculateMSTWeight()}</div>`;
        animationState.isStepInProgress = false;
        updateUI();
        return;
    }

    if (animationState.priorityQueue.length === 0) {
        animationState.running = false;
        animationState.stepMessage = "No more edges connect to the MST. Graph may be disconnected.";
        animationState.isStepInProgress = false;
        updateUI();
        return;
    }

    const minEdge = animationState.priorityQueue.shift();
    if (!minEdge) {
        console.error("Error: Queue not empty but shift failed.");
        animationState.isStepInProgress = false;
        return;
    }

    animationState.currentlyConsideredEdge = minEdge;
    animationState.stepMessage = `Step ${animationState.currentStep}: Considering ${getNodeName(minEdge.from)}-${getNodeName(minEdge.to)} (W: ${minEdge.weight})...`;
    updateUI();

    setTimeout(() => {
        if (!animationState.isStepInProgress || !animationState.currentlyConsideredEdge ||
            animationState.currentlyConsideredEdge.from !== minEdge.from ||
            animationState.currentlyConsideredEdge.to !== minEdge.to) {
            console.warn("Step aborted due to state change during delay.");
            if(animationState.isStepInProgress) animationState.isStepInProgress = false;
            return;
        }

        if (animationState.includedNodes.includes(minEdge.to)) {
            animationState.stepMessage = `Step ${animationState.currentStep}: Edge not added (Node ${getNodeName(minEdge.to)} already in MST).`;
        } else {
            animationState.mstEdges.push(minEdge);
            animationState.includedNodes.push(minEdge.to);
            updatePriorityQueue();
            animationState.stepMessage = `Step ${animationState.currentStep}: Added edge to MST. Node ${getNodeName(minEdge.to)} included.`;
        }

        animationState.currentlyConsideredEdge = null;
        animationState.isStepInProgress = false;

        if (animationState.includedNodes.length === nodes.length) {
            animationState.running = false;
            animationState.stepMessage = `Algorithm complete! <div class="final-cost">Final MST Cost = ${calculateMSTWeight()}</div>`;
        } else if (animationState.running && animationState.priorityQueue.length === 0) {
            animationState.running = false;
            animationState.stepMessage = "No more edges connect to the MST. Graph may be disconnected.";
        }

        updateUI();
    }, VISUALIZATION_DELAY);
}

function drawGraph() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    edges.forEach(edge => {
        const from = nodePositions[edge.from];
        const to = nodePositions[edge.to];

        let color = COLORS.edge;
        let width = 2;

        const isMST = animationState.mstEdges.some(e => (e.from === edge.from && e.to === edge.to) || (e.from === edge.to && e.to === edge.from));
        const isConsidered = animationState.currentlyConsideredEdge && ((animationState.currentlyConsideredEdge.from === edge.from && animationState.currentlyConsideredEdge.to === edge.to) || (animationState.currentlyConsideredEdge.from === edge.to && animationState.currentlyConsideredEdge.to === edge.from));

        if (isConsidered) { color = COLORS.consideredEdge; width = 3; }
        else if (isMST) { color = COLORS.mstEdge; width = 3; }

        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.stroke();

        drawEdgeWeight(edge, from, to, color);
    });

    nodePositions.forEach(node => {
        const isIncluded = animationState.includedNodes.includes(node.id);
        ctx.beginPath();
        ctx.arc(node.x, node.y, NODE_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = isIncluded ? COLORS.includedNode : COLORS.node;
        ctx.fill();

        ctx.fillStyle = 'white';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(getNodeName(node.id), node.x, node.y);
    });
}

function drawEdgeWeight(edge, fromPos, toPos, edgeColor) {
    const midX = (fromPos.x + toPos.x) / 2;
    const midY = (fromPos.y + toPos.y) / 2;
    const text = edge.weight.toString();

    ctx.font = '11px Arial';
    const textMetrics = ctx.measureText(text);
    const padding = 4;
    const weightRadius = Math.max(NODE_RADIUS * 0.5, textMetrics.width / 2 + padding);

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = edgeColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(midX, midY, weightRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#333';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, midX, midY);
}

function updateUI() {
    const isActive = animationState.running || animationState.isStepInProgress;
    startAlgorithmBtn.disabled = isActive || nodes.length === 0;
    nextStepBtn.disabled = !animationState.running || animationState.isStepInProgress;
    resetBtn.disabled = animationState.isStepInProgress;
    nodeCountSelect.disabled = isActive;
    generateGraphBtn.disabled = isActive;
    showMatrixBtn.disabled = isActive;

    if (adjacencyMatrixDiv.style.display !== 'none') {
        updateMatrixTable();
    } else {
        document.querySelectorAll('.weight-input').forEach(input => input.disabled = isActive);
    }

    updateStepInfo();
    drawGraph();
}

function updateStepInfo() {
    const includedNodesStr = animationState.includedNodes.map(getNodeName).sort().join(', ') || 'None';
    const mstEdgesStr = animationState.mstEdges.map(e => `${getNodeName(e.from)}-${getNodeName(e.to)}(${e.weight})`).sort().join(', ') || 'None';
    const queueStr = animationState.priorityQueue.length > 0
        ? `[${animationState.priorityQueue.slice(0,5).map(e => `${getNodeName(e.from)}-${getNodeName(e.to)}(${e.weight})`).join(', ')}${animationState.priorityQueue.length > 5 ? ',...' : ''}] (${animationState.priorityQueue.length})`
        : (animationState.running || animationState.includedNodes.length > 0 ? '[] (Empty)' : 'N/A');

    let weightStr = "N/A";
    if (animationState.mstEdges.length > 0 || (!animationState.running && animationState.includedNodes.length > 0 && animationState.phase !== 'idle')) {
         weightStr = calculateMSTWeight().toString();
         if (!animationState.running && animationState.includedNodes.length !== nodes.length && animationState.phase !== 'finished' && animationState.phase !== 'idle') {
             weightStr += " (partial)";
         }
    } else if (!animationState.running && animationState.phase !== 'idle') {
         weightStr = "0";
    }

    stepInfoDiv.innerHTML = `
        <h3>${animationState.running ? `Step ${animationState.currentStep}` : 'Algorithm Status'}</h3>
        <div>${animationState.stepMessage}</div>
        <hr>
        <p><strong>Nodes in MST:</strong> ${includedNodesStr}</p>
        <p><strong>MST Edges:</strong> ${mstEdgesStr}</p>
        <p><strong>Current Weight:</strong> <span class="highlight-value">${weightStr}</span></p>
        <p><strong>Priority Queue:</strong> ${queueStr}</p>
    `;
    stepInfoDiv.scrollTop = stepInfoDiv.scrollHeight;
}

function toggleMatrix() {
    const isHidden = adjacencyMatrixDiv.style.display === 'none';
    if (isHidden) {
        updateMatrixTable();
        adjacencyMatrixDiv.style.display = 'block';
        showMatrixBtn.textContent = 'Hide Matrix';
    } else {
        adjacencyMatrixDiv.style.display = 'none';
        showMatrixBtn.textContent = 'Show/Hide Matrix';
    }
}

function updateMatrixTable() {
    weightTable.innerHTML = '';
    const headerRow = document.createElement('tr');
    headerRow.innerHTML = '<th></th>';

    for (let i = 0; i < adjacencyMatrix.length; i++) {
        headerRow.innerHTML += `<th>${getNodeName(i)}</th>`;
    }
    const thead = document.createElement('thead');
    thead.appendChild(headerRow);
    weightTable.appendChild(thead);

    const tbody = document.createElement('tbody');
    for (let i = 0; i < adjacencyMatrix.length; i++) {
        const row = document.createElement('tr');
        row.innerHTML = `<th>${getNodeName(i)}</th>`;

        for (let j = 0; j < adjacencyMatrix.length; j++) {
            const cell = document.createElement('td');
            if (i === j) {
                cell.textContent = '-';
            } else {
                const input = document.createElement('input');
                input.type = 'number';
                input.min = '0';
                input.classList.add('weight-input');
                input.dataset.from = i;
                input.dataset.to = j;
                input.value = adjacencyMatrix[i][j];
                input.placeholder = '0';
                input.disabled = animationState.running || animationState.isStepInProgress;
                if (!input.disabled) {
                     input.addEventListener('input', handleWeightChange);
                     input.addEventListener('change', handleWeightChange);
                }
                 cell.appendChild(input);
            }
            row.appendChild(cell);
        }
        tbody.appendChild(row);
    }
    weightTable.appendChild(tbody);
}

function handleWeightChange(e) {
    if (animationState.running || animationState.isStepInProgress) return;

    const input = e.target;
    const from = parseInt(input.dataset.from);
    const to = parseInt(input.dataset.to);
    let weight = parseInt(input.value) || 0;

    if (isNaN(weight) || weight < 0) {
        weight = 0;
        input.value = 0;
    }

    adjacencyMatrix[from][to] = weight;
    adjacencyMatrix[to][from] = weight;

    const symmetricInput = weightTable.querySelector(`.weight-input[data-from="${to}"][data-to="${from}"]`);
    if (symmetricInput && symmetricInput !== input) {
        symmetricInput.value = weight;
    }

    updateEdgesFromMatrix();
    updateUI();
}

function handleNodeCountChange() {
    if (!animationState.running && !animationState.isStepInProgress) {
        generateGraph();
        adjacencyMatrixDiv.style.display = 'none';
        showMatrixBtn.textContent = 'Show/Hide Matrix';
    } else {
        alert("Please reset the algorithm before changing node count.");
        nodeCountSelect.value = adjacencyMatrix.length;
    }
}

function getNodeName(index) {
    return String.fromCharCode(65 + index);
}

function calculateMSTWeight() {
    return animationState.mstEdges.reduce((sum, edge) => sum + edge.weight, 0);
}

document.addEventListener('DOMContentLoaded', init);