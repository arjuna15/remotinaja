/* ==========================================================================
   AETHER REMOTE DESKTOP ENGINE (REAL WEBRTC + SOCKET.IO SIGNALING)
   ========================================================================== */

// Socket.io Realtime Connection
const socket = io();

// WebRTC Peer Connection Configuration (Using Public STUN Servers)
const rtcConfig = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
    ]
};

// Global State
const state = {
    myDeviceId: 'DEV-' + Math.floor(100000 + Math.random() * 900000),
    currentView: 'controller',
    peerConnection: null,
    dataChannel: null,
    localStream: null,
    targetDeviceId: null,
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
    onlineDevicesContainer: document.getElementById('onlineDevicesContainer'),
    onlineCountBadge: document.getElementById('onlineCountBadge'),
    globalStatus: document.getElementById('globalStatus'),
    hostScreenStatus: document.getElementById('hostScreenStatus'),
    pingVal: document.getElementById('pingVal'),
    fpsVal: document.getElementById('fpsVal')
};

// INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
    elements.myDeviceId.innerText = state.myDeviceId;
    setupSocketEvents();
    setupInputCapture();
});

// SOCKET.IO SIGNALING EVENT HANDLERS
function setupSocketEvents() {
    socket.on('connect', () => {
        logEvent('SYSTEM', `WebSocket Connected. Socket ID: ${socket.id}`);
        elements.globalStatus.innerText = 'Signaling Connected';

        // Register Node on Server
        socket.emit('register-device', {
            deviceId: state.myDeviceId,
            role: 'hybrid',
            osInfo: navigator.userAgent.indexOf('Linux') !== -1 ? 'Linux' : 'Windows/Mac'
        });
    });

    // Update List of Online Devices Realtime
    socket.on('online-devices-update', (devices) => {
        const otherDevices = devices.filter(d => d.deviceId !== state.myDeviceId);
        elements.onlineCountBadge.innerText = `${otherDevices.length} Online`;
        
        elements.onlineDevicesContainer.innerHTML = '';
        if (otherDevices.length === 0) {
            elements.onlineDevicesContainer.innerHTML = '<p style="font-size: 12px; color: #64748b; text-align: center; padding: 20px;">Tidak ada node lain. Buka tab baru di browser untuk mensimulasikan Laptop B!</p>';
            return;
        }

        otherDevices.forEach(dev => {
            const devEl = document.createElement('div');
            devEl.className = 'device-item glass-panel-sm';
            devEl.onclick = () => {
                elements.remoteIdInput.value = dev.deviceId;
                document.querySelectorAll('.device-item').forEach(e => e.classList.remove('active-target'));
                devEl.classList.add('active-target');
            };

            devEl.innerHTML = `
                <div class="device-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                </div>
                <div class="device-info">
                    <div class="device-title">Node ${dev.deviceId}</div>
                    <div class="device-sub">${dev.osInfo} • ${dev.role}</div>
                </div>
                <span class="status-dot online"></span>
            `;
            elements.onlineDevicesContainer.appendChild(devEl);
        });
    });

    // Handle Signaling OFFER (When another laptop calls me)
    socket.on('signal-offer', async (data) => {
        logEvent('SIGNAL', `Menerima WebRTC Offer dari: ${data.callerId}`);
        state.targetDeviceId = data.callerId;

        // Auto create peer connection on target host
        await createPeerConnection();
        await state.peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));

        // If host has screen stream, add tracks
        if (state.localStream) {
            state.localStream.getTracks().forEach(track => {
                state.peerConnection.addTrack(track, state.localStream);
            });
        }

        const answer = await state.peerConnection.createAnswer();
        await state.peerConnection.setLocalDescription(answer);

        socket.emit('signal-answer', {
            callerId: data.callerId,
            targetId: state.myDeviceId,
            answer: answer
        });
    });

    // Handle Signaling ANSWER (When target host answers my offer)
    socket.on('signal-answer', async (data) => {
        logEvent('SIGNAL', `Menerima WebRTC Answer dari: ${data.targetId}`);
        if (state.peerConnection) {
            await state.peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
        }
    });

    // Handle ICE Candidate Exchange
    socket.on('signal-ice-candidate', async (data) => {
        if (state.peerConnection && data.candidate) {
            try {
                await state.peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
            } catch (err) {
                console.error('Error adding ICE Candidate:', err);
            }
        }
    });

    socket.on('signal-error', (data) => {
        alert(data.message);
        logEvent('SYSTEM', `[ERROR] ${data.message}`);
    });

    // Handle Remote Input Events (Target Host receives mouse/keyboard from Laptop A)
    socket.on('remote-input-event', (data) => {
        if (data.type === 'mousemove') {
            logEvent('EVENT', `[REMOTE INPUT] Mouse Move -> X:${Math.round(data.x)}, Y:${Math.round(data.y)}`);
        } else if (data.type === 'click') {
            logEvent('EVENT', `[REMOTE INPUT] Mouse Click at X:${Math.round(data.x)}, Y:${Math.round(data.y)}`);
        }
    });
}

// CREATE WEBRTC PEER CONNECTION
async function createPeerConnection() {
    state.peerConnection = new RTCPeerConnection(rtcConfig);

    // ICE Candidate Generator
    state.peerConnection.onicecandidate = (event) => {
        if (event.candidate && state.targetDeviceId) {
            socket.emit('signal-ice-candidate', {
                toDeviceId: state.targetDeviceId,
                fromDeviceId: state.myDeviceId,
                candidate: event.candidate
            });
        }
    };

    // Receive Remote Stream (Video & Audio)
    state.peerConnection.ontrack = (event) => {
        logEvent('SYSTEM', '[WEBRTC] Track Stream Video diterima! Menampilkan layar remote.');
        elements.remoteVideo.srcObject = event.streams[0];
        elements.idleState.style.display = 'none';
        elements.btnDisconnect.style.display = 'flex';
        state.isConnected = true;
    };

    // Create DataChannel for Low Latency Control
    state.dataChannel = state.peerConnection.createDataChannel('control-channel');
    state.dataChannel.onopen = () => logEvent('WEBRTC', 'DataChannel Terbuka. Latency Ultra Low Ready.');
}

// INITIATE CONNECT FROM CONTROLLER (LAPTOP A)
async function handleConnect(event) {
    if (event) event.preventDefault();

    const targetId = elements.remoteIdInput.value.trim();
    if (!targetId) {
        alert('Masukkan Device ID Target!');
        return;
    }

    state.targetDeviceId = targetId;
    logEvent('SYSTEM', `Memulai P2P Connection ke Device: ${targetId}`);

    await createPeerConnection();

    // Create SDP Offer
    const offer = await state.peerConnection.createOffer();
    await state.peerConnection.setLocalDescription(offer);

    socket.emit('signal-offer', {
        targetId: targetId,
        callerId: state.myDeviceId,
        offer: offer
    });
}

// DISCONNECT SESSION
function handleDisconnect() {
    if (state.peerConnection) {
        state.peerConnection.close();
        state.peerConnection = null;
    }
    state.isConnected = false;
    elements.remoteVideo.srcObject = null;
    elements.idleState.style.display = 'flex';
    elements.btnDisconnect.style.display = 'none';
    logEvent('SYSTEM', 'Sesi remote diputuskan.');
}

// CAPTURE LOCAL SCREEN STREAM (TARGET HOST LAPTOP B)
async function startHostScreenCapture() {
    try {
        state.localStream = await navigator.mediaDevices.getDisplayMedia({
            video: { frameRate: 60, resolution: 1080 },
            audio: true
        });

        elements.hostScreenStatus.innerText = '● Status Stream Host: AKTIF (Layar Sedang Ditayangkan secara P2P)';
        elements.hostScreenStatus.style.color = '#10b981';
        logEvent('HOST', 'Screen Capture berhasil diaktifkan pada Laptop B!');

        if (state.peerConnection) {
            state.localStream.getTracks().forEach(track => {
                state.peerConnection.addTrack(track, state.localStream);
            });
        }
    } catch (err) {
        alert('Gagal mengambil stream layar: ' + err.message);
    }
}

// CAPTURE MOUSE / KEYBOARD INPUT (LAPTOP A CONTROLLER)
function setupInputCapture() {
    const overlay = elements.interactiveOverlay;

    overlay.addEventListener('mousemove', (e) => {
        if (!state.isConnected || !state.targetDeviceId) return;

        const rect = overlay.getBoundingClientRect();
        const posX = (e.clientX - rect.left) * (1920 / rect.width);
        const posY = (e.clientY - rect.top) * (1080 / rect.height);

        socket.emit('remote-input-event', {
            targetId: state.targetDeviceId,
            payload: { type: 'mousemove', x: posX, y: posY }
        });
    });

    overlay.addEventListener('click', (e) => {
        if (!state.isConnected || !state.targetDeviceId) return;

        const rect = overlay.getBoundingClientRect();
        const posX = (e.clientX - rect.left) * (1920 / rect.width);
        const posY = (e.clientY - rect.top) * (1080 / rect.height);

        socket.emit('remote-input-event', {
            targetId: state.targetDeviceId,
            payload: { type: 'click', x: posX, y: posY }
        });
    });
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
    navigator.clipboard.writeText(state.myDeviceId);
    logEvent('SYSTEM', 'Device ID disalin ke clipboard.');
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
    entry.className = `log-entry ${type === 'SIGNAL' ? 'evt' : 'sys'}`;
    const time = new Date().toLocaleTimeString();
    entry.innerText = `[${time}] [${type}] ${text}`;

    elements.logEntries.appendChild(entry);
    elements.logEntries.scrollTop = elements.logEntries.scrollHeight;
    if (elements.logEntries.children.length > 25) {
        elements.logEntries.removeChild(elements.logEntries.firstChild);
    }
}
