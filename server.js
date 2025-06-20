const express = require("express");
const WebSocket = require("ws");
const http = require("http");
const path = require("path");
const easymidi = require("easymidi"); // MIDI input library

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve static files from ./public
app.use(express.static(path.join(__dirname, "public")));

// MIDI SETUP
const preferredInputs = ["IAC Driver Bus 1", "UMC1820", "Morningstar MC8"];
let midiInput = null;

// Try to connect to first available preferred device
for (const name of preferredInputs) {
    if (easymidi.getInputs().includes(name)) {
        midiInput = new easymidi.Input(name);
        console.log(`Connected to MIDI input: ${name}`);
        break;
    }
}

if (!midiInput) {
    console.warn("⚠️ No MIDI input found. Available inputs:");
    console.log(easymidi.getInputs());
}

// MIDI → WebSocket logic
if (midiInput) {
    midiInput.on("cc", msg => {
        console.log("MIDI CC Received:", msg);
        switch (msg.controller) {
            case 20: {
                const selectedSong = "lola"; // default song
                const duration = 269;        // 4:29
                const delayMs = 2000;
                const startAt = Date.now() + delayMs;

                broadcast({
                    action: "start",
                    song: selectedSong,
                    duration: duration,
                    startAt: startAt
                });
                break;
            }
            case 21:
                broadcast({ action: "pause" });
                break;
            case 22:
                broadcast({ action: "gotoStart" });
                break;
            default:
                console.log("Unmapped CC:", msg.controller);
        }
    });

    midiInput.on("noteon", msg => {
        console.log("Note On Received:", msg);
        // Example: trigger scroll based on note number
        if (msg.note === 60) broadcast({ action: "start" });
        if (msg.note === 61) broadcast({ action: "pause" });
        if (msg.note === 62) broadcast({ action: "gotoStart" });
    });
}

// WebSocket broadcast helper
function broadcast(data) {
    const message = JSON.stringify(data);
    console.log("Broadcasting:", message);
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// WebSocket connection handling
wss.on("connection", ws => {
    console.log("New client connected");

    ws.on("message", data => {
        console.log("Incoming from client:", data);
        broadcast(JSON.parse(data)); // echo to others
    });

    ws.on("close", () => {
        console.log("Client disconnected");
    });
});

// Start server
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
