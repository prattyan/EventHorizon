"""
Role-based data filtering / sanitization — direct port of the security helpers
from server.js (isOrganizerOrCollaborator, sanitizeEventForAttendee, etc.).
"""

from __future__ import annotations
from typing import Any


def is_organizer_or_collaborator(event: dict, user_id: str | None, user_email: str | None) -> bool:
    if not event or not user_id:
        return False
    if event.get("organizerId") == user_id:
        return True
    if user_email and user_email in (event.get("collaboratorEmails") or []):
        return True
    return False


def sanitize_event_for_attendee(event: dict) -> dict:
    if not event:
        return event
    sanitized = {**event}
    for key in ("collaboratorEmails", "internalNotes", "stripeSecretKey",
                "webhookSecret", "razorpayKeySecret", "promoCodes", "ticketTiers"):
        sanitized.pop(key, None)
    return sanitized


def filter_registrations_for_user(
    registrations: list[dict],
    user_id: str | None,
    user_email: str | None,
    user_managed_event_ids: set[str],
    user_team_ids: set[str] | None = None,
) -> list[dict]:
    if not isinstance(registrations, list):
        return registrations

    user_team_ids = user_team_ids or set()
    filtered_list = []
    for reg in registrations:
        # 1. Full Access: My registration, My event, or My team members
        if (reg.get("participantId") == user_id or 
            reg.get("participantEmail") == user_email or 
            reg.get("eventId") in user_managed_event_ids or
            (reg.get("teamId") and reg.get("teamId") in user_team_ids)):
            filtered_list.append(reg)
        
        # 2. Public Access: Approved Attendees (Sanitized)
        elif reg.get("status") == "APPROVED":
            public_reg = {
                "id": reg.get("id"),
                "eventId": reg.get("eventId"),
                "participantId": reg.get("participantId"),
                "participantName": reg.get("participantName"),
                "participantAvatarUrl": reg.get("participantAvatarUrl"),
                "status": reg.get("status"),
                "attended": reg.get("attended"),
                "registeredAt": reg.get("registeredAt") # Optional but good for sorting
            }
            filtered_list.append(public_reg)
            
    return filtered_list


def filter_teams_for_user(
    teams: list[dict],
    user_id: str | None,
    user_email: str | None,
    user_managed_event_ids: set[str],
) -> list[dict]:
    if not isinstance(teams, list):
        return teams

    def _matches(team: dict) -> bool:
        if team.get("leaderId") == user_id:
            return True
        members = team.get("members") or []
        if any(m.get("userId") == user_id or (user_email and m.get("email") == user_email) for m in members):
            return True
        if team.get("eventId") in user_managed_event_ids:
            return True
        return False

    return [t for t in teams if _matches(t)]


def sanitize_team_for_user(team: dict, user_id: str | None, user_email: str | None = None) -> dict:
    if not team:
        return team
    sanitized = {**team}
    is_team_member = False
    if team.get("leaderId") == user_id:
        is_team_member = True
    members = team.get("members") or []
    if any(m.get("userId") == user_id or (user_email and m.get("email") == user_email) for m in members):
        is_team_member = True
    if not is_team_member:
        sanitized.pop("inviteCode", None)
    return sanitized


# ─── Main sanitisation entry-points ─────────────────────────────────────

def sanitize_data_for_user(
    data: Any,
    collection_name: str,
    user_context: dict,
    all_events: list[dict] | None = None,
) -> Any:
    user_id = user_context.get("userId")
    user_email = user_context.get("userEmail")
    user_team_ids: set[str] = user_context.get("userTeamIds") or set()
    
    if user_context.get("role") == "admin":
        return data

    all_events = all_events or []

    user_managed_event_ids: set[str] = set()
    for event in all_events:
        if is_organizer_or_collaborator(event, user_id, user_email):
            user_managed_event_ids.add(event.get("id", ""))

    if not isinstance(data, list):
        return _sanitize_single_doc(data, collection_name, user_context, user_managed_event_ids)

    if collection_name == "events":
        return [
            event if is_organizer_or_collaborator(event, user_id, user_email)
            else sanitize_event_for_attendee(event)
            for event in data
        ]
    elif collection_name == "registrations":
        return filter_registrations_for_user(data, user_id, user_email, user_managed_event_ids, user_team_ids)
    elif collection_name == "teams":
        filtered = filter_teams_for_user(data, user_id, user_email, user_managed_event_ids)
        return [
            team if team.get("eventId") in user_managed_event_ids
            else sanitize_team_for_user(team, user_id, user_email)
            for team in filtered
        ]
    return data


def _sanitize_single_doc(
    doc: dict | None,
    collection_name: str,
    user_context: dict,
    user_managed_event_ids: set[str],
) -> dict | None:
    if not doc:
        return doc
    user_id = user_context.get("userId")
    user_email = user_context.get("userEmail")
    user_team_ids: set[str] = user_context.get("userTeamIds") or set()

    if collection_name == "events":
        if is_organizer_or_collaborator(doc, user_id, user_email):
            return doc
        return sanitize_event_for_attendee(doc)

    elif collection_name == "registrations":
        if doc.get("participantId") == user_id or doc.get("participantEmail") == user_email:
            return doc
        if doc.get("eventId") in user_managed_event_ids:
            return doc
        if doc.get("teamId") and doc.get("teamId") in user_team_ids:
            return doc
        if doc.get("status") == "APPROVED":
            return {
                "id": doc.get("id"),
                "eventId": doc.get("eventId"),
                "participantId": doc.get("participantId"),
                "participantName": doc.get("participantName"),
                "participantAvatarUrl": doc.get("participantAvatarUrl"),
                "status": doc.get("status"),
                "attended": doc.get("attended"),
                "registeredAt": doc.get("registeredAt")
            }
        return None

    elif collection_name == "teams":
        if doc.get("leaderId") == user_id:
            return doc
        members = doc.get("members") or []
        if any(m.get("userId") == user_id or (user_email and m.get("email") == user_email) for m in members):
            return sanitize_team_for_user(doc, user_id, user_email)
        if doc.get("eventId") in user_managed_event_ids:
            return doc
        return None

    return doc
