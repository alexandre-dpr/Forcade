const fs = require('fs');
const https = require('https');
const WebSocket = require('ws');
const express = require('express');

// Créer une application Express
const app = express();
const IP = '0.0.0.0'

// Charger les certificats SSL
const server = https.createServer({
    cert: fs.readFileSync('../localhost.crt'),
    key: fs.readFileSync('../localhost.key')
}, app);

// Créer un serveur WebSocket sécurisé
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    console.log('Client connected');

    ws.on('message', (message) => {
        const messageStr = message.toString();
        console.log('Received message:', messageStr);
        // Diffuser le message à tous les clients connectés
        wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(messageStr);
            }
        });
    });

    ws.on('close', () => {
        console.log('Client disconnected');
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

// Démarrer le serveur HTTPS
server.listen(3000, IP,() => {
    console.log(`WebSocket signaling server is running on wss://${IP}:3000`);
});