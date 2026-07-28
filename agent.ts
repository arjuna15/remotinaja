import { exec } from 'child_process';
import { Peer } from 'peerjs';

const agentPeerId = 'host-laptop-b';

console.log('=====================================================');
console.log('  AETHER REMOTE NATIVE AGENT (LAPTOP B HOST CONTROL)');
console.log('=====================================================');
console.log(`[INIT] Connecting Native OS Controller to PeerJS Cloud...`);

// Connect Native Host Agent to PeerJS Cloud
const peer = new Peer(agentPeerId, {
    debug: 2,
    config: {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
        ]
    }
});

peer.on('open', (id) => {
    console.log(`\n[SUCCESS] Native Agent Online!`);
    console.log(`>>> PEER ID LAPTOP B ANDA: ${id}`);
    console.log(`>>> Masukkan ID ini di HP / Browser Pengontrol Anda!\n`);
});

// LISTEN FOR INCOMING INPUT DATA FROM HP / CONTROLLER
peer.on('connection', (dataConn) => {
    console.log(`[CONNECT] Device HP/Controller terhubung: ${dataConn.peer}`);

    dataConn.on('data', (data: any) => {
        try {
            if (data.type === 'mousemove' || data.type === 'touchmove') {
                const targetX = Math.round(data.x);
                const targetY = Math.round(data.y);

                // Execute Native OS Mouse Move via xdotool / SendInput
                exec(`xdotool mousemove ${targetX} ${targetY}`);
                console.log(`[OS MOUSE MOVE] -> X: ${targetX}, Y: ${targetY}`);
            } else if (data.type === 'click' || data.type === 'tap') {
                const targetX = Math.round(data.x);
                const targetY = Math.round(data.y);

                exec(`xdotool mousemove ${targetX} ${targetY} click 1`);
                console.log(`[OS MOUSE CLICK] -> Left Click at X: ${targetX}, Y: ${targetY}`);
            }
        } catch (err) {
            console.error('Error executing OS input:', err);
        }
    });
});

peer.on('error', (err) => {
    console.error('[ERROR] PeerJS Error:', err);
});
