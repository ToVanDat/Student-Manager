const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { Server } = require('socket.io');
const { io: createClient } = require('socket.io-client');
const {
    registerCallSignalingHandlers
} = require('../service/callSignalingHandlers');
const {
    isValidSessionDescription,
    isValidIceCandidate
} = require('../service/socketPayloadValidation');

const CALL_ID = 'call-integration-001';
const NEGOTIATION_ID = '8f14e45f-ea4a-4f2d-9b5d-7a6c8d9e0f11';
const OFFER = { type: 'offer', sdp: 'v=0\r\no=- 1 1 IN IP4 127.0.0.1\r\n' };
const ANSWER = { type: 'answer', sdp: 'v=0\r\no=- 2 2 IN IP4 127.0.0.1\r\n' };
const CANDIDATE = {
    candidate: 'candidate:1 1 UDP 2122260223 192.0.2.10 50000 typ host',
    sdpMid: '0',
    sdpMLineIndex: 0,
    usernameFragment: 'ufrag01'
};

const waitFor = (emitter, event, timeoutMs = 1500) =>
    new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            emitter.off(event, onEvent);
            reject(new Error(`Timed out waiting for ${event}`));
        }, timeoutMs);
        const onEvent = payload => {
            clearTimeout(timer);
            resolve(payload);
        };
        emitter.once(event, onEvent);
    });

const connectClient = (url, accessToken) => new Promise((resolve, reject) => {
    const client = createClient(url, {
        transports: ['websocket'],
        reconnection: false,
        timeout: 1500,
        auth: { accessToken }
    });
    client.once('connect', () => resolve(client));
    client.once('connect_error', error => {
        client.close();
        reject(error);
    });
});

test('real Socket.IO clients exercise production call signaling handlers', async t => {
    const httpServer = http.createServer();
    const io = new Server(httpServer, { transports: ['websocket'] });
    const authorizedPairs = new Set(['1:2', '2:1']);
    const statusByCall = new Map([[CALL_ID, 'connecting']]);

    io.use((socket, next) => {
        const token = socket.handshake.auth?.accessToken;
        const userId = ({ 'token-user-1': 1, 'token-user-2': 2, 'token-user-3': 3 })[token];
        if (!userId) return next(new Error('unauthorized'));
        socket.data.userId = userId;
        next();
    });

    io.on('connection', socket => {
        const userId = socket.data.userId;
        socket.join(`user:${userId}`);
        registerCallSignalingHandlers({
            socket,
            io,
            userId,
            allowRealtimeEvent: async () => true,
            getAuthorizedCall: async (callId, targetId) => {
                const pair = `${userId}:${targetId}`;
                if (callId !== CALL_ID || !authorizedPairs.has(pair)) return null;
                const status = statusByCall.get(callId);
                return status ? { status } : null;
            },
            isValidSessionDescription,
            isValidIceCandidate
        });
    });

    await new Promise(resolve => httpServer.listen(0, '127.0.0.1', resolve));
    const address = httpServer.address();
    const url = `http://127.0.0.1:${address.port}`;
    const clients = [];
    t.after(async () => {
        clients.forEach(client => client.close());
        await new Promise(resolve => io.close(resolve));
        if (httpServer.listening) await new Promise(resolve => httpServer.close(resolve));
    });

    const caller = await connectClient(url, 'token-user-1');
    const receiver = await connectClient(url, 'token-user-2');
    const outsider = await connectClient(url, 'token-user-3');
    clients.push(caller, receiver, outsider);

    await t.test('offer, answer and ICE are relayed only to the authorized peer', async () => {
        const receivedOffer = waitFor(receiver, 'call:offer');
        caller.emit('call:offer', {
            callId: CALL_ID, targetUserId: 2, negotiationId: NEGOTIATION_ID, offer: OFFER
        });
        assert.deepEqual(await receivedOffer, {
            callId: CALL_ID, fromUserId: 1, toUserId: 2,
            negotiationId: NEGOTIATION_ID, offer: OFFER
        });

        const receivedAnswer = waitFor(caller, 'call:answer');
        receiver.emit('call:answer', {
            callId: CALL_ID, targetUserId: 1, negotiationId: NEGOTIATION_ID, answer: ANSWER
        });
        assert.deepEqual(await receivedAnswer, {
            callId: CALL_ID, fromUserId: 2, toUserId: 1,
            negotiationId: NEGOTIATION_ID, answer: ANSWER
        });

        const receivedCandidate = waitFor(receiver, 'call:ice-candidate');
        caller.emit('call:ice-candidate', {
            callId: CALL_ID, targetUserId: 2,
            negotiationId: NEGOTIATION_ID, candidate: CANDIDATE
        });
        assert.deepEqual(await receivedCandidate, {
            callId: CALL_ID, fromUserId: 1, toUserId: 2,
            negotiationId: NEGOTIATION_ID, candidate: CANDIDATE
        });
    });

    await t.test('a non-participant cannot relay signaling into the call', async () => {
        let delivered = false;
        const onOffer = () => { delivered = true; };
        receiver.on('call:offer', onOffer);
        outsider.emit('call:offer', {
            callId: CALL_ID, targetUserId: 2, negotiationId: NEGOTIATION_ID, offer: OFFER
        });
        await new Promise(resolve => setTimeout(resolve, 100));
        receiver.off('call:offer', onOffer);
        assert.equal(delivered, false);
    });

    await t.test('malformed negotiation IDs and SDP/ICE payloads are rejected', async () => {
        const errors = [];
        const onError = payload => errors.push(payload);
        caller.on('call:error', onError);
        caller.emit('call:offer', {
            callId: CALL_ID, targetUserId: 2, negotiationId: 'not-a-uuid', offer: OFFER
        });
        caller.emit('call:offer', {
            callId: CALL_ID, targetUserId: 2, negotiationId: NEGOTIATION_ID,
            offer: { type: 'answer', sdp: 'invalid type' }
        });
        caller.emit('call:ice-candidate', {
            callId: CALL_ID, targetUserId: 2, negotiationId: NEGOTIATION_ID,
            candidate: { candidate: 'x'.repeat(4097) }
        });
        const deadline = Date.now() + 1500;
        while (errors.length < 3 && Date.now() < deadline) {
            await new Promise(resolve => setTimeout(resolve, 10));
        }
        caller.off('call:error', onError);
        assert.equal(errors.length, 3);
        assert.deepEqual(errors.map(error => error.code), [
            'INVALID_NEGOTIATION_ID',
            'INVALID_SIGNALING_PAYLOAD',
            'INVALID_SIGNALING_PAYLOAD'
        ]);
    });

    await t.test('terminal calls cannot continue signaling', async () => {
        statusByCall.delete(CALL_ID);
        let delivered = false;
        const onOffer = () => { delivered = true; };
        receiver.on('call:offer', onOffer);
        caller.emit('call:offer', {
            callId: CALL_ID, targetUserId: 2, negotiationId: NEGOTIATION_ID, offer: OFFER
        });
        await new Promise(resolve => setTimeout(resolve, 100));
        receiver.off('call:offer', onOffer);
        assert.equal(delivered, false);
    });
});
