import time
import os
import sys

try:
    import pyautogui
except ImportError:
    print("Installing PyAutoGUI for OS Input Simulation...")
    os.system("pip install pyautogui python-socketio websocket-client")
    import pyautogui

import socketio

sio = socketio.Client()

print("=====================================================")
print("  AETHER REMOTE NATIVE AGENT (PYTHON OS CONTROLLER)")
print("=====================================================")
print("Connecting Native Agent to Signaling Server...")

# Disable PyAutoGUI FailSafe for smooth edge movement
pyautogui.FAILSAFE = False

@sio.event
def connect():
    print("\n[SUCCESS] Native Agent Online & Connected!")
    device_id = "host-laptop-b"
    sio.emit('register-device', {'deviceId': device_id, 'role': 'host', 'osInfo': sys.platform})
    print(f">>> LAPTOP B DEVICE ID: {device_id}")
    print(">>> Siap menerima perintah mouse & keyboard dari HP!\n")

@sio.on('remote-input-event')
def on_remote_input(data):
    try:
        input_type = data.get('type')
        x = int(data.get('x', 0))
        y = int(data.get('y', 0))

        if input_type in ['mousemove', 'touchmove']:
            pyautogui.moveTo(x, y)
            print(f"[OS MOUSE MOVE] -> X: {x}, Y: {y}")

        elif input_type in ['click', 'tap']:
            pyautogui.moveTo(x, y)
            pyautogui.click()
            print(f"[OS MOUSE CLICK] -> Left Click at X: {x}, Y: {y}")

    except Exception as e:
        print(f"Error handling input: {e}")

try:
    sio.connect('http://localhost:8080')
    sio.wait()
except Exception as err:
    print(f"Connection Error: {err}")
