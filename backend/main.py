"""

Endpoints ported:
  POST /api/action/{action}    – Generic MongoDB CRUD proxy (+ fetchBatch)
  POST /api/create-payment-order
  POST /api/verify-payment
  POST /api/verify-promo
  POST /api/cache/clear
  GET  /api/cache/stats

"""

from __future__ import annotations

import os
import sys


_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

import asyncio
import base64
import hashlib
import hmac
import json
import time
import os
import io
from contextlib import asynccontextmanager
from functools import partial
from typing import Any
import httpx

import razorpay
import socketio
import uvicorn
from fastapi import FastAPI, Request, Response
from fastapi.responses import RedirectResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from starlette.middleware.base import BaseHTTPMiddleware


import uuid
import random
import smtplib
from dotenv import load_dotenv
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from config import (
    PORT,
    RAZORPAY_KEY_ID,
    RAZORPAY_KEY_SECRET,
    GEMINI_API_KEY,
    TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN,
    TWILIO_VERIFY_SERVICE_SID,
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASS,
    SMTP_FROM,
    FIREBASE_API_KEY,
)
from database import close_db, connect_db, get_db
import diskcache as dc
from encryption import encrypt_data
from security import (
    is_organizer_or_collaborator,
    sanitize_data_for_user,
    _sanitize_single_doc,
)
from notifications import notify_user
import google.generativeai as genai
import numpy as np

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

twilio_client = None
if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN:
    try:
        from twilio.rest import Client as TwilioClient
        twilio_client = TwilioClient(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
        print("✅ Twilio Client: Initialized")
    except Exception as _tw_err:
        print(f"⚠️ Twilio Init Warning: {_tw_err}")


# Persistent Local Cache
cache = dc.Cache(os.path.join(_BACKEND_DIR, ".cache"))
CACHE_TTL = 120 

rate_limit_map: dict[str, dict[str, Any]] = {}
RATE_LIMIT_WINDOW = 60  # seconds
RATE_LIMIT_MAX = 1000


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        ip = request.client.host if request.client else "unknown"
        now = time.time()

        record = rate_limit_map.get(ip)
        if record is None:
            rate_limit_map[ip] = {"count": 1, "resetTime": now + RATE_LIMIT_WINDOW}
        else:
            if now > record["resetTime"]:
                record["count"] = 1
                record["resetTime"] = now + RATE_LIMIT_WINDOW
            else:
                record["count"] += 1
                if record["count"] > RATE_LIMIT_MAX:
                    print(f"Rate limit exceeded for IP: {ip}")
                    return Response(
                        content=json.dumps({"error": "Too many requests. Please slow down."}),
                        status_code=429,
                        media_type="application/json",
                    )

        response = await call_next(request)
        return response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response


class SlowRequestLoggerMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start = time.time()
        response = await call_next(request)
        duration_ms = (time.time() - start) * 1000
        if duration_ms > 500:
            print(f"Slow Request: {request.method} {request.url.path} took {duration_ms:.0f}ms")
        return response


sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")


@sio.event
async def connect(sid, environ):
    print(f"📱 User connected: {sid}")


@sio.event
async def disconnect(sid):
    print(f"📱 User disconnected: {sid}")



@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    print("✅ Local Cache: Initialized")
    
    # Pre-warm or ensure cache directory for images
    image_cache_dir = os.path.join(_BACKEND_DIR, ".cache", "images")
    os.makedirs(image_cache_dir, exist_ok=True)
    
    yield
    close_db()
    cache.close()


app = FastAPI(title="EventHorizon API", lifespan=lifespan)


app.add_middleware(GZipMiddleware, minimum_size=500)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(SlowRequestLoggerMiddleware)


razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))

def _serialise(obj: Any) -> Any:
    from bson import ObjectId

    if isinstance(obj, ObjectId):
        return str(obj)
    if isinstance(obj, dict):
        return {k: _serialise(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_serialise(i) for i in obj]
    return obj


async def get_embedding(text: str) -> list[float]:
    """Generates embedding using Gemini API."""
    if not GEMINI_API_KEY:
        return []
    for model_name in ["models/gemini-embedding-001", "models/gemini-embedding-2", "models/text-embedding-004"]:
        try:
            result = await asyncio.to_thread(
                genai.embed_content,
                model=model_name,
                content=text
            )
            if result and "embedding" in result:
                return result["embedding"]
        except Exception:
            continue
    return []

def cosine_similarity(vec_a, vec_b):
    """Calculates cosine similarity between two vectors."""
    dot_product = np.dot(vec_a, vec_b)
    norm_a = np.linalg.norm(vec_a)
    norm_b = np.linalg.norm(vec_b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot_product / (norm_a * norm_b)


@app.post("/api/recommendations")
async def get_recommendations(request: Request):
    try:
        body = await request.json()
        user_id = body.get("userId")
        
        if not user_id:
            return Response(content=json.dumps({"error": "userId is required"}), status_code=400)

        db = get_db()
        
        # 1. Get last 3 registrations for this user
        registrations = list(db["registrations"].find({"participantId": user_id}).sort("registeredAt", -1).limit(3))
        if not registrations:
            # Fallback to general top events if no history
            upcoming_events = list(db["events"].find({"date": {"$gte": time.strftime("%Y-%m-%dT%H:%M:%S")}}).limit(3))
            return {"recommendations": _serialise(upcoming_events)}

        past_event_ids = [r["eventId"] for r in registrations]
        past_events = list(db["events"].find({"id": {"$in": past_event_ids}}))
        
        if not past_events:
            return {"recommendations": []}

        # 2. Generate reference vector (average of last 3 events)
        # We'll use title + description for embedding
        past_vectors = []
        for event in past_events:
            text = f"{event.get('title', '')} {event.get('description', '')}"
            vector = await get_embedding(text)
            if vector:
                past_vectors.append(vector)
        
        if not past_vectors:
            return {"recommendations": []}
            
        reference_vector = np.mean(past_vectors, axis=0)

        # 3. Get all upcoming events (excluding ones user already registered for)
        all_registered_ids = [r["eventId"] for r in db["registrations"].find({"participantId": user_id})]
        upcoming_events = list(db["events"].find({
            "id": {"$nin": all_registered_ids},
            "date": {"$gte": time.strftime("%Y-%m-%dT%H:%M:%S")},
            "status": "APPROVED"
        }))

        if not upcoming_events:
            return {"recommendations": []}

        # 4. Calculate similarities
        recommendations = []
        for event in upcoming_events:
            text = f"{event.get('title', '')} {event.get('description', '')}"
            event_vector = await get_embedding(text)
            if event_vector:
                score = cosine_similarity(reference_vector, event_vector)
                recommendations.append({
                    "event": event,
                    "score": float(score)
                })

        # 5. Sort by score and take top 3
        recommendations.sort(key=lambda x: x["score"], reverse=True)
        top_3 = [r["event"] for r in recommendations[:3]]

        return {"recommendations": _serialise(top_3)}

    except Exception as e:
        print(f"Recommendation error: {e}")
        return Response(content=json.dumps({"error": str(e)}), status_code=500)




@app.post("/api/cache/clear")
async def cache_clear():
    size = cache.clear()
    print(f"Cache cleared: {size} items removed")
    return {"success": True, "message": f"Cleared {size} cache entries"}


@app.get("/api/cache/stats")
async def cache_stats():
    return {
        "status": "ok",
        "size": int(len(cache)),  # type: ignore[arg-type]
        "directory": cache.directory
    }


@app.get("/api/event-image/{event_id}")
async def get_event_poster(event_id: str):
    """Dedicated high-speed endpoint for event posters with persistent caching."""
    cache_key = f"img:{event_id}"
    
    # 1. Try Cache First
    cached_image = cache.get(cache_key)
    if cached_image:
        return Response(content=cached_image, media_type="image/jpeg")
        
    try:
        db = get_db()
        event = await asyncio.to_thread(lambda: db["events"].find_one({"id": event_id}, {"imageUrl": 1}))
        
        if not event or not event.get("imageUrl"):
            # Fetch the title to make the placeholder more relevant
            title_query = event_id
            try:
                event_data = await asyncio.to_thread(lambda: db["events"].find_one({"id": event_id}, {"title": 1}))
                if event_data and event_data.get("title"):
                    title_query = event_data["title"].replace(" ", "+")
            except:
                pass
            return RedirectResponse(url=f"https://picsum.photos/seed/{title_query}/800/400")
            
        img_data = event["imageUrl"]
        
        # 1. Handle External URLs
        if img_data.startswith("http"):
             try:
                 async with httpx.AsyncClient() as client:
                     resp = await client.get(img_data, timeout=10.0)
                     if resp.status_code == 200:
                         binary_data = resp.content
                         content_type = resp.headers.get("Content-Type", "image/jpeg")
                         cache.set(cache_key, binary_data, expire=86400 * 7)
                         return Response(content=binary_data, media_type=content_type)
             except Exception as e:
                 print(f"Failed to proxy external image: {e}")
                 return RedirectResponse(url=img_data)

        # 2. Handle base64 data URL
        try:
            if "," in img_data:
                header, encoded = img_data.split(",", 1)
                binary_data = base64.b64decode(encoded)
                content_type = header.split(";")[0].split(":")[1]
            else:
                binary_data = base64.b64decode(img_data)
                content_type = "image/jpeg"

            cache.set(cache_key, binary_data, expire=86400 * 7)
            return Response(content=binary_data, media_type=content_type)
        except Exception as e:
            # Fallback to placeholder if base64 is invalid
            return RedirectResponse(url=f"https://picsum.photos/seed/{event_id}/800/400")
        
    except Exception as e:
        print(f"Image fetch error: {e}")
        return Response(status_code=500)



@app.post("/api/create-payment-order")
async def create_payment_order(request: Request):
    try:
        body = await request.json()
        amount = body.get("amount", 0)
        currency = body.get("currency", "INR")
        receipt = body.get("receipt")
        notes = body.get("notes")

        order = razorpay_client.order.create({  # type: ignore[attr-defined]
            "amount": int(amount * 100),
            "currency": currency,
            "receipt": receipt,
            "notes": notes or {},
        })
        return {"success": True, "order": _serialise(order)}
    except Exception as e:
        print(f"Razorpay Order Error: {e}")
        return Response(
            content=json.dumps({"success": False, "error": str(e)}),
            status_code=500,
            media_type="application/json",
        )


@app.post("/api/verify-payment")
async def verify_payment(request: Request):
    body = await request.json()
    razorpay_order_id = body.get("razorpay_order_id", "")
    razorpay_payment_id = body.get("razorpay_payment_id", "")
    razorpay_signature = body.get("razorpay_signature", "")

    message = f"{razorpay_order_id}|{razorpay_payment_id}"
    generated = hmac.new(
        RAZORPAY_KEY_SECRET.encode(),
        message.encode(),
        hashlib.sha256,
    ).hexdigest()

    if generated == razorpay_signature:

        event_id_promo = body.get("eventId")
        promo_code_used = body.get("promoCode")
        
        if event_id_promo and promo_code_used:
             try:
                db = get_db()
                event = db["events"].find_one({"id": event_id_promo})
                if event:
                    promo_codes = event.get("promoCodes") or []
                    updated = False
                    for p in promo_codes:
                        if p.get("code") == promo_code_used:
                            p["usedCount"] = p.get("usedCount", 0) + 1
                            updated = True
                            break
                    if updated:
                        db["events"].update_one({"id": event_id_promo}, {"$set": {"promoCodes": promo_codes}})
             except Exception as e:
                print(f"Failed to increment promo usage: {e}")

        return {"success": True, "message": "Payment Verified"}
    return Response(
        content=json.dumps({"success": False, "message": "Invalid Signature"}),
        status_code=400,
        media_type="application/json",
    )



@app.post("/api/verify-promo")
async def verify_promo(request: Request):
    body = await request.json()
    event_id = body.get("eventId")
    code = body.get("code")

    db = get_db()
    try:
        event = db["events"].find_one({"id": event_id})
        if not event:
            return Response(
                content=json.dumps({"success": False, "message": "Event not found"}),
                status_code=404,
                media_type="application/json",
            )

        promo_codes = event.get("promoCodes") or []
        promo = next((p for p in promo_codes if p.get("code") == code), None)

        if promo:
            limit = promo.get("usageLimit")
            used = promo.get("usedCount", 0)
            if limit and used >= limit:
                 return {"success": False, "message": "Promo code usage limit reached"}
            return {"success": True, "promo": _serialise(promo)}
        return {"success": False, "message": "Invalid promo code"}
    except Exception as e:
        print(f"Promo verification failed: {e}")
        return Response(
            content=json.dumps({"success": False, "error": str(e)}),
            status_code=500,
            media_type="application/json",
        )



@app.post("/api/action/{action}")
async def data_action(action: str, request: Request):
    body = await request.json()
    collection_name: str = body.get("collection", "")
    filter_doc: dict = body.get("filter") or {}
    document: dict = body.get("document") or {}
    update: dict = body.get("update") or {}

    db = get_db()
    if db is None:
        return Response(
            content=json.dumps({"error": "Database is not available"}),
            status_code=503,
            media_type="application/json",
        )

    if action != "fetchBatch" and not collection_name:
        return Response(
            content=json.dumps({"error": f"Field 'collection' is required for action '{action}'"}),
            status_code=400,
            media_type="application/json",
        )
    col = db[collection_name or "dummy"]

    cache_key = f"cache:{collection_name}:{action}:{hashlib.md5(json.dumps(body, sort_keys=True, default=str).encode()).hexdigest()}"

    if action in ("find", "findOne"):
        cached = cache.get(cache_key)
        if cached:
            return cached

    if action in ("insertOne", "updateOne", "updateMany", "deleteOne", "deleteMany"):
        # Invalidate all keys for this collection
        keys_to_delete = [k for k in cache.iterkeys() if str(k).startswith(f"cache:{collection_name}:")]
        for k in keys_to_delete:
            cache.delete(k)

    def set_cache(data: Any):
        if action in ("find", "findOne"):
            cache.set(cache_key, data, expire=CACHE_TTL)

    try:
        if action == "find":
            query = filter_doc
            limit_val = int(body["limit"]) if body.get("limit") else None
            projection = body.get("projection")
            sort = body.get("sort")

            def _do_find():
                cursor = col.find(query, projection)
                if sort:
                    cursor = cursor.sort([(k, v) for k, v in sort.items()])
                if limit_val:
                    cursor = cursor.limit(limit_val)
                return _serialise(list(cursor))

            result = await asyncio.to_thread(_do_find)

            response_data = {"documents": result}
            set_cache(response_data)
            return response_data

        elif action == "findOne":
            projection = body.get("projection")

            def _do_find_one():
                return _serialise(col.find_one(filter_doc, projection))

            result = await asyncio.to_thread(_do_find_one)
            response_data = {"document": result}
            set_cache(response_data)
            return response_data

        elif action == "insertOne":
            result = await asyncio.to_thread(col.insert_one, document)

            if collection_name == "registrations":
                await sio.emit("data_updated", {
                    "collection": "registrations",
                    "action": "insert",
                    "eventId": document.get("eventId"),
                })
            elif collection_name == "events":
                await sio.emit("data_updated", {
                    "collection": "events",
                    "action": "insert",
                    "document": _serialise(document),
                })
            elif collection_name == "teams":
                await sio.emit("data_updated", {
                    "collection": "teams",
                    "action": "insert",
                    "document": _serialise(document),
                })
            elif collection_name == "notifications":
                await sio.emit("notification_received", _serialise(document))
            elif collection_name == "messages":
                await sio.emit("data_updated", {
                    "collection": "messages",
                    "action": "insert",
                    "eventId": document.get("eventId"),
                    "document": _serialise(document),
                })

            return {"insertedId": str(result.inserted_id)}

        elif action == "updateOne":
            result = await asyncio.to_thread(col.update_one, filter_doc, update)

            if collection_name in ("events", "registrations", "teams", "messages"):
                await sio.emit("data_updated", {
                    "collection": collection_name,
                    "action": "update",
                    "filter": _serialise(filter_doc),
                    "update": _serialise(update),
                })

            return {
                "matchedCount": result.matched_count,
                "modifiedCount": result.modified_count,
                "upsertedCount": 1 if result.upserted_id else 0,
            }

        elif action == "updateMany":
            result = await asyncio.to_thread(col.update_many, filter_doc, update)

            if collection_name in ("events", "registrations", "teams", "messages"):
                await sio.emit("data_updated", {
                    "collection": collection_name,
                    "action": "update_many",
                    "filter": _serialise(filter_doc),
                    "update": _serialise(update),
                })

            return {
                "matchedCount": result.matched_count,
                "modifiedCount": result.modified_count,
                "upsertedCount": 1 if result.upserted_id else 0,
            }

        elif action == "deleteOne":
            result = await asyncio.to_thread(col.delete_one, filter_doc)

            if collection_name in ("events", "registrations", "teams", "messages"):
                await sio.emit("data_updated", {
                    "collection": collection_name,
                    "action": "delete",
                    "filter": _serialise(filter_doc),
                })

            return {"deletedCount": result.deleted_count}

        elif action == "deleteMany":
            result = await asyncio.to_thread(col.delete_many, filter_doc)

            if collection_name in ("events", "registrations", "teams", "messages"):
                await sio.emit("data_updated", {
                    "collection": collection_name,
                    "action": "delete_many",
                    "filter": _serialise(filter_doc),
                })

            return {"deletedCount": result.deleted_count}

        elif action == "fetchBatch":
            requests = body.get("requests")
            if not isinstance(requests, list):
                return Response(
                    content=json.dumps({"error": "requests must be an array"}),
                    status_code=400,
                    media_type="application/json",
                )

            # User context from headers
            user_context: dict[str, Any] = {
                "userId": request.headers.get("x-user-id"),
                "userEmail": request.headers.get("x-user-email"),
                "role": request.headers.get("x-user-role"),
            }

            # Pre-fetch user's team IDs so registrations for their teams can be accessed
            u_id = user_context.get("userId")
            u_email = user_context.get("userEmail")
            user_team_ids: set[str] = set()
            if u_id or u_email:
                conds = []
                if u_id:
                    conds.append({"leaderId": u_id})
                    conds.append({"members.userId": u_id})
                if u_email:
                    conds.append({"members.email": u_email})
                if conds:
                    matched_teams = await asyncio.to_thread(
                        lambda: list(db["teams"].find({"$or": conds}, {"id": 1}))
                    )
                    user_team_ids = {t.get("id") for t in matched_teams if t.get("id")}
            user_context["userTeamIds"] = user_team_ids

            # Fetch all events to determine permissions (in thread)
            all_events: list[dict] = []
            events_requested = any(r.get("collection") == "events" for r in requests)
            if events_requested:
                all_events = await asyncio.to_thread(
                    lambda: _serialise(list(db["events"].find({})))
                )

            # Run all sub-queries concurrently using asyncio.gather
            async def _run_sub_query(req_item: dict) -> dict:
                sub_col_name = req_item.get("collection", "")
                sub_col = db[sub_col_name]

                if req_item.get("action") == "find":
                    sub_query = req_item.get("filter") or {}
                    sub_projection = req_item.get("projection")
                    sub_sort = req_item.get("sort")
                    sub_limit = req_item.get("limit")

                    def _do_sub_find():
                        cur = sub_col.find(sub_query, sub_projection)
                        if sub_sort:
                            cur = cur.sort([(k, v) for k, v in sub_sort.items()])
                        if sub_limit:
                            cur = cur.limit(int(sub_limit))
                        return _serialise(list(cur))

                    docs = await asyncio.to_thread(_do_sub_find)
                    filtered = sanitize_data_for_user(docs, sub_col_name, user_context, all_events)
                    return {"documents": filtered}

                elif req_item.get("action") == "findOne":
                    sub_projection = req_item.get("projection")

                    doc = await asyncio.to_thread(
                        lambda: _serialise(sub_col.find_one(req_item.get("filter") or {}, sub_projection))
                    )

                    # Build managed event IDs for single doc sanitisation
                    user_managed = set()
                    for ev in all_events:
                        if is_organizer_or_collaborator(
                            ev, user_context.get("userId"), user_context.get("userEmail")
                        ):
                            user_managed.add(ev.get("id", ""))
                    filtered_doc = _sanitize_single_doc(doc, sub_col_name, user_context, user_managed)
                    return {"document": filtered_doc}
                else:
                    return {"error": "Unsupported batch action"}

            results = await asyncio.gather(*[_run_sub_query(r) for r in requests])

            encrypted_response = encrypt_data({"results": results})
            return encrypted_response

        else:
            return Response(
                content=json.dumps({"error": "Unknown action"}),
                status_code=400,
                media_type="application/json",
            )

    except Exception as e:
        print(f"Action failed: {e}")
        return Response(
            content=json.dumps({"error": str(e)}),
            status_code=500,
            media_type="application/json",
        )

    
def standardize_phone(phone: str) -> str:
    cleaned = phone.strip().replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
    if not cleaned.startswith("+"):
        cleaned = "+" + cleaned
    return cleaned


def get_twilio_credentials():
    acc_sid = os.getenv("TWILIO_ACCOUNT_SID", TWILIO_ACCOUNT_SID)
    auth_tok = os.getenv("TWILIO_AUTH_TOKEN", TWILIO_AUTH_TOKEN)
    v_sid = os.getenv("TWILIO_VERIFY_SERVICE_SID", TWILIO_VERIFY_SERVICE_SID)
    return acc_sid, auth_tok, v_sid


@app.get("/api/auth/twilio/status")
async def twilio_status():
    acc_sid, auth_tok, v_sid = get_twilio_credentials()
    if not acc_sid or not auth_tok or not v_sid:
        return {
            "isConfigured": False,
            "isAvailable": False,
            "status": "unconfigured",
            "message": "Twilio service is not configured in .env."
        }

    try:
        from twilio.rest import Client as TwilioClient
        client = TwilioClient(acc_sid, auth_tok)
        service = await asyncio.to_thread(lambda: client.verify.v2.services(v_sid).fetch())
        return {
            "isConfigured": True,
            "isAvailable": True,
            "status": "active",
            "friendlyName": getattr(service, 'friendly_name', 'Eventron Auth'),
            "message": "Twilio Verify service is active."
        }
    except Exception as e:
        print(f"Twilio Status Check Notice: {e}")
        return {
            "isConfigured": True,
            "isAvailable": True,
            "status": "active",
            "message": "Twilio Verify is available."
        }


@app.post("/api/auth/twilio/send-otp")
async def twilio_send_otp(request: Request):
    phone = ""
    try:
        body = await request.json()
        raw_phone = body.get("phoneNumber")
        channel = str(body.get("channel", "sms")).strip().lower()
        if channel not in ["sms", "call"]:
            channel = "sms"

        if not raw_phone:
            return Response(
                content=json.dumps({"success": False, "message": "Phone number is required."}),
                status_code=400,
                media_type="application/json",
            )

        phone = standardize_phone(raw_phone)
        acc_sid, auth_tok, v_sid = get_twilio_credentials()

        if not acc_sid or not auth_tok or not v_sid:
            print("⚠️ Twilio credentials missing in .env")
            return Response(
                content=json.dumps({
                    "success": False,
                    "message": "Twilio SMS service is not configured. Please add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_VERIFY_SERVICE_SID to .env."
                }),
                status_code=503,
                media_type="application/json",
            )

        from twilio.rest import Client as TwilioClient
        client = TwilioClient(acc_sid, auth_tok)

        # Send SMS verification via Twilio Verify
        verification = await asyncio.to_thread(
            lambda: client.verify.v2.services(v_sid).verifications.create(
                to=phone,
                channel=channel
            )
        )
        print(f"✅ Twilio OTP sent to {phone} via {channel.upper()} (Status: {verification.status})")

        return {
            "success": True,
            "status": verification.status if verification else "pending",
            "phoneNumber": phone,
            "channel": channel,
            "message": f"OTP sent to {phone} via {channel.upper()}."
        }

    except Exception as e:
        print(f"Twilio Send OTP Error: {e}")
        error_msg = str(e)
        if "is not a valid phone number" in error_msg:
            error_msg = "Invalid phone number format. Please include your country code (e.g. +91... or +1...)."
        elif "recipient must be a verified tester" in error_msg or "is unverified" in error_msg:
            display_phone = phone or "your phone number"
            error_msg = f"Trial Account Notice: Phone number {display_phone} is not a verified tester on your Twilio Trial account. Please add it to your Verified Caller IDs in the Twilio Console (Phone Numbers > Manage > Verified Caller IDs)."
        elif "custom friendly name" in error_msg.lower():
            error_msg = "Twilio configuration error: Custom friendly name parameter conflict."
        return Response(
            content=json.dumps({"success": False, "message": error_msg}),
            status_code=400,
            media_type="application/json",
        )




@app.post("/api/auth/twilio/verify-otp")
async def twilio_verify_otp(request: Request):
    try:
        body = await request.json()
        raw_phone = body.get("phoneNumber")
        otp = str(body.get("otp", "")).strip()

        if not raw_phone or not otp:
            return Response(
                content=json.dumps({"success": False, "message": "Phone number and OTP code are required."}),
                status_code=400,
                media_type="application/json",
            )

        phone = standardize_phone(raw_phone)
        acc_sid, auth_tok, v_sid = get_twilio_credentials()

        if not acc_sid or not auth_tok or not v_sid:
            return Response(
                content=json.dumps({
                    "success": False,
                    "message": "Twilio SMS service is not configured in .env."
                }),
                status_code=503,
                media_type="application/json",
            )

        from twilio.rest import Client as TwilioClient
        client = TwilioClient(acc_sid, auth_tok)

        verification_check = await asyncio.to_thread(
            lambda: client.verify.v2.services(v_sid).verification_checks.create(
                to=phone,
                code=otp
            )
        )


        if verification_check.status != "approved":
            return Response(
                content=json.dumps({"success": False, "message": "Invalid or expired OTP code."}),
                status_code=400,
                media_type="application/json",
            )

        # Verification successful! Look up or create profile in MongoDB
        db = get_db()
        profile = None

        if db is not None:
            variations = [phone, phone.replace("+", ""), phone[-10:]]
            unique_variations = list(set(variations))

            # 1. Search in admins collection
            for var in unique_variations:
                admin_doc = await asyncio.to_thread(lambda v=var: db["admins"].find_one({"phoneNumber": v}))
                if admin_doc:
                    profile = _serialise(admin_doc)
                    break

            # 2. Search in users collection
            if not profile:
                for var in unique_variations:
                    user_doc = await asyncio.to_thread(lambda v=var: db["users"].find_one({"phoneNumber": v}))
                    if user_doc:
                        profile = _serialise(user_doc)
                        break

            # 3. If profile exists, ensure isPhoneVerified is True
            if profile:
                pid = profile.get("id")
                role = profile.get("role", "attendee")
                col_name = "admins" if role in ["admin", "organizer"] else "users"
                profile["isPhoneVerified"] = True
                profile["phoneNumber"] = phone
                await asyncio.to_thread(
                    lambda: db[col_name].update_one(
                        {"id": pid},
                        {"$set": {"isPhoneVerified": True, "phoneNumber": phone}}
                    )
                )
            else:
                # 4. Create new user profile for phone login
                new_user_id = str(uuid.uuid4())
                new_user = {
                    "id": new_user_id,
                    "name": f"User {phone[-4:]}",
                    "email": phone,
                    "phoneNumber": phone,
                    "isPhoneVerified": True,
                    "role": "attendee",
                    "skills": [],
                    "bio": "",
                    "createdAt": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
                }
                await asyncio.to_thread(lambda: db["users"].insert_one(new_user.copy()))
                profile = _serialise(new_user)

        return {
            "success": True,
            "status": "approved",
            "phoneNumber": phone,
            "user": profile,
            "message": "Phone number verified successfully."
        }

    except Exception as e:
        print(f"Twilio Verify OTP Error: {e}")
        return Response(
            content=json.dumps({"success": False, "message": str(e)}),
            status_code=400,
            media_type="application/json",
        )


def send_twilio_comms_email(to_email: str, otp_code: str, subject: str, html_body: str) -> bool:
    load_dotenv(override=True)
    acc_sid, auth_tok, _ = get_twilio_credentials()
    if not (acc_sid and auth_tok):
        return False
    
    from_address = os.getenv("TWILIO_FROM_EMAIL", "")
    from_name = os.getenv("TWILIO_FROM_NAME", "Eventron")
    
    payload = {
        "from": {"address": from_address, "name": from_name},
        "to": [{"address": to_email}],
        "content": {
            "subject": subject,
            "html": html_body
        }
    }
    
    try:
        import requests
        resp = requests.post(
            "https://comms.twilio.com/v1/Emails",
            auth=(acc_sid, auth_tok),
            json=payload,
            timeout=12
        )
        if resp.status_code in [200, 201, 202]:
            print(f"✅ Twilio Comms Email sent to {to_email} (Status: {resp.status_code})")
            return True
        else:
            print(f"⚠️ Twilio Comms Email response ({resp.status_code}): {resp.text}")
            return False
    except Exception as e:
        print(f"❌ Twilio Comms Email Error: {e}")
        return False


def send_email_message(to_email: str, subject: str, html_body: str, text_body: str = "") -> bool:
    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
    load_dotenv(env_path, override=True)
    smtp_user = os.getenv("SMTP_USER", "").strip() or SMTP_USER
    smtp_pass = os.getenv("SMTP_PASS", "").strip() or SMTP_PASS
    smtp_host = os.getenv("SMTP_HOST", "").strip() or SMTP_HOST
    smtp_port = int(os.getenv("SMTP_PORT", str(SMTP_PORT)))
    smtp_from = os.getenv("SMTP_FROM", "").strip() or smtp_user or "noreply@eventron.com"

    if smtp_user and smtp_pass:
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"Eventron <{smtp_from}>"
            msg["To"] = to_email

            if text_body:
                msg.attach(MIMEText(text_body, "plain"))
            msg.attach(MIMEText(html_body, "html"))

            if smtp_port == 465:
                with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=15) as server:
                    server.login(smtp_user, smtp_pass)
                    server.sendmail(smtp_from, [to_email], msg.as_string())
            else:
                with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as server:
                    server.starttls()
                    server.login(smtp_user, smtp_pass)
                    server.sendmail(smtp_from, [to_email], msg.as_string())

            print(f"✅ SMTP Email OTP successfully sent to {to_email}: {subject}")
            return True
        except Exception as e:
            print(f"❌ SMTP Send Error to {to_email}: {e}")
            return False
    else:
        print(f"📧 [EMAIL OTP (DEVELOPMENT MODE - SMTP NOT CONFIGURED IN .ENV)] To: {to_email} | Subject: {subject}")
        return False


@app.post("/api/auth/email/send-delete-otp")
async def send_email_delete_otp(request: Request):
    try:
        body = await request.json()
        email = str(body.get("email", "")).strip().lower()
        user_id = body.get("userId")

        if not email or "@" not in email:
            return Response(
                content=json.dumps({"success": False, "message": "A valid email address is required."}),
                status_code=400,
                media_type="application/json",
            )

        otp_code = str(random.randint(100000, 999999))
        cache_key = f"delete_otp_{email}"
        cache.set(cache_key, otp_code, expire=600)  # 10 minutes TTL

        subject = "Eventron - Account Deletion Verification Code"
        html_body = f"""
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; padding: 40px 15px; margin: 0;">
            <div style="max-width: 480px; margin: auto; background-color: #ffffff; border-radius: 20px; padding: 36px 28px; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0;">
                
                <!-- Header -->
                <div style="text-align: center; margin-bottom: 28px;">
                    <h1 style="color: #ea580c; font-size: 30px; margin: 0; font-weight: 800; letter-spacing: -0.5px;">Eventron</h1>
                    <p style="color: #64748b; font-size: 11px; margin-top: 6px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px;">Security & Account Verification</p>
                </div>

                <!-- Main Content Card -->
                <div style="background-color: #f8fafc; border-radius: 16px; padding: 24px; border: 1px solid #fee2e2;">
                    <h2 style="color: #dc2626; font-size: 17px; margin-top: 0; margin-bottom: 12px; font-weight: 700;">
                        Account Deletion Request
                    </h2>
                    <p style="color: #334155; font-size: 14px; line-height: 1.6; margin-bottom: 22px;">
                        We received a request to permanently delete your Eventron account. Please enter the verification code below to confirm this action:
                    </p>
                    
                    <!-- OTP Box -->
                    <div style="text-align: center; margin: 24px 0;">
                        <div style="display: inline-block; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #ea580c; background-color: #fff7ed; padding: 16px 28px; border-radius: 14px; border: 2px solid #fdba74; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; box-shadow: 0 4px 12px rgba(234, 88, 12, 0.08);">
                            {otp_code}
                        </div>
                    </div>

                    <!-- Warning / Notice Box -->
                    <div style="background-color: #ffffff; border-radius: 10px; padding: 14px; border: 1px solid #fecaca; margin-top: 20px;">
                        <p style="color: #475569; font-size: 12px; line-height: 1.5; margin: 0 0 8px 0;">
                            ⏳ This code is valid for <strong>10 minutes</strong>.
                        </p>
                        <p style="color: #b91c1c; font-size: 12px; line-height: 1.5; margin: 0;">
                            ⚠️ <strong>Warning:</strong> Deleting your account is irreversible. All your tickets, events, and profile data will be permanently removed.
                        </p>
                    </div>
                    
                    <p style="color: #64748b; font-size: 11px; line-height: 1.5; margin-top: 16px; margin-bottom: 0;">
                        If you did not request this, please disregard this email and secure your account immediately.
                    </p>
                </div>

                <!-- Footer -->
                <p style="text-align: center; color: #94a3b8; font-size: 11px; margin-top: 28px; margin-bottom: 0;">
                    &copy; 2026 Eventron. All rights reserved.
                </p>
            </div>
        </div>
        """
        text_body = f"Your Eventron account deletion verification code is: {otp_code}\n\nThis code expires in 10 minutes. If you did not request this, please ignore this email."

        # 1. Primary: Send email with 6-digit OTP via SMTP (Fast, direct, works for all emails)
        sent_smtp = await asyncio.to_thread(send_email_message, email, subject, html_body, text_body)

        # 2. Secondary fallback: Send email via Twilio Comms Email API if SMTP fails
        sent_twilio_comms = False
        if not sent_smtp:
            sent_twilio_comms = await asyncio.to_thread(send_twilio_comms_email, email, otp_code, subject, html_body)

        # 3. Tertiary fallback: Twilio Verify Service Email if needed
        sent_twilio_verify = False
        if not (sent_smtp or sent_twilio_comms):
            acc_sid, auth_tok, v_sid = get_twilio_credentials()
            if acc_sid and auth_tok and v_sid:
                try:
                    from twilio.rest import Client as TwilioClient
                    client = TwilioClient(acc_sid, auth_tok)
                    verification = await asyncio.to_thread(
                        lambda: client.verify.v2.services(v_sid).verifications.create(
                            to=email,
                            channel="email"
                        )
                    )
                    if verification.status in ["pending", "approved"]:
                        sent_twilio_verify = True
                        print(f"✅ Twilio Verify Email OTP sent to {email}")
                except Exception as twilio_err:
                    print(f"⚠️ Twilio Verify Error: {twilio_err}")

        email_delivered = sent_smtp or sent_twilio_comms or sent_twilio_verify
        print(f"🔑 [EMAIL DELETION OTP] OTP for {email} delivered: {email_delivered} (SMTP: {sent_smtp}, Comms: {sent_twilio_comms}, Verify: {sent_twilio_verify})")

        if not email_delivered:
            return Response(
                content=json.dumps({
                    "success": False,
                    "message": "Failed to send verification email. Please check your network or try again."
                }),
                status_code=500,
                media_type="application/json",
            )

        return {
            "success": True,
            "message": f"Verification code sent to {email}.",
            "email": email
        }



    except Exception as e:
        print(f"Send Email Delete OTP Error: {e}")
        return Response(
            content=json.dumps({"success": False, "message": str(e)}),
            status_code=500,
            media_type="application/json",
        )


@app.post("/api/auth/email/verify-delete-otp")
async def verify_email_delete_otp(request: Request):
    try:
        body = await request.json()
        email = str(body.get("email", "")).strip().lower()
        user_id = body.get("userId")
        otp = str(body.get("otp", "")).strip()
        is_organizer = bool(body.get("isOrganizer", False))

        if not email or not otp or not user_id:
            return Response(
                content=json.dumps({"success": False, "message": "Email, userId, and OTP code are required."}),
                status_code=400,
                media_type="application/json",
            )

        # 1. Try Twilio Verify check
        acc_sid, auth_tok, v_sid = get_twilio_credentials()
        verified_by_twilio = False
        if acc_sid and auth_tok and v_sid:
            try:
                from twilio.rest import Client as TwilioClient
                client = TwilioClient(acc_sid, auth_tok)
                check = await asyncio.to_thread(
                    lambda: client.verify.v2.services(v_sid).verification_checks.create(
                        to=email,
                        code=otp
                    )
                )
                if check.status == "approved":
                    verified_by_twilio = True
                    print(f"✅ Twilio Verify approved email OTP for {email}")
            except Exception:
                pass

        cache_key = f"delete_otp_{email}"
        saved_otp = cache.get(cache_key)

        if not verified_by_twilio and (not saved_otp or str(saved_otp) != str(otp)):
            return Response(
                content=json.dumps({"success": False, "message": "Invalid or expired verification code."}),
                status_code=400,
                media_type="application/json",
            )

        # OTP verified -> delete from cache
        cache.delete(cache_key)

        # Permanently delete user data from MongoDB
        db = get_db()
        if db is not None:
            await asyncio.to_thread(lambda: db["users"].delete_one({"id": user_id}))
            await asyncio.to_thread(lambda: db["admins"].delete_one({"id": user_id}))
            await asyncio.to_thread(lambda: db["registrations"].delete_many({"participantId": user_id}))
            await asyncio.to_thread(lambda: db["notifications"].delete_many({"userId": user_id}))
            await asyncio.to_thread(lambda: db["messages"].delete_many({"userId": user_id}))
            await asyncio.to_thread(lambda: db["reviews"].delete_many({"userId": user_id}))

            if is_organizer:
                events = await asyncio.to_thread(lambda: list(db["events"].find({"organizerId": user_id})))
                for ev in events:
                    ev_id = ev.get("id")
                    await asyncio.to_thread(lambda: db["registrations"].delete_many({"eventId": ev_id}))
                    await asyncio.to_thread(lambda: db["messages"].delete_many({"eventId": ev_id}))
                    await asyncio.to_thread(lambda: db["reviews"].delete_many({"eventId": ev_id}))
                    await asyncio.to_thread(lambda: db["teams"].delete_many({"eventId": ev_id}))
                await asyncio.to_thread(lambda: db["events"].delete_many({"organizerId": user_id}))

        return {
            "success": True,
            "message": "Account and all associated data have been permanently deleted."
        }

    except Exception as e:
        print(f"Verify Email Delete OTP Error: {e}")
        return Response(
            content=json.dumps({"success": False, "message": str(e)}),
            status_code=500,
            media_type="application/json",
        )


@app.post("/api/subscribe")
async def subscribe_user(request: Request):
    try:
        body = await request.json()
        user_id = body.get("userId")
        subscription = body.get("subscription")

        if not user_id or not subscription:
            return Response(content=json.dumps({"error": "Missing data"}), status_code=400, media_type="application/json")

        db = get_db()
        if db is not None:
            await asyncio.to_thread(
                db.users.update_one,
                {"id": user_id},
                {"$pull": {"pushSubscriptions": {"endpoint": subscription.get("endpoint")}}}
            )
            
            await asyncio.to_thread(
                db.users.update_one,
                {"id": user_id},
                {"$push": {"pushSubscriptions": subscription}}
            )

        return {"status": "ok"}
    except Exception as e:
        print(f"Subscription error: {e}")
        return Response(content=json.dumps({"error": str(e)}), status_code=500, media_type="application/json")


@app.post("/api/send-push")
async def send_push_endpoint(request: Request):
    try:
        body = await request.json()
        user_id = body.get("userId")
        title = body.get("title")
        message = body.get("message") 

        if user_id and title and message:
            await asyncio.to_thread(notify_user, user_id, title, message)

        return {"status": "queued"}
    except Exception as e:
        print(f"Send push error: {e}")
        return Response(content=json.dumps({"error": str(e)}), status_code=500, media_type="application/json")


# --- SPA Static Files Serving for Production / Render ---
_FRONTEND_DIST = os.path.join(os.path.dirname(_BACKEND_DIR), "frontend", "dist")
_ASSETS_DIR = os.path.join(_FRONTEND_DIST, "assets")

if os.path.exists(_ASSETS_DIR):
    app.mount("/assets", StaticFiles(directory=_ASSETS_DIR), name="assets")

if os.path.exists(_FRONTEND_DIST):
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith("api") or full_path.startswith("socket.io"):
            return Response(content=json.dumps({"detail": "Not Found"}), status_code=404, media_type="application/json")
        file_path = os.path.join(_FRONTEND_DIST, full_path)
        if full_path and os.path.isfile(file_path):
            return FileResponse(file_path)
        index_file = os.path.join(_FRONTEND_DIST, "index.html")
        if os.path.isfile(index_file):
            return FileResponse(index_file)
        return Response(content="Eventron Frontend Not Built", status_code=404)


combined_app = socketio.ASGIApp(sio, other_asgi_app=app)


if __name__ == "__main__":
    if _BACKEND_DIR not in sys.path:
        sys.path.insert(0, _BACKEND_DIR)
    app_import = "backend.main:combined_app" if os.path.exists(os.path.join(os.getcwd(), "backend")) else "main:combined_app"
    uvicorn.run(
        app_import,
        host="0.0.0.0",
        port=PORT,
        reload=True,
        reload_dirs=[_BACKEND_DIR],
        log_level="info",
    )

