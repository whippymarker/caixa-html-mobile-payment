const express = require('express');
const WebSocket = require('ws');
const path = require('path');
const http = require('http');

const app = express();
// O Render define a porta através de uma variável de ambiente
const PORT = process.env.PORT || 10000; 

// Serve arquivos estáticos (HTML, CSS, JS) da pasta raiz do projeto
app.use(express.static(__dirname));

// Configura o servidor HTTP (necessário para o Express) e o servidor WebSocket (wss)
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Mapeia IDs de transação para as conexões de PC ativas
const activeConnections = new Map();

wss.on('connection', function connection(ws, req) {
    console.log('Nova conexão WebSocket estabelecida.');

    // Recebe mensagens do PC (início) ou do Celular (resposta)
    ws.on('message', function incoming(message) {
        try {
            const data = JSON.parse(message);

            if (data.type === 'START_TRANSACTION') {
                // Guarda a conexão do PC com o ID da transação
                const { transactionID } = data;
                activeConnections.set(transactionID, ws);
                console.log(`Transação iniciada e conexão guardada: ${transactionID}`);

            } else if (data.type === 'PAYMENT_RESPONSE') {
                // Recebe a resposta do celular
                const { transactionID, status } = data;
                const pcConnection = activeConnections.get(transactionID);

                if (pcConnection && pcConnection.readyState === WebSocket.OPEN) {
                    // Envia o status de pagamento de volta para o PC
                    pcConnection.send(JSON.stringify({
                        type: 'PAYMENT_STATUS',
                        status: status,
                        transactionID: transactionID
                    }));
                    
                    // Remove a conexão para a transação específica, pois ela foi finalizada
                    activeConnections.delete(transactionID);
                    console.log(`Status enviado para PC. Transação encerrada: ${transactionID}`);
                } else {
                    console.log(`Erro: Conexão PC para transação ${transactionID} não encontrada ou fechada.`);
                }
            }
        } catch (e) {
            console.error("Erro ao processar mensagem JSON:", e);
        }
    });

    // Limpa a conexão se o PC fechar a aba ou a conexão cair
    ws.on('close', () => {
        // Remove a referência de qualquer transação associada a esta conexão
        activeConnections.forEach((conn, id) => {
            if (conn === ws) {
                activeConnections.delete(id);
                console.log(`Conexão do PC removida (fechamento ou erro): ${id}`);
            }
        });
    });
});

// Inicia o servidor Node.js
server.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});