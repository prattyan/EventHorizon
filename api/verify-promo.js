
import { MongoClient } from 'mongodb';

let cachedClient = null;

async function getClient() {
    if (cachedClient) return cachedClient;

    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("Missing MONGODB_URI");

    const client = new MongoClient(uri, {
        tls: true,
        serverSelectionTimeoutMS: 5000,
    });

    await client.connect();
    cachedClient = client;
    return client;
}

export default async function handler(req, res) {
    // CORS Headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { eventId, code } = req.body;

        const client = await getClient();
        const db = client.db(process.env.MONGODB_DB_NAME || 'event_horizon');

        const event = await db.collection('events').findOne({ id: eventId });
        if (!event) {
            return res.status(404).json({ success: false, message: "Event not found" });
        }

        const promo = event.promoCodes?.find(p => p.code === code);
        if (promo) {
            // Check limits if applicable (future enhancement)
            return res.status(200).json({ success: true, promo });
        } else {
            return res.status(200).json({ success: false, message: "Invalid promo code" });
        }

    } catch (e) {
        console.error("Vercel API Error:", e);
        return res.status(500).json({
            error: "Server Error",
            details: e.message
        });
    }
}
