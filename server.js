import express from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import cors from 'cors';
import dotenv from 'dotenv';
import compression from 'compression';
import { createServer } from 'http';
import { Server } from 'socket.io';
import crypto from 'crypto';
import Razorpay from 'razorpay';

dotenv.config();

// ============================================
// ENCRYPTION: AES-256-GCM for response data
// ============================================
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length < 16) {
    console.warn('⚠️  ENCRYPTION_KEY not set or too short in .env - using fallback (NOT SECURE FOR PRODUCTION)');
}
const FINAL_ENCRYPTION_KEY = ENCRYPTION_KEY || 'EventHorizon2026SecureKey32Bytes';
const ALGORITHM = 'aes-256-gcm';

function encryptData(data) {
    try {
        const iv = crypto.randomBytes(16);
        const key = Buffer.from(FINAL_ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

        const jsonStr = JSON.stringify(data);
        let encrypted = cipher.update(jsonStr, 'utf8', 'base64');
        encrypted += cipher.final('base64');

        const authTag = cipher.getAuthTag();

        return {
            encrypted: true,
            iv: iv.toString('base64'),
            authTag: authTag.toString('base64'),
            data: encrypted
        };
    } catch (error) {
        console.error('Encryption failed:', error);
        return data; // Fallback to unencrypted if error
    }
}

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(compression()); // Enable GZIP compression
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ============================================
// SECURITY: Rate limiting to prevent abuse
// ============================================
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 100; // Max requests per window per IP

app.use((req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const now = Date.now();

    if (!rateLimitMap.has(ip)) {
        rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    } else {
        const record = rateLimitMap.get(ip);
        if (now > record.resetTime) {
            record.count = 1;
            record.resetTime = now + RATE_LIMIT_WINDOW;
        } else {
            record.count++;
            if (record.count > RATE_LIMIT_MAX) {
                console.warn(`🚫 Rate limit exceeded for IP: ${ip}`);
                return res.status(429).json({ error: 'Too many requests. Please slow down.' });
            }
        }
    }
    next();
});

// Clean up old rate limit entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of rateLimitMap.entries()) {
        if (now > record.resetTime) {
            rateLimitMap.delete(ip);
        }
    }
}, 300000);

// SECURITY: Add security headers
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    // Note: HTTPS should be enforced at reverse proxy level (nginx/cloudflare)
    next();
});

io.on('connection', (socket) => {
    console.log('📱 User connected:', socket.id);
    socket.on('disconnect', () => {
        console.log('📱 User disconnected:', socket.id);
    });
});

// Request Logger for debugging latency
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        if (duration > 500) {
            console.log(`⚠️ Slow Request: ${req.method} ${req.originalUrl} took ${duration}ms`);
        }
    });
    next();
});

const uri = process.env.MONGODB_URI;
if (!uri) {
    console.error("❌ MONGODB_URI is missing from environment variables!");
    process.exit(1);
}

const client = new MongoClient(uri, {
    maxPoolSize: 50,
    minPoolSize: 5,
    maxConnecting: 10,
    waitQueueTimeoutMS: 5000,
    connectTimeoutMS: 10000,
    socketTimeoutMS: 45000,
});

// Proper cleanup on shutdown
process.on('SIGINT', async () => {
    await client.close();
    process.exit(0);
});
process.on('SIGTERM', async () => {
    await client.close();
    process.exit(0);
});

let db;

async function ensureIndexes() {
    if (!db) return;
    try {
        console.log("⚡ Ensuring Indexes...");
        // Events
        await db.collection('events').createIndex({ id: 1 }, { unique: true });
        await db.collection('events').createIndex({ organizerId: 1 });
        await db.collection('events').createIndex({ date: 1 });

        // Registrations
        await db.collection('registrations').createIndex({ id: 1 }, { unique: true });
        await db.collection('registrations').createIndex({ eventId: 1 });
        await db.collection('registrations').createIndex({ participantEmail: 1 });
        await db.collection('registrations').createIndex({ participantId: 1 });

        // Users
        await db.collection('users').createIndex({ id: 1 }, { unique: true });
        await db.collection('users').createIndex({ email: 1 }, { unique: true });
        await db.collection('users').createIndex({ role: 1 });

        // Teams
        await db.collection('teams').createIndex({ id: 1 }, { unique: true });
        await db.collection('teams').createIndex({ eventId: 1 });
        await db.collection('teams').createIndex({ inviteCode: 1 }, { unique: true });

        // Notifications
        await db.collection('notifications').createIndex({ userId: 1 });
        await db.collection('notifications').createIndex({ createdAt: -1 });

        console.log("✅ Indexes: Verified/Created");
    } catch (e) {
        console.error("❌ Indexes: Creation failed", e.message);
    }
}

async function connectDB() {
    try {
        console.log("----------------------------------------");
        console.log("Initializing Event Server...");

        // Check Gemini
        const geminiKey = process.env.GEMINI_API_KEY;
        if (geminiKey && geminiKey.length > 20) {
            console.log("✅ Gemini API Key: Found (Configured)");
        } else {
            console.log("❌ Gemini API Key: MISSING or INVALID (Check .env)");
        }

        // Connect Mongo
        await client.connect();
        console.log("✅ MongoDB: Connected Successfully");

        db = client.db(process.env.MONGODB_DB_NAME || 'event_horizon');
        await ensureIndexes();
        console.log("----------------------------------------");
    } catch (e) {
        console.log("❌ MongoDB: Connection Failed");
        console.error(e);
        console.log("----------------------------------------");
    }
}

connectDB();

// ============================================
// SECURITY: Role-based data filtering
// ============================================

// Check if user is organizer or collaborator for an event
function isOrganizerOrCollaborator(event, userId, userEmail) {
    if (!event || !userId) return false;
    if (event.organizerId === userId) return true;
    if (userEmail && event.collaboratorEmails && event.collaboratorEmails.includes(userEmail)) return true;
    return false;
}

// Sanitize event data for attendees (non-organizers)
function sanitizeEventForAttendee(event) {
    if (!event) return event;
    const sanitized = { ...event };
    // Remove sensitive organizer-only data
    delete sanitized.collaboratorEmails;
    delete sanitized.internalNotes;
    delete sanitized.stripeSecretKey;
    delete sanitized.webhookSecret;
    delete sanitized.razorpayKeySecret;
    delete sanitized.promoCodes; // Attendees shouldn't see all promo codes
    delete sanitized.ticketTiers; // Hide pricing tiers structure
    return sanitized;
}

// Filter registrations - attendees only see their own
function filterRegistrationsForUser(registrations, userId, userEmail, userManagedEventIds) {
    if (!Array.isArray(registrations)) return registrations;

    return registrations.filter(reg => {
        // User can see their own registration
        if (reg.participantId === userId) return true;
        if (reg.participantEmail === userEmail) return true;

        // Organizers/collaborators can see registrations for their events
        if (userManagedEventIds.has(reg.eventId)) return true;

        return false;
    });
}

// Filter teams - attendees only see teams they're part of
function filterTeamsForUser(teams, userId, userEmail, userManagedEventIds) {
    if (!Array.isArray(teams)) return teams;

    return teams.filter(team => {
        // User is team leader
        if (team.leaderId === userId) return true;

        // User is a team member
        if (team.members && team.members.some(m => m.userId === userId || m.email === userEmail)) return true;

        // Organizers/collaborators can see all teams for their events
        if (userManagedEventIds.has(team.eventId)) return true;

        return false;
    });
}

// Sanitize team data for non-organizers (hide invite code for teams they don't lead)
function sanitizeTeamForUser(team, userId) {
    if (!team) return team;
    const sanitized = { ...team };
    // Only team leader can see invite code
    if (team.leaderId !== userId) {
        delete sanitized.inviteCode;
    }
    return sanitized;
}

// Main sanitization function with user context
function sanitizeDataForUser(data, collectionName, userContext, allEvents = []) {
    const { userId, userEmail } = userContext;

    // Build set of event IDs user manages (as organizer or collaborator)
    const userManagedEventIds = new Set();
    allEvents.forEach(event => {
        if (isOrganizerOrCollaborator(event, userId, userEmail)) {
            userManagedEventIds.add(event.id);
        }
    });

    if (!Array.isArray(data)) {
        // Single document
        return sanitizeSingleDoc(data, collectionName, userContext, userManagedEventIds);
    }

    // Array of documents
    switch (collectionName) {
        case 'events':
            return data.map(event => {
                if (isOrganizerOrCollaborator(event, userId, userEmail)) {
                    return event; // Full access for organizers
                }
                return sanitizeEventForAttendee(event);
            });

        case 'registrations':
            return filterRegistrationsForUser(data, userId, userEmail, userManagedEventIds);

        case 'teams':
            const filteredTeams = filterTeamsForUser(data, userId, userEmail, userManagedEventIds);
            return filteredTeams.map(team => {
                if (userManagedEventIds.has(team.eventId)) {
                    return team; // Full access for organizers
                }
                return sanitizeTeamForUser(team, userId);
            });

        default:
            return data;
    }
}

function sanitizeSingleDoc(doc, collectionName, userContext, userManagedEventIds) {
    if (!doc) return doc;
    const { userId, userEmail } = userContext;

    switch (collectionName) {
        case 'events':
            if (isOrganizerOrCollaborator(doc, userId, userEmail)) {
                return doc;
            }
            return sanitizeEventForAttendee(doc);

        case 'registrations':
            // Only return if user owns this registration or manages the event
            if (doc.participantId === userId || doc.participantEmail === userEmail) {
                return doc;
            }
            if (userManagedEventIds.has(doc.eventId)) {
                return doc;
            }
            return null; // Hide registration from unauthorized users

        case 'teams':
            if (doc.leaderId === userId) return doc;
            if (doc.members?.some(m => m.userId === userId || m.email === userEmail)) {
                return sanitizeTeamForUser(doc, userId);
            }
            if (userManagedEventIds.has(doc.eventId)) {
                return doc;
            }
            return null;

        default:
            return doc;
    }
}

// Legacy sanitize functions for backward compatibility
function sanitizeDocument(doc, collectionName) {
    return doc; // Now handled by role-based filtering
}

function sanitizeDocuments(docs, collectionName) {
    return docs; // Now handled by role-based filtering
}

// ============================================

// Cache management endpoint
app.post('/api/cache/clear', (req, res) => {
    if (global.apiCache) {
        const size = global.apiCache.size;
        global.apiCache.clear();
        console.log(`🗑️ Cache cleared: ${size} entries removed`);
        res.json({ success: true, message: `Cleared ${size} cache entries` });
    } else {
        res.json({ success: true, message: 'Cache was already empty' });
    }
});

app.get('/api/cache/stats', (req, res) => {
    const size = global.apiCache?.size || 0;
    res.json({ entries: size, status: 'ok' });
});

// Razorpay Integration

// Use dummy keys if not provided (Test Mode)
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_YourKeyIdPlaceholder',
    key_secret: process.env.RAZORPAY_KEY_SECRET || 'YourKeySecretPlaceholder'
});

app.post('/api/create-payment-order', async (req, res) => {
    try {
        const { amount, currency = 'INR', receipt, notes } = req.body;

        const options = {
            amount: amount * 100, // Amount in paise
            currency,
            receipt,
            notes
        };

        const order = await razorpay.orders.create(options);
        res.json({ success: true, order });
    } catch (error) {
        console.error("Razorpay Order Error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/verify-payment', (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    // Use the same key_secret as initialized
    const key_secret = process.env.RAZORPAY_KEY_SECRET || 'YourKeySecretPlaceholder';

    const hmac = crypto.createHmac('sha256', key_secret);
    hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
    const generated_signature = hmac.digest('hex');

    if (generated_signature === razorpay_signature) {
        res.json({ success: true, message: "Payment Verified" });
    } else {
        res.status(400).json({ success: false, message: "Invalid Signature" });
    }
});

// Generic Data API Proxy
app.post('/api/action/:action', async (req, res) => {
    const { action } = req.params;
    const { collection, filter, document, update } = req.body;

    if (!db) return res.status(500).json({ error: "Database not connected" });

    let col;
    if (collection) {
        col = db.collection(collection);
    }

    // Simple In-Memory Cache for GET-like POST requests (find/findOne)
    // Cache key based on collection + action + filters
    const cacheKey = `${collection}:${action}:${JSON.stringify(req.body)}`;
    const CACHE_TTL = 30000; // 30 seconds

    if (!global.apiCache) global.apiCache = new Map();

    if (action === 'find' || action === 'findOne') {
        const cached = global.apiCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
            return res.json(cached.data);
        }
    }

    // Invalidate cache on mutations
    if (['insertOne', 'updateOne', 'deleteOne', 'deleteMany'].includes(action)) {
        // Clear all cache for this collection to be safe
        Array.from(global.apiCache.keys()).forEach(key => {
            if (key.startsWith(`${collection}:`)) {
                global.apiCache.delete(key);
            }
        });
    }

    try {
        let result;
        const setCache = (data) => {
            if (action === 'find' || action === 'findOne') {
                global.apiCache.set(cacheKey, { data, timestamp: Date.now() });
            }
        };
        switch (action) {
            case 'find':
                const query = filter || {};
                const options = {};
                if (req.body.limit) options.limit = parseInt(req.body.limit);
                if (req.body.projection) options.projection = req.body.projection;
                if (req.body.sort) options.sort = req.body.sort;

                result = await col.find(query, options).toArray();
                // SECURITY: Sanitize response to remove sensitive fields
                const sanitizedResult = sanitizeDocuments(result, collection);
                const responseData = { documents: sanitizedResult };
                setCache(responseData);
                res.json(responseData);
                break;

            case 'findOne':
                const findOneOptions = {};
                if (req.body.projection) findOneOptions.projection = req.body.projection;
                result = await col.findOne(filter || {}, findOneOptions);
                // SECURITY: Sanitize response (detail view for single document)
                const sanitizedOne = sanitizeDocument(result, collection);
                const responseDataOne = { document: sanitizedOne };
                setCache(responseDataOne);
                res.json(responseDataOne);
                break;

            case 'insertOne':
                result = await col.insertOne(document);
                // Real-time notifications
                if (collection === 'registrations') {
                    io.emit('data_updated', { collection: 'registrations', action: 'insert', eventId: document.eventId });
                } else if (collection === 'events') {
                    io.emit('data_updated', { collection: 'events', action: 'insert', document });
                } else if (collection === 'notifications') {
                    io.emit('notification_received', document);
                }
                res.json({ insertedId: result.insertedId });
                break;

            case 'updateOne':
                // MongoDB driver updateOne takes (filter, update)
                // Data API 'update' usually has operators like $set
                result = await col.updateOne(filter, update);
                if (collection === 'events' || collection === 'registrations') {
                    io.emit('data_updated', { collection, action: 'update', filter, update });
                }
                res.json(result);
                break;

            case 'deleteOne':
                result = await col.deleteOne(filter);
                if (collection === 'events' || collection === 'registrations') {
                    io.emit('data_updated', { collection, action: 'delete', filter });
                }
                res.json(result);
                break;

            case 'deleteMany':
                result = await col.deleteMany(filter);
                if (collection === 'events' || collection === 'registrations') {
                    io.emit('data_updated', { collection, action: 'delete_many', filter });
                }
                res.json(result);
                break;

            case 'fetchBatch':
                const { requests } = req.body;
                if (!Array.isArray(requests)) {
                    return res.status(400).json({ error: "requests must be an array" });
                }

                // SECURITY: Extract user context from headers
                const userContext = {
                    userId: req.headers['x-user-id'] || null,
                    userEmail: req.headers['x-user-email'] || null
                };

                // First, fetch all events to determine user permissions
                let allEvents = [];
                const eventsRequest = requests.find(r => r.collection === 'events');
                if (eventsRequest) {
                    const eventsCol = db.collection('events');
                    allEvents = await eventsCol.find({}).toArray();
                }

                // Execute all requests in parallel
                const results = await Promise.all(requests.map(async (reqItem) => {
                    const subCol = db.collection(reqItem.collection);
                    if (reqItem.action === 'find') {
                        const subQuery = reqItem.filter || {};
                        const subOptions = {};
                        if (reqItem.limit) subOptions.limit = parseInt(reqItem.limit);
                        if (reqItem.projection) subOptions.projection = reqItem.projection;
                        if (reqItem.sort) subOptions.sort = reqItem.sort;

                        const docs = await subCol.find(subQuery, subOptions).toArray();

                        // SECURITY: Apply role-based filtering
                        const filteredDocs = sanitizeDataForUser(docs, reqItem.collection, userContext, allEvents);
                        return { documents: filteredDocs };
                    } else if (reqItem.action === 'findOne') {
                        const subOptions = {};
                        if (reqItem.projection) subOptions.projection = reqItem.projection;
                        const doc = await subCol.findOne(reqItem.filter || {}, subOptions);

                        // SECURITY: Apply role-based filtering for single doc
                        const userManagedEventIds = new Set();
                        allEvents.forEach(event => {
                            if (isOrganizerOrCollaborator(event, userContext.userId, userContext.userEmail)) {
                                userManagedEventIds.add(event.id);
                            }
                        });
                        const filteredDoc = sanitizeSingleDoc(doc, reqItem.collection, userContext, userManagedEventIds);
                        return { document: filteredDoc };
                    }
                    return { error: "Unsupported batch action" };
                }));

                // SECURITY: Encrypt the response data
                const encryptedResponse = encryptData({ results });
                res.json(encryptedResponse);
                break;

            default:
                res.status(400).json({ error: "Unknown action" });
        }
    } catch (e) {
        console.error("Action failed", e);
        res.status(500).json({ error: e.message });
    }
});

const PORT = process.env.PORT || 5005;
httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
