import { recordSecurityEvent, SECURITY_EVENT_TYPES } from './securityEvents.js';

export const onRateLimitBlock = (req) =>
    recordSecurityEvent({
        type: SECURITY_EVENT_TYPES.RATE_LIMITED,
        ip: req.ip,
        path: req.path,
});