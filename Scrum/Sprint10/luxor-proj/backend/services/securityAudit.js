import { recordSecurityEvent, SECURITY_EVENT_TYPES } from './securityEvents.js';
import { clientIp } from './clientIp.js';

export const onRateLimitBlock = (req) =>
    recordSecurityEvent({
        type: SECURITY_EVENT_TYPES.RATE_LIMITED,
        ip: clientIp(req),
        path: req.path,
});