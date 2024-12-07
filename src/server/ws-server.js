import { WebSocketServer, WebSocket } from 'ws';

const wss = new WebSocketServer({ port: 3000 });
const onlineUsers = new Map();

function broadcastOnlineUsers() {
    const users = Array.from(onlineUsers.values());
    const message = JSON.stringify({
        type: 'online_users',
        users: users
    });
    
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

function heartbeat() {
    this.isAlive = true;
}

wss.on('connection', (ws) => {
    let userNickname = '';
    ws.isAlive = true;
    ws.on('pong', heartbeat);

    ws.on('message', (message) => {
        const data = JSON.parse(message.toString());
        
        if (data.type === 'join') {
            userNickname = data.nickname;
            onlineUsers.set(ws, userNickname);
            console.log(`Usuário conectado: ${userNickname}`);
            broadcastOnlineUsers();
        } else if (data.type === 'check_nickname') {
            const isNicknameAvailable = !Array.from(onlineUsers.values())
                .includes(data.newNickname);
            
            if (isNicknameAvailable) {
                onlineUsers.set(ws, data.newNickname);
                
                // Envia atualização para todos os clientes
                wss.clients.forEach(client => {
                    client.send(JSON.stringify({
                        type: 'nickname_changed',
                        oldNickname: data.oldNickname,
                        newNickname: data.newNickname
                    }));
                });

                ws.send(JSON.stringify({
                    type: 'nickname_response',
                    success: true,
                    newNickname: data.newNickname
                }));
                
                broadcastOnlineUsers();
            } else {
                ws.send(JSON.stringify({
                    type: 'nickname_response',
                    success: false
                }));
            }
        } else if (data.type === 'message') {
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({
                        type: 'message',
                        nickname: data.nickname,
                        message: data.message
                    }));
                }
            });
        }
    });

    ws.on('close', () => {
        onlineUsers.delete(ws);
        console.log(`Usuário desconectado: ${userNickname}`);
        broadcastOnlineUsers();
    });
});
const interval = setInterval(() => {
    wss.clients.forEach(ws => {
        if (ws.isAlive === false) {
            onlineUsers.delete(ws);
            return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
    });
    broadcastOnlineUsers();
}, 30000);

wss.on('close', () => {
    clearInterval(interval);
});

console.log('Servidor WebSocket rodando na porta 3000');