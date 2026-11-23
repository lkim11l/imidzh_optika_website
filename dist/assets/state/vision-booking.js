// Only a local acceptance flag is persisted; never names, phones or request IDs.
export const VISION_BOOKING_KEY = 'imidzh-optika:vision-booking-accepted:v1';
export function createVisionBookingState({storage, onChange = () => {}} = {}) {
  let accepted = false;
  return {
    hasAccepted() {
      try { return accepted || storage?.getItem(VISION_BOOKING_KEY) === '1'; }
      catch { return accepted; }
    },
    accept(confirmation, {callback = false} = {}) {
      if (callback || confirmation?.accepted !== true ||
          !['vision_check', 'progressive'].includes(confirmation.direction)) return false;
      accepted = true;
      try { storage?.setItem(VISION_BOOKING_KEY, '1'); } catch {}
      onChange();
      return true;
    }
  };
}
let storage;
try { if (typeof window !== 'undefined') storage = window.localStorage; } catch {}
export const visionBookingState = createVisionBookingState({storage});
