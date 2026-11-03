const test = require('node:test');
const assert = require('node:assert/strict');
const { evictUserFromConversation } = require('../service/socketRoomAccess');

test('removes every user socket from the conversation room', async () => {
    const calls = [];
    const io = {
        in(room) {
            return {
                async socketsLeave(targetRoom) {
                    calls.push(['leave', room, targetRoom]);
                }
            };
        }
    };
    assert.deepEqual(await evictUserFromConversation(io, 7, 42), {
        evicted: true,
        disconnected: false
    });
    assert.deepEqual(calls, [['leave', 'user:7', 'conversation:42']]);
});

test('disconnects all user sockets if room eviction fails', async () => {
    const calls = [];
    const originalWarn = console.warn;
    console.warn = () => {};
    try {
        const io = {
            in(room) {
                return {
                    async socketsLeave() { throw Object.assign(new Error('adapter unavailable'), { code: 'ADAPTER_DOWN' }); },
                    async disconnectSockets(close) { calls.push(['disconnect', room, close]); }
                };
            }
        };
        assert.deepEqual(await evictUserFromConversation(io, 9, 88), {
            evicted: true,
            disconnected: true
        });
        assert.deepEqual(calls, [['disconnect', 'user:9', true]]);
    } finally {
        console.warn = originalWarn;
    }
});

test('fails closed if both room eviction and socket disconnection fail', async () => {
    const io = {
        in() {
            return {
                async socketsLeave() { throw new Error('leave failed'); },
                async disconnectSockets() { throw new Error('disconnect failed'); }
            };
        }
    };
    await assert.rejects(
        evictUserFromConversation(io, 9, 88),
        error => error.code === 'ROOM_ACCESS_REVOCATION_FAILED'
    );
});

test('rechecks membership after joining and leaves if membership was revoked during the join', async () => {
    const membershipResults = [true, false];
    const calls = [];
    const socket = {
        async join(room) { calls.push(['join', room]); },
        async leave(room) { calls.push(['leave', room]); }
    };
    const repository = {
        async isConversationMember(conversationId, userId) {
            assert.equal(conversationId, 42);
            assert.equal(userId, 7);
            return membershipResults.shift();
        }
    };
    const { joinConversationRoom } = require('../service/socketRoomAccess');
    assert.equal(await joinConversationRoom(socket, repository, 7, 42), false);
    assert.deepEqual(calls, [
        ['join', 'conversation:42'],
        ['leave', 'conversation:42']
    ]);
});

test('does not join a room when the initial membership check fails', async () => {
    const calls = [];
    const socket = {
        async join(room) { calls.push(['join', room]); },
        async leave(room) { calls.push(['leave', room]); }
    };
    const repository = {
        async isConversationMember() { return false; }
    };
    const { joinConversationRoom } = require('../service/socketRoomAccess');
    assert.equal(await joinConversationRoom(socket, repository, 7, 42), false);
    assert.deepEqual(calls, []);
});

test('leaves the private room if the post-join membership check fails', async () => {
    const calls = [];
    const socket = {
        async join(room) { calls.push(['join', room]); },
        async leave(room) { calls.push(['leave', room]); }
    };
    let checks = 0;
    const repository = {
        async isConversationMember() {
            checks += 1;
            if (checks === 1) return true;
            throw new Error('database unavailable');
        }
    };
    const { joinConversationRoom } = require('../service/socketRoomAccess');
    await assert.rejects(joinConversationRoom(socket, repository, 7, 42), /database unavailable/);
    assert.deepEqual(calls, [
        ['join', 'conversation:42'],
        ['leave', 'conversation:42']
    ]);
});

