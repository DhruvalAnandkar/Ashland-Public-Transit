const Ride = require('../models/Ride');
const AuditLog = require('../models/AuditLog');
const SocketService = require('./SocketService');
const { getNoShowFee } = require('../utils/fareCalculator');

/**
 * AutoCancelService
 *
 * Periodically expires rides that were never picked up so the fleet slot
 * is released and the rider sees the correct status.
 *
 * Rules (mirror Uber / Lyft industry norms adapted to APT's 30-minute window):
 *   - Pending rides that are more than 10 minutes past their scheduled
 *     time with no driver assignment → auto-cancelled ("EXPIRED — not
 *     dispatched in time"). Rider is not charged.
 *   - Confirmed rides that are more than 30 minutes past their scheduled
 *     pickup time and were never switched to En-Route → auto-flagged as
 *     "No Show" (rider is charged the APT no-show fee per fare class).
 */
class AutoCancelService {
    static POLL_INTERVAL_MS = 60 * 1000;         // 1 minute
    static PENDING_GRACE_MS = 10 * 60 * 1000;    // 10 minutes
    static CONFIRMED_GRACE_MS = 30 * 60 * 1000;  // 30 minutes (APT window)
    static _timer = null;

    static start() {
        if (this._timer) return;
        this._timer = setInterval(() => {
            this.runPass().catch((err) => {
                console.error('[AutoCancelService] Pass failed:', err.message);
            });
        }, this.POLL_INTERVAL_MS);
        // kick off an initial sweep quickly
        setTimeout(() => this.runPass().catch(() => { }), 5000);
        console.log('[AutoCancelService] Started (interval =', this.POLL_INTERVAL_MS, 'ms)');
    }

    static stop() {
        if (this._timer) clearInterval(this._timer);
        this._timer = null;
    }

    static async runPass() {
        const now = new Date();
        const pendingCutoff = new Date(now.getTime() - this.PENDING_GRACE_MS);
        const confirmedCutoff = new Date(now.getTime() - this.CONFIRMED_GRACE_MS);

        // 1. Expire stale PENDING rides (never dispatched)
        const stalePending = await Ride.find({
            status: 'Pending',
            scheduledTime: { $lt: pendingCutoff }
        });

        for (const ride of stalePending) {
            ride.status = 'Cancelled';
            ride.logs.push({
                user: 'System',
                action: 'Auto-Cancelled (Pending Expired)',
                details: `Ride was never dispatched within 10 minutes of scheduled time (${ride.scheduledTime.toISOString()}).`
            });
            ride.notifications.push({
                audience: 'Rider',
                message: `Ride ${ride.ticketId} was automatically cancelled because it was not dispatched in time. You were not charged.`
            });
            ride.notifications.push({
                audience: 'Dispatcher',
                message: `Ride ${ride.ticketId} auto-cancelled (Pending too long).`
            });
            await ride.save();

            await AuditLog.create({
                action: 'RIDE_AUTO_CANCELLED',
                performedBy: 'System',
                targetId: ride._id,
                targetModel: 'Ride',
                changes: { from: 'Pending', to: 'Cancelled' },
                metadata: 'Expired before dispatch'
            }).catch(() => { });

            try { SocketService.emitRideUpdate(ride); } catch { }
        }

        // 2. No-show sweep on CONFIRMED rides that never went En-Route
        const staleConfirmed = await Ride.find({
            status: 'Confirmed',
            scheduledTime: { $lt: confirmedCutoff }
        });

        for (const ride of staleConfirmed) {
            const noShowFee = getNoShowFee(ride.userType);
            ride.status = 'Cancelled';
            ride.paymentStatus = 'Invoiced';
            ride.finalizedFare = noShowFee;
            ride.logs.push({
                user: 'System',
                action: 'Marked No-Show',
                details: `Ride did not depart within 30 minutes of pickup window. No-show fee $${noShowFee.toFixed(2)} applied per APT policy.`
            });
            ride.notifications.push({
                audience: 'Rider',
                message: `Ride ${ride.ticketId} was marked as no-show. A $${noShowFee.toFixed(2)} fee applies per APT policy.`
            });
            ride.notifications.push({
                audience: 'Dispatcher',
                message: `No-show: ${ride.passengerName} (${ride.ticketId}) — $${noShowFee.toFixed(2)} fee.`
            });
            await ride.save();

            await AuditLog.create({
                action: 'RIDE_NO_SHOW',
                performedBy: 'System',
                targetId: ride._id,
                targetModel: 'Ride',
                changes: { from: 'Confirmed', to: 'Cancelled', fee: noShowFee },
                metadata: 'Auto no-show sweep'
            }).catch(() => { });

            try { SocketService.emitRideUpdate(ride); } catch { }
        }

        if (stalePending.length || staleConfirmed.length) {
            console.log(
                `[AutoCancelService] Swept: expired=${stalePending.length}, no-show=${staleConfirmed.length}`
            );
        }
    }
}

module.exports = AutoCancelService;
