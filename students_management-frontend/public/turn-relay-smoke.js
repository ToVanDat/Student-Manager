const apiInput = document.querySelector('#api');
const tokenInput = document.querySelector('#token');
const output = document.querySelector('#output');
const runButton = document.querySelector('#run');
const stopButton = document.querySelector('#stop');

let peers = [];
let cancelled = false;

function log(message, detail) {
  const suffix = detail === undefined ? '' : ' ' + JSON.stringify(detail);
  output.textContent += '\n' + new Date().toISOString() + ' ' + message + suffix;
}

function waitForIceGatheringComplete(pc, timeoutMs = 20000) {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('ICE gathering timed out. Check TURN DNS, firewall, TLS and credentials.'));
    }, timeoutMs);
    const onState = () => {
      if (pc.iceGatheringState === 'complete') {
        cleanup();
        resolve();
      }
    };
    const cleanup = () => {
      clearTimeout(timer);
      pc.removeEventListener('icegatheringstatechange', onState);
    };
    pc.addEventListener('icegatheringstatechange', onState);
    onState();
  });
}

async function selectedPair(pc) {
  const stats = await pc.getStats();
  let pair = null;
  for (const report of stats.values()) {
    if (report.type === 'transport' && report.selectedCandidatePairId) {
      pair = stats.get(report.selectedCandidatePairId);
      if (pair) break;
    }
    if (report.type === 'candidate-pair' && report.state === 'succeeded' &&
        (report.selected === true || report.nominated === true)) {
      pair = report;
    }
  }
  if (!pair) return null;
  const local = stats.get(pair.localCandidateId);
  const remote = stats.get(pair.remoteCandidateId);
  return {
    state: pair.state,
    nominated: pair.nominated,
    localCandidateType: local?.candidateType || 'unknown',
    remoteCandidateType: remote?.candidateType || 'unknown',
    protocol: local?.protocol || remote?.protocol || 'unknown',
    relayProtocol: local?.relayProtocol || remote?.relayProtocol || null
  };
}

async function waitForConnected(pc, timeoutMs = 20000) {
  if (pc.connectionState === 'connected') return;
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Peer connection did not reach connected state.'));
    }, timeoutMs);
    const onState = () => {
      if (pc.connectionState === 'connected') {
        cleanup();
        resolve();
      } else if (pc.connectionState === 'failed') {
        cleanup();
        reject(new Error('ICE connection failed. Inspect TURN service/auth/firewall.'));
      }
    };
    const cleanup = () => {
      clearTimeout(timer);
      pc.removeEventListener('connectionstatechange', onState);
    };
    pc.addEventListener('connectionstatechange', onState);
    onState();
  });
}

async function fetchIceConfig(apiBase, token) {
  const response = await fetch(apiBase.replace(/\/$/, '') + '/api/calls/ice-config', {
    method: 'GET',
    headers: { Authorization: 'Bearer ' + token },
    cache: 'no-store',
    credentials: 'include'
  });
  if (!response.ok) throw new Error('ICE config endpoint returned HTTP ' + response.status);
  const config = await response.json();
  if (!Array.isArray(config.iceServers) || !config.turnAvailable) {
    throw new Error('Backend did not return TURN servers. Check TURN_URIS and TURN_SHARED_SECRET.');
  }
  if (config.iceServers.some(server => server.username && server.credential)) {
    log('Received temporary TURN credentials; values are intentionally not displayed.');
  }
  return config.iceServers;
}

async function run() {
  cancelled = false;
  output.textContent = 'Starting forced-relay test...';
  runButton.disabled = true;
  stopButton.disabled = false;

  try {
    if (!window.RTCPeerConnection) throw new Error('This browser does not support WebRTC.');
    const token = tokenInput.value.trim();
    if (!token) throw new Error('Enter a valid access token.');
    const iceServers = await fetchIceConfig(apiInput.value.trim(), token);
    if (cancelled) return;

    const config = { iceServers, iceTransportPolicy: 'relay' };
    const left = new RTCPeerConnection(config);
    const right = new RTCPeerConnection(config);
    peers = [left, right];

    left.addEventListener('icecandidateerror', event => {
      log('Left ICE candidate error', { url: event.url, code: event.errorCode, text: event.errorText });
    });
    right.addEventListener('icecandidateerror', event => {
      log('Right ICE candidate error', { url: event.url, code: event.errorCode, text: event.errorText });
    });

    const channel = left.createDataChannel('turn-relay-smoke');
    const received = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Data channel message timed out.')), 10000);
      right.addEventListener('datachannel', event => {
        event.channel.addEventListener('message', message => {
          clearTimeout(timer);
          resolve(message.data);
        }, { once: true });
      }, { once: true });
    });

    const offer = await left.createOffer();
    await left.setLocalDescription(offer);
    await waitForIceGatheringComplete(left);
    await right.setRemoteDescription(left.localDescription);

    const answer = await right.createAnswer();
    await right.setLocalDescription(answer);
    await waitForIceGatheringComplete(right);
    await left.setRemoteDescription(right.localDescription);

    await Promise.all([waitForConnected(left), waitForConnected(right)]);
    const pair = await selectedPair(left);
    if (!pair) throw new Error('Connected but no selected candidate pair was exposed by getStats().');
    log('Selected candidate pair', pair);

    if (pair.localCandidateType !== 'relay' && pair.remoteCandidateType !== 'relay') {
      throw new Error('Connected without a relay candidate pair. This does not pass forced-relay acceptance.');
    }

    if (channel.readyState !== 'open') {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Data channel did not open.')), 10000);
        channel.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
      });
    }
    channel.send('student-manager-turn-relay-ok');
    const echoed = await received;
    if (echoed !== 'student-manager-turn-relay-ok') throw new Error('Unexpected data channel payload.');

    log('PASS: WebRTC data channel connected and selected candidate pair uses TURN relay.');
    log('Note: this validates ICE relay/data-channel transport, not microphone/camera RTP quality.');
  } catch (error) {
    log('FAIL', { message: error.message });
  } finally {
    peers.forEach(pc => pc.close());
    peers = [];
    tokenInput.value = '';
    runButton.disabled = false;
    stopButton.disabled = true;
  }
}

runButton.addEventListener('click', run);
stopButton.addEventListener('click', () => {
  cancelled = true;
  peers.forEach(pc => pc.close());
  peers = [];
  log('Stopped by user.');
  runButton.disabled = false;
  stopButton.disabled = true;
  tokenInput.value = '';
});
