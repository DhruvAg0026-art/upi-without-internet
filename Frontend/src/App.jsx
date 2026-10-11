import { useEffect, useState } from 'react';
import {
  Activity,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Check,
  CircleAlert,
  Clock3,
  CloudUpload,
  Fingerprint,
  Radio,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldCheck,
  Signal,
  Wifi,
  WifiOff
} from 'lucide-react';

const initialAccounts = [
  { vpa: 'alice@demo', holderName: 'Alice', balance: 5000 },
  { vpa: 'bob@demo', holderName: 'Bob', balance: 1000 },
  { vpa: 'carol@demo', holderName: 'Carol', balance: 2500 },
  { vpa: 'dave@demo', holderName: 'Dave', balance: 500 }
];

const apiBaseUrl = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');

const formatRupees = value => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2
}).format(value);

async function request(path, options) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers }
  });
  const responseText = await response.text();
  let body = {};
  if (responseText) {
    try {
      body = JSON.parse(responseText);
    } catch {
      body.error = 'The API is unavailable. Start MongoDB and the Node server, then retry.';
    }
  }
  if (!response.ok) {
    const message = response.status >= 500
      ? 'API error. Check that MongoDB is running as a replica set and restart the Node server.'
      : body.error ?? `Request failed (${response.status})`;
    throw new Error(message);
  }
  return body;
}

function App() {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [transactions, setTransactions] = useState([]);
  const [devices, setDevices] = useState([]);
  const [claimCount, setClaimCount] = useState(0);
  const [senderVpa, setSenderVpa] = useState('alice@demo');
  const [receiverVpa, setReceiverVpa] = useState('bob@demo');
  const [amount, setAmount] = useState('500');
  const [pin, setPin] = useState('1234');
  const [activity, setActivity] = useState([]);
  const [busy, setBusy] = useState('');
  const [serverError, setServerError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  const log = message => setActivity(current => [
    { id: crypto.randomUUID(), message, time: new Date() },
    ...current
  ].slice(0, 24));

  const refresh = async () => {
    try {
      const [mesh, nextAccounts, nextTransactions] = await Promise.all([
        request('/api/mesh/state'),
        request('/api/accounts'),
        request('/api/transactions')
      ]);
      setDevices(mesh.devices);
      setClaimCount(mesh.idempotencyCacheSize);
      setAccounts(nextAccounts);
      setTransactions(nextTransactions);
      setServerError('');
      setLastUpdated(new Date());
    } catch (error) {
      setServerError(error.message);
    }
  };

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 3000);
    return () => window.clearInterval(timer);
  }, []);

  const runAction = async (action, callback) => {
    setBusy(action);
    try {
      await callback();
      await refresh();
    } catch (error) {
      log(`Action failed: ${error.message}`);
      setServerError(error.message);
    } finally {
      setBusy('');
    }
  };

  const sendPayment = () => runAction('send', async () => {
    const result = await request('/api/demo/send', {
      method: 'POST',
      body: JSON.stringify({
        senderVpa,
        receiverVpa,
        amount,
        pin,
        ttl: 5,
        startDevice: 'phone-alice'
      })
    });
    log(`Packet ${result.packetId.slice(0, 8)} encrypted and injected at ${result.injectedAt}.`);
    log(`Ciphertext ${result.ciphertextPreview}`);
  });

  const runGossip = () => runAction('gossip', async () => {
    const result = await request('/api/mesh/gossip', { method: 'POST' });
    log(`Gossip round moved ${result.transfers} packet(s) across the mesh.`);
  });

  const flushBridges = () => runAction('flush', async () => {
    const result = await request('/api/mesh/flush', { method: 'POST' });
    log(`${result.uploadsAttempted} bridge upload(s) processed.`);
    result.results.forEach(item => {
      log(`${item.bridgeNode} · ${item.packetId} · ${item.outcome}${item.reason ? ` (${item.reason})` : ''}`);
    });
  });

  const resetMesh = () => runAction('reset', async () => {
    await request('/api/mesh/reset', { method: 'POST' });
    log('Mesh and idempotency cache cleared. Account balances and ledger retained.');
  });

  const packetCount = new Set(devices.flatMap(device => device.packetIds)).size;
  const settledCount = transactions.filter(transaction => transaction.status === 'SETTLED').length;
  const onlineCount = devices.filter(device => device.hasInternet).length;

  return (
    <div className="app-shell">
      <aside className="rail">
        <a className="brand" href="#overview" aria-label="Rupi Mesh dashboard">
          <span className="brand-symbol"><Radio size={19} strokeWidth={2.2} /></span>
          <span className="brand-copy"><strong>RUPI</strong><small>OFFLINE MESH</small></span>
        </a>

        <div className="rail-label">WORKSPACE</div>
        <a className="nav-link active" href="#overview"><Activity size={16} />Overview</a>
        <a className="nav-link" href="#mesh"><Radio size={16} />Mesh network</a>
        <a className="nav-link" href="#accounts"><ArrowLeftRight size={16} />Accounts</a>
        <a className="nav-link" href="#ledger"><Clock3 size={16} />Ledger</a>

        <div className="rail-spacer" />
        <div className="rail-status">
          <span className="status-dot" />
          <span><strong>DEMO ENVIRONMENT</strong><small>Local simulation</small></span>
        </div>
        <div className="rail-footer">MESH PROTOCOL <span>v1.0</span></div>
      </aside>

      <main id="overview" className="main-content">
        <header className="topbar">
          <div className="breadcrumb">FIELD SYSTEMS <span>/</span> PAYMENT NETWORK</div>
          <div className="topbar-right">
            <span className="live-indicator"><span /> LIVE SIMULATION</span>
            <span className="topbar-divider" />
            <span className="node-mark"><Signal size={15} /> NODE 01</span>
          </div>
        </header>

        <section className="page-heading">
          <div>
            <p className="eyebrow">PAYMENTS WITHOUT A SIGNAL</p>
            <h1>Offline payment mesh</h1>
            <p className="heading-note">Encrypted payments travel device to device, then settle when a bridge reconnects.</p>
          </div>
          <div className="updated-label"><RefreshCw size={13} />
            {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : 'Connecting'}
          </div>
        </section>

        {serverError && <div className="error-banner"><CircleAlert size={17} />
          <span>{serverError}</span><button onClick={refresh} aria-label="Retry connection"><RefreshCw size={15} /></button>
        </div>}

        <section className="metrics" aria-label="Network summary">
          <article className="metric metric-highlight">
            <div className="metric-top"><span>DEVICES IN MESH</span><Radio size={16} /></div>
            <div className="metric-value">{devices.length || '—'}<small>nodes</small></div>
            <div className="metric-foot"><span className="metric-mark">{onlineCount} online</span><span>1 bridge connected</span></div>
          </article>
          <article className="metric">
            <div className="metric-top"><span>PACKETS IN TRANSIT</span><ArrowUpRight size={16} /></div>
            <div className="metric-value">{packetCount.toString().padStart(2, '0')}<small>unique</small></div>
            <div className="metric-foot">Across {devices.reduce((sum, device) => sum + device.packetCount, 0)} device holds</div>
          </article>
          <article className="metric">
            <div className="metric-top"><span>SETTLED PAYMENTS</span><Check size={16} /></div>
            <div className="metric-value">{settledCount.toString().padStart(2, '0')}<small>total</small></div>
            <div className="metric-foot">{transactions.length} recent ledger entries</div>
          </article>
          <article className="metric">
            <div className="metric-top"><span>DEDUPLICATION</span><Fingerprint size={16} /></div>
            <div className="metric-value">{claimCount.toString().padStart(2, '0')}<small>claims</small></div>
            <div className="metric-foot">Ciphertext hashes remembered</div>
          </article>
        </section>

        <section className="workspace-grid">
          <section className="panel compose-panel" aria-labelledby="compose-title">
            <div className="panel-heading">
              <div><span className="section-kicker">01 / COMPOSE</span><h2 id="compose-title">New payment</h2></div>
              <span className="secure-tag"><ShieldCheck size={14} /> ENCRYPTED</span>
            </div>
            <form onSubmit={event => { event.preventDefault(); sendPayment(); }}>
              <div className="field-row">
                <label className="field"><span>FROM ACCOUNT</span>
                  <select value={senderVpa} onChange={event => setSenderVpa(event.target.value)}>
                    {(accounts.length ? accounts : initialAccounts).map(account => <option key={account.vpa} value={account.vpa}>{account.holderName} · {account.vpa}</option>)}
                  </select>
                </label>
                <label className="field"><span>TO ACCOUNT</span>
                  <select value={receiverVpa} onChange={event => setReceiverVpa(event.target.value)}>
                    {(accounts.length ? accounts : initialAccounts).map(account => <option key={account.vpa} value={account.vpa}>{account.holderName} · {account.vpa}</option>)}
                  </select>
                </label>
              </div>
              <div className="field-row payment-details">
                <label className="field amount-field"><span>AMOUNT</span>
                  <span className="amount-input"><b>₹</b><input type="number" min="0.01" step="0.01" value={amount} onChange={event => setAmount(event.target.value)} required /></span>
                </label>
                <label className="field pin-field"><span>DEMO PIN</span>
                  <input type="password" inputMode="numeric" minLength="4" maxLength="8" value={pin} onChange={event => setPin(event.target.value)} required />
                </label>
              </div>
              <button className="primary-button" type="submit" disabled={busy !== '' || senderVpa === receiverVpa}>
                <Send size={16} />{busy === 'send' ? 'Encrypting packet…' : 'Inject into mesh'}<ArrowUpRight className="button-arrow" size={16} />
              </button>
              {senderVpa === receiverVpa && <p className="form-hint">Choose two different accounts to send a payment.</p>}
            </form>
            <div className="encryption-note"><ShieldCheck size={15} /><span>RSA-2048 + AES-256-GCM <i>·</i> fresh nonce per payment</span></div>
          </section>

          <section className="panel flow-panel" id="mesh" aria-labelledby="mesh-title">
            <div className="panel-heading">
              <div><span className="section-kicker">02 / ROUTE</span><h2 id="mesh-title">Mesh network</h2></div>
              <span className="mesh-status"><span /> {devices.length ? 'NETWORK READY' : 'CONNECTING'}</span>
            </div>
            <div className="mesh-visual">
              <div className="mesh-line" />
              <div className="device-grid">
                {devices.map((device, index) => (
                  <div className={`mesh-device ${device.hasInternet ? 'bridge-device' : ''}`} key={device.deviceId}>
                    <span className="device-index">0{index + 1}</span>
                    <div className="device-icon">{device.hasInternet ? <Wifi size={17} /> : <WifiOff size={17} />}</div>
                    <strong>{device.deviceId.replace('phone-', '')}</strong>
                    <span className={`device-state ${device.hasInternet ? 'online' : ''}`}>{device.hasInternet ? 'BRIDGE · 4G' : 'OFFLINE'}</span>
                    <span className="device-packets">{device.packetCount} packet{device.packetCount === 1 ? '' : 's'}</span>
                    {device.packetIds.length > 0 && <span className="packet-chip">{device.packetIds[0]}</span>}
                  </div>
                ))}
                {!devices.length && <div className="mesh-empty">Waiting for mesh state…</div>}
              </div>
            </div>
            <div className="mesh-actions">
              <div className="action-copy"><strong>Move packets through the mesh</strong><span>Gossip simulates nearby devices exchanging packets.</span></div>
              <div className="action-buttons">
                <button className="quiet-button" onClick={runGossip} disabled={busy !== ''}><Radio size={15} />Gossip</button>
                <button className="upload-button" onClick={flushBridges} disabled={busy !== ''}><CloudUpload size={15} />{busy === 'flush' ? 'Uploading…' : 'Bridge upload'}</button>
              </div>
            </div>
            <div className="mesh-bottom"><span><Fingerprint size={14} /> Duplicate packets are dropped before decryption.</span>
              <button className="reset-button" onClick={resetMesh} disabled={busy !== ''}><RotateCcw size={13} />Reset mesh</button>
            </div>
          </section>
        </section>

        <section className="data-grid">
          <section className="panel data-panel" id="accounts" aria-labelledby="accounts-title">
            <div className="panel-heading compact-heading">
              <div><span className="section-kicker">LIVE BALANCES</span><h2 id="accounts-title">Accounts</h2></div>
              <ArrowLeftRight className="panel-icon" size={17} />
            </div>
            <div className="table-wrap"><table>
              <thead><tr><th>ACCOUNT</th><th>VPA</th><th className="numeric">BALANCE</th></tr></thead>
              <tbody>{accounts.map((account, index) => <tr key={account.vpa}>
                <td><span className={`avatar avatar-${index % 4}`}>{account.holderName.slice(0, 1)}</span>{account.holderName}</td>
                <td className="mono muted-cell">{account.vpa}</td>
                <td className="numeric balance-cell">{formatRupees(account.balance)}</td>
              </tr>)}</tbody>
            </table></div>
          </section>

          <section className="panel data-panel ledger-panel" id="ledger" aria-labelledby="ledger-title">
            <div className="panel-heading compact-heading">
              <div><span className="section-kicker">LATEST ACTIVITY</span><h2 id="ledger-title">Transaction ledger</h2></div>
              <span className="ledger-count">{transactions.length} / 20</span>
            </div>
            <div className="table-wrap"><table>
              <thead><tr><th>TRANSFER</th><th>AMOUNT</th><th>ROUTE</th><th>STATUS</th></tr></thead>
              <tbody>{transactions.map(transaction => <tr key={transaction.id}>
                <td><span className="transfer-cell"><span className="transfer-icon"><ArrowUpRight size={14} /></span><span><strong>{transaction.senderVpa?.split('@')[0]}</strong><small><ArrowDownLeft size={11} />{transaction.receiverVpa?.split('@')[0]}</small></span></span></td>
                <td className="balance-cell">{formatRupees(transaction.amount)}</td>
                <td className="route-cell"><span>{transaction.bridgeNodeId}</span><small>{transaction.hopCount} hops</small></td>
                <td><span className={`transaction-status status-${transaction.status?.toLowerCase()}`}>{transaction.status}</span></td>
              </tr>)}</tbody>
            </table>{transactions.length === 0 && <div className="empty-row">No settled payments yet. Send a packet to start.</div>}</div>
          </section>
        </section>

        <section className="activity-panel" aria-labelledby="activity-title">
          <div className="activity-title"><Activity size={16} /><h2 id="activity-title">Activity stream</h2><span className="activity-count">{activity.length}</span></div>
          <div className="activity-list">
            {activity.length === 0
              ? <div className="activity-empty"><Clock3 size={14} />Actions and bridge responses will appear here.</div>
              : activity.slice(0, 5).map((item, index) => <div className="activity-item" key={item.id}>
                <span className={`activity-dot ${index === 0 ? 'fresh' : ''}`} />
                <span className="activity-message">{item.message}</span>
                <time>{item.time.toLocaleTimeString()}</time>
              </div>)}
          </div>
        </section>

        <footer className="page-footer"><span><ShieldCheck size={13} /> DEMONSTRATION ONLY · NOT A REAL UPI PAYMENT SYSTEM</span><span>PACKET CLAIMS {claimCount.toString().padStart(2, '0')}</span></footer>
      </main>
    </div>
  );
}

export default App;