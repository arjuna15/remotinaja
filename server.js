const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname)));

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Connected Devices Registry (Realtime)
// deviceId -> { socketId, type: 'host'|'controller', osInfo, lastSeen }
const connectedDevices = new Map();

io.on('connection', (socket) => {
    console.log(`[NODE CONNECTED] Socket ID: ${socket.id}`);

    // 1. REGISTER DEVICE NODE
    socket.on('register-device', (data) => {
        const { deviceId, role, osInfo } = data;
        
        connectedDevices.set(deviceId, {
            socketId: socket.id,
            deviceId: deviceId,
            role: role || 'host',
            osInfo: osInfo || 'Unknown OS',
            connectedAt: new Date().toISOString()
        });

        socket.deviceId = deviceId;
        socket.role = role;

        console.log(`[REGISTER] Device ID: ${deviceId} (${role}) registered.`);
        
        // Broadcast updated online devices list to all connected controllers
        broadcastDeviceList();
    });

    // 2. WEBRTC SIGNALING: OFFER FROM CONTROLLER TO TARGET HOST
    socket.on('signal-offer', (data) => {
        const { targetId, offer, callerId } = data;
        const targetDevice = connectedDevices.get(targetId);

        if (targetDevice) {
            console.log(`[SIGNAL] Relay OFFER from ${callerId} -> ${targetId}`);
            io.to(targetDevice.socketId).emit('signal-offer', {
                callerId,
                offer
            });
        } else {
            socket.emit('signal-error', { message: `Device Target ID ${targetId} tidak ditemukan atau offline!` });
        }
    });

    // 3. WEBRTC SIGNALING: ANSWER FROM TARGET HOST TO CONTROLLER
    socket.on('signal-answer', (data) => {
        const { callerId, answer, targetId } = data;
        const callerDevice = connectedDevices.get(callerId);

        if (callerDevice) {
            console.log(`[SIGNAL] Relay ANSWER from ${targetId} -> ${callerId}`);
            io.to(callerDevice.socketId).emit('signal-answer', {
                targetId,
                answer
            });
        }
    });

    // 4. WEBRTC ICE CANDIDATE EXCHANGE
    socket.on('signal-ice-candidate', (data) => {
        const { toDeviceId, candidate, fromDeviceId } = data;
        const destDevice = connectedDevices.get(toDeviceId);

        if (destDevice) {
            io.to(destDevice.socketId).emit('signal-ice-candidate', {
                fromDeviceId,
                candidate
            });
        }
    });

    // 5. DIRECT INPUT REMOTE CONTROL PAYLOAD (Mouse/Keyboard Events)
    socket.on('remote-input-event', (data) => {
        const { targetId, payload } = data;
        const targetDevice = connectedDevices.get(targetId);

        if (targetDevice) {
            io.to(targetDevice.socketId).emit('remote-input-event', payload);
        }
    });

    // DISCONNECT HANDLER
    socket.on('disconnect', () => {
        if (socket.deviceId) {
            console.log(`[DISCONNECT] Device ID: ${socket.deviceId} disconnected.`);
            connectedDevices.delete(socket.deviceId);
            broadcastDeviceList();
        }
    });
});

function broadcastDeviceList() {
    const devicesList = Array.from(connectedDevices.values()).map(d => ({
        deviceId: d.deviceId,
        role: d.role,
        osInfo: d.osInfo
    }));

    io.emit('online-devices-update', devicesList);
}

const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`====================================================`);
    console.log(`AETHER REALTIME WEBRTC SIGNALING SERVER IS RUNNING  `);
    console.log(`Listening on http://0.0.0.0:${PORT}                   `);
    console.log(`====================================================`);
});
