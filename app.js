/* ==========================================================================
   AETHER REMOTE DESKTOP ENGINE (MOBILE TOUCH + PEERJS CLOUD WEBRTC ENGINE)
   ========================================================================== */

// Global PeerJS Instance
let peer = null;
let activeMediaConn = null;
let activeDataConn = null;
let localHostStream = null;

// Global State
const state = {
    myPeerId: null,
    currentView: 'controller',
    targetPeerId: null,
    isConnected: false
};

// DOM Elements
const elements = {
    tabControllerBtn: document.getElementById('tabControllerBtn'),
    tabTargetBtn: document.getElementById('tabTargetBtn'),
    controllerView: document.getElementById('controllerView'),
    targetView: document.getElementById('targetView'),
    myDeviceId: document.getElementById('myDeviceId'),
    remoteIdInput: document.getElementById('remoteIdInput'),
    btnConnect: document.getElementById('btnConnect'),
    btnDisconnect: document.getElementById('btnDisconnect'),
    idleState: document.getElementById('idleState'),
    remoteVideo: document.getElementById('remoteVideo'),
    interactiveOverlay: document.getElementById('interactiveOverlay'),
    logEntries: document.getElementById('logEntries'),
    globalStatus: document.getElementById('globalStatus'),
    hostScreenStatus: document.getElementById('hostScreenStatus'),
    hostPeerIdDisplay: document.getElementById('hostPeerIdDisplay'),
    streamStatusVal: document.getElementById('streamStatusVal')
};

// INITIALIZATION PEERJS CLOUD
document.addEventListener('DOMContentLoaded', () => {
    initPeerJS();
    setupInputCapture();
    setupMobileTouchCapture();
});

function initPeerJS() {
    const randomId = 'aether-' + Math.floor(100000 + Math.random() * 900000);
    
    peer = new Peer(randomId, {
        debug: 2,
        config: {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' }
            ]
        }
    });

    peer.on('open', (id) => {
        state.myPeerId = id;
        elements.myDeviceId.innerText = id;
        if (elements.hostPeerIdDisplay) elements.hostPeerIdDisplay.innerText = id;
        elements.globalStatus.innerText = 'PeerJS Mobile Ready';
        logEvent('SYSTEM', `[CONNECTED] Peer ID Anda: ${id}`);
    });

    peer.on('call', (mediaConnection) => {
        logEvent('PEER', `Menerima panggilan remote dari Controller: ${mediaConnection.peer}`);
        
        if (localHostStream) {
            mediaConnection.answer(localHostStream);
            logEvent('HOST', 'Mengirim stream layar Laptop B ke Controller (HP/PC)...');
        } else {
            alert('Ada panggilan masuk! Silakan aktifkan "Bagikan Layar Laptop B" di tab Host Agent!');
        }
    });

    peer.on('connection', (dataConnection) => {
        activeDataConn = dataConnection;
        logEvent('PEER', `DataChannel terhubung dari: ${dataConnection.peer}`);

        dataConnection.on('data', (data) => {
            if (data.type === 'mousemove' || data.type === 'touchmove') {
                logEvent('EVENT', `[REMOTE MOUSE/TOUCH] X: ${Math.round(data.x)}, Y: ${Math.round(data.y)}`);
            } else if (data.type === 'click' || data.type === 'tap') {
                logEvent('EVENT', `[REMOTE TAP/CLICK] Left Click at X: ${Math.round(data.x)}, Y: ${Math.round(data.y)}`);
            }
        });
    });

    peer.on('error', (err) => {
        console.error('PeerJS Error:', err);
        logEvent('ERROR', `PeerJS Error: ${err.type} - ${err.message}`);
    });
}

// INITIATE REMOTE FROM MOBILE PHONE / CONTROLLER
function handleConnect(event) {
    if (event) event.preventDefault();

    const targetId = elements.remoteIdInput.value.trim();
    if (!targetId) {
        alert('Masukkan Peer ID Target!');
        return;
    }

    state.targetPeerId = targetId;
    logEvent('SYSTEM', `Menghubungkan ke Peer Target: ${targetId}...`);

    activeDataConn = peer.connect(targetId);
    activeDataConn.on('open', () => {
        logEvent('PEER', 'DataChannel Remote Control Mobile Aktif!');
    });

    const canvas = document.createElement('canvas');
    canvas.width = 10;
    canvas.height = 10;
    const dummyStream = canvas.captureStream(1);

    activeMediaConn = peer.call(targetId, dummyStream);

    activeMediaConn.on('stream', (remoteStream) => {
        logEvent('WEBRTC', '[SUCCESS] Stream Video Layar Diterima di Layar HP/PC!');
        elements.remoteVideo.srcObject = remoteStream;
        elements.idleState.style.display = 'none';
        elements.btnDisconnect.style.display = 'flex';
        elements.streamStatusVal.innerText = 'Streaming Active';
        elements.streamStatusVal.style.color = '#10b981';
        state.isConnected = true;
    });

    activeMediaConn.on('close', () => {
        handleDisconnect();
    });
}

// CAPTURE MOBILE TOUCH GESTURES (SMARTPHONE TO REMOTE LAPTOP)
function setupMobileTouchCapture() {
    const overlay = elements.interactiveOverlay;

    // Mobile Touch Start / Tap Event
    overlay.addEventListener('touchstart', (e) => {
        if (!state.isConnected || !activeDataConn) return;

        const touch = e.touches[0];
        const rect = overlay.getBoundingClientRect();
        const posX = (touch.clientX - rect.left) * (1920 / rect.width);
        const posY = (touch.clientY - rect.top) * (1080 / rect.height);

        activeDataConn.send({
            type: 'tap',
            x: posX,
            y: posY
        });
    }, { passive: true });

    // Mobile Touch Drag Event
    overlay.addEventListener('touchmove', (e) => {
        if (!state.isConnected || !activeDataConn) return;

        const touch = e.touches[0];
        const rect = overlay.getBoundingClientRect();
        const posX = (touch.clientX - rect.left) * (1920 / rect.width);
        const posY = (touch.clientY - rect.top) * (1080 / rect.height);

        activeDataConn.send({
            type: 'touchmove',
            x: posX,
            y: posY
        });
    }, { passive: true });
}

// CAPTURE MOUSE INPUT (DESKTOP CONTROLLER)
function setupInputCapture() {
    const overlay = elements.interactiveOverlay;

    overlay.addEventListener('mousemove', (e) => {
        if (!state.isConnected || !activeDataConn) return;

        const rect = overlay.getBoundingClientRect();
        const posX = (e.clientX - rect.left) * (1920 / rect.width);
        const posY = (e.clientY - rect.top) * (1080 / rect.height);

        activeDataConn.send({
            type: 'mousemove',
            x: posX,
            y: posY
        });
    });

    overlay.addEventListener('click', (e) => {
        if (!state.isConnected || !activeDataConn) return;

        const rect = overlay.getBoundingClientRect();
        const posX = (e.clientX - rect.left) * (1920 / rect.width);
        const posY = (e.clientY - rect.top) * (1080 / rect.height);

        activeDataConn.send({
            type: 'click',
            x: posX,
            y: posY
        });
    });
}

// CAPTURE SCREEN ON LAPTOP B (TARGET HOST)
async function startHostScreenCapture() {
    try {
        localHostStream = await navigator.mediaDevices.getDisplayMedia({
            video: { frameRate: 60 },
            audio: true
        });

        elements.hostScreenStatus.innerText = '● Status Stream Host: AKTIF (Layar Siap Ditayangkan)';
        elements.hostScreenStatus.style.color = '#10b981';
        logEvent('HOST', 'Screen Capture Aktif! HP/PC Controller sekarang bisa menghubungkan Peer ID ini.');

    } catch (err) {
        alert('Gagal mengambil layar: ' + err.message);
    }
}

// DISCONNECT SESSION
function handleDisconnect() {
    if (activeMediaConn) activeMediaConn.close();
    if (activeDataConn) activeDataConn.close();

    state.isConnected = false;
    elements.remoteVideo.srcObject = null;
    elements.idleState.style.display = 'flex';
    elements.btnDisconnect.style.display = 'none';
    elements.streamStatusVal.innerText = 'Idle';
    elements.streamStatusVal.style.color = '#94a3b8';
    logEvent('SYSTEM', 'Sesi remote diputuskan.');
}

// UI HELPER UTILITIES
function switchView(viewName) {
    state.currentView = viewName;
    if (viewName === 'controller') {
        elements.tabControllerBtn.classList.add('active');
        elements.tabTargetBtn.classList.remove('active');
        elements.controllerView.classList.add('active');
        elements.targetView.classList.remove('active');
    } else {
        elements.tabTargetBtn.classList.add('active');
        elements.tabControllerBtn.classList.remove('active');
        elements.targetView.classList.add('active');
        elements.controllerView.classList.remove('active');
    }
}

function copyDeviceId() {
    if (state.myPeerId) {
        navigator.clipboard.writeText(state.myPeerId);
        logEvent('SYSTEM', 'Peer ID disalin ke clipboard!');
    }
}

function sendRemoteAction(type) {
    if (!state.isConnected) return;
    alert(`Perintah ${type} dikirim secara P2P ke target.`);
}

function toggleFullScreen() {
    if (!document.fullscreenElement) {
        elements.remoteVideo.requestFullscreen();
    } else {
        document.exitFullscreen();
    }
}

function logEvent(type, text) {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type === 'PEER' ? 'evt' : 'sys'}`;
    const time = new Date().toLocaleTimeString();
    entry.innerText = `[${time}] [${type}] ${text}`;

    elements.logEntries.appendChild(entry);
    elements.logEntries.scrollTop = elements.logEntries.scrollHeight;
    if (elements.logEntries.children.length > 25) {
        elements.logEntries.removeChild(elements.logEntries.firstChild);
    }
}
