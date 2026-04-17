const socketIo = require('socket.io');

/**
 * SocketService
 * Singleton utility to handle and broadcast all real-time WebSocket events.
 * Enhanced with GPS persistence, driver status changes, and SOS alerts.
 */
class SocketService {
    constructor() {
        this.io = null;
        this._lastDbWrite = {};
    }

    /**
     * Initializes the Socket.io server and defines event listeners.
     * @param {Object} server - The HTTP server instance.
     */
    init(server) {
        this.io = socketIo(server, {
            cors: {
                origin: '*',
                methods: ['GET', 'POST', 'PUT', 'DELETE'],
                credentials: true
            }
        });

        console.info('SocketService: Real-Time Engine Initialized.');

        this.io.on('connection', (socket) => {
            console.log(`Socket connected: ${socket.id}`);

            // --- Room Management ---
            socket.on('join_dispatcher_room', () => {
                socket.join('room_dispatcher');
                console.log(`Socket ${socket.id} joined room_dispatcher`);
            });

            socket.on('join_driver_room', (driverUsername) => {
                const roomName = `room_driver_${driverUsername}`;
                socket.join(roomName);
                console.log(`Socket ${socket.id} joined ${roomName}`);
            });

            socket.on('join_client_room', (clientId) => {
                const roomName = `room_client_${clientId}`;
                socket.join(roomName);
                console.log(`Socket ${socket.id} joined ${roomName}`);
            });

            // --- GPS Ping (Enhanced) ---
            // Mobile app sends every 5 seconds. Broadcasts immediately + debounced DB write.
            socket.on('driver_gps_ping', async (data) => {
                const {
                    driverUsername,
                    coordinates,
                    status,
                    vehicleName,
                    currentRideId,
                    driverId,
                    riderId
                } = data;
                if (Array.isArray(coordinates) && coordinates.length === 2) {
                    console.log(
                        `GPS ping from ${driverUsername || 'unknown'} @ ${coordinates[1]},${coordinates[0]}`
                    );
                }
                let resolvedRideId = currentRideId || null;
                let resolvedRiderId = riderId || null;

                // Fallback resolution: if client didn't include ride/rider IDs,
                // infer active assignment from DB using the driver username.
                if ((!resolvedRideId || !resolvedRiderId) && driverUsername) {
                    try {
                        const Ride = require('../models/Ride');
                        const Vehicle = require('../models/Vehicle');
                        const assignedVehicle = await Vehicle.findOne({ assignedDriver: driverUsername }).select('name');
                        if (assignedVehicle?.name) {
                            const activeRide = await Ride.findOne({
                                assignedVehicle: assignedVehicle.name,
                                status: { $in: ['Confirmed', 'En-Route'] },
                            }).select('_id riderId');
                            if (activeRide?._id) {
                                resolvedRideId = String(activeRide._id);
                                if (activeRide.riderId) {
                                    resolvedRiderId = String(activeRide.riderId);
                                }
                            }
                        }
                    } catch (err) {
                        console.error('GPS active-ride resolve failed:', err);
                    }
                }

                // 1. Always forward to dispatchers instantly (zero latency)
                this.io.to('room_dispatcher').emit('live_driver_location', {
                    driverUsername: driverUsername || 'Unknown',
                    driverId: driverId || null,
                    coordinates: coordinates || [0, 0],
                    status: status || 'Active',
                    vehicleName: vehicleName || '',
                    currentRideId: resolvedRideId,
                    timestamp: Date.now()
                });

                // 2. If on active ride, also forward to the rider
                if (resolvedRideId) {
                    this.io.to(`room_client_${resolvedRideId}`).emit('driver_location_update', {
                        coordinates,
                        driverUsername,
                        currentRideId: resolvedRideId,
                        timestamp: Date.now()
                    });
                }
                if (resolvedRiderId) {
                    this.io.to(`room_client_${resolvedRiderId}`).emit('driver_location_update', {
                        coordinates,
                        driverUsername,
                        currentRideId: resolvedRideId,
                        timestamp: Date.now()
                    });
                }

                // 3. Debounced DB persistence (write to User doc every 15s per driver)
                if (driverUsername) {
                    const now = Date.now();
                    const lastWrite = this._lastDbWrite[driverUsername] || 0;
                    if (now - lastWrite > 15000) {
                        this._lastDbWrite[driverUsername] = now;
                        const User = require('../models/User');
                        const Vehicle = require('../models/Vehicle');
                        User.findOneAndUpdate(
                            { username: driverUsername },
                            {
                                currentLocation: { type: 'Point', coordinates },
                                lastLocationUpdate: new Date(),
                                ...(status && { status })
                            }
                        ).catch(err => console.error('GPS DB write failed (User):', err));
                        Vehicle.findOneAndUpdate(
                            { assignedDriver: driverUsername },
                            { currentLocation: { type: 'Point', coordinates } }
                        ).catch(err => console.error('GPS DB write failed (Vehicle):', err));
                        if (resolvedRideId) {
                            const Ride = require('../models/Ride');
                            Ride.findByIdAndUpdate(
                                resolvedRideId,
                                {
                                    driverCoordinates: {
                                        type: 'Point',
                                        coordinates
                                    }
                                }
                            ).catch(err => console.error('GPS DB write failed (Ride):', err));
                        }
                    }
                }
            });

            // --- Driver Status Change ---
            // Fired when driver toggles Online/Break/Offline
            socket.on('driver_status_change', (data) => {
                const { driverUsername, status, driverId } = data;
                this.io.to('room_dispatcher').emit('driver_status_updated', {
                    driverUsername,
                    driverId,
                    status,
                    timestamp: Date.now()
                });
                if (driverUsername) {
                    const User = require('../models/User');
                    User.findOneAndUpdate(
                        { username: driverUsername },
                        { status }
                    ).catch(err => console.error('Status update DB write failed:', err));
                }
            });

            // --- Driver SOS Emergency ---
            socket.on('driver_sos', (data) => {
                const { driverUsername, coordinates, message } = data;
                this.io.to('room_dispatcher').emit('system_alert', {
                    type: 'SOS',
                    severity: 'critical',
                    driverUsername,
                    coordinates,
                    message: message || 'EMERGENCY: Driver triggered SOS',
                    timestamp: Date.now()
                });
                console.warn(`🚨 SOS ALERT from driver: ${driverUsername}`);
            });

            socket.on('disconnect', () => {
                console.log(`Socket disconnected: ${socket.id}`);
            });
        });
    }

    /**
     * Broadcasts a ride update to all relevant parties.
     * @param {Object} ride - The updated ride document.
     */
    emitRideUpdate(ride) {
        if (!this.io) {
            console.error('SocketService: Cannot emit, io is not initialized.');
            return;
        }

        // Always notify the dispatchers
        this.io.to('room_dispatcher').emit('ride_updated', ride);

        // Notify the specific assigned driver, if one exists
        if (ride.assignedVehicle !== 'Unassigned') {
            if (ride.assignedDriver) {
                this.io.to(`room_driver_${ride.assignedDriver}`).emit('manifest_updated', ride);
            }
        }

        // Notify the client about their specific ride
        if (ride.riderId) {
            this.io.to(`room_client_${ride.riderId}`).emit('ride_status_changed', ride);
        }
    }

    /**
     * Push a generalized alert to dispatchers.
     * @param {Object} alertPayload - The alert details
     */
    emitDispatcherAlert(alertPayload) {
        if (!this.io) return;
        this.io.to('room_dispatcher').emit('system_alert', alertPayload);
    }

    /**
     * Push a driver location update via REST (called from route handler).
     */
    emitDriverLocation(data) {
        if (!this.io) return;
        this.io.to('room_dispatcher').emit('live_driver_location', {
            ...data,
            timestamp: Date.now()
        });
        if (data?.currentRideId) {
            this.io.to(`room_client_${data.currentRideId}`).emit('driver_location_update', {
                coordinates: data.coordinates,
                driverUsername: data.driverUsername,
                currentRideId: data.currentRideId,
                timestamp: Date.now()
            });
        }
        if (data?.riderId) {
            this.io.to(`room_client_${data.riderId}`).emit('driver_location_update', {
                coordinates: data.coordinates,
                driverUsername: data.driverUsername,
                currentRideId: data.currentRideId || null,
                timestamp: Date.now()
            });
        }
    }
}

// Export a singleton instance
module.exports = new SocketService();
