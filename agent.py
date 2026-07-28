import os
import sys
import time
import json
import websocket

try:
    import pyautogui
except ImportError:
    print("Installing PyAutoGUI for OS Input Simulation...")
    os.system("pip install pyautogui websocket-client --break-system-packages")
    import pyautogui

print("=====================================================")
print("  AETHER REMOTE NATIVE AGENT (100% CLOUD WEBRTC AGENT)")
print("=====================================================")

pyautogui.FAILSAFE = False

if sys.platform.startswith('linux'):
    os.environ['DISPLAY'] = ':0'

# PeerJS Public Signaling Cloud WebSocket Server
SIGNALING_HOST = "0.peerjs.com"
PORT = 443
PEER_ID = "host-laptop-b"

def on_message(ws, message):
    try:
        data = json.loads(message)
        msg_type = data.get('type')
        payload = data.get('payload', {})

        if msg_type == 'OFFER' or msg_type == 'SIGNAL':
            print(f"[CLOUD SIGNAL] Received connection request from HP Controller!")

        # Parse Mouse & Keyboard Remote Input Payload
        if isinstance(payload, dict):
            event_type = payload.get('type')
            x = int(payload.get('x', 0))
            y = int(payload.get('y', 0))

            if event_type in ['mousemove', 'touchmove']:
                pyautogui.moveTo(x, y)
                print(f"[OS MOUSE MOVE] -> X: {x}, Y: {y}")

            elif event_type in ['click', 'tap']:
                pyautogui.moveTo(x, y)
                pyautogui.click()
                print(f"[OS MOUSE CLICK] -> Left Click at X: {x}, Y: {y}")

    except Exception as e:
        pass

def on_error(ws, error):
    print(f"[CLOUD RECONNECT] Retrying signaling stream...")

def on_close(ws, close_status_code, close_msg):
    print("[CLOUD DISCONNECTED] Reconnecting...")
    time.sleep(2)
    start_agent()

def on_open(ws):
    print("\n[SUCCESS] Native Agent Terhubung ke Cloud Engine Vercel!")
    print(f">>> PEER ID LAPTOP B ANDA: {PEER_ID}")
    print(">>> SIAP MENERIMA PERINTAH MOUSE DARI HP / VERCEL WEB!\n")

def start_agent():
    ws_url = f"wss://{SIGNALING_HOST}/peerjs?key=peerjs&id={PEER_ID}&token=aether"
    ws = websocket.WebSocketApp(
        ws_url,
        on_open=on_open,
        on_message=on_message,
        on_error=on_error,
        on_close=on_close
    )
    ws.run_forever()

if __name__ == "__main__":
    start_agent()
