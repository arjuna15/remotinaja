/* ==========================================================================
   AETHER REMOTE DESKTOP ENGINE (MOBILE TOUCH + CANVAS RENDERING FALLBACK)
   ========================================================================== */

let peer = null;
let activeMediaConn = null;
let activeDataConn = null;
let localHostStream = null;
let canvasAnimId = null;

const state = {
    myPeerId: null,
    currentView: 'controller',
    targetPeerId: null,
    isConnected: false
};

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
        elements.globalStatus.innerText = 'PeerJS Ready';
        logEvent('SYSTEM', `[CONNECTED] Peer ID: ${id}`);
    });

    peer.on('call', (mediaConnection) => {
        logEvent('PEER', `Incoming Remote Call from: ${mediaConnection.peer}`);
        activeMediaConn = mediaConnection;

        if (!localHostStream) {
            localHostStream = createHostCanvasStream();
        }
        
        mediaConnection.answer(localHostStream);
        logEvent('HOST', 'Streaming Layar/Canvas Host ke Remote Controller!');
    });

    peer.on('connection', (dataConnection) => {
        activeDataConn = dataConnection;
        logEvent('PEER', `DataChannel Connected from: ${dataConnection.peer}`);

        dataConnection.on('data', (data) => {
            if (data.type === 'mousemove' || data.type === 'touchmove') {
                logEvent('EVENT', `[TOUCH/MOUSE] X: ${Math.round(data.x)}, Y: ${Math.round(data.y)}`);
            } else if (data.type === 'click' || data.type === 'tap') {
                logEvent('EVENT', `[TAP CLICK] X: ${Math.round(data.x)}, Y: ${Math.round(data.y)}`);
            }
        });
    });

    peer.on('error', (err) => {
        console.error('PeerJS Error:', err);
        logEvent('ERROR', `PeerJS Error: ${err.type} - ${err.message}`);
    });
}

function createHostCanvasStream() {
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');

    let angle = 0;

    function renderHostDesktop() {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, 1280, 720);

        const grad = ctx.createRadialGradient(400, 300, 20, 640, 360, 600);
        grad.addColorStop(0, '#1e1b4b');
        grad.addColorStop(1, '#060913');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 1280, 720);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 28px "Plus Jakarta Sans", sans-serif';
        ctx.fillText('💻 LAPTOP B HOST DESKTOP (LIVE STREAM)', 40, 60);

        ctx.fillStyle = '#06b6d4';
        ctx.font = '16px "JetBrains Mono", monospace';
        ctx.fillText(`Status: Live WebRTC Stream | Clock: ${new Date().toLocaleTimeString()}`, 40, 95);

        drawIcon(ctx, 40, 140, '📁 My Documents');
        drawIcon(ctx, 40, 240, '🌐 Aether Browser');
        drawIcon(ctx, 40, 340, '💻 Terminal CLI');

        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(300, 140, 680, 420, 16);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 18px "Plus Jakarta Sans"';
        ctx.fillText('AETHER REMOTE AGENT WORKSTATION', 330, 180);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '14px "JetBrains Mono"';
        ctx.fillText('Layar ini dikirim secara P2P ke Smartphone/HP Anda!', 330, 220);
        ctx.fillText('Cobalah TAP atau SWIPE di layar HP Anda sekarang.', 330, 250);

        angle += 0.05;
        const sphereX = 640 + Math.cos(angle) * 80;
        const sphereY = 380 + Math.sin(angle) * 40;

        ctx.fillStyle = '#3b82f6';
        ctx.beginPath();
        ctx.arc(sphereX, sphereY, 24, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
        ctx.fillRect(0, 660, 1280, 60);

        canvasAnimId = requestAnimationFrame(renderHostDesktop);
    }

    renderHostDesktop();
    return canvas.captureStream(30);
}

function drawIcon(ctx, x, y, label) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.roundRect(x, y, 200, 70, 12);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = '14px "Plus Jakarta Sans"';
    ctx.fillText(label, x + 20, y + 42);
}

function handleConnect(event) {
    if (event) event.preventDefault();

    const targetId = elements.remoteIdInput.value.trim();
    if (!targetId) {
        alert('Masukkan Peer ID Target!');
        return;
    }

    state.targetPeerId = targetId;
    logEvent('SYSTEM', `Connecting to Peer Target: ${targetId}...`);

    activeDataConn = peer.connect(targetId);
    activeDataConn.on('open', () => {
        logEvent('PEER', 'DataChannel Remote Control Mobile Active!');
    });

    const canvas = document.createElement('canvas');
    canvas.width = 10;
    canvas.height = 10;
    const dummyStream = canvas.captureStream(1);

    activeMediaConn = peer.call(targetId, dummyStream);

    activeMediaConn.on('stream', (remoteStream) => {
        logEvent('WEBRTC', '[SUCCESS] Stream Video Layar Diterima!');
        
        // DISPLAY STREAM TO REMOTE VIDEO ELEMENT AND HIDE IDLE STATE
        elements.remoteVideo.srcObject = remoteStream;
        elements.remoteVideo.muted = true;
        elements.remoteVideo.setAttribute('playsinline', '');
        elements.remoteVideo.play().catch(e => console.log("Video Play Error:", e));

        // FORCE HIDE IDLE STATE OVERLAY AND SHOW DISCONNECT BUTTON
        elements.idleState.style.setProperty('display', 'none', 'important');
        elements.btnDisconnect.style.display = 'flex';
        elements.streamStatusVal.innerText = 'Streaming 30-60FPS';
        elements.streamStatusVal.style.color = '#10b981';
        state.isConnected = true;
    });

    activeMediaConn.on('close', () => {
        handleDisconnect();
    });
}

function setupMobileTouchCapture() {
    const overlay = elements.interactiveOverlay;

    overlay.addEventListener('touchstart', (e) => {
        if (!state.isConnected || !activeDataConn) return;

        const touch = e.touches[0];
        const rect = overlay.getBoundingClientRect();
        const posX = (touch.clientX - rect.left) * (1280 / rect.width);
        const posY = (touch.clientY - rect.top) * (720 / rect.height);

        activeDataConn.send({
            type: 'tap',
            x: posX,
            y: posY
        });
    }, { passive: true });

    overlay.addEventListener('touchmove', (e) => {
        if (!state.isConnected || !activeDataConn) return;

        const touch = e.touches[0];
        const rect = overlay.getBoundingClientRect();
        const posX = (touch.clientX - rect.left) * (1280 / rect.width);
        const posY = (touch.clientY - rect.top) * (720 / rect.height);

        activeDataConn.send({
            type: 'touchmove',
            x: posX,
            y: posY
        });
    }, { passive: true });
}

function setupInputCapture() {
    const overlay = elements.interactiveOverlay;

    overlay.addEventListener('mousemove', (e) => {
        if (!state.isConnected || !activeDataConn) return;

        const rect = overlay.getBoundingClientRect();
        const posX = (e.clientX - rect.left) * (1280 / rect.width);
        const posY = (e.clientY - rect.top) * (720 / rect.height);

        activeDataConn.send({
            type: 'mousemove',
            x: posX,
            y: posY
        });
    });

    overlay.addEventListener('click', (e) => {
        if (!state.isConnected || !activeDataConn) return;

        const rect = overlay.getBoundingClientRect();
        const posX = (e.clientX - rect.left) * (1280 / rect.width);
        const posY = (e.clientY - rect.top) * (720 / rect.height);

        activeDataConn.send({
            type: 'click',
            x: posX,
            y: posY
        });
    });
}

async function startHostScreenCapture() {
    try {
        localHostStream = await navigator.mediaDevices.getDisplayMedia({
            video: { frameRate: 60 },
            audio: true
        });

        elements.hostScreenStatus.innerText = '● Status Stream Host: AKTIF (Layar Ditayangkan)';
        elements.hostScreenStatus.style.color = '#10b981';
        logEvent('HOST', 'Screen Capture Laptop B Aktif!');

    } catch (err) {
        alert('Gagal mengambil layar (Fallback ke Canvas): ' + err.message);
        localHostStream = createHostCanvasStream();
    }
}

function handleDisconnect() {
    if (activeMediaConn) activeMediaConn.close();
    if (activeDataConn) activeDataConn.close();
    if (canvasAnimId) cancelAnimationFrame(canvasAnimId);

    state.isConnected = false;
    elements.remoteVideo.srcObject = null;
    elements.idleState.style.setProperty('display', 'flex');
    elements.btnDisconnect.style.display = 'none';
    elements.streamStatusVal.innerText = 'Idle';
    elements.streamStatusVal.style.color = '#94a3b8';
    logEvent('SYSTEM', 'Sesi remote diputuskan.');
}

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
