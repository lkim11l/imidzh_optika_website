import {normalizeServiceBooking, bookingFailureMessage} from '../data/service-bookings.js';

/**
 * The same immutable payload retains its ID until acceptance or an edit.
 * Names/phones stay in this short-lived form state, never in analytics.
 */
export function createBookingController({
  submit, createId = () => crypto.randomUUID(), onAccepted = () => {}
}) {
  let busy = false, attempt = null;
  return Object.freeze({
    isBusy: () => busy,
    begin() {
      if (busy) return false;
      if (attempt?.accepted) attempt = null;
      return true;
    },
    async submit(values) {
      if (busy) return {status: 'busy'};
      let clean;
      try { clean = normalizeServiceBooking(values); }
      catch { return {status: 'error', message: bookingFailureMessage('invalid')}; }
      const fingerprint = JSON.stringify(clean);
      if (!attempt || attempt.fingerprint !== fingerprint) {
        attempt = {fingerprint, payload: {request_id: createId(), ...clean}, accepted: false};
      }
      const current = attempt;
      if (current.accepted) return {status: 'accepted', confirmation: current.confirmation};
      busy = true;
      try {
        const result = await submit({...current.payload});
        if (result?.accepted !== true || result.id !== current.payload.request_id ||
            result.direction !== current.payload.direction) {
          throw Object.assign(new Error('Unconfirmed response'), {code: 'unconfirmed'});
        }
        current.accepted = true;
        current.confirmation = {
          accepted: true, requestId: result.id, direction: result.direction
        };
        // A broken analytics integration cannot turn a saved request into an error.
        try { Promise.resolve(onAccepted({...current.confirmation})).catch(() => {}); } catch {}
        return {status: 'accepted', confirmation: {...current.confirmation}};
      } catch (error) {
        return {status: 'error', message: bookingFailureMessage(error?.code)};
      } finally {
        busy = false;
      }
    }
  });
}
