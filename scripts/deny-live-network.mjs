import net from 'node:net';
import tls from 'node:tls';
import http from 'node:http';
import https from 'node:https';
import {syncBuiltinESMExports} from 'node:module';

// Preload with `node --import ./scripts/deny-live-network.mjs ...`.
// A fixture process may use loopback HTTP, but cannot contact a live API or SMTP host.
const marker = Symbol.for('optikim.fixture-network-guard');
export const isLoopbackHost = value => ['localhost', '127.0.0.1', '::1', '::ffff:127.0.0.1']
  .includes(String(value ?? 'localhost').toLowerCase().replace(/^\[|\]$/g, ''));

function blocked() {
  const error = new Error('Fixture preview blocks non-loopback network.');
  error.code = 'ERR_TEST_NETWORK_BLOCKED';
  return error;
}
function checkURL(value) {
  let url;
  try { url = new URL(typeof value === 'string' || value instanceof URL ? value : value.url); }
  catch { throw blocked(); }
  if (!['http:', 'https:'].includes(url.protocol) || !isLoopbackHost(url.hostname) || url.username || url.password) throw blocked();
}
function checkSocket(args) {
  const first = args[0];
  const options = first && typeof first === 'object' ? first : {port:first, host:typeof args[1] === 'string' ? args[1] : undefined};
  // Unix sockets and pre-opened file descriptors are unnecessary in the preview.
  if (options.path || options.fd != null || !options.port || !isLoopbackHost(options.host)) throw blocked();
}
function checkRequest(args) {
  const first = args[0];
  if (typeof first === 'string' || first instanceof URL) checkURL(first);
  const options = typeof first === 'object' && !(first instanceof URL) ? first : args[1];
  if (options && typeof options === 'object') {
    if (options.socketPath || !isLoopbackHost(options.hostname ?? options.host)) throw blocked();
  }
}

export function installNoLiveNetwork() {
  if (globalThis[marker]) return globalThis[marker];
  const originalFetch = globalThis.fetch;
  const originalSocketConnect = net.Socket.prototype.connect;
  const originalTLSConnect = tls.connect;
  if (originalFetch) globalThis.fetch = async function fixtureFetch(input, init) {
    checkURL(input);
    // Redirects could otherwise escape loopback after the initial URL check.
    return originalFetch(input, {...init, redirect:init?.redirect==='manual'?'manual':'error'});
  };
  net.Socket.prototype.connect = function fixtureConnect(...args) {
    // Node internally passes normalized arguments as one array.
    checkSocket(Array.isArray(args[0]) ? args[0] : args);
    return originalSocketConnect.apply(this, args);
  };
  tls.connect = function fixtureTLSConnect(...args) {
    checkSocket(args);
    return originalTLSConnect.apply(this, args);
  };
  for (const module of [http, https]) {
    for (const method of ['request', 'get']) {
      const original = module[method];
      module[method] = function fixtureRequest(...args) {
        checkRequest(args);
        return original.apply(this, args);
      };
    }
  }
  syncBuiltinESMExports();
  const guard = Object.freeze({enabled:true, policy:'loopback-only'});
  Object.defineProperty(globalThis, marker, {value:guard});
  return guard;
}

export const networkGuard = installNoLiveNetwork();
